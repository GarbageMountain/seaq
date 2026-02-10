import { describe, expect, test } from 'vitest';
import { seaq } from '../src/index';
import Contacts from './data/1_000Contacts.json';
import ManyContacts from './data/10_000Contacts.json';

describe('small collection', () => {
  test('multi-field search', () => {
    const searchResults = seaq(Contacts, 'merv pre', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0 });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({ givenName: 'Mervin' });
  });

  test('fuzzy search', () => {
    const searchResults = seaq(Contacts, 'Flicta', { keys: ['givenName'], fuzziness: 0.5 });
    expect(searchResults).toHaveLength(938);
    expect(searchResults[0]).toMatchObject({ givenName: 'Felicita' });
  });

  test('exact search', () => {
    const searchResults = seaq(Contacts, 'Felicita', { keys: ['givenName'], fuzziness: 0 });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({ givenName: 'Felicita' });
  });

  test('empty query', () => {
    const searchResults = seaq(Contacts, '', { keys: ['givenName', 'familyName'] });
    expect(searchResults).toHaveLength(0);
  });

  test('nested property search', () => {
    const searchResults = seaq(Contacts, 'Ruthlfsdot', {
      keys: ['emailAddresses.email', 'phoneNumbers.number'],
      fuzziness: 0,
    });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({
      givenName: 'Felicita',
      emailAddresses: [
        {
          email: 'Ruthie.Runolfsdottir@gmail.com',
          label: 'systems',
        },
        {
          email: 'David49@yahoo.com',
          label: 'District',
        },
      ],
    });
  });
});

describe('large collection', () => {
  test('multi-field search', () => {
    const searchResults = seaq(ManyContacts as any, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0 });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({ givenName: 'Natasha' });
  });

  test('fuzzy search', () => {
    const searchResults = seaq(ManyContacts as any, 'Natniel', { keys: ['givenName'], fuzziness: 0.5 });
    expect(searchResults).toHaveLength(9856);
    expect(searchResults[0]).toMatchObject({ givenName: 'Nathaniel' });
  });

  test('exact search', () => {
    const searchResults = seaq(ManyContacts as any, 'Nathaniel', { keys: ['givenName'], fuzziness: 0 });
    expect(searchResults).toHaveLength(4);
    expect(searchResults[0]).toMatchObject({ givenName: 'Nathaniel' });
  });

  test('empty query', () => {
    const searchResults = seaq(ManyContacts as any, '', { keys: ['givenName', 'familyName'] });
    expect(searchResults).toHaveLength(0);
  });

  test('nested property search', () => {
    const searchResults = seaq(ManyContacts as any, 'dwi', {
      keys: ['emailAddresses.email', 'phoneNumbers.number'],
      fieldMode: 'joined',
      fuzziness: 0,
    });
    expect(searchResults).toHaveLength(1060);
    expect(searchResults[0]).toMatchObject({
      givenName: 'Kim',
      emailAddresses: [
        {
          email: 'Dwight32@hotmail.com',
          label: 'Buckinghamshire',
        },
      ],
    });
  });
});

describe('extra features', () => {
  test('no keys - string array', () => {
    const searchResults = seaq(['whatever', 'thing'], 'th', { fuzziness: 0 });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toBe('thing');
  });

  test('no keys - number array', () => {
    const searchResults = seaq([123, 456, 789], '45', { fuzziness: 0 });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toBe(456);
  });

  test('no keys - object array (JSON stringified)', () => {
    const items = [{ x: 'hello' }, { x: 'world' }];
    const searchResults = seaq(items, 'hello', { fuzziness: 0 });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toEqual({ x: 'hello' });
  });

  test('no keys - empty list', () => {
    const searchResults = seaq([], 'test');
    expect(searchResults).toHaveLength(0);
  });

  test('acronym bonus', () => {
    const searchResults = seaq(['Hillsdale Michigan', 'historymi'], 'HiMi', { fuzziness: 0 });
    expect(searchResults).toHaveLength(2);
    expect(searchResults[0]).toBe('Hillsdale Michigan');
  });

  test('acronym bonus with fuzziness', () => {
    const searchResults = seaq(['Hillsdale Michigan', 'historymi'], 'HiMi', { fuzziness: 0.5 });
    expect(searchResults).toHaveLength(2);
    expect(searchResults[0]).toBe('Hillsdale Michigan');
  });

  test('does not mutate the input array', () => {
    const original = ['banana', 'apple', 'cherry'];
    const copy = [...original];
    seaq(original, 'a');
    expect(original).toEqual(copy);
  });
});

describe('limit option', () => {
  test('returns only top N results', () => {
    const results = seaq(ManyContacts as any, 'na', {
      keys: ['givenName', 'familyName'],
      limit: 10,
    });
    expect(results).toHaveLength(10);
  });

  test('returns all results sorted when limit exceeds matches', () => {
    // Use a query that matches multiple items but fewer than the limit,
    // exercising the "items.length <= n" sort path in getTopN
    const allResults = seaq(Contacts, 'merv', { keys: ['givenName', 'familyName'], fuzziness: 0 });
    const limitResults = seaq(Contacts, 'merv', { keys: ['givenName', 'familyName'], fuzziness: 0, limit: 1000 });
    expect(limitResults.length).toBe(allResults.length);
    expect(limitResults).toEqual(allResults);
  });

  test('returns same top results as slice (with unique scores)', () => {
    // Use a query that produces more distinct scores
    const allResults = seaq(ManyContacts as any, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0 });
    const limitResults = seaq(ManyContacts as any, 'nath fe', {
      keys: ['givenName', 'familyName'],
      fieldMode: 'joined',
      fuzziness: 0,
      limit: 1,
    });
    // The top result should be the same
    expect(limitResults[0]).toEqual(allResults[0]);
  });
});

describe('fieldMode option', () => {
  const contacts = [
    { firstName: 'John', lastName: 'Smith' },
    { firstName: 'Jane', lastName: 'Doe' },
    { firstName: 'Johnny', lastName: 'Appleseed' },
  ];

  test('joined mode - matches across fields', () => {
    const results = seaq(contacts, 'john smith', { keys: ['firstName', 'lastName'], fieldMode: 'joined', fuzziness: 0 });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ firstName: 'John', lastName: 'Smith' });
  });

  test('separate mode (default) - only matches within single field', () => {
    const results = seaq(contacts, 'john smith', {
      keys: ['firstName', 'lastName'],
      fuzziness: 0,
    });
    // "john smith" won't fully match any single field
    expect(results).toHaveLength(0);
  });

  test('separate mode - single word matches', () => {
    const results = seaq(contacts, 'john', {
      keys: ['firstName', 'lastName'],
      fuzziness: 0,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({ firstName: 'John' });
  });
});

describe('includeMatches', () => {
  test('string array — returns SeaqResult with indices', () => {
    const results = seaq(['hello', 'world'], 'hel', { includeMatches: true, fuzziness: 0 });
    expect(results).toHaveLength(1);
    expect(results[0].item).toBe('hello');
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].matches).toHaveLength(1);
    expect(results[0].matches[0].value).toBe('hello');
    expect(results[0].matches[0].key).toBeUndefined();
    expect(results[0].matches[0].indices).toEqual([[0, 2]]);
  });

  test('object with keys — joined mode', () => {
    const contacts = [{ firstName: 'John', lastName: 'Smith' }];
    const results = seaq(contacts, 'john', {
      keys: ['firstName', 'lastName'],
      fieldMode: 'joined',
      includeMatches: true,
      fuzziness: 0,
    });
    expect(results).toHaveLength(1);
    expect(results[0].item).toEqual({ firstName: 'John', lastName: 'Smith' });
    expect(results[0].matches).toHaveLength(1);
    // Joined mode: value is the concatenated string
    expect(results[0].matches[0].value).toBe('John Smith');
    expect(results[0].matches[0].key).toBeUndefined();
  });

  test('object with keys — separate mode includes key', () => {
    const contacts = [{ givenName: 'Nathan', familyName: 'Fern' }];
    const results = seaq(contacts, 'nath', {
      keys: ['givenName', 'familyName'],
      fieldMode: 'separate',
      includeMatches: true,
      fuzziness: 0,
    });
    expect(results).toHaveLength(1);
    expect(results[0].matches).toHaveLength(1);
    expect(results[0].matches[0].key).toBe('givenName');
    expect(results[0].matches[0].value).toBe('Nathan');
    expect(results[0].matches[0].indices).toEqual([[0, 3]]);
  });

  test('fuzzy mode — positions collected for matched chars', () => {
    const results = seaq(['Felicita'], 'Flicta', { fuzziness: 0.5, includeMatches: true });
    expect(results).toHaveLength(1);
    const match = results[0].matches[0];
    // Each range covers matched characters; verify they map to query chars
    const highlighted = match.indices.flatMap(([s, e]) => match.value.slice(s, e + 1).split(''));
    // All matched characters should be present (case-insensitive)
    expect(highlighted.join('').toLowerCase()).toContain('f');
    expect(highlighted.join('').toLowerCase()).toContain('l');
  });

  test('indices correctness — slicing value at ranges yields query chars', () => {
    const results = seaq(['banana'], 'ban', { includeMatches: true, fuzziness: 0 });
    expect(results).toHaveLength(1);
    const match = results[0].matches[0];
    const sliced = match.indices.map(([s, e]) => match.value.slice(s, e + 1)).join('');
    expect(sliced.toLowerCase()).toBe('ban');
  });

  test('backward compat — without includeMatches returns T[]', () => {
    const results = seaq(['hello', 'world'], 'hel', { fuzziness: 0 });
    expect(results).toHaveLength(1);
    expect(results[0]).toBe('hello');
    // No extra properties on the result
    expect(typeof results[0]).toBe('string');
  });

  test('limit + includeMatches — works together', () => {
    const results = seaq(ManyContacts as any, 'na', {
      keys: ['givenName', 'familyName'],
      includeMatches: true,
      limit: 5,
    });
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r).toHaveProperty('item');
      expect(r).toHaveProperty('score');
      expect(r).toHaveProperty('matches');
    }
  });

  test('empty query — returns []', () => {
    const results = seaq(['hello'], '', { includeMatches: true });
    expect(results).toHaveLength(0);
  });

  test('no matches — non-matching items excluded', () => {
    const results = seaq(['hello', 'world'], 'xyz', { includeMatches: true });
    expect(results).toHaveLength(0);
  });

  test('number array', () => {
    const results = seaq([123, 456], '45', { includeMatches: true, fuzziness: 0 });
    expect(results).toHaveLength(1);
    expect(results[0].item).toBe(456);
    expect(results[0].matches[0].value).toBe('456');
    expect(results[0].matches[0].indices).toEqual([[0, 1]]);
  });

  test('object array without keys (JSON stringified)', () => {
    const items = [{ x: 'hello' }, { x: 'world' }];
    const results = seaq(items, 'hello', { includeMatches: true, fuzziness: 0 });
    expect(results).toHaveLength(1);
    expect(results[0].item).toEqual({ x: 'hello' });
    expect(results[0].matches[0].value).toBe(JSON.stringify({ x: 'hello' }));
    expect(results[0].matches[0].indices.length).toBeGreaterThan(0);
  });
});
