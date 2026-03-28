from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.trip_accommodation_prep import (
    AccommodationPreparationRequest,
    AccommodationPreparationResponse,
)
from app.services.trip_accommodation_prep_service import run_trip_accommodation_preparation

router = APIRouter(prefix="/trip", tags=["trip"])


@router.post("/accommodation-tasks", response_model=AccommodationPreparationResponse)
def prepare_accommodation_tasks(
    payload: AccommodationPreparationRequest,
    settings: Settings = Depends(get_settings),
) -> AccommodationPreparationResponse:
    return run_trip_accommodation_preparation(payload, settings)
