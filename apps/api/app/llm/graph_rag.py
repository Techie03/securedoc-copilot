"""
GraphRAG Knowledge Graph — NVIDIA NIM-Powered Entity & Relationship Extraction

Extracts structured (subject, predicate, object) triples from document text
using NVIDIA NIM LLM prompts, persists them to PostgreSQL, and provides
graph-traversal context expansion for hybrid RAG retrieval.
"""

import json
import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.llm.nvidia_client import NvidiaNIMClient
from app.models.models import KnowledgeGraphTriple

logger = logging.getLogger(__name__)


async def extract_entities_from_text(
    text: str,
    document_id: str,
    workspace_id: str,
    db: Session,
    max_triples: int = 15
) -> List[Dict[str, str]]:
    """
    Uses NVIDIA NIM LLM to extract structured entity-relationship triples
    from a chunk of document text. Persists them to PostgreSQL.

    Returns list of extracted triples as dicts.
    """
    client = NvidiaNIMClient()

    system_prompt = (
        "You are an expert knowledge graph extractor for enterprise documents.\n"
        "Analyze the provided text and extract key entities and their relationships.\n"
        "Output a JSON array of triples with the format:\n"
        '[{"subject": "Entity A", "predicate": "relationship", "object": "Entity B", "confidence": 0.95}]\n\n'
        "Rules:\n"
        "- Extract concrete, factual relationships (not opinions or speculation).\n"
        "- Use normalized entity names (capitalize proper nouns, lowercase general terms).\n"
        "- Use clear relationship predicates like: 'is_a', 'part_of', 'uses', 'depends_on', "
        "'authored_by', 'located_in', 'contains', 'implements', 'extends', 'manages', "
        "'connects_to', 'processes', 'belongs_to', 'requires', 'produces'.\n"
        "- Set confidence between 0.5 and 1.0 based on clarity of the relationship.\n"
        f"- Extract at most {max_triples} triples.\n"
        "- If the text contains no extractable entities, respond with exactly: []\n"
        "- Output ONLY the raw JSON array. No markdown, no explanation."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Document text:\n\n{text[:3000]}\n\nExtracted triples:"}
    ]

    extracted_triples = []

    try:
        response = await client.chat(messages=messages, temperature=0.0, max_tokens=800)
        clean_res = response.strip()

        # Strip markdown code blocks if present
        if clean_res.startswith("```json"):
            clean_res = clean_res[7:]
        if clean_res.startswith("```"):
            clean_res = clean_res[3:]
        if clean_res.endswith("```"):
            clean_res = clean_res[:-3]
        clean_res = clean_res.strip()

        if clean_res and clean_res != "[]":
            parsed = json.loads(clean_res)
            if isinstance(parsed, list):
                for item in parsed:
                    subject = item.get("subject", "").strip()
                    predicate = item.get("predicate", "").strip()
                    obj = item.get("object", "").strip()
                    confidence = float(item.get("confidence", 0.9))

                    if subject and predicate and obj:
                        # Persist to PostgreSQL
                        triple = KnowledgeGraphTriple(
                            workspace_id=workspace_id,
                            document_id=document_id,
                            subject=subject[:500],
                            predicate=predicate[:255],
                            object_entity=obj[:500],
                            confidence=min(1.0, max(0.0, confidence)),
                            metadata_json={"source_length": len(text)}
                        )
                        db.add(triple)
                        extracted_triples.append({
                            "subject": subject,
                            "predicate": predicate,
                            "object": obj,
                            "confidence": confidence
                        })

                db.commit()

    except json.JSONDecodeError as e:
        logger.warning(f"GraphRAG JSON parse failed: {e}")
    except Exception as e:
        logger.error(f"GraphRAG extraction failed: {e}")
        db.rollback()

    return extracted_triples


async def build_graph_context(
    query: str,
    workspace_id: str,
    db: Session,
    max_hops: int = 2,
    max_results: int = 20
) -> List[Dict[str, Any]]:
    """
    Given a user query, extracts query entities using NIM, then traverses
    the knowledge graph in PostgreSQL to find related triples.

    Returns list of relevant graph triples for context augmentation.
    """
    client = NvidiaNIMClient()

    # Step 1: Extract key entities from the query
    entity_prompt = (
        "Extract the key entities (nouns, proper nouns, technical terms) from this query.\n"
        "Output a JSON array of strings. Example: [\"Python\", \"machine learning\", \"NVIDIA\"]\n"
        "If no entities found, output: []\n"
        "Output ONLY the raw JSON array."
    )

    messages = [
        {"role": "system", "content": entity_prompt},
        {"role": "user", "content": f"Query: {query}\n\nEntities:"}
    ]

    query_entities = []
    try:
        response = await client.chat(messages=messages, temperature=0.0, max_tokens=100)
        clean_res = response.strip()
        if clean_res.startswith("```"):
            clean_res = clean_res.split("\n", 1)[-1] if "\n" in clean_res else clean_res[3:]
        if clean_res.endswith("```"):
            clean_res = clean_res[:-3]
        clean_res = clean_res.strip()

        parsed = json.loads(clean_res)
        if isinstance(parsed, list):
            query_entities = [str(e).strip() for e in parsed if e]
    except Exception as e:
        logger.warning(f"Query entity extraction failed: {e}")
        # Fallback: use query words as entities
        query_entities = [w for w in query.split() if len(w) > 3][:5]

    if not query_entities:
        return []

    # Step 2: Multi-hop graph traversal in PostgreSQL
    visited_entities = set()
    all_triples = []
    current_entities = query_entities[:10]  # Cap initial entity count

    for hop in range(max_hops):
        if not current_entities:
            break

        # Build case-insensitive LIKE filters for subject or object matching
        filters = []
        for entity in current_entities:
            entity_lower = entity.lower()
            filters.append(
                KnowledgeGraphTriple.subject.ilike(f"%{entity_lower}%")
            )
            filters.append(
                KnowledgeGraphTriple.object_entity.ilike(f"%{entity_lower}%")
            )

        results = (
            db.query(KnowledgeGraphTriple)
            .filter(
                KnowledgeGraphTriple.workspace_id == workspace_id,
                or_(*filters)
            )
            .order_by(KnowledgeGraphTriple.confidence.desc())
            .limit(max_results)
            .all()
        )

        next_hop_entities = []
        for triple in results:
            triple_key = f"{triple.subject}|{triple.predicate}|{triple.object_entity}"
            if triple_key not in visited_entities:
                visited_entities.add(triple_key)
                all_triples.append({
                    "subject": triple.subject,
                    "predicate": triple.predicate,
                    "object": triple.object_entity,
                    "confidence": triple.confidence,
                    "document_id": triple.document_id
                })

                # Collect new entities for next hop
                if triple.subject.lower() not in {e.lower() for e in current_entities}:
                    next_hop_entities.append(triple.subject)
                if triple.object_entity.lower() not in {e.lower() for e in current_entities}:
                    next_hop_entities.append(triple.object_entity)

        current_entities = next_hop_entities[:10]

    return all_triples[:max_results]


def format_graph_context(triples: List[Dict[str, Any]]) -> str:
    """
    Formats graph triples into a readable context string for LLM prompt injection.
    """
    if not triples:
        return ""

    lines = ["Knowledge Graph Context (entity relationships extracted from documents):"]
    for t in triples:
        conf = f" [{t['confidence']:.0%}]" if t.get('confidence') else ""
        lines.append(f"  • {t['subject']} —[{t['predicate']}]→ {t['object']}{conf}")

    return "\n".join(lines)
