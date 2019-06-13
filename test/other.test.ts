import { seaq } from '../src';
import { Contacts } from './Contacts';

test('getProperty', () => {
  const searchResults = seaq(Contacts, 'nath ra', ['givenName', 'familyName']);
  expect(searchResults).toHaveLength(1);
  expect(searchResults[0]).toMatchObject({ givenName: 'Nathaniel' });
});

test('getProperty', () => {
  const searchResults = seaq(Contacts, 'Natniel', ['givenName'], 0.5);
  expect(searchResults).toHaveLength(99);
  expect(searchResults[0]).toMatchObject({ givenName: 'Nathaniel' });
});

test('getProperty', () => {
  const searchResults = seaq(Contacts, 'Nathaniel', ['givenName']);
  expect(searchResults).toHaveLength(1);
  expect(searchResults[0]).toMatchObject({ givenName: 'Nathaniel' });
});

test('getProperty', () => {
  const searchResults = seaq(Contacts, '', ['givenName', 'familyName']);
  expect(searchResults).toHaveLength(0);
});

test('getOtherProperty', () => {
  const searchResults = seaq(Contacts, 'dwi', [
    'emailAddresses.email',
    'phoneNumbers.number',
  ]);
  expect(searchResults).toHaveLength(2);
  expect(searchResults[0]).toMatchObject({
    givenName: 'Caitlyn',
    emailAddresses: [
      {
        email: 'Dwight_Walker9@gmail.com',
        label: 'home',
      },
    ],
  });
});
