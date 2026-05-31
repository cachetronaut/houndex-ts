# @houndex/core

The contracts every other Houndex package depends on: schemas, identity, the
output envelope, tenant context, provider ports, and the storage adapter
interface. Pure and I/O-free — it validates and types data, and binds to no
database or model provider.

## What it provides

- **Schemas** (Zod) — `Claim`, `Source`, `Edge`, `Enrichment`, the agent
  input/output types, and the versioned `OutputEnvelope`. A neutral default
  taxonomy (category, polarity, scope, confidence, source tier) ships as value
  arrays you can replace with your own closed set.
- **Identity** — `computeClaimId` (content-addressed claim ids) and
  `edgeIdempotencyKey`, built on canonical JSON and `sha256Hex` so the same
  input always produces the same id.
- **Tenant context** — `TenantContext` and `TenantRole`. Every storage call
  takes a `TenantContext`, so forgetting to scope a query to a tenant is a type
  error rather than a policy mistake.
- **Provider ports** — interfaces for search, scraping, embedding, reranking,
  and model calls. Houndex bundles no provider; you supply implementations.
- **Storage contract** — the `StorageAdapter` interface and its input types.
  This is the seam that decouples Houndex from any specific database.
- **Observability** — a no-op tracing sink by default, so the framework adds no
  overhead until you wire a vendor.

## Usage

```ts
import { computeClaimId, outputEnvelopeSchema, TenantRole } from '@houndex/core';

const claimId = computeClaimId({
  tenantId: 'acme',
  subject: 'Acme',
  claimText: 'Has an audit log',
  sourceUrl: 'https://example.com/security',
});
```

Claim identity, canonical JSON, and URL canonicalization are held byte-for-byte
identical to the Python `houndex-core` package by a shared parity fixture.
