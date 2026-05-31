import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonicalJson.js';

describe('canonicalJson', () => {
  it('sorts object keys lexicographically', () => {
    expect(canonicalJson({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
  });

  it('is independent of key insertion order', () => {
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe(
      canonicalJson({ a: { x: 3, y: 2 }, z: 1 }),
    );
  });

  it('preserves array order', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('omits undefined object values', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('serializes null and booleans', () => {
    expect(canonicalJson({ a: null, b: true })).toBe('{"a":null,"b":true}');
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalJson({ a: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => canonicalJson(Number.NaN)).toThrow();
  });
});
