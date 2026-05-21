from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.exceptions import UnexpectedResponse
from app.config import settings
from typing import List, Dict, Any, Optional

class QdrantHelper:
    def __init__(self):
        self.client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None
        )
        self.collection_name = settings.QDRANT_COLLECTION

    def ensure_collection(self, vector_size: int = 1024):
        """
        Ensures the RAG collection exists in Qdrant.
        Creates it if it does not exist.
        """
        try:
            # Check if collection exists by getting list of collections
            collections = self.client.get_collections().collections
            collection_names = [col.name for col in collections]
            
            if self.collection_name not in collection_names:
                print(f"Creating Qdrant collection: {self.collection_name} with dimension {vector_size}")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=vector_size,
                        distance=models.Distance.COSINE
                    )
                )
            else:
                print(f"Qdrant collection {self.collection_name} already exists.")
        except Exception as e:
            print(f"Error ensuring Qdrant collection: {e}")
            raise e

    def upsert_chunks(
        self,
        chunks: List[Any],  # List of DocumentChunk models/dicts
        embeddings: List[List[float]],
        filenames: List[str]
    ):
        """
        Upserts document chunks with their dense vector embeddings and metadata.
        """
        if not chunks or not embeddings:
            return

        points = []
        for idx, chunk in enumerate(chunks):
            # chunk can be a DocumentChunk OR a dict
            if isinstance(chunk, dict):
                chunk_id = chunk.get("id")
                document_id = chunk.get("document_id")
                workspace_id = chunk.get("workspace_id")
                chunk_index = chunk.get("chunk_index")
                content = chunk.get("content")
                page_number = chunk.get("page_number")
                metadata = chunk.get("metadata_json") or {}
            else:
                chunk_id = getattr(chunk, "id", None)
                document_id = getattr(chunk, "document_id", None)
                workspace_id = getattr(chunk, "workspace_id", None)
                chunk_index = getattr(chunk, "chunk_index", None)
                content = getattr(chunk, "content", None)
                page_number = getattr(chunk, "page_number", None)
                metadata = getattr(chunk, "metadata_json", None) or {}

            # Convert UUIDs to strings for JSON payload and Qdrant Point ID compatibility
            if chunk_id:
                chunk_id = str(chunk_id)
            if document_id:
                document_id = str(document_id)
            if workspace_id:
                workspace_id = str(workspace_id)

            filename = filenames[idx] if idx < len(filenames) else ""

            payload = {
                "chunk_id": chunk_id,
                "document_id": document_id,
                "workspace_id": workspace_id,
                "chunk_index": chunk_index,
                "content": content,
                "page_number": page_number,
                "filename": filename,
                "metadata": metadata
            }

            points.append(
                models.PointStruct(
                    id=chunk_id,
                    vector=embeddings[idx],
                    payload=payload
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )

    def delete_by_document(self, document_id: str):
        """
        Deletes all vector points associated with a specific document.
        """
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=document_id)
                    )
                ]
            )
        )

    def delete_by_workspace(self, workspace_id: str):
        """
        Deletes all vector points associated with a specific workspace.
        """
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.Filter(
                must=[
                    models.FieldCondition(
                        key="workspace_id",
                        match=models.MatchValue(value=workspace_id)
                    )
                ]
            )
        )

    def search_workspace_chunks(
        self,
        workspace_id: str,
        query_vector: List[float],
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Searches workspace-specific vector points using strict filtering.
        """
        search_req = models.SearchRequest(
            vector=query_vector,
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="workspace_id",
                        match=models.MatchValue(value=workspace_id)
                    )
                ]
            ),
            limit=limit,
            with_payload=True
        )
        search_result = self.client.http.search_api.search_points(
            collection_name=self.collection_name,
            search_request=search_req
        )
        hits = search_result.result if search_result and search_result.result else []

        return [
            {
                "chunk_id": hit.payload.get("chunk_id"),
                "document_id": hit.payload.get("document_id"),
                "workspace_id": hit.payload.get("workspace_id"),
                "chunk_index": hit.payload.get("chunk_index"),
                "content": hit.payload.get("content"),
                "page_number": hit.payload.get("page_number"),
                "filename": hit.payload.get("filename"),
                "metadata": hit.payload.get("metadata", {}),
                "score": hit.score
            }
            for hit in hits
        ]

# Global helper instance
qdrant_helper = QdrantHelper()
