// AllReportModal — RFC-0223 sectioned-grid logic tests (no show(): DateRangePicker/
// jQuery/footer clock/participation chart are exercised elsewhere). Private state
// and methods are set/called directly, following the DeviceReportModal.test.ts pattern.
import { describe, it, expect } from 'vitest';
import { AllReportModal } from '../../../src/components/premium-modals/report-all/AllReportModal';
import type { OpenAllReportParams } from '../../../src/components/premium-modals/types';

function baseParams(overrides: Partial<OpenAllReportParams> = {}): OpenAllReportParams {
  return {
    customerId: 'customer-1',
    domain: 'energy',
    api: {
      dataApiBaseUrl: 'https://api.example.com',
      ingestionToken: 'token',
    },
    ...overrides,
  };
}

const PERIOD = { startISO: '2026-07-01T00:00:00-03:00', endISO: '2026-07-03T23:59:59-03:00' };
const ts = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00-03:00`).getTime();

describe('AllReportModal.aggregate / aggregateOrNull', () => {
  it('energy/water: sums present values, skips nulls, 0 when all missing', () => {
    const modal = new AllReportModal(baseParams({ domain: 'energy' }));
    expect((modal as any).aggregate([10, null, 5])).toBe(15);
    expect((modal as any).aggregate([null, null])).toBe(0);
    expect((modal as any).aggregateOrNull([null, null])).toBe(0);
  });

  it('temperature: means present values, aggregateOrNull returns null (not a fabricated 0) when all missing', () => {
    const modal = new AllReportModal(baseParams({ domain: 'temperature' }));
    expect((modal as any).aggregate([20, 22, null])).toBe(21);
    expect((modal as any).aggregate([null, null])).toBe(0); // aggregate()'s own literal fallback
    expect((modal as any).aggregateOrNull([null, null])).toBeNull(); // the caller-facing rule
  });
});

describe('AllReportModal.bucketByDay', () => {
  it('1d: one point per day passes through directly, missing days stay null', () => {
    const modal = new AllReportModal(baseParams());
    const points = [
      { timestamp: ts('2026-07-01'), value: 10 },
      { timestamp: ts('2026-07-03'), value: 5 },
    ];
    const buckets = (modal as any).bucketByDay(points, ['2026-07-01', '2026-07-02', '2026-07-03'], '1d');
    expect(buckets.get('2026-07-01').value).toBe(10);
    expect(buckets.get('2026-07-02').value).toBeNull();
    expect(buckets.get('2026-07-03').value).toBe(5);
  });

  it('1h: groups hourly points per day and aggregates (sum for energy)', () => {
    const modal = new AllReportModal(baseParams({ domain: 'energy' }));
    const points = [
      { timestamp: ts('2026-07-01', 8), value: 2 },
      { timestamp: ts('2026-07-01', 9), value: 3 },
    ];
    const buckets = (modal as any).bucketByDay(points, ['2026-07-01'], '1h');
    const day = buckets.get('2026-07-01');
    expect(day.value).toBe(5);
    expect(day.hours.get('2026-07-01T08')).toBe(2);
    expect(day.hours.get('2026-07-01T09')).toBe(3);
  });

  it('L4 (code review): two readings colliding on the SAME hour key are summed (energy), never overwritten', () => {
    // Two distinct real readings that map to the same hourKey — the DST
    // fall-back scenario (two UTC instants both landing on local "...T01")
    // is one way this happens, but the aggregation must be correct for ANY
    // collision, not just that specific mechanism.
    const modal = new AllReportModal(baseParams({ domain: 'energy' }));
    const sameHour = ts('2026-07-01', 8);
    const points = [
      { timestamp: sameHour, value: 4 },
      { timestamp: sameHour + 15 * 60 * 1000, value: 6 }, // 15 min later, same hour key
    ];
    const buckets = (modal as any).bucketByDay(points, ['2026-07-01'], '1h');
    const day = buckets.get('2026-07-01');
    expect(day.hours.get('2026-07-01T08')).toBe(10); // 4 + 6, NOT 6 (last-write-wins)
    expect(day.value).toBe(10);
  });

  it('L4: a colliding hour is averaged (not summed) for temperature', () => {
    const modal = new AllReportModal(baseParams({ domain: 'temperature' }));
    const sameHour = ts('2026-07-01', 8);
    const points = [
      { timestamp: sameHour, value: 20 },
      { timestamp: sameHour + 15 * 60 * 1000, value: 30 },
    ];
    const buckets = (modal as any).bucketByDay(points, ['2026-07-01'], '1h');
    expect(buckets.get('2026-07-01').hours.get('2026-07-01T08')).toBe(25);
  });

  it('a day with zero readings still resolves value/hours consistently (no regression from the L4 refactor)', () => {
    const modalEnergy = new AllReportModal(baseParams({ domain: 'energy' }));
    const emptyBuckets = (modalEnergy as any).bucketByDay([], ['2026-07-01'], '1h');
    expect(emptyBuckets.get('2026-07-01').value).toBe(0); // aggregateOrNull([]) for energy
    expect(emptyBuckets.get('2026-07-01').hours.size).toBe(0);

    const modalTemp = new AllReportModal(baseParams({ domain: 'temperature' }));
    const emptyTempBuckets = (modalTemp as any).bucketByDay([], ['2026-07-01'], '1h');
    expect(emptyTempBuckets.get('2026-07-01').value).toBeNull(); // aggregateOrNull([]) for temperature
  });
});

describe('AllReportModal.buildReportSectionModel', () => {
  function setup(domain: 'energy' | 'temperature', granularity: '1d' | '1h') {
    const modal = new AllReportModal(baseParams({ domain }));
    (modal as any).reportMode = granularity;
    (modal as any).exportPeriod = PERIOD;
    return modal;
  }

  it('AC16: a coverage="ok" device with zero points renders 0 dias and a domain-correct empty total', () => {
    const modalEnergy = setup('energy', '1d');
    (modalEnergy as any).data = [{ identifier: 'A', name: 'Device A', consumption: 0, id: 'a' }];
    (modalEnergy as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map([['a', []]]),
      coverage: new Map([['a', 'ok']]),
    };
    const model = (modalEnergy as any).buildReportSectionModel();
    const device = model.groups[0].devices[0];
    expect(device.dayCount).toBe(0);
    expect(device.total).toBe(0);
    expect(device.coverage).toBe('ok');

    const modalTemp = setup('temperature', '1d');
    (modalTemp as any).data = [{ identifier: 'A', name: 'Device A', consumption: 0, id: 'a' }];
    (modalTemp as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map([['a', []]]),
      coverage: new Map([['a', 'ok']]),
    };
    const tempDevice = (modalTemp as any).buildReportSectionModel().groups[0].devices[0];
    expect(tempDevice.dayCount).toBe(0);
    expect(tempDevice.total).toBeNull();
  });

  it('AC19: a failed-coverage device is distinct from AC16\'s clean empty state (total null, not 0)', () => {
    const modal = setup('energy', '1d');
    (modal as any).data = [{ identifier: 'B', name: 'Device B', consumption: 0, id: 'b' }];
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map(),
      coverage: new Map([['b', 'failed']]),
    };
    const device = (modal as any).buildReportSectionModel().groups[0].devices[0];
    expect(device.coverage).toBe('failed');
    expect(device.total).toBeNull();
    expect(device.dayCount).toBe(0);
  });

  it('1d device with full coverage: continuous day rows across the whole period, energy sums to the device total', () => {
    const modal = setup('energy', '1d');
    (modal as any).data = [{ identifier: 'A', name: 'Device A', consumption: 0, id: 'a' }];
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map([
        [
          'a',
          [
            { timestamp: ts('2026-07-01'), value: 10 },
            { timestamp: ts('2026-07-03'), value: 5 },
          ],
        ],
      ]),
      coverage: new Map([['a', 'ok']]),
    };
    const device = (modal as any).buildReportSectionModel().groups[0].devices[0];
    expect(device.dayCount).toBe(3);
    expect(device.days.map((d: any) => d.value)).toEqual([10, 0, 5]); // missing day-2 -> 0 for energy
    expect(device.total).toBe(15);
  });

  it('AC18 golden fixture: temperature device total is a FLAT mean over all hours (uneven day coverage), not a mean-of-day-means', () => {
    const modal = setup('temperature', '1h');
    (modal as any).data = [{ identifier: 'A', name: 'Sensor A', consumption: 0, id: 'a' }];
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1h',
      raw: new Map([
        [
          'a',
          [
            // Day 1: a single 30°C reading.
            { timestamp: ts('2026-07-01', 12), value: 30 },
            // Day 2: four readings averaging 20°C (10,10,30,30).
            { timestamp: ts('2026-07-02', 8), value: 10 },
            { timestamp: ts('2026-07-02', 9), value: 10 },
            { timestamp: ts('2026-07-02', 10), value: 30 },
            { timestamp: ts('2026-07-02', 11), value: 30 },
            // Day 3: no readings at all (stays null/'—').
          ],
        ],
      ]),
      coverage: new Map([['a', 'ok']]),
    };
    const device = (modal as any).buildReportSectionModel().groups[0].devices[0];
    // Mean-of-day-means would be (30 + 20) / 2 = 25 — WRONG (biased by day-1's single reading).
    // Flat mean over all 5 leaf readings: (30+10+10+30+30)/5 = 22.
    expect(device.total).toBe(22);
    expect(device.days[0].value).toBe(30); // day 1 mean (single reading)
    expect(device.days[1].value).toBe(20); // day 2 mean
    expect(device.days[2].value).toBeNull(); // day 3: no readings -> '—'
  });

  it('groups devices by groupLabel, preserving first-occurrence order, and sums group totals (energy)', () => {
    const modal = setup('energy', '1d');
    (modal as any).data = [
      { identifier: 'A', name: 'A', consumption: 0, id: 'a', groupLabel: 'Lojas' },
      { identifier: 'B', name: 'B', consumption: 0, id: 'b', groupLabel: 'Entrada' },
      { identifier: 'C', name: 'C', consumption: 0, id: 'c', groupLabel: 'Lojas' },
    ];
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map([
        ['a', [{ timestamp: ts('2026-07-01'), value: 10 }]],
        ['b', [{ timestamp: ts('2026-07-01'), value: 4 }]],
        ['c', [{ timestamp: ts('2026-07-01'), value: 6 }]],
      ]),
      coverage: new Map([['a', 'ok'], ['b', 'ok'], ['c', 'ok']]),
    };
    const model = (modal as any).buildReportSectionModel();
    expect(model.groups.map((g: any) => g.groupLabel)).toEqual(['Lojas', 'Entrada']);
    expect(model.groups[0].devices.length).toBe(2);
    expect(model.groups[0].total).toBe(16); // 10 + 6
    expect(model.groups[1].total).toBe(4);
  });
});

describe('AllReportModal.getEffectiveDeviceTotal', () => {
  it('consolidado: returns row.consumption unchanged (byte-for-byte, AC1/AC3)', () => {
    const modal = new AllReportModal(baseParams());
    (modal as any).reportMode = 'consolidado';
    const row = { identifier: 'A', name: 'A', consumption: 42, id: 'a' };
    expect((modal as any).getEffectiveDeviceTotal(row)).toBe(42);
  });

  it('1d/1h: returns the section model device total instead of raw consumption', () => {
    const modal = new AllReportModal(baseParams());
    (modal as any).reportMode = '1d';
    (modal as any).exportPeriod = PERIOD;
    const row = { identifier: 'A', name: 'A', consumption: 999, id: 'a' };
    (modal as any).data = [row];
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map([['a', [{ timestamp: ts('2026-07-01'), value: 7 }]]]),
      coverage: new Map([['a', 'ok']]),
    };
    expect((modal as any).getEffectiveDeviceTotal(row)).toBe(7); // NOT 999
  });
});

describe('AllReportModal collapse-state defaults and epoch reset (AC6/AC21)', () => {
  it('computeDefaultCollapsedSections: all expanded under the device-count threshold', () => {
    const modal = new AllReportModal(baseParams());
    const model = {
      groups: [
        {
          groupLabel: '—',
          total: 0,
          devices: Array.from({ length: 5 }, (_, i) => ({
            row: { identifier: `D${i}`, name: `D${i}`, consumption: 0, id: `d${i}` },
            days: [],
            total: 0,
            dayCount: 0,
            coverage: 'ok' as const,
          })),
        },
      ],
    };
    const collapsed = (modal as any).computeDefaultCollapsedSections(model);
    expect(collapsed.size).toBe(0);
  });

  it('computeDefaultCollapsedSections: auto-collapses every device above the threshold', () => {
    const modal = new AllReportModal(baseParams());
    const model = {
      groups: [
        {
          groupLabel: '—',
          total: 0,
          devices: Array.from({ length: 30 }, (_, i) => ({
            row: { identifier: `D${i}`, name: `D${i}`, consumption: 0, id: `d${i}` },
            days: [],
            total: 0,
            dayCount: 0,
            coverage: 'ok' as const,
          })),
        },
      ],
    };
    const collapsed = (modal as any).computeDefaultCollapsedSections(model);
    expect(collapsed.size).toBe(30);
    expect(collapsed.has('dev:d0')).toBe(true);
  });

  it('resetCollapsedSectionsIfEpochChanged resets on a period/mode change but preserves within the same epoch', () => {
    const modal = new AllReportModal(baseParams());
    (modal as any).reportMode = '1d';
    (modal as any).exportPeriod = PERIOD;
    (modal as any).data = [];
    (modal as any).deviceSeriesCache = { key: 'k', granularity: '1d', raw: new Map(), coverage: new Map() };

    (modal as any).resetCollapsedSectionsIfEpochChanged();
    (modal as any).collapsedSections.add('dev:x'); // simulate a manual toggle

    // Same period+mode -> epoch unchanged -> collapsedSections preserved.
    (modal as any).resetCollapsedSectionsIfEpochChanged();
    expect((modal as any).collapsedSections.has('dev:x')).toBe(true);

    // Mode change -> epoch changes -> resets to defaults (empty, under threshold).
    (modal as any).reportMode = '1h';
    (modal as any).resetCollapsedSectionsIfEpochChanged();
    expect((modal as any).collapsedSections.has('dev:x')).toBe(false);
  });
});

describe('AllReportModal.toggleSection / collapseAllSections / expandAllSections', () => {
  it('toggleSection flips membership; collapseAllSections/expandAllSections set all/none', () => {
    const modal = new AllReportModal(baseParams());
    (modal as any).reportMode = '1d';
    (modal as any).exportPeriod = PERIOD;
    (modal as any).data = [
      { identifier: 'A', name: 'A', consumption: 0, id: 'a' },
      { identifier: 'B', name: 'B', consumption: 0, id: 'b' },
    ];
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map([
        ['a', [{ timestamp: ts('2026-07-01'), value: 1 }]],
        ['b', [{ timestamp: ts('2026-07-01'), value: 1 }]],
      ]),
      coverage: new Map([['a', 'ok'], ['b', 'ok']]),
    };

    (modal as any).toggleSection('dev:a');
    expect((modal as any).collapsedSections.has('dev:a')).toBe(true);
    (modal as any).toggleSection('dev:a');
    expect((modal as any).collapsedSections.has('dev:a')).toBe(false);

    (modal as any).collapseAllSections();
    expect((modal as any).collapsedSections.has('dev:a')).toBe(true);
    expect((modal as any).collapsedSections.has('dev:b')).toBe(true);

    (modal as any).expandAllSections();
    expect((modal as any).collapsedSections.size).toBe(0);
  });
});

describe('AllReportModal.renderSectionedRows (model -> HTML)', () => {
  function parseRows(html: string): HTMLTableRowElement[] {
    const table = document.createElement('table');
    table.innerHTML = `<tbody>${html}</tbody>`;
    return Array.from(table.querySelectorAll('tr'));
  }

  function ungroupedModal() {
    const modal = new AllReportModal(baseParams());
    (modal as any).reportMode = '1d';
    (modal as any).exportPeriod = PERIOD;
    (modal as any).data = [{ identifier: 'A', name: 'Device A', consumption: 0, id: 'a' }];
    (modal as any).selectedStoreIds = new Set(); // no device filter active
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map([
        [
          'a',
          [
            { timestamp: ts('2026-07-01'), value: 10 },
            { timestamp: ts('2026-07-03'), value: 5 },
          ],
        ],
      ]),
      coverage: new Map([['a', 'ok']]),
    };
    return modal;
  }

  it('ungrouped data: no group header, one device header + one row per period day', () => {
    const modal = ungroupedModal();
    const model = (modal as any).getReportSectionModel();
    const rows = parseRows((modal as any).renderSectionedRows(model));

    expect(rows.filter((r) => r.classList.contains('rp-section-header--level-0')).length).toBe(0);
    const deviceHeaders = rows.filter((r) => r.classList.contains('rp-section-header--level-1'));
    expect(deviceHeaders.length).toBe(1);
    expect(deviceHeaders[0].dataset.sectionToggle).toBe('dev:a');
    expect(deviceHeaders[0].dataset.ancestors).toBe(''); // no group ancestor when ungrouped

    const dayRows = rows.filter((r) => r.classList.contains('rp-section-row--level-2'));
    expect(dayRows.length).toBe(3); // 2026-07-01, 02, 03
    expect(dayRows.every((r) => r.dataset.ancestors === 'dev:a')).toBe(true);
    // Day-2 has no reading -> materializes to 0 (energy) and renders as such.
    expect(dayRows[1].children[1].textContent).toBe('0,00');
  });

  it('day-row % is relative to the DEVICE total, not the whole report grand total', () => {
    const modal = ungroupedModal();
    const model = (modal as any).getReportSectionModel();
    const rows = parseRows((modal as any).renderSectionedRows(model));
    const dayRows = rows.filter((r) => r.classList.contains('rp-section-row--level-2'));
    // Device total is 15 (10 + 0 + 5); day-1's 10 is 66,67% of the DEVICE total.
    expect(dayRows[0].children[2].textContent).toContain('66,67%');
  });

  it('grouped data: group header wraps device headers, ancestor chain includes the group key', () => {
    const modal = new AllReportModal(baseParams());
    (modal as any).reportMode = '1d';
    (modal as any).exportPeriod = PERIOD;
    (modal as any).data = [{ identifier: 'A', name: 'Device A', consumption: 0, id: 'a', groupLabel: 'Lojas' }];
    (modal as any).selectedStoreIds = new Set();
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map([['a', [{ timestamp: ts('2026-07-01'), value: 10 }]]]),
      coverage: new Map([['a', 'ok']]),
    };
    const model = (modal as any).getReportSectionModel();
    const rows = parseRows((modal as any).renderSectionedRows(model));

    const groupHeader = rows.find((r) => r.classList.contains('rp-section-header--level-0'));
    expect(groupHeader?.dataset.sectionToggle).toBe('grp:Lojas');
    const deviceHeader = rows.find((r) => r.classList.contains('rp-section-header--level-1'));
    expect(deviceHeader?.dataset.ancestors).toBe('grp:Lojas');
    const dayRow = rows.find((r) => r.classList.contains('rp-section-row--level-2'));
    expect(dayRow?.dataset.ancestors).toBe('grp:Lojas dev:a');
  });

  it('H1 (code review): group collapse works when the group label contains a space (e.g. "Área Comum")', () => {
    const modal = new AllReportModal(baseParams());
    (modal as any).reportMode = '1d';
    (modal as any).exportPeriod = PERIOD;
    (modal as any).data = [
      { identifier: 'A', name: 'Device A', consumption: 0, id: 'a', groupLabel: 'Área Comum' },
    ];
    (modal as any).selectedStoreIds = new Set();
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map([['a', [{ timestamp: ts('2026-07-01'), value: 10 }]]]),
      coverage: new Map([['a', 'ok']]),
    };
    const model = (modal as any).getReportSectionModel();
    const rows = parseRows((modal as any).renderSectionedRows(model));

    const expectedGroupKey = `grp:${encodeURIComponent('Área Comum')}`;
    const groupHeader = rows.find((r) => r.classList.contains('rp-section-header--level-0'));
    expect(groupHeader?.dataset.sectionToggle).toBe(expectedGroupKey);

    // The bug: splitting a non-encoded "grp:Área Comum" by space yields TWO
    // tokens, neither matching the real collapse key. Fixed: exactly one
    // token, equal to the group's own section key.
    const deviceHeader = rows.find((r) => r.classList.contains('rp-section-header--level-1'));
    const ancestorTokens = (deviceHeader?.dataset.ancestors || '').split(' ').filter(Boolean);
    expect(ancestorTokens).toEqual([expectedGroupKey]);

    // Full round trip through the DOM: collapseAllSections() must actually
    // hide this group's device header + day row via applySectionVisibility —
    // this is exactly what H1 broke (clicking the group header, or
    // "Recolher tudo", never hid an "Área Comum"-style group).
    document.body.innerHTML = '<div id="table-container"><table><tbody></tbody></table></div>';
    const tbody = document.querySelector('#table-container tbody')!;
    tbody.innerHTML = (modal as any).renderSectionedRows(model);
    const container = document.getElementById('table-container')!;

    (modal as any).collapseAllSections();
    const liveDeviceHeader = container.querySelector('.rp-section-header--level-1') as HTMLElement;
    const liveDayRow = container.querySelector('.rp-section-row--level-2') as HTMLElement;
    expect(liveDeviceHeader.style.display).toBe('none');
    expect(liveDayRow.style.display).toBe('none');

    (modal as any).expandAllSections();
    expect(liveDeviceHeader.style.display).toBe('');
    expect(liveDayRow.style.display).toBe('');
  });

  it('M2 (code review): group header total reconciles with visible (device-filtered) rows, not the whole group', () => {
    const modal = new AllReportModal(baseParams({ domain: 'energy' }));
    (modal as any).reportMode = '1d';
    (modal as any).exportPeriod = PERIOD;
    (modal as any).data = [
      { identifier: 'A', name: 'Device A', consumption: 0, id: 'a', groupLabel: 'Lojas' },
      { identifier: 'B', name: 'Device B', consumption: 0, id: 'b', groupLabel: 'Lojas' },
    ];
    // Device filter (Filtros & Ordenação) keeps only device A.
    (modal as any).selectedStoreIds = new Set([(modal as any).generateStoreId('A')]);
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map([
        ['a', [{ timestamp: ts('2026-07-01'), value: 10 }]],
        ['b', [{ timestamp: ts('2026-07-01'), value: 90 }]],
      ]),
      coverage: new Map([['a', 'ok'], ['b', 'ok']]),
    };
    const model = (modal as any).getReportSectionModel();
    // The unfiltered model total includes BOTH devices (100) — confirms the
    // filter is genuinely active and the two totals would differ if the bug
    // were still present.
    expect(model.groups[0].total).toBe(100);

    const rows = parseRows((modal as any).renderSectionedRows(model));
    const deviceHeaders = rows.filter((r) => r.classList.contains('rp-section-header--level-1'));
    expect(deviceHeaders.length).toBe(1); // only device A renders

    const groupHeader = rows.find((r) => r.classList.contains('rp-section-header--level-0'));
    expect(groupHeader?.querySelector('.rp-section-total')?.textContent).toBe('10,00 kWh'); // NOT 100,00
    expect(groupHeader?.querySelector('.rp-section-meta')?.textContent).toBe('1 dispositivo');
  });

  it('a device excluded by the device filter (Filtros & Ordenação) is omitted from the sectioned rows', () => {
    const modal = ungroupedModal();
    (modal as any).selectedStoreIds = new Set(['some-other-device']); // "A" not selected
    const model = (modal as any).getReportSectionModel();
    const html = (modal as any).renderSectionedRows(model);
    expect(html).toBe('');
  });

  it('a device with coverage="failed" renders the "dados incompletos" badge and no day rows', () => {
    const modal = new AllReportModal(baseParams());
    (modal as any).reportMode = '1d';
    (modal as any).exportPeriod = PERIOD;
    (modal as any).data = [{ identifier: 'B', name: 'Device B', consumption: 0, id: 'b' }];
    (modal as any).selectedStoreIds = new Set();
    (modal as any).deviceSeriesCache = {
      key: 'k',
      granularity: '1d',
      raw: new Map(),
      coverage: new Map([['b', 'failed']]),
    };
    const model = (modal as any).getReportSectionModel();
    const rows = parseRows((modal as any).renderSectionedRows(model));
    expect(rows.length).toBe(1); // header only, no day rows
    expect(rows[0].querySelector('.rp-section-badge')?.textContent).toBe('dados incompletos');
    expect(rows[0].querySelector('.rp-section-total')?.textContent).toBe('— kWh');
  });
});
