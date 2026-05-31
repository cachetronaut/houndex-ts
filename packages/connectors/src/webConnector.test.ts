import { describe, expect, it } from 'vitest';
import {
  type Fetcher,
  type FetchResponse,
  WebConnector,
  type WebConnectorError,
} from './webConnector.js';

class FakeFetcher implements Fetcher {
  constructor(private readonly responses: ReadonlyMap<string, FetchResponse | Error>) {}

  async fetch(url: string): Promise<FetchResponse> {
    const response = this.responses.get(url);
    if (response === undefined) throw new Error(`missing fake response for ${url}`);
    if (response instanceof Error) throw response;
    return response;
  }
}

describe('WebConnector', () => {
  it('fetches explicit URLs and yields successful pages in input order', async () => {
    const fetcher = new FakeFetcher(
      new Map([
        ['https://example.com/b?utm_source=x', { status: 200, text: 'second' }],
        ['https://example.com/a', { status: 200, text: 'first' }],
      ]),
    );
    const connector = new WebConnector({
      urls: ['https://example.com/b?utm_source=x', 'https://example.com/a'],
      fetcher,
      concurrency: 2,
    });

    const pages = [];
    for await (const page of connector.pages()) pages.push(page);

    expect(pages).toEqual([
      {
        sourceUrl: 'https://example.com/b',
        title: 'example.com/b',
        text: 'second',
      },
      {
        sourceUrl: 'https://example.com/a',
        title: 'example.com/a',
        text: 'first',
      },
    ]);
  });

  it('skips failed fetches and non-2xx responses with onError events', async () => {
    const errors: WebConnectorError[] = [];
    const fetcher = new FakeFetcher(
      new Map<string, FetchResponse | Error>([
        ['https://example.com/good', { status: 200, text: 'good' }],
        ['https://example.com/missing', { status: 404, text: 'missing' }],
        ['https://example.com/error', new TypeError('network failed')],
      ]),
    );
    const connector = new WebConnector({
      urls: [
        'https://example.com/good',
        'https://example.com/missing',
        'https://example.com/error',
      ],
      fetcher,
      concurrency: 3,
      onError: (event) => errors.push(event),
    });

    const pages = [];
    for await (const page of connector.pages()) pages.push(page);

    expect(pages.map((page) => page.sourceUrl)).toEqual(['https://example.com/good']);
    expect(errors.map((event) => event.url)).toEqual([
      'https://example.com/missing',
      'https://example.com/error',
    ]);
    expect(errors[0]?.error).toBeInstanceOf(Error);
    expect(errors[1]?.error).toBeInstanceOf(TypeError);
  });
});
