/**
 * RFC-0218 — auth strategy tests (test case #1 in the RFC's §Tests list).
 */

import { describe, expect, it, vi } from 'vitest';
import { ApiKeyAuth, BearerAuth, buildAuthStrategy } from '../../../src/components/gcdr-annotations/v1.0.0/authStrategies';

describe('GcdrAnnotationsClient auth strategies', () => {
  it('ApiKeyAuth sets X-API-Key', async () => {
    const strategy = new ApiKeyAuth('gcdr_cust_abc');
    const headers: Record<string, string> = {};
    await strategy.apply(headers);
    expect(headers).toEqual({ 'X-API-Key': 'gcdr_cust_abc' });
  });

  it('BearerAuth with a string token sets Authorization: Bearer', async () => {
    const strategy = new BearerAuth('jwt-123');
    const headers: Record<string, string> = {};
    await strategy.apply(headers);
    expect(headers).toEqual({ Authorization: 'Bearer jwt-123' });
  });

  it('BearerAuth with an async provider awaits and applies the resolved token', async () => {
    const provider = vi.fn(async () => 'async-jwt-456');
    const strategy = new BearerAuth(provider);
    const headers: Record<string, string> = {};
    await strategy.apply(headers);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(headers).toEqual({ Authorization: 'Bearer async-jwt-456' });
  });

  it('BearerAuth with a sync-function provider works too', async () => {
    const strategy = new BearerAuth(() => 'sync-jwt-789');
    const headers: Record<string, string> = {};
    await strategy.apply(headers);
    expect(headers).toEqual({ Authorization: 'Bearer sync-jwt-789' });
  });

  it('buildAuthStrategy returns ApiKeyAuth when only apiKey is given', () => {
    const strategy = buildAuthStrategy({ apiKey: 'k' });
    expect(strategy).toBeInstanceOf(ApiKeyAuth);
  });

  it('buildAuthStrategy returns BearerAuth when only bearerToken is given', () => {
    const strategy = buildAuthStrategy({ bearerToken: 't' });
    expect(strategy).toBeInstanceOf(BearerAuth);
  });

  it('buildAuthStrategy throws when both apiKey and bearerToken are given', () => {
    expect(() => buildAuthStrategy({ apiKey: 'k', bearerToken: 't' })).toThrow(/exactly one/i);
  });

  it('buildAuthStrategy throws when neither apiKey nor bearerToken is given', () => {
    expect(() => buildAuthStrategy({})).toThrow(/exactly one/i);
  });
});
