import { describe, expect, it } from 'vitest';
import {
  parseTenantContext,
  parseTenantId,
  TenantRole,
  tenantPrimary,
  tenantSecondary,
} from './tenant.js';

describe('parseTenantId', () => {
  it.each(['a', 'primary', 'tenant-1', 'a_b-c', 'x'.repeat(64)])('accepts %s', (slug) => {
    expect(parseTenantId(slug)).toBe(slug);
  });

  it.each(['', 'A', 'Primary', '-lead', 'trail-', 'has space', 'x'.repeat(65)])(
    'rejects %s',
    (slug) => {
      expect(() => parseTenantId(slug)).toThrow();
    },
  );
});

describe('parseTenantContext', () => {
  it('accepts a well-formed context', () => {
    const ctx = parseTenantContext({ tenantId: 'primary', userId: 'u1', role: TenantRole.ADMIN });
    expect(ctx.role).toBe('admin');
  });

  it('rejects an unknown role', () => {
    expect(() => parseTenantContext({ tenantId: 'primary', userId: 'u1', role: 'root' })).toThrow();
  });
});

describe('fixtures', () => {
  it('primary and secondary are distinct tenants', () => {
    expect(tenantPrimary().tenantId).not.toBe(tenantSecondary().tenantId);
  });

  it('accepts overrides', () => {
    expect(tenantPrimary({ role: TenantRole.VIEWER }).role).toBe('viewer');
  });
});
