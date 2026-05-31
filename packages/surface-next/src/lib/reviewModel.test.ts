import { describe, expect, it } from 'vitest';
import { nextPendingIndex, type ReviewItem, summarizeReview } from './reviewModel.js';

const baseItem: ReviewItem = {
  claim: {
    tenantId: 'tenant',
    claimId: '1111111111111111',
    subject: 'Acme',
    category: 'capability',
    polarity: 'positive',
    scope: 'global',
    claimText: 'Acme keeps logs',
    evidenceText: 'Acme keeps logs',
    confidence: 'stated',
    sourceUrl: 'https://example.com',
    sourceTier: 'tier_2',
    extractedAt: 1,
  },
  sourceTitle: 'Source',
  sourceExcerpt: 'Excerpt',
  citation: {
    claimId: '1111111111111111',
    verdict: 'green',
    rationale: 'Direct support',
  },
  decision: 'pending',
};

describe('summarizeReview', () => {
  it('counts curation decisions and citation review state', () => {
    const items: ReviewItem[] = [
      baseItem,
      {
        ...baseItem,
        claim: { ...baseItem.claim, claimId: '2222222222222222' },
        citation: { claimId: '2222222222222222', verdict: 'yellow', rationale: 'Indirect' },
        decision: 'approved',
      },
      {
        ...baseItem,
        claim: { ...baseItem.claim, claimId: '3333333333333333' },
        citation: { claimId: '3333333333333333', verdict: 'red', rationale: 'Unsupported' },
        decision: 'rejected',
      },
    ];

    expect(summarizeReview(items)).toEqual({
      total: 3,
      approved: 1,
      rejected: 1,
      pending: 1,
      grounded: 1,
      needsReview: 2,
    });
  });
});

describe('nextPendingIndex', () => {
  it('wraps to the next pending item', () => {
    const items: ReviewItem[] = [
      { ...baseItem, decision: 'approved' },
      { ...baseItem, claim: { ...baseItem.claim, claimId: '2222222222222222' } },
      {
        ...baseItem,
        claim: { ...baseItem.claim, claimId: '3333333333333333' },
        decision: 'rejected',
      },
    ];

    expect(nextPendingIndex(items, 2)).toBe(1);
  });
});
