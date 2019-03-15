import { seaq } from './../src/Seaq';
import { Contact } from './Contact';

test('getProperty', t => {
  const contacts: Contact[] = require('./contacts.json');
  const searchContacts = seaq(contacts, 'nath ra', ['givenName', 'familyName']);
  // tslint:disable-next-line:no-console
  console.info(searchContacts.map(contact => contact.givenName + ' ' + contact.familyName));
});

test('getProperty', t => {
  const contacts: Contact[] = require('./contacts.json');
  const searchContacts = seaq(contacts, 'dwi', ['emailAddresses.email', 'phoneNumbers.number']);
  // tslint:disable-next-line:no-console
  console.info(searchContacts.map(contact => contact.givenName + ' ' + contact.familyName));
});
