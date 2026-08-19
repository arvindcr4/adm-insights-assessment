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

Try prompts such as `soybean crush margins in brazil` (19 results → 2 pages), `wheat exports black sea`, `hi` or `do something` (clarification), or send `targetLanguage: "xx"` through the API to see the structured 4xx.

## What the system does

1. The form validates shape (zod) and disables submit until valid.
2. `POST /api/v1/prompts` — the BFF validates strictly, then a **gatekeeper** decides whether the prompt is answerable *before any downstream call*:
   - too short (< 5 chars) / a single word / only filler words (“do something”, “what is it?”) / vague → `200 {status: "NEEDS_CLARIFICATION", message, reasons, suggestions, contextId, turn}` — the AI service is never invoked (covered by a spy test). Thresholds are `INSIGHTS_MIN_PROMPT_LENGTH` / `INSIGHTS_MIN_PROMPT_WORDS`.
   - otherwise it calls the `AIService` seam (a deterministic dummy ranked by keyword overlap), stores the full result under a `requestId`, and returns `{status: "SUCCESS", ...page 1, pagination, meta}`.
3. Pages 2..n are read via `GET /api/v1/prompts/{requestId}/insights?page=&pageSize=`; the client accumulates pages ("Load more") and searches/sorts the loaded set locally.
4. Errors are always `{error, message, details?}` — `422 VALIDATION_ERROR` (missing/empty/over-long prompt, bad UUID, unknown fields, bad `pageSize`), `400 INVALID_LANGUAGE` (any code not in the supported set), `404 REQUEST_NOT_FOUND`, `413 PAYLOAD_TOO_LARGE`, `500 INTERNAL_ERROR`; framework 404/405 use the same envelope.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/prompts` | Submit `{prompt, targetLanguage, contextId?}` → SUCCESS (page 1) or NEEDS_CLARIFICATION |
| `GET` | `/api/v1/prompts/{requestId}/insights?page=1&pageSize=10` | One page of insights + pagination metadata |
| `GET` | `/api/v1/prompts/{requestId}?page=&pageSize=` | Re-read a full answer envelope (for deep-links / other clients; the SPA does not need it) |
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

- `create_app(settings, ai_service=...)` lets tests inject a spy AI service and custom settings; routes read nothing at import time (page-size default/max are enforced in the service from injected settings — tested).
- Language support, gatekeeper thresholds, page-size bounds, body-size cap and TTL live in `Settings` (`INSIGHTS_*` env). The 2000-char prompt cap is a wire-contract constant in `schemas.py`.
- `PromptService` depends on the `RequestStore` protocol only (`save/get/next_turn`); the in-memory implementation owns TTL/eviction internally, so Redis/SQL can replace it without touching the service.
- `BodySizeLimitMiddleware` (pure ASGI) rejects bodies over `max_body_bytes` before parsing — pydantic `max_length` alone would not protect memory.

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
- **`promptSlice`** stores every request/response pair (`history`, including rejected 4xx/network exchanges), the conversation `contextId`, and a single discriminated `outcome` — populated by matchers on the mutation's fulfilled/rejected actions, so components never copy API results around. Clicking a history row re-opens that exchange; successful answers render straight from the RTK Query cache.
- **`insightsViewSlice`** holds the debounced search term and sort settings.

## Localization

The selected target language drives the whole experience, not just the answer:

- **UI copy** — `frontend/src/i18n/`: a dependency-free, typed dictionary per locale (`en` is the source of truth; `es`/`fr`/`de` are typed against it, so a missing key is a compile error, and a test asserts identical key sets). `useT()` / `translate()` handle `{param}` interpolation and `Intl.PluralRules` plurals. `localeSlice` holds the UI locale; the form's `targetLanguage` field dispatches `localeChanged`. `<html lang>`, the document title, zod validation messages, error titles (by error code) and `Intl` date/percent/collation all follow it.
- **Content** — each catalogue entry carries en/es/fr/de title, content and category; the BFF returns the rendition for `targetLanguage` (tags/source stay machine identifiers). Keyword matching spans all four languages, so prompts written in Spanish/French/German match.
- **BFF copy** — clarification `message` and `suggestions` are localized by `targetLanguage`; `reasons` and `error` codes stay machine-readable so clients can map them (the SPA does, for error titles).

## Decisions worth calling out

- **Pagination in the BE, search/sort in the FE.** The backend owns slicing and metadata (the result set can be large, and the client should not need all of it). The UI uses "Load more" so client-side search/sort work over everything loaded so far and the count line says "showing X of Y loaded · Z total" to keep that honest. If global search were required, `q`/`sort` would move to the page endpoint — the `lib/` functions are already pure and would be replaced by query params, not rewritten.
- **No page-1 double fetch.** The POST already returns page 1, so `onQueryStarted` seeds the infinite-query cache with `upsertQueryData`; "Load more" starts at page 2. A test asserts no `GET …/insights` happens before Load more.
- **Render budget.** Raw search input is local state; only the debounced value hits the store. `InsightList`/`InsightCard`/`InsightsToolbar`/`LoadMoreBar` are `memo`ised; the visible list is derived with `useMemo` from `(loaded pages, term, sort)`; `filterInsights` returns the same array for an empty term so nothing re-renders needlessly.
- **`NEEDS_CLARIFICATION` is a 200.** It is a valid business outcome, not a client error, and the UI treats it as a distinct state from 4xx. Unsupported language is a `400 INVALID_LANGUAGE` (semantic); malformed bodies are `422 VALIDATION_ERROR` with per-field details.
- **Schema split.** zod validates shape (required, max length, supported language); the BFF decides *meaning* (length/context). Duplicating the 5-char rule in the UI would make the two drift.
- **TypeScript** rather than plain JS: RTK Query's value is largely its inferred types, and the brief emphasises a scalable codebase.
- **Conversation tracking.** `contextId` is generated by the BFF on first contact, echoed on clarification, and carried by the client on follow-ups; every submission (including clarifications) increments the context's `turn`.
- **Dummy AI.** `DummyAIService` ranks the 48-item catalogue by keyword overlap (across all four languages, so a Spanish prompt matches too) and falls back to a deterministic (hash-seeded) sample, so the same prompt always gives the same, stable-to-paginate answer. Each catalogue entry carries pre-authored en/es/fr/de renditions; `localized(targetLanguage)` returns the right one and tags `language` honestly (source language if a rendition were missing). That is the stand-in for an LLM translating.

## Tests

- Backend (49): gatekeeper rules, pagination maths, API validation/4xx envelopes (incl. framework 404/405), clarification short-circuit (spy AI), page navigation/disjointness, injected page-size bounds, body-size guard (declared and chunked), store TTL/LRU eviction, turn counting, determinism, localized content/categories/clarification copy, multilingual matching.
- Frontend (45): pure filter/sort, debounce hook, error normalisation, slice matchers (success/clarification/error/network, history incl. rejected, re-open), form validity gating, language loading + fallback on failure, SUCCESS/clarification/4xx/422 rendering, no page-1 refetch + load more, load-more failure, debounced search across pages, sort toggles, first-page fetch error with retry, search reset on new answer, i18n (key parity across locales, plurals, whole-UI switch incl. validation messages and result chrome).

### Contract check

`make contract` exports the BFF's OpenAPI document to `frontend/src/test/openapi.json`. `backend/tests/test_openapi_snapshot.py` fails when that file is stale; `frontend/src/test/contract.test.ts` validates every mock the UI tests rely on (and, transitively, the TS wire types they are typed against) with Ajv against those schemas. A field renamed on either side breaks one of the two.

## Hardening

Body-size cap (413, before parsing), bounded `page`/`pageSize`, LRU+TTL caps on both request and turn stores, structured error envelope for every non-2xx (no stack traces leak), CORS allow-list without credentials, nginx security headers (`nosniff`, `X-Frame-Options`, CSP, `Referrer-Policy`) + `client_max_body_size`, non-root containers (`appuser` / `nginx-unprivileged`), backend healthcheck gating the frontend in compose. No auth by design; `requestId` (UUIDv4) is the only handle to a result.

## Not done / next

- Persist the request store (Redis/SQLite) so `requestId`s survive restarts; a DB-backed catalogue.
- Server-side `q`/`sort` and virtualised list for very large result sets.
- Auth/rate limiting and request-id logging on the BFF.
