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
  keys: (K | string)[],
  fuzzy?: number
) {
  // const cache: { [id: string]: number } = {};
  const metaDataList = getMetaDataList(list, query, keys, fuzzy);
  const sortedList = getSortedList(metaDataList);
  const rawList = sortedList.map(item => {
    return item.item;
  });

  return rawList;
}

function getMetaDataList<T>(
  list: T[],
  query: string,
  keys: string[],
  fuzzy?: number
): MetaDataItem<T>[] {
  const fullList = list.map(item => {
    // const keyScores = keys.map(key => {
    //   const value = getProperty(item, key);
    //   let score = 0;
    //   if (typeof value === 'string') {
    //     score = string_score(value, query, fuzzy);
    //   }
    //   return {
    //     key: key,
    //     score: score,
    //   }
    // });

    const keyValues = keys.map(key => {
      const value = getProperty(item, key);
      if (typeof value === 'string') {
        return value;
      }
      return;
    });

    const allKeys = keyValues.join(' ');
    const score = string_score(allKeys, query, fuzzy);

    return {
      item: item,
      // scores: keyScores,
      score: score
    };
  });

  return fullList.filter(item => item.score > 0);
}

export interface MetaDataItem<T> {
  item: T;
  // scores: { key: string, score: number }[];
  score: number;
}

export function getSortedList<T>(list: MetaDataItem<T>[]) {
  return list.sort((a, b) => {
    if (a.score > b.score) {
      return -1;
    }
    if (a.score < b.score) {
      return 1;
    }
    return 0;
  });
}

export function getProperty<T>(obj: T, key: string): keyof T | string {
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
