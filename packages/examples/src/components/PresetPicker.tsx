import type { DatasetKey } from '../data';

export interface Preset {
  label: string;
  description: string;
  dataset: DatasetKey;
  query: string;
  preIndexed?: boolean;
  fuzziness?: number;
  keys?: string[];
  skipEngines?: string[];
}

export const presets: Preset[] = [
  {
    label: 'Default',
    description: '1K contacts, basic name search',
    dataset: 'contacts',
    query: 'nath',
  },
  {
    label: 'Acronyms',
    description: 'seaq finds acronyms while others fail',
    dataset: 'phrases',
    query: 'NYC',
  },
  {
    label: 'Typo Tolerance',
    description: 'Fuzzy matching differences across libs',
    dataset: 'contacts',
    query: 'Jonh',
    fuzziness: 0.5,
  },
  {
    label: 'Nested Data',
    description: 'seaq searches nested email fields natively',
    dataset: 'contacts',
    query: 'gmail',
    keys: ['emailAddresses.email'],
    skipEngines: ['ufuzzy'],
  },
  {
    label: 'Pre-indexed',
    description: 'MiniSearch/Lunr reuse their pre-built index',
    dataset: 'contacts',
    query: 'lor',
    preIndexed: true,
  },
];

interface PresetPickerProps {
  onSelect: (preset: Preset) => void;
  active: string | null;
}

export function PresetPicker({ onSelect, active }: PresetPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="self-center text-sm font-medium text-gray-500 dark:text-gray-400">Presets:</span>
      {presets.map((preset) => (
        <button
          key={preset.label}
          onClick={() => onSelect(preset)}
          title={preset.description}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active === preset.label
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
