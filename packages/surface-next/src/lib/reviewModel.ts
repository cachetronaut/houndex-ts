import type { Claim } from '@houndex/core';

export type ReviewDecision = 'pending' | 'approved' | 'rejected';

export interface CitationReview {
  claimId: string;
  verdict: 'green' | 'yellow' | 'red';
  rationale: string;
}

export interface ReviewItem {
  claim: Claim;
  sourceTitle: string;
  sourceExcerpt: string;
  citation: CitationReview;
  decision: ReviewDecision;
}

export interface ReviewSummary {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  grounded: number;
  needsReview: number;
}

export function summarizeReview(items: readonly ReviewItem[]): ReviewSummary {
  let approved = 0;
  let rejected = 0;
  let grounded = 0;

  for (const item of items) {
    if (item.decision === 'approved') approved += 1;
    if (item.decision === 'rejected') rejected += 1;
    if (item.citation.verdict === 'green') grounded += 1;
  }

  return {
    total: items.length,
    approved,
    rejected,
    pending: items.length - approved - rejected,
    grounded,
    needsReview: items.length - grounded,
  };
}

export function nextPendingIndex(items: readonly ReviewItem[], currentIndex: number): number {
  if (items.length === 0) return -1;
  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (currentIndex + offset) % items.length;
    if (items[index]?.decision === 'pending') return index;
  }
  return currentIndex;
}
