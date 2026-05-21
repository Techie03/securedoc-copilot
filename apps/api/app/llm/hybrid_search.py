"""
Hybrid Search Pipeline — Dense + Sparse + GraphRAG with RRF Fusion

Combines three retrieval signals:
  1. Dense Vector Search (Qdrant cosine similarity)
  2. Sparse Keyword Search (PostgreSQL full-text ts_vector/ts_rank)
  3. GraphRAG Entity Expansion (knowledge graph traversal)

Results are merged using Reciprocal Rank Fusion (RRF) and
optionally reranked via NVIDIA NIM reranker.
"""

import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text

from app.llm.nvidia_client import NvidiaNIMClient
from app.llm.graph_rag import build_graph_context, format_graph_context
from app.utils.qdrant import qdrant_helper
from app.models.models import DocumentChunk, Document

logger = logging.getLogger(__name__)

# RRF constant — standard value from literature
RRF_K = 60


class HybridSearchPipeline:
    """
    Orchestrates multi-signal retrieval with RRF fusion and NIM reranking.
    """

    def __init__(self):
        self.nim_client = NvidiaNIMClient()

    async def search(
        self,
        query: str,
        workspace_id: str,
        db: Session,
        dense_limit: int = 15,
        sparse_limit: int = 10,
        final_top_n: int = 5,
        enable_graph: bool = True,
        enable_rerank: bool = True
    ) -> Dict[str, Any]:
        """
        Executes the full hybrid search pipeline.

        Returns:
            {
                "chunks": [...],        # Final ranked chunk results
                "graph_context": "...",  # Formatted graph context string
                "signals": {...}         # Debug info about each signal
            }
        """
        results = {
            "chunks": [],
            "graph_context": "",
            "signals": {
                "dense_count": 0,
                "sparse_count": 0,
                "graph_triples": 0,
                "rrf_candidates": 0
            }
        }

        # Signal 1: Dense Vector Search (Qdrant)
        dense_hits = await self._dense_search(query, workspace_id, limit=dense_limit)
        results["signals"]["dense_count"] = len(dense_hits)

        # Signal 2: Sparse Keyword Search (PostgreSQL full-text)
        sparse_hits = self._sparse_search(query, workspace_id, db, limit=sparse_limit)
        results["signals"]["sparse_count"] = len(sparse_hits)

        # Signal 3: GraphRAG Entity Expansion
        graph_triples = []
        if enable_graph:
            try:
                graph_triples = await build_graph_context(query, workspace_id, db)
                results["signals"]["graph_triples"] = len(graph_triples)
                results["graph_context"] = format_graph_context(graph_triples)
            except Exception as e:
                logger.warning(f"GraphRAG context failed: {e}")

        # RRF Fusion
        fused = self._rrf_fusion(dense_hits, sparse_hits, graph_triples, db)
        results["signals"]["rrf_candidates"] = len(fused)

        if not fused:
            return results

        # Optional NIM Reranking
        if enable_rerank and len(fused) > 1:
            try:
                fused = await self._rerank(query, fused, top_n=final_top_n)
            except Exception as e:
                logger.warning(f"Reranking failed, using RRF order: {e}")
                fused = fused[:final_top_n]
        else:
            fused = fused[:final_top_n]

        results["chunks"] = fused
        return results

    async def _dense_search(
        self, query: str, workspace_id: str, limit: int = 15
    ) -> List[Dict[str, Any]]:
        """
        Qdrant dense vector cosine similarity search.
        """
        try:
            query_vectors = await self.nim_client.embed_texts([query], input_type="query")
            query_vector = query_vectors[0] if query_vectors else []

            if not query_vector:
                return []

            hits = qdrant_helper.search_workspace_chunks(
                workspace_id=workspace_id,
                query_vector=query_vector,
                limit=limit
            )
            return hits
        except Exception as e:
            logger.error(f"Dense search failed: {e}")
            return []

    def _sparse_search(
        self, query: str, workspace_id: str, db: Session, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        PostgreSQL full-text search (BM25-style) on document_chunks.content.
        Uses plainto_tsquery for safe query parsing.
        """
        try:
            # Sanitize query for PostgreSQL ts_query
            clean_query = " & ".join(
                word for word in query.split()
                if len(word) > 2 and word.isalnum()
            )

            if not clean_query:
                return []

            sql = sql_text("""
                SELECT 
                    dc.id as chunk_id,
                    dc.document_id,
                    dc.workspace_id,
                    dc.chunk_index,
                    dc.content,
                    dc.page_number,
                    d.filename,
                    ts_rank(
                        to_tsvector('english', dc.content),
                        plainto_tsquery('english', :query)
                    ) as rank_score
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE dc.workspace_id = :workspace_id
                  AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', :query)
                ORDER BY rank_score DESC
                LIMIT :limit
            """)

            rows = db.execute(
                sql,
                {"query": query, "workspace_id": workspace_id, "limit": limit}
            ).fetchall()

            return [
                {
                    "chunk_id": row.chunk_id,
                    "document_id": row.document_id,
                    "workspace_id": row.workspace_id,
                    "chunk_index": row.chunk_index,
                    "content": row.content,
                    "page_number": row.page_number,
                    "filename": row.filename,
                    "score": float(row.rank_score)
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Sparse search failed: {e}")
            return []

    def _rrf_fusion(
        self,
        dense_hits: List[Dict[str, Any]],
        sparse_hits: List[Dict[str, Any]],
        graph_triples: List[Dict[str, Any]],
        db: Session
    ) -> List[Dict[str, Any]]:
        """
        Reciprocal Rank Fusion (RRF) across all retrieval signals.
        
        RRF score = Σ 1/(k + rank_i) for each signal where the chunk appears.
        """
        # Chunk score accumulator: chunk_id -> {score, data}
        chunk_scores: Dict[str, Dict[str, Any]] = {}

        # Process dense results
        for rank, hit in enumerate(dense_hits):
            chunk_id = hit.get("chunk_id", "")
            if not chunk_id:
                continue
            rrf_score = 1.0 / (RRF_K + rank + 1)
            if chunk_id in chunk_scores:
                chunk_scores[chunk_id]["rrf_score"] += rrf_score
                chunk_scores[chunk_id]["signals"].append("dense")
            else:
                chunk_scores[chunk_id] = {
                    "rrf_score": rrf_score,
                    "data": hit,
                    "signals": ["dense"]
                }

        # Process sparse results
        for rank, hit in enumerate(sparse_hits):
            chunk_id = hit.get("chunk_id", "")
            if not chunk_id:
                continue
            rrf_score = 1.0 / (RRF_K + rank + 1)
            if chunk_id in chunk_scores:
                chunk_scores[chunk_id]["rrf_score"] += rrf_score
                chunk_scores[chunk_id]["signals"].append("sparse")
            else:
                chunk_scores[chunk_id] = {
                    "rrf_score": rrf_score,
                    "data": hit,
                    "signals": ["sparse"]
                }

        # Process graph triples — boost chunks from documents mentioned in graph
        graph_doc_ids = {t.get("document_id") for t in graph_triples if t.get("document_id")}
        if graph_doc_ids:
            for chunk_id, entry in chunk_scores.items():
                doc_id = entry["data"].get("document_id", "")
                if doc_id in graph_doc_ids:
                    entry["rrf_score"] += 1.0 / (RRF_K + 1)  # Graph signal boost
                    entry["signals"].append("graph")

        # Sort by RRF score descending
        sorted_chunks = sorted(
            chunk_scores.values(),
            key=lambda x: x["rrf_score"],
            reverse=True
        )

        # Enrich and return
        return [
            {
                **entry["data"],
                "relevance_score": entry["rrf_score"],
                "retrieval_signals": entry["signals"]
            }
            for entry in sorted_chunks
        ]

    async def _rerank(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        top_n: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Final NIM reranking pass on RRF-fused candidates.
        """
        doc_contents = [c.get("content", "")[:1500] for c in chunks]
        reranked = await self.nim_client.rerank(
            query=query,
            documents=doc_contents,
            top_n=top_n
        )

        result = []
        for rank_item in reranked:
            idx = rank_item["index"]
            if idx < len(chunks):
                chunk = chunks[idx].copy()
                chunk["relevance_score"] = rank_item["relevance_score"]
                result.append(chunk)

        return result


# Singleton instance
hybrid_search_pipeline = HybridSearchPipeline()
