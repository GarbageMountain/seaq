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
   * - `'separate'` (default) — scores each field independently and takes the best match.
   *   ~30% faster and more precise than joined mode.
   * - `'joined'` — concatenates all field values into one string before scoring.
   *   Supports cross-field queries like "john smith" matching firstName="John" + lastName="Smith",
   *   but can produce noisy results when query characters scatter across fields.
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
  const fieldMode = options?.fieldMode ?? 'separate';
  const limit = options?.limit ?? 10;
  const threshold = options?.threshold ?? 0.3;
  const includeMatches = options?.includeMatches ?? false;

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

  const result: Array<MetaDataItem<T>> = [];
  let maxScore = 0;

  for (const item of list) {
    let score: number;
    let matches: SeaqMatch[] | undefined;

    if (keys) {
      if (fieldMode === 'separate') {
        // Cache field values once per item to avoid redundant getProperty calls
        const fieldValues: { key: string; values: string[] }[] = keys.map(key => ({
          key,
          values: getProperty(item, key),
        }));

        // Path A: score full query against each field, take best
        let bestScore = 0;
        let bestMatch: SeaqMatch | undefined;
        for (const field of fieldValues) {
          for (const value of field.values) {
            const positions: number[] | undefined = includeMatches ? [] : undefined;
            const s = string_score(value, query, fuzziness, lowerQuery, positions);
            if (s > bestScore) {
              bestScore = s;
              if (includeMatches) {
                bestMatch = { key: field.key, value, indices: positionsToRanges(positions!), score: s };
              }
            }
          }
        }

        // Path B: per-token best-field scoring (only for multi-word queries)
        if (tokens && lowerTokens) {
          let tokenScoreSum = 0;
          let tokenMatches: SeaqMatch[] | undefined = includeMatches ? [] : undefined;
          for (let t = 0; t < tokens.length; t++) {
            let bestTokenScore = 0;
            let bestTokenMatch: SeaqMatch | undefined;
            for (const field of fieldValues) {
              for (const value of field.values) {
                const positions: number[] | undefined = includeMatches ? [] : undefined;
                const s = string_score(value, tokens[t], fuzziness, lowerTokens[t], positions);
                if (s > bestTokenScore) {
                  bestTokenScore = s;
                  if (includeMatches) {
                    bestTokenMatch = { key: field.key, value, indices: positionsToRanges(positions!), score: s };
                  }
                }
              }
            }
            tokenScoreSum += bestTokenScore;
            if (includeMatches && bestTokenMatch) {
              tokenMatches!.push(bestTokenMatch);
            }
          }
          const tokenAvg = tokenScoreSum / tokens.length;
          if (tokenAvg > bestScore) {
            bestScore = tokenAvg;
            if (includeMatches) {
              bestMatch = undefined; // clear Path A match
              matches = tokenMatches;
            }
          }
        }

        score = bestScore;
        if (includeMatches && !matches && bestMatch) {
          matches = [bestMatch];
        }
      } else {
        // Join all field values and score as one string
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
      result.push({ item, score, matches });
    }
  }

  return { items: result, maxScore };
}

interface MetaDataItem<T> {
  item: T;
  score: number;
  matches?: SeaqMatch[];
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
