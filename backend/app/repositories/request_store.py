"""Answered requests, kept addressable for page navigation. In-memory, TTL + LRU cap;
a Redis/SQL implementation only has to satisfy `RequestStore`."""

from __future__ import annotations

import threading
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import UUID

from app.domain.models import StoredRequest


class RequestStore(Protocol):
    def save(self, request: StoredRequest) -> None: ...
    def get(self, request_id: UUID) -> StoredRequest | None: ...
    def next_turn(self, context_id: UUID) -> int: ...


@dataclass(slots=True)
class _Entry:
    request: StoredRequest
    expires_at: datetime


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
        self._items: OrderedDict[UUID, _Entry] = OrderedDict()
        # Keyed by client-supplied ids, so capped too.
        self._turns: OrderedDict[UUID, int] = OrderedDict()

    def save(self, request: StoredRequest) -> None:
        with self._lock:
            self._items[request.request_id] = _Entry(request, self._clock() + self._ttl)
            self._items.move_to_end(request.request_id)
            self._evict_locked()

    def get(self, request_id: UUID) -> StoredRequest | None:
        with self._lock:
            entry = self._items.get(request_id)
            if entry is None:
                return None
            if entry.expires_at <= self._clock():
                del self._items[request_id]
                return None
            return entry.request

    def next_turn(self, context_id: UUID) -> int:
        with self._lock:
            self._turns[context_id] = self._turns.get(context_id, 0) + 1
            self._turns.move_to_end(context_id)
            while len(self._turns) > self._max:
                self._turns.popitem(last=False)
            return self._turns[context_id]

    def __len__(self) -> int:
        return len(self._items)

    def _evict_locked(self) -> None:
        now = self._clock()
        for key in [k for k, v in self._items.items() if v.expires_at <= now]:
            del self._items[key]
        while len(self._items) > self._max:
            self._items.popitem(last=False)
