from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Any
from app.database import get_db
from app.dependencies import get_current_user, get_current_workspace_member
from app.models.models import ChatRun, ChatMessage, ChatSession, EvaluationScore, User

router = APIRouter(prefix="/workspaces/{workspace_id}/evaluations", tags=["Evaluations"])

@router.get("")
def get_workspace_evaluations(
    workspace_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    member = Depends(get_current_workspace_member)
):
    """
    Get all chat run evaluations, telemetry metrics, and scores in a workspace.
    """
    runs = db.query(ChatRun)\
        .join(ChatMessage, ChatRun.message_id == ChatMessage.id)\
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)\
        .filter(ChatSession.workspace_id == workspace_id)\
        .options(
            joinedload(ChatRun.evaluation_scores),
            joinedload(ChatRun.message)
        )\
        .order_by(ChatRun.created_at.desc())\
        .limit(limit)\
        .all()
        
    results = []
    for r in runs:
        eval_data = None
        if r.evaluation_scores:
            eval_data = {
                "id": r.evaluation_scores.id,
                "faithfulness": r.evaluation_scores.faithfulness,
                "relevance": r.evaluation_scores.relevance,
                "citation_accuracy": r.evaluation_scores.citation_accuracy,
                "hallucination_risk": r.evaluation_scores.hallucination_risk,
                "route_accuracy": r.evaluation_scores.route_accuracy,
                "created_at": r.evaluation_scores.created_at
            }
            
        # Get matching user message query (which is the message preceding the assistant message)
        # Or just find the query content. Since assistant messages are linked to a ChatRun, we can get the session history
        # but let's query the message *before* this assistant message in the session.
        query_content = "N/A"
        if r.message:
            prev_msg = db.query(ChatMessage).filter(
                ChatMessage.session_id == r.message.session_id,
                ChatMessage.created_at < r.message.created_at,
                ChatMessage.role == "user"
            ).order_by(ChatMessage.created_at.desc()).first()
            if prev_msg:
                query_content = prev_msg.content
            else:
                query_content = r.message.content

        results.append({
            "run_id": r.id,
            "message_id": r.message_id,
            "query": query_content,
            "route": r.route,
            "model": r.model,
            "latency_ms": r.latency_ms,
            "prompt_tokens": r.prompt_tokens,
            "completion_tokens": r.completion_tokens,
            "estimated_cost": r.estimated_cost,
            "confidence": r.confidence,
            "created_at": r.created_at,
            "evaluation": eval_data
        })
        
    return results
