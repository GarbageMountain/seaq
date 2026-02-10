import { bench, describe } from 'vitest';
import { seaq } from '../../src/index';
// @ts-expect-error - direct import from node_modules to avoid workspace resolution
import { seaq as seaqV1 } from '../../../../node_modules/seaq/dist/seaq.esm.js';
import { CONSECUTIVE_COUNT, data } from './common';

const { Books, ManyContacts } = data;

// Simple string array for no-keys testing
const stringArray = ManyContacts.map((c) => `${c.givenName} ${c.familyName}`);

describe('seaq v1 vs v2 - 10K contacts', () => {
  bench('v1 (published)', () => {
    seaqV1(ManyContacts, 'nath fe', ['givenName', 'familyName']);
  });

  bench('v2 (joined)', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0 });
  });

  bench('v2 (separate)', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'separate', fuzziness: 0 });
  });
});

describe('seaq - single search (joined mode)', () => {
  bench('23-books', () => {
    seaq(Books, 'hi', { keys: ['title', 'author.firstName'], fieldMode: 'joined', fuzziness: 0 });
  });

  bench('10,000-contacts', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0 });
  });
});

describe('seaq - single search (separate mode)', () => {
  bench('23-books', () => {
    seaq(Books, 'hi', { keys: ['title', 'author.firstName'], fieldMode: 'separate', fuzziness: 0 });
  });

  bench('10,000-contacts', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'separate', fuzziness: 0 });
  });
});

describe('seaq - single search (no keys - string array)', () => {
  bench('10,000-strings', () => {
    seaq(stringArray, 'nath fe', { fuzziness: 0 });
  });
});

describe('seaq - single search (no keys - object array)', () => {
  bench('10,000-contacts', () => {
    seaq(ManyContacts, 'nath fe', { fuzziness: 0 });
  });
});

describe(`seaq - ${CONSECUTIVE_COUNT} consecutive searches (joined mode)`, () => {
  bench('23-books', () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(Books, 'hi', { keys: ['title', 'author.firstName'], fieldMode: 'joined', fuzziness: 0 });
    }
  });

  bench('10,000-contacts', () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0 });
    }
  });
});

describe('seaq - includeMatches overhead (joined)', () => {
  bench('10K contacts - without includeMatches', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0 });
  });

  bench('10K contacts - with includeMatches', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0, includeMatches: true });
  });

});

describe('seaq - includeMatches overhead (separate)', () => {
  bench('10K contacts - without includeMatches', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'separate', fuzziness: 0 });
  });

  bench('10K contacts - with includeMatches', () => {
    seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'separate', fuzziness: 0, includeMatches: true });
  });
});

describe('seaq - top 10 results (slice vs limit)', () => {
  bench('10,000-contacts - slice(0,10) [current way]', () => {
    seaq(ManyContacts, 'na', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0 }).slice(0, 10);
  });

  bench('10,000-contacts - limit: 10 [optimized]', () => {
    seaq(ManyContacts, 'na', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0, limit: 10 });
  });

});
