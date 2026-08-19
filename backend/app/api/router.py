from fastapi import APIRouter, Depends

from app.api.auth import require_api_key
from app.api.routes import health, languages, prompts

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(prompts.router, dependencies=[Depends(require_api_key)])
api_router.include_router(languages.router, dependencies=[Depends(require_api_key)])
api_router.include_router(health.router)
