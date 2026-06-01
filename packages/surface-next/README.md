# houndex/surface-next

Optional Next.js UI surface (ingestion, curation, chat, citation verdicts,
provenance) built on synthetic data only.

## What it provides

- A synthetic claim review queue with approve, reject, and reopen controls.
- A selected-claim workspace showing evidence, source excerpt, citation verdict,
  and provenance flow.
- An envelope trace panel using the same `houndex/cli` and `houndex/evals`
  primitives as the CLI.

## Development

```bash
pnpm --filter houndex/surface-next dev
pnpm --filter houndex/surface-next typecheck
pnpm --filter houndex/surface-next test
```
