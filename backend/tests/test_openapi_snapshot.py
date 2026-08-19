"""The frontend validates its mocks against the committed OpenAPI document; keep it fresh."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from export_openapi import OUTPUT, render  # noqa: E402


def test_committed_openapi_matches_app() -> None:
    assert OUTPUT.exists(), "run `make contract` (backend/scripts/export_openapi.py)"
    assert OUTPUT.read_text(encoding="utf-8") == render(), (
        "frontend/src/test/openapi.json is stale: run `make contract` and commit the result"
    )
