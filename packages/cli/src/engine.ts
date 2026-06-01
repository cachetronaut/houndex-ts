/**
 * Pure glue between parsed CLI input and the framework engine (core + evals).
 * No I/O, no process state — so every command's logic is unit-testable in memory.
 */

import {
  type Claim,
  ClaimSchema,
  computeClaimId,
  outputEnvelopeSchema,
  type StorageAdapter,
  type TenantContext,
} from 'houndex/core';
import { type EvalFixture, EvalFixtureSchema, type GraphState } from 'houndex/evals';
import { z } from 'zod';

/** `verify <file>` input: an answer envelope, optionally with a self-contained claim universe. */
export const VerifyFileSchema = z.object({
  envelope: z.unknown(),
  claimIds: z.array(z.string()).optional(),
});

/** `eval <file>` input: fixture + envelope cases, optionally with a self-contained claim universe. */
export const EvalFileSchema = z.object({
  claimIds: z.array(z.string()).optional(),
  cases: z.array(z.object({ fixture: EvalFixtureSchema, envelope: z.unknown() })),
});

/** Claim content as supplied to `ingest` — identity (tenantId, claimId) is derived. */
export const ClaimContentSchema = ClaimSchema.omit({ tenantId: true, claimId: true });
export type ClaimContent = z.infer<typeof ClaimContentSchema>;

/** Attach tenant + content-addressed id to supplied claim content. */
export function buildClaim(tenantId: string, content: ClaimContent): Claim {
  return {
    tenantId,
    claimId: computeClaimId({
      tenantId,
      subject: content.subject,
      claimText: content.claimText,
      sourceUrl: content.sourceUrl,
    }),
    ...content,
  };
}

/** Parse a claims file: a JSON array, or JSONL (one claim object per line). */
export function parseClaims(text: string, format: 'json' | 'jsonl'): ClaimContent[] {
  const rows: unknown[] =
    format === 'jsonl'
      ? text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => JSON.parse(line))
      : z.array(z.unknown()).parse(JSON.parse(text));
  return rows.map((row) => ClaimContentSchema.parse(row));
}

/** The CLI's extractive answer payload. */
export const AnswerPayloadSchema = z.object({
  query: z.string(),
  answer: z.string(),
  citations: z.array(z.string()),
});
const AnswerEnvelopeSchema = outputEnvelopeSchema(AnswerPayloadSchema);
export type AnswerEnvelope = z.infer<typeof AnswerEnvelopeSchema>;

/**
 * Build a verified-by-construction answer envelope from retrieved claims: the
 * answer is the concatenation of claim texts, each claim cited in the trace.
 */
export function buildAnswerEnvelope(
  tenantId: string,
  query: string,
  claims: readonly Claim[],
  generatedAt: number,
): AnswerEnvelope {
  return AnswerEnvelopeSchema.parse({
    tenantId,
    generatedAt,
    trace: claims.map((claim) => ({
      claimId: claim.claimId,
      mechanism: 'vector_search',
      semanticScore: null,
    })),
    payload: {
      query,
      answer: claims.map((claim) => claim.claimText).join(' '),
      citations: claims.map((claim) => claim.claimId),
    },
  });
}

/**
 * Default fixture for ad-hoc `verify`: floor `traceResolution` and
 * `envelopeValidity` at 1.0, so an answer that cites an unknown claim or fails
 * schema validation is a hard FAIL (the whole point of verification). No
 * baseline, so determinism is not scored.
 */
export function defaultVerifyFixture(): EvalFixture {
  return EvalFixtureSchema.parse({
    name: 'cli-verify',
    description: 'Ad-hoc CLI verification of a supplied answer envelope.',
    rubric: { floors: { traceResolution: 1, envelopeValidity: 1 } },
  });
}

/**
 * The known-claim universe a trace is checked against: an explicit id list when
 * the input file carries one (self-contained / ephemeral runs), else every claim
 * the configured store holds for the tenant.
 */
export async function resolveGraph(
  adapter: StorageAdapter,
  tenant: TenantContext,
  claimIds?: readonly string[],
): Promise<GraphState> {
  if (claimIds !== undefined) return { claimIds };
  const claims = await adapter.searchClaims({ tenant });
  return { claimIds: claims.map((claim) => claim.claimId) };
}
