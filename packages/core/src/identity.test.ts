import { describe, expect, it } from 'vitest';
import { computeClaimId } from './identity.js';

const base = {
  tenantId: 'primary',
  subject: 'Acme',
  claimText: 'Ships a hosted control plane',
  sourceUrl: 'https://example.com/docs/control-plane',
};

describe('computeClaimId', () => {
  it('is a 16-char lowercase hex digest', () => {
    expect(computeClaimId(base)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for identical input', () => {
    expect(computeClaimId(base)).toBe(computeClaimId({ ...base }));
  });

  it('collapses claim-text whitespace and case', () => {
    expect(computeClaimId({ ...base, claimText: '  Ships a   hosted CONTROL plane ' })).toBe(
      computeClaimId(base),
    );
  });

  it('collapses subject whitespace and case', () => {
    expect(computeClaimId({ ...base, subject: '  acme ' })).toBe(computeClaimId(base));
  });

  it('ignores url scheme, query, fragment, and trailing slash', () => {
    expect(
      computeClaimId({
        ...base,
        sourceUrl: 'http://example.com/docs/control-plane/?utm_source=x#section',
      }),
    ).toBe(computeClaimId(base));
  });

  it('is isolated by tenant', () => {
    expect(computeClaimId({ ...base, tenantId: 'secondary' })).not.toBe(computeClaimId(base));
  });

  it('changes when the claim text differs meaningfully', () => {
    expect(computeClaimId({ ...base, claimText: 'Ships an on-prem appliance' })).not.toBe(
      computeClaimId(base),
    );
  });
});
