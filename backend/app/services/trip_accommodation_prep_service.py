from app.config import Settings
from app.schemas.trip_accommodation_prep import (
    AccommodationPreparationFromItineraryRequest,
    AccommodationPreparationRequest,
    AccommodationPreparationResponse,
)
from app.services.openai_client import prepare_accommodation_search_tasks


def run_trip_accommodation_preparation(
    payload: AccommodationPreparationRequest,
    settings: Settings,
) -> AccommodationPreparationResponse:
    prepared = prepare_accommodation_search_tasks(
        parsed_trip=payload.parsed_trip.model_dump(),
        itinerary_days=[day.model_dump() for day in payload.itinerary_days],
        budget_summary=payload.budget_summary.model_dump() if payload.budget_summary else None,
        previous_selected_accommodations=[
            accommodation.model_dump() for accommodation in payload.previous_selected_accommodations
        ],
        api_key=settings.openai_api_key,
        model=settings.openai_model,
    )
    return AccommodationPreparationResponse(**prepared)


def run_trip_accommodation_preparation_from_itinerary(
    payload: AccommodationPreparationFromItineraryRequest,
    settings: Settings,
) -> AccommodationPreparationResponse:
    prepared = prepare_accommodation_search_tasks(
        parsed_trip=payload.parsed_trip.model_dump(),
        itinerary_days=[day.model_dump() for day in payload.itinerary.itinerary_days],
        budget_summary=payload.itinerary.budget_summary.model_dump(),
        previous_selected_accommodations=[
            accommodation.model_dump() for accommodation in payload.previous_selected_accommodations
        ],
        api_key=settings.openai_api_key,
        model=settings.openai_model,
    )
    return AccommodationPreparationResponse(**prepared)
