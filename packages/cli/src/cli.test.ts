import { computeClaimId } from '@houndex/core';
import { EvalFixtureSchema } from '@houndex/evals';
import { LocalStorageAdapter } from '@houndex/storage-local';
import { describe, expect, it } from 'vitest';
import { ask, type CommandDeps, doctor, evaluate, ingest, init, verify } from './commands.js';
import { defaultConfig, type HoundexConfig } from './config.js';
import { syntheticEmbedder } from './embedder.js';
import { buildAnswerEnvelope, buildClaim, type ClaimContent } from './engine.js';

const DIM = 64;

function config(): HoundexConfig {
  return { ...defaultConfig(), embedding: { provider: 'synthetic', dimensions: DIM } };
}

function deps(): CommandDeps {
  return {
    adapter: new LocalStorageAdapter(),
    config: config(),
    embedder: syntheticEmbedder(DIM),
    now: () => 1_700_000_000_000,
  };
}

function claim(overrides: Partial<ClaimContent> = {}): ClaimContent {
  return {
    subject: 'Acme',
    category: 'security',
    polarity: 'positive',
    scope: 'global',
    claimText: 'Has an audit log',
    evidenceText: 'evidence',
    confidence: 'stated',
    sourceUrl: 'https://example.com/security',
    sourceTier: 'tier_2',
    extractedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('embedder', () => {
  it('is deterministic, unit-length, and correctly sized', () => {
    const e = syntheticEmbedder(DIM);
    const a = e.embed('hello world');
    const b = e.embed('hello world');
    expect(a).toEqual(b);
    expect(a).toHaveLength(DIM);
    expect(Math.hypot(...a)).toBeCloseTo(1, 10);
    expect(e.embed('different')).not.toEqual(a);
  });
});

describe('init', () => {
  it('produces config content with the chosen adapter', () => {
    const r = init({ adapter: 'supabase', force: false, configExists: false });
    expect(r.code).toBe(0);
    expect(r.content).toBeDefined();
    expect(JSON.parse(r.content as string).adapter).toBe('supabase');
  });

  it('refuses to overwrite without --force (exit 2)', () => {
    const r = init({ force: false, configExists: true });
    expect(r.code).toBe(2);
    expect(r.content).toBeUndefined();
  });
});

describe('doctor', () => {
  it('passes for the local adapter', async () => {
    const cfg = config();
    const r = await doctor({
      config: cfg,
      env: {},
      connect: async () => new LocalStorageAdapter(),
    });
    expect(r.code).toBe(0);
  });

  it('fails when a remote adapter is missing env (exit 1)', async () => {
    const cfg: HoundexConfig = { ...config(), adapter: 'supabase' };
    const r = await doctor({
      config: cfg,
      env: {},
      connect: async () => new LocalStorageAdapter(),
    });
    expect(r.code).toBe(1);
    expect(r.output).toContain('SUPABASE_URL');
  });
});

describe('ingest + ask', () => {
  it('ingests claims and answers a query citing them, verdict PASS', async () => {
    const d = deps();
    const ing = await ingest(d, {
      claims: [claim(), claim({ claimText: 'Encrypts at rest' })],
      json: true,
    });
    expect(JSON.parse(ing.output)).toMatchObject({ created: 2, skipped: 0 });

    const res = await ask(d, { query: 'audit log', limit: 5, json: false });
    expect(res.code).toBe(0);
    expect(res.output).toContain('verdict: PASS');
    expect(res.output).toContain('citations:');
  });

  it('is idempotent — re-ingesting the same claim is skipped', async () => {
    const d = deps();
    await ingest(d, { claims: [claim()], json: false });
    const again = await ingest(d, { claims: [claim()], json: true });
    expect(JSON.parse(again.output)).toMatchObject({ created: 0, skipped: 1 });
  });
});

describe('verify', () => {
  it('PASSES an envelope whose citations resolve', async () => {
    const d = deps();
    const c = buildClaim(d.config.tenant.tenantId, claim());
    await d.adapter.upsertClaim({ tenant: d.config.tenant, claim: c });
    const envelope = buildAnswerEnvelope(d.config.tenant.tenantId, 'q', [c], 1);

    const r = await verify(d, { envelope, json: false });
    expect(r.code).toBe(0);
    expect(r.output).toContain('verdict: PASS');
  });

  it('FAILS (exit 1) an envelope citing an unknown claim', async () => {
    const d = deps();
    const envelope = buildAnswerEnvelope(d.config.tenant.tenantId, 'q', [], 1);
    envelope.trace.push({ claimId: 'deadbeefdeadbeef', mechanism: 'guess', semanticScore: null });

    const r = await verify(d, { envelope, json: false });
    expect(r.code).toBe(1);
    expect(r.output).toContain('verdict: FAIL');
  });

  it('FAILS (exit 1) a structurally invalid envelope', async () => {
    const d = deps();
    const r = await verify(d, { envelope: { not: 'an envelope' }, json: false });
    expect(r.code).toBe(1);
  });

  it('uses a self-contained claimIds universe when supplied', async () => {
    const d = deps(); // empty store
    const tenantId = d.config.tenant.tenantId;
    const claimId = computeClaimId({
      tenantId,
      subject: 'Acme',
      claimText: 'Has an audit log',
      sourceUrl: 'https://example.com/security',
    });
    const envelope = buildAnswerEnvelope(tenantId, 'q', [], 1);
    envelope.trace.push({ claimId, mechanism: 'vector_search', semanticScore: null });

    const r = await verify(d, { envelope, claimIds: [claimId], json: false });
    expect(r.code).toBe(0);
  });
});

describe('eval', () => {
  it('passes/fails on the --threshold gate', async () => {
    const d = deps();
    const c = buildClaim(d.config.tenant.tenantId, claim());
    const goodEnvelope = buildAnswerEnvelope(d.config.tenant.tenantId, 'q', [c], 1);
    const cases = [
      {
        fixture: EvalFixtureSchema.parse({ name: 'grounded', description: 'cites a known claim' }),
        envelope: goodEnvelope,
      },
    ];

    const pass = await evaluate(d, { cases, claimIds: [c.claimId], threshold: 0.5, json: true });
    expect(pass.code).toBe(0);
    expect(JSON.parse(pass.output).aggregate).toBeGreaterThanOrEqual(0.5);

    const fail = await evaluate(d, { cases, claimIds: [], threshold: 0.99, json: true });
    expect(fail.code).toBe(1);
  });
});
