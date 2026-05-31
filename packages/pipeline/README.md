# @houndex/pipeline

Deterministic ingestion and enrichment transforms built on `@houndex/core`. The
same input always produces the same output, so the pipeline is testable and its
results are reproducible.

## What it provides

- **Chunking** — splits source text on stable boundaries with a configurable
  preference order.
- **Content-hash dedupe** — `dedupeByUrl` and content hashing drop duplicate
  pages so the same material is stored once.
- **Source-tier classification** — `SourceTierClassifier` ranks a source as
  `authoritative`, `tier_2`, or `tier_3` from domain rules you supply.
- **Enrichment** — `computeEnrichment` derives corroboration counts,
  contradiction counts, and source-tier distribution from a claim's edges.
- **Orchestrator** — `runIngestion` ties the steps together over injected
  provider ports (scrape, extract, embed) and a `StorageAdapter`. The
  dependencies are parameters, so you choose the providers and storage.
- **Processing bridge** — `discoverPages` and `processPages` expose the
  discovery and processing halves separately, so connector packages can reuse
  the deterministic classify/chunk/extract/embed/sink path.

## Usage

```ts
import { runIngestion } from '@houndex/pipeline';

const result = await runIngestion(input, deps);
```

`deps` carries the provider implementations and the storage adapter; the pipeline
performs no network or database calls directly. Mirrors the Python
`houndex-pipeline` package.
