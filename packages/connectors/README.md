# houndex/connectors

Deterministic source connectors that feed the ingestion pipeline.

## What it provides

- **Connector contract** — custom connectors yield `ScrapedPage` values.
- **FileConnector** — walks UTF-8 text files in sorted path order and yields one
  page per included file.
- **WebConnector** — fetches an explicit list of URLs through an injected
  fetcher and yields one page per successful response.
- **GitHubConnector** — lists repository files through an injected GitHub client
  and yields one page per matching text file.
- **DocsConnector** — crawls a documentation site from one seed (a `sitemap.xml`
  or an HTML index/nav page), filters to same-origin and an optional path
  prefix, then fetches the pages through the same fetcher as `WebConnector`.
- **ingestConnector** — drains connector pages through
  `houndex/pipeline`'s `processPages`, with optional source persistence.

## Usage

```ts
import {
  FileConnector,
  GitHubConnector,
  WebConnector,
  ingestConnector,
} from 'houndex/connectors';

const connector = new FileConnector({ root: 'docs', baseUrl: 'file://docs' });
const result = await ingestConnector(connector, { subject: 'Acme' }, deps);

const web = new WebConnector({ urls: ['https://example.com/docs'] });
const repo = new GitHubConnector({ repository: { owner: 'octo', repo: 'repo' } });
```

The file connector is offline and deterministic. `WebConnector` does not crawl:
it fetches only the URLs supplied. `DocsConnector` reads exactly one seed and
does not follow links recursively. `GitHubConnector` reads repository files only;
issues and pull requests are follow-up slices.
