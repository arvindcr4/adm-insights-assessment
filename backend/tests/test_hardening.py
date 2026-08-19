from uuid import uuid4

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.repositories.request_store import InMemoryRequestStore
from tests.conftest import submit


def test_oversized_body_is_rejected_before_parsing() -> None:
    client = TestClient(create_app(Settings(max_body_bytes=1024)))
    r = client.post("/api/v1/prompts", json={"prompt": "x" * 5000, "targetLanguage": "en"})
    assert r.status_code == 413
    assert r.json()["error"] == "PAYLOAD_TOO_LARGE"


def test_chunked_oversized_body_is_rejected() -> None:
    client = TestClient(create_app(Settings(max_body_bytes=1024)))

    def gen():
        yield b'{"prompt": "'
        yield b"y" * 5000
        yield b'", "targetLanguage": "en"}'

    r = client.post("/api/v1/prompts", content=gen(), headers={"content-type": "application/json"})
    assert r.status_code == 413


def test_normal_body_passes_the_guard(client: TestClient) -> None:
    assert submit(client).status_code == 200


def test_turn_counters_are_capped() -> None:
    store = InMemoryRequestStore(ttl_seconds=60, max_entries=3)
    ids = [uuid4() for _ in range(5)]
    for cid in ids:
        store.next_turn(cid)
    # The two oldest contexts were evicted; asking again restarts their counter at 1.
    assert store.next_turn(ids[0]) == 1
    assert store.next_turn(ids[4]) == 2


def test_page_upper_bound(client: TestClient) -> None:
    rid = submit(client).json()["requestId"]
    r = client.get(f"/api/v1/prompts/{rid}/insights", params={"page": 10_001})
    assert r.status_code == 422
