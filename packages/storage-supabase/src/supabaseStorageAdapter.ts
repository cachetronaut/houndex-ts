/**
 * Supabase (Postgres + pgvector) implementation of `StorageAdapter`. Maps each
 * contract method to a tenant-scoped query against the tables defined in the
 * repo's `supabase/migrations/`. Every read and write filters by `tenant_id`, so
 * isolation holds even when using a service-role key that bypasses RLS.
 */

import {
  type Claim,
  type ClaimSearchInput,
  type CompleteRunInput,
  type CreateRunInput,
  type CurationSuggestionInput,
  canonicalizeUrl,
  type DecideSuggestionInput,
  type EnsureTenantInput,
  edgeIdempotencyKey,
  type FailRunInput,
  type GetClaimInput,
  type KbEntryRecord,
  type ListKbEntriesInput,
  type Run,
  type Source,
  type StorageAdapter,
  sourceNodeId,
  type UpsertClaimInput,
  type UpsertEdgeInput,
  type UpsertKbEntryInput,
  type UpsertResult,
  type UpsertSourceInput,
  type VerificationOverrideInput,
} from 'houndex/core';
import type { FilterChain, Row, SupabaseLike } from './client.js';

const TABLE = {
  tenants: 'houndex_tenants',
  runs: 'houndex_runs',
  claims: 'houndex_claims',
  sources: 'houndex_sources',
  edges: 'houndex_edges',
  curation: 'houndex_curation_suggestions',
  kb: 'houndex_kb_entries',
  overrides: 'houndex_verification_overrides',
} as const;

const SEARCH_FN = 'houndex_search_claims';
const DEFAULT_MATCH_COUNT = 10;

function rowToClaim(row: Row): Claim {
  return {
    tenantId: row.tenant_id as string,
    claimId: row.claim_id as string,
    subject: row.subject as string,
    category: row.category as Claim['category'],
    polarity: row.polarity as Claim['polarity'],
    scope: row.scope as Claim['scope'],
    claimText: row.claim_text as string,
    evidenceText: row.evidence_text as string,
    confidence: row.confidence as Claim['confidence'],
    sourceUrl: row.source_url as string,
    sourceTier: row.source_tier as Claim['sourceTier'],
    extractedAt: row.extracted_at as number,
  };
}

function claimToRow(claim: Claim, embedding?: readonly number[]): Row {
  return {
    tenant_id: claim.tenantId,
    claim_id: claim.claimId,
    subject: claim.subject,
    category: claim.category,
    polarity: claim.polarity,
    scope: claim.scope,
    claim_text: claim.claimText,
    evidence_text: claim.evidenceText,
    confidence: claim.confidence,
    source_url: claim.sourceUrl,
    source_tier: claim.sourceTier,
    extracted_at: claim.extractedAt,
    embedding: embedding ? Array.from(embedding) : null,
  };
}

export class SupabaseStorageAdapter implements StorageAdapter {
  constructor(private readonly client: SupabaseLike) {}

  private async expect<T>(
    op: PromiseLike<{ data: T; error: { message: string } | null }>,
  ): Promise<T> {
    const { data, error } = await op;
    if (error !== null) throw new Error(error.message);
    return data;
  }

  private filtered(table: string, filters: ReadonlyArray<[string, unknown]>): FilterChain {
    let chain = this.client.from(table).select('*');
    for (const [column, value] of filters) chain = chain.eq(column, value);
    return chain;
  }

  private async selectOne(
    table: string,
    filters: ReadonlyArray<[string, unknown]>,
  ): Promise<Row | null> {
    return await this.expect(this.filtered(table, filters).maybeSingle());
  }

  async ensureTenant(input: EnsureTenantInput): Promise<void> {
    await this.expect(
      this.client
        .from(TABLE.tenants)
        .upsert(
          { tenant_id: input.tenant.tenantId, created_at: Date.now() },
          { onConflict: 'tenant_id', ignoreDuplicates: true },
        ),
    );
  }

  async createRun(input: CreateRunInput): Promise<Run> {
    const existing = await this.selectOne(TABLE.runs, [
      ['tenant_id', input.tenant.tenantId],
      ['run_id', input.runId],
    ]);
    const run: Run = {
      tenantId: input.tenant.tenantId,
      runId: input.runId,
      subject: input.subject,
      signal: input.signal,
      status: 'running',
      createdAt: Date.now(),
    };
    if (existing !== null) {
      return {
        tenantId: existing.tenant_id as string,
        runId: existing.run_id as string,
        subject: existing.subject as string,
        signal: (existing.signal as string | null) ?? undefined,
        status: existing.status as Run['status'],
        createdAt: existing.created_at as number,
      };
    }
    await this.expect(
      this.client.from(TABLE.runs).insert({
        tenant_id: run.tenantId,
        run_id: run.runId,
        subject: run.subject,
        signal: run.signal ?? null,
        status: run.status,
        created_at: run.createdAt,
      }),
    );
    return run;
  }

  async completeRun(input: CompleteRunInput): Promise<void> {
    await this.setStatus(input.tenant.tenantId, input.runId, 'complete');
  }

  async failRun(input: FailRunInput): Promise<void> {
    await this.setStatus(input.tenant.tenantId, input.runId, 'failed', input.reason);
  }

  private async setStatus(
    tenantId: string,
    runId: string,
    status: Run['status'],
    reason?: string,
  ): Promise<void> {
    let chain = this.client
      .from(TABLE.runs)
      .update({ status, reason: reason ?? null })
      .eq('tenant_id', tenantId);
    chain = chain.eq('run_id', runId);
    await this.expect(chain);
  }

  async upsertSource(input: UpsertSourceInput): Promise<Source> {
    const url = canonicalizeUrl(input.source.url);
    const sourceId = sourceNodeId(url);
    await this.expect(
      this.client.from(TABLE.sources).upsert(
        {
          tenant_id: input.tenant.tenantId,
          source_id: sourceId,
          url,
          title: input.source.title,
          domain: input.source.domain,
          tier: input.source.tier,
          fetched_at: input.source.fetchedAt,
        },
        { onConflict: 'tenant_id,source_id' },
      ),
    );
    return { ...input.source, url };
  }

  async upsertClaim(input: UpsertClaimInput): Promise<UpsertResult> {
    const existing = await this.selectOne(TABLE.claims, [
      ['tenant_id', input.tenant.tenantId],
      ['claim_id', input.claim.claimId],
    ]);
    if (existing !== null) return { id: input.claim.claimId, created: false };
    await this.expect(
      this.client.from(TABLE.claims).insert(claimToRow(input.claim, input.embedding)),
    );
    return { id: input.claim.claimId, created: true };
  }

  async upsertEdge(input: UpsertEdgeInput): Promise<UpsertResult> {
    const idempotencyKey = edgeIdempotencyKey({
      srcId: input.edge.srcId,
      dstId: input.edge.dstId,
      kind: input.edge.kind,
    });
    const existing = await this.selectOne(TABLE.edges, [
      ['tenant_id', input.tenant.tenantId],
      ['idempotency_key', idempotencyKey],
    ]);
    if (existing !== null) return { id: idempotencyKey, created: false };
    await this.expect(
      this.client.from(TABLE.edges).insert({
        tenant_id: input.tenant.tenantId,
        idempotency_key: idempotencyKey,
        src_id: input.edge.srcId,
        dst_id: input.edge.dstId,
        kind: input.edge.kind,
        attributes: input.edge.attributes ?? {},
      }),
    );
    return { id: idempotencyKey, created: true };
  }

  async searchClaims(input: ClaimSearchInput): Promise<Claim[]> {
    if (input.queryVector !== undefined) {
      const rows = await this.expect(
        this.client.rpc(SEARCH_FN, {
          p_tenant_id: input.tenant.tenantId,
          query_embedding: Array.from(input.queryVector),
          match_count: input.limit ?? DEFAULT_MATCH_COUNT,
          p_subject: input.subject ?? null,
          p_category: input.category ?? null,
        }),
      );
      return rows.map(rowToClaim);
    }
    const filters: Array<[string, unknown]> = [['tenant_id', input.tenant.tenantId]];
    if (input.subject !== undefined) filters.push(['subject', input.subject]);
    if (input.category !== undefined) filters.push(['category', input.category]);
    let chain = this.filtered(TABLE.claims, filters);
    if (input.limit !== undefined) chain = chain.limit(input.limit);
    const rows = await this.expect(chain);
    return rows.map(rowToClaim);
  }

  async getClaim(input: GetClaimInput): Promise<Claim | null> {
    const row = await this.selectOne(TABLE.claims, [
      ['tenant_id', input.tenant.tenantId],
      ['claim_id', input.claimId],
    ]);
    return row === null ? null : rowToClaim(row);
  }

  async createCurationSuggestion(input: CurationSuggestionInput): Promise<void> {
    await this.expect(
      this.client.from(TABLE.curation).upsert(
        {
          tenant_id: input.tenant.tenantId,
          suggestion_id: input.suggestionId,
          claim: input.claim,
          status: 'pending',
          rationale: input.rationale ?? null,
          created_at: Date.now(),
        },
        { onConflict: 'tenant_id,suggestion_id', ignoreDuplicates: true },
      ),
    );
  }

  async decideSuggestion(input: DecideSuggestionInput): Promise<void> {
    const values: Row = {
      status: input.status,
      reason: input.reason ?? null,
      decided_at: Date.now(),
    };
    if (input.editedClaim !== undefined) values.claim = input.editedClaim;
    let chain = this.client
      .from(TABLE.curation)
      .update(values)
      .eq('tenant_id', input.tenant.tenantId);
    chain = chain.eq('suggestion_id', input.suggestionId);
    await this.expect(chain);
  }

  async upsertKbEntry(input: UpsertKbEntryInput): Promise<void> {
    await this.expect(
      this.client.from(TABLE.kb).upsert(
        {
          tenant_id: input.tenant.tenantId,
          entry_id: input.entryId,
          claim: input.claim,
          status: input.action === 'rejected' ? 'rejected' : 'approved',
          subject: input.claim.subject,
          category: input.claim.category,
          updated_at: Date.now(),
        },
        { onConflict: 'tenant_id,entry_id' },
      ),
    );
  }

  async listKbEntries(input: ListKbEntriesInput): Promise<KbEntryRecord[]> {
    const filters: Array<[string, unknown]> = [['tenant_id', input.tenant.tenantId]];
    if (input.subject !== undefined) filters.push(['subject', input.subject]);
    if (input.category !== undefined) filters.push(['category', input.category]);
    const rows = await this.expect(this.filtered(TABLE.kb, filters));
    return rows.map((row) => ({
      tenantId: row.tenant_id as string,
      entryId: row.entry_id as string,
      claim: row.claim as Claim,
      status: row.status as KbEntryRecord['status'],
      updatedAt: row.updated_at as number,
    }));
  }

  async recordVerificationOverride(input: VerificationOverrideInput): Promise<void> {
    await this.expect(
      this.client.from(TABLE.overrides).insert({
        tenant_id: input.tenant.tenantId,
        claim_id: input.claimId,
        verdict: input.verdict,
        reason: input.reason,
        created_at: Date.now(),
      }),
    );
  }
}
