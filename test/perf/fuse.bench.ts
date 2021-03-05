import { benchmarkSuite } from 'jest-bench';
import Fuse from 'fuse.js';

import { data, CONSECUTIVE_COUNT } from './common';

const { Books, ManyBooks, ManyContacts } = data;

benchmarkSuite('fuse - single search', {
  '23-books': () => {
    const fuse = new Fuse(Books, {
      keys: ['title', 'author.firstName'],
    });
    fuse.search('hi');
  },
  '10,000-books': () => {
    const fuse = new Fuse(ManyBooks, {
      keys: ['title', 'author'],
    });
    fuse.search('cons con');
  },
  '10,000-contacts': () => {
    const fuse = new Fuse(ManyContacts, {
      keys: ['givenName', 'familyName'],
    });
    fuse.search('nath fe');
  },
});

benchmarkSuite(`fuse - ${CONSECUTIVE_COUNT} consecutive searches`, {
  '23-books': () => {
    const fuse = new Fuse(Books, {
      keys: ['title', 'author.firstName'],
    });
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      fuse.search('hi');
    }
  },
  '10,000-books': () => {
    const fuse = new Fuse(ManyBooks, {
      keys: ['title', 'author'],
    });
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      fuse.search('cons con');
    }
  },
  '10,000-contacts': () => {
    const fuse = new Fuse(ManyContacts, {
      keys: ['givenName', 'familyName'],
    });
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      fuse.search('nath fe');
    }
  },
});
