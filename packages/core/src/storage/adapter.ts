/**
 * The `StorageAdapter` contract — the single seam that decouples the framework
 * from any particular database. Every method takes a `TenantContext`, so a
 * conforming adapter scopes all reads and writes to a tenant by construction.
 * Implementations live in adapter packages (`houndex/storage-*`); the
 * pipeline and surfaces depend only on this interface.
 *
 * Records reuse the core schema types so an adapter never invents a parallel
 * shape. Ids are content-addressed by core (`computeClaimId`,
 * `edgeIdempotencyKey`), so upserts are idempotent: a repeat write of the same
 * logical record is a no-op, reported via `UpsertResult.created`.
 */

import type { ClaimId } from '../identity.js';
import type {
  Category,
  Claim,
  CurationStatus,
  Edge,
  KbAction,
  Run,
  Source,
  Verdict,
} from '../schemas/index.js';
import type { TenantContext } from '../tenant.js';

export interface UpsertResult {
  id: string;
  /** True if the write created a new record, false if it matched an existing one. */
  created: boolean;
}

// ── tenant + run lifecycle ─────────────────────────────────────────────

export interface EnsureTenantInput {
  tenant: TenantContext;
}

export interface CreateRunInput {
  tenant: TenantContext;
  runId: string;
  subject: string;
  signal?: string;
}

export interface CompleteRunInput {
  tenant: TenantContext;
  runId: string;
}

export interface FailRunInput {
  tenant: TenantContext;
  runId: string;
  reason?: string;
}

// ── evidence store: sources, claims, edges ─────────────────────────────

export interface UpsertSourceInput {
  tenant: TenantContext;
  source: Source;
}

export interface UpsertClaimInput {
  tenant: TenantContext;
  claim: Claim;
  /** Optional embedding for vector search; dimension must match the store. */
  embedding?: readonly number[];
}

export interface UpsertEdgeInput {
  tenant: TenantContext;
  edge: Edge;
}

export interface ClaimSearchInput {
  tenant: TenantContext;
  subject?: string;
  category?: Category;
  /** Optional query embedding for semantic search. */
  queryVector?: readonly number[];
  limit?: number;
}

export interface GetClaimInput {
  tenant: TenantContext;
  claimId: ClaimId;
}

// ── human curation ─────────────────────────────────────────────────────

export interface CurationSuggestionInput {
  tenant: TenantContext;
  suggestionId: string;
  claim: Claim;
  rationale?: string;
}

export interface DecideSuggestionInput {
  tenant: TenantContext;
  suggestionId: string;
  status: CurationStatus;
  /** Present when the curator edited the claim before approving. */
  editedClaim?: Claim;
  reason?: string;
}

// ── knowledge base (curated heads + non-destructive audit trail) ───────

export interface KbEntryRecord {
  tenantId: string;
  entryId: string;
  claim: Claim;
  status: CurationStatus;
  updatedAt: number;
}

export interface UpsertKbEntryInput {
  tenant: TenantContext;
  entryId: string;
  claim: Claim;
  action: KbAction;
}

export interface ListKbEntriesInput {
  tenant: TenantContext;
  subject?: string;
  category?: Category;
}

// ── verification overrides ─────────────────────────────────────────────

export interface VerificationOverrideInput {
  tenant: TenantContext;
  claimId: ClaimId;
  verdict: Verdict;
  reason: string;
}

/**
 * A tenant-scoped, storage-agnostic evidence store. Implementations must treat
 * every method as scoped to `input.tenant`; a read for one tenant must never
 * return another tenant's records.
 */
export interface StorageAdapter {
  ensureTenant(input: EnsureTenantInput): Promise<void>;
  createRun(input: CreateRunInput): Promise<Run>;
  completeRun(input: CompleteRunInput): Promise<void>;
  failRun(input: FailRunInput): Promise<void>;

  upsertSource(input: UpsertSourceInput): Promise<Source>;
  upsertClaim(input: UpsertClaimInput): Promise<UpsertResult>;
  upsertEdge(input: UpsertEdgeInput): Promise<UpsertResult>;
  searchClaims(input: ClaimSearchInput): Promise<Claim[]>;
  getClaim(input: GetClaimInput): Promise<Claim | null>;

  createCurationSuggestion(input: CurationSuggestionInput): Promise<void>;
  decideSuggestion(input: DecideSuggestionInput): Promise<void>;

  upsertKbEntry(input: UpsertKbEntryInput): Promise<void>;
  listKbEntries(input: ListKbEntriesInput): Promise<KbEntryRecord[]>;

  recordVerificationOverride(input: VerificationOverrideInput): Promise<void>;
}
