# Stress & chaos testing

Machine: Apple Silicon, 12 cores, macOS; `uvicorn` dev server, no reverse proxy, loopback. Numbers are relative, not a capacity plan.

## Tools

- `backend/scripts/stress.py` — asyncio/httpx scenario generator: realistic mix (60 % prompt + "load more" pages, 20 % clarification, 15 % 4xx, 5 % oversized), `flood` (unique prompt + unique `contextId` every call), `pages`. Reports p50/p95/p99 per scenario, status codes, transport errors and the server's RSS. `make stress`.
- `oha` (Rust) for raw per-endpoint throughput — the Python generator tops out around 600 req/s and was the bottleneck once the server was fixed.
- Fault injection: `ChaosMiddleware` (`app/chaos.py`), enabled only via `INSIGHTS_CHAOS_ERROR_RATE` / `INSIGHTS_CHAOS_DROP_RATE` / `INSIGHTS_CHAOS_LATENCY_MS` (+ `INSIGHTS_CHAOS_SEED`). Off by default; `/health` and docs exempt. `make chaos` starts one on :8002.
- `backend/tests/test_fuzz.py` — ~60 hostile bodies/params/paths/methods + 300 seeded random bodies: never a 5xx, always the error envelope. `backend/tests/test_chaos.py` — middleware behaviour. `frontend/src/services/api/resilience.test.ts` — retry/timeout classification.

## Stress results

### Finding 1 — CPU hot path (fixed)

First run, single worker, realistic mix:

| concurrency | req/s | POST p50 | p95 | p99 |
|---|---|---|---|---|
| 8 | 628 | 12 ms | 23 ms | 30 ms |
| 64 | **172** | 269 ms | 1.05 s | 1.6 s |
| 200 | **120** | 915 ms | 5.2 s | 6.2 s (+78 connect errors) |

Throughput *fell* with concurrency — the GIL-thrash signature of CPU-bound work in the sync-endpoint threadpool. `cProfile` showed `Insight.search_terms()` re-tokenising every insight's four-language text on **every request** (9,600 calls / 7.3 M char iterations per 200 requests) plus an O(terms) prefix scan per keyword. Fix: build the term set and a prefix index once at catalogue load (`Insight.indexed()`, `Insight.matches()` is O(1)). Per-request cost 3.76 → 1.02 ms in-process.

After the fix (same generator, same machine):

| concurrency | req/s | POST p50 | p95 | p99 | RSS |
|---|---|---|---|---|---|
| 64 | **571** | 73 ms | 337 ms | 634 ms | 82 → 94 MB |
| 200 | **396** | 304 ms | 1.46 s | 3.9 s | 94 → 98 MB, 0 connect errors |
| flood 10 k unique prompts + contexts, c64 | 540 | 70 ms | 362 ms | 785 ms | flat 97 MB |

Memory is bounded: 10 k unique prompts/contexts never push RSS past ~97 MB (request store LRU 1000 + TTL, turn counters LRU-capped).

### Raw capacity (`oha`, 64 connections, 15 s each)

| endpoint | 1 worker | 4 workers |
|---|---|---|
| `POST /prompts` success (fixed prompt, es) | 2,314 req/s · p50 26.5 ms · p99 43 ms | 7,689 req/s · p50 7.8 ms · p99 20 ms |
| `POST /prompts` clarification | 5,791 req/s · p50 10 ms | 14,644 req/s · p50 5.9 ms |
| `GET /prompts/{id}/insights?page=2` | 4,669 req/s · p50 12.5 ms | — (see finding 2) |
| `POST /prompts` 422 | 8,775 req/s · p50 6.3 ms | — |
| `GET /languages` | 6,647 req/s · p50 8.7 ms | 20,931 req/s · p50 2.9 ms |

Scales ~3.3× with 4 workers. `errs=64` per run is `oha` closing its 64 in-flight connections at the deadline, not server errors.

### Finding 2 — the in-memory store does not survive `--workers N`

With 4 uvicorn workers, 25–64 % of `GET …/insights` page fetches returned `404 REQUEST_NOT_FOUND`: each worker has its own request store, so a page request routed to a different process cannot find the `requestId`. Single-process it is correct; multi-process needs the `RequestStore` protocol implemented on Redis/SQL (or sticky routing). Documented in README as the first "next" item — this run is the proof.

Also observed: `kern.ipc.somaxconn=128` on macOS causes connection refusals at very high concurrency before the fix made requests fast enough to drain the backlog.

## Chaos results

### Load under injected failures

`INSIGHTS_CHAOS_ERROR_RATE=0.2 INSIGHTS_CHAOS_DROP_RATE=0.05 INSIGHTS_CHAOS_LATENCY_MS=150`, realistic mix, c32, 20 s: 4,105 requests, 202 req/s, every scenario ~20 % `503 {"error":"CHAOS_INJECTED"}` + ~5 % bare `500` (dropped connections) + 150 ms added latency (p50 153 ms); `/health` unaffected; server alive afterwards; RSS bounded. No unhandled exception other than the intentional `ChaosInjectedError`.

### Browser, BFF in chaos mode (Vite proxy → :8002)

| scenario | behaviour |
|---|---|
| Submit hits injected 503 | Alert "Injected failure (chaos testing) (CHAOS_INJECTED, HTTP 503)" + Reset; the POST is **never auto-retried** (a retry would start a new turn); resubmitting works |
| Languages call hits 503s | Query retried transparently (2× exponential backoff) → dropdown populated; if all fail, fallback list + hint |
| "Load more" hits 503 | Page fetch retried transparently; on exhaustion an inline "Could not load more" alert while loaded results stay |
| BFF killed mid-session | Vite proxy answers 502 → alert "The server is temporarily unavailable; please retry (SERVER_UNAVAILABLE, HTTP 502)" |
| BFF restarted (store wiped), re-open an old answer after client cache lapses | `REQUEST_NOT_FOUND` → "This answer has expired; please ask again" with Retry |
| Hung upstream | `fetchBaseQuery` timeout (`VITE_API_TIMEOUT_MS`, 15 s) → `TIMEOUT` instead of an endless spinner |

Client hardening added as a result: request timeout; transient-failure retry (network, timeout, 502/503/504) for queries only; `SERVER_UNAVAILABLE` mapping for plain/HTML gateway errors; localized titles for both.

## Reproduce

```bash
make stress                      # realistic mix, c64, 30 s against :8000
make chaos                       # chaos BFF on :8002 (503 20 % / drop 5 % / +150 ms)
cd backend && uv run python scripts/stress.py --base http://localhost:8002 --server-pattern "port 8002" --concurrency 32 --duration 20
cd backend && uv run python scripts/stress.py --mix flood --requests 10000 --concurrency 64
oha -z 15s -c 64 -m POST -H 'content-type: application/json' -d '{"prompt":"soybean crush margins in brazil","targetLanguage":"es"}' http://localhost:8000/api/v1/prompts
VITE_PROXY_TARGET=http://localhost:8002 pnpm dev   # drive the UI against the chaos BFF
```
