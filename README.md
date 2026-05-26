# seaq

[![npm](https://img.shields.io/npm/v/seaq?label=npm)](https://www.npmjs.com/package/seaq)

Zero-dependency fuzzy search for JavaScript and TypeScript. One function, no index, no setup. Works the same whether your list has 20 items or 20,000.

```typescript
import { seaq } from 'seaq';

seaq(contacts, 'john', { keys: ['name', 'email'] });
```

For installation, usage, and the full API see **[`packages/core/README.md`](./packages/core/README.md)** — that's also what ships on npm.

## Repo layout

This is a yarn workspaces monorepo.

| Package | Description |
|---------|-------------|
| [`packages/core`](./packages/core) | The published `seaq` library. |
| [`packages/test-data`](./packages/test-data) | Shared fixtures (contacts, cities, books) consumed by tests and the examples app. Not published. |
| [`packages/examples`](./packages/examples) | Interactive Vite + React site comparing seaq against Fuse.js, MiniSearch, uFuzzy, and Lunr across real datasets. |

Other docs:

- [BENCHMARKS.md](./BENCHMARKS.md) — performance methodology and numbers
- [WHY-SEAQ.md](./WHY-SEAQ.md) — when seaq is the right tool (and when it isn't)

## Development

Prerequisites: Node 22+, yarn 4 (managed via `packageManager` in `package.json`).

```bash
yarn install
yarn build          # build all packages
yarn test           # run all tests
yarn ts-check       # type-check the whole repo
yarn check          # biome lint
yarn dev            # build core in watch mode + run examples site
```

Benchmarks live in `packages/core/test/perf`:

```bash
yarn workspace seaq benchmark
yarn bench:save     # save benchmark JSON keyed by commit short SHA
```

## Releasing

Manual, run from a clean working tree:

```bash
# 1. Bump version in root package.json and packages/core/package.json
# 2. Commit the bump
# 3. Inspect what will be published
yarn release:pack

# 4. Publish
yarn release:publish:next     # prereleases (rc, beta, alpha) -> npm 'next' tag
yarn release:publish:latest   # stable releases -> npm 'latest' tag
```

`release:publish:*` runs `release:verify` first (ts-check + lint + test + build) and then `npm publish --access public --tag <tag>` from `packages/core`.

A GitHub Actions release workflow (`.github/workflows/release.yml`) is also available via workflow_dispatch.

## License

MIT
