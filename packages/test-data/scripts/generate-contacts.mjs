#!/usr/bin/env node
/**
 * Generates realistic contacts with:
 * - Emails that match the contact's actual name
 * - Real phone numbers (not emails)
 * - Sensible labels (Home, Work, Mobile, etc.)
 *
 * Uses a seeded PRNG for deterministic output.
 *
 * Usage:
 *   node scripts/generate-contacts.mjs               # generates 1000
 *   node scripts/generate-contacts.mjs --count 10000  # generates 10000
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { values } = parseArgs({
  options: { count: { type: 'string', default: '1000' } },
});
const count = Number(values.count);

// ── Seeded PRNG (mulberry32) ──
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));

// ── Name pools ──
const givenNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Steven', 'Ashley',
  'Paul', 'Dorothy', 'Andrew', 'Kimberly', 'Joshua', 'Emily', 'Kenneth', 'Donna',
  'Kevin', 'Michelle', 'Brian', 'Carol', 'George', 'Amanda', 'Timothy', 'Melissa',
  'Ronald', 'Deborah', 'Edward', 'Stephanie', 'Jason', 'Rebecca', 'Jeffrey', 'Sharon',
  'Ryan', 'Laura', 'Jacob', 'Cynthia', 'Gary', 'Kathleen', 'Nicholas', 'Amy',
  'Eric', 'Angela', 'Jonathan', 'Shirley', 'Stephen', 'Anna', 'Larry', 'Brenda',
  'Justin', 'Pamela', 'Scott', 'Emma', 'Brandon', 'Nicole', 'Benjamin', 'Helen',
  'Samuel', 'Samantha', 'Raymond', 'Katherine', 'Gregory', 'Christine', 'Frank', 'Debra',
  'Alexander', 'Rachel', 'Patrick', 'Carolyn', 'Jack', 'Janet', 'Dennis', 'Catherine',
  'Nathan', 'Maria', 'Adam', 'Heather', 'Henry', 'Diane', 'Peter', 'Ruth',
  'Zachary', 'Julie', 'Douglas', 'Olivia', 'Aaron', 'Joyce', 'Jose', 'Virginia',
  'Tyler', 'Victoria', 'Dylan', 'Kelly', 'Logan', 'Lauren', 'Ethan', 'Christina',
  'Noah', 'Joan', 'Liam', 'Evelyn', 'Mason', 'Judith', 'Lucas', 'Megan',
  'Owen', 'Andrea', 'Caleb', 'Cheryl', 'Isaiah', 'Hannah', 'Adrian', 'Jacqueline',
  'Elijah', 'Martha', 'Connor', 'Gloria', 'Cameron', 'Teresa', 'Ann',
  'Gabriel', 'Sara', 'Madison', 'Frances', 'Kathryn',
  'Cole', 'Ian', 'Jordan', 'Max', 'Nolan', 'Blake', 'Chase',
  'Grant', 'Carter', 'Miles', 'Leo', 'Wyatt', 'Eli', 'Finn', 'Jude',
  'Oscar', 'Hugo', 'Milo', 'Felix', 'Axel', 'Silas', 'Reid', 'Troy',
  'Seth', 'Brock', 'Dante', 'Quinn',
];

const familyNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell',
  'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz',
  'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales',
  'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson',
  'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward',
  'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray',
  'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel',
  'Myers', 'Long', 'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry',
  'Russell', 'Sullivan', 'Bell', 'Coleman', 'Butler', 'Henderson', 'Barnes', 'Gonzales',
  'Fisher', 'Vasquez', 'Simmons', 'Griffin', 'Marshall', 'Owens', 'Harrison', 'Hart',
  'Stevens', 'Fox', 'Walsh', 'Burke', 'Dunn', 'Holland', 'Abbott', 'Brennan',
  'Mcdonald', 'Lamb', 'Chen', 'Wong', 'Singh', 'Yamamoto', 'Tanaka', 'Nakamura',
  'Schneider', 'Weber', 'Fischer', 'Becker', 'Hoffman', 'Wagner', 'Schultz', 'Meyer',
];

const middleNames = [
  'Alexander', 'Grace', 'Michael', 'Rose', 'James', 'Marie', 'William', 'Anne',
  'Thomas', 'Elizabeth', 'Joseph', 'Lynn', 'Robert', 'Mae', 'David', 'Jane',
  'Edward', 'Louise', 'Charles', 'Nicole', 'Daniel', 'Renee', 'Patrick', 'Claire',
  'Henry', 'Faith', 'George', 'Hope', 'Francis', 'Irene', 'Ray', 'Dawn',
  'Lee', 'Joy', 'Wayne', 'Leigh', 'Dean', 'Kay', 'Earl', 'Faye',
  'Scott', 'Jean', 'Glenn', 'Ruth', 'Blake', 'Paige', 'Cole', 'Brooke',
  'Grant', 'Jade', 'Lane', 'Sage', 'Reese', 'Skye', 'Drew', 'Quinn',
  'Beau', 'True', 'Neil', 'Wren',
];

const emailDomains = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'protonmail.com', 'aol.com', 'mail.com',
];

const emailLabels = ['Home', 'Work', 'Personal', 'Other'];
const phoneLabels = ['Mobile', 'Home', 'Work', 'Other'];

// ── Email generation from actual name ──
function generateEmail(given, family) {
  const g = given.toLowerCase();
  const f = family.toLowerCase();
  const domain = pick(emailDomains);
  const style = randInt(0, 5);
  switch (style) {
    case 0: return `${g}.${f}@${domain}`;
    case 1: return `${g}${f}@${domain}`;
    case 2: return `${g[0]}${f}@${domain}`;
    case 3: return `${g}_${f}@${domain}`;
    case 4: return `${g}${f[0]}@${domain}`;
    case 5: return `${g}.${f}${randInt(1, 99)}@${domain}`;
    default: return `${g}.${f}@${domain}`;
  }
}

// ── Phone number generation (US format) ──
function generatePhone() {
  const area = randInt(200, 999);
  const pre = randInt(200, 999);
  const line = randInt(1000, 9999);
  return `(${area}) ${pre}-${line}`;
}

// ── Generate contacts ──
const contacts = [];
const usedEmails = new Set();

for (let i = 0; i < count; i++) {
  const givenName = pick(givenNames);
  const familyName = pick(familyNames);
  const middleName = pick(middleNames);

  // Generate 1-3 email addresses
  const numEmails = randInt(1, 3);
  const emailAddresses = [];
  for (let j = 0; j < numEmails; j++) {
    let email = generateEmail(givenName, familyName);
    // Ensure uniqueness
    while (usedEmails.has(email)) {
      email = generateEmail(givenName, familyName) + randInt(1, 999);
      // Reattach domain if we accidentally broke it
      if (!email.includes('@')) email = `${givenName.toLowerCase()}${randInt(1, 9999)}@${pick(emailDomains)}`;
    }
    usedEmails.add(email);
    emailAddresses.push({
      label: pick(emailLabels),
      email,
    });
  }

  // Generate 1-2 phone numbers
  const numPhones = randInt(1, 2);
  const phoneNumbers = [];
  for (let j = 0; j < numPhones; j++) {
    phoneNumbers.push({
      label: pick(phoneLabels),
      number: generatePhone(),
    });
  }

  contacts.push({
    recordID: i,
    givenName,
    familyName,
    middleName,
    emailAddresses,
    phoneNumbers,
  });
}

const suffix = count >= 1000 ? `${Math.round(count / 1000)}k` : String(count);
const outPath = resolve(__dirname, `../data/contacts-${suffix}.json`);
writeFileSync(outPath, JSON.stringify(contacts, null, 2) + '\n');
console.log(`Generated ${contacts.length} contacts -> ${outPath}`);

// Quick stats
const emailCount = contacts.reduce((sum, c) => sum + c.emailAddresses.length, 0);
const phoneCount = contacts.reduce((sum, c) => sum + c.phoneNumbers.length, 0);
console.log(`  Emails: ${emailCount} total (${(emailCount / count).toFixed(1)} avg/contact)`);
console.log(`  Phones: ${phoneCount} total (${(phoneCount / count).toFixed(1)} avg/contact)`);
console.log(`  Unique given names used: ${new Set(contacts.map(c => c.givenName)).size}`);
console.log(`  Unique family names used: ${new Set(contacts.map(c => c.familyName)).size}`);

// Verify emails match names
const sample = contacts.slice(0, 3);
console.log('\nSample contacts:');
for (const c of sample) {
  console.log(`  ${c.givenName} ${c.middleName} ${c.familyName}`);
  for (const e of c.emailAddresses) console.log(`    [${e.label}] ${e.email}`);
  for (const p of c.phoneNumbers) console.log(`    [${p.label}] ${p.number}`);
}
