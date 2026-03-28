from app.config import Settings
from app.schemas.trip_accommodation_search import (
    AccommodationSearchRequest,
    AccommodationSearchResponse,
)
from app.services.tinyfish_client import search_accommodations_with_tinyfish
from app.services.trip_accommodation_ranking_service import rank_accommodation_results


def run_trip_accommodation_search(
    payload: AccommodationSearchRequest,
    settings: Settings,
) -> AccommodationSearchResponse:
    result = search_accommodations_with_tinyfish(
        search_request=payload.model_dump(),
        api_key=settings.tinyfish_api_key,
        base_url=settings.tinyfish_base_url,
    )
    ranked = rank_accommodation_results(
        search_request=payload.model_dump(),
        raw_results=result.get("results", []),
        reuse_option=result.get("reuse_option"),
    )
    return AccommodationSearchResponse(
        mode=result.get("mode", "mock"),
        **ranked,
    )
