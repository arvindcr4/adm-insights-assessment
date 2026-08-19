"""Plain domain objects. No FastAPI/pydantic here so the core is framework-agnostic."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from datetime import datetime
from types import MappingProxyType
from uuid import UUID


@dataclass(frozen=True, slots=True)
class InsightMetadata:
    category: str
    tags: tuple[str, ...]
    confidence: float
    source: str
    published_at: datetime


@dataclass(frozen=True, slots=True)
class LocalizedText:
    title: str
    content: str
    category: str | None = None


@dataclass(frozen=True, slots=True)
class Insight:
    id: str
    title: str
    content: str
    language: str
    metadata: InsightMetadata
    # Pre-authored renditions keyed by ISO code (the catalogue's stand-in for an AI translating).
    translations: Mapping[str, LocalizedText] = field(default_factory=lambda: MappingProxyType({}))

    def search_terms(self) -> frozenset[str]:
        """Lower-cased bag of words (all languages) the dummy AI uses for relevance scoring."""
        parts = [self.title, self.content, self.metadata.category, *self.metadata.tags]
        parts += [t for loc in self.translations.values() for t in (loc.title, loc.content)]
        return frozenset(_tokenize(" ".join(parts)))

    def available_languages(self) -> frozenset[str]:
        return frozenset({self.language, *self.translations})

    def localized(self, language: str) -> Insight:
        """Return this insight in `language`; falls back to the source text (tagged as such)."""
        if language == self.language:
            return self
        loc = self.translations.get(language)
        if loc is None:
            return self
        metadata = replace(self.metadata, category=loc.category) if loc.category else self.metadata
        return replace(
            self, title=loc.title, content=loc.content, language=language, metadata=metadata
        )


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


def _tokenize(text: str) -> list[str]:
    return [t for t in "".join(ch.lower() if ch.isalnum() else " " for ch in text).split() if t]
