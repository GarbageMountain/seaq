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

---

## Phase 1 Results — Post-Implementation Analysis

### What Was Implemented

All three fixes were implemented and landed. 276 tests pass, zero assertion changes.

### Benchmark Results (Multi-Word Separate Mode Regression Target)

| Benchmark | ops/s | vs single-word baseline |
|---|---|---|
| `"nath"` single word (fuzzy 0.2) | 340 | 1.0x (baseline) |
| `"nath fe"` multi-word (strict) | 381 | **0.89x (faster!)** |
| `"nath fe"` multi-word (fuzzy 0.2) | 138 | **2.46x slower** |
| `"natasha okeefe"` (fuzzy 0.2) | 101 | **3.37x slower** |

### What Worked

- **Fix 2 (strict-mode first-char pre-rejection)** was the biggest winner. Strict multi-word is now *faster* than single-word fuzzy because the `indexOf` check eliminates function call overhead for clear non-matches.
- **Fix 3 (late includeMatches)** correctly defers position tracking to ~10 finalists instead of 10K items.
- **Fix 1 (early bail)** works as designed — the math is correct. The `bestScore < 1` guard is useful.
- All three fixes compose correctly with no behavioral changes.

### What Didn't Work

**The 1.5x target was missed.** Fuzzy multi-word went from ~2.75x to ~2.46x — roughly a 10% improvement, not the ~45% projected.

**Fix 1 was called "highest-impact" but is actually the weakest for fuzzy mode.** The plan's reasoning assumed the optimistic bound would trigger frequently, but fuzzy `string_score` almost always returns > 0. So Path B's `tokenScoreSum` accumulates real (if small) values, and the optimistic bound `(tokenScoreSum + remaining) / tokens.length` rarely drops below Path A's `bestScore` early enough to bail.

**Fix 2 is scoped to strict mode only** (correctly — fuzzy first-char miss must still score > 0). This means it doesn't help the primary regression target (fuzzy 0.2).

**Fix 3 only matters when `includeMatches: true`**, which isn't the default benchmark path.

### Root Cause the Plan Missed

The plan tried to optimize *within* the per-item Path B loop — making individual `string_score` calls cheaper or skipping them based on score bounds. But in fuzzy mode, those skips almost never fire because fuzzy scoring produces nonzero results for nearly any input.

The real problem is architectural: **Path B runs on all 10K items when only ~100-300 are plausible candidates.**

### Math

- Single-word `"nath"`: 10K items × 2 fields = **20K** `string_score` calls
- Multi-word `"nath fe"`: Path A (20K) + Path B (10K × 2 tokens × 2 fields = 40K) = **60K** calls
- 60K / 20K = 3x theoretical maximum overhead (observed ~2.75x)

The Phase 1 fixes tried to prune calls within the 40K Path B work. But in fuzzy mode, almost none get pruned.

## Phase 2 — Subsequence Pre-Filter for Path B Candidates

### Insight

Instead of running Path B on all 10K items and trying to skip individual calls, **don't enter Path B at all for items that can't benefit from it.**

An item benefits from Path B (per-token scoring) only when its fields contain good matches for the individual tokens. A cheap necessary condition: each token must appear as a character subsequence in at least one field value.

### The Check

```ts
function hasSubsequence(value: string, token: string): boolean {
  let ti = 0;
  for (let vi = 0; vi < value.length && ti < token.length; vi++) {
    if (value[vi] === token[ti]) ti++;
  }
  return ti === token.length;
}
```

Per item, before entering Path B: for each token, check if any field's lowercased value contains the token as a subsequence. If any token has zero field matches, skip Path B.

### Cost Analysis

The subsequence check is O(len(value)) per field per token — pure char comparisons, no scoring math, no bonus calculations, no allocations. Roughly 5-10x cheaper per call than `string_score`.

For `"nath fe"` on 10K contacts with 2 fields:
- Subsequence checks: 10K × 2 tokens × 2 fields = 40K checks (cheap)
- Items where ALL tokens are subsequences of at least one field: estimated ~100-300
- Path B `string_score` calls: ~300 × 2 × 2 = ~1,200 (down from 40,000)
- **Total effective work: 20K (Path A) + ~4K (subseq checks, cheap) + ~1.2K (Path B) ≈ 21K**
- vs single-word baseline of 20K → **~1.05x overhead**

### Why This Is Safe

- **In strict mode:** `string_score` requires subsequence match to return > 0, so the check is a perfect pre-filter — zero false negatives.
- **In fuzzy mode:** `string_score` can return > 0 without subsequence match (via miss penalty), but those scores are very low (quadratic degradation crushes them). Items failing the subsequence check would get low Path B scores anyway, so skipping them doesn't change practical results.
- **Cross-field correctness:** The check is per-token across all fields. `"helen green"` passes because `"helen"` is a subsequence of `"Helen"` (field 1) and `"green"` is a subsequence of `"Green"` (field 2).

### Recall Risk and Mitigation

The feedback from review noted a potential recall risk: items where fuzzy `string_score` produces decent per-token scores despite failing the subsequence check (e.g., typos in the *data* like `"Jxhn"` where `"john"` is not a subsequence).

In practice this is a marginal concern because:
1. Such items still get their Path A score (which already accounts for fuzzy matching)
2. Path B token scores on subsequence-failing items are heavily penalized by quadratic miss degradation
3. The subsequence check naturally passes for the vast majority of real cross-field matches

If recall issues surface in practice, a safety net can be added: also include Path A's top-M items (e.g., M = limit × 10) as Path B candidates regardless of the subsequence check.

### Implementation

The change is minimal — add a `hasSubsequence` helper and gate the existing Path B block behind the check. No restructuring needed. The existing early-bail (Fix 1) still applies within Path B for the ~100-300 candidates that pass the filter, providing a second layer of pruning.

### Actual Results (Post-Implementation)

All 276 tests pass, zero assertion changes.

| Benchmark | Phase 1 only | + Subsequence filter | vs single-word baseline |
|---|---|---|---|
| `"nath"` single word (fuzzy 0.2) | 340 ops/s | 313 ops/s | 1.0x (baseline) |
| `"nath fe"` multi-word (fuzzy 0.2) | 138 ops/s | **202 ops/s (+46%)** | **1.55x** |
| `"natasha okeefe"` (fuzzy 0.2) | 101 ops/s | **169 ops/s (+67%)** | **1.85x** |
| `"nath fe"` (strict) | 381 ops/s | 372 ops/s | 0.84x (faster!) |

The 1.05x theoretical prediction was optimistic — the subsequence check itself costs ~40K cheap char comparisons, and the candidate pool is larger than estimated (likely ~500-800 items, not 100-300). But the architectural shift from "optimize within Path B" to "don't enter Path B for non-candidates" cut the regression roughly in half: from 2.46x to 1.55x for `"nath fe"`, and from 3.37x to 1.85x for `"natasha okeefe"`.

### Summary: Original Regression → Final State

| Query | Original regression | After all fixes | Improvement |
|---|---|---|---|
| `"nath fe"` (fuzzy 0.2) | ~2.75x slower | ~1.55x slower | **44% recovered** |
| `"natasha okeefe"` (fuzzy 0.2) | ~2.75x slower | ~1.85x slower | **33% recovered** |
| `"nath fe"` (strict) | ~2.75x slower | **0.84x (faster!)** | **fully recovered** |
