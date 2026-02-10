# Codex Perf Review

## 1) Basic Analysis of Current Change

The quality fix is correct and valuable. Cross-field multi-word matching now works in `fieldMode: "separate"` and keeps important old behavior from Path A.

The regression is mostly mechanical:

- Before: ~`fields` calls to `string_score` per item.
- After (multi-word): ~`fields + (tokens * fields)` calls per item.
- Example (`2 fields`, `2 tokens`): `2 -> 6` calls/item, which matches the observed `~2.75x` slowdown.

Main conclusion:

- Current approach is quality-correct but cost-dominant in Path B.
- Fix direction should be to run Path B less often and stop Path B early when it cannot beat the current cutoff.

High-value optimizations without changing behavior:

- Evaluate Path A first, then skip Path B when Path B upper bound cannot beat `max(pathA, threshold, currentTopKCutoff)`.
- In Path B, process tokens in hard-first order and early-abort when remaining tokens cannot recover enough score.
- Add cheap per-pair reject checks before `string_score` (character presence, length bounds, simple subsequence feasibility).
- Compute `includeMatches` positions only for finalists, not for every scored call.

## 2) If Building From Scratch

I would not model this as "Path A + Path B" over every item. I would build a staged retrieval pipeline:

1. Prepare an index once per list.
- Normalize per-field strings (lowercase, trimmed).
- Store cheap signatures per field/item (character bitset, length, optional small n-gram signature).
- Build a lightweight inverted structure for token lookup across all fields.

2. Query planning.
- Parse query into tokens and phrase form.
- Estimate token selectivity (rare tokens first).
- Decide whether query is likely phrase-heavy, token-heavy, or mixed.

3. Candidate generation (fast, broad).
- Use inverted lookup / signatures to get a candidate set.
- Require partial token coverage for multi-word queries.
- Avoid full scan where possible.

4. Candidate scoring (expensive, narrow).
- Run full `string_score` only on candidates.
- Score both phrase and token coverage in one scorer over a virtual item view (all fields + field boundaries).
- Keep exact semantics for concatenated abbreviations and phrase-in-field matches.

5. Late match detail extraction.
- Compute highlight positions only for final returned items.

Why this is better:

- Full-scan + full-scoring is replaced by "cheap filter first, expensive scoring later".
- `string_score` calls become proportional to candidate count, not list size times token/field combinations.
- Multi-word cross-field quality is native to the scoring model instead of a fallback pass.
