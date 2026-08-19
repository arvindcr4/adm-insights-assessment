# Insights Console — Fullstack coding assessment

A UI client + middleware API ("BFF") for an AI insights service.

- **`frontend/`** — React 19 + TypeScript, Redux Toolkit / RTK Query, react-hook-form + zod, Vite, Vitest + Testing Library + msw.
- **`backend/`** — Python 3.12, FastAPI + pydantic v2, in-memory stores backed by a local JSON catalogue, pytest.

![screenshot](docs/screenshot.png)

## Run it

```bash
# backend  (http://localhost:8000, OpenAPI at /docs)
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000

# frontend (http://localhost:5173, /api is proxied to :8000)
cd frontend && pnpm install && pnpm dev
```

Or `make dev` from the root, or `docker compose up --build` (SPA on :8080 behind nginx, API on :8000).

Tests / quality gates:

```bash
cd backend  && uv run pytest && uv run ruff check .
cd frontend && pnpm test && pnpm typecheck && pnpm lint
```

Try prompts such as `soybean crush margins in brazil` (24 results → pagination), `wheat exports black sea`, `hi` (clarification), or pick an unsupported language through the API to see the structured 4xx.

## What the system does

1. The form validates shape (zod) and disables submit until valid.
2. `POST /api/v1/prompts` — the BFF validates strictly, then a **gatekeeper** decides whether the prompt is answerable *before any downstream call*:
   - too short / too few words / only filler words / vague → `200 {status: "NEEDS_CLARIFICATION", message, reasons, suggestions}` — the AI service is never invoked (covered by a spy test).
   - otherwise it calls the `AIService` seam (a deterministic dummy ranked by keyword overlap), stores the full result under a `requestId`, and returns `{status: "SUCCESS", ...page 1, pagination, meta}`.
3. Pages 2..n are read via `GET /api/v1/prompts/{requestId}/insights?page=&pageSize=`; the client accumulates pages ("Load more") and searches/sorts the loaded set locally.
4. Errors are always `{error, message, details?}` — `422 VALIDATION_ERROR` (missing/empty prompt, bad UUID, unknown fields), `400 INVALID_LANGUAGE`, `404 REQUEST_NOT_FOUND`, `500 INTERNAL_ERROR`.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/prompts` | Submit `{prompt, targetLanguage, contextId?}` → SUCCESS (page 1) or NEEDS_CLARIFICATION |
| `GET` | `/api/v1/prompts/{requestId}/insights?page=1&pageSize=10` | One page of insights + pagination metadata |
| `GET` | `/api/v1/prompts/{requestId}?page=&pageSize=` | Re-read a full answer envelope (deep-link / refresh) |
| `GET` | `/api/v1/languages` | Supported target languages (drives the dropdown) |
| `GET` | `/api/v1/health` | Liveness |

Pagination metadata: `{page, pageSize, totalItems, totalPages, hasNextPage, hasPreviousPage}` — always present, so ≤10 results is simply `totalPages: 1`.

## Architecture

### Backend (`backend/app`)

```
api/routes/*      thin FastAPI routers (validation + DI only)
schemas.py        wire contracts (camelCase on the wire, snake_case in Python)
errors.py         AppError hierarchy + handlers → one structured error envelope
domain/           framework-free core: models, PromptGatekeeper, paginate()
services/         AIService protocol + DummyAIService; PromptService orchestrates
repositories/     JsonInsightRepository (catalogue), InMemoryRequestStore (TTL + cap)
config.py         pydantic-settings; every threshold is env-tunable (INSIGHTS_*)
main.py           create_app() factory wires settings → repos → services → routes
```

- `create_app(settings, ai_service=...)` lets tests inject a spy AI service and custom settings; no globals.
- Language support, min prompt length, page-size bounds and TTL live in `Settings`, not in code paths.
- The request store is a `Protocol`; swapping in Redis/SQL does not touch the service.

### Frontend (`frontend/src`)

```
app/            store (makeStore factory), typed hooks, App shell, providers
services/api/   RTK Query: baseApi + injected promptsApi / insightsApi / languagesApi,
                wire types, error normalisation — no React here
features/prompt/    PromptForm (zod + RHF), promptSlice (global request/response state),
                    PromptOutcome (idle | success | clarification | error), ConversationHistory
features/insights/  InsightsPanel (data + derivation), InsightsToolbar (debounced search, sort),
                    InsightList / InsightCard (memoised), LoadMoreBar, insightsViewSlice
components/ui/  Button, Field, Alert, Badge, EmptyState — presentational only
lib/            pure filter/sort functions (unit-tested)
hooks/          useDebouncedCallback
```

State management:
- **RTK Query** owns server state: `submitPrompt` (mutation), `getInsightsPages` (infinite query, `getNextPageParam` reads the backend's `hasNextPage`), `getLanguages` (cached ~forever).
- **`promptSlice`** stores the request/response pairs (`history`), the conversation `contextId`, and a single discriminated `outcome` — populated by matchers on the mutation's fulfilled/rejected actions, so components never copy API results around.
- **`insightsViewSlice`** holds the debounced search term and sort settings.

## Decisions worth calling out

- **Pagination in the BE, search/sort in the FE.** The backend owns slicing and metadata (the result set can be large, and the client should not need all of it). The UI uses "Load more" so client-side search/sort work over everything loaded so far and the count line says "showing X of Y loaded · Z total" to keep that honest. If global search were required, `q`/`sort` would move to the page endpoint — the `lib/` functions are already pure and would be replaced by query params, not rewritten.
- **No page-1 double fetch.** The POST already returns page 1, so `onQueryStarted` seeds the infinite-query cache with `upsertQueryData`; "Load more" starts at page 2. A test asserts no `GET …/insights` happens before Load more.
- **Render budget.** Raw search input is local state; only the debounced value hits the store. `InsightList`/`InsightCard`/`InsightsToolbar`/`LoadMoreBar` are `memo`ised; the visible list is derived with `useMemo` from `(loaded pages, term, sort)`; `filterInsights` returns the same array for an empty term so nothing re-renders needlessly.
- **`NEEDS_CLARIFICATION` is a 200.** It is a valid business outcome, not a client error, and the UI treats it as a distinct state from 4xx. Unsupported language is a `400 INVALID_LANGUAGE` (semantic); malformed bodies are `422 VALIDATION_ERROR` with per-field details.
- **Schema split.** zod validates shape (required, max length, supported language); the BFF decides *meaning* (length/context). Duplicating the 5-char rule in the UI would make the two drift.
- **TypeScript** rather than plain JS: RTK Query's value is largely its inferred types, and the brief emphasises a scalable codebase.
- **Conversation tracking.** `contextId` is generated by the BFF on first contact, echoed on clarification, and carried by the client on follow-ups; the BFF counts turns per context.
- **Dummy AI.** `DummyAIService` ranks the 48-item catalogue by keyword overlap and falls back to a deterministic (hash-seeded) sample, so the same prompt always gives the same, stable-to-paginate answer. It does not translate; `language` just echoes the request.

## Tests

- Backend (29): gatekeeper rules, pagination maths, API validation/4xx shapes, clarification short-circuit (spy AI), page navigation/disjointness, 404, determinism, turn counting.
- Frontend (29): pure filter/sort, debounce hook, error normalisation, slice matchers (success/clarification/error/network), form validity gating + language loading, SUCCESS/clarification rendering, no page-1 refetch + load more, debounced search across pages, sort toggles, retryable page-fetch error, search reset on new answer.

## Not done / next

- Persist the request store (Redis/SQLite) so `requestId`s survive restarts; a DB-backed catalogue.
- Server-side `q`/`sort` and virtualised list for very large result sets.
- Auth/rate limiting and request-id logging on the BFF.
