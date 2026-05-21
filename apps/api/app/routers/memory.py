from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.dependencies import get_current_user, get_current_workspace_member
from app.models.models import UserMemory, WorkspaceMemory, User
from app.schemas.schemas import MemoryCreate, MemoryResponse

router = APIRouter(prefix="/workspaces/{workspace_id}/memories", tags=["Memory"])

@router.get("", response_model=List[MemoryResponse])
def list_memories(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member = Depends(get_current_workspace_member)
):
    """
    List all user and workspace memories.
    """
    memories = []
    
    # 1. User private memories
    user_mems = db.query(UserMemory).filter(UserMemory.user_id == current_user.id).all()
    for mem in user_mems:
        memories.append(MemoryResponse(
            id=mem.id,
            user_id=mem.user_id,
            workspace_id=None,
            memory_key=mem.memory_key,
            memory_value=mem.memory_value,
            visibility=mem.visibility,
            type="user",
            created_at=mem.created_at
        ))
        
    # 2. Workspace memories
    ws_mems = db.query(WorkspaceMemory).filter(WorkspaceMemory.workspace_id == workspace_id).all()
    for mem in ws_mems:
        memories.append(MemoryResponse(
            id=mem.id,
            user_id=None,
            workspace_id=mem.workspace_id,
            memory_key=mem.memory_key,
            memory_value=mem.memory_value,
            visibility="workspace",
            type="workspace",
            created_at=mem.created_at
        ))
        
    return memories

@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
def create_memory(
    workspace_id: str,
    memory_in: MemoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member = Depends(get_current_workspace_member)
):
    """
    Manually add a memory key-value pair to the user profile or workspace context.
    """
    if memory_in.visibility == "workspace":
        db_mem = WorkspaceMemory(
            workspace_id=workspace_id,
            memory_key=memory_in.memory_key,
            memory_value=memory_in.memory_value
        )
        db.add(db_mem)
        db.commit()
        db.refresh(db_mem)
        return MemoryResponse(
            id=db_mem.id,
            user_id=None,
            workspace_id=db_mem.workspace_id,
            memory_key=db_mem.memory_key,
            memory_value=db_mem.memory_value,
            visibility="workspace",
            type="workspace",
            created_at=db_mem.created_at
        )
    else:
        db_mem = UserMemory(
            user_id=current_user.id,
            memory_key=memory_in.memory_key,
            memory_value=memory_in.memory_value,
            visibility=memory_in.visibility or "private"
        )
        db.add(db_mem)
        db.commit()
        db.refresh(db_mem)
        return MemoryResponse(
            id=db_mem.id,
            user_id=db_mem.user_id,
            workspace_id=None,
            memory_key=db_mem.memory_key,
            memory_value=db_mem.memory_value,
            visibility=db_mem.visibility,
            type="user",
            created_at=db_mem.created_at
        )

@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memory(
    workspace_id: str,
    memory_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member = Depends(get_current_workspace_member)
):
    """
    Delete a specific user or workspace memory.
    """
    user_mem = db.query(UserMemory).filter(
        UserMemory.id == memory_id,
        UserMemory.user_id == current_user.id
    ).first()
    
    if user_mem:
        db.delete(user_mem)
        db.commit()
        return None
        
    ws_mem = db.query(WorkspaceMemory).filter(
        WorkspaceMemory.id == memory_id,
        WorkspaceMemory.workspace_id == workspace_id
    ).first()
    
    if ws_mem:
        db.delete(ws_mem)
        db.commit()
        return None
        
    raise HTTPException(status_code=404, detail="Memory not found or access denied")
