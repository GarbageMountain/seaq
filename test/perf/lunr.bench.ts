import { benchmarkSuite } from 'jest-bench';
import Lunr from 'lunr';

import { data, CONSECUTIVE_COUNT } from './common';

const { Books, ManyBooks, ManyContacts } = data;

benchmarkSuite('lunr - single search', {
  '23-books': () => {
    const search = Lunr(function() {
      let that = this;
      that.field('title');
      that.field('author');

      Books.forEach(book => {
        that.add({
          title: book.title,
          author: book.author,
        });
      });
    });

    search.search('hi');
  },
  '10,000-books': () => {
    const search = Lunr(function() {
      let that = this;
      that.field('title');
      that.field('author');

      ManyBooks.forEach(book => {
        that.add({
          title: book.title,
          author: book.author,
        });
      });
    });

    search.search('cons con');
  },
  '10,000-contacts': () => {
    const search = Lunr(function() {
      let that = this;
      that.field('title');
      that.field('author');
      ManyContacts.forEach(contact => {
        that.add({
          givenName: contact.givenName,
          familyName: contact.familyName,
        });
      });
    });
    search.search('nath fe');
  },
});

benchmarkSuite(`lunr - ${CONSECUTIVE_COUNT} consecutive searches`, {
  '23-books': () => {
    const search = Lunr(function() {
      let that = this;
      that.field('title');
      that.field('author');

      Books.forEach(book => {
        that.add({
          title: book.title,
          author: book.author,
        });
      });
    });

    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      search.search('hi');
    }
  },
  '10,000-books': () => {
    const search = Lunr(function() {
      let that = this;
      that.field('title');
      that.field('author');

      ManyBooks.forEach(book => {
        that.add({
          title: book.title,
          author: book.author,
        });
      });
    });

    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      search.search('cons con');
    }
  },
  '10,000-contacts': () => {
    const search = Lunr(function() {
      let that = this;
      that.field('title');
      that.field('author');
      ManyContacts.forEach(contact => {
        that.add({
          givenName: contact.givenName,
          familyName: contact.familyName,
        });
      });
    });

    for (let index = 0; index < CONSECUTIVE_COUNT; index++) {
      search.search('nath fe');
    }
  },
});
