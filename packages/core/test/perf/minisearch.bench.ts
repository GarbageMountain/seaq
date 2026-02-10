import MiniSearch from 'minisearch';
import { bench, describe } from 'vitest';
import { CONSECUTIVE_COUNT, data } from './common';

const { Books, ManyContacts } = data;

describe('minisearch - single search', () => {
  bench('23-books', () => {
    const ms = new MiniSearch({
      fields: ['title', 'authorFirstName'],
      storeFields: ['title', 'author'],
    });
    ms.addAll(Books.map((b, i) => ({ id: i, title: b.title, authorFirstName: b.author.firstName })));
    ms.search('hi');
  });

  bench('10,000-contacts', () => {
    const ms = new MiniSearch({
      fields: ['givenName', 'familyName'],
      storeFields: ['givenName', 'familyName'],
    });
    ms.addAll(ManyContacts.map((c, i) => ({ id: i, givenName: c.givenName, familyName: c.familyName })));
    ms.search('nath fe');
  });
});

describe(`minisearch - ${CONSECUTIVE_COUNT} consecutive searches`, () => {
  bench('23-books', () => {
    const ms = new MiniSearch({
      fields: ['title', 'authorFirstName'],
      storeFields: ['title', 'author'],
    });
    ms.addAll(Books.map((b, i) => ({ id: i, title: b.title, authorFirstName: b.author.firstName })));
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      ms.search('hi');
    }
  });

  bench('10,000-contacts', () => {
    const ms = new MiniSearch({
      fields: ['givenName', 'familyName'],
      storeFields: ['givenName', 'familyName'],
    });
    ms.addAll(ManyContacts.map((c, i) => ({ id: i, givenName: c.givenName, familyName: c.familyName })));
    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      ms.search('nath fe');
    }
  });
});
