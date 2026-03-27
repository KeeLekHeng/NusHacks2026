from app.config import Settings
from app.schemas.agent import AgentRunRequest, AgentRunResponse, ApiError
from app.services.openai_client import plan_goal, summarize_result
from app.services.tinyfish_client import run_tinyfish


def run_agent_flow(payload: AgentRunRequest, settings: Settings) -> AgentRunResponse:
    plan = plan_goal(payload.goal, settings.openai_api_key, settings.openai_model)
    sources = [str(payload.url)] if payload.url else []

    try:
        tinyfish_data = run_tinyfish(
            goal=payload.goal,
            url=str(payload.url) if payload.url else None,
            api_key=settings.tinyfish_api_key,
            base_url=settings.tinyfish_base_url,
        )
        summary = summarize_result(
            goal=payload.goal,
            extracted_data=tinyfish_data,
            api_key=settings.openai_api_key,
            model=settings.openai_model,
        )
        return AgentRunResponse(
            status="completed",
            plan=plan,
            summary=summary,
            data=tinyfish_data,
            sources=sources,
        )
    except Exception as exc:
        return AgentRunResponse(
            status="completed_with_warnings",
            plan=plan,
            summary=(
                "Plan completed, but the TinyFish step failed. "
                "Check API keys, endpoint shape, and logs."
            ),
            data={},
            sources=sources,
            error=ApiError(code="AGENT_RUN_PARTIAL_FAILURE", message=str(exc)),
        )
