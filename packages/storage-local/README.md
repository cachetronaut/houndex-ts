# @houndex/storage-local

Zero-service, in-memory implementation of the `@houndex/core` `StorageAdapter`
contract. It needs no database, so it is ideal for tests, local development, and
as the conformance reference other adapters are checked against.

## What it provides

- A `LocalStorageAdapter` class that implements every `StorageAdapter` method:
  tenants, runs, claims, sources, edges, curation suggestions, knowledge-base
  entries, and verification overrides.
- Tenant partitioning by construction — each tenant's records live in a separate
  partition, so a read for one tenant can never return another tenant's data.
- In-memory cosine vector search over claim embeddings, matching the behavior of
  the database-backed adapters.

State lives only in the process and is lost when it exits. For persistence across
runs, use `@houndex/storage-supabase` or `@houndex/storage-convex`.

## Usage

```ts
import { LocalStorageAdapter } from '@houndex/storage-local';

const adapter = new LocalStorageAdapter();
await adapter.ensureTenant({ tenant });
```

Mirrors the Python `houndex-storage-local` package.
