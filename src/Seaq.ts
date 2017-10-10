/**
 * Seaq is a Fuzzy searching utility function.
 * Given an input Array<T>, a set of object keys to search, and a search
 * query, Seaq will return a new Array<T> containing the results ordered by
 * their Score which is calculated using a variation of string_score algorithm.
 */
import { string_score } from './Scorer';

export function seaq<T, K extends keyof T>(
  list: T[],
  query: string,
  keys?: (K | string)[],
  fuzzy?: number
) {
  return getMetaDataList(list, query, keys, fuzzy)
    .sort((a, b) => b.score - a.score)
    .map(item => item.item);
}

function getMetaDataList<T>(
  list: T[],
  query: string,
  keys?: string[],
  fuzzy?: number
): MetaDataItem<T>[] {
  // get a list of all items whose score is > 0
  const fullList = list.map(item => {
    // get a string representation of all keys joined with ' ' or if no keys, the item stringified
    const searchString: string = keys
      ? keys
          .map(key => {
            const value = getProperty(item, key);
            if (typeof value === 'string') {
              return value;
            }
            return;
          })
          .join(' ')
      : item.toString();

    // calculate match score
    const score = string_score(searchString, query, fuzzy);

    // return original item and its matching score
    return {
      item: item,
      score: score
    };
  });

  // return only those items whose score is > 0
  return fullList.filter(item => item.score > 0);
}

interface MetaDataItem<T> {
  item: T;
  score: number;
}

function getProperty<T>(obj: T, key: string): keyof T | string {
  const dotIndex = key.indexOf('.');
  // console.log(key);
  if (dotIndex >= 0) {
    const objKey = key.substring(0, dotIndex);
    // console.log(objKey);
    const childKey = key.substring(dotIndex + 1);
    // console.log(childKey);
    const newObj = obj[objKey];
    return getProperty(newObj, childKey);
  }
  return obj[key];
}
