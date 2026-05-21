"""
Connectors Router — External data source integrations (GitHub, Google Drive).
"""

import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.dependencies import get_current_user, get_current_workspace_member
from app.models.models import User, Connector, SyncJob, Document, DocumentChunk, KnowledgeGraphTriple
from app.utils.github_ingestor import ingest_github_repo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workspaces/{workspace_id}/connectors", tags=["Connectors"])


# ========== Schemas ==========

class GitHubConnectorCreate(BaseModel):
    owner: str = Field(..., min_length=1, max_length=255, description="GitHub repo owner/org")
    repo: str = Field(..., min_length=1, max_length=255, description="GitHub repo name")
    branch: str = Field(default="main", max_length=100, description="Branch to ingest")
    github_token: Optional[str] = Field(default=None, description="Optional personal access token for private repos")


class ConnectorResponse(BaseModel):
    id: str
    workspace_id: str
    provider: str
    status: str
    config_json: Optional[dict] = None
    created_at: str
    latest_sync: Optional[dict] = None

    class Config:
        from_attributes = True


# ========== Endpoints ==========

@router.post("/github", status_code=status.HTTP_201_CREATED)
async def create_github_connector(
    workspace_id: str,
    body: GitHubConnectorCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Connect a GitHub repository to a workspace.
    Triggers background ingestion of supported file types.
    """
    get_current_workspace_member(workspace_id=workspace_id, db=db, current_user=current_user)

    # Check for duplicate connector
    existing = (
        db.query(Connector)
        .filter(
            Connector.workspace_id == workspace_id,
            Connector.provider == "github"
        )
        .all()
    )
    for conn in existing:
        config = conn.config_json or {}
        if config.get("owner") == body.owner and config.get("repo") == body.repo:
            raise HTTPException(
                status_code=400,
                detail=f"GitHub connector for {body.owner}/{body.repo} already exists in this workspace."
            )

    # Create connector record
    connector = Connector(
        workspace_id=workspace_id,
        provider="github",
        status="syncing",
        config_json={
            "owner": body.owner,
            "repo": body.repo,
            "branch": body.branch,
            "has_token": bool(body.github_token)
        }
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)

    # Run ingestion in background
    async def _run_ingestion():
        from app.database import SessionLocal
        bg_db = SessionLocal()
        try:
            await ingest_github_repo(
                owner=body.owner,
                repo=body.repo,
                workspace_id=workspace_id,
                connector_id=connector.id,
                db=bg_db,
                github_token=body.github_token,
                branch=body.branch
            )
            # Update connector status
            conn = bg_db.query(Connector).filter(Connector.id == connector.id).first()
            if conn:
                conn.status = "connected"
                bg_db.commit()
        except Exception as e:
            logger.error(f"Background GitHub ingestion failed: {e}")
            conn = bg_db.query(Connector).filter(Connector.id == connector.id).first()
            if conn:
                conn.status = "error"
                bg_db.commit()
        finally:
            bg_db.close()

    # Use asyncio.create_task for async background work
    asyncio.ensure_future(_run_ingestion())

    return {
        "id": connector.id,
        "workspace_id": workspace_id,
        "provider": "github",
        "status": "syncing",
        "config": connector.config_json,
        "message": f"GitHub connector created. Ingesting {body.owner}/{body.repo} in background."
    }


@router.post("/gdrive", status_code=status.HTTP_201_CREATED)
async def create_gdrive_connector(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Google Drive connector placeholder. Full OAuth flow will be implemented in Phase 6.
    """
    get_current_workspace_member(workspace_id=workspace_id, db=db, current_user=current_user)

    connector = Connector(
        workspace_id=workspace_id,
        provider="gdrive",
        status="pending_oauth",
        config_json={"note": "Google Drive OAuth integration coming in Phase 6"}
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)

    return {
        "id": connector.id,
        "workspace_id": workspace_id,
        "provider": "gdrive",
        "status": "pending_oauth",
        "message": "Google Drive connector scaffolded. OAuth popup will be available in Phase 6."
    }


@router.get("")
def list_connectors(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all connectors for a workspace with latest sync status.
    """
    get_current_workspace_member(workspace_id=workspace_id, db=db, current_user=current_user)

    connectors = (
        db.query(Connector)
        .filter(Connector.workspace_id == workspace_id)
        .order_by(Connector.created_at.desc())
        .all()
    )

    results = []
    for conn in connectors:
        # Get latest sync job
        latest_sync = (
            db.query(SyncJob)
            .filter(SyncJob.connector_id == conn.id)
            .order_by(SyncJob.started_at.desc())
            .first()
        )

        # Count ingested documents
        config = conn.config_json or {}
        doc_count = 0
        if conn.provider == "github":
            owner = config.get("owner", "")
            repo = config.get("repo", "")
            prefix = f"github://{owner}/{repo}/"
            doc_count = (
                db.query(Document)
                .filter(
                    Document.workspace_id == workspace_id,
                    Document.storage_url.like(f"{prefix}%")
                )
                .count()
            )

        results.append({
            "id": conn.id,
            "workspace_id": conn.workspace_id,
            "provider": conn.provider,
            "status": conn.status,
            "config": config,
            "created_at": conn.created_at.isoformat() if conn.created_at else "",
            "doc_count": doc_count,
            "latest_sync": {
                "id": latest_sync.id,
                "status": latest_sync.status,
                "started_at": latest_sync.started_at.isoformat() if latest_sync.started_at else "",
                "completed_at": latest_sync.completed_at.isoformat() if latest_sync.completed_at else None,
                "logs": latest_sync.logs
            } if latest_sync else None
        })

    return results


@router.post("/{connector_id}/sync")
async def trigger_sync(
    workspace_id: str,
    connector_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Trigger a re-sync for a connector.
    """
    get_current_workspace_member(workspace_id=workspace_id, db=db, current_user=current_user)

    connector = db.query(Connector).filter(
        Connector.id == connector_id,
        Connector.workspace_id == workspace_id
    ).first()

    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found.")

    if connector.provider != "github":
        raise HTTPException(status_code=400, detail="Only GitHub connectors support re-sync currently.")

    config = connector.config_json or {}
    connector.status = "syncing"
    db.commit()

    async def _run_resync():
        from app.database import SessionLocal
        bg_db = SessionLocal()
        try:
            await ingest_github_repo(
                owner=config.get("owner", ""),
                repo=config.get("repo", ""),
                workspace_id=workspace_id,
                connector_id=connector_id,
                db=bg_db,
                github_token=None,
                branch=config.get("branch", "main")
            )
            conn = bg_db.query(Connector).filter(Connector.id == connector_id).first()
            if conn:
                conn.status = "connected"
                bg_db.commit()
        except Exception as e:
            logger.error(f"Re-sync failed: {e}")
            conn = bg_db.query(Connector).filter(Connector.id == connector_id).first()
            if conn:
                conn.status = "error"
                bg_db.commit()
        finally:
            bg_db.close()

    asyncio.ensure_future(_run_resync())

    return {"message": "Re-sync triggered in background.", "connector_id": connector_id}


@router.delete("/{connector_id}")
def delete_connector(
    workspace_id: str,
    connector_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a connector and all its ingested documents, chunks, and triples.
    """
    get_current_workspace_member(workspace_id=workspace_id, db=db, current_user=current_user)

    connector = db.query(Connector).filter(
        Connector.id == connector_id,
        Connector.workspace_id == workspace_id
    ).first()

    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found.")

    config = connector.config_json or {}

    # Delete associated documents (by storage_url pattern)
    if connector.provider == "github":
        owner = config.get("owner", "")
        repo = config.get("repo", "")
        prefix = f"github://{owner}/{repo}/"

        docs = (
            db.query(Document)
            .filter(
                Document.workspace_id == workspace_id,
                Document.storage_url.like(f"{prefix}%")
            )
            .all()
        )

        for doc in docs:
            # Delete knowledge triples
            db.query(KnowledgeGraphTriple).filter(
                KnowledgeGraphTriple.document_id == doc.id
            ).delete()
            # Delete chunks
            db.query(DocumentChunk).filter(
                DocumentChunk.document_id == doc.id
            ).delete()
            db.delete(doc)

        # Delete from Qdrant
        try:
            from app.utils.qdrant import qdrant_helper
            for doc in docs:
                qdrant_helper.delete_by_document(doc.id)
        except Exception as e:
            logger.warning(f"Qdrant cleanup failed: {e}")

    # Delete sync jobs and connector
    db.query(SyncJob).filter(SyncJob.connector_id == connector_id).delete()
    db.delete(connector)
    db.commit()

    return {"message": "Connector and all associated data deleted.", "connector_id": connector_id}
