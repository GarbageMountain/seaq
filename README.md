# Seaq - Real nice ES6 fuzzy string search

Seaq is an ES6 string search library heavily inspired by [Fusejs](https://github.com/krisk/fuse). It is built in [Typescript](https://github.com/Microsoft/TypeScript) implementing the fantastic [string_score](https://github.com/joshaven/string_score) string matching algorithm.

## Basic usage

```typescript
import { seaq } from 'seaq';

const contacts = [ { name: 'John', ... }, { name: 'Jane', ... }];
const queryString = 'jo';

const orderedContacts = seaq(contacts, queryString, ['name']);
```
