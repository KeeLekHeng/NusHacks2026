from app.config import Settings
from app.schemas.trip_itinerary import TripItineraryRequest, TripItineraryResponse
from app.services.openai_client import generate_trip_itinerary


def run_trip_itinerary_generator(
    payload: TripItineraryRequest,
    settings: Settings,
) -> TripItineraryResponse:
    generated = generate_trip_itinerary(
        parsed_trip=payload.parsed_trip.model_dump(),
        api_key=settings.openai_api_key,
        model=settings.openai_model,
    )
    return TripItineraryResponse(**generated)
