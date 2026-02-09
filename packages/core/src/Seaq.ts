/**
 * Seaq is a Fuzzy searching utility function.
 */
import { string_score } from './string_score';

/**
 * Configuration for {@link seaq} search behavior.
 *
 * All options are optional — calling `seaq(list, query)` with no options
 * searches plain string arrays with strict (non-fuzzy) matching.
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
   * - `undefined` (default) — strict mode, every character must match somewhere
   * - `0.1–0.3` — light tolerance, catches minor typos like "jonh" → "john"
   * - `0.5` — moderate tolerance, good general-purpose starting point
   * - `0.8–1` — very loose, matches almost anything (rarely useful)
   */
  fuzziness?: number;
  /**
   * How multi-field scoring works when multiple `keys` are provided.
   *
   * - `'joined'` (default) — concatenates all field values into one string before scoring.
   *   Supports cross-field queries like "john smith" matching firstName="John" + lastName="Smith".
   * - `'separate'` — scores each field independently and takes the best match.
   *   ~50% faster, but cross-field queries won't work.
   */
  fieldMode?: 'joined' | 'separate';
  /**
   * Maximum number of results to return.
   *
   * Uses a min-heap internally for O(n log k) selection instead of
   * O(n log n) full sort, so this is significantly faster than sorting
   * everything and calling `.slice(0, n)` on large result sets.
   */
  limit?: number;
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
 * // Search objects by specific keys
 * seaq(contacts, 'john', { keys: ['name', 'email'] })
 *
 * @example
 * // Search with fuzziness for typo tolerance
 * seaq(contacts, 'jonh', { keys: ['name'], fuzziness: 0.5 })
 *
 * @example
 * // Nested property + array traversal
 * seaq(users, 'admin', { keys: ['roles.name'] })
 *
 * @example
 * // Fast per-field scoring (won't match across fields)
 * seaq(contacts, 'john', { keys: ['firstName', 'lastName'], fieldMode: 'separate' })
 *
 * @example
 * // Get only top 10 results efficiently
 * seaq(contacts, 'john', { keys: ['name'], limit: 10 })
 *
 * @example
 * // Search a plain string array (no keys needed)
 * seaq(['apple', 'banana'], 'app')
 */
export function seaq<T>(list: Array<T>, query: string, options?: SeaqOptions<T>): Array<T> {
  const keys = options?.keys as string[] | undefined;
  const fuzziness = options?.fuzziness;
  const fieldMode = options?.fieldMode ?? 'joined';
  const limit = options?.limit;

  const scored = scoreItems(list, query, keys, fuzziness, fieldMode);

  if (limit !== undefined && limit > 0) {
    // Use partial sort - only find top N items
    return getTopN(scored, limit).map((item) => item.item);
  }

  // Full sort for all results
  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => item.item);
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

function scoreItems<T>(
  list: T[],
  query: string,
  keys: string[] | undefined,
  fuzziness: number | undefined,
  fieldMode: 'joined' | 'separate',
): Array<MetaDataItem<T>> {
  // Pre-lowercase query once instead of per-item
  const lowerQuery = query.toLowerCase();

  const result: Array<MetaDataItem<T>> = [];

  for (const item of list) {
    let score: number;

    if (keys) {
      if (fieldMode === 'separate') {
        // Score each key's values separately, take the best score
        let bestScore = 0;
        for (const key of keys) {
          const values = getProperty(item, key);
          for (const value of values) {
            const s = string_score(value, query, fuzziness, lowerQuery);
            if (s > bestScore) bestScore = s;
          }
        }
        score = bestScore;
      } else {
        // Join all field values and score as one string
        const searchString = keys
          .map((key) => getProperty(item, key).join(' '))
          .join(' ');
        score = string_score(searchString, query, fuzziness, lowerQuery);
      }
    } else if (typeof item === 'string') {
      score = string_score(item, query, fuzziness, lowerQuery);
    } else if (typeof item === 'number') {
      score = string_score(String(item), query, fuzziness, lowerQuery);
    } else {
      score = string_score(JSON.stringify(item), query, fuzziness, lowerQuery);
    }

    // Only include items with score > 0
    if (score > 0) {
      result.push({ item, score });
    }
  }

  return result;
}

interface MetaDataItem<T> {
  item: T;
  score: number;
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
