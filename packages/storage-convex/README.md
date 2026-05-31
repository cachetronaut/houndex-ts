# @houndex/storage-convex

Convex implementation of the framework `StorageAdapter` contract.

It ships two things:

- **A Convex backend** (`convex/`) — a tenant-scoped schema and functions. Every
  table leads with a `by_tenant` index and every function takes a validated
  `tenant` argument, so cross-tenant reads are structurally impossible. The
  `claims` table carries a `by_embedding` vector index for cosine ANN.
- **A client-side adapter** (`ConvexStorageAdapter`) that implements
  `StorageAdapter` by calling those functions through any Convex client.

```ts
import { ConvexHttpClient } from 'convex/browser';
import { ConvexStorageAdapter } from '@houndex/storage-convex';

const adapter = new ConvexStorageAdapter(new ConvexHttpClient(process.env.CONVEX_URL!));
```

## Vector search

`searchClaims` with a `queryVector` runs cosine ANN via a Convex **action**
(`vectorSearchClaims`) over the `by_embedding` vector index. Convex vector search
only runs in actions, and its filter constrains a single field — so the search is
scoped to `tenantId` (the security boundary) at the index, and `subject`/
`category` are post-filtered after loading the matched documents. Without a
`queryVector`, `searchClaims` falls back to an indexed subject/category query.

The vector dimension is `1536` (OpenAI `text-embedding-3-small`); change it in
`convex/schema.ts` to match your model.

## Deploying the backend

Link a Convex deployment and push the schema + functions:

```bash
pnpm exec convex dev --once   # logs in, links a dev deployment, pushes, runs codegen
pnpm exec convex deploy       # production
```

`convex dev` runs real codegen into `convex/_generated/`. Those generated files
are committed, so the package builds and tests offline before you link your own
deployment; regenerate them any time with `pnpm codegen` (or `convex dev`).

## Testing

- The behavioral suite (`convexStorageAdapter.test.ts`) runs **offline** via
  `convex-test` — an in-memory Convex backend — covering idempotency, subject
  filtering, tenant isolation, the run/edge/curation/kb/override flows, and
  cosine ordering through the vector-search action.
- Live integration tests (`convexStorageAdapter.integration.test.ts`) run the
  same flows against a real deployment via `ConvexHttpClient`. They are skipped
  unless `CONVEX_URL` is set:

  ```bash
  pnpm exec convex dev --once
  export CONVEX_URL=https://<your-deployment>.convex.cloud
  pnpm --filter @houndex/storage-convex test
  ```

## Notes

- Tenancy is supplied by the caller, not derived from an auth provider — wrap the
  functions if you want identity-derived tenancy.
