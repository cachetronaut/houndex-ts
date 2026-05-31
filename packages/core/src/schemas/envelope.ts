/**
 * Versioned, self-describing `OutputEnvelope<T>`. A downstream consumer can
 * validate against `schemaUrl` and reason from the embedded provenance `trace`
 * instead of guessing how a result was produced. Generic over the payload via
 * a builder function (Zod has no native generic object schemas).
 */

import { z } from 'zod';

export const ENVELOPE_SCHEMA_VERSION = 'v1.0.0';
export const ENVELOPE_SCHEMA_URL = 'https://houndex.example/schemas/output_envelope.v1.json';
export const ENGINE_VERSION = '0.1.0';

/**
 * One provenance step: which claim contributed, by what mechanism (e.g. a
 * retrieval method or graph edge), and an optional semantic score.
 */
export const TraceEntrySchema = z.object({
  claimId: z.string(),
  mechanism: z.string().min(1),
  semanticScore: z.number().nullable().default(null),
});
export type TraceEntry = z.infer<typeof TraceEntrySchema>;

export function outputEnvelopeSchema<T extends z.ZodTypeAny>(
  payloadSchema: T,
): z.ZodObject<{
  schemaVersion: z.ZodDefault<z.ZodString>;
  schemaUrl: z.ZodDefault<z.ZodString>;
  tenantId: z.ZodString;
  generatedAt: z.ZodNumber;
  engineVersion: z.ZodDefault<z.ZodString>;
  trace: z.ZodDefault<z.ZodArray<typeof TraceEntrySchema>>;
  payload: T;
}> {
  return z.object({
    schemaVersion: z
      .string()
      .regex(/^v\d+\.\d+\.\d+$/)
      .default(ENVELOPE_SCHEMA_VERSION),
    schemaUrl: z.string().min(1).default(ENVELOPE_SCHEMA_URL),
    tenantId: z.string().min(1).max(64),
    generatedAt: z.number(),
    engineVersion: z.string().min(1).default(ENGINE_VERSION),
    trace: z.array(TraceEntrySchema).default([]),
    payload: payloadSchema,
  });
}
