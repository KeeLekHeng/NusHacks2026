from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.trip_plan import TripPlanRequest, TripPlanResponse
from app.services.trip_plan_service import run_trip_plan

router = APIRouter(prefix="/trip", tags=["trip"])


@router.post("/plan", response_model=TripPlanResponse)
def plan_trip(
    payload: TripPlanRequest,
    settings: Settings = Depends(get_settings),
) -> TripPlanResponse:
    return run_trip_plan(payload, settings)
