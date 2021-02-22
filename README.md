# Seaq - Real nice ES6 fuzzy string search

Seaq is an ES6 string search library heavily inspired by [Fusejs](https://github.com/krisk/fuse). It is built in [Typescript](https://github.com/Microsoft/TypeScript) implementing the fantastic [string_score](https://github.com/joshaven/string_score) string matching algorithm.

| Statements                  | Branches                | Functions                 | Lines             |
| --------------------------- | ----------------------- | ------------------------- | ----------------- |
| ![Statements](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg) | ![Branches](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg) | ![Functions](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg) | ![Lines](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg) |

## Basic usage

```typescript
import { seaq } from 'seaq';

const contacts = [ { name: 'John', ... }, { name: 'Jane', ... }];
const queryString = 'jo';

const orderedContacts = seaq(contacts, queryString, ['name']);
```
