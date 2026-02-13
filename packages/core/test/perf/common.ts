import type { Contact, City } from '@seaq/test-data';
import Contacts from '@seaq/test-data/contacts-1k.json';
import ManyContacts from '@seaq/test-data/contacts-10k.json';
import Books from '@seaq/test-data/books.json';
import Cities from '@seaq/test-data/cities.json';

export const data = {
  Books,
  Contacts: Contacts as Contact[],
  ManyContacts: ManyContacts as Contact[],
  Cities: Cities as City[],
};

export const CONSECUTIVE_COUNT = 10;
