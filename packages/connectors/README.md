# @houndex/connectors

Deterministic source connectors that feed the ingestion pipeline.

## What it provides

- **Connector contract** — custom connectors yield `ScrapedPage` values.
- **FileConnector** — walks UTF-8 text files in sorted path order and yields one
  page per included file.
- **ingestConnector** — drains connector pages through
  `@houndex/pipeline`'s `processPages`, with optional source persistence.

## Usage

```ts
import { FileConnector, ingestConnector } from '@houndex/connectors';

const connector = new FileConnector({ root: 'docs', baseUrl: 'file://docs' });
const result = await ingestConnector(connector, { subject: 'Acme' }, deps);
```

The MVP is offline and deterministic. Web, GitHub, docs-site connectors, and the
Python mirror are follow-up slices.
