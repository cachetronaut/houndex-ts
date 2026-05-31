/**
 * Synthetic, deterministic embedder — the CLI's zero-dependency default, so the
 * whole tool runs offline with no API keys and produces stable, assertable
 * output. NOT a semantic model: identical text → identical vector, and the
 * algorithm is integer-exact so the Python CLI reproduces the same vectors
 * byte-for-byte (shared parity fixture). Real embedders are wired via the library.
 *
 * Construction: FNV-1a/32 hash of the text seeds a 32-bit LCG; each step yields
 * one component in [-1, 1); the vector is then L2-normalized. All arithmetic is
 * 32-bit (Math.imul / >>> 0) to match Python's `& 0xFFFFFFFF`.
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const LCG_MULT = 1664525;
const LCG_INC = 1013904223;
const UINT32 = 4294967296;

function fnv1a32(text: string): number {
  let hash = FNV_OFFSET;
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash = Math.imul(hash ^ byte, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

export interface Embedder {
  readonly dimensions: number;
  embed(text: string): number[];
}

export function syntheticEmbedder(dimensions: number): Embedder {
  return {
    dimensions,
    embed(text: string): number[] {
      let state = fnv1a32(text) || 1;
      const vector = new Array<number>(dimensions);
      for (let index = 0; index < dimensions; index++) {
        state = (Math.imul(LCG_MULT, state) + LCG_INC) >>> 0;
        vector[index] = (state / UINT32) * 2 - 1;
      }
      const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
      return vector.map((value) => value / norm);
    },
  };
}
