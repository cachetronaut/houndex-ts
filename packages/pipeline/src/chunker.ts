/**
 * Deterministic text chunker for embedding. Caps each chunk at `targetChars`
 * then walks back to the nearest paragraph/sentence/whitespace boundary;
 * adjacent chunks share a fixed-size overlap window for retrieval context. The
 * algorithm and defaults are fixed so chunk boundaries — and the content hashes
 * derived from them — are stable and match a reference implementation.
 */

const BOUNDARY_PREFERENCE = ['\n\n', '. ', '\n', ' '] as const;

export function chunkText(
  text: string,
  targetChars: number = 1200,
  overlapChars: number = 100,
): string[] {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  if (trimmed.length <= targetChars) return [trimmed];

  const chunks: string[] = [];
  let cursor = 0;
  const length = trimmed.length;

  while (cursor < length) {
    let end = Math.min(cursor + targetChars, length);
    if (end < length) {
      const window = trimmed.slice(cursor, end);
      for (const separator of BOUNDARY_PREFERENCE) {
        const position = window.lastIndexOf(separator);
        if (position > Math.floor(targetChars / 2)) {
          end = cursor + position + separator.length;
          break;
        }
      }
    }
    const chunk = trimmed.slice(cursor, end).trim();
    if (chunk !== '') chunks.push(chunk);
    const nextCursor = overlapChars > 0 ? end - overlapChars : end;
    cursor = Math.max(nextCursor, cursor + 1);
  }

  return chunks;
}
