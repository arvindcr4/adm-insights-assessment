"""Export the OpenAPI document for the frontend contract test (`make contract`).
Committed; tests/test_openapi_snapshot.py fails when stale."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from app.main import create_app

OUTPUT = Path(__file__).resolve().parents[2] / "frontend" / "src" / "test" / "openapi.json"


def render() -> str:
    return json.dumps(create_app().openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    OUTPUT.write_text(render(), encoding="utf-8")
    sys.stdout.write(f"wrote {OUTPUT}\n")
