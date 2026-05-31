# @houndex/storage-supabase

Supabase (Postgres + pgvector) implementation of the framework `StorageAdapter`
contract: tenant-scoped tables (every one keyed by `tenant_id`), a pgvector
`embedding` column with an HNSW cosine index, a `houndex_search_claims` RPC for
tenant-scoped similarity search, and row-level-security policies keyed on the
request's `tenant_id` JWT claim. Every query the adapter issues filters by
`tenant_id`, so isolation holds even with a service-role key that bypasses RLS.

```ts
import { createClient } from '@supabase/supabase-js';
import { SupabaseStorageAdapter, type SupabaseLike } from '@houndex/storage-supabase';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const adapter = new SupabaseStorageAdapter(supabase as unknown as SupabaseLike);
```

## Schema

The schema is owned by the Supabase CLI and lives in `supabase/migrations/` at
the repo root — the single source of truth (`supabase db diff` regenerates
against it). Apply it one of two ways:

```bash
# Local development — boots a Dockerized Postgres + pgvector and applies migrations
supabase start
supabase db reset

# Linked cloud project — pushes pending migrations to the remote
supabase db push
```

The embedding column is `vector(1536)` (OpenAI `text-embedding-3-small`); change
the dimension in the migration to match your model before applying.

## Testing

- `@supabase/supabase-js` is an **optional peer dependency** — the adapter is
  generic over a small structural client interface (`SupabaseLike`), so the
  behavioral suite (`supabaseStorageAdapter.test.ts`) runs offline against an
  in-memory fake (idempotency, subject filtering, tenant isolation, and the
  run/edge/curation/kb/override flows).
- Live integration tests (`supabaseStorageAdapter.integration.test.ts`) exercise
  the real client against a running Supabase, including pgvector cosine search
  via the `houndex_search_claims` RPC. They are skipped unless `SUPABASE_URL` and
  a service-role key are set:

  ```bash
  supabase start && supabase db reset
  export SUPABASE_URL=http://127.0.0.1:54321
  export SUPABASE_SERVICE_ROLE_KEY=<service_role key printed by `supabase start`>
  pnpm --filter @houndex/storage-supabase test
  ```
