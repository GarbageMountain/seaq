/**
 * Seaq is a Fuzzy searching utility function.
 * Given an input Array<T>, a set of object keys to search, and a search
 * query, Seaq will return a new Array<T> containing the results ordered by
 * their Score which is calculated using a variation of string_score algorithm.
 */
import { string_score } from './Scorer';

export function seaq<T>(
  list: T[],
  query: string,
  keys: Array<Extract<keyof T, string>> | string[],
  fuzzy?: number,
) {
  const l = getMetaDataList(list, query, keys, fuzzy);
  return l
    .sort((a: MetaDataItem<T>, b: MetaDataItem<T>) => b.score - a.score)
    .map((item: MetaDataItem<T>) => item.item);
}

function getMetaDataList<T>(
  list: T[],
  query: string,
  keys: string[],
  fuzzy?: number,
): Array<MetaDataItem<T>> {
  // get a list of all items whose score is > 0
  const fullList = list.map((item) => {
    // get a string representation of all keys joined with ' ' or if no keys, the item stringified
    const searchString: string = keys
      ? keys
          .map((key) => {
            if (typeof key === 'string') {
              const value = getProperty(item, key).join(' ');
              return value;
            }
          })
          .join(' ')
      : `${item}`;

    // calculate match score
    const score = string_score(searchString, query, fuzzy);

    // return original item and its matching score
    return {
      item,
      score,
    };
  });

  // return only those items whose score is > 0
  return fullList.filter((item) => item.score > 0);
}

interface MetaDataItem<T> {
  item: T;
  score: number;
}

function getProperty<T>(obj: T, path: string | null, list: string[] = []): string[] {
  if (!path) {
    // If there's no path left, we've gotten to the object we care about.
    list.push(`${obj}`);
  } else {
    const dotIndex = path.indexOf('.');
    let firstSegment = path;
    let remaining = null;

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
      }
    }
  }

  return list;
}
