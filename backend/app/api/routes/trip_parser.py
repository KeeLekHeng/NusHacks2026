from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.trip_parser import TripParserRequest, TripParserResponse
from app.services.trip_parser_service import run_trip_parser

router = APIRouter(prefix="/trip", tags=["trip"])


@router.post("/parse", response_model=TripParserResponse)
def parse_trip(
    payload: TripParserRequest,
    settings: Settings = Depends(get_settings),
) -> TripParserResponse:
    return run_trip_parser(payload, settings)
