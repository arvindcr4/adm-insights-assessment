from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_prompt_service
from app.config import get_settings
from app.schemas import (
    ClarificationResponse,
    ErrorResponse,
    InsightsPageResponse,
    PromptRequest,
    PromptResponse,
    SuccessResponse,
)
from app.services.prompt_service import PromptService

ServiceDep = Annotated[PromptService, Depends(get_prompt_service)]

router = APIRouter(prefix="/prompts", tags=["prompts"])

_settings = get_settings()
PageParam = Annotated[int, Query(ge=1, description="1-based page number")]
PageSizeParam = Annotated[int, Query(ge=1, le=_settings.max_page_size, alias="pageSize")]

_ERRORS = {
    400: {"model": ErrorResponse, "description": "Unsupported target language"},
    422: {"model": ErrorResponse, "description": "Malformed request body"},
}


@router.post(
    "",
    response_model=PromptResponse,
    responses=_ERRORS,
    summary="Submit a prompt",
    description=(
        "Validates the request, decides whether the AI service should be called, and returns "
        "either the first page of insights (SUCCESS) or a NEEDS_CLARIFICATION envelope."
    ),
)
def submit_prompt(
    body: PromptRequest,
    service: ServiceDep,
) -> SuccessResponse | ClarificationResponse:
    return service.handle_prompt(body)


@router.get(
    "/{request_id}",
    response_model=SuccessResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Re-read an answered prompt (any page)",
)
def get_prompt(
    request_id: UUID,
    service: ServiceDep,
    page: PageParam = 1,
    page_size: PageSizeParam = _settings.default_page_size,
) -> SuccessResponse:
    return service.get_request(request_id, page=page, page_size=page_size)


@router.get(
    "/{request_id}/insights",
    response_model=InsightsPageResponse,
    responses={404: {"model": ErrorResponse}},
    summary="Fetch one page of insights for an answered prompt",
)
def get_insights_page(
    request_id: UUID,
    service: ServiceDep,
    page: PageParam = 1,
    page_size: PageSizeParam = _settings.default_page_size,
) -> InsightsPageResponse:
    return service.get_insights_page(request_id, page=page, page_size=page_size)
