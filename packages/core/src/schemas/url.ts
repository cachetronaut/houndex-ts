/**
 * URL canonicalization. A source URL is canonicalized before `computeClaimId`
 * runs, so this must stay stable and match any reference (e.g. Python)
 * implementation for claim identity to agree across languages.
 *
 * `canonicalizeUrl`: lowercases scheme + host, drops default ports, strips a
 * trailing slash on non-root paths, removes common tracking query params, and
 * sorts the remaining query pairs.
 *
 * `extractDomain` is a pragmatic registrable-domain approximation (last two
 * labels of the host). Domain is non-identity metadata, so the approximation
 * is acceptable and avoids bundling a public-suffix list.
 */

const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
]);

export function canonicalizeUrl(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // If there's no scheme, assume https.
    parsed = new URL(`https://${trimmed}`);
  }

  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  let host = parsed.host.toLowerCase();
  if (scheme === 'http' && host.endsWith(':80')) host = host.slice(0, -3);
  else if (scheme === 'https' && host.endsWith(':443')) host = host.slice(0, -4);

  let path = parsed.pathname || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '');

  const kept: Array<[string, string]> = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) kept.push([key, value]);
  }
  kept.sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0,
  );
  const query = kept
    .map(([k, vv]) => `${encodeURIComponent(k)}=${encodeURIComponent(vv)}`)
    .join('&');

  return query === '' ? `${scheme}://${host}${path}` : `${scheme}://${host}${path}?${query}`;
}

export function extractDomain(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    try {
      host = new URL(`https://${url.trim()}`).hostname.toLowerCase();
    } catch {
      return '';
    }
  }
  const labels = host.split('.').filter((label) => label !== '');
  if (labels.length <= 2) return labels.join('.');
  return labels.slice(-2).join('.');
}
