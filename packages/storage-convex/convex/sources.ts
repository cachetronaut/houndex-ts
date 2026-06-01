import { v } from 'convex/values';
import { canonicalizeUrl, SOURCE_TIER_VALUES, sourceNodeId } from 'houndex/core';
import { literalUnion } from './lib/validators';
import { mutationWithTenant } from './lib/withTenant';

export const upsertSource = mutationWithTenant({
  args: {
    url: v.string(),
    title: v.string(),
    domain: v.string(),
    tier: literalUnion(SOURCE_TIER_VALUES),
    fetchedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const tenantId = ctx.tenant.tenantId;
    const url = canonicalizeUrl(args.url);
    const sourceId = sourceNodeId(url);
    const existing = await ctx.db
      .query('sources')
      .withIndex('by_tenant_source', (q) => q.eq('tenantId', tenantId).eq('sourceId', sourceId))
      .unique();
    const row = { tenantId, sourceId, ...args, url };
    if (existing === null) await ctx.db.insert('sources', row);
    else await ctx.db.patch(existing._id, row);
    return row;
  },
});
