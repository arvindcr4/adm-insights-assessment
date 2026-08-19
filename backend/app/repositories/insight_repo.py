"""Read-only catalogue of dummy insights, loaded from a local JSON file."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Protocol

from app.domain.models import Insight, InsightMetadata

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
        return tuple(_parse(item) for item in raw)


def _parse(item: dict) -> Insight:
    meta = item["metadata"]
    return Insight(
        id=item["id"],
        title=item["title"],
        content=item["content"],
        language=item.get("language", "en"),
        metadata=InsightMetadata(
            category=meta["category"],
            tags=tuple(meta["tags"]),
            confidence=float(meta["confidence"]),
            source=meta["source"],
            published_at=datetime.fromisoformat(meta["publishedAt"]),
        ),
    )
