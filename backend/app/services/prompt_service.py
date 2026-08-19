"""Use-case orchestration: validate language -> gatekeep -> call AI -> store -> paginate."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from app.domain.gatekeeper import PromptGatekeeper
from app.domain.models import Insight, StoredRequest
from app.domain.pagination import Page, paginate
from app.errors import InvalidPageSizeError, RequestNotFoundError, UnsupportedLanguageError
from app.repositories.request_store import RequestStore
from app.schemas import (
    ClarificationResponse,
    InsightMetadata,
    InsightOut,
    InsightsPageResponse,
    Pagination,
    PromptRequest,
    ResponseMeta,
    SuccessResponse,
)
from app.services.ai_service import AIService


class PromptService:
    def __init__(
        self,
        *,
        ai: AIService,
        store: RequestStore,
        gatekeeper: PromptGatekeeper,
        supported_languages: dict[str, str],
        default_page_size: int,
        max_page_size: int,
    ) -> None:
        self._ai = ai
        self._store = store
        self._gatekeeper = gatekeeper
        self._languages = supported_languages
        self._default_page_size = default_page_size
        self._max_page_size = max_page_size

    # ----- commands -----

    def handle_prompt(self, req: PromptRequest) -> SuccessResponse | ClarificationResponse:
        if req.target_language not in self._languages:
            raise UnsupportedLanguageError(
                "Target language is not supported",
                details={"supportedLanguages": sorted(self._languages)},
            )

        context_id = req.context_id or uuid4()
        turn = self._store.next_turn(context_id)

        verdict = self._gatekeeper.assess(req.prompt)
        if verdict.needs_clarification:
            # Short-circuit: no downstream AI call is made.
            return ClarificationResponse(
                context_id=context_id,
                turn=turn,
                message=self._gatekeeper.describe(verdict.reasons[:1], req.target_language),
                reasons=list(verdict.reasons),
                suggestions=list(self._gatekeeper.suggestions(req.target_language)),
            )

        result = self._ai.generate_insights(
            prompt=req.prompt, target_language=req.target_language, context_id=context_id
        )
        stored = StoredRequest(
            request_id=uuid4(),
            context_id=context_id,
            turn=turn,
            prompt=req.prompt,
            target_language=req.target_language,
            result=result,
            created_at=datetime.now(UTC),
        )
        self._store.save(stored)
        return self._success(stored, page=1, page_size=self._default_page_size)

    # ----- queries -----

    def get_request(self, request_id: UUID, *, page: int, page_size: int | None) -> SuccessResponse:
        return self._success(
            self._require(request_id), page=page, page_size=self._resolve_page_size(page_size)
        )

    def get_insights_page(
        self, request_id: UUID, *, page: int, page_size: int | None
    ) -> InsightsPageResponse:
        stored = self._require(request_id)
        paged = paginate(
            stored.result.insights, page=page, page_size=self._resolve_page_size(page_size)
        )
        return InsightsPageResponse(
            request_id=stored.request_id,
            insights=[_to_out(i) for i in paged.items],
            pagination=_to_pagination(paged),
        )

    # ----- helpers -----

    def _resolve_page_size(self, page_size: int | None) -> int:
        if page_size is None:
            return self._default_page_size
        if page_size > self._max_page_size:
            raise InvalidPageSizeError(
                "Request validation failed",
                details=[
                    {
                        "field": "pageSize",
                        "code": "less_than_equal",
                        "message": f"pageSize must be <= {self._max_page_size}",
                    }
                ],
            )
        return page_size

    def _require(self, request_id: UUID) -> StoredRequest:
        stored = self._store.get(request_id)
        if stored is None:
            raise RequestNotFoundError(
                "Request not found or expired", details={"requestId": str(request_id)}
            )
        return stored

    def _success(self, stored: StoredRequest, *, page: int, page_size: int) -> SuccessResponse:
        paged = paginate(stored.result.insights, page=page, page_size=page_size)
        return SuccessResponse(
            request_id=stored.request_id,
            context_id=stored.context_id,
            turn=stored.turn,
            prompt=stored.prompt,
            target_language=stored.target_language,
            insights=[_to_out(i) for i in paged.items],
            pagination=_to_pagination(paged),
            meta=ResponseMeta(
                model=stored.result.model,
                matched_keywords=list(stored.result.matched_keywords),
                generated_at=stored.created_at,
            ),
        )


def _to_out(i: Insight) -> InsightOut:
    return InsightOut(
        id=i.id,
        title=i.title,
        content=i.content,
        language=i.language,
        metadata=InsightMetadata(
            category=i.metadata.category,
            tags=list(i.metadata.tags),
            confidence=i.metadata.confidence,
            source=i.metadata.source,
            published_at=i.metadata.published_at,
        ),
    )


def _to_pagination(p: Page) -> Pagination:
    return Pagination(
        page=p.page,
        page_size=p.page_size,
        total_items=p.total_items,
        total_pages=p.total_pages,
        has_next_page=p.has_next_page,
        has_previous_page=p.has_previous_page,
    )
