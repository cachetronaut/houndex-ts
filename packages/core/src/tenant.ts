/**
 * Tenant primitive — one type threaded through every storage call so that
 * "did we forget to scope this path to a tenant?" is structurally impossible
 * rather than a matter of policy. This module is pure (no I/O, no framework
 * coupling) so it can be shared by any surface or adapter.
 */

import { z } from 'zod';

/**
 * Tenant slug grammar: lowercase ASCII letters / digits / `-` / `_`, with
 * alphanumeric endpoints, max 64 chars. A single alphanumeric char is valid.
 */
const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$|^[a-z0-9]$/;

export const TenantRole = {
  CURATOR: 'curator',
  VIEWER: 'viewer',
  ADMIN: 'admin',
} as const;
export type TenantRole = (typeof TenantRole)[keyof typeof TenantRole];

export const tenantIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    TENANT_SLUG_RE,
    'tenantId must be a lowercase slug (a-z0-9_-, alphanumeric endpoints, <=64 chars)',
  );

export const TenantContextSchema = z.object({
  tenantId: tenantIdSchema,
  userId: z.string().min(1),
  role: z.enum([TenantRole.CURATOR, TenantRole.VIEWER, TenantRole.ADMIN]),
});

export type TenantContext = z.infer<typeof TenantContextSchema>;

/** Validate an untrusted tenant slug, throwing a structured error on failure. */
export function parseTenantId(value: string): string {
  return tenantIdSchema.parse(value);
}

/** Validate a full tenant context (e.g. assembled from auth claims). */
export function parseTenantContext(value: unknown): TenantContext {
  return TenantContextSchema.parse(value);
}

// ── Test fixtures ─────────────────────────────────────────────────────
// Two fixtures so isolation tests can prove a read scoped to one tenant
// never returns another tenant's rows.

export function tenantPrimary(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: 'primary',
    userId: 'user_primary',
    role: TenantRole.ADMIN,
    ...overrides,
  };
}

export function tenantSecondary(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: 'secondary',
    userId: 'user_secondary',
    role: TenantRole.ADMIN,
    ...overrides,
  };
}
