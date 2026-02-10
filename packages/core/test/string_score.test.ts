import { describe, expect, test } from 'vitest';
import { string_score } from '../src/string_score';

describe('string_score', () => {
  describe('exact matches', () => {
    test('identical strings return 1', () => {
      expect(string_score('hello', 'hello')).toBe(1);
    });

    test('empty query returns 0', () => {
      expect(string_score('hello', '')).toBe(0);
    });
  });

  describe('partial matches', () => {
    test('prefix match scores higher than mid-string', () => {
      const prefix = string_score('hello world', 'h');
      const mid = string_score('hello world', 'e');
      expect(prefix).toBeGreaterThan(mid);
    });

    test('longer match scores higher', () => {
      const short = string_score('hello world', 'hel');
      const long = string_score('hello world', 'hello');
      expect(long).toBeGreaterThan(short);
    });

    test('consecutive characters score higher than scattered', () => {
      const consecutive = string_score('hello world', 'hel');
      const scattered = string_score('hello world', 'hlo');
      expect(consecutive).toBeGreaterThan(scattered);
    });
  });

  describe('no match', () => {
    test('completely unrelated returns 0 in strict mode', () => {
      expect(string_score('hello world', 'xyz')).toBe(0);
    });

    test('single unmatched char returns 0 in strict mode', () => {
      expect(string_score('hello world', 'hello wor1')).toBe(0);
    });
  });

  describe('case sensitivity', () => {
    test('case-insensitive matching works', () => {
      expect(string_score('Hello', 'h')).toBeGreaterThan(0);
    });

    test('exact case match gets bonus', () => {
      const upper = string_score('Hello', 'H');
      const lower = string_score('Hello', 'h');
      expect(upper).toBeGreaterThan(lower);
    });
  });

  describe('acronym bonus', () => {
    test('acronym scores well against full words', () => {
      const acronym = string_score('Hillsdale Michigan', 'HiMi');
      const partial = string_score('Hillsdale Michigan', 'Hills');
      expect(acronym).toBeGreaterThan(partial);
    });

    test('longer partial still beats short acronym', () => {
      const acronym = string_score('Hillsdale Michigan', 'HiMi');
      const longer = string_score('Hillsdale Michigan', 'Hillsd');
      expect(longer).toBeGreaterThan(acronym);
    });
  });

  describe('string length impact', () => {
    test('shorter strings score higher for same query', () => {
      const short = string_score('He', 'h');
      const long = string_score('Hello', 'h');
      expect(short).toBeGreaterThan(long);
    });
  });

  describe('fuzziness', () => {
    test('unmatched char returns 0 without fuzziness', () => {
      expect(string_score('hello world', 'hello wor1')).toBe(0);
    });

    test('unmatched char scores > 0 with fuzziness', () => {
      expect(string_score('hello world', 'hello wor1', 0.5)).toBeGreaterThan(0);
    });

    test('higher fuzziness is more tolerant', () => {
      const lowFuzzy = string_score('hello world', 'hxllo', 0.2);
      const highFuzzy = string_score('hello world', 'hxllo', 0.8);
      expect(highFuzzy).toBeGreaterThan(lowFuzzy);
    });
  });

  describe('pre-lowered query optimization', () => {
    test('passing lowerQuery produces same result', () => {
      const query = 'HeLLo';
      const without = string_score('hello world', query);
      const withLower = string_score('hello world', query, undefined, query.toLowerCase());
      expect(withLower).toBe(without);
    });

    test('works with fuzziness and lowerQuery', () => {
      const query = 'HxLLo';
      const without = string_score('hello world', query, 0.5);
      const withLower = string_score('hello world', query, 0.5, query.toLowerCase());
      expect(withLower).toBe(without);
    });
  });

  describe('consecutive bonus after fuzzy skip', () => {
    test('skipped char should not grant consecutive bonus to next match', () => {
      // "btn" vs "tsconfig.json": 'b' is not found (fuzzy skip), then 't' at
      // index 0 should NOT get the 0.7 consecutive bonus just because startAt
      // hasn't moved. This is a false positive — 't' is not consecutive with
      // any matched character.
      const tsconfig = string_score('tsconfig.json', 'btn', 0.2);
      const button = string_score('src/components/Button.tsx', 'btn', 0.2);
      // Button.tsx matches all 3 chars (b, t, n in "Button") — should outscore
      // tsconfig.json which misses 'b' entirely
      expect(button).toBeGreaterThan(tsconfig);
    });

    test('consecutive bonus still works for actually consecutive matches', () => {
      // "hel" vs "hello" — all chars found consecutively, should still get bonus
      const withFuzz = string_score('hello', 'hel', 0.2);
      const strict = string_score('hello', 'hel', 0);
      // Fuzzy with no skips should score the same as strict
      expect(withFuzz).toBe(strict);
    });

    test('genuine consecutive after a fuzzy skip is not penalized', () => {
      // "xbc" vs "abcd" — 'x' is skipped, then 'b','c' are genuinely
      // consecutive with each other. 'b' should NOT get consecutive bonus
      // (it follows a skip), but 'c' SHOULD (it follows matched 'b').
      const score = string_score('abcd', 'xbc', 0.5);
      expect(score).toBeGreaterThan(0);
      // Compare with "xbd" where 'b','d' are NOT consecutive
      const scattered = string_score('abcd', 'xbd', 0.5);
      expect(score).toBeGreaterThan(scattered);
    });
  });

  describe('first character bonus', () => {
    test('matching first character boosts score', () => {
      // Query starting with same letter as target gets +0.15 bonus
      const matchFirst = string_score('hello', 'ho');
      const noMatchFirst = string_score('hello', 'eo');
      expect(matchFirst).toBeGreaterThan(noMatchFirst);
    });
  });
});
