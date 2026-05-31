/**
 * Bridges the houndex/core taxonomy value-arrays into Convex `v.union`
 * literals so the closed vocabularies are declared exactly once (in core) and
 * the Convex schema derives from them — no duplicated literal lists.
 */

import { v } from 'convex/values';

export function literalUnion<T extends string>(values: readonly [T, T, ...T[]]) {
  const [first, second, ...rest] = values;
  return v.union(v.literal(first), v.literal(second), ...rest.map((value) => v.literal(value)));
}
