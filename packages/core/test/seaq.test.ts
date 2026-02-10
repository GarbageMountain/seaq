import { describe, expect, test } from 'vitest';
import { seaq } from '../src/index';
import Contacts from '@seaq/test-data/contacts-1k.json';
import ManyContacts from '@seaq/test-data/contacts-10k.json';

describe('small collection', () => {
  test('multi-field search', () => {
    const searchResults = seaq(Contacts, 'ray stev', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0 });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({ givenName: 'Raymond' });
  });

  test('fuzzy search', () => {
    const searchResults = seaq(Contacts, 'Juile', { keys: ['givenName'], fuzziness: 0.5, limit: Infinity, threshold: 0 });
    expect(searchResults).toHaveLength(769);
    expect(searchResults[0]).toMatchObject({ givenName: 'Julie' });
  });

  test('exact search', () => {
    const searchResults = seaq(Contacts, 'Leo', { keys: ['givenName'], fuzziness: 0 });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({ givenName: 'Leo' });
  });

  test('empty query', () => {
    const searchResults = seaq(Contacts, '', { keys: ['givenName', 'familyName'] });
    expect(searchResults).toHaveLength(0);
  });

  test('nested property search', () => {
    const searchResults = seaq(Contacts, 'julie_cook', {
      keys: ['emailAddresses.email', 'phoneNumbers.number'],
      fuzziness: 0,
    });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({
      givenName: 'Julie',
      emailAddresses: [
        {
          email: 'julie_cook@yahoo.com',
          label: 'Work',
        },
        {
          email: 'julie.cook47@icloud.com',
          label: 'Home',
        },
        {
          email: 'juliec@mail.com',
          label: 'Work',
        },
      ],
    });
  });
});

describe('large collection', () => {
  test('multi-field search', () => {
    const searchResults = seaq(ManyContacts as any, 'nath ev', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0, limit: Infinity, threshold: 0 });
    expect(searchResults).toHaveLength(4);
    expect(searchResults[0]).toMatchObject({ givenName: 'Nathan' });
  });

  test('fuzzy search', () => {
    const searchResults = seaq(ManyContacts as any, 'Natnah', { keys: ['givenName'], fuzziness: 0.5, limit: Infinity, threshold: 0 });
    expect(searchResults).toHaveLength(8907);
    expect(searchResults[0]).toMatchObject({ givenName: 'Nathan' });
  });

  test('exact search', () => {
    const searchResults = seaq(ManyContacts as any, 'Nathan', { keys: ['givenName'], fuzziness: 0, limit: Infinity, threshold: 0 });
    expect(searchResults).toHaveLength(106);
    expect(searchResults[0]).toMatchObject({ givenName: 'Nathan' });
  });

  test('empty query', () => {
    const searchResults = seaq(ManyContacts as any, '', { keys: ['givenName', 'familyName'] });
    expect(searchResults).toHaveLength(0);
  });

  test('nested property search', () => {
    const searchResults = seaq(ManyContacts as any, 'julie', {
      keys: ['emailAddresses.email', 'phoneNumbers.number'],
      fieldMode: 'joined',
      fuzziness: 0,
      limit: Infinity,
      threshold: 0,
    });
    expect(searchResults).toHaveLength(263);
    expect(searchResults[0]).toMatchObject({ givenName: 'Julie' });
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
    const searchResults = seaq(['Hillsdale Michigan', 'historymi'], 'HiMi', { fuzziness: 0, limit: Infinity, threshold: 0 });
    expect(searchResults).toHaveLength(2);
    expect(searchResults[0]).toBe('Hillsdale Michigan');
  });

  test('acronym bonus with fuzziness', () => {
    const searchResults = seaq(['Hillsdale Michigan', 'historymi'], 'HiMi', { fuzziness: 0.5, limit: Infinity, threshold: 0 });
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
    const allResults = seaq(Contacts, 'leo', { keys: ['givenName', 'familyName'], fuzziness: 0, limit: Infinity, threshold: 0 });
    const limitResults = seaq(Contacts, 'leo', { keys: ['givenName', 'familyName'], fuzziness: 0, limit: 1000, threshold: 0 });
    expect(limitResults.length).toBe(allResults.length);
    expect(limitResults).toEqual(allResults);
  });

  test('returns same top results as slice (with unique scores)', () => {
    // Use a query that produces more distinct scores
    const allResults = seaq(ManyContacts as any, 'nath fe', { keys: ['givenName', 'familyName'], fieldMode: 'joined', fuzziness: 0, limit: Infinity, threshold: 0 });
    const limitResults = seaq(ManyContacts as any, 'nath fe', {
      keys: ['givenName', 'familyName'],
      fieldMode: 'joined',
      fuzziness: 0,
      limit: 1,
      threshold: 0,
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
      limit: Infinity,
      threshold: 0,
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
      threshold: 0,
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

describe('threshold option', () => {
  test('threshold filters low-scoring fuzzy results', () => {
    // With threshold: 0, fuzziness returns tons of results
    const noThreshold = seaq(ManyContacts as any, 'nath', {
      keys: ['givenName'],
      fuzziness: 0.2,
      limit: Infinity,
      threshold: 0,
    });
    // With default threshold (0.3), many low-scoring results are dropped
    const withThreshold = seaq(ManyContacts as any, 'nath', {
      keys: ['givenName'],
      fuzziness: 0.2,
      limit: Infinity,
      threshold: 0.3,
    });
    expect(withThreshold.length).toBeLessThan(noThreshold.length);
    expect(withThreshold.length).toBeGreaterThan(0);
    // Top result should still be a Nathan-like name
    expect((withThreshold[0] as any).givenName.toLowerCase()).toContain('nath');
  });

  test('threshold: 0 returns everything above score 0 (old behavior)', () => {
    const results = seaq(ManyContacts as any, 'nath', {
      keys: ['givenName'],
      fuzziness: 0.2,
      limit: Infinity,
      threshold: 0,
    });
    // Should return the huge count we used to get
    expect(results.length).toBeGreaterThan(1000);
  });

  test('threshold: 1 returns only exact/near-exact matches', () => {
    const results = seaq(['Nathan', 'Nathaniel', 'Jonathan', 'math', 'bath'], 'nath', {
      fuzziness: 0,
      limit: Infinity,
      threshold: 1,
    });
    // Only the best-scoring items survive (score must equal maxScore)
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  test('threshold works with includeMatches', () => {
    const results = seaq(ManyContacts as any, 'nath', {
      keys: ['givenName'],
      fuzziness: 0.2,
      includeMatches: true,
      threshold: 0.3,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(10); // default limit
    for (const r of results) {
      expect(r).toHaveProperty('item');
      expect(r).toHaveProperty('score');
      expect(r).toHaveProperty('matches');
    }
  });
});

describe('fuzzy ranking correctness', () => {
  test('file path with matching subsequence outranks shorter unrelated path', () => {
    // "btn" should rank "Button.tsx" above "tsconfig.json" — the former
    // contains the full b-t-n subsequence in "Button", the latter matches
    // only because fuzziness lets 'b' be skipped.
    const paths = [
      'tsconfig.json',
      'src/components/Button.tsx',
      'package.json',
      'tests/App.test.tsx',
    ];
    const results = seaq(paths, 'btn', { fuzziness: 0.2, limit: Infinity, threshold: 0, includeMatches: true });
    const buttonIdx = results.findIndex((r) => r.item === 'src/components/Button.tsx');
    const tsconfigIdx = results.findIndex((r) => r.item === 'tsconfig.json');
    expect(buttonIdx).not.toBe(-1);
    expect(tsconfigIdx).not.toBe(-1);
    expect(buttonIdx).toBeLessThan(tsconfigIdx);
  });
});

describe('default limit', () => {
  test('default limit is 10', () => {
    const results = seaq(ManyContacts as any, 'a', {
      keys: ['givenName'],
      threshold: 0,
    });
    expect(results).toHaveLength(10);
  });

  test('limit: Infinity with threshold still filters', () => {
    const allResults = seaq(ManyContacts as any, 'nath', {
      keys: ['givenName'],
      fuzziness: 0.2,
      limit: Infinity,
      threshold: 0,
    });
    const filteredResults = seaq(ManyContacts as any, 'nath', {
      keys: ['givenName'],
      fuzziness: 0.2,
      limit: Infinity,
      threshold: 0.3,
    });
    expect(filteredResults.length).toBeLessThan(allResults.length);
    expect(filteredResults.length).toBeGreaterThan(0);
  });
});
