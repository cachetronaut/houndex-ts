/**
 * Structured I/O schemas for the generic RAG agents. These are the contracts an
 * agent declares as its structured-output target, so a malformed model response
 * is a validation error rather than a downstream surprise.
 *
 * The extractor emits `ExtractedClaim` (without tenant/claim ids, subject, or
 * source fields — those are stamped from pipeline context after the call). The
 * full persisted shape is `ClaimSchema` (nodes.ts).
 */

import { z } from 'zod';
import {
  CategorySchema,
  ConfidenceSchema,
  PolaritySchema,
  ReconciliationDecisionSchema,
  ScopeSchema,
} from './taxonomy.js';

// ── search planner ────────────────────────────────────────────────────
export const SearchQuerySchema = z.object({
  query: z.string().min(1),
  intent: z.string().min(1),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchPlanSchema = z.object({
  subject: z.string().min(1),
  signalContext: z.string().nullable().optional(),
  queries: z.array(SearchQuerySchema).min(1).max(12),
});
export type SearchPlan = z.infer<typeof SearchPlanSchema>;

// ── claim extractor ───────────────────────────────────────────────────
export const ExtractedClaimSchema = z.object({
  category: CategorySchema,
  polarity: PolaritySchema,
  scope: ScopeSchema,
  claimText: z.string().min(1),
  evidenceText: z.string().min(1),
  confidence: ConfidenceSchema,
});
export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;

export const ExtractedClaimsSchema = z.object({
  claims: z.array(ExtractedClaimSchema),
});
export type ExtractedClaims = z.infer<typeof ExtractedClaimsSchema>;

// ── claim reconciler ──────────────────────────────────────────────────
export const ReconciliationResultSchema = z
  .object({
    decision: ReconciliationDecisionSchema,
    matchedClaimId: z
      .string()
      .regex(/^[0-9a-f]{16}$/)
      .nullable()
      .optional(),
    rationale: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    const hasMatch = value.matchedClaimId !== null && value.matchedClaimId !== undefined;
    if (value.decision === 'new_claim' && hasMatch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'new_claim must not carry matchedClaimId',
        path: ['matchedClaimId'],
      });
    }
    if (value.decision !== 'new_claim' && !hasMatch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value.decision} requires matchedClaimId`,
        path: ['matchedClaimId'],
      });
    }
  });
export type ReconciliationResult = z.infer<typeof ReconciliationResultSchema>;

// ── citation verifier ─────────────────────────────────────────────────
// Traffic-light grounding verdict for one assertion against its cited
// evidence: `green` fully grounded, `yellow` partially, `red`
// unsupported/contradicted.
export const VERDICT_VALUES = ['red', 'yellow', 'green'] as const;
export const VerdictSchema = z.enum(VERDICT_VALUES);
export type Verdict = z.infer<typeof VerdictSchema>;

export const CitationVerdictSchema = z.object({
  verdict: VerdictSchema,
  /** The cited quotes the verifier relied on (verbatim subset of the input). */
  evidence: z.array(z.string()).default([]),
  rationale: z.string().min(1),
});
export type CitationVerdict = z.infer<typeof CitationVerdictSchema>;
