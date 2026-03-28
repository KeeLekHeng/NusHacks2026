from pydantic import BaseModel, Field

from app.schemas.trip_accommodation_prep import AccommodationPreparationResponse
from app.schemas.trip_accommodation_search import AccommodationSearchResponse
from app.schemas.trip_itinerary import TripItineraryResponse
from app.schemas.trip_parser import TripParserResponse


class TripPlanRequest(BaseModel):
    user_input: str = Field(..., min_length=1, description="Natural-language trip planning request.")


class TripPlanResponse(BaseModel):
    parsed_trip: TripParserResponse
    itinerary: TripItineraryResponse
    accommodation_tasks: AccommodationPreparationResponse
    accommodation_searches: list[AccommodationSearchResponse]
