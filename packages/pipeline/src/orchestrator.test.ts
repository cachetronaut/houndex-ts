import type { SearchPlan } from 'houndex/core';
import { describe, expect, it } from 'vitest';
import {
  type ExtractedClaimWithContext,
  type IngestionDeps,
  runIngestion,
} from './orchestrator.js';
import { SourceTierClassifier } from './sourceTier.js';

const plan: SearchPlan = {
  subject: 'Acme',
  queries: [{ query: 'q', intent: 'i' }],
};

function makeDeps(overrides: Partial<IngestionDeps> = {}): IngestionDeps {
  const baseClaim: ExtractedClaimWithContext = {
    subject: 'Acme',
    sourceUrl: 'https://example.com/a',
    sourceTier: 'tier_3',
    category: 'capability',
    polarity: 'positive',
    scope: 'global',
    claimText: 'Claim text here',
    evidenceText: 'Evidence quote',
    confidence: 'stated',
  };

  return {
    plan: async () => plan,
    search: {
      search: async () => [{ url: 'https://example.com/a', title: 't', snippet: 's' }],
    },
    scrape: {
      scrape: async () => ({ sourceUrl: 'https://example.com/a', title: 't', text: 'body' }),
    },
    classifier: new SourceTierClassifier(),
    extract: async () => ({ kept: [baseClaim], dropped: [] }),
    sink: async () => ({ claimId: 'id1', created: true }),
    embed: undefined,
    ...overrides,
  };
}

describe('runIngestion', () => {
  it('runs the full pipeline and reports stats', async () => {
    const result = await runIngestion({ subject: 'Acme' }, makeDeps());
    expect(result.pagesScraped).toBe(1);
    expect(result.claimsExtracted).toBe(1);
    expect(result.claimsCreated).toBe(1);
  });

  it('deduplicates identical scraped page text by content hash', async () => {
    const deps = makeDeps({
      search: {
        search: async () => [
          { url: 'https://example.com/a', title: 't', snippet: 's' },
          { url: 'https://example.com/b', title: 't', snippet: 's' },
        ],
      },
    });
    const result = await runIngestion({ subject: 'Acme' }, deps);
    // Both URLs scrape to identical text ("body"), so only one page survives.
    expect(result.pagesScraped).toBe(1);
  });

  it('survives a scrape that throws without aborting the run', async () => {
    const failed: string[] = [];
    const deps = makeDeps({
      search: {
        search: async () => [
          { url: 'https://example.com/a', title: 't', snippet: 's' },
          { url: 'https://bad.com/x', title: 't', snippet: 's' },
        ],
      },
      scrape: {
        scrape: async (url: string) => {
          if (url.includes('bad.com')) throw new TypeError('fetch failed');
          return { sourceUrl: url, title: 't', text: 'body' };
        },
      },
      onPageError: ({ sourceUrl }) => failed.push(sourceUrl),
    });
    const result = await runIngestion({ subject: 'Acme' }, deps);
    expect(result.pagesScraped).toBe(1);
    expect(result.claimsCreated).toBe(1);
    expect(failed).toEqual(['https://bad.com/x']);
  });

  it('counts a sink that reports created=false as deduped', async () => {
    const deps = makeDeps({ sink: async () => ({ claimId: 'id1', created: false }) });
    const result = await runIngestion({ subject: 'Acme' }, deps);
    expect(result.claimsCreated).toBe(0);
    expect(result.claimsDeduped).toBe(1);
  });
});
