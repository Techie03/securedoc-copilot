import os
import asyncio
import sys
from dotenv import load_dotenv

# Add current folder to sys.path to allow absolute imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environmental variables from root .env or local .env
load_dotenv()

from app.llm.nvidia_client import NvidiaNIMClient

async def main():
    print("====================================================")
    print("SecureDoc Copilot - NVIDIA NIM API Integration Test")
    print("====================================================\n")
    
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key or api_key == "your_nvidia_api_key_here":
        print("[ERROR] NVIDIA_API_KEY is not set or is still a placeholder.")
        print("Please configure your actual NVIDIA NIM key in the root .env file first.")
        sys.exit(1)
        
    print(f"Configured Models:")
    print(f"- LLM:        {os.getenv('NVIDIA_LLM_MODEL', 'nvidia/llama-3.1-nemotron-70b-instruct')}")
    print(f"- Embeddings: {os.getenv('NVIDIA_EMBEDDING_MODEL', 'nvidia/nv-embedqa-e5-v5')}")
    print(f"- Reranker:   {os.getenv('NVIDIA_RERANK_MODEL', 'nvidia/nv-rerankqa-mistral-4b-v3')}\n")

    try:
        client = NvidiaNIMClient()

        # 1. Test Chat Completion
        print("1. Testing Chat Completion...")
        chat_prompt = [{"role": "user", "content": "Give me a 1-sentence definition of agentic RAG."}]
        chat_response = await client.chat(messages=chat_prompt, temperature=0.1)
        print(f"   Response: {chat_response.strip()}\n")

        # 2. Test Text Embeddings
        print("2. Testing Dense Vector Embeddings...")
        texts = ["SecureDoc Copilot uses NVIDIA NIM", "LangGraph agents coordinate workflows"]
        embeddings = await client.embed_texts(texts)
        print(f"   Success: Generated {len(embeddings)} embeddings.")
        print(f"   Dimension of Vector: {len(embeddings[0]) if embeddings else 0}\n")

        # 3. Test Reranker (triggers API first, falls back to LLM automatically if not available)
        print("3. Testing Document Reranker...")
        query = "agentic RAG platform"
        docs = [
            "We are building a futuristic Next-Generation NVIDIA NIM-Powered Agentic RAG Platform called SecureDoc Copilot.",
            "PostgreSQL stores users, workspaces, and chat histories.",
            "The weather in San Francisco is nice today."
        ]
        reranked_docs = await client.rerank(query=query, documents=docs, top_n=2)
        print("   Reranking Results (Ranked by Relevance):")
        for i, item in enumerate(reranked_docs):
            doc_idx = item['index']
            print(f"     Rank {i+1}: Doc Index {doc_idx} (Score: {item['relevance_score']:.4f})")
            print(f"            Text: \"{docs[doc_idx][:90]}...\"")
        
        print("\n[SUCCESS] All NVIDIA NIM model tests PASSED successfully.")

    except Exception as e:
        print(f"\n[FAILURE] NIM Client Integration failed with error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
