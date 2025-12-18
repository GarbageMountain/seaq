import lunr from 'lunr';
import { bench, describe } from 'vitest';
import { CONSECUTIVE_COUNT, data } from './common';

const { Books, ManyBooks, ManyContacts } = data;

describe('lunr - single search', () => {
  bench('23-books', () => {
    const search = lunr(function () {
      this.field('title');
      this.field('author');

      Books.forEach((book) => {
        this.add({
          title: book.title,
          author: book.author,
        });
      });
    });

    search.search('hi');
  });

  bench('10,000-books', () => {
    const search = lunr(function () {
      this.field('title');
      this.field('author');

      ManyBooks.forEach((book) => {
        this.add({
          title: book.title,
          author: book.author,
        });
      });
    });

    search.search('cons con');
  });

  bench('10,000-contacts', () => {
    const search = lunr(function () {
      this.field('givenName');
      this.field('familyName');

      ManyContacts.forEach((contact) => {
        this.add({
          givenName: contact.givenName,
          familyName: contact.familyName,
        });
      });
    });

    search.search('nath fe');
  });
});

describe(`lunr - ${CONSECUTIVE_COUNT} consecutive searches`, () => {
  bench('23-books', () => {
    const search = lunr(function () {
      this.field('title');
      this.field('author');

      Books.forEach((book) => {
        this.add({
          title: book.title,
          author: book.author,
        });
      });
    });

    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      search.search('hi');
    }
  });

  bench('10,000-books', () => {
    const search = lunr(function () {
      this.field('title');
      this.field('author');

      ManyBooks.forEach((book) => {
        this.add({
          title: book.title,
          author: book.author,
        });
      });
    });

    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      search.search('cons con');
    }
  });

  bench('10,000-contacts', () => {
    const search = lunr(function () {
      this.field('givenName');
      this.field('familyName');

      ManyContacts.forEach((contact) => {
        this.add({
          givenName: contact.givenName,
          familyName: contact.familyName,
        });
      });
    });

    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      search.search('nath fe');
    }
  });
});
