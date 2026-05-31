import { v } from 'convex/values';
import { literalUnion } from './lib/validators';
import { mutationWithTenant, queryWithTenant } from './lib/withTenant';

export const createRun = mutationWithTenant({
  args: { runId: v.string(), subject: v.string(), signal: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const tenantId = ctx.tenant.tenantId;
    const existing = await ctx.db
      .query('runs')
      .withIndex('by_tenant_run', (q) => q.eq('tenantId', tenantId).eq('runId', args.runId))
      .unique();
    if (existing !== null) return existing;
    const id = await ctx.db.insert('runs', {
      tenantId,
      runId: args.runId,
      subject: args.subject,
      signal: args.signal,
      status: 'running',
      createdAt: Date.now(),
    });
    const inserted = await ctx.db.get(id);
    if (inserted === null) throw new Error('run insert vanished');
    return inserted;
  },
});

export const setRunStatus = mutationWithTenant({
  args: {
    runId: v.string(),
    status: literalUnion(['complete', 'failed'] as const),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tenantId = ctx.tenant.tenantId;
    const run = await ctx.db
      .query('runs')
      .withIndex('by_tenant_run', (q) => q.eq('tenantId', tenantId).eq('runId', args.runId))
      .unique();
    if (run === null) return;
    await ctx.db.patch(run._id, { status: args.status, reason: args.reason });
  },
});

export const getRun = queryWithTenant({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('runs')
      .withIndex('by_tenant_run', (q) =>
        q.eq('tenantId', ctx.tenant.tenantId).eq('runId', args.runId),
      )
      .unique();
  },
});

export const listRuns = queryWithTenant({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('runs')
      .withIndex('by_tenant', (q) => q.eq('tenantId', ctx.tenant.tenantId))
      .collect();
  },
});
