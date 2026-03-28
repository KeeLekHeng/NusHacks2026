from pydantic import BaseModel, Field

from app.schemas.trip_itinerary import BudgetSummary, EstimatedExpenseDay, ItineraryDay
from app.schemas.trip_parser import TripParserResponse


class TripItineraryRefinementRequest(BaseModel):
    parsed_trip: TripParserResponse
    itinerary_days: list[ItineraryDay]
    estimated_expenses: list[EstimatedExpenseDay]
    budget_summary: BudgetSummary
    user_refinement_message: str = Field(
        ...,
        min_length=1,
        description="Follow-up edit request for the generated itinerary.",
    )


class TripItineraryRefinementResponse(BaseModel):
    updated_itinerary_days: list[ItineraryDay]
    updated_estimated_expenses: list[EstimatedExpenseDay]
    updated_budget_summary: BudgetSummary
    explanation_summary: str | None = None
