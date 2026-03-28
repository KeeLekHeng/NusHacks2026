from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.trip_accommodation_search import (
    AccommodationSearchRequest,
    AccommodationSearchResponse,
)
from app.services.trip_accommodation_search_service import run_trip_accommodation_search

router = APIRouter(prefix="/trip", tags=["trip"])


@router.post("/accommodation-search", response_model=AccommodationSearchResponse)
def search_accommodations(
    payload: AccommodationSearchRequest,
    settings: Settings = Depends(get_settings),
) -> AccommodationSearchResponse:
    return run_trip_accommodation_search(payload, settings)

