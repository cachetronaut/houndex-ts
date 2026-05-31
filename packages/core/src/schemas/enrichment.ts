/**
 * Deterministic enrichment schemas. Every field is a stable numeric a
 * downstream judge can trust and re-verify against the graph; no LLM is in the
 * loop. The computation lives in the pipeline package.
 */

import { z } from 'zod';
import {
  CategorySchema,
  ConfidenceSchema,
  EdgeKindSchema,
  PolaritySchema,
  ScopeSchema,
  SourceTierSchema,
} from './taxonomy.js';

export const EnrichmentSchema = z.object({
  corroborationCount: z.record(EdgeKindSchema, z.number()).default({}),
  contradictionCount: z.number().default(0),
  sourceTierDistribution: z.record(SourceTierSchema, z.number()).default({}),
  sourceCount: z.number().default(0),
  semanticScore: z.number().nullable().default(null),
  viaStructuralEdge: z.boolean().default(false),
});
export type Enrichment = z.infer<typeof EnrichmentSchema>;

export const EnrichedClaimSchema = z.object({
  claimId: z.string(),
  claimText: z.string().min(1),
  evidenceText: z.string().min(1),
  subject: z.string().min(1),
  category: CategorySchema,
  polarity: PolaritySchema,
  scope: ScopeSchema,
  confidence: ConfidenceSchema,
  sourceTier: SourceTierSchema,
  sourceUrl: z.string().min(1),
  enrichment: EnrichmentSchema,
});
export type EnrichedClaim = z.infer<typeof EnrichedClaimSchema>;
