from pydantic import BaseModel, Field


class TripParserRequest(BaseModel):
    user_input: str = Field(..., min_length=1, description="Natural-language trip planning request.")


class TripParserResponse(BaseModel):
    destinations: list[str]
    duration_days: int | None
    duration_nights: int | None
    total_budget_usd: float | None
    must_visit: list[str]
    departure_city: str | None
    traveler_count: int | None
    accommodation_type: str | None
    room_requirements: list[str]
    amenity_requirements: list[str]
    extra_preferences: list[str]
    missing_fields: list[str]
