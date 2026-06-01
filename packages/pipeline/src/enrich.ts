/**
 * Deterministic enrichment. Pure over a claim's incident edges; byte-identical
 * for the same inputs, no model in the loop.
 *
 * Corroboration counts reinforces/refines/duplicates edges incident to the
 * claim; contradictions are tracked separately. Source-tier distribution is
 * tallied from the `tier` attribute on the claim's `cites_source` edges.
 */

import { type EdgeKind, type Enrichment, EnrichmentSchema, type SourceTier } from 'houndex/core';

const CORROBORATION_KINDS: readonly EdgeKind[] = ['reinforces', 'refines', 'duplicates'];

export interface EnrichmentEdge {
  srcId: string;
  dstId: string;
  kind: EdgeKind;
  attributes?: { tier?: string } | null;
}

function sortedNumberRecord<K extends string>(record: Record<string, number>): Record<K, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(record).sort()) out[key] = record[key] as number;
  return out as Record<K, number>;
}

export function computeEnrichment(input: {
  claimId: string;
  edges: readonly EnrichmentEdge[];
  semanticScore?: number | null;
  viaStructuralEdge?: boolean;
}): Enrichment {
  const incident = input.edges.filter(
    (edge) => edge.srcId === input.claimId || edge.dstId === input.claimId,
  );

  const corroboration: Record<string, number> = {};
  for (const kind of CORROBORATION_KINDS) {
    const count = incident.filter((edge) => edge.kind === kind).length;
    if (count > 0) corroboration[kind] = count;
  }

  const contradictionCount = incident.filter((edge) => edge.kind === 'contradicts').length;

  const distribution: Record<string, number> = {};
  for (const edge of incident) {
    if (edge.kind !== 'cites_source') continue;
    const tier = edge.attributes?.tier;
    if (tier !== undefined) distribution[tier] = (distribution[tier] ?? 0) + 1;
  }
  const sourceCount = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  return EnrichmentSchema.parse({
    corroborationCount: sortedNumberRecord<EdgeKind>(corroboration),
    contradictionCount,
    sourceTierDistribution: sortedNumberRecord<SourceTier>(distribution),
    sourceCount,
    semanticScore: input.semanticScore ?? null,
    viaStructuralEdge: input.viaStructuralEdge ?? false,
  });
}
