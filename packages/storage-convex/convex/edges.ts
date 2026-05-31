import { EDGE_KIND_VALUES, edgeIdempotencyKey } from 'houndex/core';
import { v } from 'convex/values';
import { literalUnion } from './lib/validators';
import { mutationWithTenant } from './lib/withTenant';

export const upsertEdge = mutationWithTenant({
  args: {
    srcId: v.string(),
    dstId: v.string(),
    kind: literalUnion(EDGE_KIND_VALUES),
    attributes: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const tenantId = ctx.tenant.tenantId;
    const idempotencyKey = edgeIdempotencyKey({
      srcId: args.srcId,
      dstId: args.dstId,
      kind: args.kind,
    });
    const existing = await ctx.db
      .query('edges')
      .withIndex('by_tenant_idempotency', (q) =>
        q.eq('tenantId', tenantId).eq('idempotencyKey', idempotencyKey),
      )
      .unique();
    if (existing !== null) return { id: idempotencyKey, created: false };
    await ctx.db.insert('edges', { tenantId, idempotencyKey, ...args });
    return { id: idempotencyKey, created: true };
  },
});
