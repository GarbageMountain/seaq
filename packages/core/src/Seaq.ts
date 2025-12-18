/**
 * Seaq is a Fuzzy searching utility function.
 */
import { string_score } from './string_score';

/**
 * Options for seaq search
 */
export interface SeaqOptions<T> {
  /** Object keys to search (supports dot notation for nested properties) */
  keys?: Array<Extract<keyof T, string>> | string[];
  /** Fuzziness 0-1. Higher = more tolerant of typos. Default: undefined (strict) */
  fuzziness?: number;
  /**
   * Score each field separately and take the best match.
   * Faster (~50%) but won't match queries across multiple fields.
   * e.g., "john smith" won't match firstName="John" + lastName="Smith"
   * Default: false
   */
  fieldMode?: 'joined' | 'separate';
}

/**
 * Fuzzy search an array of items.
 *
 * @param list - Array of objects or strings to search
 * @param query - Search query
 * @param options - Search options (keys, fuzziness, fieldMode)
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
 * // Fast per-field scoring (won't match across fields)
 * seaq(contacts, 'john', { keys: ['firstName', 'lastName'], fieldMode: 'separate' })
 *
 * @example
 * // Search string array (no keys needed)
 * seaq(['apple', 'banana'], 'app')
 */
export function seaq<T>(list: Array<T>, query: string, options?: SeaqOptions<T>): Array<T> {
  const keys = options?.keys as string[] | undefined;
  const fuzziness = options?.fuzziness;
  const fieldMode = options?.fieldMode ?? 'joined';

  const l = getMetaDataList(list, query, keys, fuzziness, fieldMode);
  return l
    .sort((a: MetaDataItem<T>, b: MetaDataItem<T>) => b.score - a.score)
    .map((item: MetaDataItem<T>) => item.item);
}

function getMetaDataList<T>(
  list: T[],
  query: string,
  keys: string[] | undefined,
  fuzziness: number | undefined,
  fieldMode: 'joined' | 'separate',
): Array<MetaDataItem<T>> {
  // Pre-lowercase query once instead of per-item
  const lowerQuery = query.toLowerCase();

  // get a list of all items whose score is > 0
  const fullList = list.map((item) => {
    let score: number;

    if (keys) {
      if (fieldMode === 'separate') {
        // Score each key's values separately, take the best score
        // Faster but won't match queries across multiple fields
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
        // Allows matching across fields (e.g., "john smith" matches firstName + lastName)
        const searchString = keys
          .map((key) => getProperty(item, key).join(' '))
          .join(' ');
        score = string_score(searchString, query, fuzziness, lowerQuery);
      }
    } else if (typeof item === 'string') {
      // Fast path for string arrays
      score = string_score(item, query, fuzziness, lowerQuery);
    } else if (typeof item === 'number') {
      score = string_score(String(item), query, fuzziness, lowerQuery);
    } else {
      // Object/array without keys - stringify
      score = string_score(JSON.stringify(item), query, fuzziness, lowerQuery);
    }

    return { item, score };
  });

  // return only those items whose score is > 0
  return fullList.filter((item) => item.score > 0);
}

interface MetaDataItem<T> {
  item: T;
  score: number;
}

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
