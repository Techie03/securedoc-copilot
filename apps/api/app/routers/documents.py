from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db, SessionLocal
from app.crud import crud
from app.schemas.schemas import DocumentResponse
from app.dependencies import get_current_user, get_current_workspace_member
from app.models.models import User
from app.utils.parser import parse_document
from app.utils.qdrant import qdrant_helper
from app.llm.nvidia_client import NvidiaNIMClient
from app.llm.graph_rag import extract_entities_from_text

router = APIRouter(prefix="/workspaces/{workspace_id}/documents", tags=["Documents"])

async def process_document_background(
    document_id: str,
    file_bytes: bytes,
    filename: str,
    workspace_id: str
):
    db: Session = SessionLocal()
    try:
        # 1. Parse text from bytes
        chunks_data = parse_document(file_bytes, filename)
        if not chunks_data:
            raise ValueError("No text content could be extracted from document.")
        
        # 2. Get embeddings from NVIDIA NIM
        client = NvidiaNIMClient()
        chunk_contents = [c["content"] for c in chunks_data]
        
        # Call NVIDIA embeddings in batches of 16 to avoid exceeding limits/timeouts
        embeddings = []
        batch_size = 16
        for i in range(0, len(chunk_contents), batch_size):
            batch = chunk_contents[i:i+batch_size]
            batch_emb = await client.embed_texts(batch, input_type="passage")
            embeddings.extend(batch_emb)

        # 3. Create document chunks in Database and collect for Qdrant
        db_chunks = []
        for idx, chunk_info in enumerate(chunks_data):
            db_chunk = crud.create_document_chunk(
                db=db,
                document_id=document_id,
                workspace_id=workspace_id,
                chunk_index=idx,
                content=chunk_info["content"],
                page_number=chunk_info["page_number"],
                token_count=chunk_info["token_count"],
                qdrant_point_id=None,
                metadata_json={}
            )
            # update chunk's point id to its database record id
            db_chunk.qdrant_point_id = db_chunk.id
            db.commit()
            db_chunks.append(db_chunk)

        # 5. Push to Qdrant Vector DB
        qdrant_helper.ensure_collection(vector_size=1024)
        qdrant_helper.upsert_chunks(
            chunks=db_chunks,
            embeddings=embeddings,
            filenames=[filename] * len(db_chunks)
        )

        # 5.5 GraphRAG: Extract knowledge graph triples from document content
        try:
            full_text = " ".join(chunk_contents[:5])  # First 5 chunks for extraction
            await extract_entities_from_text(
                text=full_text[:4000],
                document_id=document_id,
                workspace_id=workspace_id,
                db=db,
                max_triples=12
            )
        except Exception as graph_err:
            print(f"GraphRAG extraction warning for {filename}: {graph_err}")

        # 6. Complete parsing
        crud.update_document_status(db, document_id, "ready")
        print(f"Successfully processed and indexed document {filename} ({document_id})")

    except Exception as e:
        print(f"Error processing document {filename} ({document_id}): {e}")
        crud.update_document_status(db, document_id, "error")
    finally:
        db.close()


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document_endpoint(
    workspace_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a document, parse it, generate chunk embeddings, and index into Qdrant.
    """
    # 1. Verify workspace membership
    get_current_workspace_member(workspace_id=workspace_id, db=db, current_user=current_user)
    
    # 2. Extract file details
    filename = file.filename
    file_type = filename.split(".")[-1].upper() if "." in filename else "TXT"
    
    # Read file content in-memory
    file_bytes = await file.read()
    
    # 3. Create document record in PostgreSQL with status 'processing'
    # Use a dummy local URL since we bypass cloud storage in local dev environment
    storage_url = f"local://{workspace_id}/{filename}"
    
    db_doc = crud.create_document(
        db=db,
        workspace_id=workspace_id,
        uploaded_by=current_user.id,
        filename=filename,
        file_type=file_type,
        storage_url=storage_url
    )
    
    # 4. Dispatch async processing pipeline
    background_tasks.add_task(
        process_document_background,
        document_id=db_doc.id,
        file_bytes=file_bytes,
        filename=filename,
        workspace_id=workspace_id
    )
    
    return db_doc


@router.get("", response_model=List[DocumentResponse])
def list_documents_endpoint(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all uploaded documents in a specific workspace.
    """
    # 1. Verify workspace membership
    get_current_workspace_member(workspace_id=workspace_id, db=db, current_user=current_user)
    
    # 2. Fetch documents
    return crud.get_documents_by_workspace(db, workspace_id=workspace_id)


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document_endpoint(
    workspace_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a document record, its chunks from DB, and its vector points from Qdrant.
    """
    # 1. Verify workspace membership
    get_current_workspace_member(workspace_id=workspace_id, db=db, current_user=current_user)
    
    # 2. Retrieve document
    doc = crud.get_document(db, document_id)
    if not doc or doc.workspace_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found in this workspace"
        )
    
    # 3. Remove from Qdrant Vector DB
    try:
        qdrant_helper.delete_by_document(document_id)
    except Exception as e:
        print(f"Warning: Failed to delete vector points for document {document_id} from Qdrant: {e}")
        
    # 4. Remove from relational DB (cascades chunk deletion)
    crud.delete_document(db, document_id)
    
    return {"detail": "Document successfully deleted"}
