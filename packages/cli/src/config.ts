/**
 * CLI configuration: `houndex.config.json`. Declares which storage adapter to
 * talk to and the tenant + embedding settings. Secrets (Supabase key, Convex
 * URL) are NEVER stored here — they come from environment variables — so the
 * config file is safe to commit.
 */

import { TenantRole } from 'houndex/core';
import { z } from 'zod';

export const CONFIG_FILENAME = 'houndex.config.json';

export const ADAPTERS = ['local', 'supabase', 'convex'] as const;
export type AdapterName = (typeof ADAPTERS)[number];

export const HoundexConfigSchema = z.object({
  adapter: z.enum(ADAPTERS).default('local'),
  tenant: z
    .object({
      tenantId: z.string().min(1).default('default'),
      userId: z.string().min(1).default('cli'),
      role: z
        .enum([TenantRole.CURATOR, TenantRole.VIEWER, TenantRole.ADMIN])
        .default(TenantRole.ADMIN),
    })
    .default({}),
  embedding: z
    .object({
      provider: z.literal('synthetic').default('synthetic'),
      dimensions: z.number().int().positive().default(1536),
    })
    .default({}),
});

export type HoundexConfig = z.infer<typeof HoundexConfigSchema>;

/** Parse + validate raw config JSON, applying defaults. Throws on invalid shape. */
export function parseConfig(raw: unknown): HoundexConfig {
  return HoundexConfigSchema.parse(raw);
}

/** A fully-defaulted config (what `init` writes and `local` runs need). */
export function defaultConfig(
  overrides: Partial<{ adapter: AdapterName; tenantId: string }> = {},
): HoundexConfig {
  return HoundexConfigSchema.parse({
    adapter: overrides.adapter ?? 'local',
    ...(overrides.tenantId ? { tenant: { tenantId: overrides.tenantId } } : {}),
  });
}
