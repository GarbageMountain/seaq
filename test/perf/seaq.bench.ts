import { benchmarkSuite } from 'jest-bench';
import { seaq } from '../../dist';

import { data, CONSECUTIVE_COUNT } from './common';

const { Books, ManyBooks, ManyContacts } = data;

benchmarkSuite('seaq - single search', {
  '23-books': () => {
    seaq(Books, 'hi', ['title', 'author.firstName']);
  },
  '10,000-books': () => {
    seaq(ManyBooks, 'cons con', ['title', 'author']);
  },
  '10,000-contacts': () => {
    seaq(ManyContacts, 'nath fe', ['givenName', 'familyName']);
  },
});

benchmarkSuite(`seaq - ${CONSECUTIVE_COUNT} consecutive searches`, {
  '23-books': () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(Books, 'hi', ['title', 'author.firstName']);
    }
  },
  '10,000-books': () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(ManyBooks, 'cons con', ['title', 'author']);
    }
  },
  '10,000-contacts': () => {
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      seaq(ManyContacts, 'nath fe', ['givenName', 'familyName']);
    }
  },
});
