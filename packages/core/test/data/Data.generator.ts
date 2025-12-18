import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { faker } from '@faker-js/faker';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

faker.seed(123);

function generateContacts(count: number) {
  return Array.from(new Array(count)).map((_, index) => {
    return {
      recordID: index,
      familyName: faker.person.lastName(),
      givenName: faker.person.firstName(),
      middleName: faker.person.firstName(),
      emailAddresses: Array.from(new Array(faker.number.int({ min: 1, max: 4 }))).map(() => {
        return {
          label: faker.word.sample(),
          email: faker.internet.email(),
        };
      }),
      phoneNumbers: Array.from(new Array(faker.number.int({ min: 1, max: 4 }))).map(() => {
        return {
          label: faker.word.sample(),
          number: faker.phone.number(),
        };
      }),
      thumbnailPath: faker.image.avatar(),
    };
  });
}

const contacts = generateContacts(1_000);
const contactsData = JSON.stringify(contacts, null, 2);
const contactsPath = path.join(__dirname, '1_000Contacts.json');
fs.writeFileSync(contactsPath, contactsData, { flag: 'w+', encoding: 'utf-8' });

const many_contacts = generateContacts(10_000);
const many_contactsData = JSON.stringify(many_contacts, null, 2);
const many_contactsPath = path.join(__dirname, '10_000Contacts.json');
fs.writeFileSync(many_contactsPath, many_contactsData, {
  flag: 'w+',
  encoding: 'utf-8',
});

function generateBooks(count: number) {
  return Array.from(new Array(count)).map(() => {
    return {
      title: faker.lorem.sentence(3),
      author: `${faker.person.firstName()} ${faker.person.lastName()}`,
    };
  });
}

const books = generateBooks(10_000);
const booksData = JSON.stringify(books, null, 2);
const booksPath = path.join(__dirname, '10_000Books.json');
fs.writeFileSync(booksPath, booksData, { flag: 'w+', encoding: 'utf-8' });
