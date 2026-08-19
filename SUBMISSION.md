# Submission — Fullstack Developer Coding Assessment

Repository layout, run instructions and the full design write-up are in [README.md](README.md). This note is the short map from the brief to the code, plus what was deliberately decided and what is out of scope.

## Run

```bash
cd backend  && uv sync && uv run uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
cd frontend && pnpm install && pnpm dev                                        # http://localhost:5173
# or: make dev   |   docker compose up --build  (SPA :8080 → nginx → API :8000)
```

Tests / gates: `cd backend && uv run pytest && uv run ruff check .` · `cd frontend && pnpm test && pnpm typecheck && pnpm lint && pnpm build`.

## Brief → implementation

| Brief | Where |
|---|---|
| Form (prompt + language dropdown), schema validation, submit disabled until valid | `frontend/src/features/prompt/PromptForm.tsx`, `promptSchema.ts` (zod) |
| POST on submit; request + response in global state | `services/api/promptsApi.ts`; `features/prompt/promptSlice.ts` (history incl. rejected exchanges, `contextId`, one discriminated `outcome`) |
| SUCCESS / NEEDS_CLARIFICATION / 4xx handling | `features/prompt/PromptOutcome.tsx` |
| List + backend pagination metadata, Load more | `services/api/insightsApi.ts` (RTK infinite query; `hasNextPage` from BFF), `features/insights/InsightsPanel.tsx`, `LoadMoreBar.tsx` |
| Client-side search (text + metadata), debounced; sort A–Z/Z–A by title/content | `lib/insightFilters.ts`, `features/insights/InsightsToolbar.tsx` (300 ms), `insightsViewSlice.ts` |
| RTK Query caching/loading/error; no needless re-renders; memoisation; API/UI/state separation | `services/api/**` vs `features/**` vs `components/ui/**`; `memo` on list/card/toolbar/load-more; `useMemo` derivation; POST seeds the page cache (no page-1 refetch) |
| BFF POST with `prompt`/`targetLanguage`/`contextId`; strict validation; structured 4xx | `backend/app/api/routes/prompts.py`, `schemas.py` (`extra="forbid"`), `errors.py` (one envelope for all non-2xx, incl. framework 404/405, 413) |
| <5 chars / lacks context → NEEDS_CLARIFICATION before any AI call | `domain/gatekeeper.py`, `services/prompt_service.py` (spy-tested: AI never invoked) |
| Pagination when > 10 | `domain/pagination.py`; page size 10 default / 50 max from `config.py` |
| Dummy data, no LLM | `data/insights.json` (48 items × en/es/fr/de), `services/ai_service.py` (`AIService` protocol, deterministic `DummyAIService`) |

Beyond the brief: full UI localization driven by the target language (`frontend/src/i18n/`), localized content/clarification copy from the BFF, conversation history with re-open, hardening (body-size cap, bounded stores, security headers, non-root containers), FE–BE contract check (`make contract`), Docker compose.

## Deliberate decisions (see README "Decisions")

- Pagination in the BE; search/sort in the FE over the loaded set ("Load more"), with the count line stating loaded vs total.
- `NEEDS_CLARIFICATION` is HTTP 200 (valid business outcome); `400 INVALID_LANGUAGE` for any unsupported code; `422 VALIDATION_ERROR` for malformed bodies.
- zod validates shape; the BFF decides meaning (length/context) so the rules cannot drift.
- TypeScript rather than plain JavaScript — RTK Query's value is largely its inferred types.
- Single-word prompts still get a clarification request (`INSIGHTS_MIN_PROMPT_WORDS=2`, env-tunable).

## Known limitations / out of scope

- Request store is in-memory (TTL 30 min, LRU 1000): `requestId`s do not survive a restart (the UI surfaces `REQUEST_NOT_FOUND` with retry). Redis/SQL fits behind the existing `RequestStore` protocol.
- No auth / rate limiting; `requestId` (UUIDv4) is the only handle to a result.
- Dummy AI ranks by keyword overlap; "translation" is pre-authored content per language.
- No browser E2E suite (manual smoke documented in README); unit/integration coverage: backend 49, frontend 45.
