import { CATEGORY_VALUES, KB_ACTION_VALUES } from 'houndex/core';
import { v } from 'convex/values';
import { literalUnion } from './lib/validators';
import { mutationWithTenant, queryWithTenant } from './lib/withTenant';

export const upsertKbEntry = mutationWithTenant({
  args: {
    entryId: v.string(),
    claim: v.any(),
    action: literalUnion(KB_ACTION_VALUES),
    subject: v.string(),
    category: literalUnion(CATEGORY_VALUES),
  },
  handler: async (ctx, args) => {
    const tenantId = ctx.tenant.tenantId;
    const row = {
      tenantId,
      entryId: args.entryId,
      claim: args.claim,
      status: args.action === 'rejected' ? ('rejected' as const) : ('approved' as const),
      subject: args.subject,
      category: args.category,
      updatedAt: Date.now(),
    };
    const existing = await ctx.db
      .query('kbEntries')
      .withIndex('by_tenant_entry', (q) => q.eq('tenantId', tenantId).eq('entryId', args.entryId))
      .unique();
    if (existing === null) await ctx.db.insert('kbEntries', row);
    else await ctx.db.patch(existing._id, row);
  },
});

export const listKbEntries = queryWithTenant({
  args: { subject: v.optional(v.string()), category: v.optional(literalUnion(CATEGORY_VALUES)) },
  handler: async (ctx, args) => {
    const tenantId = ctx.tenant.tenantId;
    const rows =
      args.subject !== undefined
        ? await ctx.db
            .query('kbEntries')
            .withIndex('by_tenant_subject', (q) =>
              q.eq('tenantId', tenantId).eq('subject', args.subject as string),
            )
            .collect()
        : await ctx.db
            .query('kbEntries')
            .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
            .collect();
    return args.category === undefined ? rows : rows.filter((r) => r.category === args.category);
  },
});
