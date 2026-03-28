from app.config import Settings
from app.schemas.trip_accommodation_search import (
    AccommodationSearchRequest,
    AccommodationSearchResponse,
)
from app.services.tinyfish_client import search_accommodations_with_tinyfish
from app.services.trip_accommodation_ranking_service import rank_accommodation_results
from app.services.tinyfish_client import _build_mock_accommodation_options
from app.services.tinyfish_client import _build_mock_reuse_option


def run_trip_accommodation_search(
    payload: AccommodationSearchRequest,
    settings: Settings,
) -> AccommodationSearchResponse:
    search_request = payload.model_dump()
    result = search_accommodations_with_tinyfish(
        search_request=search_request,
        api_key=settings.tinyfish_api_key,
        base_url=settings.tinyfish_base_url,
    )
    ranked = rank_accommodation_results(
        search_request=search_request,
        raw_results=result.get("results", []),
        reuse_option=result.get("reuse_option"),
    )

    if not ranked.get("options"):
        fallback_ranked = rank_accommodation_results(
            search_request=search_request,
            raw_results=_build_mock_accommodation_options(search_request),
            reuse_option=result.get("reuse_option") or _build_mock_reuse_option(search_request),
        )
        return AccommodationSearchResponse(
            mode="fallback",
            **fallback_ranked,
        )

    return AccommodationSearchResponse(
        mode=result.get("mode", "mock"),
        **ranked,
    )
