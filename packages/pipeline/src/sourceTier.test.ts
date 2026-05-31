import { describe, expect, it } from 'vitest';
import { SourceTierClassifier } from './sourceTier.js';
import { loadSourceTierClassifier } from './sourceTierLoader.js';

const rubric = {
  tier_2_domains: ['trade-press.com'],
  tier_3_domains: ['forum.example'],
  authoritative_domains: ['sec.gov'],
};

describe('SourceTierClassifier', () => {
  const classifier = new SourceTierClassifier(rubric);

  it('classifies authoritative domains highest', () => {
    expect(classifier.classify('https://www.sec.gov/filing')).toBe('authoritative');
  });

  it('matches the subject root as tier_1', () => {
    expect(classifier.classify('https://acme.com/pricing', 'Acme')).toBe('tier_1');
  });

  it('uses the tier_2 and tier_3 lists', () => {
    expect(classifier.classify('https://trade-press.com/post')).toBe('tier_2');
    expect(classifier.classify('https://forum.example/thread')).toBe('tier_3');
  });

  it('falls back to tier_4', () => {
    expect(classifier.classify('https://random-blog.net/x')).toBe('tier_4');
  });

  it('defaults to an empty rubric with no arguments', () => {
    expect(new SourceTierClassifier().classify('https://sec.gov/x')).toBe('tier_4');
  });
});

describe('loadSourceTierClassifier', () => {
  it('accepts a JSON string', () => {
    const classifier = loadSourceTierClassifier(JSON.stringify(rubric));
    expect(classifier.classify('https://www.sec.gov/x')).toBe('authoritative');
  });

  it('accepts a parsed object', () => {
    const classifier = loadSourceTierClassifier(rubric);
    expect(classifier.classify('https://trade-press.com/x')).toBe('tier_2');
  });
});
