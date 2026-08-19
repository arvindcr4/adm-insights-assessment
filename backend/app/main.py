from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.chaos import ChaosMiddleware
from app.config import Settings, get_settings
from app.domain.gatekeeper import PromptGatekeeper
from app.errors import register_exception_handlers
from app.middleware import BodySizeLimitMiddleware
from app.ratelimit import RateLimitMiddleware
from app.repositories.insight_repo import InsightRepository, JsonInsightRepository
from app.repositories.request_store import InMemoryRequestStore, RequestStore
from app.repositories.sqlite_store import SqliteRequestStore
from app.services.ai_service import AIService, DummyAIService
from app.services.llm_service import OpenAICompatibleAIService
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
    ai = ai_service or _build_ai(settings, repo)
    store = _build_store(settings)
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
    if settings.rate_limit_per_minute > 0:
        app.add_middleware(
            RateLimitMiddleware,
            per_minute=settings.rate_limit_per_minute,
            burst=settings.rate_limit_burst,
            trust_proxy_headers=settings.trust_proxy_headers,
        )
    if settings.chaos_enabled:
        # Outermost; /health and docs are exempt.
        app.add_middleware(
            ChaosMiddleware,
            error_rate=settings.chaos_error_rate,
            drop_rate=settings.chaos_drop_rate,
            latency_ms=settings.chaos_latency_ms,
            seed=settings.chaos_seed,
        )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(api_router)
    return app


def _build_store(settings: Settings) -> RequestStore:
    if settings.store_backend == "sqlite":
        return SqliteRequestStore(
            settings.sqlite_path,
            ttl_seconds=settings.request_ttl_seconds,
            max_entries=settings.max_stored_requests,
        )
    return InMemoryRequestStore(
        ttl_seconds=settings.request_ttl_seconds, max_entries=settings.max_stored_requests
    )


def _build_ai(settings: Settings, repo: InsightRepository) -> AIService:
    dummy = DummyAIService(repo)
    if settings.ai_provider == "openai_compatible":
        if settings.ai_api_key is None:
            raise RuntimeError("INSIGHTS_AI_API_KEY is required for ai_provider=openai_compatible")
        return OpenAICompatibleAIService(
            base_url=settings.ai_base_url,
            api_key=settings.ai_api_key.get_secret_value(),
            model=settings.ai_model,
            timeout_seconds=settings.ai_timeout_seconds,
            fallback=dummy if settings.ai_fallback_to_dummy else None,
        )
    return dummy


app = create_app()
