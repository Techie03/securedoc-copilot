import json
from typing import List, Dict, Any
from app.llm.nvidia_client import NvidiaNIMClient

async def extract_knowledge_triples(text: str) -> List[Dict[str, Any]]:
    """
    Extracts Subject-Predicate-Object triples from a text chunk using NVIDIA NIM.
    Returns a list of dictionaries with keys: 'subject', 'predicate', 'object_entity'.
    """
    client = NvidiaNIMClient()
    
    # In mock mode, return a dummy triple
    if client.mock:
        return [{
            "subject": "Mock Entity",
            "predicate": "is related to",
            "object_entity": "Mock Object"
        }]

    prompt = f"""You are an advanced Knowledge Graph Extraction AI.
Extract explicit entity relationships from the provided text as Subject-Predicate-Object triples.

Rules:
1. Identify key entities (people, organizations, locations, concepts, technologies).
2. Identify the clear relationships between them.
3. Return the data ONLY as a valid JSON array of objects. Do not include any other text, markdown formatting, or explanations.
4. Each object must have exactly three keys: "subject", "predicate", "object_entity".

Text to analyze:
{text}
"""
    
    messages = [
        {"role": "system", "content": "You are a precise JSON-only data extraction API. Output strictly valid JSON."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        # Lower temperature for precise formatting
        response = await client.chat(messages, temperature=0.1, max_tokens=1500)
        
        # Clean markdown code blocks if the model insists on adding them
        cleaned_response = response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.startswith("```"):
            cleaned_response = cleaned_response[3:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
            
        triples = json.loads(cleaned_response.strip())
        
        # Validate format to ensure DB insertion doesn't fail
        valid_triples = []
        if isinstance(triples, list):
            for t in triples:
                if isinstance(t, dict) and "subject" in t and "predicate" in t and "object_entity" in t:
                    valid_triples.append({
                        "subject": str(t["subject"])[:500],
                        "predicate": str(t["predicate"])[:255],
                        "object_entity": str(t["object_entity"])[:500]
                    })
        return valid_triples
    except Exception as e:
        print(f"Graph extraction error: {e}")
        return []
