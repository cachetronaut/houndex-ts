import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SourceTierClassifier } from 'houndex/pipeline';
import { describe, expect, it } from 'vitest';
import { ingestConnector, type SourceDraft } from './connector.js';
import { FileConnector } from './fileConnector.js';

async function makeFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'houndex-connectors-'));
  await mkdir(path.join(root, 'nested'));
  await writeFile(path.join(root, 'b.txt'), 'second', 'utf8');
  await writeFile(path.join(root, 'a.md'), 'first', 'utf8');
  await writeFile(path.join(root, 'nested', 'c.json'), '{"value":true}', 'utf8');
  await writeFile(path.join(root, 'nested', 'skip.csv'), 'ignored', 'utf8');
  return root;
}

describe('FileConnector', () => {
  it('walks included files in sorted relative path order', async () => {
    const root = await makeFixtureRoot();
    const connector = new FileConnector({ root, baseUrl: 'https://docs.example.com/base/' });

    const pages = [];
    for await (const page of connector.pages()) pages.push(page);

    expect(pages.map((page) => page.sourceUrl)).toEqual([
      'https://docs.example.com/base/a.md',
      'https://docs.example.com/base/b.txt',
      'https://docs.example.com/base/nested/c.json',
    ]);
    expect(pages.map((page) => page.title)).toEqual(['a.md', 'b.txt', 'c.json']);
    expect(pages.map((page) => page.text)).toEqual(['first', 'second', '{"value":true}']);
  });

  it('drives connector pages through processPages and optional source persistence', async () => {
    const root = await makeFixtureRoot();
    const connector = new FileConnector({
      root,
      include: ['.md'],
      baseUrl: 'https://docs.example.com',
    });
    const sources: SourceDraft[] = [];
    const sunkEmbeddings: Array<number[] | undefined> = [];

    const result = await ingestConnector(
      connector,
      { subject: 'Acme' },
      {
        classifier: new SourceTierClassifier(),
        extract: async ({ sourceUrl, sourceTier }) => ({
          kept: [
            {
              subject: 'Acme',
              sourceUrl,
              sourceTier,
              category: 'capability',
              polarity: 'positive',
              scope: 'global',
              claimText: 'Reads markdown files',
              evidenceText: 'first',
              confidence: 'stated',
            },
          ],
          dropped: [],
        }),
        embed: {
          dimension: 2,
          embed: async (texts) => texts.map(() => [0.1, 0.9]),
        },
        sink: async (claim) => {
          sunkEmbeddings.push(claim.embedding);
          return { claimId: 'claim1', created: true };
        },
      },
      {
        now: () => 1_700_000_000_000,
        upsertSource: async (source) => {
          sources.push(source);
        },
      },
    );

    expect(result.pagesScraped).toBe(1);
    expect(result.claimsCreated).toBe(1);
    expect(sunkEmbeddings).toEqual([[0.1, 0.9]]);
    expect(sources).toEqual([
      {
        url: 'https://docs.example.com/a.md',
        title: 'a.md',
        domain: 'example.com',
        tier: 'tier_4',
        fetchedAt: 1_700_000_000_000,
      },
    ]);
  });
});
