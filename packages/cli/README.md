# houndex/cli

The `houndex` command — the **operator + CI surface** for the verification
engine. It does no verification itself: it loads config, builds the configured
`StorageAdapter`, and delegates to the same `houndex/core` + `houndex/evals`
engine your pipeline calls in-process. (Per-transaction verification belongs in
the library, on the hot path; the CLI is for setup, ingestion, and CI gates.)

```bash
houndex init                 # write houndex.config.json (adapter: local by default)
houndex doctor               # validate config + check adapter connectivity
houndex ingest claims.json   # load claims into the configured store
houndex ask "audit logging"  # grounded, verified answer envelope
houndex verify answer.json   # verify an answer against the store — exit 1 on failure
houndex eval suite.json      # score a fixture suite; exit 1 below --threshold
```

## Configuration

`houndex.config.json` (commit-safe — **secrets come from env, never the file**):

```json
{
  "adapter": "local",
  "tenant": { "tenantId": "default", "userId": "cli", "role": "admin" },
  "embedding": { "provider": "synthetic", "dimensions": 1536 }
}
```

- `adapter`: `local` (in-memory, zero-config default) | `supabase` | `convex`.
  Remote adapters read `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` or `CONVEX_URL`
  from the environment; `doctor` reports anything missing.
- `local` is **ephemeral** (state does not outlive the process) — ideal for CI
  and self-contained fixtures. Point `adapter` at `supabase`/`convex` to verify
  a live pipeline's evidence store across invocations.

## Verification semantics

`verify` floors `traceResolution` and `envelopeValidity` at `1.0`: an answer
that cites an unknown claim, or fails envelope schema validation, is a hard
FAIL (exit `1`). Exit-code convention: **`0`** pass · **`1`** verification/check
failure (the CI signal) · **`2`** operational error.

For runs against the ephemeral `local` adapter (or any CI run without a live
store), `verify`/`eval` input files may carry a self-contained `claimIds`
universe; omit it to check against the configured store instead.

```jsonc
// answer.json for `houndex verify`
{
  "envelope": { "tenantId": "default", "generatedAt": 0,
    "trace": [{ "claimId": "…", "mechanism": "vector_search", "semanticScore": null }],
    "payload": { "answer": "…", "citations": ["…"] } },
  "claimIds": ["…"]            // optional self-contained universe
}
```

## Synthetic provider

The default embedder is deterministic and synthetic (no API keys), so the CLI
runs fully offline and produces stable, assertable output. It is **not** a
semantic model — real embedders are wired via the library. The algorithm is
integer-exact and shared with the Python CLI, so vectors match across languages.

## Notes

- Ships TypeScript sources; the `houndex` bin runs them through the `tsx` loader
  (no build step, consistent with the rest of the workspace).
- Library entry (`houndex/cli`) re-exports the config, embedder, adapter
  factory, engine helpers, and command handlers for embedding in other tools.
