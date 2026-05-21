# SecureDoc Copilot - Model Provider Policy

This document outlines the strict architectural policy concerning the use of AI model endpoints in the SecureDoc Copilot platform.

## Exclusive AI Provider Policy

> [!WARNING]
> All AI model inference in SecureDoc Copilot **MUST** use NVIDIA NIM (NVIDIA Inference Microservices) APIs exclusively. 

Dependency on any of the following commercial model provider APIs is strictly prohibited:
- OpenAI API (GPT-4, etc.)
- Anthropic API (Claude, etc.)
- Google Gemini API
- Cohere API
- Mistral hosted API (non-NIM)
- Groq hosted API (non-NIM)

## NVIDIA NIM Endpoints Mapping

NIM APIs are integrated at the backend layer (`apps/api/app/llm/nvidia_client.py`) for the following capabilities:

| Feature Node | Task Description | Primary NIM Model Target |
| :--- | :--- | :--- |
| **LLM Generation** | Natural Language generation, general chat, and agent plans. | `nvidia/llama-3.1-nemotron-70b-instruct` |
| **Fallback LLM** | Lightweight tasks, quick summarization, fallback. | `meta/llama-3.1-8b-instruct` |
| **Embeddings** | Ingestion dense vector representations. | `nvidia/nv-embedqa-e5-v5` |
| **Reranking** | Re-scoring document chunk relevance. | `nvidia/nv-rerankqa-mistral-4b-v3` (Fallback: LLM completion) |
| **Intent Router** | Classifying user query goals. | `nvidia/llama-3.1-nemotron-70b-instruct` |
| **Memory Loader / Writer** | Extracting user facts and updating context. | `nvidia/llama-3.1-nemotron-70b-instruct` |
| **Citation Verifier** | Verifying output groundness against source chunks. | `nvidia/llama-3.1-nemotron-70b-instruct` |
| **Hallucination Checker** | Evaluating output truthfulness score. | `nvidia/llama-3.1-nemotron-70b-instruct` |
| **Evaluation Scoring** | Generating faithfulness and retrieval precision scores. | `nvidia/llama-3.1-nemotron-70b-instruct` |

## Code Requirements

The NIM API client is accessed via a dedicated client instance `NvidiaNIMClient` configured using:
- `NVIDIA_API_KEY`: API authentication bearer key.
- `NVIDIA_BASE_URL`: Gateway URL (defaults to `https://integrate.api.nvidia.com/v1`).

### Integration Pattern

Always instantiate `NvidiaNIMClient` inside backend nodes to query the NVIDIA NIM completions or embeddings gateways:

```python
from app.llm.nvidia_client import NvidiaNIMClient

client = NvidiaNIMClient()
response = await client.chat(messages=[{"role": "user", "content": "Query"}])
```
Do not import direct wrappers for other AI providers in the codebase.
