"""Wire contracts (pydantic). Field names are camelCase on the wire, snake_case in Python."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------- Requests ----------

PROMPT_MAX_LENGTH = 2000

LanguageCode = Annotated[
    str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=16)
]


class PromptRequest(ApiModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="forbid", str_strip_whitespace=True
    )

    # Hard wire limit; the body-size middleware guards memory before this runs.
    prompt: str = Field(..., min_length=1, max_length=PROMPT_MAX_LENGTH, description="User's query")
    target_language: LanguageCode = Field(..., description="ISO 639-1 code, e.g. en, de, fr")
    context_id: UUID | None = Field(default=None, description="Conversation tracking id")


# ---------- Responses ----------


class InsightMetadata(ApiModel):
    category: str
    tags: list[str]
    confidence: float = Field(ge=0, le=1)
    source: str
    published_at: datetime


class InsightOut(ApiModel):
    id: str
    title: str
    content: str
    language: str
    metadata: InsightMetadata


class Pagination(ApiModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next_page: bool
    has_previous_page: bool


class ResponseMeta(ApiModel):
    model: str
    matched_keywords: list[str]
    generated_at: datetime


class SuccessResponse(ApiModel):
    status: Literal["SUCCESS"] = "SUCCESS"
    request_id: UUID
    context_id: UUID
    turn: int
    prompt: str
    target_language: str
    insights: list[InsightOut]
    pagination: Pagination
    meta: ResponseMeta


class ClarificationResponse(ApiModel):
    status: Literal["NEEDS_CLARIFICATION"] = "NEEDS_CLARIFICATION"
    context_id: UUID
    turn: int
    message: str
    reasons: list[str]
    suggestions: list[str]


PromptResponse = Annotated[SuccessResponse | ClarificationResponse, Field(discriminator="status")]


class InsightsPageResponse(ApiModel):
    request_id: UUID
    insights: list[InsightOut]
    pagination: Pagination


class LanguageOut(ApiModel):
    code: str
    label: str


class LanguagesResponse(ApiModel):
    languages: list[LanguageOut]


class ErrorResponse(ApiModel):
    error: str
    message: str
    details: object | None = None
