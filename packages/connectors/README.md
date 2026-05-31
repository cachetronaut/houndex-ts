# @houndex/connectors

Deterministic source connectors that feed the ingestion pipeline.

## What it provides

- **Connector contract** — custom connectors yield `ScrapedPage` values.
- **FileConnector** — walks UTF-8 text files in sorted path order and yields one
  page per included file.
- **WebConnector** — fetches an explicit list of URLs through an injected
  fetcher and yields one page per successful response.
- **ingestConnector** — drains connector pages through
  `@houndex/pipeline`'s `processPages`, with optional source persistence.

## Usage

```ts
import { FileConnector, WebConnector, ingestConnector } from '@houndex/connectors';

const connector = new FileConnector({ root: 'docs', baseUrl: 'file://docs' });
const result = await ingestConnector(connector, { subject: 'Acme' }, deps);

const web = new WebConnector({ urls: ['https://example.com/docs'] });
```

The file connector is offline and deterministic. `WebConnector` does not crawl:
it fetches only the URLs supplied. GitHub, docs-site connectors, and the Python
web mirror are follow-up slices.
