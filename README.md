# Houndex (TypeScript)

A storage-decoupled, last-mile RAG framework. It gives you the pieces that sit
*after* retrieval and *before* your application logic:

- **Typed output envelopes** — versioned, self-describing results with an
  embedded provenance trace, so downstream consumers can validate and reason
  about an answer instead of guessing.
- **Tenant-aware evidence stores** — every read and write is scoped to a tenant
  by construction, so cross-tenant data bleed is structurally impossible.
- **Claim / evidence / enrichment models** — a small, generic vocabulary for
  the facts a RAG system extracts and the edges between them.
- **Provider ports** — search, scrape, embed, and rerank behind interfaces, so
  swapping a provider never touches pipeline code.
- **Pluggable storage adapters** — one `StorageAdapter` contract; back it with
  any database.

This repository is the TypeScript implementation. A companion Python
implementation tracks the same contracts.

## Packages

| Package | Status | Purpose |
|---|---|---|
| `houndex/core` | **active** | Contracts: schemas, envelopes, tenant, provider ports, storage adapter interface |
| `houndex/pipeline` | planned | Generalized ingestion, retrieval, verification, eval hooks |
| `houndex/storage-local` | planned | Zero-service reference adapter |
| `houndex/storage-supabase` | planned | Postgres + pgvector adapter |
| `houndex/storage-convex` | planned | Convex reference adapter |
| `houndex/connectors` | planned | Source connectors |
| `houndex/surface-next` | planned | Optional Next.js UI |
| `houndex/cli` | planned | `init`, `ingest`, `ask`, `eval`, `doctor` |
| `houndex/evals` | planned | Regression / evaluation harness |

## Development

Requires Node 22 and pnpm 9.

```bash
pnpm install
pnpm verify   # biome check + tsc + vitest + clean-room guard
```

## License

[MIT](./LICENSE)
