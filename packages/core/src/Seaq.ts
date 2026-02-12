/**
 * Seaq is a Fuzzy searching utility function.
 */
import { string_score } from './string_score';

/**
 * Match metadata for a single scored field.
 */
export interface SeaqMatch {
  /** Field key (separate mode only; undefined for string/joined). */
  key?: string;
  /** The string that was scored. */
  value: string;
  /** Highlight ranges as `[start, end]` pairs (inclusive). */
  indices: [number, number][];
  /** Score for this specific match. */
  score: number;
}

/**
 * A search result with match metadata, returned when `includeMatches: true`.
 */
export interface SeaqResult<T> {
  item: T;
  score: number;
  matches: SeaqMatch[];
}

/**
 * Configuration for {@link seaq} search behavior.
 *
 * All options are optional — calling `seaq(list, query)` with no options
 * searches plain string arrays with light fuzzy matching (fuzziness 0.2).
 */
export interface SeaqOptions<T> {
  /**
   * Object keys to search. Supports:
   * - Simple keys: `['name', 'email']`
   * - Dot notation for nested properties: `['address.city']`
   * - Automatic array traversal: `['tags.name']` walks into arrays at any level
   *
   * Omit when searching a plain `string[]`.
   */
  keys?: Array<Extract<keyof T, string>> | string[];
  /**
   * Fuzziness tolerance for typos, from 0 to 1.
   *
   * - `0.2` (default) — light tolerance, catches minor typos like "jonh" → "john"
   * - `0` — strict mode, every character must match somewhere
   * - `0.5` — moderate tolerance, good general-purpose starting point
   * - `0.8–1` — very loose, matches almost anything (rarely useful)
   */
  fuzziness?: number;
  /**
   * How multi-field scoring works when multiple `keys` are provided.
   *
   * - `'joined'` (default) — concatenates all field values into one string before scoring.
   *   Supports cross-field queries like "john smith" matching firstName="John" + lastName="Smith",
   *   and concatenated prefixes like "helgre" matching "Helen Green".
   * - `'separate'` — scores each field independently and takes the best match.
   *   More precise for single-field queries but cannot match across field boundaries.
   */
  fieldMode?: 'joined' | 'separate';
  /**
   * Maximum number of results to return. Default: `10`.
   *
   * Uses a min-heap internally for O(n log k) selection instead of
   * O(n log n) full sort, so this is significantly faster than sorting
   * everything and calling `.slice(0, n)` on large result sets.
   *
   * Set to `Infinity` to return all matches (not recommended for large lists).
   */
  limit?: number;
  /**
   * Relative score cutoff — results below `topScore * threshold` are dropped.
   *
   * - `0.3` (default) — keeps results scoring at least 30% of the best match
   * - `0` — no filtering, returns everything with score > 0 (old behavior)
   * - `1` — only perfect/near-perfect matches
   */
  threshold?: number;
  /**
   * When `true`, returns {@link SeaqResult} objects with match metadata
   * (character positions, matched value, score) instead of plain items.
   * Useful for building search-result highlighting.
   */
  includeMatches?: boolean;
}

/**
 * Fuzzy search an array of items, returning matches sorted by relevance.
 *
 * Items with a score of 0 (no match) are filtered out. The remaining items
 * are sorted highest-score-first and returned as a new array (the original
 * is never mutated).
 *
 * @param list - Array of objects or strings to search
 * @param query - Search query string. Empty string returns `[]`.
 * @param options - See {@link SeaqOptions} for full details on keys, fuzziness, fieldMode, and limit.
 * @returns Filtered and sorted array of matching items
 *
 * @example
 * // Search objects by specific keys (separate mode + fuzziness 0.2 by default)
 * seaq(contacts, 'john', { keys: ['name', 'email'] })
 *
 * @example
 * // Cross-field matching with joined mode
 * seaq(contacts, 'john smith', { keys: ['firstName', 'lastName'], fieldMode: 'joined' })
 *
 * @example
 * // Strict mode — every character must match, no typo tolerance
 * seaq(contacts, 'john', { keys: ['name'], fuzziness: 0 })
 *
 * @example
 * // Higher fuzziness for more typo tolerance
 * seaq(contacts, 'jonh', { keys: ['name'], fuzziness: 0.5 })
 *
 * @example
 * // Nested property + array traversal
 * seaq(users, 'admin', { keys: ['roles.name'] })
 *
 * @example
 * // Get only top 10 results efficiently
 * seaq(contacts, 'john', { keys: ['name'], limit: 10 })
 *
 * @example
 * // Search a plain string array (no keys needed)
 * seaq(['apple', 'banana'], 'app')
 */
export function seaq<T>(list: Array<T>, query: string, options: SeaqOptions<T> & { includeMatches: true }): SeaqResult<T>[];
export function seaq<T>(list: Array<T>, query: string, options?: SeaqOptions<T>): Array<T>;
export function seaq<T>(list: Array<T>, query: string, options?: SeaqOptions<T>): Array<T> | SeaqResult<T>[] {
  const keys = options?.keys as string[] | undefined;
  const fuzziness = options?.fuzziness === undefined ? 0.2 : options.fuzziness;
  const fieldMode = options?.fieldMode ?? 'joined';
  const limit = options?.limit ?? 10;
  const threshold = options?.threshold ?? 0.3;
  const includeMatches = options?.includeMatches ?? false;

  if (!query.trim()) return [];

  const { items: scored, maxScore } = scoreItems(list, query, keys, fuzziness, fieldMode, includeMatches);

  const cutoff = maxScore * threshold;
  const filtered = cutoff > 0 ? scored.filter((m) => m.score >= cutoff) : scored;

  let sorted: Array<MetaDataItem<T>>;
  if (limit !== undefined && limit > 0 && isFinite(limit)) {
    sorted = getTopN(filtered, limit);
  } else {
    sorted = filtered.sort((a, b) => b.score - a.score);
  }

  if (includeMatches) {
    // Rescore finalists to compute match positions (deferred from scoring phase)
    rescoreWithPositions(sorted, query, keys, fuzziness, fieldMode);
    return sorted.map((m) => ({ item: m.item, score: m.score, matches: m.matches! }));
  }
  return sorted.map((m) => m.item);
}

/**
 * Get top N items by score using a min-heap for efficiency.
 * O(n log k) instead of O(n log n) for full sort.
 */
function getTopN<T>(items: Array<MetaDataItem<T>>, n: number): Array<MetaDataItem<T>> {
  if (items.length <= n) {
    // If we have fewer items than limit, just sort them all
    return items.sort((a, b) => b.score - a.score);
  }

  // Use a min-heap to track top N items
  // The heap stores the N highest-scoring items, with the minimum at the root
  const heap: Array<MetaDataItem<T>> = [];

  for (const item of items) {
    if (heap.length < n) {
      // Heap not full yet, add item
      heapPush(heap, item);
    } else if (item.score > heap[0].score) {
      // Item scores higher than our current minimum - replace it
      heapReplace(heap, item);
    }
    // Otherwise item scores lower than all top N, skip it
  }

  // Extract items from heap in sorted order (highest first)
  const result: Array<MetaDataItem<T>> = [];
  while (heap.length > 0) {
    result.push(heapPop(heap));
  }
  return result.reverse();
}

// Min-heap operations (smallest score at root)
function heapPush<T>(heap: Array<MetaDataItem<T>>, item: MetaDataItem<T>): void {
  heap.push(item);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    if (heap[i].score >= heap[parent].score) break;
    [heap[i], heap[parent]] = [heap[parent], heap[i]];
    i = parent;
  }
}

function heapPop<T>(heap: Array<MetaDataItem<T>>): MetaDataItem<T> {
  const result = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    heapifyDown(heap, 0);
  }
  return result;
}

function heapReplace<T>(heap: Array<MetaDataItem<T>>, item: MetaDataItem<T>): void {
  heap[0] = item;
  heapifyDown(heap, 0);
}

function heapifyDown<T>(heap: Array<MetaDataItem<T>>, i: number): void {
  const len = heap.length;
  while (true) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    let smallest = i;

    if (left < len && heap[left].score < heap[smallest].score) {
      smallest = left;
    }
    if (right < len && heap[right].score < heap[smallest].score) {
      smallest = right;
    }
    if (smallest === i) break;

    [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
    i = smallest;
  }
}

function positionsToRanges(positions: number[]): [number, number][] {
  const ranges: [number, number][] = [];
  let start = positions[0];
  let end = positions[0];
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === end + 1) {
      end = positions[i];
    } else {
      ranges.push([start, end]);
      start = positions[i];
      end = positions[i];
    }
  }
  ranges.push([start, end]);
  return ranges;
}

function rescoreWithPositions<T>(
  items: MetaDataItem<T>[],
  query: string,
  keys: string[] | undefined,
  fuzziness: number | undefined,
  fieldMode: 'joined' | 'separate',
): void {
  const lowerQuery = query.toLowerCase();
  const tokens = (fieldMode === 'separate' && keys && query.includes(' '))
    ? query.split(/\s+/).filter(Boolean)
    : null;
  const lowerTokens = tokens?.map(t => t.toLowerCase()) ?? null;

  for (const meta of items) {
    // Items without _winDesc already have matches computed (non-separate paths)
    if (!meta._winDesc) continue;

    const desc = meta._winDesc;
    const fieldValues = keys!.map(key => ({ key, values: getProperty(meta.item, key) }));

    if (desc.path === 'A') {
      const field = fieldValues[desc.fieldIdx];
      const value = field.values[desc.valueIdx];
      const positions: number[] = [];
      const s = string_score(value, query, fuzziness, lowerQuery, positions);
      meta.matches = [{ key: field.key, value, indices: positionsToRanges(positions), score: s }];
    } else {
      // Path B: rescore each token against its winning field
      const tokenMatches: SeaqMatch[] = [];
      for (let t = 0; t < desc.fieldIndices.length; t++) {
        const { fieldIdx, valueIdx } = desc.fieldIndices[t];
        const field = fieldValues[fieldIdx];
        const value = field.values[valueIdx];
        const positions: number[] = [];
        const s = string_score(value, tokens![t], fuzziness, lowerTokens![t], positions);
        tokenMatches.push({ key: field.key, value, indices: positionsToRanges(positions), score: s });
      }
      meta.matches = tokenMatches;
    }

    delete meta._winDesc;
  }
}

function scoreItems<T>(
  list: T[],
  query: string,
  keys: string[] | undefined,
  fuzziness: number | undefined,
  fieldMode: 'joined' | 'separate',
  includeMatches: boolean,
): { items: Array<MetaDataItem<T>>; maxScore: number } {
  // Pre-lowercase query once instead of per-item
  const lowerQuery = query.toLowerCase();

  // Token splitting for separate mode multi-word queries
  const tokens = (fieldMode === 'separate' && keys && query.includes(' '))
    ? query.split(/\s+/).filter(Boolean)
    : null;
  const lowerTokens = tokens?.map(t => t.toLowerCase());

  const queryMask = charMask(lowerQuery);
  const tokenMasks = lowerTokens?.map(t => charMask(t));

  const result: Array<MetaDataItem<T>> = [];
  let maxScore = 0;

  for (const item of list) {
    let score: number;
    let matches: SeaqMatch[] | undefined;
    let winDesc: WinDescriptor | undefined;

    if (keys) {
      if (fieldMode === 'separate') {
        // Cache field values + lowercased versions + char masks once per item
        const fieldValues = keys.map(key => {
          const values = getProperty(item, key);
          const lowerValues = values.map(v => v.toLowerCase());
          const masks = lowerValues.map(lv => charMask(lv));
          return { key, values, lowerValues, masks };
        });

        // Path A: score full query against each field, take best
        let bestScore = 0;
        let winFieldIdx = 0;
        let winValueIdx = 0;
        for (let fi = 0; fi < fieldValues.length; fi++) {
          const field = fieldValues[fi];
          for (let vi = 0; vi < field.values.length; vi++) {
            // Bitmask pre-filter: O(1) character-set rejection
            // Strict: reject if ANY query char type is missing from value
            if (!fuzziness && (queryMask & ~field.masks[vi]) !== 0) continue;
            // Fuzzy: reject if ZERO char overlap (guaranteed score 0)
            if (fuzziness && (queryMask & field.masks[vi]) === 0) continue;
            const s = string_score(field.values[vi], query, fuzziness, lowerQuery, undefined, field.lowerValues[vi]);
            if (s > bestScore) {
              bestScore = s;
              winFieldIdx = fi;
              winValueIdx = vi;
            }
          }
        }

        // Path B: per-token best-field scoring (only for multi-word queries)
        if (tokens && lowerTokens) {
          // Cheap pre-filter: skip Path B unless every token is a subsequence
          // of at least one field value. This reduces Path B from ~10K items to
          // ~100-300 candidates, cutting string_score calls dramatically.
          let isCandidate = bestScore < 1; // perfect Path A ⇒ Path B can't win
          if (isCandidate) {
            for (let t = 0; t < lowerTokens.length; t++) {
              let tokenFound = false;
              for (let fi = 0; fi < fieldValues.length; fi++) {
                const field = fieldValues[fi];
                for (let vi = 0; vi < field.lowerValues.length; vi++) {
                  // Bitmask gate: if any token char type is absent, subsequence is impossible
                  if ((tokenMasks![t] & ~field.masks[vi]) !== 0) continue;
                  if (hasSubsequence(field.lowerValues[vi], lowerTokens[t])) { tokenFound = true; break; }
                }
                if (tokenFound) break;
              }
              if (!tokenFound) { isCandidate = false; break; }
            }
          }
          if (isCandidate) {
            let tokenScoreSum = 0;
            let tokenFieldIndices: Array<{ fieldIdx: number; valueIdx: number }> | undefined =
              includeMatches ? [] : undefined;
            let bailed = false;
            for (let t = 0; t < tokens.length; t++) {
              let bestTokenScore = 0;
              let bestTokenFieldIdx = 0;
              let bestTokenValueIdx = 0;
              for (let fi = 0; fi < fieldValues.length; fi++) {
                const field = fieldValues[fi];
                for (let vi = 0; vi < field.values.length; vi++) {
                  // Bitmask pre-filter: O(1) character-set rejection
                  if (!fuzziness && (tokenMasks![t] & ~field.masks[vi]) !== 0) continue;
                  if (fuzziness && (tokenMasks![t] & field.masks[vi]) === 0) continue;
                  const s = string_score(field.values[vi], tokens[t], fuzziness, lowerTokens[t], undefined, field.lowerValues[vi]);
                  if (s > bestTokenScore) {
                    bestTokenScore = s;
                    bestTokenFieldIdx = fi;
                    bestTokenValueIdx = vi;
                  }
                }
              }
              tokenScoreSum += bestTokenScore;
              if (includeMatches) {
                tokenFieldIndices!.push({ fieldIdx: bestTokenFieldIdx, valueIdx: bestTokenValueIdx });
              }

              // Early bail: optimistic bound check
              const remaining = tokens.length - (t + 1);
              const optimisticAvg = (tokenScoreSum + remaining) / tokens.length;
              if (optimisticAvg <= bestScore) {
                bailed = true;
                break;
              }
            }
            if (!bailed) {
              // When !bailed, tokenAvg > bestScore is guaranteed: the bail check
              // on the final iteration (remaining=0) would have fired otherwise.
              bestScore = tokenScoreSum / tokens.length;
              if (includeMatches) {
                winDesc = { path: 'B', fieldIndices: tokenFieldIndices! };
              }
            }
          }
        }

        score = bestScore;
        if (includeMatches && !winDesc) {
          winDesc = { path: 'A', fieldIdx: winFieldIdx, valueIdx: winValueIdx };
        }
      } else {
        // Join all field values and score as one string.
        // TODO: consider returning per-field indices for joined mode to make
        // highlighting easier for consumers. Currently indices are relative to
        // the joined string so callers have to reverse-map them back to
        // individual fields. Need to evaluate whether tracking field offsets
        // during scoring adds meaningful overhead.
        const searchString = keys
          .map((key) => getProperty(item, key).join(' '))
          .join(' ');
        const positions: number[] | undefined = includeMatches ? [] : undefined;
        score = string_score(searchString, query, fuzziness, lowerQuery, positions);
        if (includeMatches && score > 0) {
          matches = [{ value: searchString, indices: positionsToRanges(positions!), score }];
        }
      }
    } else if (typeof item === 'string') {
      const positions: number[] | undefined = includeMatches ? [] : undefined;
      score = string_score(item, query, fuzziness, lowerQuery, positions);
      if (includeMatches && score > 0) {
        matches = [{ value: item, indices: positionsToRanges(positions!), score }];
      }
    } else if (typeof item === 'number') {
      const value = String(item);
      const positions: number[] | undefined = includeMatches ? [] : undefined;
      score = string_score(value, query, fuzziness, lowerQuery, positions);
      if (includeMatches && score > 0) {
        matches = [{ value, indices: positionsToRanges(positions!), score }];
      }
    } else {
      const value = JSON.stringify(item);
      const positions: number[] | undefined = includeMatches ? [] : undefined;
      score = string_score(value, query, fuzziness, lowerQuery, positions);
      if (includeMatches && score > 0) {
        matches = [{ value, indices: positionsToRanges(positions!), score }];
      }
    }

    // Only include items with score > 0
    if (score > 0) {
      if (score > maxScore) maxScore = score;
      const meta: MetaDataItem<T> = { item, score, matches };
      if (winDesc) meta._winDesc = winDesc;
      result.push(meta);
    }
  }

  return { items: result, maxScore };
}

/** Check if `token` appears as a character subsequence in `value` (both must be lowercased). */
function hasSubsequence(value: string, token: string): boolean {
  let ti = 0;
  for (let vi = 0; vi < value.length && ti < token.length; vi++) {
    if (value[vi] === token[ti]) ti++;
  }
  return ti === token.length;
}

/**
 * Build a bitmask where bits 0-25 represent a-z presence, bit 26 catches everything else.
 * Enables O(1) character-set containment checks before expensive scoring.
 */
export function charMask(lower: string): number {
  let mask = 0;
  for (let i = 0; i < lower.length; i++) {
    const c = lower.charCodeAt(i) - 97;
    mask |= 1 << (c >= 0 && c < 26 ? c : 26);
  }
  return mask;
}

type WinDescriptor =
  | { path: 'A'; fieldIdx: number; valueIdx: number }
  | { path: 'B'; fieldIndices: Array<{ fieldIdx: number; valueIdx: number }> };

interface MetaDataItem<T> {
  item: T;
  score: number;
  matches?: SeaqMatch[];
  _winDesc?: WinDescriptor;
}

/**
 * Resolve a dot-notation path on an object, collecting all leaf values as strings.
 *
 * Handles nested objects, arrays (traversed automatically), and primitives.
 * For example, given `{ tags: [{ name: 'a' }, { name: 'b' }] }` and path
 * `'tags.name'`, returns `['a', 'b']`.
 *
 * @param obj - The object to read from
 * @param path - Dot-delimited property path, or `null` to stringify `obj` itself
 * @param list - Accumulator array (used internally for recursion)
 * @returns Array of string values found at the path
 */
export function getProperty(obj: any, path: string | null, list: string[] = []): string[] {
  if (!path) {
    // If there's no path left, we've gotten to the object we care about.
    // Fast path for primitives - avoid JSON.stringify
    if (typeof obj === 'string') {
      list.push(obj);
    } else if (typeof obj === 'number' || typeof obj === 'boolean') {
      list.push(String(obj));
    } else if (obj !== null && obj !== undefined) {
      list.push(JSON.stringify(obj));
    }
  } else {
    const dotIndex = path.indexOf('.');
    let firstSegment = path;
    let remaining: string | null = null;

    if (dotIndex !== -1) {
      firstSegment = path.slice(0, dotIndex);
      remaining = path.slice(dotIndex + 1);
    }

    const value = obj[firstSegment];

    if (value !== null && value !== undefined) {
      if (!remaining && (typeof value === 'string' || typeof value === 'number')) {
        list.push(value.toString());
      } else if (Array.isArray(value)) {
        // Search each item in the array.
        for (let i = 0, len = value.length; i < len; i += 1) {
          getProperty(value[i], remaining, list);
        }
      } else if (remaining) {
        // An object. Recurse further.
        getProperty(value, remaining, list);
      } else {
        getProperty(value, null, list);
      }
    }
  }

  return list;
}
