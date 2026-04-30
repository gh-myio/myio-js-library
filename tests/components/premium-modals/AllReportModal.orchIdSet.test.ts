/**
 * RFC-0182 / RFC-0201 Phase-2 #18 — AllReportModal `orchIdSet` filter tests.
 *
 * Covers AC-RFC-0182-1: given a mock API response with 50 devices and an
 * `orchIdSet` of 12 ingestionIds, the modal keeps only those 12 rows.
 *
 * The test exercises the private `mapCustomerTotalsResponse` directly to
 * avoid the DOM-heavy `loadData()` path (which depends on jQuery
 * DateRangePicker and ModalPremiumShell — out of scope here).
 */

import { describe, it, expect } from 'vitest';
import { AllReportModal } from '../../../src/components/premium-modals/report-all/AllReportModal';
import type {
  OpenAllReportParams,
  StoreItem,
} from '../../../src/components/premium-modals/types';

/**
 * Build a minimal `OpenAllReportParams` for the modal constructor — only
 * the fields actually read by `mapCustomerTotalsResponse` need to be valid.
 */
function makeParams(overrides: Partial<OpenAllReportParams> = {}): OpenAllReportParams {
  return {
    customerId: 'cust-1',
    domain: 'energy',
    group: 'lojas',
    api: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      dataApiBaseUrl: 'https://example.invalid',
      ingestionToken: 'token-123',
    },
    ...overrides,
  };
}

/**
 * Mint a fake API row, like what the GCDR Customer Totals endpoint returns.
 */
function makeApiItem(id: string, total = 100, name?: string) {
  return {
    id,
    name: name ?? `Device ${id}`,
    assetName: `IDENT-${id}`,
    total_value: total,
  };
}

/**
 * 50 mock API rows with predictable ids `api-001` … `api-050`.
 */
function makeApiResponse(count = 50) {
  const data = Array.from({ length: count }, (_, i) =>
    makeApiItem(`api-${String(i + 1).padStart(3, '0')}`, (i + 1) * 10),
  );
  return { data };
}

describe('AllReportModal.mapCustomerTotalsResponse — orchIdSet filter', () => {
  it('AC-RFC-0182-1: filters API response by orchIdSet, keeping only matching rows', () => {
    const apiResponse = makeApiResponse(50);

    // Build allow-list of 12 ids — every 4th item (1, 5, 9, …, 45) plus the last.
    const allowedIds = [
      'api-001',
      'api-005',
      'api-009',
      'api-013',
      'api-017',
      'api-021',
      'api-025',
      'api-029',
      'api-033',
      'api-037',
      'api-041',
      'api-050',
    ];
    const orchIdSet = new Set<string>(allowedIds);

    // Provide itemsList so the resulting rows carry stable identifier/label
    // metadata we can match against.
    const itemsList: StoreItem[] = allowedIds.map((id) => ({
      id,
      identifier: `IDENT-${id}`,
      label: `Loja ${id}`,
    }));

    const modal = new AllReportModal(makeParams({ orchIdSet, itemsList }));
    const rows = (modal as any).mapCustomerTotalsResponse(apiResponse) as Array<{
      identifier: string;
      name: string;
      consumption: number;
    }>;

    expect(rows).toHaveLength(12);

    // Every kept row's source id (carried in identifier as `IDENT-<id>`) must
    // be in the allow-list.
    for (const row of rows) {
      const sourceId = row.identifier.replace(/^IDENT-/, '');
      expect(orchIdSet.has(sourceId)).toBe(true);
    }
  });

  it('falls back to direct mapping when neither itemsList nor orchIdSet is provided', () => {
    const apiResponse = makeApiResponse(5);

    const modal = new AllReportModal(makeParams());
    const rows = (modal as any).mapCustomerTotalsResponse(apiResponse) as unknown[];

    // No filter — every API row passes through.
    expect(rows).toHaveLength(5);
  });

  it('uses itemsList when orchIdSet is absent (backwards-compat path)', () => {
    const apiResponse = makeApiResponse(10);

    // Allow only 3 ids via itemsList — note `id` matches `api.item.id`
    // (RFC-0182: StoreItem.id = device.ingestionId = api.item.id).
    const itemsList: StoreItem[] = [
      { id: 'api-002', identifier: 'IDENT-2', label: 'Loja 2' },
      { id: 'api-005', identifier: 'IDENT-5', label: 'Loja 5' },
      { id: 'api-008', identifier: 'IDENT-8', label: 'Loja 8' },
    ];

    const modal = new AllReportModal(makeParams({ itemsList }));
    const rows = (modal as any).mapCustomerTotalsResponse(apiResponse) as Array<{
      identifier: string;
      name: string;
      consumption: number;
    }>;

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name).sort()).toEqual(['Loja 2', 'Loja 5', 'Loja 8']);
  });

  it('orchIdSet takes precedence over itemsList for the API-response filter', () => {
    const apiResponse = makeApiResponse(20);

    // itemsList allows api-001..api-005 but orchIdSet allows only api-007 + api-008.
    // The expected behaviour per RFC-0201 Phase-2 #18 is that orchIdSet wins.
    const itemsList: StoreItem[] = [
      { id: 'api-001', identifier: 'IDENT-1', label: 'Loja 1' },
      { id: 'api-002', identifier: 'IDENT-2', label: 'Loja 2' },
      { id: 'api-007', identifier: 'IDENT-7', label: 'Loja 7' },
    ];
    const orchIdSet = new Set(['api-007', 'api-008']);

    const modal = new AllReportModal(makeParams({ itemsList, orchIdSet }));
    const rows = (modal as any).mapCustomerTotalsResponse(apiResponse) as Array<{
      identifier: string;
      name: string;
    }>;

    expect(rows).toHaveLength(2);
    const names = new Set(rows.map((r) => r.name));
    // api-007 has metadata via itemsList — keeps the friendly label.
    expect(names.has('Loja 7')).toBe(true);
    // api-008 has no metadata — falls back to the API response `name`.
    expect(names.has('Device api-008')).toBe(true);
  });

  it('returns [] when the API response is empty', () => {
    const modal = new AllReportModal(
      makeParams({ orchIdSet: new Set(['ing-1', 'ing-2']) }),
    );
    const rows = (modal as any).mapCustomerTotalsResponse({ data: [] }) as unknown[];

    expect(rows).toEqual([]);
  });

  it('returns [] when orchIdSet has zero matches in the API response', () => {
    const apiResponse = makeApiResponse(5);
    const modal = new AllReportModal(
      makeParams({ orchIdSet: new Set(['no-such-id-1', 'no-such-id-2']) }),
    );
    const rows = (modal as any).mapCustomerTotalsResponse(apiResponse) as unknown[];

    expect(rows).toEqual([]);
  });
});
