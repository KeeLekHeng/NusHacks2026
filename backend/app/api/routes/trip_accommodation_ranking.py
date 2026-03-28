from fastapi import APIRouter

from app.schemas.trip_accommodation_ranking import (
    AccommodationRankingRequest,
    AccommodationRankingResponse,
)
from app.services.trip_accommodation_ranking_service import run_trip_accommodation_ranking

router = APIRouter(prefix="/trip", tags=["trip"])


@router.post("/accommodation-rank", response_model=AccommodationRankingResponse)
def rank_accommodations(
    payload: AccommodationRankingRequest,
) -> AccommodationRankingResponse:
    return run_trip_accommodation_ranking(payload)

