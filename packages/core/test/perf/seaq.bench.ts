import { bench, describe } from 'vitest';
import { seaq } from '../../src/index';
import { CONSECUTIVE_COUNT, data } from './common';

const { Books, ManyBooks, ManyContacts } = data;

// Simple string array for no-keys testing
const stringArray = ManyContacts.map((c) => `${c.givenName} ${c.familyName}`);

describe('seaq - single search (with keys)', () => {
  bench('23-books', () => {
    seaq(Books, 'hi', ['title', 'author.firstName']);
  });

  bench('10,000-books', () => {
    seaq(ManyBooks, 'cons con', ['title', 'author']);
  });

  bench('10,000-contacts', () => {
    seaq(ManyContacts, 'nath fe', ['givenName', 'familyName']);
  });
});

describe('seaq - single search (no keys - string array)', () => {
  bench('10,000-strings', () => {
    seaq(stringArray, 'nath fe');
  });
});

describe('seaq - single search (no keys - object array)', () => {
  bench('10,000-contacts', () => {
    seaq(ManyContacts, 'nath fe');
  });
});

describe(`seaq - ${CONSECUTIVE_COUNT} consecutive searches (with keys)`, () => {
  bench('23-books', () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(Books, 'hi', ['title', 'author.firstName']);
    }
  });

  bench('10,000-books', () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(ManyBooks, 'cons con', ['title', 'author']);
    }
  });

  bench('10,000-contacts', () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(ManyContacts, 'nath fe', ['givenName', 'familyName']);
    }
  });
});
