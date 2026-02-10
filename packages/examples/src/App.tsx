import { useCallback, useEffect, useMemo, useState } from 'react';
import { datasets, type DatasetKey } from './data';
import {
  clearFuseCache,
  clearLunrCache,
  clearMiniSearchCache,
  searchFuse,
  searchLunr,
  searchMiniSearch,
  searchSeaq,
  searchUFuzzy,
  type SearchResult,
} from './engines';
import { SearchInput } from './components/SearchInput';
import { DatasetPicker } from './components/DatasetPicker';
import { ResultsColumn } from './components/ResultsColumn';

export type EngineKey = 'seaq' | 'fuse' | 'minisearch' | 'ufuzzy' | 'lunr';

/** Walk a sample item and return all dot-paths that lead to a string value. */
function discoverStringPaths(item: unknown, prefix = ''): string[] {
  if (item == null || typeof item !== 'object') return [];
  // If it's an array, walk the first element with the same prefix
  if (Array.isArray(item)) {
    return item.length > 0 ? discoverStringPaths(item[0], prefix) : [];
  }
  const paths: string[] = [];
  for (const [key, val] of Object.entries(item as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') {
      paths.push(path);
    } else if (typeof val === 'object' && val != null) {
      paths.push(...discoverStringPaths(val, path));
    }
  }
  return paths;
}

export interface SeaqConfig {
  fuzziness: number;
  fieldMode: 'joined' | 'separate';
  limit: number | undefined;
}

export interface FuseConfig {
  threshold: number;
  distance: number;
  ignoreLocation: boolean;
  minMatchCharLength: number;
  isCaseSensitive: boolean;
  preIndexed: boolean;
}

export interface MiniSearchConfig {
  fuzzy: number;
  prefix: boolean;
  combineWith: 'OR' | 'AND';
  fuzzyWeight: number;
  prefixWeight: number;
  preIndexed: boolean;
}

export interface UFuzzyConfig {
  intraMode: 0 | 1;
  intraSub: 0 | 1;
  intraTrn: 0 | 1;
  intraDel: 0 | 1;
}

export interface LunrConfig {
  preIndexed: boolean;
  wildcard: boolean;
  editDistance: number;
}

/** Maps dot-path keys that traverse arrays to their array/inner path segments. */
export type ArrayKeyMap = Record<string, { arrayPath: string; innerPath: string }>;

export interface EngineConfigs {
  seaq: SeaqConfig;
  fuse: FuseConfig;
  minisearch: MiniSearchConfig;
  ufuzzy: UFuzzyConfig;
  lunr: LunrConfig;
}

export const defaultConfigs: EngineConfigs = {
  seaq: { fuzziness: 0.2, fieldMode: 'separate', limit: undefined },
  fuse: { threshold: 0.4, distance: 100, ignoreLocation: false, minMatchCharLength: 2, isCaseSensitive: false, preIndexed: true },
  minisearch: { fuzzy: 0.2, prefix: true, combineWith: 'OR', fuzzyWeight: 1, prefixWeight: 0.8, preIndexed: true },
  ufuzzy: { intraMode: 1, intraSub: 1, intraTrn: 1, intraDel: 1 },
  lunr: { preIndexed: true, wildcard: false, editDistance: 1 },
};

const engineNames: Record<EngineKey, string> = {
  seaq: 'seaq',
  fuse: 'Fuse.js',
  minisearch: 'MiniSearch',
  ufuzzy: 'uFuzzy',
  lunr: 'Lunr',
};

const engineOrder: EngineKey[] = ['seaq', 'fuse', 'minisearch', 'ufuzzy', 'lunr'];

export function App() {
  const [query, setQuery] = useState('');
  const [dataset, setDataset] = useState<DatasetKey>('contacts');
  const [configs, setConfigs] = useState<EngineConfigs>(defaultConfigs);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const rawDs = useMemo(() => datasets[dataset], [dataset]);
  const allPaths = useMemo(
    () => (rawDs.data.length > 0 && typeof rawDs.data[0] === 'object' ? discoverStringPaths(rawDs.data[0]) : []),
    [rawDs],
  );
  const effectiveKeys = selectedKeys.length > 0 ? selectedKeys : rawDs.keys;
  const ds = useMemo(() => ({ ...rawDs, keys: effectiveKeys }), [rawDs, effectiveKeys]);

  // Detect which keys traverse arrays (e.g. emailAddresses.email)
  const arrayKeyMap = useMemo<ArrayKeyMap>(() => {
    if (ds.data.length === 0 || typeof ds.data[0] !== 'object') return {};
    const sample = ds.data[0];
    const map: ArrayKeyMap = {};
    for (const key of ds.keys) {
      const parts = key.split('.');
      let val: unknown = sample;
      for (let i = 0; i < parts.length; i++) {
        if (val == null) break;
        val = (val as Record<string, unknown>)[parts[i]!];
        if (Array.isArray(val) && i < parts.length - 1) {
          map[key] = {
            arrayPath: parts.slice(0, i + 1).join('.'),
            innerPath: parts.slice(i + 1).join('.'),
          };
          break;
        }
      }
    }
    return map;
  }, [ds.data, ds.keys]);

  // Clear caches and key selection when dataset changes
  useEffect(() => {
    clearFuseCache();
    clearMiniSearchCache();
    clearLunrCache();
    setSelectedKeys([]);
  }, [dataset]);

  const updateConfig = useCallback(<K extends EngineKey>(engine: K, patch: Partial<EngineConfigs[K]>) => {
    setConfigs((prev) => ({
      ...prev,
      [engine]: { ...prev[engine], ...patch },
    }));
  }, []);

  // Run search synchronously on every render — no debounce
  const results = useMemo<Record<EngineKey, SearchResult | null>>(() => {
    const q = query.trim();
    if (!q) return { seaq: null, fuse: null, minisearch: null, ufuzzy: null, lunr: null };

    return {
      seaq: searchSeaq(ds, q, configs.seaq),
      fuse: searchFuse(ds, q, configs.fuse),
      minisearch: searchMiniSearch(ds, q, configs.minisearch),
      ufuzzy: searchUFuzzy(ds, q, configs.ufuzzy),
      lunr: searchLunr(ds, q, configs.lunr),
    };
  }, [query, ds, configs]);

  return (
    <div className="mx-auto min-h-screen max-w-[100rem] bg-white px-4 py-8 dark:bg-gray-900">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          seaq — Interactive Search Comparison
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Compare seaq against Fuse.js, MiniSearch, uFuzzy, and Lunr with live results and performance timings.
        </p>
      </header>

      <div className="mb-6 space-y-4">
        <SearchInput value={query} onChange={setQuery} />
        <DatasetPicker selected={dataset} onChange={setDataset} />
        {allPaths.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Search fields:</span>
            {allPaths.map((k) => (
              <label key={k} className="flex items-center gap-1 text-xs text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600"
                  checked={effectiveKeys.includes(k)}
                  onChange={(e) => {
                    const current = selectedKeys.length > 0 ? selectedKeys : [...rawDs.keys];
                    const next = e.target.checked
                      ? [...current, k].filter((v, i, a) => a.indexOf(v) === i)
                      : current.filter((v) => v !== k);
                    setSelectedKeys(next);
                  }}
                />
                <span>
                  {k}
                  {rawDs.keys.includes(k) && (
                    <span className="ml-0.5 text-[10px] text-gray-500 dark:text-gray-400">(default)</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
        <details className="rounded-md border border-gray-200 bg-gray-900 dark:border-gray-700">
          <summary className="cursor-pointer select-none px-4 py-2 text-xs text-gray-400 hover:text-gray-300">
            <span className="font-medium">Sample entry</span>
            {ds.keys.length > 0 && (
              <span className="ml-2 text-gray-500">
                keys: [{ds.keys.join(', ')}]
              </span>
            )}
          </summary>
          <pre className="overflow-x-auto whitespace-pre border-t border-gray-800 px-4 py-3 text-xs leading-relaxed text-gray-100">
            <code>{JSON.stringify(ds.data[0], null, 2)}</code>
          </pre>
        </details>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {engineOrder.map((engine) => (
          <ResultsColumn
            key={engine}
            engineKey={engine}
            name={engineNames[engine]}
            query={query}
            keys={ds.keys}
            arrayKeyMap={arrayKeyMap}
            result={results[engine]}
            config={configs[engine]}
            onConfigChange={(patch) => updateConfig(engine, patch)}
          />
        ))}
      </div>
    </div>
  );
}
