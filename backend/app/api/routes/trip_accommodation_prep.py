from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.trip_accommodation_prep import (
    AccommodationPreparationFromItineraryRequest,
    AccommodationPreparationRequest,
    AccommodationPreparationResponse,
)
from app.services.trip_accommodation_prep_service import (
    run_trip_accommodation_preparation,
    run_trip_accommodation_preparation_from_itinerary,
)

router = APIRouter(prefix="/trip", tags=["trip"])


@router.post("/accommodation-tasks", response_model=AccommodationPreparationResponse)
def prepare_accommodation_tasks(
    payload: AccommodationPreparationRequest,
    settings: Settings = Depends(get_settings),
) -> AccommodationPreparationResponse:
    return run_trip_accommodation_preparation(payload, settings)


@router.post("/accommodation-tasks-from-itinerary", response_model=AccommodationPreparationResponse)
def prepare_accommodation_tasks_from_itinerary(
    payload: AccommodationPreparationFromItineraryRequest,
    settings: Settings = Depends(get_settings),
) -> AccommodationPreparationResponse:
    return run_trip_accommodation_preparation_from_itinerary(payload, settings)
