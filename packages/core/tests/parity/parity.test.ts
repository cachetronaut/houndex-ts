/**
 * Cross-language parity vectors.
 *
 * `core-vectors.json` is the language-neutral contract: a set of inputs and the
 * exact outputs the core primitives must produce. This TypeScript test and the
 * Python core's parity test both load the same file and assert their
 * implementation reproduces every `expected` value, byte-for-byte. If the two
 * languages ever diverge, one of them fails here.
 *
 * Regenerate the committed vectors after an intentional change:
 *   UPDATE_PARITY=1 pnpm --filter @houndex/core test
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalJson, type JsonValue } from '../../src/canonicalJson.js';
import { type ComputeClaimIdInput, computeClaimId } from '../../src/identity.js';
import { edgeIdempotencyKey } from '../../src/schemas/edges.js';
import { canonicalizeUrl } from '../../src/schemas/url.js';

const VECTORS_PATH = fileURLToPath(new URL('./core-vectors.json', import.meta.url));

// ── Inputs: the canonical source of truth for what gets tested ──────────
// Neutral, synthetic data only. Edit these, then regenerate with UPDATE_PARITY=1.

const claimIdInputs: ComputeClaimIdInput[] = [
  {
    tenantId: 'primary',
    subject: 'Acme',
    claimText: 'Ships a hosted control plane',
    sourceUrl: 'https://example.com/docs/control-plane',
  },
  // Same logical claim, noisy input — must normalize to the same id as above.
  {
    tenantId: 'primary',
    subject: '  acme ',
    claimText: '  Ships a   hosted CONTROL plane ',
    sourceUrl: 'http://example.com/docs/control-plane/?utm_source=x#section',
  },
  // Different tenant — must differ.
  {
    tenantId: 'secondary',
    subject: 'Acme',
    claimText: 'Ships a hosted control plane',
    sourceUrl: 'https://example.com/docs/control-plane',
  },
];

const edgeInputs = [
  { srcId: 'claim:0000000000000001', dstId: 'claim:0000000000000002', kind: 'reinforces' },
  { srcId: 'claim:0000000000000001', dstId: 'claim:0000000000000002', kind: 'contradicts' },
];

const urlInputs = [
  'HTTPS://Example.COM/Docs/',
  'https://example.com/a?b=2&utm_source=x&a=1',
  'example.com/a',
  'http://example.com:80/a/',
];

const canonicalJsonInputs: JsonValue[] = [
  { b: 1, a: { y: 2, x: 3 }, z: [3, 1, 2] },
  {
    tenantId: 'primary',
    claimId: 'abcdef0123456789',
    subject: 'Acme',
    category: 'security',
    polarity: 'positive',
    nested: { c: true, a: null, b: 'x' },
  },
];

interface VectorCase<I, O> {
  input: I;
  expected: O;
}

interface CoreVectors {
  claimId: VectorCase<ComputeClaimIdInput, string>[];
  edgeIdempotencyKey: VectorCase<{ srcId: string; dstId: string; kind: string }, string>[];
  canonicalizeUrl: VectorCase<string, string>[];
  canonicalJson: VectorCase<JsonValue, string>[];
}

function generate(): CoreVectors {
  return {
    claimId: claimIdInputs.map((input) => ({ input, expected: computeClaimId(input) })),
    edgeIdempotencyKey: edgeInputs.map((input) => ({
      input,
      expected: edgeIdempotencyKey(input),
    })),
    canonicalizeUrl: urlInputs.map((input) => ({ input, expected: canonicalizeUrl(input) })),
    canonicalJson: canonicalJsonInputs.map((input) => ({ input, expected: canonicalJson(input) })),
  };
}

if (process.env.UPDATE_PARITY === '1' || !existsSync(VECTORS_PATH)) {
  writeFileSync(VECTORS_PATH, `${JSON.stringify(generate(), null, 2)}\n`);
}

const vectors = JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as CoreVectors;

describe('parity: computeClaimId', () => {
  it.each(vectors.claimId)('reproduces $expected', ({ input, expected }) => {
    expect(computeClaimId(input)).toBe(expected);
  });
});

describe('parity: edgeIdempotencyKey', () => {
  it.each(vectors.edgeIdempotencyKey)('reproduces $expected', ({ input, expected }) => {
    expect(edgeIdempotencyKey(input)).toBe(expected);
  });
});

describe('parity: canonicalizeUrl', () => {
  it.each(vectors.canonicalizeUrl)('$input -> $expected', ({ input, expected }) => {
    expect(canonicalizeUrl(input)).toBe(expected);
  });
});

describe('parity: canonicalJson', () => {
  it.each(vectors.canonicalJson)('reproduces canonical form', ({ input, expected }) => {
    expect(canonicalJson(input)).toBe(expected);
  });
});
