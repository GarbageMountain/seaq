import { useRef, useState } from 'react';
import { type DatasetConfig, parseCustomDataset } from '../data';

interface CustomDataPanelProps {
  /** The currently loaded custom dataset, if any. */
  current: DatasetConfig | null;
  onLoad: (config: DatasetConfig) => void;
  onClear: () => void;
}

const PLACEHOLDER = `Paste a JSON array, e.g.

[
  { "name": "Ada Lovelace", "field": "mathematics" },
  { "name": "Grace Hopper", "field": "computer science" }
]

or a plain string array:

["New York City", "Los Angeles", "San Francisco"]`;

export function CustomDataPanel({ current, onLoad, onClear }: CustomDataPanelProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function load(jsonText: string) {
    const result = parseCustomDataset(jsonText);
    if (result.ok) {
      setError(null);
      onLoad(result.config);
    } else {
      setError(result.error);
    }
  }

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    try {
      const contents = await file.text();
      setText(contents.length > 100_000 ? `${contents.slice(0, 100_000)}…` : contents);
      load(contents);
    } catch {
      setError(`Could not read ${file.name}.`);
    }
    // allow re-selecting the same file
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Bring your own data</h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Parsed locally in your browser — your data never leaves the page.
        </span>
      </div>

      {current ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
          <span>
            Loaded <strong>{current.data.length.toLocaleString()}</strong> items
            {current.keys.length > 0 && (
              <>
                {' '}
                — searching <code className="text-xs">[{current.keys.join(', ')}]</code> (adjust
                with the field checkboxes above)
              </>
            )}
            {current.keys.length === 0 && ' (plain strings)'}
          </span>
          <button
            type="button"
            onClick={() => {
              setText('');
              setError(null);
              onClear();
            }}
            className="rounded-md bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Replace data
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Paste or upload a JSON <strong>array</strong> of homogeneous items — all strings, or all
            objects with at least one string field (nesting and arrays are fine). Searchable fields
            are detected automatically.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            rows={8}
            className="w-full rounded-md border border-gray-300 bg-white p-2 font-mono text-xs text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(text)}
              disabled={!text.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Load data
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Upload .json file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => onFilePicked(e.target.files?.[0])}
            />
          </div>
        </>
      )}

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
