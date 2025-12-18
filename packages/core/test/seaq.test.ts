import { describe, expect, test } from 'vitest';
import { seaq } from '../src/index';
import Contacts from './data/1_000Contacts.json';
import ManyContacts from './data/10_000Contacts.json';

describe('small collection', () => {
  test('multi-field search', () => {
    const searchResults = seaq(Contacts, 'merv pre', { keys: ['givenName', 'familyName'] });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({ givenName: 'Mervin' });
  });

  test('fuzzy search', () => {
    const searchResults = seaq(Contacts, 'Flicta', { keys: ['givenName'], fuzziness: 0.5 });
    expect(searchResults).toHaveLength(938);
    expect(searchResults[0]).toMatchObject({ givenName: 'Felicita' });
  });

  test('exact search', () => {
    const searchResults = seaq(Contacts, 'Felicita', { keys: ['givenName'] });
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
    const searchResults = seaq(ManyContacts as any, 'nath fe', { keys: ['givenName', 'familyName'] });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({ givenName: 'Natasha' });
  });

  test('fuzzy search', () => {
    const searchResults = seaq(ManyContacts as any, 'Natniel', { keys: ['givenName'], fuzziness: 0.5 });
    expect(searchResults).toHaveLength(9856);
    expect(searchResults[0]).toMatchObject({ givenName: 'Nathaniel' });
  });

  test('exact search', () => {
    const searchResults = seaq(ManyContacts as any, 'Nathaniel', { keys: ['givenName'] });
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
    const searchResults = seaq(['whatever', 'thing'], 'th');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toBe('thing');
  });

  test('acronym bonus', () => {
    const searchResults = seaq(['Hillsdale Michigan', 'historymi'], 'HiMi');
    expect(searchResults).toHaveLength(2);
    expect(searchResults[0]).toBe('Hillsdale Michigan');
  });

  test('acronym bonus with fuzziness', () => {
    const searchResults = seaq(['Hillsdale Michigan', 'historymi'], 'HiMi', { fuzziness: 0.5 });
    expect(searchResults).toHaveLength(2);
    expect(searchResults[0]).toBe('Hillsdale Michigan');
  });
});

describe('fieldMode option', () => {
  const contacts = [
    { firstName: 'John', lastName: 'Smith' },
    { firstName: 'Jane', lastName: 'Doe' },
    { firstName: 'Johnny', lastName: 'Appleseed' },
  ];

  test('joined mode (default) - matches across fields', () => {
    const results = seaq(contacts, 'john smith', { keys: ['firstName', 'lastName'] });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ firstName: 'John', lastName: 'Smith' });
  });

  test('separate mode - only matches within single field', () => {
    const results = seaq(contacts, 'john smith', {
      keys: ['firstName', 'lastName'],
      fieldMode: 'separate',
    });
    // "john smith" won't fully match any single field
    expect(results).toHaveLength(0);
  });

  test('separate mode - single word matches', () => {
    const results = seaq(contacts, 'john', {
      keys: ['firstName', 'lastName'],
      fieldMode: 'separate',
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({ firstName: 'John' });
  });
});
