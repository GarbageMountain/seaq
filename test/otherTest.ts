import test from 'ava';
import { Contact } from './Contact';
import { seaq } from './../src/Seaq';

test('getProperty', t => {
  const contacts: Contact[] = require('./contacts.json');
  const searchContacts = seaq(contacts, 'nath ra', ['givenName', 'familyName']);
  console.log(searchContacts.map(contact => contact.givenName + ' ' + contact.familyName));
});

test('getProperty', t => {
  const contacts: Contact[] = require('./contacts.json');
  const searchContacts = seaq(contacts, 'dwi', ['emailAddresses.email']);
  console.log(searchContacts.map(contact => contact.givenName + ' ' + contact.familyName));
});
