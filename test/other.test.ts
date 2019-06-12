import { seaq } from '../src/Seaq';
import { Contacts } from './Contacts';

test('getProperty', t => {
  const searchContacts = seaq(Contacts, 'nath ra', ['givenName', 'familyName']);
  // tslint:disable-next-line:no-console
  console.info(
    searchContacts.map(contact => contact.givenName + ' ' + contact.familyName)
  );
});

test('getProperty', t => {
  const searchContacts = seaq(Contacts, 'dwi', [
    'emailAddresses.email',
    'phoneNumbers.number',
  ]);
  // tslint:disable-next-line:no-console
  console.info(
    searchContacts.map(contact => contact.givenName + ' ' + contact.familyName)
  );
});
