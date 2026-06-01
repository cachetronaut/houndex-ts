# houndex/evals

The verification engine: a deterministic, in-process rubric that scores an
`OutputEnvelope` against an evidence store. This is the per-transaction verifier
a pipeline calls on each answer. The `houndex/cli` `verify` and `eval` commands
wrap this same engine, so a CLI verdict and a library verdict are identical.

## What it provides

- **`scoreEnvelope(fixture, envelope, graph)`** — scores an envelope on three
  domain-agnostic dimensions:
  - `traceResolution` — every claim id in the envelope's trace resolves to a
    known claim in the supplied graph state.
  - `envelopeValidity` — the value round-trips through the `OutputEnvelope`
    schema. A malformed envelope is a hard failure regardless of other scores.
  - `determinism` — canonical-JSON hash against the fixture's baseline; with no
    baseline this sub-score is skipped and the weight is renormalized.
- **`EvalFixture`** — declares structural expectations (minimum trace entries,
  required claim ids) and rubric configuration (weights, floors, baseline hash).
- **`formatReport`** — renders scored fixtures as a Markdown regression report.

## Usage

```ts
import { scoreEnvelope } from 'houndex/evals';

const score = scoreEnvelope(fixture, answerEnvelope, { claimIds });
if (!score.passed) {
  // the answer is not grounded in the evidence store
}
```

Set a floor of `1.0` on `traceResolution` and `envelopeValidity` to fail any
answer that cites an unknown claim or is structurally invalid. Mirrors the
Python `houndex-evals` package.
