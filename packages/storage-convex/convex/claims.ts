import {
  CATEGORY_VALUES,
  CONFIDENCE_VALUES,
  POLARITY_VALUES,
  SCOPE_VALUES,
  SOURCE_TIER_VALUES,
} from '@houndex/core';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { internalQuery } from './_generated/server';
import { literalUnion } from './lib/validators';
import { actionWithTenant, mutationWithTenant, queryWithTenant } from './lib/withTenant';

const VECTOR_SEARCH_MAX = 256;
const DEFAULT_MATCH_COUNT = 10;

const claimFields = {
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
};

export const upsertClaim = mutationWithTenant({
  args: { ...claimFields, embedding: v.optional(v.array(v.float64())) },
  handler: async (ctx, args) => {
    const tenantId = ctx.tenant.tenantId;
    const existing = await ctx.db
      .query('claims')
      .withIndex('by_tenant_claim', (q) => q.eq('tenantId', tenantId).eq('claimId', args.claimId))
      .unique();
    if (existing !== null) return { id: args.claimId, created: false };
    await ctx.db.insert('claims', { tenantId, ...args });
    return { id: args.claimId, created: true };
  },
});

export const getClaim = queryWithTenant({
  args: { claimId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('claims')
      .withIndex('by_tenant_claim', (q) =>
        q.eq('tenantId', ctx.tenant.tenantId).eq('claimId', args.claimId),
      )
      .unique();
  },
});

export const searchClaims = queryWithTenant({
  args: {
    subject: v.optional(v.string()),
    category: v.optional(literalUnion(CATEGORY_VALUES)),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const tenantId = ctx.tenant.tenantId;
    const rows =
      args.subject !== undefined
        ? await ctx.db
            .query('claims')
            .withIndex('by_tenant_subject', (q) =>
              q.eq('tenantId', tenantId).eq('subject', args.subject as string),
            )
            .collect()
        : await ctx.db
            .query('claims')
            .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
            .collect();
    const filtered =
      args.category === undefined ? rows : rows.filter((r) => r.category === args.category);
    return args.limit === undefined ? filtered : filtered.slice(0, args.limit);
  },
});

/**
 * Internal: load claims by id (in the given order), re-asserting the tenant and
 * post-filtering by subject/category. Vector search runs in an action without
 * `ctx.db`, so it delegates the document load to this query.
 */
export const loadClaimsByIds = internalQuery({
  args: {
    ids: v.array(v.id('claims')),
    tenantId: v.string(),
    subject: v.optional(v.string()),
    category: v.optional(literalUnion(CATEGORY_VALUES)),
  },
  handler: async (ctx, args): Promise<Doc<'claims'>[]> => {
    const out: Doc<'claims'>[] = [];
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (doc === null || doc.tenantId !== args.tenantId) continue;
      if (args.subject !== undefined && doc.subject !== args.subject) continue;
      if (args.category !== undefined && doc.category !== args.category) continue;
      out.push(doc);
    }
    return out;
  },
});

/**
 * Cosine ANN over claim embeddings, scoped to the tenant by the vector index's
 * filter field. Returns claims ordered most-similar first. subject/category are
 * post-filtered (a vector search can only constrain one field), so when either
 * is set we over-fetch candidates and then narrow.
 */
export const vectorSearchClaims = actionWithTenant({
  args: {
    queryVector: v.array(v.float64()),
    subject: v.optional(v.string()),
    category: v.optional(literalUnion(CATEGORY_VALUES)),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<'claims'>[]> => {
    const tenantId = ctx.tenant.tenantId;
    const limit = args.limit ?? DEFAULT_MATCH_COUNT;
    const narrowing = args.subject !== undefined || args.category !== undefined;
    const results = await ctx.vectorSearch('claims', 'by_embedding', {
      vector: args.queryVector,
      limit: narrowing ? VECTOR_SEARCH_MAX : limit,
      filter: (q) => q.eq('tenantId', tenantId),
    });
    const docs: Doc<'claims'>[] = await ctx.runQuery(internal.claims.loadClaimsByIds, {
      ids: results.map((r) => r._id),
      tenantId,
      subject: args.subject,
      category: args.category,
    });
    return docs.slice(0, limit);
  },
});
