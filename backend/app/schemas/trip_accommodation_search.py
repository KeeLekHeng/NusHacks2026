from pydantic import BaseModel

from app.schemas.trip_accommodation_prep import PreviousSelectedAccommodation


class AccommodationSearchRequest(BaseModel):
    day_number: int
    city: str
    target_area: str | None = None
    traveler_count: int | None = None
    nightly_budget: float | None = None
    accommodation_type: str | None = None
    room_requirements: list[str] = []
    amenity_requirements: list[str] = []
    previous_selected_accommodation: PreviousSelectedAccommodation | None = None
    next_day_start_area: str | None = None
    reuse_flag: bool = False


class AccommodationSearchOption(BaseModel):
    option_id: str | None = None
    rank: int | None = None
    property_name: str | None = None
    platform: str | None = None
    room_type: str | None = None
    nightly_price: float | None = None
    total_price: float | None = None
    rating: float | None = None
    review_count: int | None = None
    location_summary: str | None = None
    distance_to_target_km: float | None = None
    matched_amenities: list[str] = []
    booking_url: str | None = None
    final_page_before_checkout_url: str | None = None
    is_within_budget: bool | None = None
    why_recommended: str | None = None


class AccommodationReuseOption(BaseModel):
    available: bool
    property_name: str | None = None
    platform: str | None = None
    nightly_price: float | None = None
    booking_url: str | None = None
    notes: str | None = None


class AccommodationSearchResponse(BaseModel):
    mode: str
    day_number: int
    reuse_flag: bool
    reuse_option: AccommodationReuseOption | None = None
    options: list[AccommodationSearchOption]
