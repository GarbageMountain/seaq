import { describe, expect, test } from 'vitest';
import { parseCustomDataset } from './data';

describe('parseCustomDataset', () => {
  test('rejects non-JSON', () => {
    const r = parseCustomDataset('{nope');
    expect(r.ok).toBe(false);
  });
  test('rejects non-array', () => {
    const r = parseCustomDataset('{"a": 1}');
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain('array');
  });
  test('rejects empty array', () => {
    expect(parseCustomDataset('[]')).toMatchObject({ ok: false });
  });
  test('rejects unsupported item types', () => {
    expect(parseCustomDataset('[1, 2, 3]')).toMatchObject({ ok: false });
    expect(parseCustomDataset('[[1], [2]]')).toMatchObject({ ok: false });
    expect(parseCustomDataset('[null]')).toMatchObject({ ok: false });
  });
  test('rejects mixed strings and objects with index info', () => {
    const r = parseCustomDataset('["a", {"x": "y"}]');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('item 1');
  });
  test('accepts string arrays', () => {
    const r = parseCustomDataset('["New York", "Boston"]');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.keys).toEqual([]);
      expect(r.config.data).toHaveLength(2);
      expect(r.config.displayFn('New York')).toBe('New York');
    }
  });
  test('accepts object arrays and infers nested string keys', () => {
    const r = parseCustomDataset(
      JSON.stringify([
        { name: 'Ada', meta: { role: 'math' }, tags: [{ label: 'x' }], age: 36 },
        { name: 'Grace', meta: { role: 'cs' }, tags: [], age: 85 },
      ]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.keys).toEqual(['name', 'meta.role', 'tags.label']);
      expect(r.config.label).toBe('Custom (2)');
      expect(r.config.displayFn(r.config.data[0])).toBe('Ada — math');
    }
  });
  test('rejects objects with no string fields', () => {
    const r = parseCustomDataset('[{"n": 1}, {"n": 2}]');
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain('string');
  });
  test('display falls back to JSON for objects whose display keys are empty', () => {
    const r = parseCustomDataset('[{"a": {"deep": "x"}}]');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.displayFn(r.config.data[0])).toBe('x');
  });
});
