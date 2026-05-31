/**
 * Convex implementation of the `StorageAdapter` contract. Wraps a Convex client
 * (anything with `mutation`/`query`, e.g. `ConvexHttpClient` or a `convex-test`
 * harness) and drives the tenant-scoped functions in `../convex`. The trusted
 * server code that constructs the adapter supplies the `TenantContext`; every
 * call forwards it as the `tenant` argument the functions validate.
 */

import type {
  Claim,
  ClaimSearchInput,
  CompleteRunInput,
  CreateRunInput,
  CurationSuggestionInput,
  DecideSuggestionInput,
  EnsureTenantInput,
  FailRunInput,
  GetClaimInput,
  KbEntryRecord,
  ListKbEntriesInput,
  Run,
  Source,
  StorageAdapter,
  UpsertClaimInput,
  UpsertEdgeInput,
  UpsertKbEntryInput,
  UpsertResult,
  UpsertSourceInput,
  VerificationOverrideInput,
} from 'houndex/core';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import { api } from '../convex/_generated/api.js';

/** Minimal structural client — satisfied by `ConvexHttpClient` and `convex-test`. */
export interface ConvexClientLike {
  mutation<M extends FunctionReference<'mutation'>>(
    ref: M,
    args: FunctionArgs<M>,
  ): Promise<FunctionReturnType<M>>;
  query<Q extends FunctionReference<'query'>>(
    ref: Q,
    args: FunctionArgs<Q>,
  ): Promise<FunctionReturnType<Q>>;
}

interface ClaimRowLike {
  tenantId: string;
  claimId: string;
  subject: string;
  category: Claim['category'];
  polarity: Claim['polarity'];
  scope: Claim['scope'];
  claimText: string;
  evidenceText: string;
  confidence: Claim['confidence'];
  sourceUrl: string;
  sourceTier: Claim['sourceTier'];
  extractedAt: number;
}

function toClaim(doc: ClaimRowLike): Claim {
  return {
    tenantId: doc.tenantId,
    claimId: doc.claimId,
    subject: doc.subject,
    category: doc.category,
    polarity: doc.polarity,
    scope: doc.scope,
    claimText: doc.claimText,
    evidenceText: doc.evidenceText,
    confidence: doc.confidence,
    sourceUrl: doc.sourceUrl,
    sourceTier: doc.sourceTier,
    extractedAt: doc.extractedAt,
  };
}

export class ConvexStorageAdapter implements StorageAdapter {
  constructor(private readonly client: ConvexClientLike) {}

  async ensureTenant(input: EnsureTenantInput): Promise<void> {
    await this.client.mutation(api.tenants.ensureTenant, { tenant: input.tenant });
  }

  async createRun(input: CreateRunInput): Promise<Run> {
    const run = await this.client.mutation(api.runs.createRun, {
      tenant: input.tenant,
      runId: input.runId,
      subject: input.subject,
      signal: input.signal,
    });
    return {
      tenantId: run.tenantId,
      runId: run.runId,
      subject: run.subject,
      signal: run.signal,
      status: run.status,
      createdAt: run.createdAt,
    };
  }

  async completeRun(input: CompleteRunInput): Promise<void> {
    await this.client.mutation(api.runs.setRunStatus, {
      tenant: input.tenant,
      runId: input.runId,
      status: 'complete',
    });
  }

  async failRun(input: FailRunInput): Promise<void> {
    await this.client.mutation(api.runs.setRunStatus, {
      tenant: input.tenant,
      runId: input.runId,
      status: 'failed',
      reason: input.reason,
    });
  }

  async upsertSource(input: UpsertSourceInput): Promise<Source> {
    const row = await this.client.mutation(api.sources.upsertSource, {
      tenant: input.tenant,
      url: input.source.url,
      title: input.source.title,
      domain: input.source.domain,
      tier: input.source.tier,
      fetchedAt: input.source.fetchedAt,
    });
    return {
      tenantId: row.tenantId,
      url: row.url,
      title: row.title,
      domain: row.domain,
      tier: row.tier,
      fetchedAt: row.fetchedAt,
    };
  }

  async upsertClaim(input: UpsertClaimInput): Promise<UpsertResult> {
    const c = input.claim;
    return await this.client.mutation(api.claims.upsertClaim, {
      tenant: input.tenant,
      claimId: c.claimId,
      subject: c.subject,
      category: c.category,
      polarity: c.polarity,
      scope: c.scope,
      claimText: c.claimText,
      evidenceText: c.evidenceText,
      confidence: c.confidence,
      sourceUrl: c.sourceUrl,
      sourceTier: c.sourceTier,
      extractedAt: c.extractedAt,
      embedding: input.embedding ? Array.from(input.embedding) : undefined,
    });
  }

  async upsertEdge(input: UpsertEdgeInput): Promise<UpsertResult> {
    return await this.client.mutation(api.edges.upsertEdge, {
      tenant: input.tenant,
      srcId: input.edge.srcId,
      dstId: input.edge.dstId,
      kind: input.edge.kind,
      attributes: input.edge.attributes,
    });
  }

  async searchClaims(input: ClaimSearchInput): Promise<Claim[]> {
    const rows = await this.client.query(api.claims.searchClaims, {
      tenant: input.tenant,
      subject: input.subject,
      category: input.category,
      limit: input.limit,
    });
    return rows.map(toClaim);
  }

  async getClaim(input: GetClaimInput): Promise<Claim | null> {
    const doc = await this.client.query(api.claims.getClaim, {
      tenant: input.tenant,
      claimId: input.claimId,
    });
    return doc === null ? null : toClaim(doc);
  }

  async createCurationSuggestion(input: CurationSuggestionInput): Promise<void> {
    await this.client.mutation(api.curation.createCurationSuggestion, {
      tenant: input.tenant,
      suggestionId: input.suggestionId,
      claim: input.claim,
      rationale: input.rationale,
    });
  }

  async decideSuggestion(input: DecideSuggestionInput): Promise<void> {
    await this.client.mutation(api.curation.decideSuggestion, {
      tenant: input.tenant,
      suggestionId: input.suggestionId,
      status: input.status,
      editedClaim: input.editedClaim,
      reason: input.reason,
    });
  }

  async upsertKbEntry(input: UpsertKbEntryInput): Promise<void> {
    await this.client.mutation(api.kb.upsertKbEntry, {
      tenant: input.tenant,
      entryId: input.entryId,
      claim: input.claim,
      action: input.action,
      subject: input.claim.subject,
      category: input.claim.category,
    });
  }

  async listKbEntries(input: ListKbEntriesInput): Promise<KbEntryRecord[]> {
    const rows = await this.client.query(api.kb.listKbEntries, {
      tenant: input.tenant,
      subject: input.subject,
      category: input.category,
    });
    return rows.map((row) => ({
      tenantId: row.tenantId,
      entryId: row.entryId,
      claim: row.claim as Claim,
      status: row.status,
      updatedAt: row.updatedAt,
    }));
  }

  async recordVerificationOverride(input: VerificationOverrideInput): Promise<void> {
    await this.client.mutation(api.overrides.recordVerificationOverride, {
      tenant: input.tenant,
      claimId: input.claimId,
      verdict: input.verdict,
      reason: input.reason,
    });
  }
}
