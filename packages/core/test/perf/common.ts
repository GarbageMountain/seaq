import type { Contact } from '@seaq/test-data';
import Contacts from '@seaq/test-data/contacts-1k.json';
import ManyContacts from '@seaq/test-data/contacts-10k.json';
import Books from '@seaq/test-data/books.json';

export const data = {
  Books,
  Contacts: Contacts as Contact[],
  ManyContacts: ManyContacts as Contact[],
};

export const CONSECUTIVE_COUNT = 10;
