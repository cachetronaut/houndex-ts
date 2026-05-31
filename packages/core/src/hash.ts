/**
 * Runtime-agnostic SHA-256. Uses `@noble/hashes` (pure JS) instead of
 * `node:crypto` so the same hashing logic runs in any JavaScript runtime —
 * Node, edge/serverless V8 isolates, and the test runner — and emits
 * byte-identical digests. Content-addressed IDs depend on this stability.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}
