from app.config import Settings
from app.schemas.trip_parser import TripParserRequest, TripParserResponse
from app.services.openai_client import parse_trip_request


def run_trip_parser(payload: TripParserRequest, settings: Settings) -> TripParserResponse:
    parsed = parse_trip_request(
        user_input=payload.user_input,
        api_key=settings.openai_api_key,
        model=settings.openai_model,
    )
    return TripParserResponse(**parsed)
