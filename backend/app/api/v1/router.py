from fastapi import APIRouter

from app.api.v1.articles import router as articles_router
from app.api.v1.auth import router as auth_router
from app.api.v1.export import router as export_router
from app.api.v1.extractions import router as extractions_router
from app.api.v1.grade import router as grade_router
from app.api.v1.methodology import router as methodology_router
from app.api.v1.projects import router as projects_router
from app.api.v1.templates import router as templates_router
from app.api.v1.training import router as training_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(articles_router)
api_router.include_router(extractions_router)
api_router.include_router(grade_router)
api_router.include_router(export_router)
api_router.include_router(training_router)
api_router.include_router(methodology_router)
api_router.include_router(templates_router)
api_router.include_router(projects_router)
