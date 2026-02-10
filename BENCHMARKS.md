# Seaq Benchmarks Deep Dive

This document provides detailed benchmark comparisons between seaq and other popular fuzzy search libraries: Fuse.js, MiniSearch, uFuzzy, and Lunr.

> **Snapshot date:** 2026-02-09
> **Scoring version:** match ratio (>50% chars required) + 30/70 formula + threshold 0.3 + limit 10

## TL;DR

- **seaq v2** is **14-59% faster** than v1 depending on mode
- **seaq** is 14x faster than Fuse.js on cold-start searches
- **seaq** excels at cold-start scenarios, nested data, and acronym matching
- **uFuzzy** is ~3.5x faster than seaq on cold-start but only works with flat string arrays
- **MiniSearch/Lunr** are 2500x+ faster for repeated searches on static, pre-indexed data
- **Fuse.js** is flexible but slowest across the board

## Test Environment

- Node.js 22
- Vitest benchmarks
- Dataset: 10K generated contacts with nested emails, addresses, and company info
- Defaults: `fuzziness: 0.2`, `fieldMode: 'separate'`, `limit: 10`, `threshold: 0.3`

---

## v1 vs v2 Performance

Comparing the published seaq v1 (1.1.5) against v2 on identical datasets. v2 gains come from pre-lowercasing the query once instead of per-item, avoiding `JSON.stringify` for primitives, the new `separate` field mode, and limit/threshold defaults.

| | v1 (1.1.5) | v2 (joined) | v2 (separate) |
|---|---|---|---|
| **10K contacts** | 488 ops/s | 557 ops/s (+14%) | 774 ops/s (+59%) |

- **Default mode (joined)** is a drop-in replacement — same behavior, ~14% faster
- **Separate mode** is a new option that scores each field independently — ~59% faster, but won't match queries that span multiple fields (e.g., "john smith" across firstName + lastName)

---

## Performance Summary (10K items)

### Single Search (no pre-built index)

| Library | 10K Books | 10K Contacts | Mean Time |
|---------|-----------|--------------|-----------|
| uFuzzy | 171,155 ops/s | 4,507 ops/s | 0.006-0.2ms |
| **seaq (separate mode)** | **205,731 ops/s** | **751 ops/s** | **0.005-1.3ms** |
| **seaq (joined mode)** | **159,408 ops/s** | **547 ops/s** | **0.006-1.8ms** |
| MiniSearch | 41,060 ops/s | 99 ops/s | 0.02-10ms |
| Fuse.js | 38,075 ops/s | 38 ops/s | 0.03-26ms |

**seaq is ~14x faster than Fuse.js** on 10K contact searches.

### 10 Consecutive Searches

| Library | 10K Books | 10K Contacts |
|---------|-----------|--------------|
| uFuzzy | 63,863 ops/s | 468 ops/s |
| MiniSearch | 32,001 ops/s | 97 ops/s |
| **seaq (joined)** | **15,983 ops/s** | **54 ops/s** |
| Lunr | 5,078 ops/s | 34 ops/s |
| Fuse.js | 5,195 ops/s | 4.4 ops/s |

### Key Takeaways

- **seaq v2 is 14-59% faster than v1** depending on field mode
- **seaq is ~14x faster than Fuse.js** on cold-start searches
- **seaq is ~4x faster than MiniSearch** when index build time is included
- **uFuzzy is ~3.5x faster than seaq** on cold-start but lacks nested object support and acronym matching
- **seaq's `separate` mode** gives ~38% speed boost when you don't need cross-field matching
- **seaq's `limit` option** is ~3% faster than using `.slice()` for top-N results

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
| **seaq (no prep)** | **1,861 ops/s** | **361 ops/s** |
| minisearch (flatten + index) | 363 ops/s | 65 ops/s |
| fuse.js (index build) | 275 ops/s | 53 ops/s |

**seaq is 5-6x faster** when you need to search nested data immediately.

### Pre-indexed Search (data already flattened)

| Library | 1K contacts | 5K contacts |
|---------|-------------|-------------|
| minisearch | 26,728 ops/s | 5,492 ops/s |
| seaq | 5,353 ops/s | 1,085 ops/s |
| fuse.js | 336 ops/s | 67 ops/s |

MiniSearch is faster IF you can pre-flatten your data and build an index ahead of time.

### Array Field Traversal

Searching `emails.address` where each contact has multiple email objects:

| Library | 1K (search only) | 5K (search only) |
|---------|------------------|------------------|
| minisearch (pre-flattened) | 3,609 ops/s | 597 ops/s |
| **seaq (native)** | **2,705 ops/s** | **524 ops/s** |
| fuse.js | 304 ops/s | 58 ops/s |

seaq is competitive even without flattening, and much simpler to use.

---

## General Performance (10K items)

### Search Only (index pre-built)

| Library | Short "na" | Medium "nath fe" | Long "natasha okeefe" |
|---------|------------|------------------|----------------------|
| MiniSearch | 1,266,281 ops/s | 727,257 ops/s | 662,389 ops/s |
| Lunr | 1,108,432 ops/s | 486,927 ops/s | 125,341 ops/s |
| uFuzzy | 1,384 ops/s | 4,865 ops/s | 453 ops/s |
| **seaq** | **505 ops/s** | **372 ops/s** | **264 ops/s** |
| Fuse.js | 112 ops/s | 46 ops/s | 11 ops/s |

With pre-built indexes, MiniSearch and Lunr are ~2500x+ faster than seaq.

Note: seaq's query-length scaling (505 → 264 ops/s from short to long) is expected — the `string_score` inner loop runs `wordLength` iterations per item. Short queries (the common case in type-ahead) are fastest.

### seaq Performance Options

| Mode | 10K Books | 10K Contacts | Trade-off |
|------|-----------|--------------|-----------|
| `fieldMode: 'joined'` | 159,408 ops/s | 547 ops/s | Full cross-field matching |
| `fieldMode: 'separate'` (default) | 205,731 ops/s | 751 ops/s | ~38% faster, single-field only |
| `limit: 10` vs `.slice(0,10)` | — | 521 vs 505 ops/s | ~3% faster |

### Simulated Typing (7 keystrokes: n→na→nat→...→natasha)

| Library | ops/s |
|---------|-------|
| MiniSearch | 171,671 |
| Lunr | 125,341 |
| uFuzzy | 453 |
| seaq | 64 |
| Fuse.js | 11 |

For live-as-you-type search with pre-built indexes, MiniSearch dominates.

---

## When to Use Each Library

### Use seaq when:
- You need acronym matching (NYC → New York City)
- Your data has nested objects or arrays
- Data changes frequently (no index to rebuild)
- Cold-start performance matters
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
