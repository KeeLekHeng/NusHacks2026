from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.trip_itinerary import TripItineraryRequest, TripItineraryResponse
from app.services.trip_itinerary_service import run_trip_itinerary_generator

router = APIRouter(prefix="/trip", tags=["trip"])


@router.post("/itinerary", response_model=TripItineraryResponse)
def generate_itinerary(
    payload: TripItineraryRequest,
    settings: Settings = Depends(get_settings),
) -> TripItineraryResponse:
    return run_trip_itinerary_generator(payload, settings)
