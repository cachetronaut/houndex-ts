/**
 * DocsConnector — crawl a documentation site from a single seed and yield its
 * pages.
 *
 * It does not follow links recursively. It reads exactly one seed — a
 * `sitemap.xml` or an HTML index/nav page — extracts the candidate URLs, applies
 * conservative filtering (same-origin, optional path-prefix, dedupe, page cap),
 * then delegates the actual fetching to a `WebConnector`. Discovery and fetching
 * stay separate: this connector decides *which* URLs, the web connector decides
 * *how* to fetch them. A failed or non-2xx seed is reported through `onError`
 * and yields zero pages rather than throwing.
 */

import type { ScrapedPage } from 'houndex/core';
import type { Connector } from './connector.js';
import { type Fetcher, WebConnector } from './webConnector.js';

export interface DocsConnectorOptions {
  /** A `sitemap.xml` URL whose `<loc>` entries are the candidate pages. */
  sitemapUrl?: string;
  /** An HTML index/nav URL whose `<a href>` links are the candidate pages. */
  indexUrl?: string;
  fetcher?: Fetcher;
  /** Keep only URLs whose pathname starts with this prefix, e.g. `/docs/`. */
  include?: string;
  /** Upper bound on pages crawled after filtering. Defaults to 100. */
  maxPages?: number;
  onError?: (event: { url: string; error: unknown }) => void;
}

const DEFAULT_MAX_PAGES = 100;

export class DocsConnector implements Connector {
  readonly name = 'docs';

  private readonly seedUrl: string;
  private readonly kind: 'sitemap' | 'index';
  private readonly fetcher: Fetcher | undefined;
  private readonly include: string | undefined;
  private readonly maxPages: number;
  private readonly onError: ((event: { url: string; error: unknown }) => void) | undefined;

  constructor(options: DocsConnectorOptions) {
    if ((options.sitemapUrl === undefined) === (options.indexUrl === undefined)) {
      throw new Error('DocsConnector requires exactly one of sitemapUrl or indexUrl');
    }
    if (options.sitemapUrl !== undefined) {
      this.seedUrl = options.sitemapUrl;
      this.kind = 'sitemap';
    } else {
      this.seedUrl = options.indexUrl as string;
      this.kind = 'index';
    }
    this.fetcher = options.fetcher;
    this.include = options.include;
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
    this.onError = options.onError;
  }

  async *pages(): AsyncIterable<ScrapedPage> {
    const fetcher = this.fetcher ?? defaultFetcherFor();
    let response: Awaited<ReturnType<Fetcher['fetch']>>;
    try {
      response = await fetcher.fetch(this.seedUrl);
    } catch (error) {
      this.onError?.({ url: this.seedUrl, error });
      return;
    }
    if (response.status < 200 || response.status >= 300) {
      this.onError?.({
        url: this.seedUrl,
        error: new Error(`seed fetch failed with status ${response.status}`),
      });
      return;
    }

    const candidates =
      this.kind === 'sitemap'
        ? extractSitemapUrls(response.text)
        : extractIndexUrls(response.text, this.seedUrl);
    const urls = filterDocUrls(candidates, this.seedUrl, this.include).slice(0, this.maxPages);

    const web = new WebConnector({ urls, fetcher, onError: this.onError });
    yield* web.pages();
  }
}

/** Parse `<loc>` entries out of a sitemap. Nested sitemap indexes are treated
 * as plain URLs; later filtering drops anything off-origin or off-prefix. */
export function extractSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const pattern = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match = pattern.exec(xml);
  while (match !== null) {
    if (match[1]) urls.push(decodeXmlEntities(match[1]));
    match = pattern.exec(xml);
  }
  return urls;
}

/** Parse `<a href>` targets out of an HTML index/nav page, resolving relative
 * hrefs against the index URL. Fragment-only and unresolvable hrefs are skipped. */
export function extractIndexUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const pattern = /<a\s[^>]*href=["']([^"']+)["']/gi;
  let match = pattern.exec(html);
  while (match !== null) {
    const href = match[1];
    if (href && !href.startsWith('#')) {
      try {
        urls.push(new URL(decodeXmlEntities(href), baseUrl).toString());
      } catch {
        // Unresolvable href — skip it.
      }
    }
    match = pattern.exec(html);
  }
  return urls;
}

/** Keep only http(s) URLs that share the seed's origin and (if given) start
 * with the include prefix, deduped while preserving discovery order. */
export function filterDocUrls(
  candidates: readonly string[],
  seedUrl: string,
  include?: string,
): string[] {
  const seedOrigin = new URL(seedUrl).origin;
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const candidate of candidates) {
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    if (parsed.origin !== seedOrigin) continue;
    if (include !== undefined && !parsed.pathname.startsWith(include)) continue;
    const normalized = parsed.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    kept.push(normalized);
  }
  return kept;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function defaultFetcherFor(): Fetcher {
  return {
    async fetch(url: string) {
      const response = await fetch(url);
      return { status: response.status, text: await response.text() };
    },
  };
}
