import { mutationWithTenant } from './lib/withTenant';

export const ensureTenant = mutationWithTenant({
  args: {},
  handler: async (ctx) => {
    const tenantId = ctx.tenant.tenantId;
    const existing = await ctx.db
      .query('tenants')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .unique();
    if (existing === null) {
      await ctx.db.insert('tenants', { tenantId, createdAt: Date.now() });
    }
  },
});
