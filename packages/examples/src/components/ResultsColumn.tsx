import type { SearchResult } from '../engines';
import type {
  EngineKey,
  EngineConfigs,
  SeaqConfig,
  FuseConfig,
  MiniSearchConfig,
  UFuzzyConfig,
  LunrConfig,
} from '../App';

interface ResultsColumnProps {
  engineKey: EngineKey;
  name: string;
  query: string;
  keys: string[];
  result: SearchResult | null;
  config: EngineConfigs[EngineKey];
  onConfigChange: (patch: Partial<EngineConfigs[EngineKey]>) => void;
}

function timingColor(ms: number): string {
  if (ms < 5) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (ms < 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

const labelClass = 'text-xs text-gray-500 dark:text-gray-400';
const hintClass = 'block text-[10px] text-gray-400 dark:text-gray-500 mt-0.5';
const selectClass =
  'rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200';
const checkClass = 'rounded border-gray-300 dark:border-gray-600';

// ── Code snippet generators ──

function q(s: string): string {
  return `'${s.replace(/'/g, "\\'")}'`;
}

function seaqSnippet(query: string, keys: string[], config: SeaqConfig): string {
  const opts: string[] = [];
  if (keys.length > 0) opts.push(`keys: [${keys.map(q).join(', ')}]`);
  if (config.fuzziness != null) opts.push(`fuzziness: ${config.fuzziness}`);
  if (config.fieldMode !== 'joined') opts.push(`fieldMode: '${config.fieldMode}'`);
  const optsStr = opts.length > 0 ? `, {\n  ${opts.join(',\n  ')}\n}` : '';
  return `seaq(data, ${q(query)}${optsStr})`;
}

function fuseSnippet(query: string, keys: string[], config: FuseConfig): string {
  const opts: string[] = [];
  if (keys.length > 0) opts.push(`keys: [${keys.map(q).join(', ')}]`);
  opts.push(`threshold: ${config.threshold}`);
  return [
    `const fuse = new Fuse(data, {`,
    `  ${opts.join(',\n  ')}`,
    `})`,
    `fuse.search(${q(query)})`,
  ].join('\n');
}

function miniSearchSnippet(query: string, keys: string[], config: MiniSearchConfig): string {
  const fields = keys.length > 0 ? keys.map((k) => q(k.replace(/\./g, '_'))).join(', ') : "'text'";
  const searchOpts: string[] = [];
  searchOpts.push(`prefix: ${config.prefix}`);
  searchOpts.push(`fuzzy: ${config.fuzzy}`);
  return [
    `const ms = new MiniSearch({`,
    `  fields: [${fields}]`,
    `})`,
    `ms.addAll(data)`,
    `ms.search(${q(query)}, {`,
    `  ${searchOpts.join(', ')}`,
    `})`,
  ].join('\n');
}

function uFuzzySnippet(query: string, config: UFuzzyConfig): string {
  const ctorOpts = config.intraMode !== 0 ? `{ intraMode: ${config.intraMode} }` : '';
  return [
    `const uf = new uFuzzy(${ctorOpts})`,
    `const [idxs, info, order] = uf.search(`,
    `  haystack, ${q(query)}`,
    `)`,
  ].join('\n');
}

function lunrSnippet(query: string, keys: string[], preIndexed: boolean): string {
  const fields = keys.length > 0 ? keys.map((k) => k.replace(/\./g, '_')) : ['text'];
  const fieldLines = fields.map((f) => `  this.field('${f}')`).join('\n');
  const lines = [
    `const idx = lunr(function() {`,
    `  this.ref('id')`,
    fieldLines,
    `  data.forEach(d => this.add(d))`,
    `})`,
  ];
  if (preIndexed) {
    lines.push(`// index built once, reused per query`);
  }
  lines.push(`idx.search(${q(query)})`);
  return lines.join('\n');
}

function codeSnippet(engineKey: EngineKey, query: string, keys: string[], config: EngineConfigs[EngineKey]): string {
  const dq = query || '...';
  switch (engineKey) {
    case 'seaq':
      return seaqSnippet(dq, keys, config as SeaqConfig);
    case 'fuse':
      return fuseSnippet(dq, keys, config as FuseConfig);
    case 'minisearch':
      return miniSearchSnippet(dq, keys, config as MiniSearchConfig);
    case 'ufuzzy':
      return uFuzzySnippet(dq, config as UFuzzyConfig);
    case 'lunr':
      return lunrSnippet(dq, keys, (config as LunrConfig).preIndexed);
  }
}

// ── Config controls ──

function SeaqControls({ config, onChange }: { config: SeaqConfig; onChange: (p: Partial<SeaqConfig>) => void }) {
  return (
    <>
      <div>
        <label className={labelClass}>
          Fuzziness:{' '}
          <select
            className={selectClass}
            value={config.fuzziness ?? 'off'}
            onChange={(e) => onChange({ fuzziness: e.target.value === 'off' ? undefined : Number(e.target.value) })}
          >
            <option value="off">Off (strict)</option>
            <option value="0.1">0.1</option>
            <option value="0.3">0.3</option>
            <option value="0.5">0.5</option>
            <option value="0.8">0.8</option>
          </select>
        </label>
        <span className={hintClass}>Typo tolerance. Off = every char must match.</span>
      </div>
      <div>
        <label className={labelClass}>
          Field mode:{' '}
          <select
            className={selectClass}
            value={config.fieldMode}
            onChange={(e) => onChange({ fieldMode: e.target.value as 'joined' | 'separate' })}
          >
            <option value="joined">joined</option>
            <option value="separate">separate</option>
          </select>
        </label>
        <span className={hintClass}>Joined = cross-field "john smith". Separate = best single field, faster.</span>
      </div>
    </>
  );
}

function FuseControls({ config, onChange }: { config: FuseConfig; onChange: (p: Partial<FuseConfig>) => void }) {
  return (
    <>
      <div>
        <label className={labelClass}>
          Threshold:{' '}
          <select
            className={selectClass}
            value={config.threshold}
            onChange={(e) => onChange({ threshold: Number(e.target.value) })}
          >
            <option value="0.1">0.1 (strict)</option>
            <option value="0.2">0.2</option>
            <option value="0.4">0.4 (default)</option>
            <option value="0.6">0.6 (loose)</option>
            <option value="0.8">0.8</option>
          </select>
        </label>
        <span className={hintClass}>0 = perfect match only. 1 = match anything.</span>
      </div>
      <div>
        <label className={`${labelClass} flex items-center gap-1`}>
          <input
            type="checkbox"
            className={checkClass}
            checked={config.preIndexed}
            onChange={(e) => onChange({ preIndexed: e.target.checked })}
          />
          Pre-indexed
        </label>
        <span className={hintClass}>Reuse index across keystrokes instead of rebuilding.</span>
      </div>
    </>
  );
}

function MiniSearchControls({
  config,
  onChange,
}: { config: MiniSearchConfig; onChange: (p: Partial<MiniSearchConfig>) => void }) {
  return (
    <>
      <div>
        <label className={labelClass}>
          Fuzzy:{' '}
          <select
            className={selectClass}
            value={config.fuzzy}
            onChange={(e) => onChange({ fuzzy: Number(e.target.value) })}
          >
            <option value="0">0 (off)</option>
            <option value="0.1">0.1</option>
            <option value="0.2">0.2 (default)</option>
            <option value="0.4">0.4</option>
          </select>
        </label>
        <span className={hintClass}>Edit distance as fraction of term length.</span>
      </div>
      <div>
        <label className={`${labelClass} flex items-center gap-1`}>
          <input
            type="checkbox"
            className={checkClass}
            checked={config.prefix}
            onChange={(e) => onChange({ prefix: e.target.checked })}
          />
          Prefix
        </label>
        <span className={hintClass}>Match start of words, e.g. "hel" matches "hello".</span>
      </div>
      <div>
        <label className={`${labelClass} flex items-center gap-1`}>
          <input
            type="checkbox"
            className={checkClass}
            checked={config.preIndexed}
            onChange={(e) => onChange({ preIndexed: e.target.checked })}
          />
          Pre-indexed
        </label>
        <span className={hintClass}>Reuse index across keystrokes instead of rebuilding.</span>
      </div>
    </>
  );
}

function UFuzzyControls({
  config,
  onChange,
}: { config: UFuzzyConfig; onChange: (p: Partial<UFuzzyConfig>) => void }) {
  return (
    <div>
      <label className={labelClass}>
        Intra mode:{' '}
        <select
          className={selectClass}
          value={config.intraMode}
          onChange={(e) => onChange({ intraMode: Number(e.target.value) as 0 | 1 })}
        >
          <option value="0">0 (multi-insert)</option>
          <option value="1">1 (single-error)</option>
        </select>
      </label>
      <span className={hintClass}>0 = allows extra chars between matches. 1 = single substitution/insert/delete.</span>
    </div>
  );
}

function LunrControls({ config, onChange }: { config: LunrConfig; onChange: (p: Partial<LunrConfig>) => void }) {
  return (
    <div>
      <label className={`${labelClass} flex items-center gap-1`}>
        <input
          type="checkbox"
          className={checkClass}
          checked={config.preIndexed}
          onChange={(e) => onChange({ preIndexed: e.target.checked })}
        />
        Pre-indexed
      </label>
      <span className={hintClass}>Reuse index across keystrokes instead of rebuilding.</span>
    </div>
  );
}

function ConfigControls({ engineKey, config, onConfigChange }: ResultsColumnProps) {
  switch (engineKey) {
    case 'seaq':
      return <SeaqControls config={config as SeaqConfig} onChange={onConfigChange as any} />;
    case 'fuse':
      return <FuseControls config={config as FuseConfig} onChange={onConfigChange as any} />;
    case 'minisearch':
      return <MiniSearchControls config={config as MiniSearchConfig} onChange={onConfigChange as any} />;
    case 'ufuzzy':
      return <UFuzzyControls config={config as UFuzzyConfig} onChange={onConfigChange as any} />;
    case 'lunr':
      return <LunrControls config={config as LunrConfig} onChange={onConfigChange as any} />;
  }
}

// ── Main component ──

export function ResultsColumn(props: ResultsColumnProps) {
  const { name, query, keys, engineKey, config, result } = props;
  const snippet = codeSnippet(engineKey, query, keys, config);

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{name}</h3>
        {result && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${timingColor(result.timeMs)}`}>
            {result.timeMs.toFixed(1)}ms
          </span>
        )}
      </div>

      {/* Config controls */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-gray-100 px-4 py-2 dark:border-gray-700/50">
        <ConfigControls {...props} />
      </div>

      {/* Code snippet */}
      <div className="border-b border-gray-100 bg-gray-900 px-3 py-2 dark:border-gray-700/50">
        <pre className="whitespace-pre-wrap break-all text-[9px] leading-snug text-gray-100">
          <code>{snippet}</code>
        </pre>
      </div>

      {/* Results */}
      <div className="flex-1 px-4 py-3">
        {!result ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Type a query to search...</p>
        ) : result.results.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No results</p>
        ) : (
          <>
            <ul className="space-y-1">
              {result.results.map((text, i) => (
                <li key={i} className="truncate text-sm text-gray-700 dark:text-gray-300">
                  {text}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              {result.resultCount} result{result.resultCount !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
