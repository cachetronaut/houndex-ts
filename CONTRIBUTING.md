# Contributing

Thanks for your interest in the project.

## Getting started

```bash
pnpm install
pnpm verify
```

`pnpm verify` runs the full local gate: Biome (lint + format check),
`tsc --noEmit` (strict), Vitest, and the clean-room guard.

## Conventions

- **Types are the source of truth.** Schemas are declared once (Zod) and types
  derive from them. Prefer returning explicit types from functions.
- **Closed vocabularies are code-owned**, declared as a single value array and
  consumed everywhere — never duplicated as string literals.
- **No `any`.** Strict TypeScript, `noUncheckedIndexedAccess` on.
- Keep changes surgical and well-tested. New behavior ships with a test.

## Commits & releases

We use [Changesets](https://github.com/changesets/changesets). If your change
affects a published package, run `pnpm changeset` and describe it.

## Clean-room guard

CI runs `pnpm cleanroom`, which fails if any disallowed token appears in tracked
files. This keeps the framework free of names and terminology from the
applications that use it. If the guard flags a false positive, adjust the
allowlist in `scripts/cleanroom-guard.mjs` with justification.
