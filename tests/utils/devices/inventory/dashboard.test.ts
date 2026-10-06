import { describe, it, expect } from 'vitest';
import { buildDashboardSummary, customerKeyLabel } from '../../../../src/utils/devices/inventory/dashboard';
import {
  NO_CUSTOMER_KEY,
  applyFilters,
  buildInventoryRows,
  createEmptyFilters,
  facetCounts,
} from '../../../../src/utils/devices/inventory/filters';
import { HOUR, NOW, makeDevice } from './fixtures';

const rows = buildInventoryRows(
  [
    makeDevice({ id: 'a', ingestionId: 'i-a', gcdrDeviceId: 'g-a' }), // Ilha ok
    makeDevice({ id: 'b', ingestionId: null, gcdrDeviceId: 'g-b' }), // Ilha critical (C3)
    makeDevice({ id: 'c', ingestionId: 'i-c', gcdrDeviceId: null }), // Ilha pending (C4)
    makeDevice({ id: 'd', ingestionId: 'i-d', gcdrDeviceId: null, ownerName: 'Rio Poty', active: false }), // Poty pending + inactive
    makeDevice({ id: 'e', ownerType: 'TENANT', ownerName: 'MYIO', ingestionId: null, gcdrDeviceId: null, lastActivityTime: null }), // no customer pending + nodata
    makeDevice({ id: 'f', ingestionId: 'i-f', gcdrDeviceId: 'g-f', lifecycleStatus: 'archived' }),
    makeDevice({ id: 'g', ingestionId: 'i-g', gcdrDeviceId: 'g-g', lifecycleStatus: 'stock' }),
    makeDevice({ id: 'h', ingestionId: 'i-h', gcdrDeviceId: 'g-h', ownerName: 'Rio Poty', lastActivityTime: NOW - 48 * HOUR }), // Poty ok + inactive
  ],
  { now: NOW }
);

describe('RFC-0237 buildDashboardSummary', () => {
  const all = createEmptyFilters();
  all.lifecycle.clear(); // include stock/archived so they are counted as excluded
  const d = buildDashboardSummary(applyFilters(rows, all));

  it('counts totals, excluded lifecycle and both axes', () => {
    expect(d.total).toBe(8);
    expect(d.excluded).toEqual({ stock: 1, archived: 1 });
    expect(d.inIndicators).toBe(6);
    expect(d.cadastro).toEqual({ ok: 2, pending: 3, critical: 1, partial: 0 });
    expect(d.atividade).toEqual({ ok: 3, inactive: 2, nodata: 1 });
  });

  it('axis counts equal the list facet counts (Painel and list never disagree)', () => {
    const f = createEmptyFilters();
    const facets = facetCounts(rows, f, 'cadastro');
    const fromDefault = buildDashboardSummary(applyFilters(rows, f));
    for (const level of ['ok', 'pending', 'critical'] as const) {
      expect(fromDefault.cadastro[level]).toBe(facets.get(level) || 0);
    }
  });

  it('ranks customers with problems, worst first', () => {
    expect(d.topCustomers.map((c) => [c.key, c.critical, c.pending])).toEqual([
      ['Shopping da Ilha', 1, 1],
      [NO_CUSTOMER_KEY, 0, 1],
      ['Rio Poty', 0, 1],
    ]);
  });

  it('ranks failing rules with pt-BR labels', () => {
    const byId = Object.fromEntries(d.topRules.map((r) => [r.id, r.count]));
    expect(byId).toMatchObject({ C3: 1, C4: 2, C1: 1, A1: 1, A2: 1 });
    expect(d.topRules[0]).toMatchObject({ id: 'C4', label: 'Sem gcdrDeviceId', count: 2 });
  });

  it('builds the customer × rule matrix aligned with topRules', () => {
    expect(d.matrix.rules).toEqual(d.topRules.map((r) => r.id));
    const ilha = d.matrix.customers.indexOf('Shopping da Ilha');
    const c3 = d.matrix.rules.indexOf('C3');
    const c4 = d.matrix.rules.indexOf('C4');
    expect(d.matrix.cells[ilha][c3]).toBe(1);
    expect(d.matrix.cells[ilha][c4]).toBe(1);
    expect(d.matrix.cells.every((row) => row.length === d.matrix.rules.length)).toBe(true);
  });

  it('respects limits and labels the no-customer key', () => {
    expect(buildDashboardSummary(rows, { topCustomers: 1, matrixCustomers: 2 }).topCustomers).toHaveLength(1);
    expect(buildDashboardSummary(rows, { matrixCustomers: 2 }).matrix.customers).toHaveLength(2);
    expect(customerKeyLabel(NO_CUSTOMER_KEY)).toBe('Sem cliente');
    expect(customerKeyLabel('Rio Poty')).toBe('Rio Poty');
  });

  it('empty input gives zeros and empty lists', () => {
    const empty = buildDashboardSummary([]);
    expect(empty.total).toBe(0);
    expect(empty.topCustomers).toEqual([]);
    expect(empty.matrix).toEqual({ customers: [], rules: [], cells: [] });
  });
});
