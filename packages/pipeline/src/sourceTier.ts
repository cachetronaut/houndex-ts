/**
 * Deterministic source-tier classifier. The rubric is plain data (lists of
 * domains per tier), so non-engineers can extend coverage without a code
 * change.
 *
 * Precedence: authoritative domain → `authoritative` (wins over everything);
 * registrable root matches the normalized subject → `tier_1`; tier_2 list →
 * `tier_2`; tier_3 list → `tier_3`; otherwise `tier_4`.
 */

import { extractDomain, type SourceTier } from 'houndex/core';

export interface SourceTierRubric {
  tier_2_domains?: readonly string[];
  tier_3_domains?: readonly string[];
  authoritative_domains?: readonly string[];
}

function normalizeSubject(name: string): string {
  return name
    .toLowerCase()
    .split('')
    .filter((ch) => /[a-z0-9]/.test(ch))
    .join('');
}

export class SourceTierClassifier {
  private readonly tier2: ReadonlySet<string>;
  private readonly tier3: ReadonlySet<string>;
  private readonly authoritative: ReadonlySet<string>;

  constructor(rubric: SourceTierRubric = {}) {
    const lower = (list: readonly string[] | undefined): Set<string> =>
      new Set((list ?? []).map((domain) => domain.toLowerCase()));
    this.tier2 = lower(rubric.tier_2_domains);
    this.tier3 = lower(rubric.tier_3_domains);
    this.authoritative = lower(rubric.authoritative_domains);
  }

  classify(url: string, subject?: string): SourceTier {
    const registrable = extractDomain(url);
    const root = registrable.split('.')[0] ?? '';

    if (this.authoritative.has(registrable)) return 'authoritative';
    if (subject !== undefined && normalizeSubject(subject) === root) {
      return 'tier_1';
    }
    if (this.tier2.has(registrable)) return 'tier_2';
    if (this.tier3.has(registrable)) return 'tier_3';
    return 'tier_4';
  }
}
