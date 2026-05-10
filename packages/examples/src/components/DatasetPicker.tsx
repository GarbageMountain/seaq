import { type DatasetKey, datasets } from '../data';

interface DatasetPickerProps {
  selected: DatasetKey;
  onChange: (key: DatasetKey) => void;
}

const datasetKeys = Object.keys(datasets) as DatasetKey[];

export function DatasetPicker({ selected, onChange }: DatasetPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="self-center text-sm font-medium text-gray-500 dark:text-gray-400">
        Dataset:
      </span>
      {datasetKeys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            selected === key
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {datasets[key].label}
        </button>
      ))}
    </div>
  );
}
