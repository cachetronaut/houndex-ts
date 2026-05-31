import {
  type Claim,
  computeClaimId,
  type Edge,
  tenantPrimary,
  tenantSecondary,
} from '@houndex/core';
import { describe, expect, it } from 'vitest';
import { LocalStorageAdapter } from './localStorageAdapter.js';

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

describe('LocalStorageAdapter — claims', () => {
  it('upserts idempotently by claimId', async () => {
    const adapter = new LocalStorageAdapter();
    const tenant = tenantPrimary();
    const claim = makeClaim();
    expect((await adapter.upsertClaim({ tenant, claim })).created).toBe(true);
    expect((await adapter.upsertClaim({ tenant, claim })).created).toBe(false);
  });

  it('gets a claim back', async () => {
    const adapter = new LocalStorageAdapter();
    const tenant = tenantPrimary();
    const claim = makeClaim();
    await adapter.upsertClaim({ tenant, claim });
    expect((await adapter.getClaim({ tenant, claimId: claim.claimId }))?.claimText).toBe(
      claim.claimText,
    );
  });

  it('filters search by subject and category', async () => {
    const adapter = new LocalStorageAdapter();
    const tenant = tenantPrimary();
    await adapter.upsertClaim({ tenant, claim: makeClaim({ subject: 'Acme' }) });
    await adapter.upsertClaim({
      tenant,
      claim: makeClaim({ subject: 'Globex', claimText: 'different' }),
    });
    const acme = await adapter.searchClaims({ tenant, subject: 'Acme' });
    expect(acme).toHaveLength(1);
    expect(acme[0]?.subject).toBe('Acme');
  });

  it('orders search by vector similarity when a query vector is given', async () => {
    const adapter = new LocalStorageAdapter();
    const tenant = tenantPrimary();
    const near = makeClaim({ claimText: 'near', sourceUrl: 'https://example.com/near' });
    const far = makeClaim({ claimText: 'far', sourceUrl: 'https://example.com/far' });
    await adapter.upsertClaim({ tenant, claim: far, embedding: [0, 1] });
    await adapter.upsertClaim({ tenant, claim: near, embedding: [1, 0] });
    const results = await adapter.searchClaims({ tenant, queryVector: [1, 0] });
    expect(results[0]?.claimId).toBe(near.claimId);
  });
});

describe('LocalStorageAdapter — tenant isolation', () => {
  it('never returns another tenant’s records', async () => {
    const adapter = new LocalStorageAdapter();
    const primary = tenantPrimary();
    const secondary = tenantSecondary();
    const claim = makeClaim({ tenantId: 'primary' });
    await adapter.upsertClaim({ tenant: primary, claim });

    expect(await adapter.getClaim({ tenant: secondary, claimId: claim.claimId })).toBeNull();
    expect(await adapter.searchClaims({ tenant: secondary })).toHaveLength(0);
    expect(await adapter.searchClaims({ tenant: primary })).toHaveLength(1);
  });
});

describe('LocalStorageAdapter — runs, edges, curation, kb, overrides', () => {
  it('tracks run lifecycle', async () => {
    const adapter = new LocalStorageAdapter();
    const tenant = tenantPrimary();
    const run = await adapter.createRun({ tenant, runId: 'r1', subject: 'Acme' });
    expect(run.status).toBe('running');
    await adapter.completeRun({ tenant, runId: 'r1' });
    // completing a missing run is a no-op (no throw)
    await adapter.failRun({ tenant, runId: 'missing' });
  });

  it('upserts edges idempotently', async () => {
    const adapter = new LocalStorageAdapter();
    const tenant = tenantPrimary();
    const edge: Edge = {
      tenantId: 'primary',
      srcId: 'claim:0000000000000001',
      dstId: 'claim:0000000000000002',
      kind: 'reinforces',
      attributes: {},
    };
    expect((await adapter.upsertEdge({ tenant, edge })).created).toBe(true);
    expect((await adapter.upsertEdge({ tenant, edge })).created).toBe(false);
  });

  it('runs the curation and kb flow', async () => {
    const adapter = new LocalStorageAdapter();
    const tenant = tenantPrimary();
    const claim = makeClaim();
    await adapter.createCurationSuggestion({ tenant, suggestionId: 's1', claim });
    await adapter.decideSuggestion({ tenant, suggestionId: 's1', status: 'approved' });
    await adapter.upsertKbEntry({ tenant, entryId: 'e1', claim, action: 'approved' });
    const entries = await adapter.listKbEntries({ tenant, subject: 'Acme' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe('approved');
  });

  it('records verification overrides without throwing', async () => {
    const adapter = new LocalStorageAdapter();
    const tenant = tenantPrimary();
    await adapter.recordVerificationOverride({
      tenant,
      claimId: 'abcdef0123456789',
      verdict: 'green',
      reason: 'manually verified',
    });
  });
});
