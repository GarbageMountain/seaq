# Why seaq

seaq is a fuzzy search function. One function call, zero dependencies, no index to build.

This document is grounded in real benchmark numbers from
[`test/perf/why-seaq.test.ts`](packages/core/test/perf/why-seaq.test.ts),
tested against Fuse.js, MiniSearch, uFuzzy, and Lunr. All timings are medians
of 80 runs after a 20-run warmup. You can reproduce them yourself:

```
yarn workspace seaq vitest run test/perf/why-seaq.test.ts
```

The thesis: **seaq is competitive at any scale without an index. Your data can
grow from 20 items to 20K and you change nothing.**

---

## 1. Small lists

Command palettes, file pickers, autocomplete dropdowns. Under 50 items, there
is nothing to index -- the overhead of building one is pure waste.

### Command palette: 20 menu items

| Library    | Time  | vs best |
|------------|------:|--------:|
| seaq       |  7 us |    1.0x |
| uFuzzy     | 14 us |    2.0x |
| MiniSearch | 27 us |    3.9x |
| Fuse.js    | 32 us |    4.7x |

### File picker: "btn" across 21 file paths

| Library    | Time  | vs best | Found `Button.tsx`? |
|------------|------:|--------:|:-------------------:|
| seaq       |  2 us |    1.0x | Yes                 |
| uFuzzy     |  8 us |    3.7x | No                  |
| Fuse.js    | 18 us |    8.7x | No                  |
| MiniSearch | 28 us |   14.1x | No                  |

seaq is 2-14x faster on small lists, and it is the only library that matched
"btn" to `Button.tsx` (subsequence matching with acronym-aware scoring).

---

## 2. Acronym matching

Search a list of 12 tech terms (like "Application Programming Interface") using
their acronyms (like "API").

| Query | seaq | Fuse.js | MiniSearch | uFuzzy |
|-------|:----:|:-------:|:----------:|:------:|
| API   |  OK  |   OK    |     --     |   --   |
| CLI   |  OK  |   --    |     --     |   --   |
| IDE   |  --  |   --    |     --     |   --   |
| TDD   |  OK  |   OK    |     --     |   --   |
| SEO   |  OK  |   --    |     --     |   --   |
| SPA   |  OK  |   --    |     --     |   --   |

**seaq: 5/6. Fuse.js: 2/6. MiniSearch: 0/6. uFuzzy: 0/6.**

seaq's `string_score` algorithm gives explicit bonuses when query characters
match the first letter of each word. Most other libraries do not model this at
all.

---

## 3. Cold start on big data

Data just arrived from an API. No time to build an index. You need results now.

### 10K contacts, searching "nath"

| Library    |   Time  | vs best |
|------------|--------:|--------:|
| uFuzzy     |  332 us |    1.0x |
| seaq       | 2.82 ms |    8.5x |
| MiniSearch | 11.2 ms |   33.8x |
| Fuse.js    | 15.9 ms |   47.8x |
| Lunr       | 68.6 ms |  206.9x |

### 20K cities, searching "san"

| Library    |    Time  | vs best |
|------------|--------: |--------:|
| uFuzzy     |   978 us |    1.0x |
| seaq       |  5.59 ms |    5.7x |
| Fuse.js    | 18.5 ms  |   18.9x |
| MiniSearch | 34.1 ms  |   34.8x |
| Lunr       |  185 ms  |  188.8x |

uFuzzy is fastest here because it only searches flat string arrays. seaq is
second -- 3-6x faster than Fuse.js, MiniSearch, and Lunr, all of which pay the
cost of building an index they will never reuse.

---

## 4. Scaling without refactoring

The same `seaq()` call, the same options, the same code. Just more data.

```js
seaq(cities, "san", { keys: ["name", "state"] })
```

| Size       |   Time   | Results |
|------------|----------|--------:|
| 20 cities  |     4 us |       1 |
| 200 cities |    45 us |      10 |
| 2K cities  |   462 us |      10 |
| 20K cities |  5.75 ms |      10 |

No index to build, rebuild, or invalidate. Your list grew 1000x and you changed
zero lines of code. With indexed libraries, going from 20 to 20K items means
adding constructor setup, `addAll()` calls, rebuild logic, and teardown.

---

## 5. Nested objects

A CRM contact has `company.name` and `emails.address` nested inside it. Search
for "acme" across both fields:

```js
// seaq -- 1 line
seaq(contacts, "acme", { keys: ["company.name", "emails.address"] })

// MiniSearch -- must flatten first
const flat = contacts.map((c, id) => ({
  id,
  companyName: c.company.name,
  emails: c.emails.map(e => e.address).join(" "),
}));
const ms = new MiniSearch({ fields: ["companyName", "emails"] });
ms.addAll(flat);
ms.search("acme");

// uFuzzy -- must build a string haystack
const hay = contacts.map(c =>
  `${c.company.name} ${c.emails.map(e => e.address).join(" ")}`
);
new uFuzzy().search(hay, "acme");
```

seaq traverses dot-notation paths and arrays natively. No flattening, no string
concatenation, no data transformation step.

---

## 6. Dynamic data

When data changes between searches -- live feeds, paginated API results, data
that changes every render -- indexed libraries rebuild their index every time.
That index cost is wasted.

### 500 items, dataset alternates each search

| Library    |  Time  | vs best |
|------------|-------:|--------:|
| uFuzzy     |  47 us |    1.0x |
| seaq       | 127 us |    2.7x |
| MiniSearch | 412 us |    8.8x |
| Fuse.js    | 797 us |   16.9x |

seaq has no index. Its speed does not change whether the data is the same as
last time or completely different.

---

## 7. The tradeoff

When data is large, static, and searched repeatedly, pre-indexed libraries win.
This is where seaq is weakest. Here are the honest numbers.

### Single search on pre-indexed 10K contacts

| Library    |   Time  | vs best |
|------------|--------:|--------:|
| MiniSearch |   32 us |    1.0x |
| Lunr       |   76 us |    2.3x |
| uFuzzy     |  267 us |    8.2x |
| seaq       | 2.85 ms |   87.8x |
| Fuse.js    | 12.4 ms |  382.7x |

### Simulated typing: 7 keystrokes on 10K pre-indexed contacts

| Library    | Total   | Per keystroke |
|------------|--------:|--------------:|
| MiniSearch |  258 us |        37 us  |
| Lunr       | 1.11 ms |       159 us  |
| uFuzzy     | 2.31 ms |       330 us  |
| seaq       | 19.8 ms |      2.82 ms  |
| Fuse.js    | 92.6 ms |      13.2 ms  |

MiniSearch is 88x faster than seaq when it can reuse its index. That is real.

But look at seaq's absolute time: **2.82 ms per keystroke**. That is well under
the 16 ms frame budget for 60fps UI. The user will not notice. seaq is slower
in relative terms, but fast enough in absolute terms for any interactive use
case.

The question is not "which is fastest?" It is "do I need to manage an index for
this?"

---

## 8. v1 to v2

The story of seaq v2 is not "the engine got dramatically faster." It is
"you get sensible defaults instead of a firehose of garbage."

### Engine comparison (fuzziness 0, apples-to-apples)

| Query      | v1 time  | v2 time  | Speedup |
|------------|----------|----------|--------:|
| "san"      | 4.16 ms  | 4.10 ms  |    1.0x |
| "new york" | 3.88 ms  | 3.68 ms  |    1.1x |
| "los ang"  | 3.86 ms  | 3.65 ms  |    1.1x |

The core scoring engine improved modestly through pre-lowered targets, bitmask
pre-filtering, and a quadratic miss penalty. These are incremental wins, not
a rewrite.

### The real v2 win: limit + threshold

| Query  | v1 time  | v1 results | v2 time  | v2 results |
|--------|----------|------------|----------|------------|
| "san"  | 4.14 ms  |      1,894 | 3.90 ms  |         10 |
| "na"   | 4.84 ms  |      4,808 | 4.07 ms  |         10 |

v1 scored and sorted every item, then you called `.slice(0, 10)` to get the top
results. A query like "nath" on 10K contacts returned 9,756 results -- 97.5%
garbage.

v2 defaults to `{ limit: 10, threshold: 0.3 }`. The threshold drops results
scoring below 30% of the best match. The heap keeps only the top N without a
full sort. You get 10 good results instead of 9,756 bad ones, and it is slightly
faster too.

---

## When to use seaq

**Use seaq when:**

- You do not want to manage an index
- Data is dynamic -- changes each render, arrives from an API
- List size is unpredictable (20 today, 20K tomorrow)
- You need nested object or array traversal
- You need acronym matching (NYC -> New York City)
- You want 1 function call, 0 setup, 0 dependencies

**Consider MiniSearch or Lunr when:**

- Data is large AND static AND searched repeatedly
- You need full-text features (stemming, stop words, field boosting)

**The mental model:** seaq is `Array.filter()` with smart fuzzy scoring. It does
not need an index. It does not care how big your list is. It just scans and
scores -- fast enough for any UI.
