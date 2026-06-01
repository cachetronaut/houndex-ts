import { canonicalizeUrl, extractDomain, type ScrapedPage, type Source } from 'houndex/core';
import {
  type IngestionInput,
  type IngestionResult,
  type ProcessDeps,
  processPages,
} from 'houndex/pipeline';

export interface Connector {
  readonly name: string;
  pages(): AsyncIterable<ScrapedPage>;
}

export type SourceDraft = Omit<Source, 'tenantId'>;

export interface IngestConnectorOptions {
  upsertSource?: (source: SourceDraft) => Promise<void>;
  now?: () => number;
}

export async function ingestConnector(
  connector: Connector,
  input: IngestionInput,
  deps: ProcessDeps,
  options: IngestConnectorOptions = {},
): Promise<IngestionResult> {
  const pages: ScrapedPage[] = [];
  for await (const page of connector.pages()) {
    pages.push(page);
    if (options.upsertSource !== undefined) {
      await options.upsertSource(sourceDraftForPage(page, deps, input, options.now));
    }
  }
  return processPages(pages, input, deps);
}

function sourceDraftForPage(
  page: ScrapedPage,
  deps: ProcessDeps,
  input: IngestionInput,
  now: (() => number) | undefined,
): SourceDraft {
  const url = canonicalizeUrl(page.sourceUrl);
  return {
    url,
    title: page.title,
    domain: extractDomain(url),
    tier: deps.classifier.classify(page.sourceUrl, input.subject),
    fetchedAt: now?.() ?? Date.now(),
  };
}
