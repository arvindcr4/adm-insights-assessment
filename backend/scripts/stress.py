"""Scenario load generator (asyncio + httpx): mixed traffic, latency percentiles per scenario,
status counts, server RSS samples.

  uv run python scripts/stress.py --concurrency 64 --duration 30
  uv run python scripts/stress.py --mix flood --requests 10000     # unique prompt + contextId
"""

from __future__ import annotations

import argparse
import asyncio
import random
import subprocess
import sys
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field

import httpx

WORDS = (  # noqa: SIM905 - readable word list
    "soybean corn wheat canola palm sugar cocoa ethanol biodiesel crush margins basis freight "
    "brazil argentina china india europe kansas illinois midwest gulf exports imports tariffs "
    "harvest yields weather drought rain monsoon demand supply stocks prices futures funds "
    "protein feed aquafeed probiotics sweetener flavour logistics barge rail container canal"
).split()
LANGS = ("en", "es", "fr", "de")


@dataclass
class Stats:
    latencies: dict[str, list[float]] = field(default_factory=lambda: defaultdict(list))
    statuses: dict[str, dict[int, int]] = field(
        default_factory=lambda: defaultdict(lambda: defaultdict(int))
    )
    errors: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    rss_samples: list[int] = field(default_factory=list)

    def record(self, scenario: str, status: int, seconds: float) -> None:
        self.latencies[scenario].append(seconds * 1000)
        self.statuses[scenario][status] += 1


def unique_prompt(rng: random.Random) -> str:
    n = rng.randint(3, 9)
    return " ".join(rng.choice(WORDS) for _ in range(n)) + f" {uuid.uuid4().hex[:6]}"


async def scenario_success_and_pages(
    client: httpx.AsyncClient, stats: Stats, rng: random.Random
) -> None:
    body = {"prompt": unique_prompt(rng), "targetLanguage": rng.choice(LANGS)}
    t0 = time.perf_counter()
    try:
        r = await client.post("/api/v1/prompts", json=body)
    except httpx.HTTPError as e:
        stats.errors[f"post:{type(e).__name__}"] += 1
        return
    stats.record("POST /prompts (success)", r.status_code, time.perf_counter() - t0)
    if r.status_code != 200:
        return
    data = r.json()
    if data.get("status") != "SUCCESS":
        return
    pages = data["pagination"]["totalPages"]
    for page in range(2, min(pages, 4) + 1):  # "load more" up to 3 extra pages
        t1 = time.perf_counter()
        try:
            rp = await client.get(
                f"/api/v1/prompts/{data['requestId']}/insights",
                params={"page": page, "pageSize": 10},
            )
        except httpx.HTTPError as e:
            stats.errors[f"page:{type(e).__name__}"] += 1
            return
        stats.record("GET /prompts/{id}/insights", rp.status_code, time.perf_counter() - t1)


async def scenario_clarification(
    client: httpx.AsyncClient, stats: Stats, rng: random.Random
) -> None:
    body = {
        "prompt": rng.choice(["hi", "help", "what is it?", "do something", "soy"]),
        "targetLanguage": rng.choice(LANGS),
    }
    t0 = time.perf_counter()
    try:
        r = await client.post("/api/v1/prompts", json=body)
    except httpx.HTTPError as e:
        stats.errors[f"clar:{type(e).__name__}"] += 1
        return
    stats.record("POST /prompts (clarification)", r.status_code, time.perf_counter() - t0)


async def scenario_invalid(client: httpx.AsyncClient, stats: Stats, rng: random.Random) -> None:
    bodies = [
        {"targetLanguage": "en"},
        {"prompt": "   ", "targetLanguage": "en"},
        {"prompt": "corn yields illinois", "targetLanguage": "xx"},
        {"prompt": "corn yields illinois", "targetLanguage": "en", "contextId": "nope"},
        {"prompt": "corn yields illinois", "targetLanguage": "en", "extra": 1},
    ]
    t0 = time.perf_counter()
    try:
        r = await client.post("/api/v1/prompts", json=rng.choice(bodies))
    except httpx.HTTPError as e:
        stats.errors[f"invalid:{type(e).__name__}"] += 1
        return
    stats.record("POST /prompts (4xx)", r.status_code, time.perf_counter() - t0)


async def scenario_oversized(client: httpx.AsyncClient, stats: Stats, rng: random.Random) -> None:
    body = {"prompt": "x" * 200_000, "targetLanguage": "en"}
    t0 = time.perf_counter()
    try:
        r = await client.post("/api/v1/prompts", json=body)
    except httpx.HTTPError as e:
        stats.errors[f"big:{type(e).__name__}"] += 1
        return
    stats.record("POST /prompts (413 oversized)", r.status_code, time.perf_counter() - t0)


async def scenario_flood(client: httpx.AsyncClient, stats: Stats, rng: random.Random) -> None:
    body = {"prompt": unique_prompt(rng), "targetLanguage": "en", "contextId": str(uuid.uuid4())}
    t0 = time.perf_counter()
    try:
        r = await client.post("/api/v1/prompts", json=body)
    except httpx.HTTPError as e:
        stats.errors[f"flood:{type(e).__name__}"] += 1
        return
    stats.record("POST /prompts (flood, unique ctx)", r.status_code, time.perf_counter() - t0)


MIXES = {
    # weights: realistic front-end traffic
    "realistic": [
        (scenario_success_and_pages, 60),
        (scenario_clarification, 20),
        (scenario_invalid, 15),
        (scenario_oversized, 5),
    ],
    "flood": [(scenario_flood, 100)],
    "pages": [(scenario_success_and_pages, 100)],
}


def server_rss_kb(pattern: str) -> int | None:
    try:
        pids = subprocess.run(
            ["pgrep", "-f", pattern], capture_output=True, text=True
        ).stdout.split()
        if not pids:
            return None
        out = subprocess.run(
            ["ps", "-o", "rss=", "-p", ",".join(pids)], capture_output=True, text=True
        ).stdout
        return sum(int(x) for x in out.split())
    except Exception:  # noqa: BLE001 - best-effort sampling
        return None


async def sampler(stats: Stats, pattern: str, stop: asyncio.Event) -> None:
    while not stop.is_set():
        rss = server_rss_kb(pattern)
        if rss:
            stats.rss_samples.append(rss)
        await asyncio.sleep(1)


async def worker(client, stats, mix, rng, deadline, counter, max_requests):
    scenarios, weights = zip(*mix, strict=True)
    while True:
        if max_requests is not None:
            if counter[0] >= max_requests:
                return
            counter[0] += 1
        elif time.perf_counter() >= deadline:
            return
        fn = rng.choices(scenarios, weights=weights)[0]
        await fn(client, stats, rng)


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    k = (len(values) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(values) - 1)
    return sorted(values)[lo] + (sorted(values)[hi] - sorted(values)[lo]) * (k - lo)


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--concurrency", type=int, default=64)
    ap.add_argument("--duration", type=float, default=30, help="seconds (ignored if --requests)")
    ap.add_argument("--requests", type=int, default=None, help="stop after N scenario runs")
    ap.add_argument("--mix", choices=MIXES, default="realistic")
    ap.add_argument(
        "--server-pattern", default="uvicorn app.main:app", help="pgrep pattern for RSS sampling"
    )
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args()

    stats = Stats()
    stop = asyncio.Event()
    rss_before = server_rss_kb(args.server_pattern)
    limits = httpx.Limits(
        max_connections=args.concurrency, max_keepalive_connections=args.concurrency
    )
    async with httpx.AsyncClient(base_url=args.base, limits=limits, timeout=30) as client:
        deadline = time.perf_counter() + args.duration
        counter = [0]
        t0 = time.perf_counter()
        samp = asyncio.create_task(sampler(stats, args.server_pattern, stop))
        await asyncio.gather(
            *(
                worker(
                    client,
                    stats,
                    MIXES[args.mix],
                    random.Random(args.seed + i),
                    deadline,
                    counter,
                    args.requests,
                )
                for i in range(args.concurrency)
            )
        )
        elapsed = time.perf_counter() - t0
        stop.set()
        await samp
    rss_after = server_rss_kb(args.server_pattern)

    total = sum(len(v) for v in stats.latencies.values())
    print(
        f"\n== {args.mix} mix · concurrency {args.concurrency} · {elapsed:.1f}s "
        f"· {total} requests · {total / elapsed:.0f} req/s"
    )
    print(f"{'scenario':36} {'n':>6} {'p50':>7} {'p95':>7} {'p99':>7} {'max':>7}  statuses")
    for name, lat in sorted(stats.latencies.items()):
        st = ", ".join(f"{k}×{v}" for k, v in sorted(stats.statuses[name].items()))
        print(
            f"{name:36} {len(lat):6d} {pct(lat, 50):6.1f}ms {pct(lat, 95):6.1f}ms "
            f"{pct(lat, 99):6.1f}ms {max(lat):6.1f}ms  {st}"
        )
    if stats.errors:
        print("transport errors:", dict(stats.errors))
    if rss_before and rss_after:
        peak = max(stats.rss_samples) if stats.rss_samples else rss_after
        print(
            f"server RSS: before {rss_before / 1024:.0f} MB · peak {peak / 1024:.0f} MB "
            f"· after {rss_after / 1024:.0f} MB"
        )
    unexpected = sum(v for name, d in stats.statuses.items() for k, v in d.items() if k >= 500)
    return 1 if unexpected or stats.errors else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
