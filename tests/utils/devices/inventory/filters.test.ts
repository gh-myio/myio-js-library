import { describe, it, expect } from 'vitest';
import {
  NO_CUSTOMER_KEY,
  UNCLASSIFIED_PROFILE_LABEL,
  applyFilters,
  buildInventoryRows,
  createEmptyFilters,
  facetCounts,
  getVisibleGroups,
  getVisibleRows,
  normalizeText,
} from '../../../../src/utils/devices/inventory/filters';
import { HOUR, NOW, makeDevice } from './fixtures';

const devices = [
  makeDevice({ id: 'a', label: 'Chiller 1', name: 'N-A' }), // Ilha, ok
  makeDevice({ id: 'b', label: 'Climatização Praça', name: 'N-B', ingestionId: 'ing-b', gcdrDeviceId: null }), // Ilha, pending (C4)
  makeDevice({ id: 'c', label: 'Bomba', name: 'N-C', deviceProfile: 'HIDROMETRO', ingestionId: null, gcdrDeviceId: 'g-c' }), // Ilha, critical (C3)
  makeDevice({ id: 'd', label: 'Sensor', name: 'N-D', ownerName: 'Rio Poty', ingestionId: 'ing-d', gcdrDeviceId: 'g-d', active: false }), // Poty, ok + inactive
  makeDevice({ id: 'e', label: null, name: 'Estoque', ownerType: 'TENANT', ownerName: 'MYIO', ingestionId: null, gcdrDeviceId: null }), // no customer, pending (C1)
  makeDevice({ id: 'f', label: 'Velho', name: 'N-F', ingestionId: 'ing-f', gcdrDeviceId: 'g-f', lifecycleStatus: 'archived' }), // archived
  makeDevice({ id: 'g', label: 'Desconhecido', name: 'N-G', deviceProfile: 'Park Lagos CAG', ingestionId: 'ing-g', gcdrDeviceId: 'g-g', lastActivityTime: NOW - 48 * HOUR }),
];
const rows = buildInventoryRows(devices, { now: NOW });
const ids = (list: { device: { id: string } }[]) => list.map((r) => r.device.id);

describe('RFC-0237 rows', () => {
  it('unrecognized profiles are "Não classificado" (never energy by default)', () => {
    const g = rows.find((r) => r.device.id === 'g')!;
    expect(g.domain).toBe('unclassified');
    expect(g.profileLabel).toBe(UNCLASSIFIED_PROFILE_LABEL);
    expect(rows.find((r) => r.device.id === 'c')!.domain).toBe('water');
  });

  it('tenant-owned devices group under the no-customer key', () => {
    expect(rows.find((r) => r.device.id === 'e')!.customerKey).toBe(NO_CUSTOMER_KEY);
  });
});

describe('RFC-0237 filters', () => {
  it('default filters show active lifecycle only (archived hidden)', () => {
    expect(ids(applyFilters(rows, createEmptyFilters()))).not.toContain('f');
    const all = createEmptyFilters();
    all.lifecycle.clear();
    expect(ids(applyFilters(rows, all))).toContain('f');
  });

  it('AND across dimensions, OR within one', () => {
    const f = createEmptyFilters();
    f.customers.add('Shopping da Ilha');
    f.cadastro.add('pending');
    f.cadastro.add('critical');
    expect(ids(applyFilters(rows, f)).sort()).toEqual(['b', 'c', 'g']); // g: unrecognized profile (C5)
  });

  it('rules dimension matches devices that FAIL any selected rule', () => {
    const f = createEmptyFilters();
    f.rules.add('C3');
    f.rules.add('A1');
    expect(ids(applyFilters(rows, f)).sort()).toEqual(['c', 'd']);
  });

  it('search is accent- and case-insensitive over label/name/identifier/customer', () => {
    expect(normalizeText('Climatização')).toBe('climatizacao');
    const f = createEmptyFilters();
    f.text = 'CLIMATIZACAO';
    expect(ids(applyFilters(rows, f))).toEqual(['b']);
    f.text = 'poty';
    expect(ids(applyFilters(rows, f))).toEqual(['d']);
  });

  it('facet counts ignore the counted dimension but honour the others', () => {
    const f = createEmptyFilters();
    f.customers.add('Shopping da Ilha');
    const counts = facetCounts(rows, f, 'cadastro');
    expect(counts.get('ok')).toBe(1); // a
    expect(counts.get('pending')).toBe(2); // b (C4), g (C5)
    expect(counts.get('critical')).toBe(1); // c
    expect(counts.get('partial')).toBeUndefined();
  });

  it('with a selection in the same dimension a count is what the option contributes, not the total after the click', () => {
    const f = createEmptyFilters();
    f.cadastro.add('pending');
    const counts = facetCounts(rows, f, 'cadastro');
    const afterClick = createEmptyFilters();
    afterClick.cadastro.add('pending');
    afterClick.cadastro.add('critical');
    expect(counts.get('critical')).toBe(1);
    expect(applyFilters(rows, afterClick).length).toBe(4); // b, e, g (pending) + c (critical)
  });

  it('the rules facet can sum to more than the device count', () => {
    const counts = facetCounts(rows, createEmptyFilters(), 'rules');
    const total = [...counts.values()].reduce((s, n) => s + n, 0);
    expect(total).toBeGreaterThan(applyFilters(rows, createEmptyFilters()).filter((r) => r.evaluation.failed.length).length);
  });
});

describe('RFC-0237 visible rows (list and export order)', () => {
  it('groups alphabetically with "no customer" pinned first, gravity inside the group', () => {
    const groups = getVisibleGroups(rows, createEmptyFilters(), 'gravity', 'customer');
    expect(groups.map((g) => g.key)).toEqual([NO_CUSTOMER_KEY, 'Rio Poty', 'Shopping da Ilha']);
    const ilha = groups.find((g) => g.key === 'Shopping da Ilha')!;
    expect(ids(ilha.rows)).toEqual(['c', 'g', 'b', 'a']); // critical; pending + inactive; pending; ok
  });

  it('getVisibleRows is the flattened group order and includes every matching row', () => {
    const flat = getVisibleRows(rows, createEmptyFilters(), 'label', 'none');
    expect(flat.length).toBe(applyFilters(rows, createEmptyFilters()).length);
    expect(ids(flat)).toEqual(['c', 'a', 'b', 'g', 'e', 'd']); // Bomba, Chiller 1, Climatização, Desconhecido, Estoque, Sensor
  });
});
