import Books from '../data/fuseBooks.json';
import Contacts from '../data/1_000Contacts.json';
import ManyBooks from '../data/10_000Books.json';
import ManyContacts from '../data/10_000Contacts.json';

export const data = {
  Books,
  Contacts,
  ManyBooks,
  ManyContacts: ManyContacts as typeof Contacts,
};

export const CONSECUTIVE_COUNT = 1000;
