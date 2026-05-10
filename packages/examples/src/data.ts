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

export interface DatasetConfig {
  label: string;
  data: unknown[];
  keys: string[];
  displayFn: (item: unknown) => string;
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
