from fastapi import APIRouter

from app.api.routes import health, languages, prompts

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(prompts.router)
api_router.include_router(languages.router)
api_router.include_router(health.router)
