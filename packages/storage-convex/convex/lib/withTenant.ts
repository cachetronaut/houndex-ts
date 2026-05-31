/**
 * Tenant-asserting Convex function wrappers. Every tenant-scoped query/mutation
 * is defined through one of these instead of the raw builders. The caller passes
 * a `tenant` argument (a `TenantContext`); the wrapper validates it against the
 * core grammar and injects it as `ctx.tenant`, so a handler that forgets to
 * scope by tenant is the exception, not the default.
 *
 * This adapter is deliberately decoupled from any auth provider: the trusted,
 * already-authenticated server code that drives the adapter is responsible for
 * supplying the tenant context. (An app that wants auth-derived tenancy can wrap
 * these and resolve the context from its own identity provider.)
 */

import { type TenantContext, TenantRole, tenantIdSchema } from '@houndex/core';
import { v } from 'convex/values';
import { customMutation, customQuery } from 'convex-helpers/server/customFunctions';
import { z } from 'zod';
import { mutation, query } from '../_generated/server';
import { literalUnion } from './validators';

const tenantSchema = z.object({
  tenantId: tenantIdSchema,
  userId: z.string().min(1),
  role: z.enum([TenantRole.CURATOR, TenantRole.VIEWER, TenantRole.ADMIN]),
});

/** Convex validator for the passed-through tenant context arg. */
export const tenantArg = v.object({
  tenantId: v.string(),
  userId: v.string(),
  role: literalUnion([TenantRole.CURATOR, TenantRole.VIEWER, TenantRole.ADMIN] as const),
});

function validateTenant(raw: unknown): TenantContext {
  const parsed = tenantSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid tenant context: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    );
  }
  return parsed.data;
}

const consumeTenantArg = {
  args: { tenant: tenantArg },
  input: async (_ctx: unknown, { tenant }: { tenant: unknown }) => ({
    ctx: { tenant: validateTenant(tenant) },
    args: {},
  }),
};

export const queryWithTenant = customQuery(query, consumeTenantArg);
export const mutationWithTenant = customMutation(mutation, consumeTenantArg);
