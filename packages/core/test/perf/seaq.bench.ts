import { bench, describe } from 'vitest';
import { seaq } from '../../src/index';
import { CONSECUTIVE_COUNT, data } from './common';

const { Books, ManyBooks, ManyContacts } = data;

// Simple string array for no-keys testing
const stringArray = ManyContacts.map((c) => `${c.givenName} ${c.familyName}`);

describe('seaq - single search (joined mode - default)', () => {
  bench('23-books', () => {
    seaq(Books, 'hi', { keys: ['title', 'author.firstName'] });
  });

  bench('10,000-books', () => {
    seaq(ManyBooks, 'cons con', { keys: ['title', 'author'] });
  });

  bench('10,000-contacts', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'] });
  });
});

describe('seaq - single search (separate mode - faster)', () => {
  bench('23-books', () => {
    seaq(Books, 'hi', { keys: ['title', 'author.firstName'], fieldMode: 'separate' });
  });

  bench('10,000-books', () => {
    seaq(ManyBooks, 'cons con', { keys: ['title', 'author'], fieldMode: 'separate' });
  });

  bench('10,000-contacts', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'separate' });
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

describe(`seaq - ${CONSECUTIVE_COUNT} consecutive searches (joined mode)`, () => {
  bench('23-books', () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(Books, 'hi', { keys: ['title', 'author.firstName'] });
    }
  });

  bench('10,000-books', () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(ManyBooks, 'cons con', { keys: ['title', 'author'] });
    }
  });

  bench('10,000-contacts', () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'] });
    }
  });
});
