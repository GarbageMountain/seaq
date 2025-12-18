import { bench, describe } from 'vitest';
import { seaq } from '../../src/index';
import { CONSECUTIVE_COUNT, data } from './common';

const { Books, ManyBooks, ManyContacts } = data;

describe('seaq - single search', () => {
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

describe(`seaq - ${CONSECUTIVE_COUNT} consecutive searches`, () => {
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
