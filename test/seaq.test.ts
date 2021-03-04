import { seaq } from '../src/index';
import Contacts from './data/1_000Contacts.json';
import ManyContacts from './data/10_000Contacts.json';

describe('small collection', () => {
  test('getProperty', () => {
    const searchResults = seaq(Contacts, 'merv pre', [
      'givenName',
      'familyName',
    ]);
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({ givenName: 'Mervin' });
  });

  test('getProperty', () => {
    const searchResults = seaq(Contacts, 'Flicta', ['givenName'], 0.5);
    expect(searchResults).toHaveLength(938);
    expect(searchResults[0]).toMatchObject({ givenName: 'Felicita' });
  });

  test('getProperty', () => {
    const searchResults = seaq(Contacts, 'Felicita', ['givenName']);
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({ givenName: 'Felicita' });
  });

  test('getProperty', () => {
    const searchResults = seaq(Contacts, '', ['givenName', 'familyName']);
    expect(searchResults).toHaveLength(0);
  });

  test('getOtherProperty', () => {
    const searchResults = seaq(Contacts, 'Ruthlfsdot', [
      'emailAddresses.email',
      'phoneNumbers.number',
    ]);
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
  test('getProperty', () => {
    const searchResults = seaq(ManyContacts as any, 'nath fe', [
      'givenName',
      'familyName',
    ]);
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toMatchObject({ givenName: 'Natasha' });
  });

  test('getProperty', () => {
    const searchResults = seaq(
      ManyContacts as any,
      'Natniel',
      ['givenName'],
      0.5,
    );
    expect(searchResults).toHaveLength(9856);
    expect(searchResults[0]).toMatchObject({ givenName: 'Nathaniel' });
  });

  test('getProperty', () => {
    const searchResults = seaq(ManyContacts as any, 'Nathaniel', ['givenName']);
    expect(searchResults).toHaveLength(4);
    expect(searchResults[0]).toMatchObject({ givenName: 'Nathaniel' });
  });

  test('getProperty', () => {
    const searchResults = seaq(ManyContacts as any, '', [
      'givenName',
      'familyName',
    ]);
    expect(searchResults).toHaveLength(0);
  });

  test('getOtherProperty', () => {
    const searchResults = seaq(ManyContacts as any, 'dwi', [
      'emailAddresses.email',
      'phoneNumbers.number',
    ]);
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
  test('no keys', () => {
    const searchResults = seaq(['whatever', 'thing'], 'th');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]).toBe('thing');
  });

  test('acronym bonus', () => {
    const searchResults = seaq(['Hillsdale Michigan', 'historymi'], 'HiMi');
    expect(searchResults).toHaveLength(2);
    expect(searchResults[0]).toBe('Hillsdale Michigan');
  });

  test('acronym bonus fuzzy', () => {
    const searchResults = seaq(
      ['Hillsdale Michigan', 'historymi'],
      'HiMi',
      undefined,
      0.5,
    );
    expect(searchResults).toHaveLength(2);
    expect(searchResults[0]).toBe('Hillsdale Michigan');
  });
});
