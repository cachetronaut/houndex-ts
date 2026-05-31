/**
 * Generic `OutputEnvelope` rubric. Pure, in-process, deterministic. Scores an
 * envelope on three domain-agnostic dimensions:
 *
 *  - **traceResolution** — every claim id in the envelope's provenance trace
 *    resolves to a known claim in the supplied graph state.
 *  - **envelopeValidity** — the value round-trips through the base
 *    `OutputEnvelope` schema.
 *  - **determinism** — canonical-JSON hash vs. the fixture's baseline; on
 *    mismatch, falls back to a Jaccard over `requiredClaimIds`. No baseline ⇒
 *    sub-score is `null` and the weight renormalizes across the rest.
 */

import { canonicalJson, type JsonValue, outputEnvelopeSchema, sha256Hex } from '@houndex/core';
import { z } from 'zod';
import type { EvalFixture } from './fixture.js';

const BaseEnvelopeSchema = outputEnvelopeSchema(z.unknown());
export type EvalEnvelope = z.infer<typeof BaseEnvelopeSchema>;

/** The known-claim universe a trace is checked against. */
export interface GraphState {
  claimIds: readonly string[];
}

export const SUB_SCORE_NAMES = ['traceResolution', 'envelopeValidity', 'determinism'] as const;
export type SubScoreName = (typeof SUB_SCORE_NAMES)[number];

export const DEFAULT_WEIGHTS: Readonly<Record<SubScoreName, number>> = {
  traceResolution: 1 / 3,
  envelopeValidity: 1 / 3,
  determinism: 1 / 3,
};

export interface RubricScore {
  traceResolution: number;
  envelopeValidity: number;
  determinism: number | null;
  total: number;
  passed: boolean;
  notes: string[];
}

/** Canonical-JSON SHA-256 of any JSON-serializable value, prefixed `sha256:`. */
export function hashEnvelope(envelope: unknown): string {
  return `sha256:${sha256Hex(canonicalJson(envelope as JsonValue))}`;
}

function traceClaimIds(envelope: EvalEnvelope): string[] {
  return envelope.trace.map((entry) => entry.claimId);
}

export function scoreTraceResolution(
  envelope: EvalEnvelope,
  graph: GraphState,
): { score: number; note: string } {
  const cited = traceClaimIds(envelope);
  if (cited.length === 0) return { score: 1, note: 'no trace entries to resolve' };
  const known = new Set(graph.claimIds);
  const resolved = cited.filter((id) => known.has(id));
  return {
    score: resolved.length / cited.length,
    note: `${resolved.length}/${cited.length} trace claim ids resolve in the graph`,
  };
}

export function scoreEnvelopeValidity(envelope: unknown): {
  score: number;
  note: string;
  parsed: EvalEnvelope | null;
} {
  const result = BaseEnvelopeSchema.safeParse(envelope);
  return result.success
    ? { score: 1, note: 'envelope round-trips through the base schema', parsed: result.data }
    : {
        score: 0,
        note: `envelope failed schema: ${result.error.issues[0]?.message ?? 'unknown'}`,
        parsed: null,
      };
}

export function scoreDeterminism(
  envelope: EvalEnvelope,
  fixture: EvalFixture,
): { score: number | null; note: string } {
  const baseline = fixture.rubric.baselineHash;
  if (baseline === undefined) return { score: null, note: 'no baseline hash — sub-score skipped' };
  if (hashEnvelope(envelope) === baseline) {
    return { score: 1, note: 'envelope hash matches baseline exactly' };
  }
  const required = new Set(fixture.expected.requiredClaimIds);
  if (required.size === 0)
    return { score: 0, note: 'hash drift; no requiredClaimIds to fall back on' };
  const cited = new Set(traceClaimIds(envelope));
  const intersection = [...required].filter((id) => cited.has(id)).length;
  const union = new Set([...required, ...cited]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  return {
    score: jaccard,
    note: `hash drift; jaccard over requiredClaimIds = ${jaccard.toFixed(3)}`,
  };
}

export function scoreEnvelope(
  fixture: EvalFixture,
  envelope: unknown,
  graph: GraphState,
): RubricScore {
  const val = scoreEnvelopeValidity(envelope);
  // Resolution + determinism need a parsed envelope; if invalid, they score 0.
  const parsed = val.parsed;
  const res = parsed
    ? scoreTraceResolution(parsed, graph)
    : { score: 0, note: 'skipped — envelope invalid' };
  const det = parsed
    ? scoreDeterminism(parsed, fixture)
    : { score: 0 as number | null, note: 'skipped — envelope invalid' };

  const measured: Partial<Record<SubScoreName, number>> = {
    traceResolution: res.score,
    envelopeValidity: val.score,
    ...(det.score === null ? {} : { determinism: det.score }),
  };

  const weights = { ...DEFAULT_WEIGHTS, ...fixture.rubric.weights };
  const totalWeight = (Object.keys(measured) as SubScoreName[]).reduce(
    (acc, key) => acc + (weights[key] ?? 0),
    0,
  );
  const total =
    totalWeight === 0
      ? 0
      : (Object.entries(measured) as [SubScoreName, number][]).reduce(
          (acc, [key, score]) => acc + score * (weights[key] ?? 0),
          0,
        ) / totalWeight;

  const floors = fixture.rubric.floors;
  const failures: string[] = [];
  for (const [key, score] of Object.entries(measured) as [SubScoreName, number][]) {
    const floor = floors[key] ?? 0;
    if (score < floor) failures.push(`${key}: ${score.toFixed(3)} < floor ${floor.toFixed(3)}`);
  }
  // Validity is a hard gate: a malformed envelope always fails, regardless of
  // floors (the other sub-scores aren't trustworthy on an invalid envelope).
  if (val.score === 0) failures.push('envelope failed schema validation');
  const traceCount = parsed ? parsed.trace.length : 0;
  if (traceCount < fixture.expected.minTraceEntries) {
    failures.push(`trace entries ${traceCount} < min ${fixture.expected.minTraceEntries}`);
  }

  return {
    traceResolution: res.score,
    envelopeValidity: val.score,
    determinism: det.score,
    total,
    passed: failures.length === 0,
    notes: [
      `traceResolution: ${res.note}`,
      `envelopeValidity: ${val.note}`,
      `determinism: ${det.note}`,
      ...(failures.length > 0 ? [`failures: ${failures.join('; ')}`] : []),
    ],
  };
}
