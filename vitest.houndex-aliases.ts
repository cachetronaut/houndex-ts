import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export const houndexAliases = [
  { find: 'houndex/cli/engine', replacement: resolve(root, 'packages/cli/src/engine.ts') },
  {
    find: 'houndex/storage/supabase',
    replacement: resolve(root, 'packages/storage-supabase/src/index.ts'),
  },
  {
    find: 'houndex/storage/convex',
    replacement: resolve(root, 'packages/storage-convex/src/index.ts'),
  },
  {
    find: 'houndex/storage/local',
    replacement: resolve(root, 'packages/storage-local/src/index.ts'),
  },
  { find: 'houndex/connectors', replacement: resolve(root, 'packages/connectors/src/index.ts') },
  {
    find: 'houndex/observability',
    replacement: resolve(root, 'packages/core/src/observability.ts'),
  },
  { find: 'houndex/providers', replacement: resolve(root, 'packages/core/src/providers/index.ts') },
  { find: 'houndex/pipeline', replacement: resolve(root, 'packages/pipeline/src/index.ts') },
  { find: 'houndex/storage', replacement: resolve(root, 'packages/core/src/storage/index.ts') },
  { find: 'houndex/schemas', replacement: resolve(root, 'packages/core/src/schemas/index.ts') },
  { find: 'houndex/identity', replacement: resolve(root, 'packages/core/src/identity.ts') },
  { find: 'houndex/models', replacement: resolve(root, 'packages/core/src/models.ts') },
  { find: 'houndex/tenant', replacement: resolve(root, 'packages/core/src/tenant.ts') },
  { find: 'houndex/evals', replacement: resolve(root, 'packages/evals/src/index.ts') },
  { find: 'houndex/core', replacement: resolve(root, 'packages/core/src/index.ts') },
  { find: 'houndex/cli', replacement: resolve(root, 'packages/cli/src/index.ts') },
  { find: 'houndex', replacement: resolve(root, 'src/index.ts') },
];
