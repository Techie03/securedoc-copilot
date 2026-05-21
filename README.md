# SecureDoc Copilot — A Futuristic Next-Generation Agentic RAG Platform

> **Search. Reason. Remember. Act — securely across private knowledge.**

SecureDoc Copilot is a secure, multi-user, **NVIDIA NIM-powered** agentic RAG platform that searches, reasons, remembers, evaluates, and acts across private documents, code, and enterprise knowledge.

## 🎥 Product Demonstration

*(Here is an automated walkthrough of the SecureDoc Copilot interface)*

![SecureDoc Copilot Demo](./demo.gif)

---

## ⚡ Architecture & Data Flow

```mermaid
graph TD
    User([User]) --> |Queries| UI[Next.js Frontend]
    UI --> |REST API| Fast[FastAPI Backend]
    
    subgraph Data Ingestion
        GH[GitHub Connector] -.-> |Sync| Fast
        Docs[PDF/DOCX/CSV] -.-> |Upload| Fast
        Fast --> |Chunk & Embed| NIM[NVIDIA NIM APIs]
        Fast --> |GraphRAG| NIM
    end
    
    subgraph Storage
        NIM --> |Vectors| Q[Qdrant]
        NIM --> |Triples| DB[(PostgreSQL)]
        Fast --> |Metadata| DB
    end
    
    subgraph Agentic RAG Pipeline
        Fast --> Agent[LangGraph Agent]
        Agent --> Router{Intent Router}
        Router --> |RAG| Hybrid[Hybrid Search]
        Router --> |Summary| Gen[Generator]
        
        Hybrid --> |1. Dense| Q
        Hybrid --> |2. Sparse| DB
        Hybrid --> |3. Graph| DB
        Hybrid --> |RRF Fusion| Rerank[NIM Reranker]
        
        Rerank --> Gen
        Gen --> Eval[NVIDIA NIM Evaluator]
    end
    
    Eval --> Fast
    Fast --> UI
```

---

## 📖 Step-by-Step Project Explanation

SecureDoc Copilot is not just another ChatGPT wrapper. It is a deeply integrated, state-of-the-art **Agentic Retrieval-Augmented Generation (RAG)** pipeline designed for enterprise security and complex reasoning. Here is exactly how it works under the hood:

### Step 1: Secure Data Ingestion & Isolation
When a user uploads a document (PDF, DOCX) or syncs a GitHub repository, the FastAPI backend immediately assigns a strict workspace ID. Data is never co-mingled. The document text is parsed and split into overlapping chunks to preserve semantic context.

### Step 2: Intelligent Entity Extraction (GraphRAG)
Before the data is even searchable, it is passed to **NVIDIA's Llama 3.1 70B** model which performs advanced entity extraction. It reads the text and pulls out structured relationships in the format of `(Subject) -> [Predicate] -> (Object)`. These "triples" are stored in PostgreSQL, creating a literal Knowledge Graph of your private data.

### Step 3: Vectorization (Dense Search)
Simultaneously, the text chunks are converted into mathematical vectors using **NVIDIA's nv-embedqa** model. These vectors are stored in the Qdrant Vector Database, allowing the system to understand the "semantic meaning" of sentences rather than just matching keywords.

### Step 4: The Agentic Query Router
When a user asks a question in the chat interface, the query doesn't go straight to a search database. Instead, an AI **Router Agent** analyzes the intent. If it's a simple greeting, it responds directly. If it requires data, it triggers the Retrieval node.

### Step 5: Hybrid Reciprocal Rank Fusion (RRF)
To find the absolute best answer, the system searches 3 different ways simultaneously:
1. **Dense Vector Search:** Looks for conceptual matches in Qdrant.
2. **Sparse Keyword Search:** Looks for exact word matches using BM25 in Postgres.
3. **Graph Traversal:** Explores the Knowledge Graph relationships extracted in Step 2.
The results from all three methods are mathematically fused and re-ranked using an **NVIDIA NIM Reranker** model.

### Step 6: Evaluated Generation
Finally, the top context is handed to the primary LLM to generate the final answer. However, before it is sent back to the user, an independent **Evaluator Agent** reviews the answer to ensure it is *Faithful* (no hallucinations) and *Relevant* (actually answers the question). If it passes, the user receives their highly-accurate response!

---

## 🚀 Key Features

| Feature Area | Description |
|---|---|
| **Agentic Workflow** | LangGraph-based state machine routing queries to RAG, summary, or conversational nodes. |
| **Hybrid Search (RRF)** | 3-signal fusion: Qdrant dense vectors + PostgreSQL BM25 + GraphRAG entity expansion. |
| **GraphRAG Extraction** | Automated entity/relationship extraction via NIM, stored as knowledge graph triples. |
| **Data Connectors** | Ingest public/private GitHub repositories directly into the RAG pipeline. |
| **Semantic Memory** | User-level and workspace-level memory extraction and persistence. |
| **Evaluations Telemetry** | Built-in RAG triad scoring (Faithfulness, Relevance, Hallucination checks). |
| **Workspace Isolation** | Strict RBAC and payload-level isolation for multi-tenant data security. |
| **Cyberpunk UI** | Glassmorphic design with micro-animations, built on Next.js 16 and Tailwind v4. |

---

## 🤖 Model Provider Policy (NVIDIA NIM ONLY)

**All AI model inference in SecureDoc Copilot uses NVIDIA NIM APIs exclusively.**
There are no fallbacks to OpenAI, Anthropic, or Gemini.

| Capability | NVIDIA NIM Model Used | Purpose |
|---|---|---|
| **Primary LLM Generator** | `meta/llama-3.1-70b-instruct` | Answer generation, summaries, logic. |
| **Embeddings** | `nvidia/nv-embedqa-e5-v5` | Dense vector generation for Qdrant. |
| **Reranking** | `nvidia/nv-rerankqa-mistral-4b-v3` | Final re-ordering of RRF candidates. |
| **Intent Router** | `meta/llama-3.1-8b-instruct` | Fast, low-latency query classification. |
| **Evaluator** | `meta/llama-3.1-70b-instruct` | Strict scoring of RAG triad metrics. |
| **GraphRAG Extractor** | `meta/llama-3.1-70b-instruct` | Structured JSON extraction for triples. |

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion, Lucide Icons |
| **Backend** | Python 3.10+, FastAPI, LangGraph, SQLAlchemy, Pydantic, httpx |
| **AI/ML** | NVIDIA NIM API (Embeddings, Reranker, LLM Chat) |
| **Vector DB** | Qdrant (Local Docker or Cloud) |
| **Relational DB** | PostgreSQL (User data, Auth, Connectors, Graph Triples) |
| **Auth** | Custom JWT implementation with Bcrypt hashing |

---

## 💻 Quick Start Guide

### 1. Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.10+
- [NVIDIA API Key](https://build.nvidia.com/explore/discover)

### 2. Environment Setup
```bash
# Clone the repository
git clone https://github.com/your-username/securedoc-copilot.git
cd securedoc-copilot

# Set up environment variables
cp .env.example .env
# Edit .env and add your NVIDIA_API_KEY
```

### 3. Start Infrastructure (PostgreSQL & Qdrant)
```bash
docker compose up -d
```

### 4. Run Backend (FastAPI)
```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 5. Run Frontend (Next.js)
```bash
cd apps/web
npm install
npm run dev
```

Visit `http://localhost:3000` to access SecureDoc Copilot.

---

## 📦 Deployment

### Frontend (Vercel)
1. Push your code to GitHub.
2. Import the `apps/web` directory in Vercel.
3. Set `NEXT_PUBLIC_API_URL` to your production backend URL.
4. Deploy.

### Backend (Render / Railway)
1. Connect your repo and point to `apps/api`.
2. Provide all environment variables (`DATABASE_URL`, `QDRANT_URL`, `NVIDIA_API_KEY`, etc.).
3. Set the start command to: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

### Databases
- **PostgreSQL**: Supabase, Neon, or RDS.
- **Qdrant**: Qdrant Cloud (Free tier available).

---

## 🤝 Contributing

We love open-source and welcome contributions from the community! Whether you're fixing a bug, improving the UI, or adding a new AI connector, here is how you can contribute:

### Step-by-Step Guide for Contributors

1. **Fork the Repository**
   Click the "Fork" button at the top right of this page to create your own copy of the repository.

2. **Clone your Fork locally**
   ```bash
   git clone https://github.com/YOUR_USERNAME/securedoc-copilot.git
   cd securedoc-copilot
   ```

3. **Create a New Branch**
   Always create a descriptive branch for your feature or bug fix:
   ```bash
   git checkout -b feature/amazing-new-feature
   ```

4. **Make Your Changes**
   Write your code! Ensure you test both the backend FastAPI and the Next.js frontend if your change impacts both.

5. **Commit Your Changes**
   Follow standard conventional commits:
   ```bash
   git commit -m "feat: added new google drive integration"
   ```

6. **Push Your Branch**
   ```bash
   git push origin feature/amazing-new-feature
   ```

7. **Open a Pull Request (PR)**
   Go back to the main `Techie03/securedoc-copilot` repository on GitHub. You'll see a green "Compare & pull request" button. Click it, describe your changes, and submit!

---

## 📄 License
This project is licensed under the MIT License.
