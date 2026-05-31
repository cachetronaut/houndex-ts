/**
 * Edge schema for the claim graph. Both endpoints are required (no dangling
 * edges) and `kind` is a closed-vocabulary `EdgeKind`. The idempotency key is
 * a deterministic 16-hex digest over `(srcId, dstId, kind)`, so a backend
 * treats repeat writes as a no-op; tenant is the partition the edge lives in,
 * not part of the key.
 */

import { z } from 'zod';
import { sha256Hex } from '../hash.js';
import { tenantIdSchema } from '../tenant.js';
import { EdgeKindSchema } from './taxonomy.js';

const NODE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_:./@-]{0,254}$/;

export const EdgeSchema = z.object({
  tenantId: tenantIdSchema,
  srcId: z.string().regex(NODE_ID_RE),
  dstId: z.string().regex(NODE_ID_RE),
  kind: EdgeKindSchema,
  attributes: z.record(z.string(), z.unknown()).default({}),
});
export type Edge = z.infer<typeof EdgeSchema>;

/**
 * Deterministic 16-hex digest over (srcId, dstId, kind). Two edges with the
 * same triple share a key regardless of attribute drift.
 */
export function edgeIdempotencyKey(input: { srcId: string; dstId: string; kind: string }): string {
  const payload = [input.srcId, input.dstId, input.kind].join('\0');
  return sha256Hex(payload).slice(0, 16);
}
