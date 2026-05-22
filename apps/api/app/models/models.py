import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Float, JSON, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

# ==========================================
# Users & Workspaces
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    workspace_memberships = relationship("WorkspaceMember", back_populates="user", cascade="all, delete-orphan")
    memories = relationship("UserMemory", back_populates="user", cascade="all, delete-orphan")
    feedbacks = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="workspace", cascade="all, delete-orphan")
    memories = relationship("WorkspaceMemory", back_populates="workspace", cascade="all, delete-orphan")
    connectors = relationship("Connector", back_populates="workspace", cascade="all, delete-orphan")
    knowledge_triples = relationship("KnowledgeGraphTriple", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    role = Column(String(50), nullable=False, default="member") # owner, admin, member, viewer
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="workspace_memberships")


# ==========================================
# Document Ingestion
# ==========================================

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    uploaded_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False) # PDF, DOCX, TXT, MD, CSV, XLSX
    storage_url = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="processing") # processing, ready, error
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    workspace = relationship("Workspace", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    knowledge_triples = relationship("KnowledgeGraphTriple", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    token_count = Column(Integer, nullable=True)
    qdrant_point_id = Column(String(255), nullable=True) # Point ID in vector database
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    document = relationship("Document", back_populates="chunks")


# ==========================================
# Chat & Memory
# ==========================================

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False, default="New Chat")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    workspace = relationship("Workspace", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(50), nullable=False) # system, user, assistant
    content = Column(Text, nullable=False)
    mode = Column(String(50), nullable=True) # rag, general, coding, summary, compare, table, memory
    sources_json = Column(JSON, nullable=True) # Citations and sources
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session = relationship("ChatSession", back_populates="messages")
    chat_run = relationship("ChatRun", uselist=False, back_populates="message", cascade="all, delete-orphan")
    feedbacks = relationship("Feedback", back_populates="message", cascade="all, delete-orphan")

    @property
    def evaluation_scores(self):
        if self.chat_run:
            return self.chat_run.evaluation_scores
        return None


class UserMemory(Base):
    __tablename__ = "user_memories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    memory_key = Column(String(255), nullable=False)
    memory_value = Column(Text, nullable=False)
    visibility = Column(String(50), nullable=False, default="private") # private, workspace
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="memories")


class WorkspaceMemory(Base):
    __tablename__ = "workspace_memories"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    memory_key = Column(String(255), nullable=False)
    memory_value = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    workspace = relationship("Workspace", back_populates="memories")


# ==========================================
# Evaluation & Logs
# ==========================================

class ChatRun(Base):
    __tablename__ = "chat_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("chat_messages.id"), nullable=False)
    route = Column(String(100), nullable=True) # Agent route selected
    model = Column(String(255), nullable=True)
    latency_ms = Column(Integer, nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    estimated_cost = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    message = relationship("ChatMessage", back_populates="chat_run")
    retrieval_logs = relationship("RetrievalLog", back_populates="chat_run", cascade="all, delete-orphan")
    evaluation_scores = relationship("EvaluationScore", uselist=False, back_populates="chat_run", cascade="all, delete-orphan")


class RetrievalLog(Base):
    __tablename__ = "retrieval_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    chat_run_id = Column(String(36), ForeignKey("chat_runs.id"), nullable=False)
    query = Column(Text, nullable=False)
    retrieved_chunk_ids = Column(JSON, nullable=True) # List of chunk IDs retrieved initially
    reranked_chunk_ids = Column(JSON, nullable=True)  # List of chunk IDs after rerank
    retrieval_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    chat_run = relationship("ChatRun", back_populates="retrieval_logs")


class EvaluationScore(Base):
    __tablename__ = "evaluation_scores"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    chat_run_id = Column(String(36), ForeignKey("chat_runs.id"), nullable=False)
    faithfulness = Column(Float, nullable=True)
    relevance = Column(Float, nullable=True)
    citation_accuracy = Column(Float, nullable=True)
    hallucination_risk = Column(Float, nullable=True)
    route_accuracy = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    chat_run = relationship("ChatRun", back_populates="evaluation_scores")


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("chat_messages.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False) # 1 to 5 (or binary thumb up/down)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    message = relationship("ChatMessage", back_populates="feedbacks")
    user = relationship("User", back_populates="feedbacks")


# ==========================================
# Connectors & Sync Jobs
# ==========================================

class Connector(Base):
    __tablename__ = "connectors"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    provider = Column(String(100), nullable=False) # GitHub, Google Drive, Notion, etc.
    status = Column(String(50), nullable=False, default="connected") # connected, disconnected, error
    config_json = Column(JSON, nullable=True) # Configurations, OAuth keys (encrypted later)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    workspace = relationship("Workspace", back_populates="connectors")
    sync_jobs = relationship("SyncJob", back_populates="connector", cascade="all, delete-orphan")


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    connector_id = Column(String(36), ForeignKey("connectors.id"), nullable=False)
    status = Column(String(50), nullable=False, default="running") # running, completed, failed
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    logs = Column(Text, nullable=True)

    # Relationships
    connector = relationship("Connector", back_populates="sync_jobs")


# ==========================================
# GraphRAG Knowledge Graph
# ==========================================

class KnowledgeGraphTriple(Base):
    __tablename__ = "knowledge_graph_triples"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True)
    subject = Column(String(500), nullable=False, index=True)
    predicate = Column(String(255), nullable=False)
    object_entity = Column(String(500), nullable=False, index=True)
    confidence = Column(Float, nullable=True, default=1.0)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    workspace = relationship("Workspace", back_populates="knowledge_triples")
    document = relationship("Document", back_populates="knowledge_triples")
