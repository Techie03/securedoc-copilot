from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.config import settings
from app.database import engine, Base, get_db
from app.llm.nvidia_client import NvidiaNIMClient
import app.models  # Triggers registration of all models on Base
from app.routers import auth, workspaces, documents, chat, memory, evaluations, connectors

# Auto-create tables for local development/testing in Phase 1
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Warning: Could not create tables automatically (check DATABASE_URL or Postgres status): {e}")

app = FastAPI(
    title="SecureDoc Copilot API",
    description="SecureDoc Copilot — A Futuristic Next-Generation Agentic RAG Platform Backend",
    version="1.0.0"
)

import os

# CORS configurations
ALLOWED_ORIGINS = settings.ALLOWED_ORIGINS.split(",")

if "*" in ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include Routers
app.include_router(auth.router, prefix="/api")
app.include_router(workspaces.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(memory.router, prefix="/api")
app.include_router(evaluations.router, prefix="/api")
app.include_router(connectors.router, prefix="/api")


@app.get("/health", tags=["System"])
def health_check():
    """
    Standard health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "securedoc-copilot-api",
        "exclusive_ai_provider": "NVIDIA NIM"
    }

@app.get("/test-nim", tags=["Diagnostics"])
async def test_nim_connection():
    """
    Diagnostic route to verify communication with NVIDIA NIM endpoints.
    """
    if not settings.NVIDIA_API_KEY or settings.NVIDIA_API_KEY == "your_nvidia_api_key_here":
        raise HTTPException(
            status_code=400, 
            detail="NVIDIA_API_KEY environment variable is missing or placeholder value. Set it in .env"
        )
    
    try:
        client = NvidiaNIMClient()
        
        # Test Chat Completion
        chat_test = await client.chat(
            messages=[{"role": "user", "content": "Verify connection. Reply with the exact text: 'NVIDIA NIM is online.'"}]
        )
        
        # Test Embeddings
        embedding_test = await client.embed_texts(["NVIDIA NIM Integration Testing"])
        
        return {
            "status": "connected",
            "chat_response": chat_test.strip(),
            "embedding_dimensions": len(embedding_test[0]) if embedding_test else 0
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to communicate with NVIDIA NIM: {str(e)}"
        )
