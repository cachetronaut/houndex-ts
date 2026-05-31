/**
 * Regression-fixture schema. A fixture declares structural expectations about
 * an `OutputEnvelope` produced for some input — never byte-exact bodies, so
 * model/prompt drift doesn't break the suite; only a real regression does.
 */

import { z } from 'zod';

export const EvalFixtureSchema = z.object({
  /** Kebab-case slug; matches the fixture filename for round-trip. */
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case'),
  description: z.string().min(1),
  expected: z
    .object({
      /** Minimum number of provenance trace entries the envelope must carry. */
      minTraceEntries: z.number().int().nonnegative().default(0),
      /** Claim ids that must appear among the envelope's trace entries. */
      requiredClaimIds: z.array(z.string().min(1)).default([]),
    })
    .default({}),
  rubric: z
    .object({
      weights: z.record(z.string(), z.number().nonnegative()).default({}),
      floors: z.record(z.string(), z.number().min(0).max(1)).default({}),
      /** Canonical-JSON hash of a known-good envelope. Set after first capture. */
      baselineHash: z.string().optional(),
    })
    .default({}),
});
export type EvalFixture = z.infer<typeof EvalFixtureSchema>;
