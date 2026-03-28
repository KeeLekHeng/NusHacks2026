from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.trip_itinerary_refinement import (
    TripItineraryRefinementRequest,
    TripItineraryRefinementResponse,
)
from app.services.trip_itinerary_refinement_service import run_trip_itinerary_refinement

router = APIRouter(prefix="/trip", tags=["trip"])


@router.post("/itinerary/refine", response_model=TripItineraryRefinementResponse)
def refine_itinerary(
    payload: TripItineraryRefinementRequest,
    settings: Settings = Depends(get_settings),
) -> TripItineraryRefinementResponse:
    return run_trip_itinerary_refinement(payload, settings)
