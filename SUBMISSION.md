# Submission

Design, API, architecture and decisions: [README.md](README.md). Load/fault testing: [docs/stress-and-chaos.md](docs/stress-and-chaos.md).

## Run

```bash
cd backend  && uv sync && uv run uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
cd frontend && pnpm install && pnpm dev                                        # http://localhost:5173
# or: make dev  |  docker compose up --build  (SPA :8080, API :8000)
```

Tests: `cd backend && uv run pytest && uv run ruff check .` · `cd frontend && pnpm test && pnpm typecheck && pnpm lint && pnpm build`.

## Brief → code

| Brief | Where |
|---|---|
| Form (prompt + language), schema validation, submit disabled until valid | `frontend/src/features/prompt/PromptForm.tsx`, `promptSchema.ts` |
| POST on submit; request + response in global state | `services/api/promptsApi.ts`; `features/prompt/promptSlice.ts` |
| SUCCESS / NEEDS_CLARIFICATION / 4xx handling | `features/prompt/PromptOutcome.tsx` |
| List, backend pagination metadata, Load more | `services/api/insightsApi.ts`, `features/insights/InsightsPanel.tsx`, `LoadMoreBar.tsx` |
| Debounced client-side search (text + metadata), sort A–Z/Z–A by title/content | `lib/insightFilters.ts`, `features/insights/InsightsToolbar.tsx`, `insightsViewSlice.ts` |
| RTK Query caching/loading/error; memoisation; API/UI/state separation | `services/api/**` vs `features/**` vs `components/ui/**` |
| BFF POST, strict validation, structured 4xx | `backend/app/api/routes/prompts.py`, `schemas.py`, `errors.py` |
| Short / context-less prompt → NEEDS_CLARIFICATION before any AI call | `domain/gatekeeper.py`, `services/prompt_service.py` |
| Pagination when > 10 | `domain/pagination.py`, `config.py` |
| Dummy data, no LLM | `data/insights.json`, `services/ai_service.py` |

Also: UI and content localized by target language, history with re-open, hardening, contract check, stress/chaos testing, Docker compose.

## Decisions

Pagination in the BE, search/sort in the FE over loaded pages; `NEEDS_CLARIFICATION` as 200; zod for shape and the BFF for meaning; TypeScript; single-word prompts ask for clarification (env-tunable). Details in README.

## Limitations

- Request store is in-memory (TTL 30 min, LRU 1000): ids do not survive a restart and are per-process under `--workers N`. Redis/SQL fits behind `RequestStore`.
- No auth or rate limiting.
- Dummy AI: keyword ranking, pre-authored translations.
- No browser E2E suite; backend 109 / frontend 51 unit and integration tests.
