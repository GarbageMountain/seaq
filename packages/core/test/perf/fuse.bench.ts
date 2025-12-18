import Fuse from 'fuse.js';
import { bench, describe } from 'vitest';
import { CONSECUTIVE_COUNT, data } from './common';

const { Books, ManyBooks, ManyContacts } = data;

describe('fuse - single search', () => {
  bench('23-books', () => {
    const fuse = new Fuse(Books, {
      keys: ['title', 'author.firstName'],
    });
    fuse.search('hi');
  });

  bench('10,000-books', () => {
    const fuse = new Fuse(ManyBooks, {
      keys: ['title', 'author'],
    });
    fuse.search('cons con');
  });

  bench('10,000-contacts', () => {
    const fuse = new Fuse(ManyContacts, {
      keys: ['givenName', 'familyName'],
    });
    fuse.search('nath fe');
  });
});

describe(`fuse - ${CONSECUTIVE_COUNT} consecutive searches`, () => {
  bench('23-books', () => {
    const fuse = new Fuse(Books, {
      keys: ['title', 'author.firstName'],
    });
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      fuse.search('hi');
    }
  });

  bench('10,000-books', () => {
    const fuse = new Fuse(ManyBooks, {
      keys: ['title', 'author'],
    });
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      fuse.search('cons con');
    }
  });

  bench('10,000-contacts', () => {
    const fuse = new Fuse(ManyContacts, {
      keys: ['givenName', 'familyName'],
    });
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      fuse.search('nath fe');
    }
  });
});
