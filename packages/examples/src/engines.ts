import { seaq } from 'seaq';
import Fuse from 'fuse.js';
import MiniSearch from 'minisearch';
import uFuzzy from '@leeoniya/ufuzzy';
import lunr from 'lunr';
import type { DatasetConfig } from './data';
import type { SeaqConfig, FuseConfig, MiniSearchConfig, UFuzzyConfig, LunrConfig } from './App';

export interface SearchResult {
  results: string[];
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
    });
  });
  return {
    results: result.slice(0, 10).map(dataset.displayFn),
    timeMs,
    resultCount: result.length,
  };
}

// ── Fuse.js ──

let fuseCache: { data: unknown[]; keys: string[]; index: Fuse<unknown> } | null = null;

export function searchFuse(dataset: DatasetConfig, query: string, config: FuseConfig): SearchResult {
  const keys = dataset.keys;

  const { result, timeMs } = timed(() => {
    let fuse: Fuse<unknown>;
    if (config.preIndexed && fuseCache?.data === dataset.data && arraysEqual(fuseCache.keys, keys)) {
      fuse = fuseCache.index;
    } else {
      const opts: ConstructorParameters<typeof Fuse>[1] = {
        threshold: config.threshold,
        includeScore: true,
      };
      if (!isStringArray(dataset.data)) {
        opts.keys = keys;
      }
      fuse = new Fuse(dataset.data, opts);
      if (config.preIndexed) {
        fuseCache = { data: dataset.data, keys, index: fuse };
      }
    }
    return fuse.search(query);
  });

  return {
    results: result.slice(0, 10).map((r) => dataset.displayFn(r.item)),
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
    return ms.search(query, { prefix: config.prefix, fuzzy: config.fuzzy });
  });

  const idSet = new Set(result.slice(0, 10).map((r) => r.id as number));
  const display = dataset.data
    .filter((_, i) => idSet.has(i))
    .slice(0, 10)
    .map(dataset.displayFn);

  return {
    results: display,
    timeMs,
    resultCount: result.length,
  };
}

export function clearMiniSearchCache() {
  miniCache = null;
}

// ── uFuzzy ──

export function searchUFuzzy(dataset: DatasetConfig, query: string, _config: UFuzzyConfig): SearchResult {
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

    const uf = new uFuzzy({ intraMode: _config.intraMode });
    const [idxs, info, order] = uf.search(haystack, query);
    if (!idxs) return [];
    if (!info || !order) {
      // No ranking info — idxs is the list of matching indices
      return Array.from(idxs);
    }
    // order[i] indexes into info arrays; info.idx[i] is the haystack index
    return order.map((oi) => info.idx[oi]!);
  });

  const indices = result as number[];
  return {
    results: indices
      .slice(0, 10)
      .filter((idx) => idx != null && idx < dataset.data.length)
      .map((idx) => dataset.displayFn(dataset.data[idx]!)),
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

    try {
      return idx.search(query);
    } catch {
      try {
        return idx.search(`*${query}*`);
      } catch {
        return [];
      }
    }
  });

  const idSet = new Set(result.slice(0, 10).map((r) => Number(r.ref)));
  const display = dataset.data
    .filter((_, i) => idSet.has(i))
    .slice(0, 10)
    .map(dataset.displayFn);

  return {
    results: display,
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
