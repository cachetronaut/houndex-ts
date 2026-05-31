import { describe, expect, it } from 'vitest';
import {
  DocsConnector,
  extractIndexUrls,
  extractSitemapUrls,
  filterDocUrls,
} from './docsConnector.js';
import type { Fetcher, FetchResponse } from './webConnector.js';

function fetcherFrom(responses: Map<string, FetchResponse>): Fetcher {
  return {
    async fetch(url: string): Promise<FetchResponse> {
      const response = responses.get(url);
      if (!response) throw new Error(`unexpected url ${url}`);
      return response;
    },
  };
}

describe('extractSitemapUrls', () => {
  it('reads loc entries and decodes entities', () => {
    const xml =
      '<urlset><url><loc>https://example.com/docs/a</loc></url>' +
      '<url><loc>https://example.com/docs/b?x=1&amp;y=2</loc></url></urlset>';
    expect(extractSitemapUrls(xml)).toEqual([
      'https://example.com/docs/a',
      'https://example.com/docs/b?x=1&y=2',
    ]);
  });
});

describe('extractIndexUrls', () => {
  it('resolves relative hrefs and skips fragments', () => {
    const html =
      '<a href="/docs/a">A</a><a href="guide/b">B</a><a href="#top">skip</a>' +
      '<a href="https://other.com/x">X</a>';
    expect(extractIndexUrls(html, 'https://example.com/docs/index.html')).toEqual([
      'https://example.com/docs/a',
      'https://example.com/docs/guide/b',
      'https://other.com/x',
    ]);
  });
});

describe('filterDocUrls', () => {
  it('keeps same-origin prefix matches, deduped in order', () => {
    const candidates = [
      'https://example.com/docs/a',
      'https://other.com/docs/a',
      'https://example.com/blog/c',
      'https://example.com/docs/a',
      'ftp://example.com/docs/d',
      'https://example.com/docs/b',
    ];
    expect(filterDocUrls(candidates, 'https://example.com/sitemap.xml', '/docs/')).toEqual([
      'https://example.com/docs/a',
      'https://example.com/docs/b',
    ]);
  });
});

describe('DocsConnector', () => {
  it('crawls a sitemap, filters, and yields fetched pages', async () => {
    const responses = new Map<string, FetchResponse>([
      [
        'https://example.com/sitemap.xml',
        {
          status: 200,
          text:
            '<urlset><url><loc>https://example.com/docs/a</loc></url>' +
            '<url><loc>https://example.com/blog/skip</loc></url>' +
            '<url><loc>https://example.com/docs/b</loc></url></urlset>',
        },
      ],
      ['https://example.com/docs/a', { status: 200, text: 'a' }],
      ['https://example.com/docs/b', { status: 200, text: 'b' }],
    ]);
    const connector = new DocsConnector({
      sitemapUrl: 'https://example.com/sitemap.xml',
      fetcher: fetcherFrom(responses),
      include: '/docs/',
    });
    const pages = [];
    for await (const page of connector.pages()) pages.push(page);
    expect(pages.map((page) => page.sourceUrl)).toEqual([
      'https://example.com/docs/a',
      'https://example.com/docs/b',
    ]);
    expect(pages.map((page) => page.text)).toEqual(['a', 'b']);
  });

  it('respects maxPages', async () => {
    const responses = new Map<string, FetchResponse>([
      [
        'https://example.com/sitemap.xml',
        {
          status: 200,
          text:
            '<urlset><url><loc>https://example.com/docs/a</loc></url>' +
            '<url><loc>https://example.com/docs/b</loc></url></urlset>',
        },
      ],
      ['https://example.com/docs/a', { status: 200, text: 'a' }],
    ]);
    const connector = new DocsConnector({
      sitemapUrl: 'https://example.com/sitemap.xml',
      fetcher: fetcherFrom(responses),
      maxPages: 1,
    });
    const pages = [];
    for await (const page of connector.pages()) pages.push(page);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.sourceUrl).toBe('https://example.com/docs/a');
  });

  it('reports a failed seed and yields nothing', async () => {
    const errors: string[] = [];
    const connector = new DocsConnector({
      sitemapUrl: 'https://example.com/sitemap.xml',
      fetcher: fetcherFrom(
        new Map([['https://example.com/sitemap.xml', { status: 404, text: '' }]]),
      ),
      onError: (event) => errors.push(event.url),
    });
    const pages = [];
    for await (const page of connector.pages()) pages.push(page);
    expect(pages).toHaveLength(0);
    expect(errors).toEqual(['https://example.com/sitemap.xml']);
  });

  it('rejects ambiguous seed configuration', () => {
    expect(
      () =>
        new DocsConnector({
          sitemapUrl: 'https://example.com/sitemap.xml',
          indexUrl: 'https://example.com/index.html',
          fetcher: fetcherFrom(new Map()),
        }),
    ).toThrow(/exactly one/);
  });
});
