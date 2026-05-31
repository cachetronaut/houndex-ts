/**
 * Live integration tests against a real Supabase (Postgres + pgvector).
 *
 * Skipped unless `SUPABASE_URL` and a service-role key are set. To run locally:
 *
 *   supabase start                       # in the repo root, boots local stack
 *   supabase db reset                    # applies supabase/migrations/*.sql
 *   export SUPABASE_URL=http://127.0.0.1:54321
 *   export SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase start`>
 *   pnpm --filter @houndex/storage-supabase test
 *
 * The service-role key bypasses row-level security; the adapter still filters
 * every query by `tenantId`, so isolation is exercised on that path. Each run
 * uses a unique tenant namespace so repeated runs against a persistent database
 * stay independent.
 */

import { randomUUID } from 'node:crypto';
import { type Claim, computeClaimId, type Edge, type TenantContext } from '@houndex/core';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseLike } from './client.js';
import { SupabaseStorageAdapter } from './supabaseStorageAdapter.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
const live = Boolean(url && key);

const EMBEDDING_DIM = 1536;

function tenant(suffix: string): TenantContext {
  return {
    tenantId: `it-${randomUUID().replace(/-/g, '')}-${suffix}`,
    userId: 'integration',
    role: 'admin',
  };
}

function unitVector(seed: number): number[] {
  const components = Array.from({ length: EMBEDDING_DIM }, (_, index) =>
    index === seed % EMBEDDING_DIM ? 1 : 0.01,
  );
  const magnitude = Math.sqrt(
    components.reduce((sum, component) => sum + component * component, 0),
  );
  return components.map((component) => component / magnitude);
}

function makeClaim(tenantId: string, overrides: Partial<Claim> = {}): Claim {
  const subject = overrides.subject ?? 'Acme';
  const claimText = overrides.claimText ?? 'Has an audit log';
  const sourceUrl = overrides.sourceUrl ?? `https://example.com/${randomUUID()}`;
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

describe.skipIf(!live)('SupabaseStorageAdapter (live)', () => {
  let adapter: SupabaseStorageAdapter;

  beforeAll(async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url as string, key as string);
    adapter = new SupabaseStorageAdapter(client as unknown as SupabaseLike);
  });

  it('upserts claims idempotently and reads them back', async () => {
    const tenantContext = tenant('a');
    await adapter.ensureTenant({ tenant: tenantContext });
    const claim = makeClaim(tenantContext.tenantId);
    expect((await adapter.upsertClaim({ tenant: tenantContext, claim })).created).toBe(true);
    expect((await adapter.upsertClaim({ tenant: tenantContext, claim })).created).toBe(false);
    expect(
      (await adapter.getClaim({ tenant: tenantContext, claimId: claim.claimId }))?.subject,
    ).toBe('Acme');
  });

  it('never returns another tenant’s records', async () => {
    const owner = tenant('owner');
    const intruder = tenant('intruder');
    const claim = makeClaim(owner.tenantId);
    await adapter.upsertClaim({ tenant: owner, claim });
    expect(await adapter.getClaim({ tenant: intruder, claimId: claim.claimId })).toBeNull();
    expect(await adapter.searchClaims({ tenant: intruder })).toHaveLength(0);
    expect(await adapter.searchClaims({ tenant: owner })).toHaveLength(1);
  });

  it('orders vector search by cosine distance via the rpc', async () => {
    const tenantContext = tenant('vec');
    const near = makeClaim(tenantContext.tenantId, { claimText: 'near' });
    const far = makeClaim(tenantContext.tenantId, { claimText: 'far' });
    await adapter.upsertClaim({ tenant: tenantContext, claim: near, embedding: unitVector(0) });
    await adapter.upsertClaim({ tenant: tenantContext, claim: far, embedding: unitVector(7) });
    const results = await adapter.searchClaims({
      tenant: tenantContext,
      queryVector: unitVector(0),
      limit: 2,
    });
    expect(results.map((claim) => claim.claimId)).toEqual([near.claimId, far.claimId]);
  });

  it('runs the run / edge / curation / kb / override flows', async () => {
    const tenantContext = tenant('flow');
    const run = await adapter.createRun({ tenant: tenantContext, runId: 'r1', subject: 'Acme' });
    expect(run.status).toBe('running');
    await adapter.completeRun({ tenant: tenantContext, runId: 'r1' });

    const edge: Edge = {
      tenantId: tenantContext.tenantId,
      srcId: 'claim:0000000000000001',
      dstId: 'claim:0000000000000002',
      kind: 'reinforces',
      attributes: {},
    };
    expect((await adapter.upsertEdge({ tenant: tenantContext, edge })).created).toBe(true);
    expect((await adapter.upsertEdge({ tenant: tenantContext, edge })).created).toBe(false);

    const claim = makeClaim(tenantContext.tenantId);
    await adapter.createCurationSuggestion({ tenant: tenantContext, suggestionId: 's1', claim });
    await adapter.decideSuggestion({
      tenant: tenantContext,
      suggestionId: 's1',
      status: 'approved',
    });
    await adapter.upsertKbEntry({
      tenant: tenantContext,
      entryId: 'e1',
      claim,
      action: 'approved',
    });
    const entries = await adapter.listKbEntries({ tenant: tenantContext, subject: 'Acme' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe('approved');

    await adapter.recordVerificationOverride({
      tenant: tenantContext,
      claimId: claim.claimId,
      verdict: 'green',
      reason: 'verified',
    });
  });
});
