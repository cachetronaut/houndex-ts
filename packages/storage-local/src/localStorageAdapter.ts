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
  type UpsertClaimInput,
  type UpsertEdgeInput,
  type UpsertKbEntryInput,
  type UpsertResult,
  type UpsertSourceInput,
  type VerificationOverrideInput,
} from 'houndex/core';

interface StoredClaim {
  claim: Claim;
  embedding?: readonly number[];
}

interface StoredSuggestion {
  claim: Claim;
  status: DecideSuggestionInput['status'];
  rationale?: string;
}

interface VerificationOverrideRecord {
  claimId: string;
  verdict: VerificationOverrideInput['verdict'];
  reason: string;
}

/**
 * All records for a single tenant. The top-level map is keyed by tenantId, so
 * no method can read across tenants.
 */
interface TenantStore {
  runs: Map<string, Run>;
  sources: Map<string, Source>;
  claims: Map<string, StoredClaim>;
  edges: Map<string, true>;
  suggestions: Map<string, StoredSuggestion>;
  kbEntries: Map<string, KbEntryRecord>;
  overrides: VerificationOverrideRecord[];
}

function emptyTenantStore(): TenantStore {
  return {
    runs: new Map(),
    sources: new Map(),
    claims: new Map(),
    edges: new Map(),
    suggestions: new Map(),
    kbEntries: new Map(),
    overrides: [],
  };
}

function cosineSimilarity(vectorA: readonly number[], vectorB: readonly number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(vectorA.length, vectorB.length);
  for (let index = 0; index < length; index += 1) {
    const left = vectorA[index] as number;
    const right = vectorB[index] as number;
    dot += left * right;
    normA += left * left;
    normB += right * right;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Zero-service, in-memory `StorageAdapter`. Every method is scoped to
 * `input.tenant.tenantId`; tenants are fully partitioned, so a read for one
 * tenant can never return another tenant's records. Useful for tests, local
 * development, and as the conformance reference for database-backed adapters.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly tenants = new Map<string, TenantStore>();

  private store(tenantId: string): TenantStore {
    let store = this.tenants.get(tenantId);
    if (store === undefined) {
      store = emptyTenantStore();
      this.tenants.set(tenantId, store);
    }
    return store;
  }

  async ensureTenant(input: EnsureTenantInput): Promise<void> {
    this.store(input.tenant.tenantId);
  }

  async createRun(input: CreateRunInput): Promise<Run> {
    const run: Run = {
      tenantId: input.tenant.tenantId,
      runId: input.runId,
      subject: input.subject,
      signal: input.signal,
      status: 'running',
      createdAt: Date.now(),
    };
    this.store(input.tenant.tenantId).runs.set(run.runId, run);
    return run;
  }

  async completeRun(input: CompleteRunInput): Promise<void> {
    this.setRunStatus(input.tenant.tenantId, input.runId, 'complete');
  }

  async failRun(input: FailRunInput): Promise<void> {
    this.setRunStatus(input.tenant.tenantId, input.runId, 'failed');
  }

  private setRunStatus(tenantId: string, runId: string, status: Run['status']): void {
    const run = this.store(tenantId).runs.get(runId);
    if (run !== undefined) run.status = status;
  }

  async upsertSource(input: UpsertSourceInput): Promise<Source> {
    const key = canonicalizeUrl(input.source.url);
    const source: Source = { ...input.source, url: key };
    this.store(input.tenant.tenantId).sources.set(key, source);
    return source;
  }

  async upsertClaim(input: UpsertClaimInput): Promise<UpsertResult> {
    const claims = this.store(input.tenant.tenantId).claims;
    const created = !claims.has(input.claim.claimId);
    claims.set(input.claim.claimId, { claim: input.claim, embedding: input.embedding });
    return { id: input.claim.claimId, created };
  }

  async upsertEdge(input: UpsertEdgeInput): Promise<UpsertResult> {
    const key = edgeIdempotencyKey({
      srcId: input.edge.srcId,
      dstId: input.edge.dstId,
      kind: input.edge.kind,
    });
    const edges = this.store(input.tenant.tenantId).edges;
    const created = !edges.has(key);
    edges.set(key, true);
    return { id: key, created };
  }

  async searchClaims(input: ClaimSearchInput): Promise<Claim[]> {
    const stored = [...this.store(input.tenant.tenantId).claims.values()];
    let matches = stored.filter(({ claim }) => {
      if (input.subject !== undefined && claim.subject !== input.subject) return false;
      if (input.category !== undefined && claim.category !== input.category) return false;
      return true;
    });

    if (input.queryVector !== undefined) {
      const query = input.queryVector;
      matches = matches
        .map((entry) => ({
          entry,
          score: entry.embedding ? cosineSimilarity(query, entry.embedding) : -1,
        }))
        .sort((first, second) => second.score - first.score)
        .map((scored) => scored.entry);
    }

    const claims = matches.map(({ claim }) => claim);
    return input.limit !== undefined ? claims.slice(0, input.limit) : claims;
  }

  async getClaim(input: GetClaimInput): Promise<Claim | null> {
    return this.store(input.tenant.tenantId).claims.get(input.claimId)?.claim ?? null;
  }

  async createCurationSuggestion(input: CurationSuggestionInput): Promise<void> {
    this.store(input.tenant.tenantId).suggestions.set(input.suggestionId, {
      claim: input.claim,
      status: 'pending',
      rationale: input.rationale,
    });
  }

  async decideSuggestion(input: DecideSuggestionInput): Promise<void> {
    const suggestion = this.store(input.tenant.tenantId).suggestions.get(input.suggestionId);
    if (suggestion === undefined) return;
    suggestion.status = input.status;
    if (input.editedClaim !== undefined) suggestion.claim = input.editedClaim;
  }

  async upsertKbEntry(input: UpsertKbEntryInput): Promise<void> {
    this.store(input.tenant.tenantId).kbEntries.set(input.entryId, {
      tenantId: input.tenant.tenantId,
      entryId: input.entryId,
      claim: input.claim,
      status: input.action === 'rejected' ? 'rejected' : 'approved',
      updatedAt: Date.now(),
    });
  }

  async listKbEntries(input: ListKbEntriesInput): Promise<KbEntryRecord[]> {
    return [...this.store(input.tenant.tenantId).kbEntries.values()].filter((entry) => {
      if (input.subject !== undefined && entry.claim.subject !== input.subject) return false;
      if (input.category !== undefined && entry.claim.category !== input.category) return false;
      return true;
    });
  }

  async recordVerificationOverride(input: VerificationOverrideInput): Promise<void> {
    this.store(input.tenant.tenantId).overrides.push({
      claimId: input.claimId,
      verdict: input.verdict,
      reason: input.reason,
    });
  }
}
