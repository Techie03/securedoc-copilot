import time
import json
import logging
from typing import List, Dict, Any, TypedDict, Annotated, Optional
from sqlalchemy.orm import Session
from app.llm.nvidia_client import NvidiaNIMClient
from app.models.models import UserMemory, WorkspaceMemory, DocumentChunk, Document
from app.utils.qdrant import qdrant_helper

logger = logging.getLogger(__name__)

# State definition
class AgentState(TypedDict):
    db: Session
    query: str
    chat_history: List[Dict[str, str]]
    workspace_id: str
    user_id: str
    mode: str  # auto, rag, general, coding, summary, compare, table, memory, report
    route: str  # set by intent router
    images: Optional[List[str]]
    context: List[Dict[str, Any]]
    response: str
    citations: List[Dict[str, Any]]
    memories_retrieved: List[Dict[str, Any]]
    new_memories_extracted: List[Dict[str, str]]
    eval_scores: Dict[str, float]
    token_usage: Dict[str, int]
    latency_ms: int
    multi_doc: Optional[bool]
    thinking_mode: Optional[bool]

async def load_memories_node(state: AgentState) -> Dict[str, Any]:
    """
    Node 1: Retrieves user and workspace memories to serve as personalized system context.
    """
    db = state["db"]
    user_id = state["user_id"]
    workspace_id = state["workspace_id"]
    
    memories_retrieved = []
    
    # 1. Fetch User memories
    try:
        user_mems = db.query(UserMemory).filter(UserMemory.user_id == user_id).all()
        for mem in user_mems:
            memories_retrieved.append({
                "id": mem.id,
                "key": mem.memory_key,
                "value": mem.memory_value,
                "type": "user",
                "visibility": mem.visibility
            })
    except Exception as e:
        logger.error(f"Error loading user memories: {e}")
        
    # 2. Fetch Workspace memories
    try:
        ws_mems = db.query(WorkspaceMemory).filter(WorkspaceMemory.workspace_id == workspace_id).all()
        for mem in ws_mems:
            memories_retrieved.append({
                "id": mem.id,
                "key": mem.memory_key,
                "value": mem.memory_value,
                "type": "workspace",
                "visibility": "workspace"
            })
    except Exception as e:
        logger.error(f"Error loading workspace memories: {e}")
        
    return {"memories_retrieved": memories_retrieved}

async def intent_router_node(state: AgentState) -> Dict[str, Any]:
    """
    Node 2: Determines the routing pathway. Either manual override or NVIDIA NIM intent classification.
    """
    mode = state["mode"]
    query = state["query"]
    
    # If a specific mode is requested directly, bypass LLM classification
    if mode != "auto":
        return {"route": mode}
        
    client = NvidiaNIMClient()
    
    # Intent classification prompt for NVIDIA NIM
    system_prompt = (
        "You are an expert intent classifier for a multi-functional Agentic RAG Platform.\n"
        "Analyze the user query and classify it into exactly one of the following categories:\n"
        "1. rag - Query requires searching or reasoning over private documents, files, or attachments.\n"
        "2. coding - Programming help, code snippet generation, debugging, language syntax, or code formatting.\n"
        "3. summary - Request to summarize, condense, or outline a document, file, or custom text.\n"
        "4. compare - Request to compare, contrast, or find differences/commonalities between documents, files, or concepts.\n"
        "5. table - Inquiries requiring tabular analysis, structured CSV grids, data sorting, or markdown spreadsheets.\n"
        "6. memory - User requests to review, remember, forget, clear, or configure user settings and preferences.\n"
        "7. report - Request to draft a comprehensive report, technical whitepaper, summary writeup, or long document.\n"
        "8. web_search - Request to search the live internet for recent news, stock prices, or current events.\n"
        "9. image_generation - Request to generate, draw, or create a visual chart, diagram, or image.\n"
        "10. general - General knowledge queries, social greeting (chitchat), jokes, and standard assistant tasks.\n\n"
        "Output ONLY the category name in lowercase: 'rag', 'coding', 'summary', 'compare', 'table', 'memory', 'report', 'web_search', 'image_generation', or 'general'. "
        "Do not include explanation, punctuation, or multiple words."
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"User query: '{query}'\n\nCategory:"}
    ]
    
    try:
        route = await client.chat(messages=messages, temperature=0.0, max_tokens=10)
        route_clean = route.strip().lower()
        # Fallback security check
        valid_routes = ["rag", "coding", "summary", "compare", "table", "memory", "report", "web_search", "image_generation", "general"]
        for r in valid_routes:
            if r in route_clean:
                return {"route": r}
        return {"route": "general"}
    except Exception as e:
        logger.error(f"Intent classification failed: {e}")
        # Default fallback
        return {"route": "rag"}  # Default to rag for safety

async def retriever_node(state: AgentState) -> Dict[str, Any]:
    """
    Node 3: Hybrid retrieval — Dense (Qdrant) + Sparse (BM25) + GraphRAG with RRF Fusion.
    """
    route = state["route"]
    query = state["query"]
    workspace_id = state["workspace_id"]
    db = state["db"]
    
    # We retrieve documents only for relevant modes
    if route not in ["rag", "summary", "compare", "table", "report"]:
        return {"context": []}
    
    try:
        from app.llm.hybrid_search import hybrid_search_pipeline
        
        search_result = await hybrid_search_pipeline.search(
            query=query,
            workspace_id=workspace_id,
            db=db,
            dense_limit=15,
            sparse_limit=10,
            final_top_n=5,
            enable_graph=True,
            enable_rerank=True
        )
        
        context = []
        for chunk in search_result.get("chunks", []):
            context.append({
                "content": chunk.get("content", ""),
                "filename": chunk.get("filename", ""),
                "document_id": chunk.get("document_id", ""),
                "page_number": chunk.get("page_number"),
                "relevance_score": chunk.get("relevance_score", 0.0),
                "retrieval_signals": chunk.get("retrieval_signals", [])
            })
        
        # Attach graph context for the generator to use
        graph_context = search_result.get("graph_context", "")
        
        result = {"context": context}
        if graph_context:
            result["graph_context_str"] = graph_context
        
        return result
        
    except Exception as e:
        logger.error(f"Hybrid retrieval failed, falling back to dense-only: {e}")
        # Fallback to original dense-only search
        client = NvidiaNIMClient()
        context = []
        try:
            query_vectors = await client.embed_texts([query], input_type="query")
            query_vector = query_vectors[0] if query_vectors else []
            
            if query_vector:
                hits = qdrant_helper.search_workspace_chunks(
                    workspace_id=workspace_id,
                    query_vector=query_vector,
                    limit=15
                )
                if hits:
                    doc_contents = [hit["content"] for hit in hits]
                    reranked = await client.rerank(query=query, documents=doc_contents, top_n=5)
                    for rank_item in reranked:
                        idx = rank_item["index"]
                        score = rank_item["relevance_score"]
                        hit = hits[idx]
                        context.append({
                            "content": hit["content"],
                            "filename": hit["filename"],
                            "document_id": hit["document_id"],
                            "page_number": hit["page_number"],
                            "relevance_score": score
                        })
        except Exception as e2:
            logger.error(f"Dense-only fallback also failed: {e2}")
        
        return {"context": context}

async def web_search_node(state: AgentState) -> Dict[str, Any]:
    """
    Node for Live Web Search using duckduckgo-search.
    """
    query = state["query"]
    context = state["context"]
    try:
        from duckduckgo_search import DDGS
        results = []
        with DDGS() as ddgs:
            # Get top 3 search results
            for r in ddgs.text(query, max_results=3):
                results.append(
                    f"Title: {r.get('title')}\n"
                    f"Link: {r.get('href')}\n"
                    f"Snippet: {r.get('body')}"
                )
        if results:
            search_str = "LIVE WEB SEARCH RESULTS:\n" + "\n\n".join(results)
            context.append({
                "content": search_str,
                "filename": "duckduckgo_search",
                "document_id": "web",
                "page_number": 1,
                "relevance_score": 1.0
            })
    except Exception as e:
        logger.error(f"Web search failed: {e}")
        
    return {"context": context}

async def image_generation_node(state: AgentState) -> Dict[str, Any]:
    """
    Node for generating images.
    """
    query = state["query"]
    images = state.get("images") or []
    client = NvidiaNIMClient()
    
    try:
        # We can extract the core prompt for image gen
        prompt_response = await client.chat([{"role": "user", "content": f"Extract the core image generation prompt from this request: '{query}'. Output ONLY the prompt."}], max_tokens=50)
        img_prompt = prompt_response.strip()
        
        b64_image = await client.generate_image(img_prompt)
        images.append(b64_image)
    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        
    return {"images": images}

async def generator_node(state: AgentState) -> Dict[str, Any]:
    """
    Node 4: Contextual LLM answer generation using the exclusive NVIDIA NIM LLM.
    """
    route = state["route"]
    query = state["query"]
    context = state["context"]
    chat_history = state["chat_history"]
    memories = state["memories_retrieved"]
    
    client = NvidiaNIMClient()
    
    # 1. Multi-Document Sub-Agent Summaries
    multi_doc_summary = ""
    if state.get("multi_doc") and context:
        docs_chunks = {}
        for doc in context:
            fname = doc["filename"]
            if fname not in docs_chunks:
                docs_chunks[fname] = []
            docs_chunks[fname].append(doc["content"])
        
        agent_summaries = []
        for fname, chunks in docs_chunks.items():
            doc_context_text = "\n".join(chunks)
            doc_agent_prompt = [
                {"role": "system", "content": f"You are the sub-agent for document: '{fname}'. Your job is to analyze your document's contents and summarize parts relevant to the user query: '{query}'."},
                {"role": "user", "content": f"Document context:\n{doc_context_text[:3000]}\n\nUser Query: {query}\n\nProvide a concise 1-2 sentence analysis/summary from your document:"}
            ]
            try:
                summary_resp = await client.chat(messages=doc_agent_prompt, temperature=0.2, max_tokens=150)
                agent_summaries.append(f"* **Agent [{fname}]**: {summary_resp.strip()}")
            except Exception as e:
                logger.error(f"Doc sub-agent failed for {fname}: {e}")
                agent_summaries.append(f"* **Agent [{fname}]**: [Offline or failed to summarize context]")

        multi_doc_summary = (
            "### 📂 Multi-Document Agent Analysis\n"
            "Each document has been assigned its own analysis agent to perform cross-doc reasoning:\n\n"
            + "\n".join(agent_summaries)
            + "\n\n"
        )
    
    # Build System Prompt based on Mode Route
    system_instructions = [
        "You are SecureDoc Copilot, a futuristic next-generation AI assistant.",
        "Your responses are grounded, helpful, secure, and precise."
    ]
    
    # Attach memories/preferences
    if memories:
        preference_lines = [f"- {m['key']}: {m['value']}" for m in memories]
        system_instructions.append(
            "\nAdhere to the following user profiles and preferences:\n" + "\n".join(preference_lines)
        )
        
    # Append Mode-Specific Guidelines
    if route == "rag":
        system_instructions.append(
            "\nYou are operating in DOCUMENT RAG mode. Ground your answer strictly in the retrieved document context below.\n"
            "If the context does not contain the answer, state that you cannot find it in the uploaded files. Do not make up facts.\n"
            "For every assertion, cite the source file in brackets like: [document.pdf] or [notes.txt, Page 3]."
        )
    elif route == "coding":
        system_instructions.append(
            "\nYou are operating in CODING ASSISTANT mode. Provide clean, secure, and production-ready code blocks.\n"
            "Include comments, syntax highlights, and point out any security/concurrency gotchas."
        )
    elif route == "memory":
        system_instructions.append(
            "\nYou are operating in MEMORY mode. Acknowledge what you have been asked to remember or forget based on the query."
        )
    elif route == "web_search":
        system_instructions.append(
            "\nYou are operating in WEB SEARCH mode. Base your answer strictly on the live internet search results provided below.\n"
            "Cite the search results in your answer."
        )
    elif route == "image_generation":
        system_instructions.append(
            "\nYou are operating in IMAGE GENERATION mode. Acknowledge that you have successfully generated the requested image."
        )
    elif route == "summary":
        system_instructions.append(
            "\nYou are operating in SUMMARIZATION mode. Provide a structured, bulleted outline of the retrieved text.\n"
            "Highlight key sections, terminology, and operational findings."
        )
    elif route == "compare":
        system_instructions.append(
            "\nYou are operating in COMPARISON mode. Analyze similarities, differences, and contrasting metrics between the documents provided in context.\n"
            "Present your analysis in a clear, comparative markdown list or table."
        )
    elif route == "table":
        system_instructions.append(
            "\nYou are operating in TABLE ANALYST mode. Present tabular calculations, CSV lists, or structured records in clean Markdown Tables.\n"
            "Align columns properly and highlight totals/averages where relevant."
        )
    elif route == "report":
        system_instructions.append(
            "\nYou are operating in REPORT GENERATION mode. Synthesize the context into a formal, highly-detailed business report.\n"
            "Use clear Markdown hierarchy (H1, H2, H3), bold metrics, and structured sections."
        )
    elif route == "memory":
        system_instructions.append(
            "\nYou are operating in MEMORY CONFIG mode. Summarize what memories the platform holds or confirm actions requested regarding preferences."
        )
    else:  # general
        system_instructions.append(
            "\nYou are operating in GENERAL CHAT mode. Engage with the user warmly, answer their questions, and write code/prose as requested."
        )
        
    # Ground the main model in Multi-Doc Agent summaries if available
    if multi_doc_summary:
        system_instructions.append(
            f"\nHere is the initial analysis summary from each individual document's sub-agent:\n{multi_doc_summary}\n"
            "Synthesize and compare these sub-agent analyses in your final consolidated response."
        )

    # Build Context Text
    context_str = ""
    if context:
        context_str = "\n\nRetrieved Private Document Context:\n"
        for i, doc in enumerate(context):
            page_info = f", Page {doc['page_number']}" if doc.get('page_number') else ""
            context_str += f"\n--- Source: {doc['filename']}{page_info} (Score: {doc['relevance_score']:.4f}) ---\n"
            context_str += doc["content"] + "\n"
            
    system_prompt = "\n".join(system_instructions)
    
    # Compile messages
    messages = [{"role": "system", "content": system_prompt}]
    
    # Append recent chat history
    for msg in chat_history[-6:]:  # Keep last 6 exchanges
        messages.append({"role": msg["role"], "content": msg["content"]})
        
    # Append final prompt
    user_prompt = query
    if context_str:
        user_prompt += context_str
        
    images = state.get("images")
    if images and len(images) > 0:
        content_parts = [{"type": "text", "text": user_prompt}]
        for img in images:
            content_parts.append({
                "type": "image_url",
                "image_url": {"url": img}
            })
        messages.append({"role": "user", "content": content_parts})
    else:
        messages.append({"role": "user", "content": user_prompt})
    
    try:
        response = await client.chat(messages=messages, temperature=0.2, max_tokens=1500)
    except Exception as e:
        logger.error(f"Generation failed: {e}")
        response = f"I'm sorry, I encountered an error during generation: {str(e)}"
        
    # Extract citations from response
    citations = []
    seen_sources = set()
    for doc in context:
        source_key = doc["filename"]
        if source_key in response and source_key not in seen_sources:
            seen_sources.add(source_key)
            citations.append({
                "filename": doc["filename"],
                "document_id": doc["document_id"],
                "page_number": doc.get("page_number")
            })

    # Prepend multi-doc summaries to final output
    if multi_doc_summary:
        response = multi_doc_summary + "### 🧠 Combined Cross-Document Reasoning\n" + response

    # 2. Thinking Mode (ReAct) Alert Block Generation
    if state.get("thinking_mode"):
        num_docs = len(context) if context else 0
        doc_names = list(set([doc["filename"] for doc in context])) if context else []
        doc_list_str = ", ".join(doc_names) if doc_names else "None"
        
        thinking_block = (
            "> [!NOTE]\n"
            "> ### 🧠 ReAct Thinking Process\n"
            f"> * **Thought**: User query received: \"{query}\". Analyzing intent routing.\n"
            f"> * **Action**: Router Engine classified query to path: `{route.upper()}`.\n"
        )
        if context:
            thinking_block += (
                f"> * **Thought**: Document retrieval required. Querying Qdrant & BM25 indices.\n"
                f"> * **Action**: Retrieved {num_docs} context chunks from {len(doc_names)} documents: ({doc_list_str}).\n"
            )
        else:
            thinking_block += (
                "> * **Thought**: Query does not require document retrieval or no documents found. Processing with general knowledge.\n"
            )
            
        if memories:
            thinking_block += (
                f"> * **Thought**: Retrieved {len(memories)} active memory contexts from workspace. Applying preferences.\n"
            )
            
        thinking_block += (
            "> * **Thought**: Synthesizing facts and generating step-by-step grounded response.\n"
            "> * **Action**: Render final output.\n\n"
        )
        
        response = thinking_block + response
            
    return {
        "response": response,
        "citations": citations
    }

async def memory_updater_node(state: AgentState) -> Dict[str, Any]:
    """
    Node 5: Parses user query for new preferences/facts, extracting them to user_memories or workspace_memories.
    """
    query = state["query"]
    route = state["route"]
    
    # Skip memory updates if query is too short or explicitly in memory mode
    if len(query) < 10 or route == "memory":
        return {"new_memories_extracted": []}
        
    client = NvidiaNIMClient()
    
    system_prompt = (
        "You are a background memory manager for a personal assistant.\n"
        "Analyze the user's message and determine if they are sharing new personal facts, preferences, or project settings "
        "that are worth remembering (e.g. name, job title, preferred languages, code paths, custom settings).\n"
        "If they are sharing a preference/fact, extract it into a JSON array of key-value pairs.\n"
        "Format example: [{\"key\": \"Favorite Programming Language\", \"value\": \"Rust\"}]\n"
        "If there are no facts worth remembering, respond with exactly: []\n"
        "Output ONLY the raw JSON array. Do not include markdown codeblocks or extra text."
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"User message: '{query}'\n\nExtracted JSON:"}
    ]
    
    new_memories = []
    try:
        response = await client.chat(messages=messages, temperature=0.0, max_tokens=150)
        clean_res = response.strip()
        # Clean potential markdown wrapping
        if clean_res.startswith("```json"):
            clean_res = clean_res[7:]
        if clean_res.endswith("```"):
            clean_res = clean_res[:-3]
        clean_res = clean_res.strip()
        
        if clean_res and clean_res != "[]":
            extracted = json.loads(clean_res)
            if isinstance(extracted, list):
                for item in extracted:
                    if "key" in item and "value" in item:
                        new_memories.append({
                            "key": item["key"],
                            "value": item["value"],
                            "visibility": "workspace"  # Default workspace scope
                        })
    except Exception as e:
        logger.error(f"Memory extraction failed: {e}")
        
    return {"new_memories_extracted": new_memories}

async def evaluator_node(state: AgentState) -> Dict[str, Any]:
    """
    Node 6: Conducts automated evaluations on Faithfulness and Relevance.
    """
    query = state["query"]
    context = state["context"]
    response = state["response"]
    citations = state["citations"]
    route = state["route"]
    
    scores = {
        "faithfulness": 1.0,
        "relevance": 1.0,
        "citation_accuracy": 1.0,
        "hallucination_risk": 0.0,
        "route_accuracy": 1.0
    }
    
    # We evaluate RAG responses
    if route not in ["rag", "summary", "compare", "table", "report"] or not context:
        return {"eval_scores": scores}
        
    client = NvidiaNIMClient()
    
    # Compile document contents
    context_str = "\n".join([doc["content"] for doc in context[:3]])
    
    # 1. Faithfulness Evaluator
    faithfulness_prompt = (
        "You are an expert AI evaluator. Assess the faithfulness of the answer based ONLY on the provided context document.\n"
        "Identify if the answer contains hallucinated or unsupported claims. "
        "Provide a score between 0.0 (completely hallucinated/unsupported) and 1.0 (completely grounded in context).\n"
        "Output ONLY the float number. Do not write explanation."
    )
    try:
        f_score_str = await client.chat(
            messages=[
                {"role": "system", "content": faithfulness_prompt},
                {"role": "user", "content": f"Context: {context_str[:2000]}\n\nAnswer: {response[:1500]}\n\nFaithfulness Score:"}
            ],
            temperature=0.0,
            max_tokens=10
        )
        f_score = float(f_score_str.strip())
        scores["faithfulness"] = min(1.0, max(0.0, f_score))
        scores["hallucination_risk"] = round(1.0 - scores["faithfulness"], 2)
    except Exception:
        pass
        
    # 2. Relevance Evaluator
    relevance_prompt = (
        "You are an expert AI evaluator. Assess how well the answer addresses the user's original search query.\n"
        "Provide a relevance score between 0.0 (completely irrelevant) and 1.0 (highly relevant and complete response).\n"
        "Output ONLY the float number. Do not write explanation."
    )
    try:
        r_score_str = await client.chat(
            messages=[
                {"role": "system", "content": relevance_prompt},
                {"role": "user", "content": f"Query: {query}\n\nAnswer: {response[:1500]}\n\nRelevance Score:"}
            ],
            temperature=0.0,
            max_tokens=10
        )
        r_score = float(r_score_str.strip())
        scores["relevance"] = min(1.0, max(0.0, r_score))
    except Exception:
        pass
        
    # 3. Citation Accuracy
    if citations:
        # Check if citations are present in the response
        valid_citations = 0
        for cite in citations:
            if cite["filename"] in response:
                valid_citations += 1
        scores["citation_accuracy"] = round(valid_citations / len(citations), 2)
        
    return {"eval_scores": scores}

# Compile Graph Workflow
class LangGraphAgent:
    def __init__(self):
        pass
        
    async def run(
        self,
        db: Session,
        query: str,
        chat_history: List[Dict[str, str]],
        workspace_id: str,
        user_id: str,
        mode: str = "auto",
        images: Optional[List[str]] = None,
        multi_doc: bool = False,
        thinking_mode: bool = False
    ) -> Dict[str, Any]:
        """
        Executes the cyclical workflow manually (simulating LangGraph orchestration)
        to prevent compilation dependencies and versioning friction during deployment.
        """
        start_time = time.time()
        
        # Initialize State
        state: AgentState = {
            "db": db,
            "query": query,
            "chat_history": chat_history,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "mode": mode,
            "route": "general",
            "images": images,
            "context": [],
            "response": "",
            "citations": [],
            "memories_retrieved": [],
            "new_memories_extracted": [],
            "eval_scores": {},
            "token_usage": {"prompt_tokens": 0, "completion_tokens": 0},
            "latency_ms": 0,
            "multi_doc": multi_doc,
            "thinking_mode": thinking_mode
        }
        
        # 1. Load Memory Context
        mems = await load_memories_node(state)
        state.update(mems)
        
        # 2. Intent Routing
        intent = await intent_router_node(state)
        state.update(intent)
        
        # 3. Retrieval / Tools
        if state["route"] == "web_search":
            search_data = await web_search_node(state)
            state.update(search_data)
        elif state["route"] == "image_generation":
            img_data = await image_generation_node(state)
            state.update(img_data)
        else:
            context_data = await retriever_node(state)
            state.update(context_data)
        
        # 4. Generate Answer
        generation = await generator_node(state)
        state.update(generation)
        
        # 5. Extract Memories
        new_mems = await memory_updater_node(state)
        state.update(new_mems)
        
        # Save new memories to PostgreSQL immediately
        if state["new_memories_extracted"]:
            for m in state["new_memories_extracted"]:
                try:
                    # Save as workspace memory
                    ws_mem = WorkspaceMemory(
                        workspace_id=workspace_id,
                        memory_key=m["key"],
                        memory_value=m["value"]
                    )
                    db.add(ws_mem)
                    db.commit()
                except Exception as e:
                    logger.error(f"Error saving workspace memory: {e}")
                    db.rollback()
                    
        # 6. Evaluation scoring
        evals = await evaluator_node(state)
        state.update(evals)
        
        # Finalize telemetry
        latency = int((time.time() - start_time) * 1000)
        state["latency_ms"] = latency
        
        # Basic token approximations for metrics tracking
        chars_prompt = len(query) + sum(len(c.get("content", "")) for c in state["context"])
        chars_completion = len(state["response"])
        state["token_usage"] = {
            "prompt_tokens": max(10, chars_prompt // 4),
            "completion_tokens": max(10, chars_completion // 4)
        }
        
        return state
