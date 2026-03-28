from typing import Any

from pydantic import BaseModel

from app.schemas.trip_accommodation_search import (
    AccommodationReuseOption,
    AccommodationSearchOption,
    AccommodationSearchRequest,
)


class AccommodationRawResult(BaseModel):
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
    why_recommended: str | None = None
    extra_data: dict[str, Any] = {}


class AccommodationRankingRequest(BaseModel):
    search_request: AccommodationSearchRequest
    raw_results: list[AccommodationRawResult] = []
    reuse_option: AccommodationReuseOption | None = None


class AccommodationRankingResponse(BaseModel):
    day_number: int
    reuse_flag: bool
    reuse_option: AccommodationReuseOption | None = None
    options: list[AccommodationSearchOption]

