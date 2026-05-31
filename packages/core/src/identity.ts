/**
 * Content-addressed identity for claims.
 *
 * A claim's identity derives from the evidence that produced it, not from an
 * autoincrement column. Two ingestion runs that surface the same claim text
 * against the same source URL — for the same tenant and subject — collapse to
 * the same `ClaimId` in every store and any downstream graph projection.
 *
 * The ID is the first 16 hex chars of SHA-256 over a NUL-joined tuple of
 * (tenantId, subjectLower, normalizedClaimText, normalizedSourceUrl). The
 * tenant prefix keeps collisions structurally isolated to one tenant.
 */

import { sha256Hex } from './hash.js';

export type ClaimId = string;

const DIGEST_LEN = 16;
const WHITESPACE_RE = /\s+/g;

function normalizeClaimText(text: string): string {
  return text.replace(WHITESPACE_RE, ' ').trim().toLowerCase();
}

/**
 * Normalize a source URL for identity purposes. Only the authority (host) and
 * path participate; scheme, query, and fragment are discarded, and a trailing
 * slash on a non-root path is stripped. The whole result is lowercased.
 *
 * This deliberately reimplements host/path extraction rather than using the
 * WHATWG `URL` class so the output is portable and matches a reference Python
 * implementation built on `urllib.parse.urlsplit` exactly.
 */
function normalizeSourceUrl(url: string): string {
  let rest = url.trim();

  // Drop fragment.
  const hashIndex = rest.indexOf('#');
  if (hashIndex !== -1) rest = rest.slice(0, hashIndex);

  // Strip scheme (`scheme:`).
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+\-.]*):(.*)$/s.exec(rest);
  if (schemeMatch?.[2] !== undefined) rest = schemeMatch[2];

  // Authority component: present iff the remainder starts with `//`.
  let netloc = '';
  let path = '';
  if (rest.startsWith('//')) {
    const afterSlashes = rest.slice(2);
    const authorityEnd = afterSlashes.search(/[/?#]/);
    if (authorityEnd === -1) {
      netloc = afterSlashes;
      path = '';
    } else {
      netloc = afterSlashes.slice(0, authorityEnd);
      path = afterSlashes.slice(authorityEnd);
    }
  } else {
    path = rest;
  }

  // Drop query.
  const queryIndex = path.indexOf('?');
  if (queryIndex !== -1) path = path.slice(0, queryIndex);

  netloc = netloc.toLowerCase();
  if (path === '') path = '/';
  if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '');

  return `${netloc}${path}`.toLowerCase();
}

export interface ComputeClaimIdInput {
  tenantId: string;
  subject: string;
  claimText: string;
  sourceUrl: string;
}

export function computeClaimId({
  tenantId,
  subject,
  claimText,
  sourceUrl,
}: ComputeClaimIdInput): ClaimId {
  const payload = [
    tenantId,
    subject.trim().toLowerCase(),
    normalizeClaimText(claimText),
    normalizeSourceUrl(sourceUrl),
  ].join('\0');
  return sha256Hex(payload).slice(0, DIGEST_LEN);
}
