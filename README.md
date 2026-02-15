# seaq

Zero-dependency fuzzy search. One function, no index, no setup.

```typescript
import { seaq } from 'seaq';

const results = seaq(contacts, 'john', { keys: ['name', 'email'] });
```

Works the same whether your list has 20 items or 20,000 -- no refactoring needed.

## Install

```bash
npm install seaq
```

## Usage

### Search objects by key

```typescript
const contacts = [
  { name: 'John Smith', email: 'john@example.com' },
  { name: 'Jane Doe', email: 'jane@test.com' },
];

seaq(contacts, 'jo', { keys: ['name', 'email'] });
// => [{ name: 'John Smith', ... }]
```

### Nested objects (dot notation)

```typescript
const users = [
  { name: 'Alice', address: { city: 'New York' } },
  { name: 'Bob', address: { city: 'Los Angeles' } },
];

seaq(users, 'new york', { keys: ['address.city'] });
```

### Array traversal

Dot notation walks into arrays automatically. Given `emails` is an array of objects, `'emails.address'` searches every element:

```typescript
const people = [
  { name: 'Charlie', emails: [{ address: 'charlie@work.com' }, { address: 'charlie@home.com' }] },
];

seaq(people, 'work.com', { keys: ['emails.address'] });
```

### Plain string arrays

No `keys` needed when searching strings directly:

```typescript
seaq(['apple', 'banana', 'orange'], 'app');
// => ['apple']
```

### Acronym matching

seaq gives bonus score to acronym matches -- useful for searching names, locations, and abbreviations:

```typescript
seaq(['Hillsdale Michigan', 'Historical Museum'], 'HiMi');
// => ['Hillsdale Michigan', 'Historical Museum']  (Hillsdale ranked first)
```

### Cross-field matching

The default `joined` field mode concatenates field values before scoring, so queries can span fields:

```typescript
seaq(contacts, 'john smith', { keys: ['firstName', 'lastName'] });
// Matches even though "john" is in firstName and "smith" is in lastName
```

### Match highlighting

Set `includeMatches: true` to get character-level match positions for building highlighted search results:

```typescript
const results = seaq(contacts, 'john', {
  keys: ['name'],
  includeMatches: true,
});
// => [{ item: { name: 'John Smith', ... }, score: 0.89, matches: [{ key: 'name', value: 'John Smith', indices: [[0, 3]], score: 0.89 }] }]
```

## API

```typescript
seaq<T>(list: T[], query: string, options?: SeaqOptions<T>): T[]
seaq<T>(list: T[], query: string, options: SeaqOptions<T> & { includeMatches: true }): SeaqResult<T>[]
```

Returns a new array of matching items sorted by relevance (highest score first). The original array is never mutated. An empty query returns `[]`.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `keys` | `string[]` | -- | Fields to search. Supports dot notation for nested properties (`'address.city'`) and automatic array traversal (`'emails.address'`). Omit when searching a plain `string[]`. |
| `fuzziness` | `number` | `0.2` | Typo tolerance from 0 to 1. `0` = strict (every character must match). `0.2` = light tolerance. `0.5` = moderate. `0.8`+ = very loose. |
| `fieldMode` | `'joined' \| 'separate'` | `'joined'` | `'joined'` concatenates all field values into one string before scoring -- supports cross-field queries like "john smith" matching firstName + lastName. `'separate'` scores each field independently and takes the best. |
| `limit` | `number` | `10` | Maximum results to return. Uses a min-heap internally for O(n log k) selection, faster than full-sorting then slicing. Set to `Infinity` to return all matches. |
| `threshold` | `number` | `0.3` | Relative score cutoff. Results scoring below `topScore * threshold` are dropped. `0` = no filtering (return everything with score > 0). `1` = only near-perfect matches. |
| `includeMatches` | `boolean` | `false` | When `true`, returns `SeaqResult<T>` objects with match metadata (character positions, matched value, per-match score) instead of plain items. |

### Types

```typescript
interface SeaqResult<T> {
  item: T;
  score: number;
  matches: SeaqMatch[];
}

interface SeaqMatch {
  key?: string;      // Field key (separate mode only; undefined for string/joined)
  value: string;     // The string that was scored
  indices: [number, number][];  // Highlight ranges as [start, end] pairs (inclusive)
  score: number;     // Score for this specific match
}
```

## Feature comparison

| Feature | seaq | fuse.js | minisearch | ufuzzy | lunr |
|---------|:----:|:-------:|:----------:|:------:|:----:|
| Exact match | yes | yes | yes | yes | yes |
| Fuzzy/typo tolerance | yes | yes | partial | yes | partial |
| Partial/prefix match | yes | yes | yes | yes | yes |
| Acronym bonus | **yes** | weak | no | no | no |
| Nested object access | **yes** | yes | no | no | no |
| Array field traversal | **yes** | partial | no | no | no |
| Cross-field matching | **yes** | no | no | no | no |
| Match highlighting | yes | yes | yes | yes | no |
| Pre-built index | no | yes | yes | no | yes |
| Zero dependencies | yes | yes | yes | yes | yes |

## When to use seaq

**seaq is a good fit when:**

- Your list is dynamic -- data changes each render, so index-based libs waste time rebuilding
- You need to search nested objects or arrays without manual flattening
- Acronym matching matters (e.g., "NYC" matching "New York City")
- You want zero setup -- no constructor, no addAll, no index step; one function call
- Cold-start performance matters -- seaq has no index overhead, so the first search is fast
- Your list size is unpredictable -- works from 20 items to 20,000 without API changes

**Consider alternatives when:**

- You repeatedly search a large static dataset (10K+ items) -- MiniSearch and Lunr amortize their index cost across many searches and will be significantly faster after the first query
- You only search flat string arrays and need maximum throughput -- uFuzzy is purpose-built for this
- You need features like stemming, stopwords, or boolean queries -- Lunr and MiniSearch have full-text search capabilities that seaq does not

For benchmark methodology and detailed performance numbers, see [BENCHMARKS.md](./BENCHMARKS.md).

## License

MIT
