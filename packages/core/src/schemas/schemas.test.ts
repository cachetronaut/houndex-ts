import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { computeClaimId } from '../identity.js';
import { EdgeSchema, edgeIdempotencyKey } from './edges.js';
import {
  ENGINE_VERSION,
  ENVELOPE_SCHEMA_URL,
  ENVELOPE_SCHEMA_VERSION,
  outputEnvelopeSchema,
} from './envelope.js';
import { ClaimSchema } from './nodes.js';
import { CATEGORY_VALUES, DECISION_TO_EDGE_KIND } from './taxonomy.js';

describe('ClaimSchema', () => {
  const claim = {
    tenantId: 'primary',
    claimId: computeClaimId({
      tenantId: 'primary',
      subject: 'Acme',
      claimText: 'Has an audit log',
      sourceUrl: 'https://example.com/security',
    }),
    subject: 'Acme',
    category: 'security',
    polarity: 'positive',
    scope: 'global',
    claimText: 'Has an audit log',
    evidenceText: 'The product ships an immutable audit log.',
    confidence: 'stated',
    sourceUrl: 'https://example.com/security',
    sourceTier: 'tier_2',
    extractedAt: 1_700_000_000_000,
  };

  it('parses a well-formed claim', () => {
    expect(ClaimSchema.parse(claim).subject).toBe('Acme');
  });

  it('rejects a category outside the vocabulary', () => {
    expect(() => ClaimSchema.parse({ ...claim, category: 'market_share' })).toThrow();
  });

  it('rejects a malformed claimId', () => {
    expect(() => ClaimSchema.parse({ ...claim, claimId: 'nothex' })).toThrow();
  });
});

describe('taxonomy', () => {
  it('exposes a non-empty default category vocabulary', () => {
    expect(CATEGORY_VALUES.length).toBeGreaterThan(0);
  });

  it('maps reconciliation decisions to edge kinds, omitting new_claim', () => {
    expect(DECISION_TO_EDGE_KIND.reinforces_existing).toBe('reinforces');
    expect(DECISION_TO_EDGE_KIND).not.toHaveProperty('new_claim');
  });
});

describe('edgeIdempotencyKey', () => {
  it('is stable for the same triple and ignores attribute drift', () => {
    const firstKey = edgeIdempotencyKey({ srcId: 'claim:1', dstId: 'claim:2', kind: 'reinforces' });
    const secondKey = edgeIdempotencyKey({
      srcId: 'claim:1',
      dstId: 'claim:2',
      kind: 'reinforces',
    });
    expect(firstKey).toBe(secondKey);
    expect(firstKey).toMatch(/^[0-9a-f]{16}$/);
  });

  it('differs when the kind differs', () => {
    expect(edgeIdempotencyKey({ srcId: 'claim:1', dstId: 'claim:2', kind: 'reinforces' })).not.toBe(
      edgeIdempotencyKey({ srcId: 'claim:1', dstId: 'claim:2', kind: 'contradicts' }),
    );
  });

  it('accepts a valid edge', () => {
    expect(
      EdgeSchema.parse({
        tenantId: 'primary',
        srcId: 'claim:1',
        dstId: 'claim:2',
        kind: 'reinforces',
      }).attributes,
    ).toEqual({});
  });
});

describe('outputEnvelopeSchema', () => {
  const Envelope = outputEnvelopeSchema(z.object({ value: z.string() }));

  it('applies defaults for the self-describing fields', () => {
    const env = Envelope.parse({ tenantId: 'primary', generatedAt: 1, payload: { value: 'x' } });
    expect(env.schemaVersion).toBe(ENVELOPE_SCHEMA_VERSION);
    expect(env.schemaUrl).toBe(ENVELOPE_SCHEMA_URL);
    expect(env.engineVersion).toBe(ENGINE_VERSION);
    expect(env.trace).toEqual([]);
  });

  it('validates the payload against the supplied schema', () => {
    expect(() =>
      Envelope.parse({ tenantId: 'primary', generatedAt: 1, payload: { value: 1 } }),
    ).toThrow();
  });
});
