import {
  CATEGORY_VALUES,
  CONFIDENCE_VALUES,
  POLARITY_VALUES,
  SCOPE_VALUES,
  SOURCE_TIER_VALUES,
} from '@houndex/core';
import { v } from 'convex/values';
import { literalUnion } from './lib/validators';
import { mutationWithTenant, queryWithTenant } from './lib/withTenant';

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
