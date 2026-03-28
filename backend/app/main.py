from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.agent import router as agent_router
from app.api.routes.health import router as health_router
from app.api.routes.trip_accommodation_prep import router as trip_accommodation_prep_router
from app.api.routes.trip_accommodation_ranking import router as trip_accommodation_ranking_router
from app.api.routes.trip_accommodation_search import router as trip_accommodation_search_router
from app.api.routes.trip_itinerary import router as trip_itinerary_router
from app.api.routes.trip_itinerary_refinement import router as trip_itinerary_refinement_router
from app.api.routes.trip_plan import router as trip_plan_router
from app.api.routes.trip_parser import router as trip_parser_router
from app.config import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(agent_router)
app.include_router(trip_parser_router)
app.include_router(trip_itinerary_router)
app.include_router(trip_itinerary_refinement_router)
app.include_router(trip_plan_router)
app.include_router(trip_accommodation_prep_router)
app.include_router(trip_accommodation_ranking_router)
app.include_router(trip_accommodation_search_router)
