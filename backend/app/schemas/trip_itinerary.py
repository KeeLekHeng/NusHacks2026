from typing import Literal

from pydantic import BaseModel

from app.schemas.trip_parser import TripParserResponse


class ItineraryActivity(BaseModel):
    label: str
    category: Literal["attraction", "food", "transport", "hotel", "other"]
    notes: str | None = None
    estimated_cost: float | None = None
    url: str | None = None
    start_area: str | None = None
    end_area: str | None = None


class ItineraryDay(BaseModel):
    day_number: int
    city: str
    title: str
    activities: list[ItineraryActivity]
    estimated_day_cost: float
    start_area: str | None = None
    end_area: str | None = None


class EstimatedExpenseItem(BaseModel):
    label: str
    url: str | None = None
    estimated_cost: float
    category: Literal["attraction", "food", "transport", "hotel", "other"]


class EstimatedExpenseDay(BaseModel):
    day_number: int
    city: str
    items: list[EstimatedExpenseItem]


class BudgetSummary(BaseModel):
    total_estimated_cost: float
    total_budget_usd: float | None = None
    remaining_budget_usd: float | None = None
    is_within_budget: bool | None = None
    accommodation_placeholder_included: bool = True


class TripItineraryRequest(BaseModel):
    parsed_trip: TripParserResponse


class TripItineraryResponse(BaseModel):
    trip_summary: str
    itinerary_days: list[ItineraryDay]
    estimated_expenses: list[EstimatedExpenseDay]
    budget_summary: BudgetSummary
