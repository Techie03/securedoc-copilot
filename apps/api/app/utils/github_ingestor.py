"""
GitHub Repository Ingestor — Crawls public/private repos and ingests supported files
into SecureDoc Copilot's document pipeline (PostgreSQL + Qdrant + GraphRAG).
"""

import logging
import httpx
import base64
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.models import Document, DocumentChunk, Connector, SyncJob
from app.llm.nvidia_client import NvidiaNIMClient
from app.utils.qdrant import qdrant_helper
from app.llm.graph_rag import extract_entities_from_text

logger = logging.getLogger(__name__)

# File extensions we support for code/doc ingestion
SUPPORTED_EXTENSIONS = {
    ".md", ".py", ".ts", ".tsx", ".js", ".jsx",
    ".txt", ".json", ".yaml", ".yml", ".toml",
    ".rs", ".go", ".java", ".cpp", ".c", ".h",
    ".css", ".html", ".sql", ".sh", ".env",
    ".csv", ".xml", ".ini", ".cfg"
}

# Max file size to process (128KB)
MAX_FILE_SIZE = 128 * 1024

# Max files per sync
MAX_FILES_PER_SYNC = 100

# Chunk size for splitting text
CHUNK_SIZE = 1200
CHUNK_OVERLAP = 200


def _split_text_into_chunks(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Simple sliding window text chunker."""
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk)
        start = end - overlap
    
    return chunks


async def ingest_github_repo(
    owner: str,
    repo: str,
    workspace_id: str,
    connector_id: str,
    db: Session,
    github_token: Optional[str] = None,
    branch: str = "main"
) -> Dict[str, Any]:
    """
    Crawls a GitHub repository tree, downloads supported files,
    creates Document + DocumentChunk records, generates embeddings,
    upserts to Qdrant, and extracts GraphRAG triples.
    
    Returns sync job result summary.
    """
    result = {
        "files_processed": 0,
        "chunks_created": 0,
        "triples_extracted": 0,
        "errors": [],
        "status": "completed"
    }
    
    # Create sync job
    sync_job = SyncJob(
        connector_id=connector_id,
        status="running",
        logs=""
    )
    db.add(sync_job)
    db.commit()
    db.refresh(sync_job)
    
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SecureDoc-Copilot/1.0"
    }
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
    
    nim_client = NvidiaNIMClient()
    
    try:
        # Step 1: Fetch repository tree
        tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        
        async with httpx.AsyncClient(timeout=30) as client:
            tree_resp = await client.get(tree_url, headers=headers)
            tree_resp.raise_for_status()
            tree_data = tree_resp.json()
        
        # Filter to supported file types
        files = []
        for item in tree_data.get("tree", []):
            if item.get("type") != "blob":
                continue
            path = item.get("path", "")
            ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
            size = item.get("size", 0)
            
            if ext in SUPPORTED_EXTENSIONS and size <= MAX_FILE_SIZE:
                files.append({
                    "path": path,
                    "sha": item.get("sha", ""),
                    "size": size
                })
        
        files = files[:MAX_FILES_PER_SYNC]
        _log(sync_job, db, f"Found {len(files)} supported files to ingest from {owner}/{repo}")
        
        # Step 2: Process each file
        for file_info in files:
            try:
                file_path = file_info["path"]
                
                # Download file content
                content_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}?ref={branch}"
                
                async with httpx.AsyncClient(timeout=30) as client:
                    content_resp = await client.get(content_url, headers=headers)
                    content_resp.raise_for_status()
                    content_data = content_resp.json()
                
                # Decode content (GitHub returns base64)
                encoding = content_data.get("encoding", "base64")
                raw_content = content_data.get("content", "")
                
                if encoding == "base64":
                    try:
                        file_content = base64.b64decode(raw_content).decode("utf-8", errors="replace")
                    except Exception:
                        continue
                else:
                    file_content = raw_content
                
                if not file_content.strip():
                    continue
                
                # Determine file type from extension
                ext = file_path.rsplit(".", 1)[-1].upper() if "." in file_path else "TXT"
                
                # Create Document record
                doc = Document(
                    workspace_id=workspace_id,
                    filename=file_path,
                    file_type=ext,
                    storage_url=f"github://{owner}/{repo}/{file_path}",
                    status="processing",
                    version=1
                )
                db.add(doc)
                db.commit()
                db.refresh(doc)
                
                # Chunk the content
                text_chunks = _split_text_into_chunks(file_content)
                
                chunk_models = []
                for idx, chunk_text in enumerate(text_chunks):
                    chunk = DocumentChunk(
                        document_id=doc.id,
                        workspace_id=workspace_id,
                        chunk_index=idx,
                        content=chunk_text,
                        page_number=None,
                        token_count=len(chunk_text) // 4,
                        metadata_json={
                            "source": "github",
                            "repo": f"{owner}/{repo}",
                            "path": file_path,
                            "branch": branch
                        }
                    )
                    db.add(chunk)
                    chunk_models.append(chunk)
                
                db.commit()
                # Refresh to get IDs
                for cm in chunk_models:
                    db.refresh(cm)
                
                result["chunks_created"] += len(chunk_models)
                
                # Generate embeddings
                chunk_texts = [cm.content for cm in chunk_models]
                try:
                    embeddings = await nim_client.embed_texts(chunk_texts, input_type="passage")
                    
                    # Upsert to Qdrant
                    qdrant_helper.upsert_chunks(
                        chunks=chunk_models,
                        embeddings=embeddings,
                        filenames=[file_path] * len(chunk_models)
                    )
                    
                    # Update Qdrant point IDs
                    for cm in chunk_models:
                        cm.qdrant_point_id = cm.id
                    db.commit()
                except Exception as embed_err:
                    logger.warning(f"Embedding/Qdrant upsert failed for {file_path}: {embed_err}")
                
                # Extract GraphRAG triples (from first chunk or full content)
                try:
                    triples = await extract_entities_from_text(
                        text=file_content[:3000],
                        document_id=doc.id,
                        workspace_id=workspace_id,
                        db=db,
                        max_triples=8
                    )
                    result["triples_extracted"] += len(triples)
                except Exception as graph_err:
                    logger.warning(f"GraphRAG extraction failed for {file_path}: {graph_err}")
                
                # Mark document as ready
                doc.status = "ready"
                db.commit()
                
                result["files_processed"] += 1
                
            except Exception as file_err:
                error_msg = f"Error processing {file_info['path']}: {str(file_err)}"
                result["errors"].append(error_msg)
                logger.warning(error_msg)
                continue
        
        # Finalize sync job
        sync_job.status = "completed"
        sync_job.completed_at = datetime.utcnow()
        _log(sync_job, db, 
             f"Sync completed: {result['files_processed']} files, "
             f"{result['chunks_created']} chunks, "
             f"{result['triples_extracted']} triples extracted")
        db.commit()
        
    except Exception as e:
        result["status"] = "failed"
        result["errors"].append(str(e))
        sync_job.status = "failed"
        sync_job.completed_at = datetime.utcnow()
        _log(sync_job, db, f"Sync failed: {str(e)}")
        db.commit()
        logger.error(f"GitHub ingestion failed for {owner}/{repo}: {e}")
    
    return result


def _log(sync_job: SyncJob, db: Session, message: str):
    """Appends a log line to the sync job."""
    existing = sync_job.logs or ""
    timestamp = datetime.utcnow().strftime("%H:%M:%S")
    sync_job.logs = existing + f"[{timestamp}] {message}\n"
    db.add(sync_job)
    db.commit()
