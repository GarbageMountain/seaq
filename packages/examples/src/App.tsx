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

export interface SeaqConfig {
  fuzziness: number | undefined;
  fieldMode: 'joined' | 'separate';
}

export interface FuseConfig {
  threshold: number;
  preIndexed: boolean;
}

export interface MiniSearchConfig {
  fuzzy: number;
  prefix: boolean;
  preIndexed: boolean;
}

export interface UFuzzyConfig {
  intraMode: 0 | 1;
}

export interface LunrConfig {
  preIndexed: boolean;
}

export interface EngineConfigs {
  seaq: SeaqConfig;
  fuse: FuseConfig;
  minisearch: MiniSearchConfig;
  ufuzzy: UFuzzyConfig;
  lunr: LunrConfig;
}

const defaultConfigs: EngineConfigs = {
  seaq: { fuzziness: undefined, fieldMode: 'joined' },
  fuse: { threshold: 0.4, preIndexed: false },
  minisearch: { fuzzy: 0.2, prefix: true, preIndexed: false },
  ufuzzy: { intraMode: 0 },
  lunr: { preIndexed: false },
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

  const ds = useMemo(() => datasets[dataset], [dataset]);

  // Clear caches when dataset changes
  useEffect(() => {
    clearFuseCache();
    clearMiniSearchCache();
    clearLunrCache();
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
    <div className="mx-auto min-h-screen max-w-[100rem] px-4 py-8">
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
            result={results[engine]}
            config={configs[engine]}
            onConfigChange={(patch) => updateConfig(engine, patch)}
          />
        ))}
      </div>
    </div>
  );
}
