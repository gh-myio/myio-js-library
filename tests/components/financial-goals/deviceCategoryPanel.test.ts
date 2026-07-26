/**
 * RFC-0228 A5a — device tariff-category management UI (`deviceCategoryPanel.ts`).
 *
 * Proves the UI depends ONLY on the injected DeviceCategoryPort seam (feedback §5):
 * every test drives the component through `createFakeDeviceCategoryPort` — no HTTP,
 * no host. Covers list render, the uncategorized filter (A4 deep-link entry),
 * single + bulk edits, focus highlight, version-conflict surfacing without losing
 * other edits, category-term mapping reuse (A1), and the explicit-only discipline
 * (RFC-0207: never infer a category from a device's name).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  openDeviceCategoryPanel,
  deviceCategoryLabel,
  deviceCategoryToPanelTerm,
  panelTermToDeviceCategory,
} from '../../../src/components/financial-goals/deviceCategoryPanel';
import { createFakeDeviceCategoryPort } from '../../../src/components/financial-goals/deviceCategoryPort';
import {
  WIRE_TO_PANEL_CATEGORY,
  PANEL_TO_WIRE_CATEGORY,
} from '../../../src/components/pricing-panel/tariffApiAdapter';

/** Flush microtasks + a macrotask so async port writes settle. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const seed = [
  { deviceId: 'd1', code: 'SCP-001', label: 'Loja 1', tariffCategory: 'SPECIFIC' as const, version: '3' },
  { deviceId: 'd2', code: 'SCP-002', label: 'Corredor L2', tariffCategory: null, version: '0' },
  { deviceId: 'd3', code: 'SCP-003', label: 'Praça Central', tariffCategory: 'COMMON_AREA' as const, version: '1' },
];

function change(el: HTMLSelectElement | HTMLInputElement): void {
  el.dispatchEvent(new Event('change'));
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('openDeviceCategoryPanel — list & filter', () => {
  it('renders every device with its current category', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    const h = openDeviceCategoryPanel({ port, customerId: 'c1' });
    await h.ready;
    expect(h.getVisibleDeviceIds()).toEqual(['d1', 'd2', 'd3']);
    const root = h.getRoot();
    const sel1 = root.querySelector<HTMLSelectElement>('[data-devcat-rowselect="d1"]')!;
    expect(sel1.value).toBe('SPECIFIC');
    const sel2 = root.querySelector<HTMLSelectElement>('[data-devcat-rowselect="d2"]')!;
    expect(sel2.value).toBe(''); // uncategorized
  });

  it('uncategorized filter shows only tariffCategory === null', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    const h = openDeviceCategoryPanel({ port, customerId: 'c1' });
    await h.ready;
    h.setCategoryFilter('uncategorized');
    expect(h.getVisibleDeviceIds()).toEqual(['d2']);
  });

  it('search filters by label or code', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    const h = openDeviceCategoryPanel({ port, customerId: 'c1' });
    await h.ready;
    h.setSearch('praça');
    expect(h.getVisibleDeviceIds()).toEqual(['d3']);
    h.setSearch('SCP-001');
    expect(h.getVisibleDeviceIds()).toEqual(['d1']);
  });
});

describe('openDeviceCategoryPanel — single edit', () => {
  it('setting a row category calls port.setCategory with the right args and updates the row', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    const spy = vi.spyOn(port, 'setCategory');
    const h = openDeviceCategoryPanel({ port, customerId: 'c1' });
    await h.ready;
    const sel = h.getRoot().querySelector<HTMLSelectElement>('[data-devcat-rowselect="d2"]')!;
    sel.value = 'COMMON_AREA';
    change(sel);
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ deviceId: 'd2', category: 'COMMON_AREA', expectedVersion: '0' });
    expect(h.getRows().find((r) => r.deviceId === 'd2')!.tariffCategory).toBe('COMMON_AREA');
  });
});

describe('openDeviceCategoryPanel — bulk edit', () => {
  it('bulk-sets N devices via a single setCategoryBulk with the selected ids', async () => {
    const port = createFakeDeviceCategoryPort(seed); // supportsBulk default true
    const bulkSpy = vi.spyOn(port, 'setCategoryBulk');
    const h = openDeviceCategoryPanel({ port, customerId: 'c1' });
    await h.ready;
    const root = h.getRoot();
    const c1 = root.querySelector<HTMLInputElement>('[data-devcat-rowcheck="d1"]')!;
    const c2 = root.querySelector<HTMLInputElement>('[data-devcat-rowcheck="d2"]')!;
    c1.checked = true; change(c1);
    c2.checked = true; change(c2);
    const bulkCat = root.querySelector<HTMLSelectElement>('[data-devcat-bulkcat]')!;
    bulkCat.value = 'COMMON_AREA';
    root.querySelector<HTMLButtonElement>('[data-devcat-bulkapply]')!.click();
    await flush();
    expect(bulkSpy).toHaveBeenCalledTimes(1);
    const arg = bulkSpy.mock.calls[0][0];
    expect(new Set(arg.deviceIds)).toEqual(new Set(['d1', 'd2']));
    expect(arg.category).toBe('COMMON_AREA');
    expect(h.getRows().find((r) => r.deviceId === 'd2')!.tariffCategory).toBe('COMMON_AREA');
  });

  it('falls back to N setCategory calls when the port has no setCategoryBulk', async () => {
    const port = createFakeDeviceCategoryPort(seed, { supportsBulk: false });
    const singleSpy = vi.spyOn(port, 'setCategory');
    const h = openDeviceCategoryPanel({ port, customerId: 'c1' });
    await h.ready;
    const root = h.getRoot();
    const c1 = root.querySelector<HTMLInputElement>('[data-devcat-rowcheck="d1"]')!;
    const c3 = root.querySelector<HTMLInputElement>('[data-devcat-rowcheck="d3"]')!;
    c1.checked = true; change(c1);
    c3.checked = true; change(c3);
    const bulkCat = root.querySelector<HTMLSelectElement>('[data-devcat-bulkcat]')!;
    bulkCat.value = 'SPECIFIC';
    root.querySelector<HTMLButtonElement>('[data-devcat-bulkapply]')!.click();
    await flush();
    expect(singleSpy).toHaveBeenCalledTimes(2);
    const ids = singleSpy.mock.calls.map((c) => c[0].deviceId);
    expect(new Set(ids)).toEqual(new Set(['d1', 'd3']));
  });
});

describe('openDeviceCategoryPanel — focus deep-link', () => {
  it('focusDeviceId highlights the right row', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    const h = openDeviceCategoryPanel({ port, customerId: 'c1', focusDeviceId: 'd3' });
    await h.ready;
    const focused = h.getRoot().querySelectorAll('[data-focused="1"]');
    expect(focused.length).toBe(1);
    expect(focused[0].getAttribute('data-devcat-row')).toBe('d3');
  });
});

describe('openDeviceCategoryPanel — version conflict', () => {
  it('surfaces a conflict on one device while preserving another pending edit', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    const h = openDeviceCategoryPanel({ port, customerId: 'c1' });
    await h.ready;
    const root = h.getRoot();

    // Someone else edits d1 concurrently → our stale expectedVersion will conflict.
    port.bumpVersion('d1');

    // Edit d1 (will conflict) and d3 (will succeed).
    const selD1 = root.querySelector<HTMLSelectElement>('[data-devcat-rowselect="d1"]')!;
    selD1.value = 'COMMON_AREA'; change(selD1);
    await flush();

    const selD3 = root.querySelector<HTMLSelectElement>('[data-devcat-rowselect="d3"]')!;
    selD3.value = 'SPECIFIC'; change(selD3);
    await flush();

    // d1 shows a conflict banner...
    const rowD1 = root.querySelector<HTMLElement>('[data-devcat-row="d1"]')!;
    expect(rowD1.getAttribute('data-conflict')).toBe('1');
    const banner = root.querySelector<HTMLElement>('[data-devcat-conflict="d1"]')!;
    expect(banner.textContent && banner.textContent.length).toBeGreaterThan(0);
    expect(h.getRows().find((r) => r.deviceId === 'd1')!.tariffCategory).toBe('SPECIFIC'); // unchanged

    // ...but d3's edit is preserved (not lost by d1's failure).
    expect(h.getRows().find((r) => r.deviceId === 'd3')!.tariffCategory).toBe('SPECIFIC');
    const rowD3 = root.querySelector<HTMLElement>('[data-devcat-row="d3"]')!;
    expect(rowD3.getAttribute('data-conflict')).toBeNull();
  });
});

describe('category term mapping reuses A1 (no duplicate logic)', () => {
  it('maps COMMON_AREA↔area_comum and SPECIFIC↔lojas via the shared A1 map', () => {
    // The panel helpers must agree with A1's centralized map for every token.
    expect(deviceCategoryToPanelTerm('COMMON_AREA')).toBe(WIRE_TO_PANEL_CATEGORY.COMMON_AREA);
    expect(deviceCategoryToPanelTerm('SPECIFIC')).toBe(WIRE_TO_PANEL_CATEGORY.SPECIFIC);
    expect(deviceCategoryToPanelTerm('COMMON_AREA')).toBe('area_comum');
    expect(deviceCategoryToPanelTerm('SPECIFIC')).toBe('lojas');
    expect(deviceCategoryToPanelTerm(null)).toBeNull();

    expect(panelTermToDeviceCategory('area_comum')).toBe(PANEL_TO_WIRE_CATEGORY.area_comum);
    expect(panelTermToDeviceCategory('lojas')).toBe(PANEL_TO_WIRE_CATEGORY.lojas);
    expect(panelTermToDeviceCategory('area_comum')).toBe('COMMON_AREA');
    expect(panelTermToDeviceCategory('lojas')).toBe('SPECIFIC');
    expect(panelTermToDeviceCategory(null)).toBeNull();
  });

  it('labels derive from the same map (round-trip)', () => {
    expect(deviceCategoryLabel('COMMON_AREA')).toBe('Área Comum');
    expect(deviceCategoryLabel('SPECIFIC')).toBe('Lojas');
    expect(deviceCategoryLabel(null)).toContain('Sem categoria');
  });
});

describe('explicit-only discipline (RFC-0207)', () => {
  it('a device labeled "Loja X" with tariffCategory:null stays uncategorized', async () => {
    // Name says "Loja" but the explicit attribute is null — must NOT be inferred.
    const port = createFakeDeviceCategoryPort([
      { deviceId: 'x1', code: 'SCP-X', label: 'Loja X', tariffCategory: null, version: '0' },
    ]);
    const h = openDeviceCategoryPanel({ port, customerId: 'c1' });
    await h.ready;
    h.setCategoryFilter('uncategorized');
    expect(h.getVisibleDeviceIds()).toEqual(['x1']);
    const sel = h.getRoot().querySelector<HTMLSelectElement>('[data-devcat-rowselect="x1"]')!;
    expect(sel.value).toBe(''); // none — no inference from the "Loja" label
    expect(h.getRows()[0].tariffCategory).toBeNull();
  });
});
