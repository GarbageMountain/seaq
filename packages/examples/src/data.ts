import contactsJson from './data/contacts.json';

export interface Book {
  title: string;
  author: { firstName: string; lastName: string };
}

export interface Contact {
  recordID: number;
  familyName: string;
  givenName: string;
  middleName: string;
  emailAddresses: Array<{ label: string; email: string }>;
  phoneNumbers: Array<{ label: string; email: string }>;
  thumbnailPath: string;
}

export const books: Book[] = [
  { title: "Old Man's War", author: { firstName: "John", lastName: "Scalzi" } },
  { title: "The Lock Artist", author: { firstName: "Steve", lastName: "Hamilton" } },
  { title: "HTML5", author: { firstName: "Remy", lastName: "Sharp" } },
  { title: "Right Ho Jeeves", author: { firstName: "P.D", lastName: "Woodhouse" } },
  { title: "The Code of the Wooster", author: { firstName: "P.D", lastName: "Woodhouse" } },
  { title: "Thank You Jeeves", author: { firstName: "P.D", lastName: "Woodhouse" } },
  { title: "The DaVinci Code", author: { firstName: "Dan", lastName: "Brown" } },
  { title: "Angels & Demons", author: { firstName: "Dan", lastName: "Brown" } },
  { title: "The Silmarillion", author: { firstName: "J.R.R", lastName: "Tolkien" } },
  { title: "Syrup", author: { firstName: "Max", lastName: "Barry" } },
  { title: "The Lost Symbol", author: { firstName: "Dan", lastName: "Brown" } },
  { title: "The Book of Lies", author: { firstName: "Brad", lastName: "Meltzer" } },
  { title: "Lamb", author: { firstName: "Christopher", lastName: "Moore" } },
  { title: "Fool", author: { firstName: "Christopher", lastName: "Moore" } },
  { title: "Incompetence", author: { firstName: "Rob", lastName: "Grant" } },
  { title: "Fat", author: { firstName: "Rob", lastName: "Grant" } },
  { title: "Colony", author: { firstName: "Rob", lastName: "Grant" } },
  { title: "Backwards, Red Dwarf", author: { firstName: "Rob", lastName: "Grant" } },
  { title: "The Grand Design", author: { firstName: "Stephen", lastName: "Hawking" } },
  { title: "The Book of Samson", author: { firstName: "David", lastName: "Maine" } },
  { title: "The Preservationist", author: { firstName: "David", lastName: "Maine" } },
  { title: "Fallen", author: { firstName: "David", lastName: "Maine" } },
  { title: "Monster 1959", author: { firstName: "David", lastName: "Maine" } },
];

export const places: string[] = [
  'New York City',
  'Los Angeles',
  'San Francisco',
  'Las Vegas',
  'New Orleans',
  'Salt Lake City',
  'Kansas City',
  'Oklahoma City',
  'New York',
  'North Carolina',
  'South Carolina',
  'West Virginia',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'Hillsdale Michigan',
  'Historical Museum',
  'High Mountain',
  'himalayas',
];

export const techTerms: string[] = [
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
];

export const companies: string[] = [
  'International Business Machines',
  'American Telephone Telegraph',
  'Hewlett Packard Enterprise',
  'General Electric Company',
  'Federal Bureau Investigation',
  'Central Intelligence Agency',
  'National Aeronautics Space Administration',
  'United States America',
  'United Kingdom',
  'European Union',
  'International Monetary Fund',
  'World Health Organization',
  'North Atlantic Treaty Organization',
];

export const contacts: Contact[] = contactsJson as Contact[];

export type DatasetKey = 'books' | 'contacts' | 'places' | 'techTerms' | 'companies';

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
  places: {
    label: 'Places (19)',
    data: places,
    keys: [],
    displayFn: stringDisplay,
  },
  techTerms: {
    label: 'Tech Terms (13)',
    data: techTerms,
    keys: [],
    displayFn: stringDisplay,
  },
  companies: {
    label: 'Companies (13)',
    data: companies,
    keys: [],
    displayFn: stringDisplay,
  },
};
