// Third-party imports
import { name, internet, random, seed, lorem } from 'faker';
import fs from 'fs';

seed(123);

function generateContacts(count: number) {
  return Array.from(new Array(count)).map((_, index) => {
    return {
      recordID: index,
      familyName: name.lastName(),
      givenName: name.firstName(),
      middleName: name.firstName(),
      emailAddresses: Array.from(
        new Array(random.number({ min: 1, max: 4 })),
      ).map(() => {
        return {
          label: random.word(),
          email: internet.email(),
        };
      }),
      phoneNumbers: Array.from(
        new Array(random.number({ min: 1, max: 4 })),
      ).map(() => {
        return {
          label: random.word(),
          email: internet.email(),
        };
      }),
      thumbnailPath: internet.avatar(),
    };
  });
}

const contacts = generateContacts(1_000);
const contactsData = JSON.stringify(contacts, null, 2);
const contactsPath = `${__dirname}/1_000Contacts.json`;
fs.writeFileSync(contactsPath, contactsData, { flag: 'w+', encoding: 'utf-8' });

const many_contacts = generateContacts(10_000);
const many_contactsData = JSON.stringify(many_contacts, null, 2);
const many_contactsPath = `${__dirname}/10_000Contacts.json`;
fs.writeFileSync(many_contactsPath, many_contactsData, {
  flag: 'w+',
  encoding: 'utf-8',
});

function generateBooks(count: number) {
  return Array.from(new Array(count)).map(() => {
    return {
      title: lorem.sentence(3),
      author: `${name.firstName()} ${name.lastName()}`,
    };
  });
}

const books = generateBooks(10_000);
const booksData = JSON.stringify(books, null, 2);
const booksPath = `${__dirname}/10_000Books.json`;
fs.writeFileSync(booksPath, booksData, { flag: 'w+', encoding: 'utf-8' });
