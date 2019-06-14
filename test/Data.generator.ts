// Third-party imports
import { name, internet, random, seed, lorem } from 'faker';
import fs from 'fs';

seed(123);
const options = { flag: 'w+', encoding: 'utf-8' };

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
const contactsPath = `${__dirname}/manyContacts.json`;
fs.writeFileSync(contactsPath, contactsData, options);

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
const booksPath = `${__dirname}/manyBooks.json`;
fs.writeFileSync(booksPath, booksData, options);
