from pydantic import BaseModel

from app.schemas.trip_itinerary import BudgetSummary, ItineraryDay
from app.schemas.trip_parser import TripParserResponse


class PreviousSelectedAccommodation(BaseModel):
    name: str
    city: str
    area: str | None = None
    address: str | None = None
    url: str | None = None


class AccommodationPreparationRequest(BaseModel):
    parsed_trip: TripParserResponse
    itinerary_days: list[ItineraryDay]
    budget_summary: BudgetSummary | None = None
    previous_selected_accommodations: list[PreviousSelectedAccommodation] = []


class AccommodationSearchTask(BaseModel):
    day_number: int
    city: str
    target_area: str | None = None
    check_in_date: str | None = None
    check_out_date: str | None = None
    traveler_count: int | None = None
    nightly_budget: float | None = None
    accommodation_type: str | None = None
    room_requirements: list[str]
    amenity_requirements: list[str]
    previous_selected_accommodation: PreviousSelectedAccommodation | None = None
    next_day_start_area: str | None = None
    reuse_flag: bool


class AccommodationPreparationResponse(BaseModel):
    accommodation_search_tasks: list[AccommodationSearchTask]
