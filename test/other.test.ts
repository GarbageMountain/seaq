import { seaq } from '../src/Seaq';
import { Contacts } from './Contacts';

test('getProperty', () => {
  const searchContacts = seaq(Contacts, 'nath ra', ['givenName', 'familyName']);
  console.info(
    searchContacts.map(
      (contact) => contact.givenName + ' ' + contact.familyName,
    ),
  );
});

test('getOtherProperty', () => {
  const searchContacts = seaq(Contacts, 'dwi', [
    'emailAddresses.email',
    'phoneNumbers.number',
  ]);
  console.info(
    searchContacts.map(
      (contact) => contact.givenName + ' ' + contact.familyName,
    ),
  );
});
