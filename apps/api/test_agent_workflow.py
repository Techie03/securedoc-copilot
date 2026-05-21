import os
import sys
import asyncio
from dotenv import load_dotenv
from sqlalchemy.orm import Session

# Add current folder to sys.path to allow absolute imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environmental variables
load_dotenv()

from app.database import SessionLocal, engine, Base
from app.models.models import User, Workspace, WorkspaceMember, UserMemory, WorkspaceMemory, ChatSession, ChatMessage
from app.llm.agent import LangGraphAgent

async def run_tests():
    print("====================================================")
    print("SecureDoc Copilot - Agent Workflow & Evaluation Test")
    print("====================================================\n")
    
    # Setup test DB tables
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    
    try:
        # 1. Create a test user if it doesn't exist
        test_email = "agent-test@securedoc.com"
        user = db.query(User).filter(User.email == test_email).first()
        if not user:
            user = User(
                email=test_email,
                full_name="Agent Tester",
                hashed_password="notneededforagenttest"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created test user: {user.email} (ID: {user.id})")
        else:
            print(f"Using existing test user: {user.email}")
            
        # 2. Create a test workspace if it doesn't exist
        workspace = db.query(Workspace).filter(Workspace.owner_id == user.id).first()
        if not workspace:
            workspace = Workspace(
                name="Test Agent Workspace",
                owner_id=user.id
            )
            db.add(workspace)
            db.commit()
            db.refresh(workspace)
            
            # Add workspace member
            member = WorkspaceMember(
                workspace_id=workspace.id,
                user_id=user.id,
                role="owner"
            )
            db.add(member)
            db.commit()
            print(f"Created test workspace: {workspace.name} (ID: {workspace.id})")
        else:
            print(f"Using existing test workspace: {workspace.name}")
            
        # Clear previous memories for clean test run
        db.query(UserMemory).filter(UserMemory.user_id == user.id).delete()
        db.query(WorkspaceMemory).filter(WorkspaceMemory.workspace_id == workspace.id).delete()
        db.commit()
        
        # 3. Create pre-existing memories
        print("\nAdding pre-existing user and workspace memory...")
        pref_mem = UserMemory(
            user_id=user.id,
            memory_key="User Job Role",
            memory_value="Senior Software Architect",
            visibility="private"
        )
        ws_mem = WorkspaceMemory(
            workspace_id=workspace.id,
            memory_key="Project Context",
            memory_value="Building Next-Gen NVIDIA NIM agent with FastAPI"
        )
        db.add(pref_mem)
        db.add(ws_mem)
        db.commit()
        
        agent = LangGraphAgent()
        
        # Test 1: General Intent and Memory Loading
        print("\n--- Test 1: General/Greeting Intent & Memory Context Grounding ---")
        history = []
        query_1 = "Hello! What is my job role and what project are we working on here?"
        print(f"Query: {query_1}")
        
        res_1 = await agent.run(
            db=db,
            query=query_1,
            chat_history=history,
            workspace_id=workspace.id,
            user_id=user.id,
            mode="auto"
        )
        
        print(f"Routed to: {res_1['route']}")
        print(f"Agent Response: {res_1['response'].strip()}")
        print(f"Latency: {res_1['latency_ms']}ms")
        print(f"Memories Loaded: {len(res_1['memories_retrieved'])}")
        
        # Verification
        assert "senior software architect" in res_1['response'].lower(), "Agent did not ground on user memory."
        assert "fastapi" in res_1['response'].lower() or "nvidia" in res_1['response'].lower(), "Agent did not ground on workspace memory."
        print("[PASS] Test 1: Memory loading and grounding successful.")
        
        # Test 2: Coding Intent
        print("\n--- Test 2: Programming/Coding Assistance ---")
        query_2 = "Can you write a python decorator to calculate execution time of a function?"
        print(f"Query: {query_2}")
        
        # Append previous exchange to history
        history.append({"role": "user", "content": query_1})
        history.append({"role": "assistant", "content": res_1["response"]})
        
        res_2 = await agent.run(
            db=db,
            query=query_2,
            chat_history=history,
            workspace_id=workspace.id,
            user_id=user.id,
            mode="auto"
        )
        
        print(f"Routed to: {res_2['route']}")
        print(f"Agent Response (Truncated): {res_2['response'][:300].strip()}...")
        print(f"Latency: {res_2['latency_ms']}ms")
        
        assert res_2['route'] == 'coding', f"Expected coding route, got {res_2['route']}"
        print("[PASS] Test 2: Intent routed to coding and code answer generated.")
        
        # Test 3: Auto-Memory extraction
        print("\n--- Test 3: Auto-Memory preference extraction ---")
        query_3 = "Just so you know, my preferred language is TypeScript for frontend work."
        print(f"Query: {query_3}")
        
        history.append({"role": "user", "content": query_2})
        history.append({"role": "assistant", "content": res_2["response"]})
        
        res_3 = await agent.run(
            db=db,
            query=query_3,
            chat_history=history,
            workspace_id=workspace.id,
            user_id=user.id,
            mode="auto"
        )
        
        print(f"Routed to: {res_3['route']}")
        print(f"Agent Response: {res_3['response'].strip()}")
        print(f"Extracted memories: {res_3['new_memories_extracted']}")
        
        # Check DB to confirm if memory got saved
        saved_mems = db.query(WorkspaceMemory).filter(WorkspaceMemory.workspace_id == workspace.id).all()
        keys = [m.memory_key.lower() for m in saved_mems]
        values = [m.memory_value.lower() for m in saved_mems]
        print(f"Workspace memories currently in DB: {[m.memory_key + ' -> ' + m.memory_value for m in saved_mems]}")
        
        assert any("language" in k or "frontend" in k or "typescript" in v for k, v in zip(keys, values)), "Memory extraction did not persist TypeScript preference to database."
        print("[PASS] Test 3: Auto-Memory extraction and DB storage verified successfully.")

        # Test 4: Evaluation and Scoring
        print("\n--- Test 4: Evaluation and Telemetry Verification ---")
        # Ensure we have evaluation scores
        print(f"Evaluation Scores from Test 1 (General): {res_1['eval_scores']}")
        print(f"Evaluation Scores from Test 2 (Coding): {res_2['eval_scores']}")
        print(f"Evaluation Scores from Test 3 (Memory Ext): {res_3['eval_scores']}")
        
        assert "faithfulness" in res_1["eval_scores"], "Faithfulness score missing."
        assert "relevance" in res_1["eval_scores"], "Relevance score missing."
        print("[PASS] Test 4: Evaluation telemetry scores calculated.")
        
        print("\n====================================================")
        print("[SUCCESS] All agent workflow & evaluation tests PASSED!")
        print("====================================================")
        
    except Exception as e:
        print(f"\n[FAILURE] Test execution failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_tests())
