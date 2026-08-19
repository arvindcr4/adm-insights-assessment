from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Page[T]:
    items: tuple[T, ...]
    page: int
    page_size: int
    total_items: int

    @property
    def total_pages(self) -> int:
        return max(1, math.ceil(self.total_items / self.page_size)) if self.total_items else 1

    @property
    def has_next_page(self) -> bool:
        return self.page < self.total_pages

    @property
    def has_previous_page(self) -> bool:
        return self.page > 1


def paginate[T](items: Sequence[T], *, page: int, page_size: int) -> Page[T]:
    if page < 1 or page_size < 1:
        raise ValueError("page and page_size must be >= 1")
    start = (page - 1) * page_size
    return Page(
        items=tuple(items[start : start + page_size]),
        page=page,
        page_size=page_size,
        total_items=len(items),
    )
