import { describe, expect, it } from 'vitest';
import { EvalFixtureSchema } from './fixture.js';
import { formatReport } from './report.js';
import { type EvalEnvelope, hashEnvelope, scoreEnvelope } from './rubric.js';

function envelope(claimIds: string[]): EvalEnvelope {
  return {
    schemaVersion: 'v1.0.0',
    schemaUrl: 'https://houndex.example/schemas/output_envelope.v1.json',
    tenantId: 'primary',
    generatedAt: 1_700_000_000_000,
    engineVersion: '0.1.0',
    trace: claimIds.map((claimId) => ({ claimId, mechanism: 'semantic', semanticScore: 0.9 })),
    payload: { value: 'x' },
  };
}

const fixture = EvalFixtureSchema.parse({ name: 'demo', description: 'a demo fixture' });

describe('scoreEnvelope', () => {
  it('scores full trace resolution and validity', () => {
    const score = scoreEnvelope(fixture, envelope(['a', 'b']), { claimIds: ['a', 'b', 'c'] });
    expect(score.traceResolution).toBe(1);
    expect(score.envelopeValidity).toBe(1);
    expect(score.passed).toBe(true);
  });

  it('penalizes unresolved trace claim ids', () => {
    const score = scoreEnvelope(fixture, envelope(['a', 'z']), { claimIds: ['a'] });
    expect(score.traceResolution).toBe(0.5);
  });

  it('flags an invalid envelope', () => {
    const score = scoreEnvelope(fixture, { not: 'an envelope' }, { claimIds: [] });
    expect(score.envelopeValidity).toBe(0);
    expect(score.passed).toBe(false);
  });

  it('skips determinism with no baseline, scores 1 on exact match', () => {
    const env = envelope(['a']);
    expect(scoreEnvelope(fixture, env, { claimIds: ['a'] }).determinism).toBeNull();
    const pinned = EvalFixtureSchema.parse({
      name: 'pinned',
      description: 'baseline pinned',
      rubric: { baselineHash: hashEnvelope(env) },
    });
    expect(scoreEnvelope(pinned, env, { claimIds: ['a'] }).determinism).toBe(1);
  });

  it('enforces minTraceEntries as a floor', () => {
    const strict = EvalFixtureSchema.parse({
      name: 'strict',
      description: 'needs trace',
      expected: { minTraceEntries: 2 },
    });
    expect(scoreEnvelope(strict, envelope(['a']), { claimIds: ['a'] }).passed).toBe(false);
  });
});

describe('hashEnvelope', () => {
  it('is stable regardless of key order', () => {
    expect(hashEnvelope({ a: 1, b: 2 })).toBe(hashEnvelope({ b: 2, a: 1 }));
  });
});

describe('formatReport', () => {
  it('renders a markdown table with a pass tally', () => {
    const score = scoreEnvelope(fixture, envelope(['a']), { claimIds: ['a'] });
    const report = formatReport([{ name: 'demo', score }]);
    expect(report).toContain('1/1 fixtures passed');
    expect(report).toContain('| demo |');
  });
});
