import pytest

from app.domain.pagination import paginate


def test_slices_and_metadata() -> None:
    page = paginate(list(range(23)), page=2, page_size=10)
    assert page.items == tuple(range(10, 20))
    assert (page.total_items, page.total_pages) == (23, 3)
    assert page.has_next_page and page.has_previous_page


def test_last_page_and_empty() -> None:
    last = paginate(list(range(23)), page=3, page_size=10)
    assert last.items == (20, 21, 22)
    assert not last.has_next_page
    empty = paginate([], page=1, page_size=10)
    assert empty.total_pages == 1 and not empty.has_next_page


def test_rejects_bad_bounds() -> None:
    with pytest.raises(ValueError):
        paginate([1], page=0, page_size=10)
