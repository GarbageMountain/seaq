# Perf Fix Proposal: Multi-Word Separate Mode Regression

## Problem

The cross-field multi-word fix (commit `a2a534b`) is quality-correct — `"helen green"` now properly matches across `{givenName, familyName}` in `fieldMode: "separate"`. But it introduced a ~2.75x performance regression by adding Path B (per-token scoring) on top of Path A (full-query scoring).

### Mechanical Cause

With `F` fields and `T` tokens, `string_score` calls per item went from `F` to `F + T*F`.

| Scenario | Before | After | Multiplier |
|---|---|---|---|
| 2 fields, 2 tokens | 2 | 6 | 3x |
| 3 fields, 3 tokens | 3 | 12 | 4x |

### Wall-Clock Impact (10K contacts, from benchmarks)

| Query | Before | After | Delta |
|---|---|---|---|
| `"nath fe"` | ~1.29ms | ~3.56ms | +2.27ms |
| `"natasha okeefe"` | ~3.79ms | ~9.62ms | +5.83ms |

Still sub-10ms, but compounds under repeated keystrokes and larger datasets.

### Why threshold/limit Don't Help Here

`threshold: 0.3` and `limit: 10` reduce *output* but not *scoring work*. All `string_score` calls in `scoreItems()` run to completion before filtering happens (Seaq.ts:140-143). The regression is in scoring volume, not result volume.

## Proposed Fixes (Phase 1 — Tactical, No Architecture Change)

Three independent optimizations targeting the hot path in `scoreItems()`.

### Fix 1: Path B Early-Bail via Loop-Time Optimistic Bound

**What:** During the Path B token loop, track a running upper bound. After each token is scored, compute the best possible `tokenAvg` assuming all remaining tokens score a perfect 1.0. If that optimistic average can't beat Path A's `bestScore`, bail out of the token loop early.

As a cheap special case: if Path A scored exactly 1.0 (perfect match), skip Path B entirely — it can't win.

**Why this is the primary mechanism:** Instrumentation against contacts-10K shows that typical Path A scores for queries like `"nath fe"` and `"natasha okeefe"` are well below 0.95, so a static pre-skip threshold would rarely fire. The loop-time bound is different — it tightens dynamically as each token gets its real (often mediocre) score, causing bail-outs mid-loop once it becomes clear that Path B can't catch up.

**Where:** Seaq.ts:304-335, the Path B block.

**How:**
```
// Special case: perfect Path A match, Path B can't win
if (bestScore === 1) skip Path B entirely

// Inside Path B token loop, after scoring token t:
const scored = t + 1;
const remaining = tokens.length - scored;
const optimisticAvg = (tokenScoreSum + remaining * 1.0) / tokens.length;
if (optimisticAvg <= bestScore) break;
```

**Preserves ranking exactly:** The bound is mathematically exact — it only skips when Path B provably cannot produce a higher average than Path A's actual score.

**Expected impact:** The primary win for the target workload. After 1-2 tokens score poorly, the bound tightens enough to skip the remaining token-field scoring work for most items.

### Fix 2: Cheap Character-Presence Pre-Rejection (Strict Mode Only)

**What:** Before calling `string_score(value, query, ...)` in strict mode (`fuzziness === 0`), check if the lowercased target contains the first character of the lowercased query. If not, skip the call.

**Scoped to strict mode only.** In fuzzy mode (`fuzziness > 0`), a first-char miss still produces a nonzero score via the penalty path (string_score.ts:67-68, 102-103), and existing tests rely on this behavior (string_score.test.ts:140, 163, 190). Skipping those items would change results.

**Why it works in strict mode:** `string_score` does `lString.indexOf(lWord.charAt(0), 0)` as its first operation. In strict mode, if that returns -1, the function returns 0 immediately (string_score.ts:109-111). The pre-check avoids function call overhead for a guaranteed zero.

**Where:** Inside both Path A (Seaq.ts:291-300) and Path B (Seaq.ts:310-319) inner loops, before the `string_score` call, gated on `fuzziness === 0`.

**How:**
```
// Cache lowercased field values once per item (alongside fieldValues)
// This also avoids repeated .toLowerCase() inside string_score itself
const lowerValue = value.toLowerCase();

// Strict mode only: skip guaranteed zeros
if (!fuzziness && lowerValue.indexOf(lWord.charAt(0)) === -1) continue;
```

**Note:** Caching lowercased field values once per item is itself a micro-optimization — `string_score` currently calls `.toLowerCase()` on the target every invocation.

**Preserves ranking exactly:** In strict mode, first-char absence guarantees score === 0. No behavioral change.

**Expected impact:** Modest but broad. Eliminates function call overhead for clear non-matches in strict mode. Most valuable on high-cardinality datasets.

### Fix 3: Late `includeMatches` Computation via Winner Descriptors

**What:** During scoring, never compute `positions` arrays. Instead, store a lightweight "winner descriptor" per item recording which path won and which field(s) produced the winning score. After filtering and top-K selection, recompute positions only for finalists by replaying the winning path.

**Why it works:** Today, `positions` arrays are allocated and populated for *every* `string_score` call when `includeMatches: true`, even though >99% of items are discarded by threshold/limit. Position tracking adds allocation overhead and prevents some internal optimizations.

**Where:** Seaq.ts:292, 312 (positions allocation), and post-filtering at Seaq.ts:152-154.

**How:**
1. During `scoreItems()`, always pass `undefined` for positions — score only.
2. Per scored item, store a winner descriptor:
   - Which path won: `'A'` or `'B'`
   - Path A: winning field index
   - Path B: winning field index per token
3. After `getTopN()` + threshold filtering produces the final result set (~10 items), replay only the winning `string_score` calls with positions enabled.
4. Rescore cost: for Path A winners, 1 call per finalist. For Path B winners, `T` calls per finalist. With `limit: 10`, `T: 2`, that's 10-20 calls total — negligible vs 60K+ saved.

**Preserves ranking exactly:** Scoring pass is identical (same calls, same scores). Only position computation is deferred. Winner descriptors ensure the rescore replays exactly the winning path, preserving tie-breaking behavior.

**Expected impact:** Only matters when `includeMatches: true`, but eliminates per-item allocation overhead and makes the scoring loop tighter for that case.

## Pre-Optimization Regression Tests

Before implementing any fix, add explicit test cases covering the specific risk areas:

1. **Fuzzy first-char miss behavior** — Verify that items where the first query character is absent still score > 0 in fuzzy mode. Guards against Fix 2 scope creep. (Validates existing behavior at string_score.test.ts:140, 163, 190.)

2. **Path B winning over Path A** — Verify that cross-field multi-word queries where Path B produces a higher score than Path A still return the Path B result. Guards against Fix 1 bounds being too aggressive. (Validates existing behavior at seaq.test.ts:698 and the cross-field tests.)

3. **`includeMatches` position correctness for Path B winners** — Verify that match positions from per-token scoring are correct when Path B wins. Guards against Fix 3 winner descriptor logic.

## Implementation Order

1. **Regression tests** — lock down the risk areas before changing anything
2. **Fix 1 (Path B early-bail)** — highest impact, directly addresses the regression
3. **Fix 3 (late matches)** — clean separation of scoring from highlighting
4. **Fix 2 (strict-mode char pre-rejection + field value caching)** — broadest but smallest per-item gain

Each fix should be independently benchmarked using `vitest bench` before and after.

## Success Criteria

- Multi-word separate mode benchmarks recover to within 1.5x of single-path baseline (down from 2.75x)
- Single-word query performance unchanged or improved
- All existing tests pass with no assertion changes
- New regression tests pass
- No new API surface or behavioral changes

## Future Direction (Phase 2 — Optional `prepare()`)

Not part of this proposal. Both reviews recommend an optional `seaq.prepare(list, options)` path with lightweight indexing for repeated-search scenarios. This is additive — it doesn't replace `seaq(list, query)` and preserves the zero-setup identity. Decision on whether to pursue it should be based on:

- Real user demand for 10K+ repeated-search performance
- Wall-clock numbers after Phase 1 fixes land
- Whether the remaining gap justifies the added complexity

The tactical fixes above are the right first move regardless of whether `prepare()` happens later.
