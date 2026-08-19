import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(request_ttl_seconds=60, default_page_size=10)


@pytest.fixture
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings))


def submit(client: TestClient, **overrides):
    body = {"prompt": "soybean crush margins outlook in brazil", "targetLanguage": "en"}
    body.update(overrides)
    return client.post("/api/v1/prompts", json=body)
