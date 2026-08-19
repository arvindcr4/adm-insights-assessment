"""SQLite `RequestStore`: survives restarts and is shared by every worker on the host."""

from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from app.domain.models import AIResult, Insight, InsightMetadata, StoredRequest

_SCHEMA = """
CREATE TABLE IF NOT EXISTS requests (
    request_id TEXT PRIMARY KEY,
    context_id TEXT NOT NULL,
    turn INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    target_language TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_expires ON requests (expires_at);
CREATE INDEX IF NOT EXISTS requests_created ON requests (created_at);
CREATE TABLE IF NOT EXISTS turns (
    context_id TEXT PRIMARY KEY,
    turn INTEGER NOT NULL,
    updated_at REAL NOT NULL
);
"""


class SqliteRequestStore:
    def __init__(self, path: str | Path, *, ttl_seconds: int, max_entries: int) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._ttl = ttl_seconds
        self._max = max_entries
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(
            self._path, check_same_thread=False, timeout=5, isolation_level=None
        )
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.executescript(_SCHEMA)

    def save(self, request: StoredRequest) -> None:
        now = _now()
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT OR REPLACE INTO requests VALUES (?,?,?,?,?,?,?,?)",
                (
                    str(request.request_id),
                    str(request.context_id),
                    request.turn,
                    request.prompt,
                    request.target_language,
                    json.dumps(_dump_result(request.result)),
                    request.created_at.timestamp(),
                    now + self._ttl,
                ),
            )
            self._conn.execute("DELETE FROM requests WHERE expires_at <= ?", (now,))
            self._conn.execute(
                "DELETE FROM requests WHERE request_id IN ("
                " SELECT request_id FROM requests ORDER BY created_at DESC LIMIT -1 OFFSET ?)",
                (self._max,),
            )

    def get(self, request_id: UUID) -> StoredRequest | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT request_id, context_id, turn, prompt, target_language, result_json, "
                "created_at FROM requests WHERE request_id = ? AND expires_at > ?",
                (str(request_id), _now()),
            ).fetchone()
        if row is None:
            return None
        rid, cid, turn, prompt, lang, result_json, created = row
        return StoredRequest(
            request_id=UUID(rid),
            context_id=UUID(cid),
            turn=turn,
            prompt=prompt,
            target_language=lang,
            result=_load_result(json.loads(result_json)),
            created_at=datetime.fromtimestamp(created, UTC),
        )

    def next_turn(self, context_id: UUID) -> int:
        with self._lock, self._conn:
            (turn,) = self._conn.execute(
                "INSERT INTO turns (context_id, turn, updated_at) VALUES (?, 1, ?) "
                "ON CONFLICT(context_id) DO UPDATE SET turn = turn + 1, "
                "updated_at = excluded.updated_at RETURNING turn",
                (str(context_id), _now()),
            ).fetchone()
            self._conn.execute(
                "DELETE FROM turns WHERE context_id IN ("
                " SELECT context_id FROM turns ORDER BY updated_at DESC LIMIT -1 OFFSET ?)",
                (self._max,),
            )
        return int(turn)

    def __len__(self) -> int:
        with self._lock:
            (n,) = self._conn.execute(
                "SELECT COUNT(*) FROM requests WHERE expires_at > ?", (_now(),)
            ).fetchone()
        return int(n)

    def close(self) -> None:
        self._conn.close()


def _now() -> float:
    return datetime.now(UTC).timestamp()


def _dump_result(result: AIResult) -> dict:
    return {
        "model": result.model,
        "matched_keywords": list(result.matched_keywords),
        "insights": [
            {
                "id": i.id,
                "title": i.title,
                "content": i.content,
                "language": i.language,
                "metadata": {
                    **asdict(i.metadata),
                    "published_at": i.metadata.published_at.isoformat(),
                    "tags": list(i.metadata.tags),
                },
            }
            for i in result.insights
        ],
    }


def _load_result(data: dict) -> AIResult:
    insights = tuple(
        Insight(
            id=i["id"],
            title=i["title"],
            content=i["content"],
            language=i["language"],
            metadata=InsightMetadata(
                category=i["metadata"]["category"],
                tags=tuple(i["metadata"]["tags"]),
                confidence=float(i["metadata"]["confidence"]),
                source=i["metadata"]["source"],
                published_at=datetime.fromisoformat(i["metadata"]["published_at"]),
            ),
        )
        for i in data["insights"]
    )
    return AIResult(
        insights=insights, matched_keywords=tuple(data["matched_keywords"]), model=data["model"]
    )
