"""The downstream "AI" boundary.

`AIService` is the seam a real LLM client would implement. `DummyAIService` ranks the local
catalogue by keyword overlap with the prompt, falling back to a deterministic sample so the same
prompt always yields the same result set (which keeps pagination stable across calls).
"""

from __future__ import annotations

import hashlib
import random
from typing import Protocol
from uuid import UUID

from app.domain.gatekeeper import STOPWORDS
from app.domain.models import AIResult, Insight, _tokenize
from app.repositories.insight_repo import InsightRepository


class AIService(Protocol):
    def generate_insights(
        self, *, prompt: str, target_language: str, context_id: UUID
    ) -> AIResult: ...


class DummyAIService:
    model_name = "dummy-insights-v1"

    def __init__(self, repo: InsightRepository, *, fallback_min: int = 8) -> None:
        self._repo = repo
        self._fallback_min = fallback_min

    def generate_insights(self, *, prompt: str, target_language: str, context_id: UUID) -> AIResult:
        catalogue = self._repo.all()
        keywords = [w for w in dict.fromkeys(_tokenize(prompt)) if w not in STOPWORDS]

        scored: list[tuple[int, Insight]] = []
        matched: set[str] = set()
        for insight in catalogue:
            terms = insight.search_terms()
            hits = [k for k in keywords if k in terms or any(t.startswith(k) for t in terms)]
            if hits:
                matched.update(hits)
                scored.append((len(hits), insight))

        if scored:
            scored.sort(key=lambda pair: (-pair[0], pair[1].title))
            chosen = [ins for _, ins in scored]
        else:
            chosen = self._deterministic_sample(prompt, catalogue)

        return AIResult(
            insights=tuple(ins.localized(target_language) for ins in chosen),
            matched_keywords=tuple(sorted(matched)),
            model=self.model_name,
        )

    def _deterministic_sample(self, prompt: str, catalogue: tuple[Insight, ...]) -> list[Insight]:
        seed = int(hashlib.sha256(prompt.strip().lower().encode()).hexdigest(), 16)
        rng = random.Random(seed)
        upper = len(catalogue)
        k = rng.randint(min(self._fallback_min, upper), upper) if upper else 0
        return rng.sample(list(catalogue), k)
