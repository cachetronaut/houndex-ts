import { canonicalizeUrl, type ScrapedPage } from 'houndex/core';
import type { Connector } from './connector.js';

const DEFAULT_CONCURRENCY = 4;

export interface FetchResponse {
  status: number;
  text: string;
}

export interface Fetcher {
  fetch(url: string): Promise<FetchResponse>;
}

export interface WebConnectorError {
  url: string;
  error: unknown;
}

export interface WebConnectorOptions {
  urls: readonly string[];
  fetcher?: Fetcher;
  concurrency?: number;
  onError?: (event: WebConnectorError) => void;
}

export class WebConnector implements Connector {
  readonly name = 'web';
  private readonly urls: readonly string[];
  private readonly fetcher: Fetcher;
  private readonly concurrency: number;
  private readonly onError: ((event: WebConnectorError) => void) | undefined;

  constructor(options: WebConnectorOptions) {
    this.urls = options.urls;
    this.fetcher = options.fetcher ?? defaultFetcher();
    this.concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
    this.onError = options.onError;
  }

  async *pages(): AsyncIterable<ScrapedPage> {
    for (let offset = 0; offset < this.urls.length; offset += this.concurrency) {
      const batch = this.urls.slice(offset, offset + this.concurrency);
      const pages = await Promise.all(batch.map((url) => this.fetchPage(url)));
      for (const page of pages) {
        if (page !== null) yield page;
      }
    }
  }

  private async fetchPage(url: string): Promise<ScrapedPage | null> {
    try {
      const response = await this.fetcher.fetch(url);
      if (response.status < 200 || response.status >= 300) {
        this.onError?.({ url, error: new Error(`fetch failed with status ${response.status}`) });
        return null;
      }
      const sourceUrl = canonicalizeUrl(url);
      return {
        sourceUrl,
        title: titleForUrl(sourceUrl),
        text: response.text,
      };
    } catch (error) {
      this.onError?.({ url, error });
      return null;
    }
  }
}

export function defaultFetcher(): Fetcher {
  return {
    async fetch(url: string): Promise<FetchResponse> {
      const response = await fetch(url);
      return { status: response.status, text: await response.text() };
    },
  };
}

function titleForUrl(url: string): string {
  const parsed = new URL(url);
  return parsed.pathname === '/' ? parsed.host : `${parsed.host}${parsed.pathname}`;
}
