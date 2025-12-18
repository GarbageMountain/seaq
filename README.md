# Seaq - Lightweight ES6 fuzzy text search

Seaq is a fast, zero-dependency fuzzy string search library. No index required - just pass your data and search.

Built in TypeScript using the [string_score](https://github.com/joshaven/string_score) algorithm with added support for nested objects, array traversal, and acronym matching.

## Install

```bash
npm install seaq
```

## Basic Usage

```typescript
import { seaq } from 'seaq';

// Search an array of objects
const contacts = [
  { name: 'John Smith', email: 'john@example.com' },
  { name: 'Jane Doe', email: 'jane@test.com' },
];
const results = seaq(contacts, 'jo', ['name', 'email']);
// => [{ name: 'John Smith', ... }]

// Search nested properties
const users = [
  { name: 'Alice', address: { city: 'New York' } },
  { name: 'Bob', address: { city: 'Los Angeles' } },
];
const results = seaq(users, 'new york', ['address.city']);

// Search arrays within objects
const people = [
  { name: 'Charlie', emails: [{ address: 'charlie@work.com' }, { address: 'charlie@home.com' }] },
];
const results = seaq(people, 'work.com', ['emails.address']);

// Simple string array
const fruits = ['apple', 'banana', 'orange'];
const results = seaq(fruits, 'app');
// => ['apple']
```

## API

```typescript
function seaq<T>(
  list: T[],           // Array of objects or strings to search
  query: string,       // Search query
  keys?: string[],     // Object keys to search (supports dot notation)
  fuzziness?: number,  // Optional: 0-1, higher = more tolerant of typos
): T[];
```

## Features

### Acronym Matching

Seaq gives bonus score to acronym matches - great for searching names:

```typescript
seaq(['Hillsdale Michigan', 'Historical Museum'], 'HiMi');
// => ['Hillsdale Michigan', 'Historical Museum']  (Hillsdale ranked first!)
```

### Nested Object & Array Access

Use dot notation to search deep into objects:

```typescript
// Nested objects
seaq(users, 'new york', ['address.city']);

// Arrays of objects
seaq(contacts, 'gmail', ['emails.address']);  // searches all emails
```

### Optional Fuzziness

By default, seaq requires all characters to match in sequence. Enable fuzziness to tolerate typos:

```typescript
// Strict (default) - "jonh" won't match "John"
seaq(contacts, 'jonh', ['name']);

// Fuzzy - "jonh" matches "John"
seaq(contacts, 'jonh', ['name'], 0.5);
```

## Comparison with Other Libraries

### Feature Support

| Feature | seaq | fuse.js | minisearch | ufuzzy | lunr |
|---------|:----:|:-------:|:----------:|:------:|:----:|
| Exact match | ✓ | ✓ | ✓ | ✓ | ✓ |
| Fuzzy/typo tolerance | ✓ | ✓ | ~ | ✓ | ~ |
| Partial/prefix match | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Acronym bonus** | **✓** | ~ | ✗ | ✗ | ✗ |
| **Nested object access** | **✓** | ✓ | ✗ | ✗ | ✗ |
| **Array field traversal** | **✓** | ~ | ✗ | ✗ | ✗ |
| Pre-built index | ✗ | ✓ | ✓ | ✗ | ✓ |
| Zero dependencies | ✓ | ✓ | ✓ | ✓ | ✓ |

### Performance (10K contacts)

**Cold start** (no pre-built index):
| Library | ops/sec |
|---------|---------|
| uFuzzy | 1,113 |
| **seaq** | **399** |
| MiniSearch | 65 |
| Fuse.js | 34 |
| Lunr | 10 |

**Search only** (index pre-built):
| Library | ops/sec |
|---------|---------|
| MiniSearch | 645,061 |
| Lunr | 470,558 |
| uFuzzy | 5,236 |
| **seaq** | **369** |
| Fuse.js | 39 |

### When to Use Seaq

**Use seaq when:**
- You need to search nested objects or arrays
- Acronym matching matters (e.g., "NYC" → "New York City")
- Your dataset is small-medium (<10K items) or changes frequently
- You want zero setup - no index to build or maintain
- Cold-start performance matters (user searches immediately)

**Consider alternatives when:**
- You have large static datasets with repeated searches (use MiniSearch/Lunr)
- You need the absolute fastest search-only performance (use MiniSearch)
- You only search flat string arrays (use uFuzzy)

## License

MIT
