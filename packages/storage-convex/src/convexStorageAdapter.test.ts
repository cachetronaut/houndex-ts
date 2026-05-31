import { type Claim, computeClaimId } from '@houndex/core';
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import schema from '../convex/schema.js';
import { type ConvexClientLike, ConvexStorageAdapter } from './convexStorageAdapter.js';

// Glob the Convex function modules so convex-test can load them in-memory.
const modules = import.meta.glob('../convex/**/*.ts');

function tenant(id = 'primary') {
  return { tenantId: id, userId: `user_${id}`, role: 'admin' as const };
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  const subject = overrides.subject ?? 'Acme';
  const claimText = overrides.claimText ?? 'Has an audit log';
  const sourceUrl = overrides.sourceUrl ?? 'https://example.com/security';
  const tenantId = overrides.tenantId ?? 'primary';
  return {
    tenantId,
    claimId: computeClaimId({ tenantId, subject, claimText, sourceUrl }),
    subject,
    category: 'security',
    polarity: 'positive',
    scope: 'global',
    claimText,
    evidenceText: 'evidence',
    confidence: 'stated',
    sourceUrl,
    sourceTier: 'tier_2',
    extractedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeAdapter(): ConvexStorageAdapter {
  const t = convexTest(schema, modules);
  return new ConvexStorageAdapter(t as unknown as ConvexClientLike);
}

// A deterministic 1536-d (the schema's vector dimension) unit vector that leans
// on dimension `seed`, so two different seeds are far apart in cosine space.
function unitVector(seed: number): number[] {
  const raw = Array.from({ length: 1536 }, (_, i) => (i === seed % 1536 ? 1 : 0.01));
  const norm = Math.sqrt(raw.reduce((acc, x) => acc + x * x, 0));
  return raw.map((x) => x / norm);
}

describe('ConvexStorageAdapter', () => {
  it('upserts claims idempotently and reads them back', async () => {
    const adapter = makeAdapter();
    await adapter.ensureTenant({ tenant: tenant() });
    const claim = makeClaim();
    expect((await adapter.upsertClaim({ tenant: tenant(), claim })).created).toBe(true);
    expect((await adapter.upsertClaim({ tenant: tenant(), claim })).created).toBe(false);
    const got = await adapter.getClaim({ tenant: tenant(), claimId: claim.claimId });
    expect(got?.subject).toBe('Acme');
  });

  it('filters search by subject', async () => {
    const adapter = makeAdapter();
    await adapter.upsertClaim({ tenant: tenant(), claim: makeClaim({ subject: 'Acme' }) });
    await adapter.upsertClaim({
      tenant: tenant(),
      claim: makeClaim({ subject: 'Globex', claimText: 'other' }),
    });
    const acme = await adapter.searchClaims({ tenant: tenant(), subject: 'Acme' });
    expect(acme).toHaveLength(1);
    expect(acme[0]?.subject).toBe('Acme');
  });

  it('orders vector search by cosine similarity via the action', async () => {
    const adapter = makeAdapter();
    const near = makeClaim({ claimText: 'near' });
    const far = makeClaim({ claimText: 'far' });
    await adapter.upsertClaim({ tenant: tenant(), claim: near, embedding: unitVector(0) });
    await adapter.upsertClaim({ tenant: tenant(), claim: far, embedding: unitVector(7) });
    const results = await adapter.searchClaims({
      tenant: tenant(),
      queryVector: unitVector(0),
      limit: 2,
    });
    expect(results.map((c) => c.claimId)).toEqual([near.claimId, far.claimId]);
  });

  it('vector search stays scoped to the tenant', async () => {
    const adapter = makeAdapter();
    await adapter.upsertClaim({
      tenant: tenant('primary'),
      claim: makeClaim({ tenantId: 'primary' }),
      embedding: unitVector(0),
    });
    expect(
      await adapter.searchClaims({ tenant: tenant('secondary'), queryVector: unitVector(0) }),
    ).toHaveLength(0);
  });

  it('never returns another tenant’s records', async () => {
    const adapter = makeAdapter();
    const claim = makeClaim({ tenantId: 'primary' });
    await adapter.upsertClaim({ tenant: tenant('primary'), claim });
    expect(
      await adapter.getClaim({ tenant: tenant('secondary'), claimId: claim.claimId }),
    ).toBeNull();
    expect(await adapter.searchClaims({ tenant: tenant('secondary') })).toHaveLength(0);
    expect(await adapter.searchClaims({ tenant: tenant('primary') })).toHaveLength(1);
  });

  it('runs the run / edge / curation / kb / override flows', async () => {
    const adapter = makeAdapter();
    const run = await adapter.createRun({ tenant: tenant(), runId: 'r1', subject: 'Acme' });
    expect(run.status).toBe('running');
    await adapter.completeRun({ tenant: tenant(), runId: 'r1' });

    expect(
      (
        await adapter.upsertEdge({
          tenant: tenant(),
          edge: {
            tenantId: 'primary',
            srcId: 'claim:0000000000000001',
            dstId: 'claim:0000000000000002',
            kind: 'reinforces',
            attributes: {},
          },
        })
      ).created,
    ).toBe(true);

    const claim = makeClaim();
    await adapter.createCurationSuggestion({ tenant: tenant(), suggestionId: 's1', claim });
    await adapter.decideSuggestion({ tenant: tenant(), suggestionId: 's1', status: 'approved' });
    await adapter.upsertKbEntry({ tenant: tenant(), entryId: 'e1', claim, action: 'approved' });
    const entries = await adapter.listKbEntries({ tenant: tenant(), subject: 'Acme' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe('approved');

    await adapter.recordVerificationOverride({
      tenant: tenant(),
      claimId: claim.claimId,
      verdict: 'green',
      reason: 'verified',
    });
  });
});
