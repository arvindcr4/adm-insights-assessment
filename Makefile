.PHONY: backend frontend test lint dev

backend:            ## run the BFF on :8000
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:           ## run the SPA on :5173 (proxies /api to :8000)
	cd frontend && pnpm dev

test:               ## run both test suites
	cd backend && uv run pytest
	cd frontend && pnpm test

lint:               ## lint + typecheck both
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && pnpm lint && pnpm typecheck && pnpm format:check

dev:                ## both servers in one terminal
	$(MAKE) -j2 backend frontend
