import { describe, expect, it } from 'vitest';
import { computeEnrichment, type EnrichmentEdge } from './enrich.js';

const CLAIM = 'aaaaaaaaaaaaaaaa';
const edges: EnrichmentEdge[] = [
  { srcId: CLAIM, dstId: 'bbbbbbbbbbbbbbbb', kind: 'reinforces' },
  { srcId: 'cccccccccccccccc', dstId: CLAIM, kind: 'reinforces' },
  { srcId: CLAIM, dstId: 'dddddddddddddddd', kind: 'contradicts' },
  { srcId: CLAIM, dstId: 'source:1', kind: 'cites_source', attributes: { tier: 'tier_1' } },
  { srcId: CLAIM, dstId: 'source:2', kind: 'cites_source', attributes: { tier: 'tier_3' } },
  { srcId: 'eeeeeeeeeeeeeeee', dstId: 'ffffffffffffffff', kind: 'reinforces' }, // not incident
];

describe('computeEnrichment', () => {
  it('counts corroboration, contradiction, and source tiers', () => {
    const enrichment = computeEnrichment({ claimId: CLAIM, edges, semanticScore: 0.8 });
    expect(enrichment.corroborationCount.reinforces).toBe(2);
    expect(enrichment.contradictionCount).toBe(1);
    expect(enrichment.sourceTierDistribution.tier_1).toBe(1);
    expect(enrichment.sourceTierDistribution.tier_3).toBe(1);
    expect(enrichment.sourceCount).toBe(2);
    expect(enrichment.semanticScore).toBe(0.8);
    expect(enrichment.viaStructuralEdge).toBe(false);
  });

  it('is deterministic (same inputs -> byte-identical JSON)', () => {
    const a = computeEnrichment({ claimId: CLAIM, edges });
    const b = computeEnrichment({ claimId: CLAIM, edges });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('ignores non-incident edges', () => {
    const enrichment = computeEnrichment({ claimId: 'zzzzzzzzzzzzzzzz', edges });
    expect(enrichment.corroborationCount).toEqual({});
    expect(enrichment.sourceCount).toBe(0);
  });
});
