export interface Contact {
  recordID: number;
  givenName: string;
  familyName: string;
  middleName: string;
  emailAddresses: Array<{ label: string; email: string }>;
  phoneNumbers: Array<{ label: string; number: string }>;
}

export interface City {
  name: string;
  countryCode: string;
  coord: { lat: number; lon: number };
  population: number;
  state?: string;
}

export interface Book {
  title: string;
  author: { firstName: string; lastName: string };
}
