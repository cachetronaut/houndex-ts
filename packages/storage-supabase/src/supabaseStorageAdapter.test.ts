import {
  type Claim,
  computeClaimId,
  type Edge,
  tenantPrimary,
  tenantSecondary,
} from '@houndex/core';
import { describe, expect, it } from 'vitest';
import type { Row, SupabaseLike } from './client.js';
import { SupabaseStorageAdapter } from './supabaseStorageAdapter.js';

// ── Minimal in-memory Supabase fake (enough of the query builder to exercise
//    the adapter behaviorally; vector-search rpc returns empty). ────────────

interface Resp<T> {
  data: T;
  error: { message: string } | null;
}

class Chain {
  private filters: Array<[string, unknown]> = [];
  private limitN: number | undefined;
  constructor(
    private readonly rows: Row[],
    private readonly mode: 'select' | 'update',
    private readonly values?: Row,
  ) {}
  select(): this {
    return this;
  }
  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }
  limit(count: number): this {
    this.limitN = count;
    return this;
  }
  private match(): Row[] {
    let out = this.rows.filter((r) => this.filters.every(([c, v]) => r[c] === v));
    if (this.limitN !== undefined) out = out.slice(0, this.limitN);
    return out;
  }
  async maybeSingle(): Promise<Resp<Row | null>> {
    return { data: this.match()[0] ?? null, error: null };
  }
  // biome-ignore lint/suspicious/noThenProperty: the fake query builder is intentionally thenable, mirroring supabase-js.
  then<R>(resolve: (value: Resp<Row[]>) => R): R {
    const matched = this.match();
    if (this.mode === 'update' && this.values !== undefined) {
      for (const row of matched) Object.assign(row, this.values);
    }
    return resolve({ data: matched, error: null });
  }
}

class Table {
  constructor(private readonly rows: Row[]) {}
  select(): Chain {
    return new Chain(this.rows, 'select');
  }
  update(values: Row): Chain {
    return new Chain(this.rows, 'update', values);
  }
  async insert(rows: Row | Row[]): Promise<Resp<null>> {
    for (const row of Array.isArray(rows) ? rows : [rows]) this.rows.push({ ...row });
    return { data: null, error: null };
  }
  async upsert(
    rows: Row | Row[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): Promise<Resp<null>> {
    const conflictColumns = (options?.onConflict ?? '')
      .split(',')
      .map((column) => column.trim())
      .filter(Boolean);
    for (const row of Array.isArray(rows) ? rows : [rows]) {
      const existingIndex =
        conflictColumns.length === 0
          ? -1
          : this.rows.findIndex((existingRow) =>
              conflictColumns.every((column) => existingRow[column] === row[column]),
            );
      if (existingIndex === -1) this.rows.push({ ...row });
      else if (options?.ignoreDuplicates !== true) this.rows[existingIndex] = { ...row };
    }
    return { data: null, error: null };
  }
}

class FakeSupabase {
  private readonly tables = new Map<string, Row[]>();
  private rowsOf(table: string): Row[] {
    let rows = this.tables.get(table);
    if (rows === undefined) {
      rows = [];
      this.tables.set(table, rows);
    }
    return rows;
  }
  from(table: string): Table {
    return new Table(this.rowsOf(table));
  }
  async rpc(): Promise<Resp<Row[]>> {
    return { data: [], error: null };
  }
}

function makeAdapter(): SupabaseStorageAdapter {
  return new SupabaseStorageAdapter(new FakeSupabase() as unknown as SupabaseLike);
}

function makeClaim(overrides: Partial<Claim> = {}): Claim {
  const subject = overrides.subject ?? 'Acme';
  const claimText = overrides.claimText ?? 'Has an audit log';
  const sourceUrl = overrides.sourceUrl ?? 'https://example.com/security';
  const tenantId = overrides.tenantId ?? 'primary';
  return {
    tenantId,
    claimId: computeClaimId({ tenantId, subject, claimText, sourceUrl }),
    subject,
    category: 'security',
    polarity: 'positive',
    scope: 'global',
    claimText,
    evidenceText: 'evidence',
    confidence: 'stated',
    sourceUrl,
    sourceTier: 'tier_2',
    extractedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('SupabaseStorageAdapter', () => {
  it('upserts claims idempotently and reads them back', async () => {
    const adapter = makeAdapter();
    await adapter.ensureTenant({ tenant: tenantPrimary() });
    const claim = makeClaim();
    expect((await adapter.upsertClaim({ tenant: tenantPrimary(), claim })).created).toBe(true);
    expect((await adapter.upsertClaim({ tenant: tenantPrimary(), claim })).created).toBe(false);
    expect(
      (await adapter.getClaim({ tenant: tenantPrimary(), claimId: claim.claimId }))?.subject,
    ).toBe('Acme');
  });

  it('filters search by subject', async () => {
    const adapter = makeAdapter();
    await adapter.upsertClaim({ tenant: tenantPrimary(), claim: makeClaim({ subject: 'Acme' }) });
    await adapter.upsertClaim({
      tenant: tenantPrimary(),
      claim: makeClaim({ subject: 'Globex', claimText: 'other' }),
    });
    const acme = await adapter.searchClaims({ tenant: tenantPrimary(), subject: 'Acme' });
    expect(acme).toHaveLength(1);
    expect(acme[0]?.subject).toBe('Acme');
  });

  it('never returns another tenant’s records', async () => {
    const adapter = makeAdapter();
    await adapter.upsertClaim({
      tenant: tenantPrimary(),
      claim: makeClaim({ tenantId: 'primary' }),
    });
    const claimId = makeClaim().claimId;
    expect(await adapter.getClaim({ tenant: tenantSecondary(), claimId })).toBeNull();
    expect(await adapter.searchClaims({ tenant: tenantSecondary() })).toHaveLength(0);
    expect(await adapter.searchClaims({ tenant: tenantPrimary() })).toHaveLength(1);
  });

  it('runs the run / edge / curation / kb / override flows', async () => {
    const adapter = makeAdapter();
    const run = await adapter.createRun({ tenant: tenantPrimary(), runId: 'r1', subject: 'Acme' });
    expect(run.status).toBe('running');
    await adapter.completeRun({ tenant: tenantPrimary(), runId: 'r1' });

    const edge: Edge = {
      tenantId: 'primary',
      srcId: 'claim:0000000000000001',
      dstId: 'claim:0000000000000002',
      kind: 'reinforces',
      attributes: {},
    };
    expect((await adapter.upsertEdge({ tenant: tenantPrimary(), edge })).created).toBe(true);
    expect((await adapter.upsertEdge({ tenant: tenantPrimary(), edge })).created).toBe(false);

    const claim = makeClaim();
    await adapter.createCurationSuggestion({ tenant: tenantPrimary(), suggestionId: 's1', claim });
    await adapter.decideSuggestion({
      tenant: tenantPrimary(),
      suggestionId: 's1',
      status: 'approved',
    });
    await adapter.upsertKbEntry({
      tenant: tenantPrimary(),
      entryId: 'e1',
      claim,
      action: 'approved',
    });
    const entries = await adapter.listKbEntries({ tenant: tenantPrimary(), subject: 'Acme' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe('approved');
    expect(entries[0]?.claim.subject).toBe('Acme');

    await adapter.recordVerificationOverride({
      tenant: tenantPrimary(),
      claimId: claim.claimId,
      verdict: 'green',
      reason: 'verified',
    });
  });
});
