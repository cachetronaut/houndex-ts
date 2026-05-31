/**
 * Ingestion pipeline orchestration — the deterministic spine that sequences:
 *   plan → search → dedupe → scrape → classify tier → chunk → extract →
 *   (embed) → sink(upsertClaim)
 *
 * It is dependency-injected over the provider/extractor ports, so the whole
 * sequence is unit-testable offline with in-memory fakes (no network, no
 * model). A real deployment supplies the concrete providers, an extractor, and
 * a `sink` backed by a `StorageAdapter`.
 */

import type {
  Embedder,
  ExtractedClaim,
  Scraper,
  SearchPlan,
  SearchProvider,
  SourceTier,
} from '@houndex/core';
import { chunkText } from './chunker.js';
import { contentHash, dedupeByUrl } from './contentHash.js';
import type { SourceTierClassifier } from './sourceTier.js';

export interface ExtractedClaimWithContext extends ExtractedClaim {
  subject: string;
  sourceUrl: string;
  sourceTier: SourceTier;
}

export interface ExtractionOutcome {
  kept: ExtractedClaimWithContext[];
  dropped: Array<{ claim: ExtractedClaim; reason: string }>;
}

export interface IngestionInput {
  subject: string;
  signal?: string;
}

export type ClaimSink = (claim: ExtractedClaimWithContext & { embedding?: number[] }) => Promise<{
  claimId: string;
  created: boolean;
}>;

export interface IngestionDeps {
  plan: (input: IngestionInput) => Promise<SearchPlan>;
  search: SearchProvider;
  scrape: Scraper;
  classifier: SourceTierClassifier;
  extract: (input: {
    subject: string;
    sourceUrl: string;
    sourceTier: SourceTier;
    pageText: string;
  }) => Promise<ExtractionOutcome>;
  sink: ClaimSink;
  embed?: Embedder;
  maxResultsPerQuery?: number;
  maxPages?: number;
  extractionConcurrency?: number;
  onPageError?: (event: { sourceUrl: string; error: unknown }) => void;
}

const DEFAULT_MAX_PAGES = 25;
const DEFAULT_EXTRACTION_CONCURRENCY = 4;

export interface IngestionResult {
  pagesScraped: number;
  pagesFailed: number;
  claimsExtracted: number;
  claimsDropped: number;
  claimsCreated: number;
  claimsDeduped: number;
  scrapedHashes: string[];
}

export async function runIngestion(
  input: IngestionInput,
  deps: IngestionDeps,
): Promise<IngestionResult> {
  const plan = await deps.plan(input);

  const allResults = [];
  for (const query of plan.queries) {
    const results = await deps.search.search(query.query, deps.maxResultsPerQuery);
    allResults.push(...results);
  }
  const maxPages = deps.maxPages ?? DEFAULT_MAX_PAGES;
  const unique = dedupeByUrl(allResults).slice(0, maxPages);

  const result: IngestionResult = {
    pagesScraped: 0,
    pagesFailed: 0,
    claimsExtracted: 0,
    claimsDropped: 0,
    claimsCreated: 0,
    claimsDeduped: 0,
    scrapedHashes: [],
  };

  const scraped = await Promise.all(
    unique.map(async (r) => {
      try {
        return await deps.scrape.scrape(r.url);
      } catch (error) {
        deps.onPageError?.({ sourceUrl: r.url, error });
        return null;
      }
    }),
  );

  const seenHashes = new Set<string>();
  const pages = [];
  for (const page of scraped) {
    if (page === null) continue;
    const hash = contentHash(page.text);
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);
    result.pagesScraped += 1;
    result.scrapedHashes.push(hash);
    pages.push(page);
  }

  type PageOutcome = { kept: ExtractedClaimWithContext[]; embedding?: number[] };
  const concurrency = Math.max(1, deps.extractionConcurrency ?? DEFAULT_EXTRACTION_CONCURRENCY);
  const sinkable: PageOutcome[] = [];

  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);
    const outcomes = await Promise.all(
      batch.map(async (page): Promise<PageOutcome | null> => {
        const sourceTier = deps.classifier.classify(page.sourceUrl, input.subject);

        const chunks = chunkText(page.text);
        const embedding =
          deps.embed !== undefined && chunks.length > 0
            ? (await deps.embed.embed([chunks[0] as string]))[0]
            : undefined;

        let outcome: ExtractionOutcome;
        try {
          outcome = await deps.extract({
            subject: input.subject,
            sourceUrl: page.sourceUrl,
            sourceTier,
            pageText: page.text,
          });
        } catch (error) {
          result.pagesFailed += 1;
          deps.onPageError?.({ sourceUrl: page.sourceUrl, error });
          return null;
        }
        result.claimsExtracted += outcome.kept.length;
        result.claimsDropped += outcome.dropped.length;
        return { kept: outcome.kept, embedding };
      }),
    );
    for (const outcome of outcomes) {
      if (outcome !== null) sinkable.push(outcome);
    }
  }

  for (const { kept, embedding } of sinkable) {
    for (const claim of kept) {
      const sunk = await deps.sink({ ...claim, embedding });
      if (sunk.created) result.claimsCreated += 1;
      else result.claimsDeduped += 1;
    }
  }

  return result;
}
