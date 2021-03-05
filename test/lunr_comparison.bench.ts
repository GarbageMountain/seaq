import { benchmarkSuite } from 'jest-bench';
import { seaq } from '../dist';
import Lunr from 'lunr';

import Books from './data/fuseBooks.json';
import ManyBooks from './data/10_000Books.json';
import ManyContacts from './data/10_000Contacts.json';

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

benchmarkSuite('seaq - single search', {
  '23-books': () => {
    seaq(Books, 'hi', ['title', 'author.firstName']);
  },
  '10,000-books': () => {
    seaq(ManyBooks, 'cons con', ['title', 'author']);
  },
  '10,000-contacts': () => {
    seaq(ManyContacts as any, 'nath fe', ['givenName', 'familyName']);
  },
});

benchmarkSuite('lunr - two consecutive searches', {
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
    search.search('nath fe');
  },
});

benchmarkSuite('seaq - two consecutive searches', {
  '23-books': () => {
    seaq(Books, 'hi', ['title', 'author.firstName']);
    seaq(Books, 'hi', ['title', 'author.firstName']);
  },
  '10,000-books': () => {
    seaq(ManyBooks, 'cons con', ['title', 'author']);
    seaq(ManyBooks, 'cons con', ['title', 'author']);
  },
  '10,000-contacts': () => {
    seaq(ManyContacts as any, 'nath fe', ['givenName', 'familyName']);
    seaq(ManyContacts as any, 'nath fe', ['givenName', 'familyName']);
  },
});
