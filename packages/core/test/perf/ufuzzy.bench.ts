import uFuzzy from '@leeoniya/ufuzzy';
import { bench, describe } from 'vitest';
import { CONSECUTIVE_COUNT, data } from './common';

const { Books, ManyContacts } = data;

// Prepare haystack arrays for uFuzzy (it searches arrays of strings)
const booksHaystack = Books.map((b) => `${b.title} ${b.author.firstName}`);
const manyContactsHaystack = ManyContacts.map((c) => `${c.givenName} ${c.familyName}`);

describe('ufuzzy - single search', () => {
  bench('23-books', () => {
    const uf = new uFuzzy();
    uf.search(booksHaystack, 'hi');
  });

  bench('10,000-contacts', () => {
    const uf = new uFuzzy();
    uf.search(manyContactsHaystack, 'nath fe');
  });
});

describe(`ufuzzy - ${CONSECUTIVE_COUNT} consecutive searches`, () => {
  bench('23-books', () => {
    const uf = new uFuzzy();
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      uf.search(booksHaystack, 'hi');
    }
  });

  bench('10,000-contacts', () => {
    const uf = new uFuzzy();
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      uf.search(manyContactsHaystack, 'nath fe');
    }
  });
});
