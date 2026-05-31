/**
 * Node schemas for the claim graph. Zod is the single source of truth: TS
 * types derive from these, and any backend's validators should derive from
 * them too. Every node carries `tenantId`.
 *
 * Node-id derivations live here (not on the schema) so they can change without
 * bumping the schema — backends never invent ids.
 */

import { z } from 'zod';
import { sha256Hex } from '../hash.js';
import { tenantIdSchema } from '../tenant.js';
import {
  CategorySchema,
  ConfidenceSchema,
  NodeKindSchema,
  PolaritySchema,
  ScopeSchema,
  SourceTierSchema,
} from './taxonomy.js';
import { canonicalizeUrl, extractDomain } from './url.js';

const NODE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_:./@-]{0,254}$/;

export const ClaimSchema = z.object({
  tenantId: tenantIdSchema,
  claimId: z.string().regex(/^[0-9a-f]{16}$/),
  subject: z.string().min(1),
  category: CategorySchema,
  polarity: PolaritySchema,
  scope: ScopeSchema,
  claimText: z.string().min(1),
  evidenceText: z.string().min(1),
  confidence: ConfidenceSchema,
  sourceUrl: z.string().min(1),
  sourceTier: SourceTierSchema,
  extractedAt: z.number(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const SourceSchema = z.object({
  tenantId: tenantIdSchema,
  url: z.string().min(1),
  title: z.string().default(''),
  domain: z.string().default(''),
  tier: SourceTierSchema.default('tier_4'),
  fetchedAt: z.number(),
});
export type Source = z.infer<typeof SourceSchema>;

export const SubjectSchema = z.object({
  tenantId: tenantIdSchema,
  name: z.string().min(1),
});
export type Subject = z.infer<typeof SubjectSchema>;

export const CategoryNodeSchema = z.object({
  tenantId: tenantIdSchema,
  value: CategorySchema,
});
export type CategoryNode = z.infer<typeof CategoryNodeSchema>;

export const RunSchema = z.object({
  tenantId: tenantIdSchema,
  runId: z.string().min(1),
  subject: z.string().min(1),
  signal: z.string().optional(),
  status: z.enum(['pending', 'running', 'complete', 'failed']),
  createdAt: z.number(),
});
export type Run = z.infer<typeof RunSchema>;

export const GraphNodeSchema = z.object({
  id: z.string().regex(NODE_ID_RE),
  kind: NodeKindSchema,
  tenantId: tenantIdSchema,
  attributes: z.record(z.string(), z.unknown()).default({}),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

// ── Node-id derivations ────────────────────────────────────────────────

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function tenantNodeId(tenantId: string): string {
  return `tenant:${tenantId}`;
}

export function subjectNodeId(name: string): string {
  return `subject:${slugify(name)}`;
}

export function categoryNodeId(value: string): string {
  return `category:${value}`;
}

export function runNodeId(runId: string): string {
  return `run:${runId}`;
}

/** Stable 16-hex source id over the canonical URL — same-URL claims collapse. */
export function sourceNodeId(canonicalUrl: string): string {
  return `source:${sha256Hex(canonicalUrl).slice(0, 16)}`;
}

export { canonicalizeUrl, extractDomain };
