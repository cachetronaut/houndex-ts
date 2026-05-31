/**
 * Convex schema for the framework evidence store. Every table carries
 * `tenantId` and leads with a `by_tenant` index, so tenant-scoped reads are
 * O(log n) and cross-tenant bleed is structurally impossible. Closed-vocabulary
 * columns derive their literals from the @houndex/core taxonomy value-arrays
 * via `literalUnion`, so the core schemas are the single source of truth.
 */

import {
  CATEGORY_VALUES,
  CONFIDENCE_VALUES,
  CURATION_STATUS_VALUES,
  EDGE_KIND_VALUES,
  POLARITY_VALUES,
  SCOPE_VALUES,
  SOURCE_TIER_VALUES,
} from '@houndex/core';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { literalUnion } from './lib/validators';

const VERDICT_VALUES = ['red', 'yellow', 'green'] as const;

export default defineSchema({
  tenants: defineTable({
    tenantId: v.string(),
    createdAt: v.number(),
  }).index('by_tenant', ['tenantId']),

  runs: defineTable({
    tenantId: v.string(),
    runId: v.string(),
    subject: v.string(),
    signal: v.optional(v.string()),
    status: literalUnion(['pending', 'running', 'complete', 'failed'] as const),
    createdAt: v.number(),
    reason: v.optional(v.string()),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_run', ['tenantId', 'runId']),

  claims: defineTable({
    tenantId: v.string(),
    claimId: v.string(),
    subject: v.string(),
    category: literalUnion(CATEGORY_VALUES),
    polarity: literalUnion(POLARITY_VALUES),
    scope: literalUnion(SCOPE_VALUES),
    claimText: v.string(),
    evidenceText: v.string(),
    confidence: literalUnion(CONFIDENCE_VALUES),
    sourceUrl: v.string(),
    sourceTier: literalUnion(SOURCE_TIER_VALUES),
    extractedAt: v.number(),
    embedding: v.optional(v.array(v.float64())),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_claim', ['tenantId', 'claimId'])
    .index('by_tenant_subject', ['tenantId', 'subject'])
    // Cosine ANN over the embedding. `tenantId` is a filter field so the search
    // itself is tenant-scoped (the security boundary); subject/category are
    // post-filtered in the action, since a vector filter can only constrain one
    // field. Dimension matches OpenAI text-embedding-3-small — change to suit
    // your model.
    .vectorIndex('by_embedding', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['tenantId'],
    }),

  sources: defineTable({
    tenantId: v.string(),
    sourceId: v.string(),
    url: v.string(),
    title: v.string(),
    domain: v.string(),
    tier: literalUnion(SOURCE_TIER_VALUES),
    fetchedAt: v.number(),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_source', ['tenantId', 'sourceId']),

  edges: defineTable({
    tenantId: v.string(),
    idempotencyKey: v.string(),
    srcId: v.string(),
    dstId: v.string(),
    kind: literalUnion(EDGE_KIND_VALUES),
    attributes: v.optional(v.any()),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_idempotency', ['tenantId', 'idempotencyKey']),

  curationSuggestions: defineTable({
    tenantId: v.string(),
    suggestionId: v.string(),
    claim: v.any(),
    status: literalUnion(CURATION_STATUS_VALUES),
    rationale: v.optional(v.string()),
    createdAt: v.number(),
    decidedAt: v.optional(v.number()),
    reason: v.optional(v.string()),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_suggestion', ['tenantId', 'suggestionId'])
    .index('by_tenant_status', ['tenantId', 'status']),

  kbEntries: defineTable({
    tenantId: v.string(),
    entryId: v.string(),
    claim: v.any(),
    status: literalUnion(CURATION_STATUS_VALUES),
    subject: v.string(),
    category: literalUnion(CATEGORY_VALUES),
    updatedAt: v.number(),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_entry', ['tenantId', 'entryId'])
    .index('by_tenant_subject', ['tenantId', 'subject']),

  verificationOverrides: defineTable({
    tenantId: v.string(),
    claimId: v.string(),
    verdict: literalUnion(VERDICT_VALUES),
    reason: v.string(),
    createdAt: v.number(),
  })
    .index('by_tenant', ['tenantId'])
    .index('by_tenant_claim', ['tenantId', 'claimId']),
});
