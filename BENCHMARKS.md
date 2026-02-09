# Seaq Benchmarks Deep Dive

This document provides detailed benchmark comparisons between seaq and other popular fuzzy search libraries: Fuse.js, MiniSearch, uFuzzy, and Lunr.

## TL;DR

- **seaq v2** is **10-16% faster** than v1 in default (joined) mode, and **49-55% faster** in the new `separate` mode
- **seaq** is 14-22x faster than Fuse.js on single searches
- **seaq** excels at cold-start scenarios, nested data, and acronym matching
- **uFuzzy** is ~5-7x faster than seaq but only works with flat string arrays
- **MiniSearch/Lunr** are 1000x+ faster for repeated searches on static, pre-indexed data
- **Fuse.js** is flexible but slowest across the board

## Test Environment

- Node.js 22
- Vitest benchmarks
- Dataset: 10K generated contacts with nested emails, addresses, and company info

---

## v1 vs v2 Performance

Comparing the published seaq v1 (1.1.5) against v2 on identical datasets. v2 gains come from pre-lowercasing the query once instead of per-item, avoiding `JSON.stringify` for primitives, and the new `separate` field mode.

| | v1 (1.1.5) | v2 (joined) | v2 (separate) |
|---|---|---|---|
| **10K books** | 433 ops/s | 475 ops/s (+10%) | 644 ops/s (+49%) |
| **10K contacts** | 463 ops/s | 536 ops/s (+16%) | 719 ops/s (+55%) |

- **Default mode (joined)** is a drop-in replacement — same behavior, 10-16% faster
- **Separate mode** is a new option that scores each field independently — 49-55% faster, but won't match queries that span multiple fields (e.g., "john smith" across firstName + lastName)

---

## Performance Summary (10K items)

### Single Search (no pre-built index)

| Library | 10K Books | 10K Contacts | Notes |
|---------|-----------|--------------|-------|
| uFuzzy | 3,473 ops/s | 4,874 ops/s | Fastest, flat strings only |
| **seaq (separate mode)** | **644 ops/s** | **719 ops/s** | ~50% faster, no cross-field matching |
| **seaq (joined mode)** | **520 ops/s** | **548 ops/s** | Default, full feature support |
| MiniSearch | 37 ops/s | 87 ops/s | Includes index build time |
| Fuse.js | 24 ops/s | 38 ops/s | Slowest |

### 10 Consecutive Searches

| Library | 10K Books | 10K Contacts |
|---------|-----------|--------------|
| uFuzzy | 358 ops/s | 480 ops/s |
| MiniSearch | 38 ops/s | 88 ops/s |
| **seaq (joined)** | **52 ops/s** | **48 ops/s** |
| Fuse.js | 2.6 ops/s | 4.4 ops/s |

### Key Takeaways

- **seaq v2 is 10-16% faster than v1** out of the box (joined mode)
- **seaq is 14-22x faster than Fuse.js** on cold-start searches
- **seaq is 6-14x faster than MiniSearch** when index build time is included
- **uFuzzy is ~5-7x faster than seaq** but lacks nested object support and acronym matching
- **seaq's `separate` mode** gives ~50% speed boost when you don't need cross-field matching
- **seaq's `limit` option** is ~20% faster than using `.slice()` for top-N results

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
| **seaq** | **14/14** | **13** | **14** | **100%** |
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
| **seaq (no prep)** | **1,922 ops/s** | **332 ops/s** |
| minisearch (flatten + index) | 340 ops/s | 56 ops/s |
| fuse.js (index build) | 260 ops/s | 47 ops/s |

**seaq is 5-7x faster** when you need to search nested data immediately.

### Pre-indexed Search (data already flattened)

| Library | 1K contacts | 5K contacts |
|---------|-------------|-------------|
| minisearch | 25,593 ops/s | 4,999 ops/s |
| seaq | 4,681 ops/s | 879 ops/s |
| fuse.js | 326 ops/s | 65 ops/s |

MiniSearch is faster IF you can pre-flatten your data and build an index ahead of time.

### Array Field Traversal

Searching `emails.address` where each contact has multiple email objects:

| Library | 1K (search only) | 5K (search only) |
|---------|------------------|------------------|
| minisearch (pre-flattened) | 3,252 ops/s | 552 ops/s |
| **seaq (native)** | **2,450 ops/s** | **466 ops/s** |
| fuse.js | 298 ops/s | 55 ops/s |

seaq is competitive even without flattening, and much simpler to use.

---

## General Performance (10K items)

### Single Search (cold start, no index)

| Library | 10K Books | 10K Contacts | Mean Time |
|---------|-----------|--------------|-----------|
| uFuzzy | 3,473 ops/s | 4,874 ops/s | 0.2-0.3ms |
| **seaq (separate)** | **644 ops/s** | **719 ops/s** | **1.4-1.6ms** |
| **seaq (joined)** | **520 ops/s** | **548 ops/s** | **1.8-1.9ms** |
| MiniSearch | 37 ops/s | 87 ops/s | 11-27ms |
| Fuse.js | 24 ops/s | 38 ops/s | 26-42ms |

**seaq is 14-22x faster than Fuse.js** on single searches.

### Search Only (index pre-built)

| Library | Short "na" | Medium "nath fe" | Long "natasha okeefe" |
|---------|------------|------------------|----------------------|
| MiniSearch | 1,092,751 ops/s | 688,151 ops/s | 320,260 ops/s |
| Lunr | 965,281 ops/s | 448,064 ops/s | 105,277 ops/s |
| uFuzzy | 1,036 ops/s | 4,596 ops/s | 5,377 ops/s |
| **seaq** | **316 ops/s** | **442 ops/s** | **355 ops/s** |
| Fuse.js | 89 ops/s | 42 ops/s | 15 ops/s |

With pre-built indexes, MiniSearch and Lunr are ~1000-3000x faster than seaq.

### seaq Performance Options

| Mode | 10K Books | 10K Contacts | Trade-off |
|------|-----------|--------------|-----------|
| `fieldMode: 'joined'` (default) | 475 ops/s | 536 ops/s | Full cross-field matching |
| `fieldMode: 'separate'` | 644 ops/s | 719 ops/s | ~50% faster, single-field only |
| `limit: 10` vs `.slice(0,10)` | 502 vs 433 ops/s | 533 vs 460 ops/s | ~16-20% faster |

### Simulated Typing (7 keystrokes: n→na→nat→...→natasha)

| Library | ops/s |
|---------|-------|
| MiniSearch | 102,105 |
| Lunr | 50,971 |
| uFuzzy | 423 |
| seaq | 49 |
| Fuse.js | 10 |

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
yarn workspace seaq benchmark

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
