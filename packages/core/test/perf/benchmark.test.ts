import Fuse from 'fuse.js';
import { describe, expect, it } from 'vitest';
import { seaq } from '../../src/index';
import { data } from './common';

const { Books, ManyContacts } = data;

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
    const seaqResults = seaq(Books, 'hi', { keys: ['title', 'author.firstName'], fieldMode: 'joined', fuzziness: 0, limit: Infinity, threshold: 0 });
    console.log(performance.now() - start);
    expect(seaqResults.length).toBe(9);
  });

  it('fuses big', () => {
    let start = performance.now();
    const fuse = new Fuse(ManyContacts, {
      keys: ['givenName', 'familyName'],
    });
    const fuseResults = fuse.search('nath fe');
    console.log(performance.now() - start);
    expect(fuseResults.length).toBeGreaterThan(0);
    start = performance.now();
    const fuseResults2 = fuse.search('nath fe');
    console.log(performance.now() - start);
    expect(fuseResults2.length).toBe(fuseResults.length);
  });

  it('seaqs big', () => {
    let start = performance.now();
    const seaqResults = seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0, limit: Infinity, threshold: 0 });
    console.log(performance.now() - start);
    expect(seaqResults.length).toBeGreaterThan(0);
    expect(seaqResults[0].givenName).toBeDefined();
    start = performance.now();
    const seaqResults2 = seaq(ManyContacts, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0, limit: Infinity, threshold: 0 });
    console.log(performance.now() - start);
    expect(seaqResults2[0]).toEqual(seaqResults[0]);
  });
});
