from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.models import User, Workspace, WorkspaceMember, Document, DocumentChunk
from app.schemas.schemas import UserCreate, WorkspaceCreate
from app.utils.security import hash_password

# ==========================================
# User CRUD
# ==========================================

def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower()).first()

def create_user(db: Session, user_in: UserCreate) -> User:
    hashed_pwd = hash_password(user_in.password)
    db_user = User(
        email=user_in.email.lower(),
        full_name=user_in.full_name,
        hashed_password=hashed_pwd
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Automatically create a default personal workspace for the user
    try:
        personal_ws_in = WorkspaceCreate(name=f"{db_user.full_name or 'Personal'}'s Workspace")
        create_workspace(db=db, workspace_in=personal_ws_in, owner_id=db_user.id)
    except Exception as e:
        # Don't fail signup if workspace creation fails, but log it
        print(f"Warning: Failed to create default workspace for user {db_user.email}: {e}")
        
    return db_user


# ==========================================
# Workspace CRUD
# ==========================================

def get_workspace(db: Session, workspace_id: str) -> Optional[Workspace]:
    return db.query(Workspace).filter(Workspace.id == workspace_id).first()

def get_workspaces_for_user(db: Session, user_id: str) -> List[Workspace]:
    """
    Get all workspaces that the user belongs to (either as owner or as member).
    """
    return db.query(Workspace).join(WorkspaceMember).filter(WorkspaceMember.user_id == user_id).all()

def create_workspace(db: Session, workspace_in: WorkspaceCreate, owner_id: str) -> Workspace:
    # 1. Create Workspace
    db_workspace = Workspace(
        name=workspace_in.name,
        owner_id=owner_id
    )
    db.add(db_workspace)
    db.commit()
    db.refresh(db_workspace)

    # 2. Add Owner to WorkspaceMember with role="owner"
    db_member = WorkspaceMember(
        workspace_id=db_workspace.id,
        user_id=owner_id,
        role="owner"
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_workspace)  # Refresh workspace to load members relationship
    
    return db_workspace

def get_workspace_member(db: Session, workspace_id: str, user_id: str) -> Optional[WorkspaceMember]:
    return db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id
    ).first()

def add_workspace_member(db: Session, workspace_id: str, user_id: str, role: str = "member") -> WorkspaceMember:
    db_member = WorkspaceMember(
        workspace_id=workspace_id,
        user_id=user_id,
        role=role
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

def remove_workspace_member(db: Session, workspace_id: str, user_id: str) -> bool:
    db_member = get_workspace_member(db, workspace_id, user_id)
    if not db_member:
        return False
    db.delete(db_member)
    db.commit()
    return True


# ==========================================
# Document & Chunk CRUD
# ==========================================

def get_document(db: Session, document_id: str) -> Optional[Document]:
    return db.query(Document).filter(Document.id == document_id).first()

def get_documents_by_workspace(db: Session, workspace_id: str) -> List[Document]:
    return db.query(Document).filter(Document.workspace_id == workspace_id).order_by(Document.created_at.desc()).all()

def create_document(
    db: Session, 
    workspace_id: str, 
    uploaded_by: Optional[str], 
    filename: str, 
    file_type: str, 
    storage_url: str
) -> Document:
    db_doc = Document(
        workspace_id=workspace_id,
        uploaded_by=uploaded_by,
        filename=filename,
        file_type=file_type,
        storage_url=storage_url,
        status="processing"
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return db_doc

def update_document_status(db: Session, document_id: str, status: str) -> Optional[Document]:
    db_doc = get_document(db, document_id)
    if not db_doc:
        return None
    db_doc.status = status
    db.commit()
    db.refresh(db_doc)
    return db_doc

def delete_document(db: Session, document_id: str) -> bool:
    db_doc = get_document(db, document_id)
    if not db_doc:
        return False
    db.delete(db_doc)
    db.commit()
    return True

def create_document_chunk(
    db: Session,
    document_id: str,
    workspace_id: str,
    chunk_index: int,
    content: str,
    page_number: Optional[int] = None,
    token_count: Optional[int] = None,
    qdrant_point_id: Optional[str] = None,
    metadata_json: Optional[dict] = None
) -> DocumentChunk:
    db_chunk = DocumentChunk(
        document_id=document_id,
        workspace_id=workspace_id,
        chunk_index=chunk_index,
        content=content,
        page_number=page_number,
        token_count=token_count,
        qdrant_point_id=qdrant_point_id,
        metadata_json=metadata_json
    )
    db.add(db_chunk)
    db.commit()
    db.refresh(db_chunk)
    return db_chunk

