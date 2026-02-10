import { seaq } from 'seaq';
import Fuse from 'fuse.js';
import MiniSearch from 'minisearch';
import uFuzzy from '@leeoniya/ufuzzy';
import lunr from 'lunr';
import type { DatasetConfig } from './data';
import type { SeaqConfig, FuseConfig, MiniSearchConfig, UFuzzyConfig, LunrConfig } from './App';

export interface SearchResult {
  results: string[];
  items: unknown[];
  timeMs: number;
  resultCount: number;
}

function timed<T>(fn: () => T): { result: T; timeMs: number } {
  const start = performance.now();
  const result = fn();
  const timeMs = performance.now() - start;
  return { result, timeMs };
}

function isStringArray(data: unknown[]): data is string[] {
  return data.length === 0 || typeof data[0] === 'string';
}

// ── seaq ──

export function searchSeaq(dataset: DatasetConfig, query: string, config: SeaqConfig): SearchResult {
  const keys = dataset.keys;
  const { result, timeMs } = timed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic dataset types
    return (seaq as any)(dataset.data, query, {
      ...(keys.length > 0 ? { keys } : {}),
      ...(config.fuzziness != null ? { fuzziness: config.fuzziness } : {}),
      fieldMode: config.fieldMode,
      ...(config.limit != null ? { limit: config.limit } : {}),
    });
  });
  const top = result.slice(0, 10);
  return {
    results: top.map(dataset.displayFn),
    items: top,
    timeMs,
    resultCount: result.length,
  };
}

// ── Fuse.js ──

let fuseCache: { data: unknown[]; keys: string[]; configKey: string; index: Fuse<unknown> } | null = null;

function fuseConfigKey(keys: string[], config: FuseConfig): string {
  return JSON.stringify({ keys, threshold: config.threshold, distance: config.distance, ignoreLocation: config.ignoreLocation, minMatchCharLength: config.minMatchCharLength, isCaseSensitive: config.isCaseSensitive });
}

export function searchFuse(dataset: DatasetConfig, query: string, config: FuseConfig): SearchResult {
  const keys = dataset.keys;
  const ck = fuseConfigKey(keys, config);

  const { result, timeMs } = timed(() => {
    let fuse: Fuse<unknown>;
    if (config.preIndexed && fuseCache?.data === dataset.data && fuseCache.configKey === ck) {
      fuse = fuseCache.index;
    } else {
      const opts: ConstructorParameters<typeof Fuse>[1] = {
        threshold: config.threshold,
        distance: config.distance,
        ignoreLocation: config.ignoreLocation,
        minMatchCharLength: config.minMatchCharLength,
        isCaseSensitive: config.isCaseSensitive,
        includeScore: true,
      };
      if (!isStringArray(dataset.data)) {
        opts.keys = keys;
      }
      fuse = new Fuse(dataset.data, opts);
      if (config.preIndexed) {
        fuseCache = { data: dataset.data, keys, configKey: ck, index: fuse };
      }
    }
    return fuse.search(query);
  });

  const top = result.slice(0, 10);
  return {
    results: top.map((r) => dataset.displayFn(r.item)),
    items: top.map((r) => r.item),
    timeMs,
    resultCount: result.length,
  };
}

export function clearFuseCache() {
  fuseCache = null;
}

// ── MiniSearch ──

let miniCache: { data: unknown[]; keys: string[]; index: MiniSearch } | null = null;

function flattenKeys(keys: string[]): string[] {
  return keys.map((k) => k.replace(/\./g, '_'));
}

function flattenItem(item: unknown, keys: string[]): Record<string, string> {
  const flat: Record<string, string> = {};
  const obj = item as Record<string, unknown>;
  for (const key of keys) {
    const flatKey = key.replace(/\./g, '_');
    const parts = key.split('.');
    let val: unknown = obj;
    for (const part of parts) {
      if (val == null) break;
      val = (val as Record<string, unknown>)[part];
    }
    flat[flatKey] = String(val ?? '');
  }
  return flat;
}

export function searchMiniSearch(dataset: DatasetConfig, query: string, config: MiniSearchConfig): SearchResult {
  const keys = dataset.keys;

  const { result, timeMs } = timed(() => {
    let ms: MiniSearch;
    if (config.preIndexed && miniCache?.data === dataset.data && arraysEqual(miniCache.keys, keys)) {
      ms = miniCache.index;
    } else {
      if (isStringArray(dataset.data)) {
        const fields = ['text'];
        ms = new MiniSearch({ fields, storeFields: fields });
        ms.addAll(dataset.data.map((text, id) => ({ id, text })));
      } else {
        const fields = flattenKeys(keys);
        ms = new MiniSearch({ fields, storeFields: fields });
        ms.addAll(
          dataset.data.map((item, id) => ({
            id,
            ...flattenItem(item, keys),
          })),
        );
      }
      if (config.preIndexed) {
        miniCache = { data: dataset.data, keys, index: ms };
      }
    }
    return ms.search(query, {
      prefix: config.prefix,
      fuzzy: config.fuzzy,
      combineWith: config.combineWith,
      weights: { fuzzy: config.fuzzyWeight, prefix: config.prefixWeight },
    });
  });

  const topIds = result.slice(0, 10).map((r) => r.id as number);
  const topItems = topIds.map((id) => dataset.data[id]!);

  return {
    results: topItems.map(dataset.displayFn),
    items: topItems,
    timeMs,
    resultCount: result.length,
  };
}

export function clearMiniSearchCache() {
  miniCache = null;
}

// ── uFuzzy ──

export function searchUFuzzy(dataset: DatasetConfig, query: string, config: UFuzzyConfig): SearchResult {
  const { result, timeMs } = timed(() => {
    let haystack: string[];
    if (isStringArray(dataset.data)) {
      haystack = dataset.data;
    } else {
      const keys = dataset.keys;
      haystack = dataset.data.map((item) => {
        const obj = item as Record<string, unknown>;
        return keys
          .map((key) => {
            const parts = key.split('.');
            let val: unknown = obj;
            for (const part of parts) {
              if (val == null) break;
              val = (val as Record<string, unknown>)[part];
            }
            return String(val ?? '');
          })
          .join(' ');
      });
    }

    const uf = new uFuzzy({
      intraMode: config.intraMode,
      ...(config.intraMode === 1
        ? {
            intraSub: config.intraSub,
            intraTrn: config.intraTrn,
            intraDel: config.intraDel,
          }
        : {}),
    });
    const [idxs, info, order] = uf.search(haystack, query);
    if (!idxs) return [];
    if (!info || !order) {
      return Array.from(idxs);
    }
    return order.map((oi) => info.idx[oi]!);
  });

  const indices = result as number[];
  const validIndices = indices.slice(0, 10).filter((idx) => idx != null && idx < dataset.data.length);
  const topItems = validIndices.map((idx) => dataset.data[idx]!);
  return {
    results: topItems.map(dataset.displayFn),
    items: topItems,
    timeMs,
    resultCount: indices.length,
  };
}

// ── Lunr ──

let lunrCache: { data: unknown[]; keys: string[]; index: lunr.Index } | null = null;

export function searchLunr(dataset: DatasetConfig, query: string, config: LunrConfig): SearchResult {
  const keys = dataset.keys;

  const { result, timeMs } = timed(() => {
    let idx: lunr.Index;
    if (config.preIndexed && lunrCache?.data === dataset.data && arraysEqual(lunrCache.keys, keys)) {
      idx = lunrCache.index;
    } else {
      if (isStringArray(dataset.data)) {
        const data = dataset.data;
        idx = lunr(function () {
          this.field('text');
          data.forEach((text, id) => {
            this.add({ id, text });
          });
        });
      } else {
        const data = dataset.data;
        const flatFields = flattenKeys(keys);
        idx = lunr(function () {
          this.ref('id');
          for (const f of flatFields) {
            this.field(f);
          }
          data.forEach((item, id) => {
            this.add({ id, ...flattenItem(item, keys) });
          });
        });
      }
      if (config.preIndexed) {
        lunrCache = { data: dataset.data, keys, index: idx };
      }
    }

    // Build the lunr query string with optional wildcards and edit distance
    let lunrQuery = query;
    if (config.wildcard) {
      lunrQuery = query
        .split(/\s+/)
        .map((term) => `*${term}*`)
        .join(' ');
    } else if (config.editDistance > 0) {
      lunrQuery = query
        .split(/\s+/)
        .map((term) => `${term}~${config.editDistance}`)
        .join(' ');
    }

    try {
      return idx.search(lunrQuery);
    } catch {
      return [];
    }
  });

  const topIds = result.slice(0, 10).map((r) => Number(r.ref));
  const topItems = topIds.map((id) => dataset.data[id]!);

  return {
    results: topItems.map(dataset.displayFn),
    items: topItems,
    timeMs,
    resultCount: result.length,
  };
}

export function clearLunrCache() {
  lunrCache = null;
}

// ── Helpers ──

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
