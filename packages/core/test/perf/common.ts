import type { City, Contact } from '@seaq/test-data';
import Books from '@seaq/test-data/books.json';
import Cities from '@seaq/test-data/cities.json';
import Contacts from '@seaq/test-data/contacts-1k.json';
import ManyContacts from '@seaq/test-data/contacts-10k.json';

export const data = {
  Books,
  Contacts: Contacts as Contact[],
  ManyContacts: ManyContacts as Contact[],
  Cities: Cities as City[],
};

export const CONSECUTIVE_COUNT = 10;
