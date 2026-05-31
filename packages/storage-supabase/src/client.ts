/**
 * The slice of the `@supabase/supabase-js` client this adapter uses, as a
 * structural interface. A real `SupabaseClient` satisfies it; tests provide an
 * in-memory fake. Keeping it structural means the package has no hard runtime
 * dependency on `@supabase/supabase-js` (it is an optional peer).
 */

export interface PostgrestError {
  message: string;
}

export interface PostgrestResponse<T> {
  data: T;
  error: PostgrestError | null;
}

export type Row = Record<string, unknown>;

export interface FilterChain extends PromiseLike<PostgrestResponse<Row[]>> {
  select(columns?: string): FilterChain;
  eq(column: string, value: unknown): FilterChain;
  limit(count: number): FilterChain;
  maybeSingle(): PromiseLike<PostgrestResponse<Row | null>>;
}

export interface UpsertOptions {
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

export interface TableQuery {
  select(columns?: string): FilterChain;
  insert(rows: Row | Row[]): PromiseLike<PostgrestResponse<null>>;
  upsert(rows: Row | Row[], options?: UpsertOptions): PromiseLike<PostgrestResponse<null>>;
  update(values: Row): FilterChain;
}

export interface SupabaseLike {
  from(table: string): TableQuery;
  rpc(fn: string, args: Row): PromiseLike<PostgrestResponse<Row[]>>;
}
