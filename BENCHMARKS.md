# Seaq Benchmarks Deep Dive

This document provides detailed benchmark comparisons between seaq and other popular fuzzy search libraries: Fuse.js, MiniSearch, uFuzzy, and Lunr.

> **Snapshot date:** 2026-02-09
> **Scoring version:** quadratic miss degradation + token-aware separate mode + 30/70 formula + threshold 0.3 + limit 10

## TL;DR

- **seaq v2** is **12% faster** than v1 in joined mode, **40% slower** in separate mode (due to token scoring on multi-word queries)
- **seaq** is 14x faster than Fuse.js on cold-start searches
- **seaq** excels at cold-start scenarios, nested data, acronym matching, and **cross-field multi-word search** (new)
- **uFuzzy** is ~9x faster than seaq on cold-start but only works with flat string arrays
- **MiniSearch/Lunr** are 2700x+ faster for repeated searches on static, pre-indexed data
- **Fuse.js** is flexible but slowest across the board

## Test Environment

- Node.js 22
- Vitest benchmarks
- Dataset: 10K generated contacts with nested emails, addresses, and company info
- Defaults: `fuzziness: 0.2`, `fieldMode: 'separate'`, `limit: 10`, `threshold: 0.3`
- Benchmark queries use `fuzziness: 0` for consistent measurement

---

## v1 vs v2 Performance

Comparing the published seaq v1 (1.1.5) against v2 on identical datasets. Query: `"nath fe"` (multi-word, 2 fields).

| | v1 (1.1.5) | v2 (joined) | v2 (separate) |
|---|---|---|---|
| **10K contacts** | 486 ops/s | 547 ops/s (+12%) | 293 ops/s (-40%) |

- **Joined mode** is a drop-in replacement — same behavior, ~12% faster from pre-lowercasing and primitive optimizations
- **Separate mode** is slower on multi-word queries due to token-aware scoring (2 tokens × 2 fields = 4 extra `string_score` calls per item). Single-word queries are unaffected (~487 ops/s, on par with v1).
- **Separate mode now supports cross-field matching**: `"helen green"` finds `{ givenName: "Helen", familyName: "Green" }` — previously returned nothing.

---

## Performance Summary (10K items)

### Single Search (no pre-built index)

| Library | 10K Books | 10K Contacts | Mean Time |
|---------|-----------|--------------|-----------|
| uFuzzy | 182,380 ops/s | 4,598 ops/s | 0.005-0.2ms |
| **seaq (separate mode)** | **180,094 ops/s** | **287 ops/s** | **0.006-3.5ms** |
| **seaq (joined mode)** | **155,193 ops/s** | **539 ops/s** | **0.006-1.9ms** |
| MiniSearch | 39,452 ops/s | 93 ops/s | 0.03-11ms |
| Fuse.js | 38,712 ops/s | 38 ops/s | 0.03-26ms |

**Note on separate mode**: The 10K contacts benchmark uses `"nath fe"` (multi-word), which triggers token scoring. Single-word queries in separate mode run at ~487 ops/s. The 23-books benchmark uses a single-word query and shows separate mode faster than joined.

**seaq is ~14x faster than Fuse.js** on 10K contact searches (joined mode).

### 10 Consecutive Searches

| Library | 10K Books | 10K Contacts |
|---------|-----------|--------------|
| uFuzzy | 65,874 ops/s | 476 ops/s |
| MiniSearch | 32,101 ops/s | 97 ops/s |
| **seaq (joined)** | **15,627 ops/s** | **54 ops/s** |
| Lunr | 5,220 ops/s | 33 ops/s |
| Fuse.js | 5,218 ops/s | 4.4 ops/s |

### Key Takeaways

- **seaq is ~14x faster than Fuse.js** on cold-start searches
- **seaq is ~4x faster than MiniSearch** when index build time is included
- **uFuzzy is ~9x faster than seaq** on cold-start but lacks nested object support and acronym matching
- **Multi-word queries in separate mode cost ~2.75x** vs single-word (token scoring overhead)
- **seaq's `limit` option** uses O(n log k) heap selection — same speed as `.slice()` on small limits

---

## Quality Metrics

Testing precision (did we avoid junk results?), recall (did we find everything?), and ranking quality.

### Overall Quality Summary

| Library | Precision | Recall | MRR | Top-1 Correct |
|---------|-----------|--------|-----|---------------|
| **seaq** | **84%** | 94% | **1.00** | **7/7** |
| ufuzzy | 86% | 83% | 0.86 | 6/7 |
| fuse.js | 74% | 100% | 1.00 | 7/7 |
| minisearch | 62% | 83% | 0.86 | 6/7 |
| seaq (fuzzy mode) | 26% | 100% | 1.00 | 7/7 |

**Key findings:**
- seaq has the best precision/recall balance in default mode
- seaq's fuzzy mode prioritizes recall (finds everything) at the cost of precision
- MiniSearch struggles with typos ("Jonh" → "John" fails)
- uFuzzy has high precision but misses some partial matches

---

## Acronym Matching

Testing queries like "NYC" → "New York City", "API" → "Application Programming Interface".

### Acronym Detection Rate

| Library | Found | Top-1 Correct | Top-3 Correct | Detection Rate |
|---------|-------|---------------|---------------|----------------|
| **seaq** | **14/14** | **14** | **14** | **100%** |
| fuse.js | 8/14 | 2 | 7 | 57% |
| minisearch | 0/14 | 0 | 0 | 0% |
| ufuzzy | 0/14 | 0 | 0 | 0% |

**Key findings:**
- seaq is the ONLY library with reliable acronym matching
- Fuse.js sometimes finds acronyms but ranks them poorly (e.g., "himalayas" before "Hillsdale Michigan" for "HiMi")
- MiniSearch and uFuzzy have zero acronym support - they need consecutive characters

### Example: "HiMi" query

```
seaq:       1. Hillsdale Michigan  2. High Mountain
fuse.js:    1. himalayas           2. Hillsdale Michigan
minisearch: (no results)
ufuzzy:     (no results)
```

---

## Nested Object & Array Performance

seaq can natively search nested properties like `company.name` and arrays like `emails.address`. Other libraries require data flattening.

### Cold Start (includes data prep/flattening)

| Library | 1K contacts | 5K contacts |
|---------|-------------|-------------|
| **seaq (no prep)** | **1,769 ops/s** | **344 ops/s** |
| minisearch (flatten + index) | 373 ops/s | 66 ops/s |
| fuse.js (index build) | 276 ops/s | 54 ops/s |

**seaq is 5-6x faster** when you need to search nested data immediately.

### Pre-indexed Search (data already flattened)

| Library | 1K contacts | 5K contacts |
|---------|-------------|-------------|
| minisearch | 27,415 ops/s | 5,670 ops/s |
| seaq | 4,853 ops/s | 981 ops/s |
| fuse.js | 339 ops/s | 65 ops/s |

MiniSearch is faster IF you can pre-flatten your data and build an index ahead of time.

### Array Field Traversal

Searching `emails.address` where each contact has multiple email objects:

| Library | 1K (search only) | 5K (search only) |
|---------|------------------|------------------|
| minisearch (pre-flattened) | 3,463 ops/s | 594 ops/s |
| **seaq (native)** | **2,614 ops/s** | **494 ops/s** |
| fuse.js | 312 ops/s | 57 ops/s |

seaq is competitive even without flattening, and much simpler to use.

---

## General Performance (10K items)

### Search Only (index pre-built)

| Library | Short "na" | Medium "nath fe" | Long "natasha okeefe" |
|---------|------------|------------------|----------------------|
| MiniSearch | 1,240,459 ops/s | 714,488 ops/s | 693,276 ops/s |
| Lunr | 1,093,943 ops/s | 465,018 ops/s | 428,509 ops/s |
| uFuzzy | 1,280 ops/s | 4,949 ops/s | 5,651 ops/s |
| **seaq** | **453 ops/s** | **150 ops/s** | **106 ops/s** |
| Fuse.js | 110 ops/s | 45 ops/s | 17 ops/s |

With pre-built indexes, MiniSearch and Lunr are ~2700x+ faster than seaq.

Note: seaq's medium/long query numbers include token-scoring overhead (multi-word queries trigger `tokens × fields` extra scoring calls). Short single-word queries are fastest.

### seaq Performance Options

| Mode | 10K Books | 10K Contacts | Trade-off |
|------|-----------|--------------|-----------|
| `fieldMode: 'joined'` | 155,193 ops/s | 539 ops/s | Full cross-field matching, no token overhead |
| `fieldMode: 'separate'` (default) | 180,094 ops/s | 287 ops/s | Cross-field via token scoring, ~2.75x slower on multi-word |
| `limit: 10` vs `.slice(0,10)` | — | 521 vs 520 ops/s | Equivalent |

### Simulated Typing (7 keystrokes: n→na→nat→...→natasha)

| Library | ops/s |
|---------|-------|
| MiniSearch | 176,681 |
| Lunr | 122,616 |
| uFuzzy | 452 |
| seaq | 57 |
| Fuse.js | 11 |

For live-as-you-type search with pre-built indexes, MiniSearch dominates.

---

## When to Use Each Library

### Use seaq when:
- You need acronym matching (NYC → New York City)
- Your data has nested objects or arrays
- Data changes frequently (no index to rebuild)
- Cold-start performance matters
- You want cross-field multi-word search ("helen green" across firstName + lastName) without joined mode
- You want zero setup complexity

### Use MiniSearch when:
- You have large static datasets (10K+ items)
- You can pre-flatten nested data
- You need maximum search-only speed
- Building an index upfront is acceptable

### Use uFuzzy when:
- You only search flat string arrays
- You need the absolute fastest cold-start
- You don't need acronym matching
- Data structure is simple

### Use Fuse.js when:
- You need maximum fuzzy tolerance
- You want built-in nested object support
- Speed is not critical
- You need the most flexible configuration

### Use Lunr when:
- You want a traditional full-text search experience
- You need stemming and stop words
- You have document-like data

---

## Running Benchmarks

```bash
# All benchmarks
yarn workspace seaq vitest bench

# Quality tests
yarn workspace seaq vitest run test/perf/quality-metrics.test.ts
yarn workspace seaq vitest run test/perf/acronym-quality.test.ts

# Specific benchmarks
yarn workspace seaq vitest bench test/perf/realworld.bench.ts
yarn workspace seaq vitest bench test/perf/nested-arrays.bench.ts
```

---

## Methodology Notes

1. **Precision** = (relevant results returned) / (total results returned)
2. **Recall** = (relevant results returned) / (total relevant results)
3. **MRR** (Mean Reciprocal Rank) = average of 1/rank of first correct result
4. **Cold start** = includes index building / data prep time
5. **Search only** = index pre-built, measures pure search speed

All benchmarks use Vitest's built-in benchmarking with multiple iterations for statistical significance.
