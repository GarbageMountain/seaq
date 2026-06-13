import { describe, expect, test } from 'vitest';
import { getProperty } from '../src/Seaq';

const testObj = {
  name: 'joe',
  age: 30,
  active: true,
  emails: [
    {
      email: 'joe@test.com',
      label: 'home',
      meta: {
        provider: 'test.com',
        confirmed: false,
      },
    },
    {
      email: 'joey@tester.com',
      label: 'home',
      meta: {
        provider: 'tester.com',
        confirmed: true,
      },
    },
  ],
  address: {
    line1: '1234 Main Street',
    line2: 'Vancouver BC',
    line3: 'V0V0V0',
  },
  tags: ['developer', 'admin'],
  extra: null,
  empty: undefined,
};

describe('getProperty', () => {
  describe('simple keys', () => {
    test('string value', () => {
      expect(getProperty(testObj, 'name')).toEqual(['joe']);
    });

    test('numeric value', () => {
      expect(getProperty(testObj, 'age')).toEqual(['30']);
    });

    test('boolean value', () => {
      expect(getProperty(testObj, 'active')).toEqual(['true']);
    });

    test('null value returns empty', () => {
      expect(getProperty(testObj, 'extra')).toEqual([]);
    });

    test('undefined value returns empty', () => {
      expect(getProperty(testObj, 'empty')).toEqual([]);
    });

    test('missing key returns empty', () => {
      expect(getProperty(testObj, 'nothing')).toEqual([]);
    });

    test('null object with a path returns empty', () => {
      expect(getProperty(null, 'name')).toEqual([]);
      expect(getProperty(undefined, 'a.b')).toEqual([]);
    });

    test('null entries inside traversed arrays are skipped', () => {
      const obj = { tags: [null, { name: 'admin' }, undefined] };
      expect(getProperty(obj, 'tags.name')).toEqual(['admin']);
    });
  });

  describe('dot notation (nested objects)', () => {
    test('one level deep', () => {
      expect(getProperty(testObj, 'address.line1')).toEqual(['1234 Main Street']);
    });

    test('object without remaining path stringifies to JSON', () => {
      expect(getProperty(testObj, 'address')).toEqual([
        '{"line1":"1234 Main Street","line2":"Vancouver BC","line3":"V0V0V0"}',
      ]);
    });
  });

  describe('array traversal', () => {
    test('walks into arrays to extract nested string values', () => {
      expect(getProperty(testObj, 'emails.email')).toEqual(['joe@test.com', 'joey@tester.com']);
    });

    test('deeply nested through arrays', () => {
      expect(getProperty(testObj, 'emails.meta.provider')).toEqual(['test.com', 'tester.com']);
    });

    test('boolean values inside arrays', () => {
      expect(getProperty(testObj, 'emails.meta.confirmed')).toEqual(['false', 'true']);
    });

    test('plain string array', () => {
      expect(getProperty(testObj, 'tags')).toEqual(['developer', 'admin']);
    });
  });

  describe('null path (leaf resolution)', () => {
    test('string leaf', () => {
      expect(getProperty('hello', null)).toEqual(['hello']);
    });

    test('number leaf', () => {
      expect(getProperty(42, null)).toEqual(['42']);
    });

    test('boolean leaf', () => {
      expect(getProperty(true, null)).toEqual(['true']);
    });

    test('object leaf stringifies to JSON', () => {
      expect(getProperty({ a: 1 }, null)).toEqual(['{"a":1}']);
    });

    test('null leaf returns empty', () => {
      expect(getProperty(null, null)).toEqual([]);
    });

    test('undefined leaf returns empty', () => {
      expect(getProperty(undefined, null)).toEqual([]);
    });
  });

  describe('accumulator', () => {
    test('appends to existing list', () => {
      const existing = ['already here'];
      getProperty(testObj, 'name', existing);
      expect(existing).toEqual(['already here', 'joe']);
    });
  });
});
