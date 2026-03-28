from app.config import Settings
from app.schemas.trip_itinerary_refinement import (
    TripItineraryRefinementRequest,
    TripItineraryRefinementResponse,
)
from app.services.openai_client import refine_trip_itinerary


def run_trip_itinerary_refinement(
    payload: TripItineraryRefinementRequest,
    settings: Settings,
) -> TripItineraryRefinementResponse:
    refined = refine_trip_itinerary(
        parsed_trip=payload.parsed_trip.model_dump(),
        itinerary_days=[day.model_dump() for day in payload.itinerary_days],
        estimated_expenses=[day.model_dump() for day in payload.estimated_expenses],
        budget_summary=payload.budget_summary.model_dump(),
        user_refinement_message=payload.user_refinement_message,
        api_key=settings.openai_api_key,
        model=settings.openai_model,
    )
    return TripItineraryRefinementResponse(**refined)
