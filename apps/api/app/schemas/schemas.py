from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, List, Any

# ==========================================
# User Schemas
# ==========================================

class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class GitHubOAuthLogin(BaseModel):
    code: str

class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Token Schemas
# ==========================================

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None


# ==========================================
# Workspace Schemas
# ==========================================

class WorkspaceBase(BaseModel):
    name: str

class WorkspaceCreate(WorkspaceBase):
    pass

class WorkspaceResponse(WorkspaceBase):
    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Workspace Member Schemas
# ==========================================

class WorkspaceMemberAdd(BaseModel):
    email: str
    role: str = "member"  # admin, member, viewer

class WorkspaceMemberResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    role: str
    created_at: datetime
    user: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Workspace Detail Response (Workspace + Members)
# ==========================================

class WorkspaceDetailResponse(WorkspaceResponse):
    members: List[WorkspaceMemberResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Document & Chunk Schemas
# ==========================================

class DocumentChunkResponse(BaseModel):
    id: str
    document_id: str
    workspace_id: str
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    token_count: Optional[int] = None
    qdrant_point_id: Optional[str] = None
    metadata_json: Optional[dict] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentResponse(BaseModel):
    id: str
    workspace_id: str
    uploaded_by: Optional[str] = None
    filename: str
    file_type: str
    storage_url: str
    status: str
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Chat & Message Schemas
# ==========================================

class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Chat"

class ChatSessionResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    title: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChatMessageCreate(BaseModel):
    content: str
    mode: Optional[str] = "auto" # auto, rag, general, coding, summary, compare, table, memory, report

class ChatRunResponse(BaseModel):
    id: str
    route: Optional[str] = None
    model: Optional[str] = None
    latency_ms: Optional[int] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    estimated_cost: Optional[float] = None
    confidence: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class EvaluationScoreResponse(BaseModel):
    id: str
    faithfulness: Optional[float] = None
    relevance: Optional[float] = None
    citation_accuracy: Optional[float] = None
    hallucination_risk: Optional[float] = None
    route_accuracy: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    mode: Optional[str] = None
    sources_json: Optional[Any] = None # List or dict of retrieved citations
    created_at: datetime
    chat_run: Optional[ChatRunResponse] = None
    evaluation_scores: Optional[EvaluationScoreResponse] = None

    model_config = ConfigDict(from_attributes=True)

# ==========================================
# Memory Schemas
# ==========================================

class MemoryCreate(BaseModel):
    memory_key: str
    memory_value: str
    visibility: Optional[str] = "workspace" # private, workspace

class MemoryResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    workspace_id: Optional[str] = None
    memory_key: str
    memory_value: str
    visibility: str
    type: str # 'user' or 'workspace'
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GitHubSyncRequest(BaseModel):
    repo_url: str


