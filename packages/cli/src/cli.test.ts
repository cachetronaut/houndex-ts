import { computeClaimId } from 'houndex/core';
import { EvalFixtureSchema } from 'houndex/evals';
import { LocalStorageAdapter } from 'houndex/storage/local';
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
    const embedder = syntheticEmbedder(DIM);
    const firstVector = embedder.embed('hello world');
    const secondVector = embedder.embed('hello world');
    expect(firstVector).toEqual(secondVector);
    expect(firstVector).toHaveLength(DIM);
    expect(Math.hypot(...firstVector)).toBeCloseTo(1, 10);
    expect(embedder.embed('different')).not.toEqual(firstVector);
  });
});

describe('init', () => {
  it('produces config content with the chosen adapter', () => {
    const result = init({ adapter: 'supabase', force: false, configExists: false });
    expect(result.code).toBe(0);
    expect(result.content).toBeDefined();
    expect(JSON.parse(result.content as string).adapter).toBe('supabase');
  });

  it('refuses to overwrite without --force (exit 2)', () => {
    const result = init({ force: false, configExists: true });
    expect(result.code).toBe(2);
    expect(result.content).toBeUndefined();
  });
});

describe('doctor', () => {
  it('passes for the local adapter', async () => {
    const houndexConfig = config();
    const result = await doctor({
      config: houndexConfig,
      env: {},
      connect: async () => new LocalStorageAdapter(),
    });
    expect(result.code).toBe(0);
  });

  it('fails when a remote adapter is missing env (exit 1)', async () => {
    const houndexConfig: HoundexConfig = { ...config(), adapter: 'supabase' };
    const result = await doctor({
      config: houndexConfig,
      env: {},
      connect: async () => new LocalStorageAdapter(),
    });
    expect(result.code).toBe(1);
    expect(result.output).toContain('SUPABASE_URL');
  });
});

describe('ingest + ask', () => {
  it('ingests claims and answers a query citing them, verdict PASS', async () => {
    const commandDeps = deps();
    const ingestResult = await ingest(commandDeps, {
      claims: [claim(), claim({ claimText: 'Encrypts at rest' })],
      json: true,
    });
    expect(JSON.parse(ingestResult.output)).toMatchObject({ created: 2, skipped: 0 });

    const askResult = await ask(commandDeps, { query: 'audit log', limit: 5, json: false });
    expect(askResult.code).toBe(0);
    expect(askResult.output).toContain('verdict: PASS');
    expect(askResult.output).toContain('citations:');
  });

  it('is idempotent — re-ingesting the same claim is skipped', async () => {
    const commandDeps = deps();
    await ingest(commandDeps, { claims: [claim()], json: false });
    const again = await ingest(commandDeps, { claims: [claim()], json: true });
    expect(JSON.parse(again.output)).toMatchObject({ created: 0, skipped: 1 });
  });
});

describe('verify', () => {
  it('PASSES an envelope whose citations resolve', async () => {
    const commandDeps = deps();
    const builtClaim = buildClaim(commandDeps.config.tenant.tenantId, claim());
    await commandDeps.adapter.upsertClaim({ tenant: commandDeps.config.tenant, claim: builtClaim });
    const envelope = buildAnswerEnvelope(commandDeps.config.tenant.tenantId, 'q', [builtClaim], 1);

    const result = await verify(commandDeps, { envelope, json: false });
    expect(result.code).toBe(0);
    expect(result.output).toContain('verdict: PASS');
  });

  it('FAILS (exit 1) an envelope citing an unknown claim', async () => {
    const commandDeps = deps();
    const envelope = buildAnswerEnvelope(commandDeps.config.tenant.tenantId, 'q', [], 1);
    envelope.trace.push({ claimId: 'deadbeefdeadbeef', mechanism: 'guess', semanticScore: null });

    const result = await verify(commandDeps, { envelope, json: false });
    expect(result.code).toBe(1);
    expect(result.output).toContain('verdict: FAIL');
  });

  it('FAILS (exit 1) a structurally invalid envelope', async () => {
    const commandDeps = deps();
    const result = await verify(commandDeps, { envelope: { not: 'an envelope' }, json: false });
    expect(result.code).toBe(1);
  });

  it('uses a self-contained claimIds universe when supplied', async () => {
    const commandDeps = deps(); // empty store
    const tenantId = commandDeps.config.tenant.tenantId;
    const claimId = computeClaimId({
      tenantId,
      subject: 'Acme',
      claimText: 'Has an audit log',
      sourceUrl: 'https://example.com/security',
    });
    const envelope = buildAnswerEnvelope(tenantId, 'q', [], 1);
    envelope.trace.push({ claimId, mechanism: 'vector_search', semanticScore: null });

    const result = await verify(commandDeps, { envelope, claimIds: [claimId], json: false });
    expect(result.code).toBe(0);
  });
});

describe('eval', () => {
  it('passes/fails on the --threshold gate', async () => {
    const commandDeps = deps();
    const builtClaim = buildClaim(commandDeps.config.tenant.tenantId, claim());
    const goodEnvelope = buildAnswerEnvelope(
      commandDeps.config.tenant.tenantId,
      'q',
      [builtClaim],
      1,
    );
    const cases = [
      {
        fixture: EvalFixtureSchema.parse({ name: 'grounded', description: 'cites a known claim' }),
        envelope: goodEnvelope,
      },
    ];

    const pass = await evaluate(commandDeps, {
      cases,
      claimIds: [builtClaim.claimId],
      threshold: 0.5,
      json: true,
    });
    expect(pass.code).toBe(0);
    expect(JSON.parse(pass.output).aggregate).toBeGreaterThanOrEqual(0.5);

    const fail = await evaluate(commandDeps, { cases, claimIds: [], threshold: 0.99, json: true });
    expect(fail.code).toBe(1);
  });
});
