import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, extractDomain } from './url.js';

describe('canonicalizeUrl', () => {
  it('lowercases scheme and host and strips a trailing slash', () => {
    expect(canonicalizeUrl('HTTPS://Example.COM/Docs/')).toBe('https://example.com/Docs');
  });

  it('drops default ports', () => {
    expect(canonicalizeUrl('http://example.com:80/a')).toBe('http://example.com/a');
    expect(canonicalizeUrl('https://example.com:443/a')).toBe('https://example.com/a');
  });

  it('removes tracking params and sorts the rest', () => {
    expect(canonicalizeUrl('https://example.com/a?b=2&utm_source=x&a=1')).toBe(
      'https://example.com/a?a=1&b=2',
    );
  });

  it('assumes https when no scheme is present', () => {
    expect(canonicalizeUrl('example.com/a')).toBe('https://example.com/a');
  });
});

describe('extractDomain', () => {
  it('returns the registrable domain approximation', () => {
    expect(extractDomain('https://docs.example.com/a')).toBe('example.com');
    expect(extractDomain('https://example.com')).toBe('example.com');
  });

  it('returns empty string for an unparseable host', () => {
    expect(extractDomain('   ')).toBe('');
  });
});
