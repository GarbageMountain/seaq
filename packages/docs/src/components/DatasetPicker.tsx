import { type DatasetKey, datasets, type SelectableDataset } from '../data';

interface DatasetPickerProps {
  selected: SelectableDataset;
  onChange: (key: SelectableDataset) => void;
  /** Label for the custom option, e.g. "Custom (1,234)" once data is loaded. */
  customLabel: string | null;
}

const datasetKeys = Object.keys(datasets) as DatasetKey[];

export function DatasetPicker({ selected, onChange, customLabel }: DatasetPickerProps) {
  const buttonClass = (key: SelectableDataset) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      selected === key
        ? 'bg-blue-600 text-white shadow-sm'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
    }`;
  return (
    <div className="flex flex-wrap gap-2">
      <span className="self-center text-sm font-medium text-gray-500 dark:text-gray-400">
        Dataset:
      </span>
      {datasetKeys.map((key) => (
        <button key={key} type="button" onClick={() => onChange(key)} className={buttonClass(key)}>
          {datasets[key].label}
        </button>
      ))}
      <button type="button" onClick={() => onChange('custom')} className={buttonClass('custom')}>
        {customLabel ?? 'Your JSON…'}
      </button>
    </div>
  );
}
