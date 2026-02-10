# Codex V3 Prototype Spec (Opinionated)

Date: 2026-02-10
Purpose: Concrete, buildable spec for a next-gen seaq engine.
Rule: Existing implementation is not privileged.

## 1) Hard Decisions

1. Keep `string_score` for reranking in v3.0.
2. Stop using `string_score` as first-stage retrieval.
3. Introduce a prepared engine with lightweight indexing.
4. Keep scan mode for tiny lists and one-off usage.
5. Compute highlight positions only after final ranking.

Reasoning:

- This gives the fastest path to large performance gains without throwing away current ranking behavior that users already like.

## 2) API Shape

```ts
type SearchOptions<T> = {
  keys?: string[];
  fuzziness?: number;          // default 0.2
  fieldMode?: 'separate' | 'joined'; // default 'separate'
  limit?: number;              // default 10
  threshold?: number;          // default 0.3 (relative to top score)
  includeMatches?: boolean;    // default false
};

declare function seaq<T>(list: T[], query: string, options?: SearchOptions<T>): T[];

declare function prepare<T>(list: T[], options?: Omit<SearchOptions<T>, 'limit' | 'threshold' | 'includeMatches'>): PreparedEngine<T>;

interface PreparedEngine<T> {
  search(query: string, options?: SearchOptions<T>): T[];
  searchWithMatches(query: string, options?: SearchOptions<T>): Array<{ item: T; score: number; matches: any[] }>;
  update(list: T[]): void; // full rebuild in v3.0
}
```

`seaq(...)` behavior:

- `N < 1200`: scan mode.
- `N >= 1200`: auto-prepare per call is not done.
- For repeated searches, caller should use `prepare(...)`.

## 3) Core Architecture

Two-stage pipeline in prepared mode:

1. Candidate generation (cheap, high recall).
2. Candidate reranking (expensive, high precision).

### 3.1 Indexed Structures

For each extracted field value:

- `raw: string`
- `lower: string`
- `fieldId: number`
- `itemId: number`
- `tokens: string[]` (split on `/[\s._-]+/`)
- `acronym: string` (word starts)
- `charMaskLo: uint32`
- `charMaskHi: uint32`

Global indices:

- `tokenExact: Map<string, Posting[]>` where `Posting = { itemId, fieldId, weight }`
- `tokenPrefix3: Map<string, Posting[]>` (first 3 chars of each token)
- `acronymPrefix: Map<string, Posting[]>` (prefix lengths 1..5)

No trigram index in v3.0.
Add trigram only if candidate recall is weak on long tokens.

### 3.2 Query Compilation

Given query:

- `qRaw`
- `qLower`
- `tokens = qLower.trim().split(/\s+/).filter(Boolean)`
- `isAbbrev = tokens.length === 1 && qLower.length <= 5 && /^[a-z0-9]+$/.test(qLower)`
- `tokenPlans[]` with:
  - `token`
  - `prefix3 = token.slice(0, 3)`
  - `idf = ln(1 + N / (1 + dfExactOrPrefix))`

Token processing order:

- Sort by ascending document frequency (rarest first).

## 4) Candidate Generation (Exact Spec)

Goal: Avoid scoring every item.

Per token, gather postings by priority:

1. `tokenExact.get(token)`
2. if empty, `tokenPrefix3.get(prefix3)`
3. if `isAbbrev`, add `acronymPrefix.get(token.slice(0, min(5, token.length)))`

Accumulate per-item stats:

```ts
type CandidateStats = {
  itemId: number;
  tokenMask: number;           // token hit bitset (supports up to 31 tokens in v3.0)
  tokenHits: number;
  fieldMaskByToken: number[];  // bitset of fields that matched each token
  cheapScore: number;          // sum(idf * matchTypeWeight)
};
```

Match type weights:

- exact token: `1.0`
- prefix3: `0.7`
- acronym: `0.85`

Coverage requirement:

- `T=1`: require `1` token hit.
- `T=2`: require `1` token hit.
- `T>=3`: require at least `2` token hits.

Candidate cap:

```ts
candidateCap = clamp(400, 5000, 250 * limit)
```

Defaults:

- `limit=10` -> cap `2500`.

If candidate count > cap:

- keep top `candidateCap` by `cheapScore`.

Fallback:

- if candidate count < `max(40, 4*limit)`, backfill from scan-by-charMask until that minimum is reached.

## 5) Reranking (Exact Spec)

Rerank only candidates from stage 1.

### 5.1 Path Definitions

Path A (phrase intent):

- `A = max_field string_score(fieldValue, fullQuery, fuzziness, lowerFullQuery)`

Path B (cross-field token intent):

For each token `t`:

- score only fields in `fieldMaskByToken[t]`
- if empty mask, fallback to all fields
- `best_t = max_field string_score(fieldValue, token, fuzziness, lowerToken)`

Then:

- `tokenAvg = mean(best_t)`
- `tokenCov = count(best_t >= 0.12) / T`
- `tokenMin = min(best_t)`
- `B = 0.70 * tokenAvg + 0.20 * tokenCov + 0.10 * tokenMin`

Final score:

- `score = max(A, B)`

This keeps:

- concatenated abbreviation strength through Path A.
- cross-field multi-word strength through Path B.

### 5.2 Call-Count Bound

Let:

- `C = candidate count`
- `F = field values per item`
- `T = token count`
- `H = average matched fields per token after stage 1` (`H << F` typically)

Expected expensive calls:

- `C * (F + T*H)` instead of `N * (F + T*F)`.

In common cases with good candidate pruning, this is a large reduction.

## 6) Pruning During Rerank

Per candidate, maintain:

- `cutoff = max(currentTopScore * threshold, currentHeapMinScoreIfHeapFull)`

Token early-abort:

After scoring `k` tokens:

```ts
maxPossibleB = 0.70 * ((sumBest + (T-k)*1.0) / T)
             + 0.20 * ((hitCount + (T-k)) / T)
             + 0.10 * min(currentTokenMinOr1, 1.0)
```

If `maxPossibleB <= cutoff` and `A <= cutoff`, stop scoring this candidate.

This is safe upper-bound pruning.

## 7) includeMatches Strategy

Do not collect positions during stage 1 or regular rerank.

After final top-K chosen:

1. Re-run winning path for each result with `positions`.
2. Build `indices` only for returned items.

For Path B winners:

- return one `SeaqMatch` per token with chosen field and ranges.

For Path A winners:

- return one match on chosen field.

## 8) Why `string_score` Stays in v3.0

Replacing scorer and architecture in one step creates risk.

v3.0 strategy:

- change retrieval architecture now
- keep scoring semantics mostly stable
- measure quality drift explicitly

v3.1+ may replace scorer internals with compiled position maps:

- precompute char positions per field value
- replace repeated `indexOf` with next-position lookup
- keep output score shape aligned via calibration tests

## 9) Default Constants (Locked for Prototype)

```ts
const AUTO_SCAN_MAX_ITEMS = 1199;
const TOKEN_HIT_FLOOR = 0.12;
const CANDIDATE_CAP_MIN = 400;
const CANDIDATE_CAP_MAX = 5000;
const CANDIDATE_CAP_PER_LIMIT = 250;
const BACKFILL_MIN = (limit: number) => Math.max(40, 4 * limit);
const TOKEN_PATH_WEIGHTS = { avg: 0.70, cov: 0.20, min: 0.10 };
const MATCH_TYPE_WEIGHT = { exact: 1.0, prefix: 0.7, acronym: 0.85 };
```

Defaults kept:

- `fuzziness = 0.2`
- `threshold = 0.3` (relative)
- `limit = 10`
- `fieldMode = "separate"`

## 10) Acceptance Criteria

Quality criteria:

- Existing multi-word cross-field cases pass:
  - `"helen green"`
  - `"portland oregon"`
  - `"tolkien rings"`
  - `"john smith"`
  - `"hel gre"`, `"helen g"`, `"h green"`
- Single-word and abbreviation behavior remains strong (`"helgr"` class).
- No regression in highlighting correctness for returned items.

Performance criteria (10K contacts, 2 keys, fuzziness 0):

- `"na"`: within +/-10% of current single-word baseline.
- `"nath fe"` separate mode: target at least `1.7x` faster than current token-path implementation.
- `"natasha okeefe"` separate mode: target at least `1.5x` faster than current token-path implementation.

Instrumentation required:

- candidate count per query
- expensive call count per query
- rerank early-abort rate
- includeMatches post-pass time

## 11) Build Plan

1. Add `prepare()` and index builder.
2. Implement candidate generator with caps/backfill.
3. Implement reranker over candidate IDs.
4. Implement late `includeMatches`.
5. Add instrumentation counters behind debug flag.
6. Add benchmark variants comparing:
   - current engine
   - prepared engine
   - prepared + includeMatches

## 12) Next Decision Gate

After prototype measurements:

- If quality is stable and perf wins hold, make prepared mode official.
- If quality drifts, tune token-path weights and hit floor first.
- If rerank still dominates runtime, move to compiled scorer internals in v3.1.
