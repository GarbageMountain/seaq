# Codex Clean-Sheet Review: Seaq Architecture and Scoring

Date: 2026-02-10
Scope: Holistic redesign thinking. No existing implementation choices are treated as sacred.

## 1. Desired Outcome

Primary product outcome:

- Multi-word queries must match across fields in `fieldMode: "separate"` quality scenarios (for example `"helen green"` over `{givenName, familyName}`).

Primary performance outcome:

- Avoid the current `~2.75x` regression on multi-word separate mode queries.

Operational constraints from current behavior:

- Keep good acronym and abbreviation behavior.
- Keep single-word query speed strong.
- Keep nested key and array traversal support.
- Keep `includeMatches` highlight output capability.
- Keep a simple API for zero-setup use.

## 2. What the Current Design Is Optimizing

Current engine is a scan-and-score function:

- No index.
- For each item, score field strings with `string_score`.
- Threshold and limit reduce output cost after scoring.

This design is strong for:

- Simplicity.
- Cold start.
- Small to medium list sizes.

The regression appears because multi-word separate mode now performs:

- Path A: full query vs each field.
- Path B: each token vs each field.

With `F` fields and `T` tokens, calls per item become roughly `F + T*F`.
For `F=2`, `T=2`, this is `2 -> 6` calls per item.
The measured slowdown matches this mechanical increase.

## 3. Root Technical Insight

This is not mainly a "bad constant factor" issue.
It is a retrieval architecture issue.

Today, expensive character-level scoring runs on almost all item-field pairs.
Cross-field quality was added by increasing expensive scoring volume.

A clean-sheet design should instead:

- Generate candidates cheaply first.
- Run expensive character-level scoring on far fewer candidates.
- Compute highlight positions only for finalists.

That shift is what changes the scaling shape.

## 4. Is `string_score` the Best Core Primitive?

Short answer:

- `string_score` is a good reranker primitive.
- `string_score` is a poor first-stage retrieval primitive at scale.

Why it is good:

- Strong subsequence matching behavior.
- Good acronym behavior from word-start bonuses.
- Familiar scoring behavior with existing test expectations.

Why it is expensive as first-stage:

- Per-call repeated lowercase and `indexOf` scans.
- Called across many item-field pairs that were never serious candidates.
- Includes work for `positions` even when most candidates are discarded.

Clean-sheet recommendation:

- Keep `string_score` semantics as a late-stage scorer initially.
- Move retrieval to fast token/signature structures.
- Later decide whether to keep, evolve, or replace the reranker.

## 5. Clean-Sheet Architecture Options

## Option A: Scan-only Unified Scorer (No Index)

Design:

- Keep full list scan.
- Replace Path A + Path B with one unified scorer that considers:
  - full query continuity
  - token coverage across fields
  - acronym and boundary bonuses
- Use strict early-abort bounds in one pass.

Pros:

- Minimal API change.
- Lower complexity than full indexing.

Cons:

- Still fundamentally `O(N)` per query.
- Hard to make this dramatically faster than today for 10K+ in worst case.

When to choose:

- If "no prepare step ever" is a hard product requirement.

## Option B: Prepared Index + Candidate Rerank (Recommended)

Design:

- Add a `prepare` path that compiles list + keys once.
- Query execution becomes:
  1. Parse query into tokens and structure.
  2. Generate candidate IDs from fast indices/signatures.
  3. Run expensive scorer only on candidate set.
  4. Compute match positions only for top results.

Pros:

- Large reduction in expensive scoring calls.
- Better asymptotic behavior on repeated searches and typeahead.
- Most robust path to both quality and speed.

Cons:

- More code and memory.
- Index build/refresh logic required.

When to choose:

- If repeated queries are common (UI typing, filtering, command palettes, search pages).

## Option C: Hybrid Engine (Default Auto)

Design:

- Keep a pure function fast path for small lists.
- Auto-switch to prepared mode above a size threshold or after repeated queries.

Pros:

- Best practical UX for both tiny and larger datasets.
- Preserves low-friction onboarding.

Cons:

- More moving parts and heuristics.

When to choose:

- If you want one API that scales from 20 items to 100K items.

## 6. Recommended From-Scratch Design

Recommended direction: Option C with Option B as the main engine.

### 6.1 API Surface

```ts
// Convenience, keeps current ergonomics
seaq.search(list, query, options?)

// New prepared mode
const engine = seaq.prepare(list, options?)
engine.search(query, options?)
engine.update(nextList) // optional
```

Behavior:

- `search(list, ...)` uses scan mode for small lists.
- `prepare(...).search(...)` is the performance mode.

### 6.2 Indexed Data Model

Per item-field value (normalized once):

- `raw`
- `lower`
- `wordStarts`
- `acronym`
- `charMask` (ASCII bitset, fallback map for non-ASCII)
- optional char position map for reranker acceleration

Global lightweight indices:

- token/prefix index: token -> item IDs
- acronym index: acronym prefix -> item IDs
- optional trigram index for longer tokens

Notes:

- Keep indices lightweight and incremental-friendly.
- Avoid heavy full-text machinery initially.

### 6.3 Query Planner

Parse query into:

- full phrase
- tokens
- token classes (short, medium, long)

Plan routing:

- Single token: prefix/acronym index first, then fallback signature scan.
- Multi-token: intersect/union token postings with recall guardrails.
- If candidate set too small or too large, rebalance plan dynamically.

### 6.4 Candidate Generation

Goal: high recall, cheap compute.

Candidate sources:

- token prefix hits
- acronym hits
- char-mask feasibility (quick reject)
- optional trigram overlap (for long tokens)

Combine sources with:

- weighted union
- minimum token coverage condition (for multi-word queries)
- max candidate cap before rerank

### 6.5 Reranker

First implementation:

- Reuse `string_score` style semantics on candidates only.
- Compute both phrase continuity and token coverage in one scorer.
- Preserve acronym, case, and boundary boosts.

Later evolution:

- Replace `indexOf` search loop with compiled char-position traversal.
- Keep scoring semantics compatible where practical.

### 6.6 Match Position Strategy

Do not compute detailed `positions` during broad scoring.

Approach:

- Stage 1: numeric score only.
- Stage 2: for final `topK` items, recompute winning field path with positions.

This makes `includeMatches` cost proportional to returned results, not list size.

## 7. What to Do About `string_score` Specifically

If retained as reranker, improve it as a compiled scorer:

1. Query compilation:
- lowercase once
- char code array
- token metadata

2. Target compilation:
- lowercase once at index build
- char -> sorted positions map
- precomputed word starts

3. Match loop change:
- replace repeated `indexOf` with "next occurrence after position" lookup
- binary search over char positions or next-position table

4. Keep score model pluggable:
- preserve current bonuses initially
- allow alternate penalty curves and weighting formulas

Expected impact:

- Better constant factors per score call.
- Larger gains when combined with candidate pruning.
- Alone, this is unlikely to fully recover the current multi-word regression.

## 8. Information-Theoretic Shortcuts (Worth Keeping Even in New Design)

Use upper bounds aggressively:

- token char-mask bound
- remaining-token max bound during scoring
- dynamic top-K cutoff bound

If upper bound cannot beat current cutoff, skip deeper scoring.
These bounds can be exact or safely optimistic and still preserve ranking correctness.

## 9. Performance Model

Current multi-word separate mode (example 10K items, 2 fields, 2 tokens):

- ~60K expensive score calls/query.

Candidate-first model example:

- candidate generator narrows to 500-1500 items (5-15%).
- reranker at 2-4 calls per candidate.
- ~1K to ~6K expensive calls/query.

Order-of-magnitude effect:

- Roughly 10x fewer expensive calls in typical non-adversarial queries.
- Worst-case still degrades toward scan behavior, but average interactive performance improves substantially.

## 10. Quality Model

Quality should be validated as explicit behavior, not just score similarity.

Must-pass behavior groups:

- cross-field multi-word
- single-token ranking sanity
- acronym ranking
- typo tolerance
- nested and array paths
- highlighting correctness

A better architecture is acceptable even if internal scores differ, as long as user-visible ranking quality is equal or better on curated sets.

## 11. Suggested Execution Plan

Phase 0: Instrumentation

- Track score-call counts, candidate sizes, per-stage timing, and highlight-cost timing.

Phase 1: Prepared candidate generator

- Build lightweight token/prefix/acronym/signature indices.
- Return candidate IDs only.

Phase 2: Candidate reranker

- Apply current scorer semantics on candidates.
- Add late `includeMatches`.

Phase 3: Compiled scorer optimization

- Add compiled char-position traversal path.
- Keep semantic parity tests.

Phase 4: Hybrid auto mode

- Auto-select scan vs prepared based on list size and query frequency.

## 12. Recommended Product Positioning After Redesign

Position seaq as two-tier:

- Zero-setup mode for small, dynamic lists.
- Prepared mode for repeated queries and larger datasets.

This keeps the original identity while removing the current scaling ceiling.

## 13. Bottom Line

If building seaq from scratch for this outcome, I would not center the architecture on repeated full-scan `string_score` calls.

I would center it on:

- cheap high-recall candidate generation
- expensive high-quality reranking on a reduced set
- late highlight extraction

In that architecture, `string_score` can remain valuable as a reranker or be replaced over time, but it should not be the primary retrieval engine.
