from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.domain.models import AIResult, StoredRequest
from app.repositories.request_store import InMemoryRequestStore


def _req() -> StoredRequest:
    return StoredRequest(
        request_id=uuid4(),
        context_id=uuid4(),
        turn=1,
        prompt="p",
        target_language="en",
        result=AIResult(insights=(), matched_keywords=(), model="m"),
        created_at=datetime.now(UTC),
    )


class FakeClock:
    def __init__(self) -> None:
        self.now = datetime(2026, 1, 1, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


def test_entries_expire_after_ttl() -> None:
    clock = FakeClock()
    store = InMemoryRequestStore(ttl_seconds=60, max_entries=10, clock=clock)
    req = _req()
    store.save(req)
    assert store.get(req.request_id) is req
    clock.now += timedelta(seconds=61)
    assert store.get(req.request_id) is None
    assert len(store) == 0


def test_oldest_entries_are_evicted_beyond_capacity() -> None:
    store = InMemoryRequestStore(ttl_seconds=60, max_entries=2)
    a, b, c = _req(), _req(), _req()
    for r in (a, b, c):
        store.save(r)
    assert store.get(a.request_id) is None
    assert store.get(b.request_id) is b and store.get(c.request_id) is c
