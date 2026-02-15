# Seaq Benchmarks

All numbers in this document come from a single `yarn workspace seaq vitest bench` run. Nothing is estimated or rounded for narrative purposes.

> **Snapshot date:** 2026-02-14
> **Node.js:** v22.13.1 (Apple Silicon)
> **Vitest:** v4.0.16

See [README.md](./README.md) for API documentation.

---

## TL;DR

- **seaq v2 separate** is 44% faster than v1 on 10K contacts (`631 vs 438 ops/s`); joined mode is 15% faster (`505 vs 438 ops/s`).
- On 20K cities, v2 separate is 58-77% faster than v1 depending on query.
- **Cold start** (no pre-built index): seaq is 8.5x faster than Fuse.js, 3.4x faster than MiniSearch, 23x faster than Lunr. uFuzzy is 3.6x faster than seaq.
- **Pre-built index** (repeated search on static data): MiniSearch and Lunr are 2,000-3,000x faster than seaq. This is the expected tradeoff -- seaq does not build an index.
- **Nested data cold start**: seaq is 6-8x faster than both MiniSearch and Fuse.js because it needs no data flattening or index build.
- **includeMatches** adds negligible overhead (under 4%).
- **`limit: 10` vs `.slice(0, 10)`**: effectively identical performance.

---

## Test Environment

- **Datasets:**
  - 23 books from `@seaq/test-data/books.json` (classic Fuse.js test set)
  - 10,000 contacts from `@seaq/test-data/contacts-10k.json` (seeded PRNG, realistic names)
  - 20,000 cities from `@seaq/test-data/cities.json` (real-world US cities)
  - 1K and 5K synthetic nested contacts (generated in `nested-arrays.bench.ts`)
- **Current defaults:** `fuzziness: 0.2`, `fieldMode: 'joined'`, `limit: 10`, `threshold: 0.3`
- **Benchmark settings:** Most benchmarks use `fuzziness: 0` for consistent measurement. The multi-word regression tests use `fuzziness: 0.2` to measure fuzzy overhead. The `realworld.bench.ts` tests use default options (including `fuzziness: 0.2`).

---

## v1 vs v2: 10K Contacts

Query: `"nath fe"`, keys: `['givenName', 'familyName']`, fuzziness: 0.

| Variant | ops/s | mean (ms) | vs v1 |
|---------|------:|----------:|------:|
| v1 (published 1.1.5) | 438 | 2.28 | -- |
| v2 (joined) | 505 | 1.98 | +15% |
| v2 (separate) | 632 | 1.58 | +44% |

Both v2 modes are faster than v1. Separate mode is fastest on this query because the bitmask pre-filter rejects non-matching items before any per-token scoring.

## v1 vs v2: 20K Cities

Keys: `['name', 'state']`, fuzziness: 0.

| Query | v1 (ops/s) | v2 joined (ops/s) | v2 separate (ops/s) | v2 sep vs v1 |
|-------|----------:|-----------------:|-------------------:|-------------:|
| `"san"` | 194 | 263 | 306 | +58% |
| `"new york"` | 205 | 277 | 343 | +67% |
| `"los ang"` | 218 | 275 | 329 | +51% |

Across all three queries, v2 separate is the fastest mode and v2 joined sits in between.

---

## Single Search Performance by Library

These benchmarks include index build time. For seaq and uFuzzy, there is no index to build. For Fuse.js, MiniSearch, and Lunr, index construction happens inside each iteration.

### 23 Books

| Library | ops/s | mean (ms) |
|---------|------:|----------:|
| seaq (separate) | 163,205 | 0.006 |
| seaq (joined) | 155,134 | 0.006 |
| uFuzzy | 151,333 | 0.007 |
| MiniSearch | 39,925 | 0.025 |
| Fuse.js | 37,068 | 0.027 |
| Lunr | 5,112 | 0.196 |

On a tiny dataset, seaq and uFuzzy are neck-and-neck. Index-based libraries pay their build cost every call, making them 4x slower.

### 10K Contacts

| Library | ops/s | mean (ms) |
|---------|------:|----------:|
| uFuzzy | 4,914 | 0.20 |
| seaq (separate) | 649 | 1.54 |
| seaq (joined) | 521 | 1.92 |
| MiniSearch | 93 | 10.79 |
| Fuse.js | 37 | 27.32 |
| Lunr | 34 | 29.82 |

seaq is 5.6x faster than MiniSearch and 8.5x faster than Fuse.js in cold-start scenarios. uFuzzy is ~7.6x faster than seaq but requires pre-flattened string arrays.

### No-Keys Mode (10K items)

When searching without specifying keys, seaq auto-detects searchable fields.

| Mode | ops/s | mean (ms) |
|------|------:|----------:|
| String array (10K pre-joined strings) | 1,567 | 0.64 |
| Object array (10K contacts, all fields) | 163 | 6.14 |

Searching a plain string array is ~9.6x faster than auto-scanning all object fields.

---

## 10 Consecutive Searches

Each iteration builds the index (or not) then searches 10 times. This models a component that re-runs search on every keystroke but keeps its index alive across calls.

### 23 Books

| Library | ops/s |
|---------|------:|
| uFuzzy | 59,294 |
| MiniSearch | 32,127 |
| seaq (joined) | 15,602 |
| Fuse.js | 5,052 |
| Lunr | 5,100 |

### 10K Contacts

| Library | ops/s |
|---------|------:|
| uFuzzy | 496 |
| MiniSearch | 94 |
| seaq (joined) | 51 |
| Lunr | 33 |
| Fuse.js | 4.3 |

seaq is 12x faster than Fuse.js. MiniSearch amortizes its index build well and pulls ahead at this scale.

---

## Pre-Built Index: Search Only (10K Contacts)

For libraries that support it, the index is built once upfront. seaq and uFuzzy re-scan every call (that is how they work). This measures pure search throughput.

| Query | seaq | Fuse.js | uFuzzy | MiniSearch | Lunr |
|-------|-----:|--------:|-------:|-----------:|-----:|
| `"na"` (short) | 410 | 105 | 1,273 | 1,222,614 | 1,076,771 |
| `"nath fe"` (medium) | 327 | 44 | 4,545 | 714,982 | 487,189 |
| `"natasha okeefe"` (long) | 270 | 17 | 5,579 | 673,541 | 426,716 |

All values are ops/s. MiniSearch and Lunr are 2,000-2,500x faster than seaq when the index is pre-built. This is the scenario where seaq should not be used. If your data is large and static, use an indexed library.

### Simulated Typing (7 keystrokes: n -> na -> ... -> natasha)

| Library | ops/s |
|---------|------:|
| MiniSearch | 169,298 |
| Lunr | 119,308 |
| uFuzzy | 444 |
| seaq | 55 |
| Fuse.js | 11 |

Each iteration runs 7 searches. MiniSearch is 3,078x faster than seaq for live-as-you-type on pre-indexed data.

---

## Cold Start: Build + Search (10K Contacts)

This is the realistic first-search scenario: user loads a page with 10K items and immediately types a query. Index-based libraries must build their index first.

Query: `"nath fe"`, keys: `['givenName', 'familyName']`.

| Library | ops/s | mean (ms) | vs seaq |
|---------|------:|----------:|--------:|
| uFuzzy | 1,157 | 0.86 | 3.6x faster |
| **seaq** | **325** | **3.08** | **--** |
| MiniSearch | 95 | 10.53 | 3.4x slower |
| Fuse.js | 38 | 26.16 | 8.5x slower |
| Lunr | 14 | 71.49 | 23.2x slower |

---

## Performance by Mode (Joined vs Separate)

Query: `"nath fe"`, 10K contacts, fuzziness: 0.

| Mode | ops/s | mean (ms) |
|------|------:|----------:|
| Separate | 649 | 1.54 |
| Joined | 521 | 1.92 |

On 23 books:

| Mode | ops/s |
|------|------:|
| Separate | 163,205 |
| Joined | 155,134 |

Separate mode is faster than joined in these benchmarks because the bitmask pre-filter eliminates non-matching items early. The advantage of joined mode is simpler cross-field matching semantics, not raw speed.

---

## includeMatches Overhead

10K contacts, `"nath fe"`, fuzziness: 0.

### Joined Mode

| includeMatches | ops/s | mean (ms) |
|----------------|------:|----------:|
| false | 521 | 1.92 |
| true | 501 | 2.00 |

**Overhead: ~4%.**

### Separate Mode

| includeMatches | ops/s | mean (ms) |
|----------------|------:|----------:|
| false | 632 | 1.58 |
| true | 651 | 1.54 |

**No measurable overhead.** The difference is within noise (1.03x, and in this run `includeMatches: true` was marginally faster).

---

## Limit Optimization: Built-in `limit` vs `.slice()`

10K contacts, query `"na"`, joined mode, fuzziness: 0.

| Approach | ops/s | mean (ms) |
|----------|------:|----------:|
| `.slice(0, 10)` | 482 | 2.07 |
| `limit: 10` | 495 | 2.02 |

**Effectively identical** (1.03x). The built-in `limit` uses an O(n log k) heap, which matches `.slice()` performance on small limits. The benefit of `limit` is that it avoids allocating the full sorted array.

---

## Multi-Word Query Performance (Separate Mode)

10K contacts, separate mode. Compares strict vs fuzzy and single-word vs multi-word.

| Query | Fuzziness | ops/s | mean (ms) |
|-------|----------:|------:|----------:|
| `"nath"` (1 word) | 0.2 | 306 | 3.27 |
| `"nath fe"` (2 words) | 0.2 | 236 | 4.24 |
| `"natasha okeefe"` (2 words, long) | 0.2 | 191 | 5.25 |
| `"nath fe"` (2 words) | 0 | 623 | 1.61 |

Key observations:
- **Fuzziness costs ~2x**: strict `"nath fe"` at 623 ops/s vs fuzzy `"nath fe"` at 236 ops/s.
- **Multi-word costs ~1.3x** vs single-word at the same fuzziness (306 -> 236 ops/s).
- **Longer queries cost more**: `"natasha okeefe"` at 191 ops/s vs `"nath fe"` at 236 ops/s (longer strings = more character comparisons).

---

## Nested Object and Array Performance

seaq natively traverses nested properties (`company.name`) and arrays (`emails.address`). Other libraries require pre-flattening the data.

### Nested Property Search: `company.name` (search-only, index pre-built)

| Library | 1K contacts (ops/s) | 5K contacts (ops/s) |
|---------|--------------------:|--------------------:|
| MiniSearch (pre-flattened) | 27,012 | 5,484 |
| seaq (native nested) | 4,211 | 809 |
| Fuse.js (native nested) | 338 | 65 |

MiniSearch is 6-7x faster when the data is already flattened and indexed.

### Array Field Search: `emails.address` (search-only, index pre-built)

| Library | 1K contacts (ops/s) | 5K contacts (ops/s) |
|---------|--------------------:|--------------------:|
| MiniSearch (pre-flattened) | 3,430 | 568 |
| seaq (native array traversal) | 3,133 | 597 |
| Fuse.js (native array) | 299 | 57 |

seaq and MiniSearch are nearly identical on array fields. At 5K, seaq is marginally faster (1.05x). At 1K, MiniSearch is marginally faster (1.09x). Both are 10x faster than Fuse.js.

### Deep Nested: `addresses.city` (1K contacts, cold start for Fuse.js)

| Library | ops/s |
|---------|------:|
| MiniSearch (pre-flattened) | 7,021 |
| seaq (native) | 2,857 |
| Fuse.js (native) | 305 |

### Cold Start with Nested Data (includes flattening + index build)

| Library | 1K contacts (ops/s) | 5K contacts (ops/s) |
|---------|--------------------:|--------------------:|
| **seaq (no prep needed)** | **2,197** | **413** |
| MiniSearch (flatten + index) | 362 | 62 |
| Fuse.js (index build) | 269 | 53 |

**seaq is 6x faster than MiniSearch and 8x faster than Fuse.js** on cold start with nested data. No flattening step, no index build.

### Multi-Field Nested Search (1K contacts)

Searching across `name`, `company.name`, and `addresses.city` with query `"John Acme"`:

| Library | ops/s | mean (ms) |
|---------|------:|----------:|
| seaq | 1,662 | 0.60 |
| Fuse.js | 117 | 8.52 |

seaq is 14x faster than Fuse.js on multi-field nested search.

---

## Running Benchmarks

```bash
# All benchmarks (takes 2-3 minutes)
yarn workspace seaq vitest bench

# Individual benchmark files
yarn workspace seaq vitest bench test/perf/seaq.bench.ts
yarn workspace seaq vitest bench test/perf/realworld.bench.ts
yarn workspace seaq vitest bench test/perf/nested-arrays.bench.ts

# Individual library benchmarks
yarn workspace seaq vitest bench test/perf/fuse.bench.ts
yarn workspace seaq vitest bench test/perf/minisearch.bench.ts
yarn workspace seaq vitest bench test/perf/lunr.bench.ts
yarn workspace seaq vitest bench test/perf/ufuzzy.bench.ts
```

---

## Methodology Notes

1. All benchmarks use Vitest's built-in benchmarking with warmup and multiple iterations for statistical significance.
2. **Cold start** = index build (if any) + search, measured per iteration.
3. **Search only** = index pre-built outside the benchmark loop, measures pure search throughput.
4. **Single search** benchmarks for Fuse.js, MiniSearch, and Lunr include index construction inside each iteration (cold-start behavior). seaq and uFuzzy have no index.
5. Numbers will vary by machine. Relative comparisons are more meaningful than absolute ops/s.
