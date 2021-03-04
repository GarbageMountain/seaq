import { seaq } from '../dist';
import Fuse from 'fuse.js';

import Books from './data/fuseBooks.json';
import Contacts from './data/1_000Contacts.json';
import ManyBooks from './data/10_000Books.json';
import ManyContacts from './data/10_000Contacts.json';

type Contacts = typeof Contacts;

describe('compare with fusejs', () => {
  it('fuses', () => {
    const start = performance.now();
    const fuse = new Fuse(Books, {
      keys: ['title', 'author.firstName'],
    });
    const fuseResults = fuse.search('hi');
    console.log(performance.now() - start);
    expect(fuseResults.length).toBe(18);
  });
  it('seaqs', () => {
    const start = performance.now();
    const seaqResults = seaq(Books, 'hi', ['title', 'author.firstName']);
    console.log(performance.now() - start);
    expect(seaqResults.length).toBe(9);
  });

  it('fuses big', () => {
    let start = performance.now();
    const fuse = new Fuse(ManyBooks, {
      keys: ['title', 'author'],
    });
    const fuseResults = fuse.search('cons con');
    console.log(performance.now() - start);
    expect(fuseResults.length).toBe(1474);
    expect(fuseResults[0].item.title).toBe('Consectetur reiciendis voluptas.');
    expect(fuseResults[0].item.author).toBe('Christop Conroy');
    start = performance.now();
    const fuseResults2 = fuse.search('cons con');
    console.log(performance.now() - start);
    expect(fuseResults2[0].item.author).toBe('Christop Conroy');
  });

  it('seaqs big', () => {
    let start = performance.now();
    const seaqResults = seaq(ManyBooks, 'cons con', ['title', 'author']);
    console.log(performance.now() - start);
    expect(seaqResults.length).toBe(81);
    expect(seaqResults[0].title).toBe('Consectetur corporis nobis.');
    expect(seaqResults[0].author).toBe('Odie Cronin');
    start = performance.now();
    const seaqResults2 = seaq(ManyBooks, 'cons con', ['title', 'author']);
    console.log(performance.now() - start);
    expect(seaqResults2[0].author).toBe('Odie Cronin');
  });

  it('fuses biggest', () => {
    let start = performance.now();
    const fuse = new Fuse(ManyContacts as Contacts, {
      keys: ['givenName', 'familyName'],
    });
    const fuseResults = fuse.search('nath fe');
    console.log(performance.now() - start);
    expect(fuseResults.length).toBe(798);
    expect(fuseResults[0].item.givenName).toBe('Catherine');
    expect(fuseResults[0].item.familyName).toBe('Nader');
    start = performance.now();
    const fuseResults2 = fuse.search('nath fe');
    console.log(performance.now() - start);
    expect(fuseResults2[0].item.givenName).toBe('Catherine');
  });

  it('seaqs biggest', () => {
    let start = performance.now();
    const seaqResults = seaq(ManyContacts as Contacts, 'nath fe', [
      'givenName',
      'familyName',
    ]);
    console.log(performance.now() - start);
    expect(seaqResults.length).toBe(1);
    expect(seaqResults[0].givenName).toBe('Natasha');
    expect(seaqResults[0].familyName).toBe("O'Keefe");
    start = performance.now();
    const seaqResults2 = seaq(ManyContacts as Contacts, 'nath fe', [
      'givenName',
      'familyName',
    ]);
    console.log(performance.now() - start);
    expect(seaqResults2[0].givenName).toBe('Natasha');
  });
});
