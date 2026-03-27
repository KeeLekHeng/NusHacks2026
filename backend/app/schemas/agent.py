from typing import Any, Literal
from pydantic import BaseModel, Field, HttpUrl


StatusType = Literal["completed", "completed_with_warnings", "failed"]


class AgentRunRequest(BaseModel):
    goal: str = Field(..., min_length=1, description="Goal for the agent to execute.")
    url: HttpUrl | None = Field(default=None, description="Optional target website.")


class ApiError(BaseModel):
    code: str
    message: str


class AgentRunResponse(BaseModel):
    status: StatusType
    plan: list[str]
    summary: str
    data: dict[str, Any]
    sources: list[str]
    error: ApiError | None = None
