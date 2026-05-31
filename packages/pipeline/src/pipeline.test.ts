import { describe, expect, it } from 'vitest';
import { chunkText } from './chunker.js';
import { contentHash, dedupeByUrl } from './contentHash.js';

describe('chunkText', () => {
  it('returns a single chunk when text is short', () => {
    expect(chunkText('short text')).toEqual(['short text']);
  });

  it('returns empty array for empty input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });

  it('splits long text into overlapping chunks under the target size', () => {
    const text = `${'A'.repeat(800)}.\n\n${'B'.repeat(800)}.\n\n${'C'.repeat(800)}.`;
    const chunks = chunkText(text, 1000, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
  });

  it('is deterministic', () => {
    const text = 'word '.repeat(500);
    expect(chunkText(text)).toEqual(chunkText(text));
  });
});

describe('contentHash', () => {
  it('is deterministic and hex', () => {
    const hash = contentHash('hello world');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(contentHash('hello world')).toBe(hash);
  });

  it('differs for different text', () => {
    expect(contentHash('a')).not.toBe(contentHash('b'));
  });
});

describe('dedupeByUrl', () => {
  it('removes duplicate canonical URLs preserving first-seen order', () => {
    const out = dedupeByUrl([
      { url: 'https://example.com/pricing/?utm_source=x' },
      { url: 'https://example.com/pricing' },
      { url: 'https://other.com/' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.url).toBe('https://example.com/pricing/?utm_source=x');
  });
});
