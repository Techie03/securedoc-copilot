import asyncio
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.llm.agent import LangGraphAgent
from app.models.models import Base

async def verify():
    # Setup in-memory sqlite DB for testing
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    
    agent = LangGraphAgent()

    print("\n--- Testing Web Search ---")
    state_web = await agent.run(
        db=db,
        query="Search the web for the latest NVIDIA stock price.",
        chat_history=[],
        workspace_id="test_ws",
        user_id="test_user",
        mode="auto"
    )
    print("Route:", state_web["route"])
    print("Context sources:", [c["filename"] for c in state_web["context"]])
    print("Response snippet:", state_web["response"][:200])

    print("\n--- Testing Image Generation ---")
    state_img = await agent.run(
        db=db,
        query="Generate an image of a futuristic cybersecurity dashboard.",
        chat_history=[],
        workspace_id="test_ws",
        user_id="test_user",
        mode="auto"
    )
    print("Route:", state_img["route"])
    print("Images count:", len(state_img.get("images", [])))
    if state_img.get("images"):
        print("Image base64 snippet:", state_img["images"][0][:50] + "...")
    print("Response snippet:", state_img["response"][:200])
    
    db.close()

if __name__ == "__main__":
    asyncio.run(verify())
