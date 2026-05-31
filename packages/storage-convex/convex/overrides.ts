import { v } from 'convex/values';
import { literalUnion } from './lib/validators';
import { mutationWithTenant } from './lib/withTenant';

export const recordVerificationOverride = mutationWithTenant({
  args: {
    claimId: v.string(),
    verdict: literalUnion(['red', 'yellow', 'green'] as const),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('verificationOverrides', {
      tenantId: ctx.tenant.tenantId,
      claimId: args.claimId,
      verdict: args.verdict,
      reason: args.reason,
      createdAt: Date.now(),
    });
  },
});
