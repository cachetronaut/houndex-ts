import { buildAnswerEnvelope, buildClaim, defaultVerifyFixture } from 'houndex/cli/engine';
import type { Claim } from 'houndex/core';
import { scoreEnvelope } from 'houndex/evals';
import type { ReviewItem } from './reviewModel';

const GENERATED_AT = 1_700_000_000_000;
const TENANT_ID = 'demo-tenant';

function claim(content: Omit<Claim, 'tenantId' | 'claimId'>): Claim {
  return buildClaim(TENANT_ID, content);
}

const claims = [
  claim({
    subject: 'Acme',
    category: 'capability',
    polarity: 'positive',
    scope: 'global',
    claimText: 'Acme retains immutable audit logs for privileged workspace actions.',
    evidenceText: 'Privileged workspace actions are written to immutable audit logs.',
    confidence: 'stated',
    sourceUrl: 'https://docs.example.com/security/audit-logs',
    sourceTier: 'tier_2',
    extractedAt: GENERATED_AT,
  }),
  claim({
    subject: 'Acme',
    category: 'limitation',
    polarity: 'negative',
    scope: 'global',
    claimText: 'Acme has not documented a customer-controlled retention override.',
    evidenceText: 'The retention section lists defaults but no customer override field.',
    confidence: 'inferred',
    sourceUrl: 'https://docs.example.com/security/retention',
    sourceTier: 'tier_3',
    extractedAt: GENERATED_AT,
  }),
  claim({
    subject: 'Acme',
    category: 'capability',
    polarity: 'positive',
    scope: 'scoped',
    claimText: 'Acme exports review packets as signed JSON envelopes.',
    evidenceText: 'Review packets can be exported as signed JSON envelopes.',
    confidence: 'stated',
    sourceUrl: 'https://docs.example.com/review/export',
    sourceTier: 'tier_2',
    extractedAt: GENERATED_AT,
  }),
];

export const reviewItems: ReviewItem[] = [
  {
    claim: claims[0] as Claim,
    sourceTitle: 'Security guide: audit logs',
    sourceExcerpt:
      'Privileged workspace actions are written to immutable audit logs and can be inspected by administrators.',
    citation: {
      claimId: (claims[0] as Claim).claimId,
      verdict: 'green',
      rationale: 'The evidence directly states the audit log behavior.',
    },
    decision: 'pending',
  },
  {
    claim: claims[1] as Claim,
    sourceTitle: 'Security guide: retention',
    sourceExcerpt:
      'The retention section lists default windows. It does not mention a customer override field.',
    citation: {
      claimId: (claims[1] as Claim).claimId,
      verdict: 'yellow',
      rationale: 'The statement depends on absence in the section, so it needs reviewer judgment.',
    },
    decision: 'pending',
  },
  {
    claim: claims[2] as Claim,
    sourceTitle: 'Review export reference',
    sourceExcerpt:
      'Review packets can be exported as signed JSON envelopes for downstream audit systems.',
    citation: {
      claimId: (claims[2] as Claim).claimId,
      verdict: 'green',
      rationale: 'The claim repeats the source language closely.',
    },
    decision: 'pending',
  },
];

export const demoEnvelope = buildAnswerEnvelope(
  TENANT_ID,
  'Which Acme claims need review before publication?',
  claims,
  GENERATED_AT,
);

export const demoVerdict = scoreEnvelope(defaultVerifyFixture(), demoEnvelope, {
  claimIds: claims.map((item) => item.claimId),
});
