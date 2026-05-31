/**
 * Closed vocabularies for the claim graph — the single source of truth for
 * every enum that crosses an agent, provider, or store boundary. Declaring a
 * vocabulary once (as a value array) and deriving both the Zod schema and the
 * TypeScript type from it keeps the values from drifting into duplicated string
 * literals.
 *
 * `CATEGORY_VALUES` is the one vocabulary applications are expected to replace
 * with their own domain categories. It ships as a small, deliberately generic
 * default so the framework is usable out of the box and the wiring is obvious.
 * The rest are houndex-level and generic across domains.
 */

import { z } from 'zod';

/**
 * Default claim categories. Generic and domain-agnostic — replace with your
 * own closed set for a real application. The framework only requires that a
 * category is a member of *some* closed vocabulary, not this specific one.
 */
export const CATEGORY_VALUES = [
  'general',
  'capability',
  'limitation',
  'cost',
  'security',
  'support',
  'usability',
  'integration',
] as const;
export const CategorySchema = z.enum(CATEGORY_VALUES);
export type Category = z.infer<typeof CategorySchema>;

/** Directional sentiment of a claim about its subject. */
export const POLARITY_VALUES = ['positive', 'negative', 'neutral', 'unknown'] as const;
export const PolaritySchema = z.enum(POLARITY_VALUES);
export type Polarity = z.infer<typeof PolaritySchema>;

/** How broadly a claim applies. */
export const SCOPE_VALUES = ['global', 'scoped', 'anecdotal', 'unverified'] as const;
export const ScopeSchema = z.enum(SCOPE_VALUES);
export type Scope = z.infer<typeof ScopeSchema>;

/** Source trust tiers; `authoritative` is the highest-trust bucket. */
export const SOURCE_TIER_VALUES = [
  'tier_1',
  'tier_2',
  'tier_3',
  'tier_4',
  'authoritative',
] as const;
export const SourceTierSchema = z.enum(SOURCE_TIER_VALUES);
export type SourceTier = z.infer<typeof SourceTierSchema>;

/** How directly the evidence supports the claim. */
export const CONFIDENCE_VALUES = ['stated', 'synthesized', 'inferred', 'weak'] as const;
export const ConfidenceSchema = z.enum(CONFIDENCE_VALUES);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** The reconciler's verdict when a new claim is compared against existing ones. */
export const RECONCILIATION_DECISION_VALUES = [
  'new_claim',
  'duplicate',
  'reinforces_existing',
  'contradicts_existing',
  'refines_existing',
] as const;
export const ReconciliationDecisionSchema = z.enum(RECONCILIATION_DECISION_VALUES);
export type ReconciliationDecision = z.infer<typeof ReconciliationDecisionSchema>;

/**
 * Lifecycle of a curator's decision on a suggested claim. `pending` is the
 * queue default; `approved`/`edited` both promote the suggestion into a
 * knowledge-base head (edited carries curator changes); `rejected` removes it
 * with a reason.
 */
export const CURATION_STATUS_VALUES = ['pending', 'approved', 'edited', 'rejected'] as const;
export const CurationStatusSchema = z.enum(CURATION_STATUS_VALUES);
export type CurationStatus = z.infer<typeof CurationStatusSchema>;

/**
 * The action recorded on each knowledge-base version row. The audit trail is
 * non-destructive: every head change appends a version tagged with what the
 * curator did.
 */
export const KB_ACTION_VALUES = ['created', 'edited', 'approved', 'rejected'] as const;
export const KbActionSchema = z.enum(KB_ACTION_VALUES);
export type KbAction = z.infer<typeof KbActionSchema>;

export const NODE_KIND_VALUES = [
  'tenant',
  'subject',
  'claim',
  'source',
  'category',
  'run',
] as const;
export const NodeKindSchema = z.enum(NODE_KIND_VALUES);
export type NodeKind = z.infer<typeof NodeKindSchema>;

export const EDGE_KIND_VALUES = [
  'reinforces',
  'contradicts',
  'refines',
  'duplicates',
  'cites_source',
  'in_category',
  'in_run',
  'in_tenant',
] as const;
export const EdgeKindSchema = z.enum(EDGE_KIND_VALUES);
export type EdgeKind = z.infer<typeof EdgeKindSchema>;

/**
 * Maps a reconciler decision to the inter-claim edge kind it produces.
 * `new_claim` produces a node, not an edge, and is intentionally absent.
 */
export const DECISION_TO_EDGE_KIND: Partial<Record<ReconciliationDecision, EdgeKind>> = {
  reinforces_existing: 'reinforces',
  contradicts_existing: 'contradicts',
  refines_existing: 'refines',
  duplicate: 'duplicates',
};
