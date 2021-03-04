import { benchmarkSuite } from 'jest-bench';
import { seaq } from '../dist';
import Fuse from 'fuse.js';

import Books from './data/fuseBooks.json';
import ManyBooks from './data/10_000Books.json';
import ManyContacts from './data/10_000Contacts.json';

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
    const fuse = new Fuse(ManyContacts as any, {
      keys: ['givenName', 'familyName'],
    });
    fuse.search('nath fe');
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

benchmarkSuite('fuse - two consecutive searches', {
  '23-books': () => {
    const fuse = new Fuse(Books, {
      keys: ['title', 'author.firstName'],
    });
    fuse.search('hi');
    fuse.search('hi');
  },
  '10,000-books': () => {
    const fuse = new Fuse(ManyBooks, {
      keys: ['title', 'author'],
    });
    fuse.search('cons con');
    fuse.search('cons con');
  },
  '10,000-contacts': () => {
    const fuse = new Fuse(ManyContacts as any, {
      keys: ['givenName', 'familyName'],
    });
    fuse.search('nath fe');
    fuse.search('nath fe');
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
