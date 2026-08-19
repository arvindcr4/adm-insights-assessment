"""Keeps answered requests addressable for page navigation.

In-memory with TTL + size cap. Swap for Redis/SQL behind the same Protocol in production.
"""

from __future__ import annotations

import threading
from collections import OrderedDict
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID

from app.domain.models import StoredRequest


class RequestStore(Protocol):
    def save(self, request: StoredRequest) -> None: ...
    def get(self, request_id: UUID) -> StoredRequest | None: ...
    def next_turn(self, context_id: UUID) -> int: ...


class InMemoryRequestStore:
    def __init__(
        self,
        *,
        ttl_seconds: int,
        max_entries: int,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._ttl = timedelta(seconds=ttl_seconds)
        self._max = max_entries
        self._clock = clock
        self._lock = threading.Lock()
        self._items: OrderedDict[UUID, StoredRequest] = OrderedDict()
        self._turns: dict[UUID, int] = {}

    @property
    def ttl(self) -> timedelta:
        return self._ttl

    def save(self, request: StoredRequest) -> None:
        with self._lock:
            self._items[request.request_id] = request
            self._items.move_to_end(request.request_id)
            self._evict_locked()

    def get(self, request_id: UUID) -> StoredRequest | None:
        with self._lock:
            item = self._items.get(request_id)
            if item is None:
                return None
            if item.expires_at <= self._clock():
                del self._items[request_id]
                return None
            return item

    def next_turn(self, context_id: UUID) -> int:
        with self._lock:
            self._turns[context_id] = self._turns.get(context_id, 0) + 1
            return self._turns[context_id]

    def _evict_locked(self) -> None:
        now = self._clock()
        expired = [k for k, v in self._items.items() if v.expires_at <= now]
        for k in expired:
            del self._items[k]
        while len(self._items) > self._max:
            self._items.popitem(last=False)
