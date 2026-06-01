/**
 * Command handlers. Each is a pure-ish function over injected dependencies
 * (adapter, config, embedder) and already-parsed arguments, returning an exit
 * code + output string. The commander shell (`cli.ts`) does the I/O; these are
 * unit-tested directly against the in-memory local adapter.
 *
 * Exit-code convention: 0 = pass, 1 = a verification/check failure (CI signal),
 * 2 = operational error. `init` writes no file itself — it returns the content
 * for the shell to write — so it stays pure.
 */

import type { StorageAdapter, TenantContext } from 'houndex/core';
import { type EvalFixture, type FixtureResult, formatReport, scoreEnvelope } from 'houndex/evals';
import { missingEnv } from './adapterFactory.js';
import { type AdapterName, defaultConfig, type HoundexConfig } from './config.js';
import type { Embedder } from './embedder.js';
import {
  buildAnswerEnvelope,
  buildClaim,
  type ClaimContent,
  defaultVerifyFixture,
  resolveGraph,
} from './engine.js';

export interface CommandResult {
  code: number;
  output: string;
}

export interface CommandDeps {
  adapter: StorageAdapter;
  config: HoundexConfig;
  embedder: Embedder;
  now: () => number;
}

function tenantOf(config: HoundexConfig): TenantContext {
  return config.tenant;
}

// ── init ───────────────────────────────────────────────────────────────────

export function init(args: {
  adapter?: AdapterName;
  tenantId?: string;
  force: boolean;
  configExists: boolean;
}): CommandResult & { content?: string } {
  if (args.configExists && !args.force) {
    return { code: 2, output: 'houndex.config.json already exists — pass --force to overwrite.' };
  }
  const config = defaultConfig({ adapter: args.adapter, tenantId: args.tenantId });
  const content = `${JSON.stringify(config, null, 2)}\n`;
  return { code: 0, output: `Wrote houndex.config.json (adapter: ${config.adapter}).`, content };
}

// ── doctor ───────────────────────────────────────────────────────────────────

export async function doctor(opts: {
  config: HoundexConfig;
  env: NodeJS.ProcessEnv;
  connect: () => Promise<StorageAdapter>;
}): Promise<CommandResult> {
  const lines: string[] = [];
  let ok = true;
  lines.push(`✓ config valid (adapter: ${opts.config.adapter})`);

  const missing = missingEnv(opts.config.adapter, opts.env);
  if (missing.length > 0) {
    ok = false;
    lines.push(`✗ missing environment variables: ${missing.join(', ')}`);
  } else {
    lines.push('✓ required environment variables present');
    try {
      const adapter = await opts.connect();
      await adapter.ensureTenant({ tenant: tenantOf(opts.config) });
      lines.push(`✓ adapter reachable (ensureTenant for "${opts.config.tenant.tenantId}")`);
    } catch (err) {
      ok = false;
      lines.push(`✗ adapter unreachable: ${(err as Error).message}`);
    }
  }
  return { code: ok ? 0 : 1, output: lines.join('\n') };
}

// ── ingest ───────────────────────────────────────────────────────────────────

export async function ingest(
  deps: CommandDeps,
  args: { claims: readonly ClaimContent[]; json: boolean },
): Promise<CommandResult> {
  const tenant = tenantOf(deps.config);
  await deps.adapter.ensureTenant({ tenant });
  let created = 0;
  let skipped = 0;
  for (const content of args.claims) {
    const claim = buildClaim(tenant.tenantId, content);
    const embedding = deps.embedder.embed(claim.claimText);
    const result = await deps.adapter.upsertClaim({ tenant, claim, embedding });
    if (result.created) created++;
    else skipped++;
  }
  if (args.json) {
    return { code: 0, output: JSON.stringify({ created, skipped, total: args.claims.length }) };
  }
  return {
    code: 0,
    output: `Ingested ${args.claims.length} claim(s): ${created} created, ${skipped} already present.`,
  };
}

// ── ask ───────────────────────────────────────────────────────────────────

export async function ask(
  deps: CommandDeps,
  args: { query: string; limit: number; json: boolean },
): Promise<CommandResult> {
  const tenant = tenantOf(deps.config);
  const queryVector = deps.embedder.embed(args.query);
  const claims = await deps.adapter.searchClaims({ tenant, queryVector, limit: args.limit });
  const envelope = buildAnswerEnvelope(tenant.tenantId, args.query, claims, deps.now());
  const graph = await resolveGraph(deps.adapter, tenant);
  const score = scoreEnvelope(defaultVerifyFixture(), envelope, graph);

  if (args.json) {
    return { code: 0, output: JSON.stringify({ envelope, verdict: score }) };
  }
  const citations = claims.map((claim) => `  - ${claim.claimId}  ${claim.claimText}`).join('\n');
  const body = claims.length === 0 ? '(no matching claims)' : envelope.payload.answer;
  return {
    code: 0,
    output: [
      `answer: ${body}`,
      claims.length > 0 ? `citations:\n${citations}` : '',
      `verdict: ${score.passed ? 'PASS' : 'FAIL'} (score ${score.total.toFixed(3)})`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

// ── verify ───────────────────────────────────────────────────────────────────

export async function verify(
  deps: CommandDeps,
  args: { envelope?: unknown; claimIds?: readonly string[]; json: boolean },
): Promise<CommandResult> {
  const graph = await resolveGraph(deps.adapter, tenantOf(deps.config), args.claimIds);
  const score = scoreEnvelope(defaultVerifyFixture(), args.envelope, graph);
  const code = score.passed ? 0 : 1;
  if (args.json) return { code, output: JSON.stringify(score) };
  return {
    code,
    output: [
      `verdict: ${score.passed ? 'PASS' : 'FAIL'}`,
      `  traceResolution:  ${score.traceResolution.toFixed(3)}`,
      `  envelopeValidity: ${score.envelopeValidity.toFixed(3)}`,
      `  determinism:      ${score.determinism === null ? '—' : score.determinism.toFixed(3)}`,
      `  total:            ${score.total.toFixed(3)}`,
      ...score.notes.map((note) => `  · ${note}`),
    ].join('\n'),
  };
}

// ── eval ───────────────────────────────────────────────────────────────────

export async function evaluate(
  deps: CommandDeps,
  args: {
    cases: readonly { fixture: EvalFixture; envelope?: unknown }[];
    claimIds?: readonly string[];
    threshold?: number;
    json: boolean;
  },
): Promise<CommandResult> {
  const graph = await resolveGraph(deps.adapter, tenantOf(deps.config), args.claimIds);
  const results: FixtureResult[] = args.cases.map((evalCase) => ({
    name: evalCase.fixture.name,
    score: scoreEnvelope(evalCase.fixture, evalCase.envelope, graph),
  }));
  const aggregate =
    results.length === 0 ? 0 : results.reduce((acc, r) => acc + r.score.total, 0) / results.length;
  const belowThreshold = args.threshold !== undefined && aggregate < args.threshold;
  const code = belowThreshold ? 1 : 0;

  if (args.json) {
    return {
      code,
      output: JSON.stringify({
        aggregate,
        threshold: args.threshold ?? null,
        results: results.map((result) => ({ name: result.name, ...result.score })),
      }),
    };
  }
  const report = formatReport(results);
  const summary =
    `aggregate: ${aggregate.toFixed(3)}` +
    (args.threshold !== undefined
      ? ` (threshold ${args.threshold.toFixed(3)} — ${belowThreshold ? 'FAIL' : 'PASS'})`
      : '');
  return { code, output: `${report}\n${summary}` };
}
