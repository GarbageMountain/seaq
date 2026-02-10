import { seaq } from 'seaq';
import Fuse from 'fuse.js';
import MiniSearch from 'minisearch';
import uFuzzy from '@leeoniya/ufuzzy';
import lunr from 'lunr';
import type { DatasetConfig } from './data';
import type { SeaqConfig, FuseConfig, MiniSearchConfig, UFuzzyConfig, LunrConfig } from './App';

export interface SearchResult {
  results: string[];
  highlighted: string[];
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
      fuzziness: config.fuzziness,
      fieldMode: config.fieldMode,
      ...(config.limit != null ? { limit: config.limit } : {}),
      includeMatches: true,
    }) as { item: unknown; score: number; matches: { key?: string; value: string; indices: [number, number][]; score: number }[] }[];
  });
  const top = result.slice(0, 10);
  return {
    results: top.map((r) => dataset.displayFn(r.item)),
    highlighted: top.map((r) => {
      const match = r.matches?.[0];
      if (match && keys.length === 0) {
        // String/no-keys mode: highlight directly using indices
        return highlightRanges(match.value, match.indices);
      }
      if (match && match.key) {
        // Separate mode: highlight the matched key's value
        return buildFieldsHtml(r.item, dataset.keys, (val, key) => {
          if (key === match.key) {
            if (val === match.value) {
              return highlightRanges(val, match.indices);
            }
            // Array field: val is comma-joined, match.value is a single element.
            // Find the matched element within the joined string and offset ranges.
            const idx = val.indexOf(match.value);
            if (idx !== -1) {
              const offsetRanges = match.indices.map(
                ([s, e]) => [s + idx, e + idx] as [number, number],
              );
              return highlightRanges(val, offsetRanges);
            }
          }
          return esc(val);
        });
      }
      if (match) {
        // Joined mode: highlight the joined string's ranges on the individual fields
        // Map ranges from the joined string back to field values
        return buildFieldsHtml(r.item, dataset.keys, (val) => {
          // Use term-based highlighting from the query
          const terms = query.trim().split(/\s+/).filter(Boolean);
          return highlightTerms(val, terms);
        });
      }
      return buildFieldsHtml(r.item, dataset.keys, (val) => esc(val));
    }),
    items: top.map((r) => r.item),
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
        includeMatches: true,
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
  const highlighted = top.map((r) =>
    buildFieldsHtml(r.item, dataset.keys, (val, key) => {
      if (!key) {
        const match = r.matches?.[0];
        if (match) return highlightRanges(val, match.indices as unknown as [number, number][]);
        return esc(val);
      }
      const subs = new Set<string>();
      for (const m of r.matches ?? []) {
        if (m.key === key) {
          for (const [start, end] of m.indices) {
            subs.add((m.value ?? '').slice(start, end + 1));
          }
        }
      }
      if (subs.size > 0) return highlightTerms(val, [...subs]);
      return esc(val);
    }),
  );
  return {
    results: top.map((r) => dataset.displayFn(r.item)),
    highlighted,
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
      if (Array.isArray(val)) {
        val = val.map((v) => String((v as Record<string, unknown>)?.[part] ?? '')).join(' ');
        break;
      }
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

  const topResults = result.slice(0, 10);
  const topItems = topResults.map((r) => dataset.data[r.id as number]!);
  const highlighted = topResults.map((r, i) => {
    const terms = Object.keys(r.match);
    return buildFieldsHtml(topItems[i], dataset.keys, (val) => highlightTerms(val, terms));
  });

  return {
    results: topItems.map(dataset.displayFn),
    highlighted,
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
    if (!idxs) return { entries: [] as { idx: number; ranges: number[] | null }[], haystack };
    if (!info || !order) {
      return { entries: Array.from(idxs).map((idx) => ({ idx, ranges: null })), haystack };
    }
    return {
      entries: order.map((oi) => ({ idx: info.idx[oi]!, ranges: info.ranges[oi] ?? null })),
      haystack,
    };
  });

  const { entries, haystack } = result;
  const valid = entries.slice(0, 10).filter((e) => e.idx != null && e.idx < dataset.data.length);
  const topItems = valid.map((e) => dataset.data[e.idx]!);
  const isStr = isStringArray(dataset.data);
  const highlighted = valid.map((e) => {
    if (isStr && e.ranges) {
      // String data: highlight the actual string with uFuzzy's ranges
      return uFuzzy.highlight(haystack[e.idx]!, e.ranges, (part, matched) =>
        matched ? `<mark>${esc(part)}</mark>` : esc(part),
      );
    }
    // Object data: highlight query terms in field values
    const terms = query.trim().split(/\s+/).filter(Boolean);
    return buildFieldsHtml(dataset.data[e.idx]!, dataset.keys, (val) => highlightTerms(val, terms));
  });
  return {
    results: topItems.map(dataset.displayFn),
    highlighted,
    items: topItems,
    timeMs,
    resultCount: entries.length,
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

  const topResults = result.slice(0, 10);
  const topItems = topResults.map((r) => dataset.data[Number(r.ref)]!);
  const highlighted = topResults.map((r, i) => {
    const terms = Object.keys(r.matchData.metadata);
    return buildFieldsHtml(topItems[i], dataset.keys, (val) => highlightTerms(val, terms));
  });

  return {
    results: topItems.map(dataset.displayFn),
    highlighted,
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightRanges(text: string, ranges: readonly (readonly [number, number])[]): string {
  if (ranges.length === 0) return esc(text);
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let html = '';
  let pos = 0;
  for (const [start, end] of sorted) {
    if (start > pos) html += esc(text.slice(pos, start));
    html += `<mark>${esc(text.slice(start, end + 1))}</mark>`;
    pos = end + 1;
  }
  if (pos < text.length) html += esc(text.slice(pos));
  return html;
}

function highlightTerms(text: string, terms: string[]): string {
  if (terms.length === 0) return esc(text);
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const pattern = sorted.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(pattern, 'gi');
  let html = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    html += esc(text.slice(last, m.index));
    html += `<mark>${esc(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  html += esc(text.slice(last));
  return html;
}

function resolveKey(item: unknown, key: string): string {
  const parts = key.split('.');
  let val: unknown = item;
  for (const part of parts) {
    if (val == null) break;
    if (Array.isArray(val)) {
      return val.map((v) => String((v as Record<string, unknown>)?.[part] ?? '')).join(', ');
    }
    val = (val as Record<string, unknown>)[part];
  }
  return String(val ?? '');
}

function buildFieldsHtml(
  item: unknown,
  keys: string[],
  hlValue: (value: string, key: string) => string,
): string {
  if (keys.length === 0) return hlValue(String(item), '');
  const pairs = keys.map((key) => {
    const val = resolveKey(item, key);
    return `  "${esc(key)}": "${hlValue(val, key)}"`;
  });
  return `{\n${pairs.join(',\n')}\n}`;
}
