/**
 * RFC-0241 — openGoalsPanel optional `tenantId` (→ X-Tenant-ID) and `theme`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openGoalsPanel } from '../../src/components/GoalsPanel';

const flush = async (n = 4) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

let calls: Array<{ url: string; headers: Record<string, string> }>;
let instance: { close: () => void } | null = null;

beforeEach(() => {
  calls = [];
  (globalThis as any).fetch = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), headers: init?.headers || {} });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { domain: 'ENERGY', year: 2026, version: 1, tree: {}, history: [] } }),
    };
  });
});

afterEach(() => {
  instance?.close();
  instance = null;
  delete (globalThis as any).fetch;
  document.body.innerHTML = '';
});

describe('openGoalsPanel — RFC-0241 tenantId', () => {
  it('sends X-Tenant-ID when tenantId is provided', async () => {
    instance = openGoalsPanel({ customerId: 'c1', apiKey: 'test-key', baseUrl: 'https://gcdr.test', tenantId: 'tn-1' });
    await flush();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].headers['X-Tenant-ID']).toBe('tn-1');
  });

  it('omits X-Tenant-ID by default (unchanged wire)', async () => {
    instance = openGoalsPanel({ customerId: 'c1', apiKey: 'test-key', baseUrl: 'https://gcdr.test' });
    await flush();
    expect('X-Tenant-ID' in calls[0].headers).toBe(false);
    expect(calls[0].headers['X-API-Key']).toBe('test-key');
  });
});

describe('openGoalsPanel — RFC-0241 theme', () => {
  it('applies --myio-* vars on the root (createMyIOTheme-like object)', async () => {
    instance = openGoalsPanel({
      customerId: 'c1',
      apiKey: 'test-key',
      baseUrl: 'https://gcdr.test',
      theme: { cssVars: () => ({ '--myio-brand-700': '#112233' }) },
    });
    await flush();
    const root = document.getElementById('myio-goals-gcdr-root')!;
    expect(root.style.getPropertyValue('--myio-brand-700')).toBe('#112233');
  });

  it('explicit styles.primaryColor still wins over the theme for the header', async () => {
    instance = openGoalsPanel({
      customerId: 'c1',
      apiKey: 'test-key',
      baseUrl: 'https://gcdr.test',
      theme: { '--myio-brand-700': '#112233' },
      styles: { primaryColor: '#445566' },
    });
    await flush();
    const html = document.getElementById('myio-goals-gcdr-root')!.innerHTML.toLowerCase();
    expect(html).toContain('#445566');
  });
});
