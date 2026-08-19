from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.config import Settings
from app.domain.models import AIResult, Insight, InsightMetadata, StoredRequest
from app.main import create_app
from app.repositories.sqlite_store import SqliteRequestStore
from tests.conftest import submit


def _req() -> StoredRequest:
    insight = Insight(
        id="x-1",
        title="t",
        content="c",
        language="es",
        metadata=InsightMetadata(
            category="Cat",
            tags=("a", "b"),
            confidence=0.5,
            source="s",
            published_at=datetime(2026, 1, 1, tzinfo=UTC),
        ),
    )
    return StoredRequest(
        request_id=uuid4(),
        context_id=uuid4(),
        turn=1,
        prompt="p",
        target_language="es",
        result=AIResult(insights=(insight,), matched_keywords=("k",), model="m"),
        created_at=datetime.now(UTC),
    )


def test_round_trip_and_survives_reopen(tmp_path) -> None:
    path = tmp_path / "store.db"
    store = SqliteRequestStore(path, ttl_seconds=60, max_entries=10)
    req = _req()
    store.save(req)
    got = store.get(req.request_id)
    assert got is not None
    assert got.result.insights[0].title == "t"
    assert got.result.insights[0].metadata.tags == ("a", "b")
    assert got.result.matched_keywords == ("k",)
    store.close()
    # A new process (new instance) sees it: that is the point of the sqlite backend.
    again = SqliteRequestStore(path, ttl_seconds=60, max_entries=10)
    assert again.get(req.request_id) is not None
    assert again.next_turn(req.context_id) == 1
    assert again.next_turn(req.context_id) == 2


def test_cap_and_ttl(tmp_path) -> None:
    store = SqliteRequestStore(tmp_path / "s.db", ttl_seconds=60, max_entries=2)
    a, b, c = _req(), _req(), _req()
    for r in (a, b, c):
        store.save(r)
    assert store.get(a.request_id) is None
    assert len(store) == 2
    expired = SqliteRequestStore(tmp_path / "e.db", ttl_seconds=0, max_entries=2)
    expired.save(a)
    assert expired.get(a.request_id) is None


def test_app_with_sqlite_backend_paginates_across_instances(tmp_path) -> None:
    settings = Settings(store_backend="sqlite", sqlite_path=str(tmp_path / "app.db"))
    first = TestClient(create_app(settings))
    rid = submit(first).json()["requestId"]
    # Another app instance (another worker) can serve page 2 for the same request id.
    second = TestClient(create_app(settings))
    r = second.get(f"/api/v1/prompts/{rid}/insights", params={"page": 2})
    assert r.status_code == 200
    assert r.json()["pagination"]["page"] == 2
