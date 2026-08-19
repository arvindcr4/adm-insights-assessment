"""Plain domain objects. No FastAPI/pydantic here so the core is framework-agnostic."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class InsightMetadata:
    category: str
    tags: tuple[str, ...]
    confidence: float
    source: str
    published_at: datetime


@dataclass(frozen=True, slots=True)
class Insight:
    id: str
    title: str
    content: str
    language: str
    metadata: InsightMetadata

    def search_terms(self) -> frozenset[str]:
        """Lower-cased bag of words the dummy AI uses for relevance scoring."""
        words = (
            f"{self.title} {self.content} {self.metadata.category} {' '.join(self.metadata.tags)}"
        )
        return frozenset(_tokenize(words))

    def localized(self, language: str) -> Insight:
        # The dummy AI does not translate; it only tags the language it was asked for.
        return replace(self, language=language)


@dataclass(frozen=True, slots=True)
class AIResult:
    insights: tuple[Insight, ...]
    matched_keywords: tuple[str, ...]
    model: str


@dataclass(slots=True)
class StoredRequest:
    request_id: UUID
    context_id: UUID
    turn: int
    prompt: str
    target_language: str
    result: AIResult
    created_at: datetime


@dataclass(frozen=True, slots=True)
class ClarificationVerdict:
    needs_clarification: bool
    reasons: tuple[str, ...] = field(default=())
    suggestions: tuple[str, ...] = field(default=())


def _tokenize(text: str) -> list[str]:
    return [t for t in "".join(ch.lower() if ch.isalnum() else " " for ch in text).split() if t]
