from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.dependencies import get_current_user, get_current_workspace_member
from app.models.models import ChatSession, ChatMessage, ChatRun, EvaluationScore, User
from app.schemas.schemas import ChatSessionCreate, ChatSessionResponse, ChatMessageCreate, ChatMessageResponse
from app.llm.agent import LangGraphAgent

router = APIRouter(prefix="/workspaces/{workspace_id}/chats", tags=["Chat"])

@router.post("", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    workspace_id: str,
    session_in: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member = Depends(get_current_workspace_member)
):
    """
    Create a new chat session in the specified workspace.
    """
    session = ChatSession(
        workspace_id=workspace_id,
        user_id=current_user.id,
        title=session_in.title or "New Chat"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("", response_model=List[ChatSessionResponse])
def list_sessions(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member = Depends(get_current_workspace_member)
):
    """
    List all chat sessions in the specified workspace.
    """
    return db.query(ChatSession).filter(
        ChatSession.workspace_id == workspace_id
    ).order_by(ChatSession.created_at.desc()).all()

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    workspace_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member = Depends(get_current_workspace_member)
):
    """
    Delete a chat session.
    """
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.workspace_id == workspace_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db.delete(session)
    db.commit()
    return None

@router.get("/{session_id}/messages", response_model=List[ChatMessageResponse])
def list_messages(
    workspace_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member = Depends(get_current_workspace_member)
):
    """
    Get all messages for a specific chat session.
    """
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.workspace_id == workspace_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    return db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()

@router.post("/{session_id}/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    workspace_id: str,
    session_id: str,
    message_in: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member = Depends(get_current_workspace_member)
):
    """
    Send a message to a chat session, executing the agentic workflow and returning the AI's response.
    """
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.workspace_id == workspace_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    # 1. Save user message
    user_message = ChatMessage(
        session_id=session_id,
        role="user",
        content=message_in.content,
        mode=message_in.mode or "auto"
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)
    
    # 2. Get session chat history
    db_history = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()
    
    # Convert db history format to agent expected format (exclude the newly created user message from double processing)
    # Actually, we should feed previous chat history, but exclude the very last user message because that's passed as 'query'
    history = []
    for msg in db_history:
        if msg.id == user_message.id:
            continue
        history.append({
            "role": msg.role,
            "content": msg.content
        })
        
    # 3. Execute LangGraph Agent
    agent = LangGraphAgent()
    try:
        agent_state = await agent.run(
            db=db,
            query=message_in.content,
            chat_history=history,
            workspace_id=workspace_id,
            user_id=current_user.id,
            mode=message_in.mode or "auto"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Agent workflow execution failed: {str(e)}"
        )
        
    # 4. Save Assistant Message
    assistant_message = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=agent_state["response"],
        mode=agent_state["route"],
        sources_json=agent_state["citations"]
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    
    # 5. Save ChatRun metrics
    chat_run = ChatRun(
        message_id=assistant_message.id,
        route=agent_state["route"],
        model="meta/llama-3.3-70b-instruct",
        latency_ms=agent_state["latency_ms"],
        prompt_tokens=agent_state["token_usage"]["prompt_tokens"],
        completion_tokens=agent_state["token_usage"]["completion_tokens"],
        estimated_cost=round(
            (agent_state["token_usage"]["prompt_tokens"] * 0.0000003) + 
            (agent_state["token_usage"]["completion_tokens"] * 0.0000004), 
            6
        )
    )
    db.add(chat_run)
    db.commit()
    db.refresh(chat_run)
    
    # 6. Save Evaluation Scores
    eval_score = EvaluationScore(
        chat_run_id=chat_run.id,
        faithfulness=agent_state["eval_scores"].get("faithfulness"),
        relevance=agent_state["eval_scores"].get("relevance"),
        citation_accuracy=agent_state["eval_scores"].get("citation_accuracy"),
        hallucination_risk=agent_state["eval_scores"].get("hallucination_risk"),
        route_accuracy=agent_state["eval_scores"].get("route_accuracy")
    )
    db.add(eval_score)
    db.commit()
    db.refresh(eval_score)
    
    # Refresh assistant message to populate relationships
    db.refresh(assistant_message)
    return assistant_message
