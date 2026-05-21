from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import httpx
import uuid
from app.database import get_db
from app.crud import crud
from app.schemas.schemas import (
    WorkspaceCreate, WorkspaceResponse, WorkspaceDetailResponse,
    WorkspaceMemberAdd, WorkspaceMemberResponse, GitHubSyncRequest
)
from app.dependencies import get_current_user, get_current_workspace_member
from app.models.models import User, KnowledgeGraphTriple, Document
from app.routers.documents import process_document_background

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])

@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace_endpoint(
    workspace_in: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new workspace and assign the creator as 'owner'.
    """
    return crud.create_workspace(db=db, workspace_in=workspace_in, owner_id=current_user.id)

@router.get("", response_model=List[WorkspaceResponse])
def list_workspaces_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all workspaces the current user is a member of.
    """
    return crud.get_workspaces_for_user(db=db, user_id=current_user.id)

@router.get("/{workspace_id}", response_model=WorkspaceDetailResponse)
def get_workspace_details(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve details of a specific workspace, including members.
    Requires membership.
    """
    # 1. Verify membership
    crud.get_current_workspace_member = get_current_workspace_member(
        workspace_id=workspace_id, db=db, current_user=current_user
    )
    
    # 2. Fetch workspace
    workspace = crud.get_workspace(db, workspace_id=workspace_id)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found"
        )
    return workspace

@router.post("/{workspace_id}/members", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
def add_member_endpoint(
    workspace_id: str,
    member_in: WorkspaceMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a user to a workspace.
    Only owners and admins can add new members.
    """
    # 1. Check requester permissions
    requester_membership = get_current_workspace_member(
        workspace_id=workspace_id, db=db, current_user=current_user
    )
    if requester_membership.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can invite members."
        )

    # 2. Verify invitee user exists
    invitee = crud.get_user_by_email(db, email=member_in.email)
    if not invitee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{member_in.email}' does not exist."
        )

    # 3. Check if user is already a member
    existing_membership = crud.get_workspace_member(db, workspace_id=workspace_id, user_id=invitee.id)
    if existing_membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this workspace."
        )

    # 4. Add member
    return crud.add_workspace_member(
        db=db,
        workspace_id=workspace_id,
        user_id=invitee.id,
        role=member_in.role
    )

@router.delete("/{workspace_id}/members/{user_id}", status_code=status.HTTP_200_OK)
def remove_member_endpoint(
    workspace_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a member from a workspace.
    Requires appropriate permissions:
    - Owners can remove anyone except themselves.
    - Admins can remove members and viewers, but not owners or other admins.
    - Users can remove themselves (leave the workspace).
    """
    # 1. Check requester membership
    requester_membership = get_current_workspace_member(
        workspace_id=workspace_id, db=db, current_user=current_user
    )

    # 2. Check target membership
    target_membership = crud.get_workspace_member(db, workspace_id=workspace_id, user_id=user_id)
    if not target_membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this workspace."
        )

    # 3. Handle self-removal (leaving)
    if current_user.id == user_id:
        if target_membership.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workspace owners cannot leave the workspace. You must transfer ownership first."
            )
        crud.remove_workspace_member(db, workspace_id, user_id)
        return {"detail": "Successfully left the workspace."}

    # 4. Handle other removals (requester removing someone else)
    if requester_membership.role == "owner":
        # Owner can remove anyone
        crud.remove_workspace_member(db, workspace_id, user_id)
    elif requester_membership.role == "admin":
        # Admin can remove member/viewer, not owner/admin
        if target_membership.role in ["owner", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot remove other admins or owners."
            )
        crud.remove_workspace_member(db, workspace_id, user_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to remove members from this workspace."
        )

    return {"detail": "Member successfully removed."}

@router.get("/{workspace_id}/graph")
def get_workspace_graph(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve all knowledge graph triples extracted for a workspace.
    """
    get_current_workspace_member(workspace_id=workspace_id, db=db, current_user=current_user)
    
    triples = db.query(KnowledgeGraphTriple).filter(
        KnowledgeGraphTriple.workspace_id == workspace_id
    ).order_by(KnowledgeGraphTriple.created_at.desc()).all()
    
    return [
        {
            "id": t.id,
            "subject": t.subject,
            "predicate": t.predicate,
            "object_entity": t.object_entity,
            "confidence": t.confidence,
            "document_id": t.document_id,
            "created_at": t.created_at
        }
        for t in triples
    ]

@router.post("/{workspace_id}/connectors/github/sync")
async def sync_github_connector(
    workspace_id: str,
    request: GitHubSyncRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Syncs a GitHub repository by fetching its README.md and ingesting it as a Document.
    """
    get_current_workspace_member(workspace_id=workspace_id, db=db, current_user=current_user)

    repo_url = request.repo_url.strip()
    if not repo_url.startswith("https://github.com/"):
        raise HTTPException(status_code=400, detail="Invalid GitHub URL. Must start with https://github.com/")

    # Parse owner/repo
    parts = repo_url.split("https://github.com/")[1].split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Invalid GitHub URL format.")
    
    owner, repo = parts[0], parts[1]
    
    # Try fetching README.md from main and master branches
    readme_content = None
    async with httpx.AsyncClient() as client:
        for branch in ["main", "master"]:
            raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/README.md"
            resp = await client.get(raw_url)
            if resp.status_code == 200:
                readme_content = resp.text
                break
                
    if not readme_content:
        raise HTTPException(status_code=404, detail="Could not locate a README.md on main or master branches.")

    # Create a mocked document record
    doc_id = str(uuid.uuid4())
    filename = f"{owner}_{repo}_README.md"
    
    new_doc = Document(
        id=doc_id,
        workspace_id=workspace_id,
        uploaded_by=current_user.id,
        filename=filename,
        file_type="text/markdown",
        storage_url=repo_url,  # Just use the repo URL as a reference
        status="processing",
        version=1
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Use the existing background processor but pass raw text instead of a file
    # We will need to adapt the processor slightly or create a raw file locally.
    # Since process_document_background typically downloads from S3, 
    # we can just write the content to a temp file and let it run, or bypass S3.
    # To keep it simple, we'll write it to a temp file and mock the storage download path.
    
    import tempfile
    import os
    
    tmp_path = os.path.join(tempfile.gettempdir(), f"{doc_id}_{filename}")
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(readme_content)
        
    # We will invoke the background processing directly using the temp file path
    # as the 'storage_url' inside the task logic if it supports local fallback.
    # Actually, process_document_background expects the storage URL to download.
    # To avoid changing the S3 logic entirely, let's just inline a simple chunker here
    # or rely on the background task.
    # For robust deployment without needing S3 buckets for the mock connector, we'll inline a fast indexer.
    
    def process_github_doc_inline(doc_id_val: str, workspace_id_val: str, text_content: str):
        from app.database import SessionLocal
        from app.utils.qdrant import qdrant_helper
        from app.models.models import Document, DocumentChunk
        from app.llm.nvidia_client import NvidiaNIMClient
        import asyncio
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        
        db_bg = SessionLocal()
        try:
            doc = db_bg.query(Document).filter(Document.id == doc_id_val).first()
            if not doc:
                return

            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                separators=["\n\n", "\n", " ", ""]
            )
            chunks = text_splitter.split_text(text_content)
            
            # Extract Graph from first chunk
            from app.llm.graph_rag import extract_entities_from_text
            asyncio.run(extract_entities_from_text(chunks[0], workspace_id_val, doc_id_val, db_bg))

            nim_client = NvidiaNIMClient()
            chunk_records = []
            for i, chunk_text in enumerate(chunks):
                chunk_id = str(uuid.uuid4())
                chunk_records.append({
                    "id": chunk_id,
                    "text": chunk_text,
                    "index": i
                })
                
            asyncio.run(qdrant_helper.async_ingest_document_chunks(
                workspace_id=workspace_id_val,
                document_id=doc_id_val,
                chunks=chunk_records,
                filename=doc.filename,
                nim_client=nim_client
            ))
            
            # Save chunk metadata
            for cr in chunk_records:
                db_chunk = DocumentChunk(
                    id=cr["id"],
                    document_id=doc_id_val,
                    workspace_id=workspace_id_val,
                    chunk_index=cr["index"],
                    content=cr["text"]
                )
                db_bg.add(db_chunk)
                
            doc.status = "ready"
            db_bg.commit()
        except Exception as e:
            print(f"Error processing GitHub doc: {e}")
            db_bg.rollback()
            doc = db_bg.query(Document).filter(Document.id == doc_id_val).first()
            if doc:
                doc.status = "error"
                db_bg.commit()
        finally:
            db_bg.close()

    background_tasks.add_task(process_github_doc_inline, doc_id, workspace_id, readme_content)
    
    return {"detail": "GitHub repository synced successfully.", "document_id": doc_id}
