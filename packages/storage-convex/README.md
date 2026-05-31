# houndex/storage-convex

Convex implementation of the framework `StorageAdapter` contract.

It ships two things:

- **A Convex backend** (`convex/`) — a tenant-scoped schema and functions. Every
  table leads with a `by_tenant` index and every function takes a validated
  `tenant` argument, so cross-tenant reads are structurally impossible.
- **A client-side adapter** (`ConvexStorageAdapter`) that implements
  `StorageAdapter` by calling those functions through any Convex client.

```ts
import { ConvexHttpClient } from 'convex/browser';
import { ConvexStorageAdapter } from 'houndex/storage-convex';

const adapter = new ConvexStorageAdapter(new ConvexHttpClient(process.env.CONVEX_URL!));
```

## Deploying the backend

Copy the `convex/` directory into your Convex project (or point your project at
it) and run `npx convex dev` / `npx convex deploy`. The committed
`convex/_generated` files are a hand-maintained equivalent of `convex codegen`
output so the package builds and tests offline; regenerate them against your
deployment with `pnpm codegen`.

## Notes

- Tenancy is supplied by the caller, not derived from an auth provider — wrap the
  functions if you want identity-derived tenancy.
- `searchClaims` filters by subject/category; semantic (vector) ranking over the
  optional `embedding` field is a planned follow-up.
