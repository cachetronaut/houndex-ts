/**
 * Content hashing + canonical-URL dedupe. The content hash keys idempotent
 * pipeline steps (re-processing identical text is a no-op); the dedupe pass is
 * unique-by-canonical-URL preserving first-seen order.
 */

import { canonicalizeUrl, sha256Hex } from '@houndex/core';

export function contentHash(text: string): string {
  return sha256Hex(text);
}

export interface UrlBearing {
  url: string;
}

/** Unique-by-canonical-URL, preserving first-seen order. */
export function dedupeByUrl<T extends UrlBearing>(results: readonly T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const result of results) {
    const key = canonicalizeUrl(result.url);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(result);
  }
  return unique;
}
