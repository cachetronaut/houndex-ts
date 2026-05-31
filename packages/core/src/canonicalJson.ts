/**
 * Canonical JSON serialization — deterministic, key-sorted output so the same
 * logical value always produces the same bytes. This is the basis for stable
 * content hashing, regression fixtures, and cross-language parity (a Python
 * implementation following the same rules produces identical bytes).
 *
 * Rules:
 *  - object keys are sorted lexicographically (by UTF-16 code unit, matching
 *    JavaScript's default string comparison)
 *  - arrays preserve order
 *  - `undefined` object values are omitted (same as `JSON.stringify`)
 *  - no insignificant whitespace
 *  - non-finite numbers are rejected (they have no portable JSON form)
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export function canonicalJson(value: JsonValue): string {
  if (value === null) return 'null';

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`canonicalJson: non-finite number is not serializable: ${value}`);
    }
    return JSON.stringify(value);
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJson(value[key] as JsonValue)}`,
  );
  return `{${entries.join(',')}}`;
}
