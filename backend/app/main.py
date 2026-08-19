"""App factory. Wires settings -> repositories -> services -> routes."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import Settings, get_settings
from app.domain.gatekeeper import PromptGatekeeper
from app.errors import register_exception_handlers
from app.middleware import BodySizeLimitMiddleware
from app.repositories.insight_repo import InsightRepository, JsonInsightRepository
from app.repositories.request_store import InMemoryRequestStore
from app.services.ai_service import AIService, DummyAIService
from app.services.prompt_service import PromptService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(
    settings: Settings | None = None,
    *,
    insight_repo: InsightRepository | None = None,
    ai_service: AIService | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    repo = insight_repo or JsonInsightRepository()
    ai = ai_service or DummyAIService(repo)
    store = InMemoryRequestStore(
        ttl_seconds=settings.request_ttl_seconds, max_entries=settings.max_stored_requests
    )
    service = PromptService(
        ai=ai,
        store=store,
        gatekeeper=PromptGatekeeper(
            min_length=settings.min_prompt_length, min_words=settings.min_prompt_words
        ),
        supported_languages=settings.supported_languages,
        default_page_size=settings.default_page_size,
        max_page_size=settings.max_page_size,
    )

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=(
            "Middleware between a UI client and an AI service: validation, gatekeeping, pagination."
        ),
    )
    app.state.settings = settings
    app.state.prompt_service = service

    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_body_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
