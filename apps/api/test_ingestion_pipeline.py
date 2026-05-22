import os
import sys
import asyncio
from dotenv import load_dotenv

# Add current folder to sys.path to allow absolute imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environmental variables
load_dotenv()

from app.database import SessionLocal, engine, Base
from app.crud import crud
from app.schemas.schemas import UserCreate, WorkspaceCreate
from app.utils.qdrant import qdrant_helper
from app.routers.documents import process_document_background

async def run_pipeline_test():
    print("====================================================")
    print("SecureDoc Copilot - Document Ingestion Pipeline Test")
    print("====================================================\n")

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    
    test_user = None
    test_ws = None
    test_doc = None
    
    try:
        # 1. Create a Test User & Workspace
        email = "pipeline.test@securedoc.local"
        db_user = crud.get_user_by_email(db, email)
        if not db_user:
            user_in = UserCreate(email=email, full_name="Pipeline Tester", password="testpassword123")
            test_user = crud.create_user(db, user_in)
            print(f"Created test user: {test_user.email}")
        else:
            test_user = db_user
            print(f"Using existing test user: {test_user.email}")

        # Fetch or create a specific workspace for testing
        workspaces = crud.get_workspaces_for_user(db, test_user.id)
        if not workspaces:
            ws_in = WorkspaceCreate(name="Pipeline Test Space")
            test_ws = crud.create_workspace(db, ws_in, test_user.id)
            print(f"Created test workspace: {test_ws.name}")
        else:
            test_ws = workspaces[0]
            print(f"Using test workspace: {test_ws.name}")

        # Clean up any leftover Qdrant vectors for this test workspace
        print(f"   Ensuring Qdrant collection exists...")
        qdrant_helper.ensure_collection()
        print(f"   Cleaning up previous vectors for workspace: {test_ws.id}")
        qdrant_helper.delete_by_workspace(str(test_ws.id))

        # 2. Prepare mock text document
        filename = "nvidia_nim_agentic_rag.txt"
        file_content = (
            "SecureDoc Copilot is a secure, multi-user, NVIDIA NIM-powered agentic RAG platform. "
            "It is designed to search, reason, remember, evaluate, and act across private enterprise documents. "
            "All model inferences use high-performance NVIDIA NIM APIs only. "
            "Strict workspace isolation is maintained in the vector store using metadata payload filter controls. "
            "This ensures that user requests in one workspace can never access documents from another workspace."
        )
        file_bytes = file_content.encode("utf-8")

        print(f"\n1. Initializing document upload: '{filename}'")
        storage_url = f"local://{test_ws.id}/{filename}"
        test_doc = crud.create_document(
            db=db,
            workspace_id=test_ws.id,
            uploaded_by=test_user.id,
            filename=filename,
            file_type="TXT",
            storage_url=storage_url
        )
        print(f"   Created DB Document record: {test_doc.id} (status: {test_doc.status})")

        # 3. Process & index document synchronously
        print("\n2. Executing parsing, chunking, embedding generation & Qdrant indexing...")
        await process_document_background(
            document_id=test_doc.id,
            file_bytes=file_bytes,
            filename=filename,
            workspace_id=test_ws.id
        )

        # Refresh doc record
        db.refresh(test_doc)
        print(f"   Status after processing: {test_doc.status}")
        assert test_doc.status == "ready", f"Expected document status to be 'ready', got '{test_doc.status}'"

        # Check DB Chunks
        db_chunks = db.query(crud.DocumentChunk).filter(crud.DocumentChunk.document_id == test_doc.id).all()
        print(f"   Created {len(db_chunks)} chunks in PostgreSQL database.")
        assert len(db_chunks) > 0, "Expected at least 1 document chunk in PostgreSQL."

        # 4. Search and Validate Workspace Isolation
        print("\n3. Testing Qdrant search & Workspace Isolation...")
        
        # We need a query vector. Let's make a mock one or run a real embeddings query.
        from app.llm.nvidia_client import NvidiaNIMClient
        client = NvidiaNIMClient()
        query_vector = (await client.embed_texts(["NVIDIA NIM agentic RAG"], input_type="query"))[0]

        # A. Query with CORRECT workspace ID
        correct_hits = qdrant_helper.search_workspace_chunks(
            workspace_id=test_ws.id,
            query_vector=query_vector,
            limit=5
        )
        print(f"   Query with correct Workspace ID '{test_ws.id}': found {len(correct_hits)} matches.")
        for idx, hit in enumerate(correct_hits):
            print(f"     Match {idx+1}: Score: {hit['score']:.4f} - Content: \"{hit['content'][:80]}...\"")
        assert len(correct_hits) > 0, "Expected search to return results for the correct workspace."

        # B. Query with INCORRECT/FAKE workspace ID
        fake_ws_id = "00000000-0000-0000-0000-000000000000"
        isolated_hits = qdrant_helper.search_workspace_chunks(
            workspace_id=fake_ws_id,
            query_vector=query_vector,
            limit=5
        )
        print(f"   Query with fake/isolated Workspace ID '{fake_ws_id}': found {len(isolated_hits)} matches.")
        assert len(isolated_hits) == 0, f"SECURITY FAILURE: Workspace isolation leaked! Found {len(isolated_hits)} documents."
        print("   [SUCCESS] Workspace isolation verified: zero results leaked to isolated context.")

        # 5. Clean up Document
        print("\n4. Deleting document (validating cascading cleanups)...")
        qdrant_helper.delete_by_document(test_doc.id)
        crud.delete_document(db, test_doc.id)
        print("   Deleted Document and cascading chunks from PostgreSQL.")

        # Verify Qdrant points are deleted
        deleted_hits = qdrant_helper.search_workspace_chunks(
            workspace_id=test_ws.id,
            query_vector=query_vector,
            limit=5
        )
        print(f"   Query after deletion: found {len(deleted_hits)} matches.")
        assert len(deleted_hits) == 0, "Expected Qdrant vector points to be cleared after deletion."
        print("   [SUCCESS] Casacaded vector deletion verified.")

        print("\n[PIPELINE SUCCESS] All document ingestion & workspace isolation tests PASSED.")

    except Exception as e:
        print(f"\n[PIPELINE FAILURE] Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_pipeline_test())
