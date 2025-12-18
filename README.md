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
const results = seaq(contacts, 'jo', { keys: ['name', 'email'] });
// => [{ name: 'John Smith', ... }]

// Search nested properties
const users = [
  { name: 'Alice', address: { city: 'New York' } },
  { name: 'Bob', address: { city: 'Los Angeles' } },
];
const results = seaq(users, 'new york', { keys: ['address.city'] });

// Search arrays within objects
const people = [
  { name: 'Charlie', emails: [{ address: 'charlie@work.com' }, { address: 'charlie@home.com' }] },
];
const results = seaq(people, 'work.com', { keys: ['emails.address'] });

// Simple string array (no keys needed)
const fruits = ['apple', 'banana', 'orange'];
const results = seaq(fruits, 'app');
// => ['apple']
```

## API

```typescript
import { seaq, type SeaqOptions } from 'seaq';

seaq(list, query, options?)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `list` | `T[]` | Array of objects or strings to search |
| `query` | `string` | Search query |
| `options` | `SeaqOptions<T>` | Optional configuration (see below) |

### Options

```typescript
interface SeaqOptions<T> {
  keys?: string[];           // Object keys to search (supports dot notation)
  fuzziness?: number;        // 0-1, higher = more tolerant of typos
  fieldMode?: 'joined' | 'separate';  // How to score multiple fields (default: 'joined')
  limit?: number;            // Max results to return (more efficient than .slice())
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `keys` | - | Which fields to search. Supports dot notation for nested properties (`'address.city'`) and arrays (`'emails.address'`). |
| `fuzziness` | `undefined` | Typo tolerance. `0` = exact, `0.5` = moderate, `1` = very fuzzy. Default is strict matching. |
| `fieldMode` | `'joined'` | `'joined'` concatenates all fields (matches across fields like "john smith" → firstName + lastName). `'separate'` scores each field independently and takes the best match (~30-40% faster). |
| `limit` | - | Return only top N results. Uses a min-heap internally for O(n log k) performance - faster than sorting everything then using `.slice()`. |

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
seaq(users, 'new york', { keys: ['address.city'] });

// Arrays of objects - searches ALL emails for each contact
seaq(contacts, 'gmail', { keys: ['emails.address'] });
```

### Optional Fuzziness

By default, seaq requires all characters to match in sequence. Enable fuzziness to tolerate typos:

```typescript
// Strict (default) - "jonh" won't match "John"
seaq(contacts, 'jonh', { keys: ['name'] });

// Fuzzy - "jonh" matches "John"
seaq(contacts, 'jonh', { keys: ['name'], fuzziness: 0.5 });
```

### Performance Options

```typescript
// Fast mode: score fields separately (won't match "john smith" across firstName + lastName)
seaq(contacts, 'john', { keys: ['firstName', 'lastName'], fieldMode: 'separate' });

// Limit results: faster than .slice() for large datasets
seaq(contacts, 'john', { keys: ['name'], limit: 10 });
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

### Performance (10K items, single search)

| Library | 10K Books | 10K Contacts | Notes |
|---------|-----------|--------------|-------|
| uFuzzy | 3,473 ops/s | 4,874 ops/s | Fastest, but flat strings only |
| **seaq (separate)** | **676 ops/s** | **699 ops/s** | Fast mode, no cross-field matching |
| **seaq (joined)** | **520 ops/s** | **548 ops/s** | Default mode, full features |
| MiniSearch | 37 ops/s | 87 ops/s | Requires index build |
| Fuse.js | 24 ops/s | 38 ops/s | Most flexible, slowest |

**seaq is 14-22x faster than Fuse.js** and competitive with MiniSearch on cold starts.

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

For detailed benchmark methodology and results, see [BENCHMARKS.md](./BENCHMARKS.md).

## License

MIT
