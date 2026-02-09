import { bench, describe } from 'vitest';
import { seaq } from '../../src/index';
// @ts-expect-error - direct import from node_modules to avoid workspace resolution
import { seaq as seaqV1 } from '../../../../node_modules/seaq/dist/seaq.esm.js';
import { CONSECUTIVE_COUNT, data } from './common';

const { Books, ManyBooks, ManyContacts } = data;

// Simple string array for no-keys testing
const stringArray = ManyContacts.map((c) => `${c.givenName} ${c.familyName}`);

describe('seaq v1 vs v2 - 10K books', () => {
  bench('v1 (published)', () => {
    seaqV1(ManyBooks, 'cons con', ['title', 'author']);
  });

  bench('v2 (joined)', () => {
    seaq(ManyBooks, 'cons con', { keys: ['title', 'author'] });
  });

  bench('v2 (separate)', () => {
    seaq(ManyBooks, 'cons con', { keys: ['title', 'author'], fieldMode: 'separate' });
  });
});

describe('seaq v1 vs v2 - 10K contacts', () => {
  bench('v1 (published)', () => {
    seaqV1(ManyContacts, 'nath fe', ['givenName', 'familyName']);
  });

  bench('v2 (joined)', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'] });
  });

  bench('v2 (separate)', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'separate' });
  });
});

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

describe('seaq - top 10 results (slice vs limit)', () => {
  bench('10,000-contacts - slice(0,10) [current way]', () => {
    seaq(ManyContacts, 'na', { keys: ['givenName', 'familyName'] }).slice(0, 10);
  });

  bench('10,000-contacts - limit: 10 [optimized]', () => {
    seaq(ManyContacts, 'na', { keys: ['givenName', 'familyName'], limit: 10 });
  });

  bench('10,000-books - slice(0,10) [current way]', () => {
    seaq(ManyBooks, 'the', { keys: ['title', 'author'] }).slice(0, 10);
  });

  bench('10,000-books - limit: 10 [optimized]', () => {
    seaq(ManyBooks, 'the', { keys: ['title', 'author'], limit: 10 });
  });
});
