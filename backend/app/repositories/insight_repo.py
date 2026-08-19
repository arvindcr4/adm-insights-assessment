from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from types import MappingProxyType
from typing import Protocol

from app.domain.models import Insight, InsightMetadata, LocalizedText

DEFAULT_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "insights.json"


class InsightRepository(Protocol):
    def all(self) -> tuple[Insight, ...]: ...


class JsonInsightRepository:
    def __init__(self, path: Path = DEFAULT_DATA_PATH) -> None:
        self._path = path
        self._items: tuple[Insight, ...] | None = None

    def all(self) -> tuple[Insight, ...]:
        if self._items is None:
            self._items = self._load()
        return self._items

    def _load(self) -> tuple[Insight, ...]:
        raw = json.loads(self._path.read_text(encoding="utf-8"))
        return tuple(_parse(item).indexed() for item in raw)


def _parse(item: dict) -> Insight:
    meta = item["metadata"]
    translations = {
        code: LocalizedText(
            title=loc["title"], content=loc["content"], category=loc.get("category")
        )
        for code, loc in item.get("translations", {}).items()
    }
    return Insight(
        id=item["id"],
        title=item["title"],
        content=item["content"],
        language=item.get("language", "en"),
        translations=MappingProxyType(translations),
        metadata=InsightMetadata(
            category=meta["category"],
            tags=tuple(meta["tags"]),
            confidence=float(meta["confidence"]),
            source=meta["source"],
            published_at=datetime.fromisoformat(meta["publishedAt"]),
        ),
    )
