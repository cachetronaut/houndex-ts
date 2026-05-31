import { CURATION_STATUS_VALUES } from '@houndex/core';
import { v } from 'convex/values';
import { literalUnion } from './lib/validators';
import { mutationWithTenant } from './lib/withTenant';

export const createCurationSuggestion = mutationWithTenant({
  args: { suggestionId: v.string(), claim: v.any(), rationale: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const tenantId = ctx.tenant.tenantId;
    const existing = await ctx.db
      .query('curationSuggestions')
      .withIndex('by_tenant_suggestion', (q) =>
        q.eq('tenantId', tenantId).eq('suggestionId', args.suggestionId),
      )
      .unique();
    if (existing !== null) return;
    await ctx.db.insert('curationSuggestions', {
      tenantId,
      suggestionId: args.suggestionId,
      claim: args.claim,
      status: 'pending',
      rationale: args.rationale,
      createdAt: Date.now(),
    });
  },
});

export const decideSuggestion = mutationWithTenant({
  args: {
    suggestionId: v.string(),
    status: literalUnion(CURATION_STATUS_VALUES),
    editedClaim: v.optional(v.any()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tenantId = ctx.tenant.tenantId;
    const row = await ctx.db
      .query('curationSuggestions')
      .withIndex('by_tenant_suggestion', (q) =>
        q.eq('tenantId', tenantId).eq('suggestionId', args.suggestionId),
      )
      .unique();
    if (row === null) return;
    await ctx.db.patch(row._id, {
      status: args.status,
      claim: args.editedClaim ?? row.claim,
      reason: args.reason,
      decidedAt: Date.now(),
    });
  },
});
