from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.agent import AgentRunRequest, AgentRunResponse
from app.services.agent_service import run_agent_flow

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/run", response_model=AgentRunResponse)
def run_agent(payload: AgentRunRequest, settings: Settings = Depends(get_settings)) -> AgentRunResponse:
    return run_agent_flow(payload, settings)
