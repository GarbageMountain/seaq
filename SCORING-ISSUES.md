# Scoring & Fuzziness Issues — Living Document

## The Problem

With the new defaults (`fuzziness: 0.2`, `fieldMode: 'separate'`), seaq returns way too many results. The fuzziness causes almost everything to match with a non-zero score, and seaq returns anything with `score > 0`.

**"nath" on 10K contacts → 9,756 / 10,000 returned (97.5%)**

```
Score distribution:
  0.00 - 0.01:    5 results
  0.01 - 0.05: 7338 results   ← garbage
  0.05 - 0.10: 1647 results   ← garbage
  0.10 - 0.20:  359 results   ← mostly garbage
  0.20 - 0.30:  325 results   ← borderline
  0.30 - 0.50:   50 results   ← decent
  0.50 - 0.70:    9 results   ← good
  0.70 - 1.00:   23 results   ← the actual Nathans
```

The 23 real matches (Nathan, Nathen, Nathaniel etc.) all score ~0.80. The remaining 9,733 results are noise.

**"btn" on 21 file paths → 20 / 21 returned**

```
  1. tsconfig.json             → 0.1140   ← WRONG: outscores the real match!
  2. src/components/Button.tsx  → 0.0933   ← the actual match
  3. tests/App.test.tsx         → 0.0598
  ... 17 more garbage results
```

With `fuzziness: 0` (strict), only `Button.tsx` matches — which is correct.

**"rockt" (typo for "rocket") on 14 emojis → 13 / 14 returned**

```
  1. rocket      → 0.7733   ← correct
  2. red heart   → 0.2002   ← noise
  3. check mark  → 0.0484   ← garbage
  ... 10 more garbage
```

## Root Cause Analysis

### Issue 1: No minimum score threshold

`seaq()` returns every item with `score > 0`. With fuzziness enabled, almost anything gets a non-zero score because even 1 matching character produces a positive score, and the fuzzy penalty just degrades it rather than zeroing it out.

The filter in `Seaq.ts` line ~310:
```typescript
if (score > 0) {
  result.push({ item, score, matches });
}
```

### Issue 2: The scoring algorithm's character-scatter problem

`string_score` works by walking through query characters left-to-right and finding each one in the target string (left-to-right). This means:

- "btn" matches "**b**u**t**to**n**.tsx" (good — subsequence of "Button")
- "btn" also matches "**t**sco**n**fig.json" — wait, it finds 'b'? No...

Actually let me trace through "btn" vs "tsconfig.json":
- 'b' not found → fuzzies += 0.8 (fuzzies = 1.8)
- 't' found at index 0 → consecutive bonus 0.7 + case match 0.1 = 0.8
- 'n' found at index 6 (tsco**n**fig) → base 0.1

`runningScore = 0.9`, `strLength = 13`, `wordLength = 3`
`finalScore = 0.5 * (0.9/13 + 0.9/3) / 1.8 = 0.5 * (0.069 + 0.3) / 1.8 = 0.102`

vs "btn" against "src/components/Button.tsx":
- 'b' not found (lowercase 's' is first...) wait — 'b' not found until position 16
- Actually: 'b' found at index 16 (Button), not consecutive → 0.1
- 't' found at index 19 (But**t**on), consecutive → 0.7
- 'n' found at index 21 (Butto**n**), consecutive → 0.7

`runningScore = 1.5`, `strLength = 25`, `wordLength = 3`
`finalScore = 0.5 * (1.5/25 + 1.5/3) / 1.0 = 0.5 * (0.06 + 0.5) = 0.280`

Wait, that gives 0.28, not 0.09. Let me re-check... The first-letter bonus might apply. Anyway the point is the scoring can sometimes rank garbage above real matches, especially with path-like strings.

**Update: re-ran with the actual code and "btn" → Button.tsx scores 0.0933 while tsconfig.json scores 0.1140. The short target string gets a length bonus that outweighs Button.tsx's better character positions.**

## Possible Solutions

### Option A: Add a `minScore` threshold (simplest)

Add an option with a sensible default that filters out low-scoring results:

```typescript
interface SeaqOptions {
  // ...existing...
  /** Minimum score to include in results. Default: 0.1 */
  minScore?: number;
}
```

**Pros:** Simple, explicit, easy to understand. Users can tune it.
**Cons:** Hard to pick one value that works for all query lengths and data shapes. A 2-character query on short strings produces different score ranges than a 10-character query on long strings.

Rough analysis of what different thresholds would do:
- `0.05` — cuts "nath" from 9756 → ~2393 results (still lots of noise)
- `0.10` — cuts "nath" from 9756 → ~757 results (better but still noisy)
- `0.20` — cuts "nath" from 9756 → ~407 results (getting there)
- `0.30` — cuts "nath" from 9756 → ~82 results (pretty good)

### Option B: Auto-scale threshold based on query length

Short queries need stricter thresholds because there's less signal. Something like:

```typescript
const autoThreshold = 0.5 / query.length; // 0.25 for 2-char, 0.1 for 5-char, etc.
```

**Pros:** Adapts automatically.
**Cons:** Magic formula, hard to explain to users, might surprise people.

### Option C: Relative cutoff (percentage of top score)

Only return results within some fraction of the best score:

```typescript
const topScore = results[0].score;
const filtered = results.filter(r => r.score >= topScore * 0.3);
```

**Pros:** Self-calibrating — if the best match is 0.8, you keep results above 0.24.
**Cons:** If there's no good match, everything is garbage and you'd still return it all. Also requires sorting before filtering (perf hit).

### Option D: Fix the fuzziness behavior itself

Make the fuzziness penalty more aggressive so fewer items get non-zero scores. Currently with fuzziness 0.2, `fuzzyFactor = 0.8`, and each missed character just adds 0.8 to a divisor. Even with all 4 characters missed, score can still be non-zero.

Could change the algorithm so that if more than X% of query characters are missed, score is forced to 0.

**Pros:** Fixes the problem at the source.
**Cons:** Changes the scoring algorithm behavior, might break the "light typo tolerance" that fuzziness is supposed to provide.

### Option E: Combination approach

Use both a minScore AND scale it:
```typescript
const effectiveMinScore = options.minScore ?? Math.max(0.1, 0.3 / Math.sqrt(query.length));
```

## What Other Libraries Do

- **Fuse.js**: `threshold` option (default 0.6, where 0 = perfect match only, 1 = match anything). Fuse scores are inverted (lower = better), so threshold 0.6 means "only return results with score < 0.6". This is effectively a minScore.
- **MiniSearch**: Returns only documents that contain at least one indexed term. Token-based, so naturally limits results.
- **uFuzzy**: Only returns items that match ALL query characters in sequence (no fuzziness by default). Very selective.
- **Lunr**: Token-based, only returns documents containing matching terms.

Fuse.js is the closest comparison. Their default threshold (0.6) is quite aggressive at filtering.

## Decisions (2026-02-09)

### Framing: seaq is a type-ahead library

The primary use case is type-ahead / autocomplete. Nobody scrolls through 9,756 results. A dropdown shows 5–15 items and the user types more to narrow down. This reframes the problem from "what score threshold eliminates garbage?" to "how many results does anyone actually want?"

### Chosen approach: relative cutoff + default limit

1. **Default `limit: 10`** — changed from unlimited. Biggest single improvement. Uses existing O(n log k) min-heap, so it's a perf win too.

2. **New `threshold` option** (default `0.3`) — *relative* cutoff as a fraction of the top score. If the best match scores 0.80, only results scoring ≥ 0.80 × 0.3 = 0.24 are kept. Self-calibrating: no magic absolute number that breaks on different query lengths or data shapes.

3. **Perf cost: ~zero.** Track `maxScore` as a running max during the existing scoring loop (one comparison per item, free). Filter with a single O(n) pass before the heap.

4. **Escape hatch:** `limit: Infinity, threshold: 0` restores old behavior. But no one needs 9,756 results.

### Why relative over absolute

- Absolute `minScore: 0.2` kills "btn" → Button.tsx (scores 0.093) — false negative.
- Relative `threshold: 0.3` with top score 0.114 → cutoff 0.034 → keeps Button.tsx. Self-adjusts.
- Short queries on long strings produce low absolute scores. Relative handles this naturally.

### Why NOT a smarter fuzziness algorithm

Changing string_score's penalty math risks breaking the core algorithm's tuning (consecutive bonuses, acronym detection, etc). A post-scoring filter is isolated and predictable. The "tsconfig > Button.tsx" scoring quirk (Issue 2 in Root Cause Analysis) is a separate bug to fix later.

### Open questions (resolved)

1. ~~Should `minScore` be a new option?~~ → Yes, as `threshold` (relative to top score).
2. ~~What default?~~ → `0.3` (30% of top score). Works for all tested scenarios.
3. ~~Is tsconfig > Button.tsx a separate bug?~~ → Yes, defer. Threshold + limit makes it less visible.
4. ~~Max missed characters approach?~~ → No, too coupled to algorithm internals.

## Implementation (2026-02-09) — DONE

### What changed

**`packages/core/src/Seaq.ts`:**
- `SeaqOptions.threshold` added (default `0.3`)
- `SeaqOptions.limit` default changed from `undefined` to `10`
- `scoreItems()` now returns `{ items, maxScore }` — tracks max score during existing loop
- After scoring: `cutoff = maxScore * threshold`, then `scored.filter(m => m.score >= cutoff)` before heap/sort

**`packages/core/test/seaq.test.ts`:**
- Existing tests that check exact result counts now pass `limit: Infinity, threshold: 0`
- New test suites: `threshold option` (4 tests), `default limit` (2 tests)

**`packages/core/test/perf/benchmark.test.ts` and `why-seaq.test.ts`:**
- Perf comparison tests use `limit: Infinity, threshold: 0` for fair apple-to-apple counting

**`packages/examples/`:**
- `SeaqConfig` has `threshold` field, default config is `{ limit: 10, threshold: 0.3 }`
- Threshold slider added to seaq's config panel in the example app
- `searchSeaq()` passes `threshold` through to the seaq call

### Results

All 220 tests pass. The "nath" query on 10K contacts now returns ~10 relevant Nathans by default instead of 9,756 items.

### Remaining issues

- **"tsconfig.json > Button.tsx" scoring quirk** — see Issue 2 deep-dive below.

## Issue 2 Deep-Dive: False Consecutive Bonus After Fuzzy Skip

### Precise trace

**"btn" vs `tsconfig.json`** (length 13, fuzziness 0.2, fuzzyFactor 0.8):

| Query char | Found? | Index | startAt | Bonus | charScore |
|---|---|---|---|---|---|
| `b` | NO | — | 0 → 0 | fuzzies += 0.8 → 1.8 | 0 |
| `t` | yes | 0 | 0 → 1 | **consecutive** (startAt=0 === idxOf=0) + case match | 0.8 |
| `n` | yes | 6 | 1 → 7 | case match only | 0.2 |

`runningScore = 1.0`
`finalScore = 0.5 * (1.0/13 + 1.0/3) / 1.8 = 0.114`

**"btn" vs `src/components/Button.tsx`** (length 25, fuzziness 0.2):

| Query char | Found? | Index | startAt | Bonus | charScore |
|---|---|---|---|---|---|
| `b` | yes | 15 | 0 → 16 | non-consecutive, no case match (B≠b) | 0.1 |
| `t` | yes | 17 | 16 → 18 | non-consecutive, case match | 0.2 |
| `n` | yes | 20 | 18 → 21 | non-consecutive, case match | 0.2 |

`runningScore = 0.5`
`finalScore = 0.5 * (0.5/25 + 0.5/3) / 1.0 = 0.093`

**Result: tsconfig.json (0.114) > Button.tsx (0.093)** — wrong ranking.

### Root cause: the bug

In `string_score.ts`, when a query character is NOT found (fuzzy skip), `startAt` is not advanced. The next character that IS found can then satisfy the `startAt === idxOf` check and receive the **0.7 consecutive bonus** — even though it's "consecutive" with a character that was *skipped*, not matched.

```typescript
// string_score.ts:65-71
if (idxOf === -1) {
  fuzzies += fuzzyFactor;       // startAt stays unchanged!
} else {
  if (startAt === idxOf) {
    charScore = 0.7;            // ← false consecutive bonus
  }
```

For "btn" vs "tsconfig.json":
- `b` not found → startAt stays 0
- `t` found at index 0 → `startAt (0) === idxOf (0)` → **0.7 bonus**

The algorithm is rewarding `t` for being "consecutive" with a character that didn't match. Meanwhile Button.tsx — which matches ALL three characters — gets no consecutive bonus because the matches aren't adjacent in the string.

### Two compounding factors

1. **The bug (primary):** False consecutive bonus after fuzzy skip. tsconfig gets 0.8 charScore for `t` vs Button.tsx's 0.1 for `b`. This alone accounts for most of the ranking inversion.

2. **Short-string bias (secondary):** The formula `0.5 * (runningScore/strLength + runningScore/wordLength)` divides by strLength. tsconfig (13) gets a ~2x advantage over Button.tsx (25) for the same runningScore. This is a reasonable heuristic for equal-quality matches but amplifies garbage matches on short strings.

### Fix: suppress consecutive bonus after fuzzy skip

Track whether the previous query character was found. If it was skipped via fuzziness, the next found character should NOT receive the consecutive bonus — it gets the base 0.1 score instead.

Expected impact: tsconfig's `t` drops from 0.8 → 0.2 (base + case match), giving `runningScore = 0.4`, `finalScore ≈ 0.044`. Button.tsx stays at 0.093. Correct ranking restored.

## Further Scoring Improvements — Research Findings (2026-02-09)

### The final score formula

```
finalScore = 0.5 * (runningScore/strLength + runningScore/wordLength) / fuzzies
              ^^^    ^^^^^^^^^^^^^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^^^
           50/50 avg   "target coverage"       "query satisfaction"

if (query[0] === target[0]) finalScore += 0.15   // first-letter bonus
```

Four potential improvements were investigated. Ordered from safest/highest-impact to most invasive.

---

### A. Minimum match ratio (easiest win after threshold+limit)

With fuzziness 0.2, even matching 2/6 query characters produces a nonzero score. The threshold+limit defaults mask this in practice, but the underlying scores are still misleading.

Measured data — query "rocket" (6 chars), fuzziness 0.2:

| Target | Score | Chars matched | Ratio |
|---|---|---|---|
| rocket | 1.000 | 6/6 | 100% |
| rocker | 0.520 | 5/6 | 83% |
| rock | 0.406 | 4/6 | 67% |
| red heart | 0.199 | 3/6 | 50% |
| check mark | 0.013 | 2/6 | 33% |

Query "btn" (3 chars), fuzziness 0.2:

| Target | Score | Chars matched | Ratio |
|---|---|---|---|
| Button.tsx | 0.388 | 3/3 | 100% |
| tsconfig.json | 0.046 | 2/3 | 67% |
| test.ts | 0.018 | 1/3 | 33% |

A 50% match ratio floor would kill `check mark` and `test.ts` while keeping everything else. Could be a new option or hardcoded as a function of fuzziness.

**Pros:** Cheapest change — just count found chars in the fuzzy loop and zero the score if below the floor. Targeted at the worst garbage.
**Cons:** Another knob to tune. Interaction with existing `threshold` option could confuse users (threshold is relative, this would be absolute). Could also be argued that threshold+limit already handles this case well enough in practice.

---

### B. Formula rebalancing — reduce short-string bias

The `runningScore / strLength` term creates steep score cliffs as target strings get longer. Same query, same match quality, wildly different scores:

Query "btn", fuzziness 0, all chars found in all targets:

| Target | Length | Score | Relative to shortest |
|---|---|---|---|
| btn.ts | 6 | 0.750 | 1.0x |
| Button.tsx | 10 | 0.388 | 0.5x |
| src/Button.tsx | 14 | 0.101 | 0.1x |
| src/components/Button.tsx | 25 | 0.093 | 0.1x |

The 8x spread between 6-char and 25-char targets is driven by the 50/50 weighting. Rebalancing reduces it:

| Formula | btn.ts | Button.tsx | src/.../Button.tsx | Spread |
|---|---|---|---|---|
| Current 50/50 | 0.750 | 0.388 | 0.093 | 8.0x |
| 30/70 | 0.830 | 0.440 | 0.123 | 6.7x |
| Query-only | 0.950 | 0.517 | 0.167 | 5.7x |

**Pros:** 30/70 narrows the gap by ~30%. Scores shift by 5-15%, small enough that existing threshold tuning still works. Intuition preserved (shorter matches still score higher).
**Cons:** Changes every score in the system. Needs careful regression testing. Query-only goes too far — 0.95 for a 3/6 char match on "btn.ts" is inflated.

---

### C. Gap penalty (currently missing)

The algorithm has a consecutive bonus (0.7 vs 0.1 base) but **no penalty for gaps** between matched characters. Only total target length matters.

Measured data — query "abc", fuzziness 0:

| Target | Description | Score |
|---|---|---|
| abcdef | tight (span 3) | 0.750 |
| a_b_c_d | small gaps (span 5) | 0.436 |
| a____b____c | large gaps (span 11) | 0.405 |
| aXXXXbXXXXc | same but letters (span 11) | 0.405 |

`a____b____c` and `aXXXXbXXXXc` score identically — the filler characters are irrelevant, only target length matters. A true gap penalty would differentiate tight clusters from scattered matches regardless of total string length.

Surprising finding: query "hel" against 9-char targets:
- `hexagonal` → **0.550** ("he" consecutive)
- `h_e_l_l_o` → **0.417** (no consecutive chars)

The consecutive bonus is doing *some* gap-awareness work, but only for immediately adjacent matches. It can't distinguish "small gap" from "huge gap."

**Pros:** Would better rank tight matches vs scattered ones. Makes path-style targets work more intuitively.
**Cons:** Adds per-character computation in the hot loop. Changes the character of the algorithm. Needs extensive testing.

---

### D. Match density as an alternative metric

Instead of `runningScore / strLength` ("what fraction of the target did you cover?"), use `runningScore / matchSpan` where matchSpan = lastMatchIdx - firstMatchIdx + 1 ("how dense are the matches in the matched region?").

Measured data — query "btn", fuzziness 0:

| Target | Score | Positions | Span | Density |
|---|---|---|---|---|
| Button.tsx | 0.388 | [0,2,5] | 6 | 0.183 |
| big_button.tsx | 0.393 | [0,6,9] | 10 | 0.120 |
| abstract_notion.js | 0.117 | [1,3,9] | 9 | 0.067 |

Density separates these more cleanly than the current score. `Button.tsx` (0.183 density) vs `abstract_notion.js` (0.067) is a 2.7x ratio, vs the current score's 3.3x — but density is driven by match quality, not string length.

**Pros:** Conceptually clean — measures match quality in the region where matching happens, ignoring irrelevant prefix/suffix length. Would solve the path-length problem naturally.
**Cons:** Most invasive change. Requires tracking first/last positions (already available when `positions` array is passed, but would need to be added to the no-positions path). Changes the entire scoring profile. Probably a "v2 scoring" change rather than an incremental fix.

---

### Recommendation & Status

1. **DONE:** Consecutive bonus bug fix (Issue 2) + threshold+limit defaults
2. **DONE:** Minimum match ratio (A) — if >50% of query chars missed, score is forced to 0. Kills worst fuzzy garbage (e.g., "check mark" for "rocket" with 2/6 chars).
3. **DONE:** Formula rebalancing to 30/70 (B) — query satisfaction now 70%, target coverage 30%. Narrows short-vs-long score spread from 8x to ~6.7x.
4. **UP NEXT:** DP optimal matching + gap penalties (C/D combined) — the fzy-style two-matrix DP rewrite. Gap penalties come naturally as part of the DP recurrence, so C and D are one project.
5. **LATER (if needed):** Extended boundary detection (slash, dot, underscore, camelCase). Less urgent for seaq's primary use case (type-ahead on object lists, not file paths). Worth revisiting if seaq gets adopted for file-finder or command-palette scenarios.

---

## Performance Note: Query-Length Scaling Inversion (2026-02-09)

The threshold+limit defaults (step 1) shifted the performance bottleneck from post-processing to per-item scoring, inverting the query-length performance curve.

**Before (no limit, no threshold) — from BENCHMARKS.md snapshot:**

| Query | ops/s | Bottleneck |
|---|---|---|
| Short "na" | 432 | Sorting 9000+ results |
| Medium "nath fe" | 546 | Less results to sort |
| Long "natasha okeefe" | 532 | Even fewer results |

Short queries were *slowest* because they matched nearly everything, producing huge arrays that needed O(n log n) sorting.

**After (limit: 10, threshold: 0.3, match ratio, 30/70 formula):**

| Query | ops/s | Bottleneck |
|---|---|---|
| Short "na" | 505 | `string_score` loop (2 `indexOf`/call) |
| Medium "nath fe" | 372 | `string_score` loop (7 `indexOf`/call) |
| Long "natasha okeefe" | 264 | `string_score` loop (14 `indexOf`/call) |

With limit 10 + heap, post-processing is O(n log 10) ≈ O(n) regardless of match count. Now the dominant cost is the `string_score` inner loop, which runs `wordLength` iterations × 20K calls (10K items × 2 fields). Short queries got ~17% faster, long queries got ~50% slower.

**Net assessment:** Short queries (the common case in type-ahead) got faster. Long queries regressed but are still well under the 4ms threshold for perceptible lag on 10K items. Not actionable as a bug, but worth considering pre-filter or early-bail optimizations to recover some of the long-query performance.

---

## Industry Research: How Other Tools Score (2026-02-09)

### The landscape

Every serious fuzzy finder we surveyed uses a fundamentally different approach from seaq's greedy `indexOf` scan. Here's how the established tools work, and what seaq can learn from them.

### Algorithm comparison

| Tool | Algorithm | Gap model | Length handling | Optimal alignment? |
|---|---|---|---|---|
| **seaq** | Greedy L-to-R indexOf | None | Baked into score formula | No |
| **fzf** | Smith-Waterman DP (2 matrices) | Affine: -3 open, -1/ext | Tiebreaker only | Yes |
| **fzy** (GitHub.com) | Gotoh DP (2 matrices) | Linear: -0.01 inner, -0.005 leading/trailing | Gap penalties only | Yes |
| **Sublime Text** | Recursive exhaustive | Indirect: -1/unmatched char | Unmatched penalty | Yes (v2) |
| **VS Code** | DP matrix | -5 break consecutive, no extension cost | Not in core score | Yes |
| **Command-T** (vim) | Recursive + memoization | Path-segment weighted | Tiebreaker only | Yes |
| **Fuse.js** | Bitap (bitmask) | None (counts total errors) | Token-based `1/sqrt(n)` | N/A (different model) |
| **uFuzzy** | Multi-phase regex | Stat-based: `intraIns`/`interIns` | Not normalized | N/A (filter+sort) |
| **match-sorter** | Categorical tiers | None | None | N/A (tier-based) |

### Key finding: everyone has gap penalties except seaq and Fuse.js

The universal pattern is clear: **all tools that produce good rankings penalize gaps between matched characters.** The approaches differ, but the principle is consistent:

**fzf — Affine gap penalty (gold standard):**
```
scoreMatch         = 16     // per matched character
scoreGapStart      = -3     // penalty for opening a new gap
scoreGapExtension  = -1     // penalty for each additional gap char
```
A gap of 1 costs -3, a gap of 5 costs -7, a gap of 10 costs -12. The "start" penalty means lots of small gaps are worse than one big gap — matching the intuition that "scattered across the string" is worse than "one tight cluster with a prefix."

**fzy — Linear gap penalty with zones:**
```
SCORE_GAP_LEADING  = -0.005   // before first match (mild)
SCORE_GAP_INNER    = -0.01    // between matches (2x leading)
SCORE_GAP_TRAILING = -0.005   // after last match (mild)
```
Inner gaps cost 2x what leading/trailing gaps cost. This means matches that cluster together score higher regardless of where they appear in the string.

**Sublime Text — Indirect penalty via unmatched chars:**
```
unmatched_letter_penalty = -1    // per unmatched character in target
sequential_bonus         = 15   // for consecutive matched chars
```
No explicit gap penalty, but the `unmatched_letter_penalty` achieves a similar effect — every non-matched character drags the score down.

**VS Code — Consecutive break penalty:**
```
gap_after_consecutive = -5    // heavy penalty for breaking a run
gap_at_separator      = -3    // lighter penalty at word boundaries
gap_extension         = 0     // no per-char extension cost
```
Unique approach: only penalizes *starting* a gap, and penalizes it more if you're breaking a consecutive run. Once a gap starts, extending it is free.

### Key finding: everyone uses optimal matching except seaq

seaq's greedy `indexOf` scan finds the *first* occurrence of each query character. Every other tool uses DP or recursive search to find the *best* positions.

**Why this matters:** Searching "abc" in "axbxabc":
- seaq matches positions [0, 2, 4] — scattered, no consecutive bonus
- DP-based tools match [4, 5, 6] — perfect consecutive run, maximum score

The DP approach (fzf, fzy, VS Code) uses two matrices:
- **M[i][j]**: best score for matching `query[0..i]` against `target[0..j]`
- **D[i][j]**: best score ending with `query[i]` matched to `target[j]` (tracks consecutive runs)

For seaq's typical workload (queries < 10 chars, targets < 100 chars), the DP cost is `O(m*n)` ≈ 1000 operations — trivially fast.

### Key finding: character class awareness goes beyond spaces

seaq only detects word boundaries via `rawString[idxOf - 1] === ' '`. Here's what others recognize:

| Boundary type | fzf bonus | fzy bonus | Sublime bonus | seaq bonus |
|---|---|---|---|---|
| After whitespace | 10 | 0.8 | 30 | 0.8 |
| After `/` | 9 | 0.9 | — | — |
| After `_`, `-` | 8 | 0.8 | 30 | — |
| After `.` | 8 | 0.6 | — | — |
| CamelCase (lower→upper) | 7 | 0.7 | 30 | — |
| Start of string | 10 (2x multiplier) | implicit | 15 | 0.15 |

The slash bonus is particularly valuable for file paths — seaq's primary use case in command palettes and file finders. "btn" matching the "B" in `src/components/Button.tsx` should get a boundary bonus because `B` follows `/`, but seaq gives it a base 0.1.

### Key finding: length normalization should be a tiebreaker, not part of the score

seaq's formula `0.5 * (runningScore/strLength + runningScore/wordLength)` bakes target length into the core score. Every other tool handles length differently:

- **fzf, Command-T:** Length is a *tiebreaker* — only consulted when scores are equal. Score itself is purely about match quality.
- **fzy:** Gap penalties implicitly favor shorter strings (more unmatched chars = more gaps), but length is not divided into the score.
- **Sublime Text:** `unmatched_letter_penalty = -1` per unmatched char penalizes length, but the penalty is tiny relative to match bonuses (15-30 per char).

The tiebreaker approach is superior because it lets match quality dominate the ranking while still preferring shorter strings as a secondary signal.

### Fuse.js: a cautionary tale

Fuse.js is seaq's most direct competitor and shares some of the same weaknesses:
- Uses the Bitap algorithm (bitmask-based, max 32-char patterns).
- Score formula: `accuracy + proximity / distance` where accuracy = errors/patternLength. Lower is better.
- **No gap penalty** — counts total errors but doesn't distinguish scattered from clustered.
- **No word boundary awareness** — "JS" gets no acronym boost for "JavaScript".
- **Multi-field scoring is multiplicative** — more matching fields can paradoxically *hurt* the score.
- **Location bias** — default `distance: 100` heavily penalizes matches far from string start.

Fuse.js is widely used (39K GitHub stars) but widely criticized for ranking quality. seaq already outperforms it on acronyms; the scoring improvements above would widen that gap further.

### uFuzzy: interesting stat-based alternative

uFuzzy takes a completely different approach — no continuous score, just stats-based sorting:
```js
sort: (ia, ib) => (
    chars[ib] - chars[ia] ||          // 1. most contiguous chars
    intraIns[ia] - intraIns[ib] ||    // 2. least intra-fuzz
    terms[ib] - terms[ia] ||          // 3. most full term matches
    interIns[ia] - interIns[ib] ||    // 4. least inter-term fuzz
    start[ia] - start[ib] ||          // 5. earliest start
    ...
)
```
This multi-criterion sort is transparent and predictable. However, it has no typo tolerance by default, and the lack of a numeric score makes cross-query comparison impossible.

### match-sorter: categorical ranking

match-sorter uses discrete tiers (7 = exact, 6 = case-insensitive equal, 5 = starts-with, 4 = word-starts-with, 3 = contains, 2 = acronym, 1 = subsequence, 0 = no match). Simple, predictable, but coarse — no differentiation within tiers, and no typo tolerance at all.

### What this means for seaq

The research reveals **five gaps** between seaq and the tools users consider "good at ranking," ordered by impact:

1. **No gap penalty.** Every well-regarded tool penalizes scattered matches. seaq treats a gap of 1 char identically to a gap of 50 chars (both get `charScore = 0.1`). An affine model (fzf-style) or even a simple linear penalty (fzy-style) would dramatically improve ranking quality.

2. **Greedy matching misses better alignments.** A fzy-style two-matrix DP would find optimal positions for each query character. The cost is O(m*n) which is trivial for seaq's workload.

3. **Limited boundary detection.** Adding camelCase, slash, underscore, hyphen, and dot detection (on top of the existing space detection) would improve ranking for file paths, identifiers, and variable names — seaq's core use cases.

4. **Length baked into score.** Moving target length out of the score formula and into a tiebreaker would stop short strings from outranking better matches in longer strings.

5. **Weak first-character signal.** fzf doubles the boundary bonus for the first matched character. Sublime gives +15. seaq's flat +0.15 is comparatively weak and only fires when the first char of the query matches the first char of the target.

### Sources

- [fzf algo.go](https://github.com/junegunn/fzf/blob/master/src/algo/algo.go) — scoring constants, bonus system, affine gaps
- [fzy ALGORITHM.md](https://github.com/jhawthorn/fzy/blob/master/ALGORITHM.md) — Gotoh DP approach, gap zones
- [fzy.js source](https://github.com/jhawthorn/fzy.js/blob/main/index.js) — JS implementation with constants
- [Forrest Smith: Reverse Engineering Sublime Text's Fuzzy Match](https://www.forrestthewoods.com/blog/reverse_engineering_sublime_texts_fuzzy_match/) — v1 vs v2 algorithm, scoring constants
- [fts_fuzzy_match source](https://github.com/forrestthewoods/lib_fts/blob/master/code/fts_fuzzy_match.js) — JS implementation
- [VS Code filters.ts](https://github.com/microsoft/vscode/blob/main/src/vs/base/common/filters.ts) — fuzzyScore DP
- [VS Code fuzzyScorer.ts](https://github.com/microsoft/vscode/blob/main/src/vs/base/common/fuzzyScorer.ts) — path-aware scoring
- [nucleo (Helix editor)](https://github.com/helix-editor/nucleo) — faithful fzf reimplementation in Rust
- [frizbee](https://github.com/saghen/frizbee) — SIMD Smith-Waterman, combines fzf scoring with fzy bonuses
- [Fuse.js scoring theory](https://www.fusejs.io/concepts/scoring-theory.html) — Bitap + computeScore formula
- [uFuzzy source](https://github.com/leeoniya/uFuzzy) — multi-phase regex, stat-based sort
- [match-sorter](https://github.com/kentcdodds/match-sorter) — categorical tier ranking
- [command-score (Superhuman)](https://github.com/superhuman/command-score) — string_score fork with word-jump vs char-jump distinction
- [QuickScore](https://github.com/fwextensions/quick-score) — Quicksilver port with optimal match finding
- [string_score (joshaven)](https://github.com/joshaven/string_score) — original algorithm seaq is based on
- [objc.io: A Fast Fuzzy Search](https://www.objc.io/blog/2020/08/18/fuzzy-search/) — Smith-Waterman adapted for file search
