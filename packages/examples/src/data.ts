import type { Book, City, Contact } from '@seaq/test-data';
import booksJson from '@seaq/test-data/books.json';
import citiesJson from '@seaq/test-data/cities.json';
import contactsJson from '@seaq/test-data/contacts-1k.json';

export type { Contact, City, Book };

export const books: Book[] = booksJson as Book[];

// Consolidated from the old places, techTerms, and companies datasets.
// Mix of geography, tech acronyms, and organizations for demonstrating
// acronym matching, fuzzy search, and substring ranking on plain strings.
export const phrases: string[] = [
  // Places — good for acronym + prefix demos
  'New York City',
  'Los Angeles',
  'San Francisco',
  'Las Vegas',
  'New Orleans',
  'Salt Lake City',
  'Kansas City',
  'Oklahoma City',
  'North Carolina',
  'South Carolina',
  'West Virginia',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'San Juan',
  'El Paso',
  'Rio Grande',
  'District of Columbia',
  // Tech terms — full forms for acronym search
  'Application Programming Interface',
  'Graphical User Interface',
  'Command Line Interface',
  'Software Development Kit',
  'Integrated Development Environment',
  'Object Oriented Programming',
  'Test Driven Development',
  'Continuous Integration Deployment',
  'Single Page Application',
  'Progressive Web App',
  'Search Engine Optimization',
  'User Experience Design',
  'User Interface Design',
  'Machine Learning',
  'Artificial Intelligence',
  'Natural Language Processing',
  'Virtual Private Network',
  'Content Delivery Network',
  // Organizations — acronym-heavy
  'International Business Machines',
  'American Telephone & Telegraph',
  'Hewlett Packard Enterprise',
  'General Electric Company',
  'Federal Bureau of Investigation',
  'Central Intelligence Agency',
  'National Aeronautics & Space Administration',
  'International Monetary Fund',
  'World Health Organization',
  'North Atlantic Treaty Organization',
  'European Space Agency',
  'United Nations',
];

export const contacts: Contact[] = contactsJson as Contact[];
export const cities: City[] = citiesJson as City[];

export type DatasetKey = 'books' | 'contacts' | 'cities' | 'phrases';

/** The dataset selector also offers a user-provided JSON dataset. */
export type SelectableDataset = DatasetKey | 'custom';

export interface DatasetConfig {
  label: string;
  data: unknown[];
  keys: string[];
  displayFn: (item: unknown) => string;
}

// ── Custom (user-provided) datasets ──

/** Walk a single item and return all dot-paths that lead to a string value. */
export function discoverItemPaths(item: unknown, prefix = ''): string[] {
  if (item == null || typeof item !== 'object') return [];
  if (Array.isArray(item)) {
    return item.length > 0 ? discoverItemPaths(item[0], prefix) : [];
  }
  const paths: string[] = [];
  for (const [key, val] of Object.entries(item as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') {
      paths.push(path);
    } else if (typeof val === 'object' && val != null) {
      paths.push(...discoverItemPaths(val, path));
    }
  }
  return paths;
}

/** Sample multiple items to discover all string paths, including optional fields. */
export function discoverStringPaths(data: unknown[]): string[] {
  const seen = new Set<string>();
  const sample = data.slice(0, 20);
  for (const item of sample) {
    for (const path of discoverItemPaths(item)) {
      seen.add(path);
    }
  }
  return [...seen];
}

/** Resolve a dot path on an item for display purposes (arrays joined with commas). */
function resolveDisplayPath(item: unknown, path: string): string {
  const parts = path.split('.');
  let val: unknown = item;
  for (let i = 0; i < parts.length; i++) {
    if (val == null) return '';
    if (Array.isArray(val)) {
      const rest = parts.slice(i).join('.');
      return val
        .map((v) => resolveDisplayPath(v, rest))
        .filter(Boolean)
        .join(', ');
    }
    val = (val as Record<string, unknown>)[parts[i] as string];
  }
  if (val == null || typeof val === 'object') return '';
  return String(val);
}

export type CustomParseResult = { ok: true; config: DatasetConfig } | { ok: false; error: string };

function describeType(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  if (typeof v === 'object') return 'an object';
  return `a ${typeof v}`;
}

/**
 * Parse user-supplied JSON into a searchable dataset.
 *
 * Constraints: the JSON must be a non-empty array, and items must be
 * homogeneous — either all strings, or all plain objects with at least one
 * string field somewhere to search.
 */
export function parseCustomDataset(jsonText: string): CustomParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, error: `That isn't valid JSON: ${(e as Error).message}` };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: `The JSON must be an array of items — got ${describeType(parsed)}. Wrap your records in [ ... ].`,
    };
  }
  if (parsed.length === 0) {
    return { ok: false, error: 'The array is empty — add at least one item.' };
  }

  const first = parsed[0];
  const wantStrings = typeof first === 'string';
  const wantObjects = typeof first === 'object' && first !== null && !Array.isArray(first);
  if (!wantStrings && !wantObjects) {
    return {
      ok: false,
      error: `Items must be strings or objects — the first item is ${describeType(first)}.`,
    };
  }

  for (let i = 1; i < parsed.length; i++) {
    const item = parsed[i];
    const isString = typeof item === 'string';
    const isObject = typeof item === 'object' && item !== null && !Array.isArray(item);
    if ((wantStrings && !isString) || (wantObjects && !isObject)) {
      return {
        ok: false,
        error: `Items must be homogeneous: item 0 is ${describeType(first)} but item ${i} is ${describeType(item)}.`,
      };
    }
  }

  const label = `Custom (${parsed.length.toLocaleString()})`;

  if (wantStrings) {
    return {
      ok: true,
      config: { label, data: parsed, keys: [], displayFn: (item) => String(item) },
    };
  }

  const allPaths = discoverStringPaths(parsed);
  if (allPaths.length === 0) {
    return {
      ok: false,
      error:
        'No string fields found in the sampled items — there is nothing text-like to search. Items need at least one string property (nested is fine).',
    };
  }
  // Default to the first few discovered fields; the field picker can add the rest
  const keys = allPaths.slice(0, 4);
  const displayKeys = keys.slice(0, 2);
  return {
    ok: true,
    config: {
      label,
      data: parsed,
      keys,
      displayFn: (item) => {
        const partsList = displayKeys.map((k) => resolveDisplayPath(item, k)).filter(Boolean);
        return partsList.length > 0 ? partsList.join(' — ') : JSON.stringify(item).slice(0, 80);
      },
    },
  };
}

function contactDisplay(item: unknown): string {
  const c = item as Contact;
  return `${c.givenName} ${c.familyName}`;
}

function bookDisplay(item: unknown): string {
  const b = item as Book;
  return `${b.title} — ${b.author.firstName} ${b.author.lastName}`;
}

function cityDisplay(item: unknown): string {
  const c = item as City;
  return c.state ? `${c.name}, ${c.state}, ${c.countryCode}` : `${c.name}, ${c.countryCode}`;
}

function stringDisplay(item: unknown): string {
  return item as string;
}

export const datasets: Record<DatasetKey, DatasetConfig> = {
  books: {
    label: 'Books (23)',
    data: books,
    keys: ['title', 'author.firstName', 'author.lastName'],
    displayFn: bookDisplay,
  },
  contacts: {
    label: '1K Contacts',
    data: contacts,
    keys: ['givenName', 'familyName', 'middleName'],
    displayFn: contactDisplay,
  },
  cities: {
    label: '20K Cities',
    data: cities,
    keys: ['name', 'state'],
    displayFn: cityDisplay,
  },
  phrases: {
    label: 'Phrases (48)',
    data: phrases,
    keys: [],
    displayFn: stringDisplay,
  },
};
