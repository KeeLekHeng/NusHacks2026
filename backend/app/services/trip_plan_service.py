from app.config import Settings
from app.schemas.trip_accommodation_prep import AccommodationPreparationResponse
from app.schemas.trip_accommodation_prep import AccommodationPreparationRequest
from app.schemas.trip_accommodation_search import AccommodationSearchRequest
from app.schemas.trip_itinerary import TripItineraryRequest
from app.schemas.trip_parser import TripParserRequest
from app.schemas.trip_plan import TripPlanRequest, TripPlanResponse
from app.services.trip_accommodation_prep_service import run_trip_accommodation_preparation
from app.services.trip_accommodation_search_service import run_trip_accommodation_search
from app.services.trip_itinerary_service import run_trip_itinerary_generator
from app.services.trip_parser_service import run_trip_parser


def _collapse_accommodation_tasks(tasks: list) -> list:
    collapsed = []
    seen_cities: set[str] = set()

    for task in tasks:
        city = task.city.strip().lower()
        if city in seen_cities:
            continue
        seen_cities.add(city)
        collapsed.append(task)

    return collapsed


def run_trip_plan(payload: TripPlanRequest, settings: Settings) -> TripPlanResponse:
    parsed_trip = run_trip_parser(
        TripParserRequest(user_input=payload.user_input),
        settings,
    )

    itinerary = run_trip_itinerary_generator(
        TripItineraryRequest(parsed_trip=parsed_trip),
        settings,
    )

    accommodation_tasks = run_trip_accommodation_preparation(
        AccommodationPreparationRequest(
            parsed_trip=parsed_trip,
            itinerary_days=itinerary.itinerary_days,
            budget_summary=itinerary.budget_summary,
            previous_selected_accommodations=[],
        ),
        settings,
    )
    collapsed_tasks = _collapse_accommodation_tasks(accommodation_tasks.accommodation_search_tasks)
    collapsed_accommodation_tasks = AccommodationPreparationResponse(
        accommodation_search_tasks=collapsed_tasks
    )

    accommodation_searches = [
        run_trip_accommodation_search(
            AccommodationSearchRequest(**task.model_dump()),
            settings,
        )
        for task in collapsed_tasks
    ]

    return TripPlanResponse(
        parsed_trip=parsed_trip,
        itinerary=itinerary,
        accommodation_tasks=collapsed_accommodation_tasks,
        accommodation_searches=accommodation_searches,
    )
