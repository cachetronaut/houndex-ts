/**
 * Build a `StorageAdapter` from config. `local` is in-process and dependency-free;
 * `supabase`/`convex` are dynamically imported (with their client SDKs) only when
 * selected, and read their secrets from the environment. Keeps the common path
 * light and lets the CLI run with zero external deps by default.
 */

import type { StorageAdapter } from '@houndex/core';
// Type-only imports of the optional adapters (erased at build — no runtime load).
import type { ConvexClientLike } from '@houndex/storage-convex';
import { LocalStorageAdapter } from '@houndex/storage-local';
import type { SupabaseLike } from '@houndex/storage-supabase';
import type { AdapterName, HoundexConfig } from './config.js';

/** Env vars each adapter needs (beyond the config file). Used by `doctor`. */
export const REQUIRED_ENV: Record<AdapterName, readonly string[]> = {
  local: [],
  supabase: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  convex: ['CONVEX_URL'],
};

export function missingEnv(adapter: AdapterName, env: NodeJS.ProcessEnv = process.env): string[] {
  return REQUIRED_ENV[adapter].filter((name) => {
    const value = env[name];
    return value === undefined || value.length === 0;
  });
}

function requireEnv(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`missing required environment variable ${name}`);
  }
  return value;
}

export async function createAdapter(
  config: HoundexConfig,
  env: NodeJS.ProcessEnv = process.env,
): Promise<StorageAdapter> {
  switch (config.adapter) {
    case 'local':
      return new LocalStorageAdapter();
    case 'supabase': {
      const url = requireEnv('SUPABASE_URL', env);
      const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY', env);
      const { SupabaseStorageAdapter } = await importOptional<
        typeof import('@houndex/storage-supabase')
      >('@houndex/storage-supabase', 'supabase');
      const sdkSpec = '@supabase/supabase-js';
      const { createClient } = (await import(sdkSpec)) as {
        createClient: (url: string, key: string) => SupabaseLike;
      };
      return new SupabaseStorageAdapter(createClient(url, key));
    }
    case 'convex': {
      const url = requireEnv('CONVEX_URL', env);
      const { ConvexStorageAdapter } = await importOptional<
        typeof import('@houndex/storage-convex')
      >('@houndex/storage-convex', 'convex');
      const sdkSpec = 'convex/browser';
      const { ConvexHttpClient } = (await import(sdkSpec)) as {
        ConvexHttpClient: new (url: string) => ConvexClientLike;
      };
      return new ConvexStorageAdapter(new ConvexHttpClient(url));
    }
  }
}

async function importOptional<T>(specifier: string, adapter: string): Promise<T> {
  try {
    return (await import(specifier)) as T;
  } catch {
    throw new Error(
      `the '${adapter}' adapter needs @houndex/storage-${adapter} and its client SDK installed`,
    );
  }
}
