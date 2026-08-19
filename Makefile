.PHONY: backend frontend test lint dev contract stress chaos e2e

backend:            ## run the BFF on :8000
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:           ## run the SPA on :5173 (proxies /api to :8000)
	cd frontend && pnpm dev

test:               ## run both test suites
	cd backend && uv run pytest
	cd frontend && pnpm test

e2e:                ## Playwright end-to-end (starts its own servers on :8011/:5174)
	cd frontend && pnpm test:e2e

lint:               ## lint + typecheck both
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && pnpm lint && pnpm typecheck && pnpm format:check

dev:                ## both servers in one terminal
	$(MAKE) -j2 backend frontend

contract:           ## re-export the BFF OpenAPI doc the frontend contract test validates against
	cd backend && uv run python scripts/export_openapi.py

stress:             ## scenario load test against :8000 (see docs/stress-and-chaos.md)
	cd backend && uv run python scripts/stress.py --concurrency 64 --duration 30

chaos:              ## BFF on :8002 with fault injection (503 20%, drops 5%, +150ms)
	cd backend && INSIGHTS_CHAOS_ERROR_RATE=0.2 INSIGHTS_CHAOS_DROP_RATE=0.05 INSIGHTS_CHAOS_LATENCY_MS=150 \
		uv run uvicorn app.main:app --port 8002
