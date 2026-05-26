import httpx
from typing import List, Dict, Any
from app.config import settings

class NvidiaNIMClient:
    def __init__(self):
        # Determine if we should run in mock mode
        self.mock = False
        api_key = settings.NVIDIA_API_KEY
        if not api_key or api_key == "your_nvidia_api_key_here" or not api_key.startswith("nvapi-"):
            print("Warning: NVIDIA_API_KEY is not configured or invalid. Operating in MOCK fallback mode.")
            self.mock = True
            self.headers = {}
        else:
            self.headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        temperature: float = 0.2,
        max_tokens: int = 1200,
        model: str = None
    ) -> str:
        """
        Calls NVIDIA NIM chat completions endpoint.
        """
        if self.mock:
            # High-fidelity mock responses for RAG chat
            last_message_content = messages[-1]["content"] if messages else ""
            if isinstance(last_message_content, list):
                last_message = next((part["text"] for part in last_message_content if part["type"] == "text"), "")
                has_image = any(part.get("type") == "image_url" for part in last_message_content)
            else:
                last_message = last_message_content
                has_image = False
                
            if "agentic RAG" in last_message.lower():
                return "Agentic RAG is a futuristic next-generation RAG architecture where autonomous AI agents use tools and reasoning loops (such as LangGraph) to retrieve, evaluate, and act upon knowledge."
            elif "verify connection" in last_message.lower():
                return "NVIDIA NIM is online."
                
            if has_image:
                return f"[MOCK NVIDIA NIM meta/llama-3.2-90b-vision-instruct] Analyzed image with query: '{last_message}'"
            return f"[MOCK NVIDIA NIM meta/llama-3.3-70b-instruct] Response to: '{last_message}'"

        url = f"{settings.NVIDIA_BASE_URL}/chat/completions"
        selected_model = model or settings.NVIDIA_LLM_MODEL
        
        # Switch to vision model if image content is present
        if messages and isinstance(messages[-1]["content"], list):
            if any(part.get("type") == "image_url" for part in messages[-1]["content"]):
                if not model:
                    selected_model = "meta/llama-3.2-90b-vision-instruct"

        payload = {
            "model": selected_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(
                url,
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()

        return data["choices"][0]["message"]["content"]

    async def embed_texts(
        self,
        texts: List[str],
        model: str = None,
        input_type: str = "passage"
    ) -> List[List[float]]:
        """
        Generates dense vector embeddings using NVIDIA NIM embeddings endpoint.
        """
        if self.mock:
            # Generate deterministic/pseudorandom mock vectors of size 1024
            import random
            mock_embeddings = []
            for text in texts:
                # Seed random with text length and first chars to make it semi-deterministic
                seed = len(text) + sum(ord(c) for c in text[:10])
                rng = random.Random(seed)
                # Generate a 1024-dimensional normalized vector
                vec = [rng.uniform(-0.1, 0.1) for _ in range(1024)]
                # Simple normalization
                norm = sum(x**2 for x in vec)**0.5
                normalized_vec = [x / norm for x in vec]
                mock_embeddings.append(normalized_vec)
            return mock_embeddings

        url = f"{settings.NVIDIA_BASE_URL}/embeddings"
        selected_model = model or settings.NVIDIA_EMBEDDING_MODEL

        payload = {
            "model": selected_model,
            "input": texts
        }

        # Symmetric/asymmetric embedqa models require 'input_type'
        if "embedqa" in selected_model or "nemo-embed" in selected_model:
            payload["input_type"] = input_type

        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(
                url,
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()

        return [
            item["embedding"]
            for item in data["data"]
        ]

    async def rerank(
        self,
        query: str,
        documents: List[str],
        top_n: int = 5,
        model: str = None
    ) -> List[Dict[str, Any]]:
        """
        Reranks retrieved documents based on relevance score.
        If the NIM reranking API fails, falls back to LLM-based prompting.
        """
        if self.mock:
            # Simple mock reranker: return documents sorted by length as relevance heuristic
            results = []
            for idx, doc in enumerate(documents):
                score = min(0.99, max(0.01, len(doc) / 2000.0))
                results.append({"index": idx, "relevance_score": score})
            results.sort(key=lambda x: x["relevance_score"], reverse=True)
            return results[:top_n]

        url = f"{settings.NVIDIA_BASE_URL}/reranking"
        selected_model = model or settings.NVIDIA_RERANK_MODEL

        payload = {
            "model": selected_model,
            "query": {"text": query},
            "documents": [{"text": doc} for doc in documents],
            "top_n": top_n
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    url,
                    headers=self.headers,
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
                # Format response results uniformly
                results = data.get("results", [])
                # Normalize output: [{"index": idx, "relevance_score": score}, ...]
                return [
                    {
                        "index": item.get("index"),
                        "relevance_score": item.get("relevance_score", 0.0)
                    }
                    for item in results
                ]
        except Exception:
            # Fallback to LLM reranking if reranker endpoint fails or is unavailable
            return await self._llm_rerank(query, documents, top_n)

    async def _llm_rerank(
        self,
        query: str,
        documents: List[str],
        top_n: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Helper fallback: Ask the LLM to score the relevance of retrieved documents.
        """
        results = []
        for index, doc in enumerate(documents):
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are an expert information retrieval assistant. "
                        "Evaluate the relevance of the following document to the search query. "
                        "Respond with a single float value between 0.0 (completely irrelevant) and 1.0 (extremely relevant). "
                        "Do not include any explanation or extra text. Output only the numerical value."
                    )
                },
                {
                    "role": "user",
                    "content": f"Query: {query}\n\nDocument: {doc[:1500]}\n\nRelevance Score:"
                }
            ]
            try:
                score_str = await self.chat(messages, temperature=0.0, max_tokens=10)
                # Parse score
                score = float(score_str.strip())
            except Exception:
                score = 0.0
            results.append({"index": index, "relevance_score": score})

        # Sort by relevance score in descending order
        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        return results[:top_n]
