"""`AIService` on any OpenAI-compatible chat-completions endpoint (DeepSeek, OpenAI, OpenRouter).

The model is asked for JSON; the answer is validated and mapped to `Insight`. On any upstream or
parsing failure the optional fallback (the dummy catalogue) answers instead, or a 502 is raised.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.domain.gatekeeper import STOPWORDS
from app.domain.models import AIResult, Insight, InsightMetadata, _tokenize
from app.errors import AIUpstreamError
from app.services.ai_service import AIService

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an insights engine for agricultural commodity markets, food ingredients,
biofuels, logistics and sustainability. Given a user question, produce 8 to 20 distinct, specific,
non-repetitive insights. Answer ONLY with a JSON object of the shape
{"insights":[{"title":str,"content":str,"category":str,"tags":[str],"confidence":number}]}.
Rules: title <= 90 chars; content 1-2 sentences; category is a short noun (e.g. Oilseeds, Grains,
Biofuels, Weather, Logistics, Trade Policy, Markets, Nutrition, Sustainability, Operations);
tags are 3-6 lowercase English slugs; confidence is a number between 0 and 1.
Write title, content and category in the language with ISO code "{lang}"."""


def _slug(value: str) -> str:
    return "-".join(_tokenize(value))


class _LLMInsight(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=1000)
    category: str = Field(min_length=1, max_length=60)
    tags: list[str] = Field(default_factory=list, max_length=12)
    confidence: float = Field(default=0.7, ge=0, le=1)


class _LLMAnswer(BaseModel):
    insights: list[_LLMInsight] = Field(min_length=1, max_length=40)


class OpenAICompatibleAIService:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 40.0,
        fallback: AIService | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.model = model
        self._fallback = fallback
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout_seconds,
            transport=transport,
        )

    def generate_insights(self, *, prompt: str, target_language: str, context_id: UUID) -> AIResult:
        try:
            answer = self._ask(prompt, target_language)
        except (httpx.HTTPError, ValidationError, ValueError, KeyError) as exc:
            reason = f"{type(exc).__name__}: {str(exc)[:120]}"
            log.warning("AI upstream failed (%s); fallback=%s", reason, bool(self._fallback))
            if self._fallback is None:
                raise AIUpstreamError(
                    "The AI service is unavailable", details={"reason": reason}
                ) from exc
            result = self._fallback.generate_insights(
                prompt=prompt, target_language=target_language, context_id=context_id
            )
            return AIResult(
                insights=result.insights,
                matched_keywords=result.matched_keywords,
                model=f"{result.model} (fallback: {type(exc).__name__})",
            )
        return self._to_result(answer, prompt, target_language)

    def _ask(self, prompt: str, target_language: str) -> _LLMAnswer:
        response = self._client.post(
            "/chat/completions",
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT.replace("{lang}", target_language)},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.7,
            },
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return _LLMAnswer.model_validate_json(content)

    def _to_result(self, answer: _LLMAnswer, prompt: str, language: str) -> AIResult:
        now = datetime.now(UTC)
        seed = hashlib.sha1(f"{prompt}|{language}|{now.isoformat()}".encode()).hexdigest()[:8]
        keywords = [w for w in dict.fromkeys(_tokenize(prompt)) if w not in STOPWORDS]
        matched: set[str] = set()
        insights = []
        for n, item in enumerate(answer.insights, 1):
            insight = Insight(
                id=f"llm-{seed}-{n:02d}",
                title=item.title.strip(),
                content=item.content.strip(),
                language=language,
                metadata=InsightMetadata(
                    category=item.category.strip(),
                    tags=tuple(dict.fromkeys(_slug(t) for t in item.tags if _slug(t))),
                    confidence=round(item.confidence, 2),
                    source=self.model,
                    published_at=now,
                ),
            ).indexed()
            matched.update(k for k in keywords if insight.matches(k))
            insights.append(insight)
        return AIResult(
            insights=tuple(insights), matched_keywords=tuple(sorted(matched)), model=self.model
        )
