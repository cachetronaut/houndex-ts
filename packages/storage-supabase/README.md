# @houndex/storage-supabase

Supabase (Postgres + pgvector) implementation of the framework `StorageAdapter`
contract.

It ships two things:

- **SQL migrations** (`migrations/`) — tenant-scoped tables (every one keyed by
  `tenant_id`), a pgvector `embedding` column with an HNSW cosine index, a
  `houndex_search_claims` RPC for tenant-scoped similarity search, and
  row-level-security policies keyed on the request's `tenant_id` JWT claim.
- **A client adapter** (`SupabaseStorageAdapter`) implementing `StorageAdapter`
  over a Supabase client. Every query filters by `tenant_id`, so isolation holds
  even with a service-role key that bypasses RLS.

```ts
import { createClient } from '@supabase/supabase-js';
import { SupabaseStorageAdapter, type SupabaseLike } from '@houndex/storage-supabase';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
const adapter = new SupabaseStorageAdapter(supabase as unknown as SupabaseLike);
```

## Applying the schema

Run `migrations/0001_init.sql` against your database (Supabase SQL editor, `psql`,
or your migration tool). The embedding column is `vector(1536)` (OpenAI
`text-embedding-3-small`); change the dimension in the migration to match your
model.

## Status / notes

- `@supabase/supabase-js` is an **optional peer dependency** — the adapter is
  generic over a small structural client interface (`SupabaseLike`), so it can be
  unit-tested with an in-memory fake.
- Behavioral tests run against an in-memory fake client (idempotency, tenant
  isolation, filtering). Vector search (`searchClaims` with a `queryVector`) goes
  through the `houndex_search_claims` RPC and needs a live pgvector database to
  exercise end-to-end — that integration test is a planned follow-up.
