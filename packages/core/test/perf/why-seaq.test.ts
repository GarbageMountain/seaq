/**
 * WHY SEAQ? — Honest use-case exploration
 *
 * This test suite runs real scenarios against all five libraries and prints
 * a human-readable report. It answers the question: "When would I actually
 * reach for seaq instead of Fuse, MiniSearch, uFuzzy, or Lunr?"
 *
 * Run with: yarn workspace seaq vitest run test/perf/why-seaq.test.ts
 */
import Fuse from 'fuse.js';
import MiniSearch from 'minisearch';
import uFuzzy from '@leeoniya/ufuzzy';
import lunr from 'lunr';
import { describe, expect, test } from 'vitest';
import { seaq } from '../../src/index';
import { data } from './common';

const { ManyContacts } = data;

// ── Helpers ──────────────────────────────────────────────────────────────

function timed<T>(fn: () => T): { result: T; ms: number } {
  const t0 = performance.now();
  const result = fn();
  return { result, ms: performance.now() - t0 };
}

function fmt(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(2)}ms`;
}

type Row = { lib: string; ms: number; count: number; top3: string[] };

function printTable(title: string, rows: Row[]) {
  const sorted = [...rows].sort((a, b) => a.ms - b.ms);
  const fastest = sorted[0].ms;
  console.log(`\n  ${title}`);
  console.log(`  ${'Library'.padEnd(14)} ${'Time'.padStart(10)} ${'vs best'.padStart(8)} ${'Results'.padStart(8)}  Top 3`);
  console.log(`  ${'─'.repeat(14)} ${'─'.repeat(10)} ${'─'.repeat(8)} ${'─'.repeat(8)}  ${'─'.repeat(30)}`);
  for (const r of sorted) {
    const ratio = fastest > 0 ? (r.ms / fastest) : 1;
    const ratioStr = ratio < 1.05 ? '  1.0x' : `${ratio.toFixed(1)}x`.padStart(6);
    console.log(
      `  ${r.lib.padEnd(14)} ${fmt(r.ms).padStart(10)} ${ratioStr.padStart(8)} ${String(r.count).padStart(8)}  ${r.top3.join(', ')}`,
    );
  }
}

// ── Shared data ──────────────────────────────────────────────────────────

// Flat haystack for uFuzzy (it only searches string[])
const contactHaystack = ManyContacts.map((c) => `${c.givenName} ${c.familyName}`);

// Small lists — the kind you'd actually filter in a UI component
const menuItems = [
  'Dashboard', 'Settings', 'User Management', 'Billing & Payments',
  'API Keys', 'Audit Log', 'Team Settings', 'Notifications',
  'Profile', 'Security', 'Integrations', 'Webhooks',
  'Organization Settings', 'Data Export', 'Help & Support',
  'Developer Tools', 'Access Control', 'Single Sign-On',
  'Custom Fields', 'Workflow Automation',
];

const files = [
  'src/index.ts', 'src/App.tsx', 'src/components/Button.tsx',
  'src/components/Modal.tsx', 'src/components/SearchInput.tsx',
  'src/hooks/useAuth.ts', 'src/hooks/useSearch.ts',
  'src/utils/string.ts', 'src/utils/format.ts',
  'package.json', 'tsconfig.json', 'vite.config.ts',
  'README.md', 'CHANGELOG.md', '.env.local',
  'src/api/client.ts', 'src/api/endpoints.ts',
  'src/styles/globals.css', 'src/styles/theme.ts',
  'tests/App.test.tsx', 'tests/utils.test.ts',
];

const emojis = [
  'grinning face', 'face with tears of joy', 'red heart', 'thumbs up',
  'fire', 'thinking face', 'rocket', 'check mark', 'warning',
  'magnifying glass', 'light bulb', 'gear', 'wrench', 'hammer',
  'globe', 'star', 'sparkles', 'party popper', 'clapping hands',
  'raised hands', 'folded hands', 'person shrugging',
  'see-no-evil monkey', 'hear-no-evil monkey', 'speak-no-evil monkey',
  'collision', 'hundred points', 'money bag', 'chart increasing',
  'calendar', 'clipboard', 'pushpin', 'paperclip', 'scissors',
  'locked', 'unlocked', 'bell', 'loudspeaker', 'hourglass',
];

// Nested data — realistic CRM-style objects
interface CrmContact {
  name: string;
  company: { name: string; industry: string };
  emails: { type: string; address: string }[];
  tags: string[];
}

const crmContacts: CrmContact[] = [
  { name: 'Alice Chen', company: { name: 'Acme Corp', industry: 'SaaS' }, emails: [{ type: 'work', address: 'alice@acme.com' }], tags: ['vip', 'enterprise'] },
  { name: 'Bob Martinez', company: { name: 'TechStart', industry: 'Fintech' }, emails: [{ type: 'work', address: 'bob@techstart.io' }, { type: 'personal', address: 'bobm@gmail.com' }], tags: ['lead'] },
  { name: 'Carol Williams', company: { name: 'DataSystems', industry: 'Analytics' }, emails: [{ type: 'work', address: 'carol@datasys.com' }], tags: ['customer', 'enterprise'] },
  { name: 'David Kim', company: { name: 'CloudNine', industry: 'Infrastructure' }, emails: [{ type: 'work', address: 'dkim@cloudnine.dev' }], tags: ['partner'] },
  { name: 'Eva Johnson', company: { name: 'MegaInc', industry: 'E-commerce' }, emails: [{ type: 'work', address: 'eva.j@megainc.com' }, { type: 'personal', address: 'evaj@yahoo.com' }], tags: ['vip', 'customer'] },
  { name: 'Frank Liu', company: { name: 'Acme Corp', industry: 'SaaS' }, emails: [{ type: 'work', address: 'frank@acme.com' }], tags: ['internal'] },
  { name: 'Grace Park', company: { name: 'StartupCo', industry: 'HealthTech' }, emails: [{ type: 'work', address: 'grace@startupco.health' }], tags: ['prospect'] },
  { name: 'Henry Zhang', company: { name: 'BigCorp', industry: 'Manufacturing' }, emails: [{ type: 'work', address: 'hzhang@bigcorp.com' }], tags: ['customer'] },
];

// ============================================================================
// SCENARIO 1: Small list filtering (command palette, autocomplete, emoji picker)
// This is the bread-and-butter use case for seaq.
// ============================================================================

describe('SCENARIO 1: Small list filtering (< 50 items)', () => {
  test('Command palette — filter 20 menu items', () => {
    const queries = ['set', 'api', 'not', 'dev', 'bill'];
    const rows: Row[] = [];

    for (const lib of ['seaq', 'fuse.js', 'minisearch', 'ufuzzy'] as const) {
      let total = 0;
      let lastResults: string[] = [];
      for (const q of queries) {
        const { ms, result } = (() => {
          switch (lib) {
            case 'seaq': return timed(() => seaq(menuItems, q, { limit: Infinity, threshold: 0 }));
            case 'fuse.js': return timed(() => {
              const fuse = new Fuse(menuItems);
              return fuse.search(q).map(r => r.item);
            });
            case 'minisearch': return timed(() => {
              const ms = new MiniSearch({ fields: ['text'], storeFields: ['text'] });
              ms.addAll(menuItems.map((text, id) => ({ id, text })));
              return ms.search(q, { prefix: true, fuzzy: 0.2 }).map(r => r.text as string);
            });
            case 'ufuzzy': return timed(() => {
              const uf = new uFuzzy();
              const [idxs] = uf.search(menuItems, q);
              return idxs?.map(i => menuItems[i]) ?? [];
            });
          }
        })();
        total += ms;
        lastResults = result;
      }
      rows.push({ lib, ms: total / queries.length, count: lastResults.length, top3: lastResults.slice(0, 3) });
    }

    printTable('Command palette (20 items, avg per query)', rows);
    expect(true).toBe(true);
  });

  test('File picker — fuzzy match 21 file paths', () => {
    const rows: Row[] = [];

    // seaq — one function call, no setup
    const { ms: seaqMs, result: seaqR } = timed(() => seaq(files, 'btn', { limit: Infinity, threshold: 0 }));
    rows.push({ lib: 'seaq', ms: seaqMs, count: seaqR.length, top3: seaqR.slice(0, 3) });

    // fuse — must construct, then search
    const { ms: fuseMs, result: fuseR } = timed(() => {
      const f = new Fuse(files);
      return f.search('btn').map(r => r.item);
    });
    rows.push({ lib: 'fuse.js', ms: fuseMs, count: fuseR.length, top3: fuseR.slice(0, 3) });

    // minisearch — must construct, addAll, then search
    const { ms: miniMs, result: miniR } = timed(() => {
      const ms = new MiniSearch({ fields: ['path'], storeFields: ['path'] });
      ms.addAll(files.map((path, id) => ({ id, path })));
      return ms.search('btn', { prefix: true, fuzzy: 0.2 }).map(r => r.path as string);
    });
    rows.push({ lib: 'minisearch', ms: miniMs, count: miniR.length, top3: miniR.slice(0, 3) });

    // ufuzzy — needs string array (fine here), but also no index
    const { ms: ufMs, result: ufR } = timed(() => {
      const uf = new uFuzzy();
      const [idxs] = uf.search(files, 'btn');
      return idxs?.map(i => files[i]) ?? [];
    });
    rows.push({ lib: 'ufuzzy', ms: ufMs, count: ufR.length, top3: ufR.slice(0, 3) });

    printTable('File picker: "btn" across 21 paths (cold start)', rows);
    expect(true).toBe(true);
  });

  test('Emoji picker — 40 items, typo query', () => {
    const rows: Row[] = [];

    const { ms: seaqMs, result: seaqR } = timed(() => seaq(emojis, 'rockt', { fuzziness: 0.3, limit: Infinity, threshold: 0 }));
    rows.push({ lib: 'seaq', ms: seaqMs, count: seaqR.length, top3: seaqR.slice(0, 3) });

    const { ms: fuseMs, result: fuseR } = timed(() => {
      const f = new Fuse(emojis, { threshold: 0.4 });
      return f.search('rockt').map(r => r.item);
    });
    rows.push({ lib: 'fuse.js', ms: fuseMs, count: fuseR.length, top3: fuseR.slice(0, 3) });

    const { ms: ufMs, result: ufR } = timed(() => {
      const uf = new uFuzzy({ intraMode: 1, intraSub: 1, intraDel: 1 });
      const [idxs] = uf.search(emojis, 'rockt');
      return idxs?.map(i => emojis[i]) ?? [];
    });
    rows.push({ lib: 'ufuzzy', ms: ufMs, count: ufR.length, top3: ufR.slice(0, 3) });

    printTable('Emoji picker: "rockt" (typo) across 40 items', rows);
    expect(true).toBe(true);
  });
});

// ============================================================================
// SCENARIO 2: Acronym / abbreviation matching
// This is seaq's killer feature — no other library does this well.
// ============================================================================

describe('SCENARIO 2: Acronym matching (unique to seaq)', () => {
  const techTerms = [
    'Application Programming Interface',
    'Graphical User Interface',
    'Command Line Interface',
    'Software Development Kit',
    'Integrated Development Environment',
    'Object Oriented Programming',
    'Test Driven Development',
    'Continuous Integration Deployment',
    'Single Page Application',
    'Progressive Web App',
    'Search Engine Optimization',
    'User Experience Design',
  ];

  const acronymQueries = [
    { abbr: 'API', expected: 'Application Programming Interface' },
    { abbr: 'CLI', expected: 'Command Line Interface' },
    { abbr: 'IDE', expected: 'Integrated Development Environment' },
    { abbr: 'TDD', expected: 'Test Driven Development' },
    { abbr: 'SEO', expected: 'Search Engine Optimization' },
    { abbr: 'SPA', expected: 'Single Page Application' },
  ];

  test('seaq vs others on acronym detection', () => {
    const libs = [
      { name: 'seaq', search: (q: string) => seaq(techTerms, q, { limit: Infinity, threshold: 0 }) },
      { name: 'fuse.js', search: (q: string) => new Fuse(techTerms, { threshold: 0.6 }).search(q).map(r => r.item) },
      { name: 'minisearch', search: (q: string) => {
        const ms = new MiniSearch({ fields: ['text'], storeFields: ['text'] });
        ms.addAll(techTerms.map((text, id) => ({ id, text })));
        return ms.search(q, { prefix: true, fuzzy: 0.2 }).map(r => r.text as string);
      }},
      { name: 'ufuzzy', search: (q: string) => {
        const uf = new uFuzzy();
        const [idxs] = uf.search(techTerms, q);
        return idxs?.map(i => techTerms[i]) ?? [];
      }},
    ];

    console.log('\n  Acronym Detection: query → expected #1 result');
    console.log(`  ${'Query'.padEnd(6)} ${'seaq'.padEnd(16)} ${'fuse.js'.padEnd(16)} ${'minisearch'.padEnd(16)} ${'ufuzzy'.padEnd(16)}`);
    console.log(`  ${'─'.repeat(6)} ${'─'.repeat(16)} ${'─'.repeat(16)} ${'─'.repeat(16)} ${'─'.repeat(16)}`);

    const scores: Record<string, number> = {};

    for (const { abbr, expected } of acronymQueries) {
      const cells: string[] = [];
      for (const lib of libs) {
        const results = lib.search(abbr);
        const found = results[0] === expected;
        if (found) scores[lib.name] = (scores[lib.name] ?? 0) + 1;
        cells.push(found ? '✓ correct' : results[0] ? `✗ "${results[0].slice(0, 12)}…"` : '✗ (nothing)');
      }
      console.log(`  ${abbr.padEnd(6)} ${cells.map(c => c.padEnd(16)).join(' ')}`);
    }

    console.log(`\n  Score:  ${libs.map(l => `${l.name}: ${scores[l.name] ?? 0}/${acronymQueries.length}`).join('  |  ')}`);

    // seaq should get most of them (acronym scoring isn't perfect for all combos)
    expect(scores['seaq']).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================================
// SCENARIO 3: Cold start — one-shot search, no index
// The #1 performance advantage: no setup cost.
// ============================================================================

describe('SCENARIO 3: Cold start / one-shot search', () => {
  test('10K contacts — build + search (realistic: data just arrived from API)', () => {
    const rows: Row[] = [];

    const { ms: seaqMs, result: seaqR } = timed(() =>
      seaq(ManyContacts, 'nath', { keys: ['givenName', 'familyName'], limit: Infinity, threshold: 0 }),
    );
    rows.push({ lib: 'seaq', ms: seaqMs, count: seaqR.length, top3: seaqR.slice(0, 3).map((c: any) => `${c.givenName} ${c.familyName}`) });

    const { ms: fuseMs, result: fuseR } = timed(() => {
      const f = new Fuse(ManyContacts, { keys: ['givenName', 'familyName'] });
      return f.search('nath');
    });
    rows.push({ lib: 'fuse.js', ms: fuseMs, count: fuseR.length, top3: fuseR.slice(0, 3).map(r => `${(r.item as any).givenName} ${(r.item as any).familyName}`) });

    const { ms: miniMs, result: miniR } = timed(() => {
      const ms = new MiniSearch({ fields: ['givenName', 'familyName'], storeFields: ['givenName', 'familyName'] });
      ms.addAll(ManyContacts.map((c, i) => ({ id: i, givenName: c.givenName, familyName: c.familyName })));
      return ms.search('nath', { prefix: true });
    });
    rows.push({ lib: 'minisearch', ms: miniMs, count: miniR.length, top3: miniR.slice(0, 3).map(r => `${r.givenName} ${r.familyName}`) });

    const { ms: lunrMs, result: lunrR } = timed(() => {
      const idx = lunr(function () {
        this.field('givenName');
        this.field('familyName');
        ManyContacts.forEach((c, i) => this.add({ id: i, givenName: c.givenName, familyName: c.familyName }));
      });
      return idx.search('nath*');
    });
    rows.push({ lib: 'lunr', ms: lunrMs, count: lunrR.length, top3: lunrR.slice(0, 3).map(r => { const c = ManyContacts[Number(r.ref)]; return `${c.givenName} ${c.familyName}`; }) });

    const { ms: ufMs, result: ufR } = timed(() => {
      const uf = new uFuzzy();
      const hay = ManyContacts.map(c => `${c.givenName} ${c.familyName}`);
      const [idxs,, order] = uf.search(hay, 'nath');
      return order ? order.map(oi => idxs![oi]) : (idxs ?? []);
    });
    rows.push({ lib: 'ufuzzy', ms: ufMs, count: ufR.length, top3: ufR.slice(0, 3).map((i: any) => `${ManyContacts[i].givenName} ${ManyContacts[i].familyName}`) });

    printTable('10K contacts, cold start (build + search for "nath")', rows);
    expect(true).toBe(true);
  });

});

// ============================================================================
// SCENARIO 4: Nested objects / array traversal — zero prep
// Only seaq and Fuse handle this natively. MiniSearch/Lunr/uFuzzy need flattening.
// ============================================================================

describe('SCENARIO 4: Nested object search (zero prep)', () => {
  test('search nested company.name and emails.address — no flattening needed', () => {
    console.log('\n  Search CRM contacts for "acme" across company.name + emails.address:\n');

    // seaq — just works
    const seaqR = seaq(crmContacts, 'acme', { keys: ['company.name', 'emails.address'], limit: Infinity, threshold: 0 });
    console.log(`  seaq:       ${seaqR.map(c => c.name).join(', ')} (${seaqR.length} results)`);

    // fuse — also supports nested keys natively
    const fuseR = new Fuse(crmContacts, { keys: ['company.name', 'emails.address'] }).search('acme');
    console.log(`  fuse.js:    ${fuseR.map(r => r.item.name).join(', ')} (${fuseR.length} results)`);

    // minisearch — must flatten first
    const flatCrm = crmContacts.map((c, id) => ({
      id,
      companyName: c.company.name,
      emails: c.emails.map(e => e.address).join(' '),
    }));
    const ms = new MiniSearch({ fields: ['companyName', 'emails'], storeFields: ['id'] });
    ms.addAll(flatCrm);
    const miniR = ms.search('acme', { prefix: true, fuzzy: 0.2 });
    console.log(`  minisearch: ${miniR.map(r => crmContacts[r.id as number].name).join(', ')} (${miniR.length} results) [required flattening]`);

    // ufuzzy — must build a haystack string
    const hay = crmContacts.map(c => `${c.company.name} ${c.emails.map(e => e.address).join(' ')}`);
    const uf = new uFuzzy();
    const [idxs] = uf.search(hay, 'acme');
    const ufR = idxs?.map(i => crmContacts[i].name) ?? [];
    console.log(`  ufuzzy:     ${ufR.join(', ')} (${ufR.length} results) [required string concat]`);

    console.log('\n  Lines of code to get here:');
    console.log('    seaq:       1  — seaq(data, query, { keys: ["company.name", "emails.address"] })');
    console.log('    fuse.js:    2  — new Fuse(data, { keys }) + fuse.search(query)');
    console.log('    minisearch: 5+ — flatten data + new MiniSearch({ fields }) + addAll + search');
    console.log('    ufuzzy:     3+ — build haystack strings + new uFuzzy() + search');
    console.log('    lunr:       8+ — builder function + field mapping + add each doc + search');

    // seaq should find both Acme Corp employees
    expect(seaqR.length).toBeGreaterThanOrEqual(2);
    expect(seaqR.map(c => c.name)).toContain('Alice Chen');
    expect(seaqR.map(c => c.name)).toContain('Frank Liu');
  });
});

// ============================================================================
// SCENARIO 5: Where seaq LOSES — repeated searches on large static datasets
// Be honest: indexed libraries amortize their setup cost over many queries.
// ============================================================================

describe('SCENARIO 5: Where seaq LOSES — repeated search on 10K static data', () => {
  // Pre-build indexes (simulates: app loaded, user is typing)
  const fuseIdx = new Fuse(ManyContacts, { keys: ['givenName', 'familyName'] });

  const miniIdx = new MiniSearch({ fields: ['givenName', 'familyName'], storeFields: ['givenName', 'familyName'] });
  miniIdx.addAll(ManyContacts.map((c, i) => ({ id: i, givenName: c.givenName, familyName: c.familyName })));

  const lunrIdx = lunr(function () {
    this.field('givenName');
    this.field('familyName');
    ManyContacts.forEach((c, i) => this.add({ id: i, givenName: c.givenName, familyName: c.familyName }));
  });

  const ufInst = new uFuzzy();

  test('single search on pre-indexed 10K contacts', () => {
    const rows: Row[] = [];

    const { ms: seaqMs, result: seaqR } = timed(() =>
      seaq(ManyContacts, 'nath', { keys: ['givenName', 'familyName'], limit: Infinity, threshold: 0 }),
    );
    rows.push({ lib: 'seaq', ms: seaqMs, count: seaqR.length, top3: seaqR.slice(0, 3).map((c: any) => c.givenName) });

    const { ms: fuseMs, result: fuseR } = timed(() => fuseIdx.search('nath'));
    rows.push({ lib: 'fuse.js', ms: fuseMs, count: fuseR.length, top3: fuseR.slice(0, 3).map(r => (r.item as any).givenName) });

    const { ms: miniMs, result: miniR } = timed(() => miniIdx.search('nath', { prefix: true }));
    rows.push({ lib: 'minisearch', ms: miniMs, count: miniR.length, top3: miniR.slice(0, 3).map(r => String(r.givenName)) });

    const { ms: lunrMs, result: lunrR } = timed(() => lunrIdx.search('nath*'));
    rows.push({ lib: 'lunr', ms: lunrMs, count: lunrR.length, top3: lunrR.slice(0, 3).map(r => ManyContacts[Number(r.ref)].givenName) });

    const { ms: ufMs, result: ufR } = timed(() => {
      const [idxs] = ufInst.search(contactHaystack, 'nath');
      return idxs ?? [];
    });
    rows.push({ lib: 'ufuzzy', ms: ufMs, count: ufR.length, top3: ufR.slice(0, 3).map((i: any) => ManyContacts[i].givenName) });

    printTable('10K contacts, INDEX PRE-BUILT, search "nath" (seaq loses here)', rows);
    console.log('\n  ^ Indexed libraries amortize setup. On repeated queries against the');
    console.log('    same static dataset, MiniSearch/Lunr are orders of magnitude faster.');
    console.log('    seaq re-scans every item every time — that is the tradeoff.');
    expect(true).toBe(true);
  });

  test('simulated typing: 7 keystrokes on 10K contacts', () => {
    const keystrokes = ['n', 'na', 'nat', 'nata', 'natas', 'natash', 'natasha'];
    const rows: Row[] = [];

    const { ms: seaqMs } = timed(() => { for (const q of keystrokes) seaq(ManyContacts, q, { keys: ['givenName', 'familyName'], limit: Infinity, threshold: 0 }); });
    rows.push({ lib: 'seaq', ms: seaqMs, count: 7, top3: ['(7 searches)'] });

    const { ms: fuseMs } = timed(() => { for (const q of keystrokes) fuseIdx.search(q); });
    rows.push({ lib: 'fuse.js', ms: fuseMs, count: 7, top3: ['(7 searches)'] });

    const { ms: miniMs } = timed(() => { for (const q of keystrokes) miniIdx.search(q, { prefix: true }); });
    rows.push({ lib: 'minisearch', ms: miniMs, count: 7, top3: ['(7 searches)'] });

    const { ms: lunrMs } = timed(() => { for (const q of keystrokes) lunrIdx.search(q + '*'); });
    rows.push({ lib: 'lunr', ms: lunrMs, count: 7, top3: ['(7 searches)'] });

    const { ms: ufMs } = timed(() => { for (const q of keystrokes) ufInst.search(contactHaystack, q); });
    rows.push({ lib: 'ufuzzy', ms: ufMs, count: 7, top3: ['(7 searches)'] });

    printTable('7 keystrokes on 10K pre-indexed (seaq loses harder here)', rows);
    expect(true).toBe(true);
  });
});

// ============================================================================
// SCENARIO 6: The sweet spot — medium list, data changes each render
// Think: filtered table, shopping cart, React state array
// ============================================================================

describe('SCENARIO 6: Medium dynamic list (data changes each render)', () => {
  // Simulate: user filters a 500-item list, but the list is different each time
  // (e.g. already filtered by category, or items were added/removed)
  const slice500 = ManyContacts.slice(0, 500);
  const slice500b = ManyContacts.slice(500, 1000);

  test('alternating datasets — index must be rebuilt each time', () => {
    const datasets = [slice500, slice500b, slice500, slice500b, slice500];
    const rows: Row[] = [];

    const { ms: seaqMs } = timed(() => {
      for (const ds of datasets) seaq(ds, 'john', { keys: ['givenName', 'familyName'], limit: Infinity, threshold: 0 });
    });
    rows.push({ lib: 'seaq', ms: seaqMs / datasets.length, count: datasets.length, top3: ['(avg per search)'] });

    const { ms: fuseMs } = timed(() => {
      for (const ds of datasets) {
        const f = new Fuse(ds, { keys: ['givenName', 'familyName'] });
        f.search('john');
      }
    });
    rows.push({ lib: 'fuse.js', ms: fuseMs / datasets.length, count: datasets.length, top3: ['(avg per search)'] });

    const { ms: miniMs } = timed(() => {
      for (const ds of datasets) {
        const ms = new MiniSearch({ fields: ['givenName', 'familyName'] });
        ms.addAll(ds.map((c, i) => ({ id: i, givenName: c.givenName, familyName: c.familyName })));
        ms.search('john', { prefix: true });
      }
    });
    rows.push({ lib: 'minisearch', ms: miniMs / datasets.length, count: datasets.length, top3: ['(avg per search)'] });

    const { ms: ufMs } = timed(() => {
      for (const ds of datasets) {
        const uf = new uFuzzy();
        const hay = ds.map(c => `${c.givenName} ${c.familyName}`);
        uf.search(hay, 'john');
      }
    });
    rows.push({ lib: 'ufuzzy', ms: ufMs / datasets.length, count: datasets.length, top3: ['(avg per search)'] });

    printTable('500 items, dataset changes each time (index = wasted work)', rows);
    console.log('\n  ^ When data changes between searches, index-based libraries pay the');
    console.log('    build cost every time. seaq has no index — same speed regardless.');
    expect(true).toBe(true);
  });
});

// ============================================================================
// SCENARIO 7: API simplicity — lines of code comparison
// ============================================================================

describe('SCENARIO 7: API simplicity', () => {
  test('print code comparison', () => {
    console.log(`
  ┌─────────────────────────────────────────────────────────────────────┐
  │ API Comparison: search contacts by name                            │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                    │
  │ seaq (1 line):                                                     │
  │   seaq(contacts, 'john', { keys: ['name'] })                      │
  │                                                                    │
  │ Fuse.js (2 lines):                                                 │
  │   const fuse = new Fuse(contacts, { keys: ['name'] })             │
  │   fuse.search('john')                                              │
  │                                                                    │
  │ MiniSearch (4 lines):                                              │
  │   const ms = new MiniSearch({ fields: ['name'] })                  │
  │   ms.addAll(contacts.map((c, i) => ({ id: i, ...c })))            │
  │   ms.search('john', { prefix: true })                              │
  │   // + must add 'id' field to every item!                          │
  │                                                                    │
  │ Lunr (7+ lines):                                                   │
  │   const idx = lunr(function() {                                    │
  │     this.ref('id')                                                 │
  │     this.field('name')                                             │
  │     contacts.forEach((c, i) => this.add({ id: i, ...c }))         │
  │   })                                                               │
  │   idx.search('john')                                               │
  │   // + returns refs, must map back to original objects!            │
  │                                                                    │
  │ uFuzzy (3 lines):                                                  │
  │   const uf = new uFuzzy()                                          │
  │   const haystack = contacts.map(c => c.name) // must flatten       │
  │   uf.search(haystack, 'john')                                      │
  │   // + returns indices, must map back to objects!                   │
  │                                                                    │
  └─────────────────────────────────────────────────────────────────────┘`);

    expect(true).toBe(true);
  });
});

// ============================================================================
// SUMMARY
// ============================================================================

describe('SUMMARY', () => {
  test('print verdict', () => {
    console.log(`
  ╔═════════════════════════════════════════════════════════════════════╗
  ║                        WHEN TO USE SEAQ                           ║
  ╠═════════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  ✓ USE seaq when:                                                 ║
  ║    • Small-medium lists (< 5K items)                              ║
  ║    • Command palettes, emoji pickers, file finders, autocomplete  ║
  ║    • Data changes frequently (no stale index to manage)           ║
  ║    • Nested/complex objects (no flattening boilerplate)           ║
  ║    • You need acronym matching (NYC → New York City)              ║
  ║    • You want the simplest possible API (1 function, 0 setup)     ║
  ║    • One-shot search on data that just arrived from an API        ║
  ║    • Bundle size matters (< 5KB, zero deps)                       ║
  ║                                                                   ║
  ║  ✗ DON'T use seaq when:                                           ║
  ║    • 10K+ items with repeated searches (use MiniSearch or Lunr)   ║
  ║    • Search-as-you-type on large static datasets (index wins)     ║
  ║    • Full-text / token-based search (MiniSearch, Lunr)            ║
  ║    • You need stemming, stop words, or language features (Lunr)   ║
  ║                                                                   ║
  ║  The mental model:                                                ║
  ║    seaq = Array.filter() with good fuzzy scoring                  ║
  ║    Fuse/MiniSearch/Lunr = search engine you have to set up first  ║
  ║                                                                   ║
  ╚═════════════════════════════════════════════════════════════════════╝`);

    expect(true).toBe(true);
  });
});
