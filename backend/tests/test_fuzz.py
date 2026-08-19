import json
import random
import string

import pytest
from fastapi.testclient import TestClient

from tests.conftest import submit

ENVELOPE_KEYS = {"error", "message"}


def assert_envelope(r) -> None:
    assert r.status_code < 500, r.text[:200]
    if r.status_code >= 400:
        body = r.json()
        assert set(body) >= ENVELOPE_KEYS, body


HOSTILE_BODIES = [
    b"",
    b"not json",
    b"{",
    b"[]",
    b'"string"',
    b"42",
    b"null",
    b"true",
    b'{"prompt": null, "targetLanguage": "en"}',
    b'{"prompt": 123, "targetLanguage": "en"}',
    b'{"prompt": ["a"], "targetLanguage": "en"}',
    b'{"prompt": {"a": 1}, "targetLanguage": "en"}',
    b'{"prompt": "corn yields", "targetLanguage": null}',
    b'{"prompt": "corn yields", "targetLanguage": ["en"]}',
    b'{"prompt": "corn yields", "targetLanguage": "en", "contextId": 123}',
    b'{"prompt": "corn yields", "targetLanguage": "en", "contextId": ""}',
    b'{"prompt": "corn yields", "targetLanguage": "en", "contextId": "0000-zz"}',
    b'{"prompt": "\\u0000\\u0000", "targetLanguage": "en"}',
    json.dumps({"prompt": "\U0001f33d" * 6, "targetLanguage": "en"}).encode(),
    json.dumps(
        {
            "prompt": "\u0645\u0631\u062d\u0628\u0627 \u0627\u0644\u0642\u0645\u062d",
            "targetLanguage": "en",
        }
    ).encode(),
    json.dumps({"prompt": "soja\u202eesrever", "targetLanguage": "en"}).encode(),  # RTL override
    b'{"prompt": "corn yields", "targetLanguage": "EN "}',
    b'{"prompt": "corn yields", "targetLanguage": "en-US"}',
    b'{"prompt": "corn yields", "targetLanguage": "' + b"x" * 100 + b'"}',
    b'{"prompt": "corn yields", "targetLanguage": "en", "__proto__": {"x": 1}}',
    ("{" + '"a":' * 200 + "1" + "}" * 200).encode(),
    json.dumps({"prompt": "x" * 60_000, "targetLanguage": "en"}).encode(),
]


@pytest.mark.parametrize("body", HOSTILE_BODIES, ids=lambda b: b[:24])
def test_hostile_bodies(client: TestClient, body: bytes) -> None:
    r = client.post("/api/v1/prompts", content=body, headers={"content-type": "application/json"})
    assert_envelope(r)


@pytest.mark.parametrize(
    "content_type",
    [
        "text/plain",
        "application/x-www-form-urlencoded",
        "multipart/form-data",
        "",
        "application/xml",
    ],
)
def test_wrong_content_types(client: TestClient, content_type: str) -> None:
    r = client.post(
        "/api/v1/prompts",
        content=b'{"prompt":"corn yields","targetLanguage":"en"}',
        headers={"content-type": content_type} if content_type else {},
    )
    assert_envelope(r)


@pytest.mark.parametrize(
    "params",
    [
        {"page": "abc"},
        {"page": "-1"},
        {"page": "0"},
        {"page": "1.5"},
        {"page": "1e9"},
        {"pageSize": "0"},
        {"pageSize": "99999999999999999999"},
        {"pageSize": "ten"},
        {"page": "1", "pageSize": "10", "extra": "1"},
        {"page": ["1", "2"]},
    ],
)
def test_hostile_query_params(client: TestClient, params: dict) -> None:
    rid = submit(client).json()["requestId"]
    assert_envelope(client.get(f"/api/v1/prompts/{rid}/insights", params=params))


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/prompts/not-a-uuid/insights",
        "/api/v1/prompts/../../etc/passwd",
        "/api/v1/prompts/%00/insights",
        "/api/v1/prompts/" + "a" * 5000 + "/insights",
        "/api/v1/prompts//insights",
    ],
)
def test_hostile_paths(client: TestClient, path: str) -> None:
    assert_envelope(client.get(path))


@pytest.mark.parametrize("method", ["PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
def test_unexpected_methods(client: TestClient, method: str) -> None:
    assert client.request(method, "/api/v1/prompts").status_code < 500


def test_random_fuzz_never_5xx(client: TestClient) -> None:
    rng = random.Random(2026)
    alphabet = string.printable + "\u00e9\u00fc\u20ac\U0001f33d \u202e"
    for _ in range(300):
        if rng.random() < 0.4:
            raw = "".join(rng.choice(alphabet) for _ in range(rng.randint(0, 200)))
            body = raw.encode(errors="ignore")
        else:
            obj = {
                rng.choice(["prompt", "targetLanguage", "contextId", "page", "x"]): rng.choice(
                    [
                        "".join(rng.choice(alphabet) for _ in range(rng.randint(0, 50))),
                        rng.randint(-(10**6), 10**6),
                        None,
                        [],
                        {},
                        True,
                    ]
                )
                for _ in range(rng.randint(0, 4))
            }
            body = json.dumps(obj).encode()
        r = client.post(
            "/api/v1/prompts", content=body, headers={"content-type": "application/json"}
        )
        assert_envelope(r)
