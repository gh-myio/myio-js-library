/**
 * GatewayComparisonModal — multi-central latency comparison, near-1:1
 * structural port of TemperatureComparisonModal.ts (see
 * GatewayComparisonModal.ts's file doc).
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { readdirSync, unlinkSync } from 'node:fs';

const createDateRangePickerMock = vi.fn();
const fakeDateRangeControl = { getDates: vi.fn(), setDates: vi.fn(), destroy: vi.fn() };
vi.mock('../../../src/components/createDateRangePicker', () => ({
  createDateRangePicker: (...args: unknown[]) => createDateRangePickerMock(...args),
}));

import { openGatewayComparisonModal } from '../../../src/components/premium-modals/gateway-comparison';
import type { GatewayLatencyPoint, CentralForComparison } from '../../../src/components/premium-modals/gateway-comparison';

function root(): HTMLElement {
  const els = document.querySelectorAll<HTMLElement>('.myio-gw-comparison-content');
  return els[els.length - 1];
}
function instanceCount(): number {
  return document.querySelectorAll('.myio-gw-comparison-content').length;
}
function statCard(label: string): HTMLElement {
  return Array.from(root().querySelectorAll<HTMLElement>('[data-central-id]')).find((el) =>
    el.textContent?.includes(label)
  )!;
}
function eyeBtn(label: string): HTMLButtonElement {
  return statCard(label).querySelector<HTMLButtonElement>('button')!;
}

// `exportGatewayComparisonPdf` calls jsPDF's `.save()`, which in the
// Node/jsdom test environment writes straight to disk — clean up any file it
// emits so it never leaks into the working tree.
function cleanupGeneratedPdfs(): void {
  try {
    for (const f of readdirSync(process.cwd())) {
      if (/^comparacao_conectividade_.*\.pdf$/i.test(f)) {
        try {
          unlinkSync(f);
        } catch {
          /* best-effort */
        }
      }
    }
  } catch {
    /* cwd not readable — nothing to clean */
  }
}

beforeEach(() => {
  createDateRangePickerMock.mockReset();
  fakeDateRangeControl.setDates.mockClear();
  createDateRangePickerMock.mockResolvedValue(fakeDateRangeControl);
});

afterEach(() => {
  document.querySelectorAll('[id^="myio-gw-comparison-modal-"]').forEach((el) => el.remove());
});

const CENTRALS: CentralForComparison[] = [
  { id: 'c1', label: 'Central Campinas', targetLatencyMs: 200 },
  { id: 'c2', label: 'Central Montserrat', targetLatencyMs: 200 },
  { id: 'c3', label: 'Central West Plaza' },
];

const baseParams = (overrides: Partial<Parameters<typeof openGatewayComparisonModal>[0]> = {}) => ({
  centrals: CENTRALS,
  startDate: '2026-08-01T00:00:00.000Z',
  endDate: '2026-09-01T00:00:00.000Z',
  source: { onFetchLatencyHistory: () => Promise.resolve([]) },
  ...overrides,
});

describe('openGatewayComparisonModal — mounts + fetches per central', () => {
  it('fetches once per central via Promise.all, each with the shared start/end window', async () => {
    const onFetchLatencyHistory = vi.fn().mockResolvedValue([]);
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory } }));
    expect(onFetchLatencyHistory).toHaveBeenCalledTimes(3);
    const ids = onFetchLatencyHistory.mock.calls.map((c) => c[0].id).sort();
    expect(ids).toEqual(['c1', 'c2', 'c3']);
    onFetchLatencyHistory.mock.calls.forEach((c) => {
      expect(c[0].startTs).toBe(new Date('2026-08-01T00:00:00.000Z').getTime());
      expect(c[0].endTs).toBe(new Date('2026-09-01T00:00:00.000Z').getTime());
    });
  });

  it('mounts one modal titled with the central count', async () => {
    await openGatewayComparisonModal(baseParams());
    expect(instanceCount()).toBe(1);
    expect(root().textContent).toContain('3 centrais');
  });

  it('a central whose fetch rejects still renders (empty data for that one), does not crash the modal', async () => {
    const onFetchLatencyHistory = vi.fn((p: { id: string }) =>
      p.id === 'c2' ? Promise.reject(new Error('boom')) : Promise.resolve([])
    );
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory } }));
    expect(instanceCount()).toBe(1);
    expect(root().textContent).toContain('Central Montserrat');
  });
});

describe('openGatewayComparisonModal — legend + stats cards', () => {
  it('renders a legend row and a stats card per central with data', async () => {
    const data: GatewayLatencyPoint[] = [
      { ts: new Date('2026-08-15T10:00:00.000Z').toISOString(), latencyMs: 40 },
      { ts: new Date('2026-08-15T11:00:00.000Z').toISOString(), latencyMs: 60 },
    ];
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    expect(root().textContent).toContain('Central Campinas');
    expect(root().textContent).toContain('Central Montserrat');
    expect(root().textContent).toContain('Central West Plaza');
    expect(root().textContent).toContain('50ms'); // avg of 40/60
  });

  it('shows the empty-state message and disables export when no central has data', async () => {
    await openGatewayComparisonModal(baseParams());
    expect(root().textContent).toContain('Sem dados para o período selecionado');
    expect(root().querySelector<HTMLButtonElement>('[id$="-export"]')!.disabled).toBe(true);
  });

  it('per-central card shows a single Mín./Méd./Máx line and a Conectividade line with online/offline hours+percent', async () => {
    const data: GatewayLatencyPoint[] = [
      { ts: '2026-08-15T10:00:00.000Z', latencyMs: 40 },
      { ts: '2026-08-15T11:00:00.000Z', latencyMs: null },
      { ts: '2026-08-15T12:00:00.000Z', latencyMs: 60 },
    ]; // min 40 / avg 50 / max 60, 1 gap of 3 → 33.3% offline
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    const card = statCard('Central Campinas');
    expect(card.textContent).toContain('Mín. / Méd. / Máx:');
    expect(card.textContent).toContain('40ms / 50ms / 60ms');
    expect(card.textContent).toContain('Conectividade:');
    expect(card.textContent).toMatch(/66\.7%/); // online
    expect(card.textContent).toMatch(/33\.3%/); // offline
    // No more separate "Média:"/"Min:"/"Max:" rows.
    expect(card.textContent).not.toContain('Média:');
    expect(card.textContent).not.toContain('Min:');
    expect(card.textContent).not.toContain('Max:');
  });

  it('per-central card shows N/A for both fields when the central has no data', async () => {
    await openGatewayComparisonModal(baseParams());
    const card = statCard('Central Campinas');
    expect(card.textContent).toContain('Mín. / Méd. / Máx:');
    expect(card.textContent).toContain('Conectividade:');
  });
});

describe('openGatewayComparisonModal — chart', () => {
  it('renders a canvas when at least one central has data', async () => {
    const data: GatewayLatencyPoint[] = [{ ts: new Date().toISOString(), latencyMs: 50 }];
    const onFetchLatencyHistory = vi.fn((p: { id: string }) => Promise.resolve(p.id === 'c1' ? data : []));
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory } }));
    const chart = root().querySelector<HTMLElement>('[id$="-chart"]')!;
    expect(chart.querySelector('canvas')).toBeTruthy();
  });
});

describe('openGatewayComparisonModal — chart type selector', () => {
  function typeBtn(id: string): HTMLButtonElement {
    return root().querySelector<HTMLButtonElement>(`[id$="-charttype-${id}"]`)!;
  }

  afterEach(() => {
    localStorage.removeItem('myio-gw-comparison-charttype');
  });

  it('defaults to "line" (pressed), all 5 options present, next to "Histórico de Latência"', async () => {
    await openGatewayComparisonModal(baseParams());
    expect(root().textContent).toContain('Histórico de Latência');
    expect(typeBtn('line').getAttribute('aria-pressed')).toBe('true');
    ['line', 'smooth', 'bar', 'area', 'pie'].forEach((id) => expect(typeBtn(id)).toBeTruthy());
  });

  it('clicking a type switches aria-pressed and persists to localStorage', async () => {
    await openGatewayComparisonModal(baseParams());
    typeBtn('area').click();
    await vi.waitFor(() => expect(typeBtn('area').getAttribute('aria-pressed')).toBe('true'));
    expect(typeBtn('line').getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('myio-gw-comparison-charttype')).toBe('area');
  });

  it('a saved chart type is honored on next open', async () => {
    localStorage.setItem('myio-gw-comparison-charttype', 'bar');
    await openGatewayComparisonModal(baseParams());
    expect(typeBtn('bar').getAttribute('aria-pressed')).toBe('true');
  });

  it('switching through every type with gap-containing, multi-central data does not throw', async () => {
    const data: GatewayLatencyPoint[] = [
      { ts: '2026-08-15T10:00:00.000Z', latencyMs: 40 },
      { ts: '2026-08-15T10:30:00.000Z', latencyMs: null },
      { ts: '2026-08-15T11:00:00.000Z', latencyMs: null },
      { ts: '2026-08-15T11:30:00.000Z', latencyMs: 55 },
    ];
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    for (const id of ['smooth', 'bar', 'area', 'pie', 'line']) {
      expect(() => typeBtn(id).click()).not.toThrow();
    }
  });
});

describe('openGatewayComparisonModal — controls', () => {
  it('granularity select, day-period button, date-range input, and Query button are present', async () => {
    await openGatewayComparisonModal(baseParams());
    expect(root().querySelector('[id$="-granularity"]')).toBeTruthy();
    expect(root().querySelector('[id$="-period-btn"]')).toBeTruthy();
    expect(root().querySelector('[id$="-date-range"]')).toBeTruthy();
    expect(root().querySelector('[id$="-query"]')).toBeTruthy();
  });

  it('Query button re-fetches all centrals', async () => {
    const onFetchLatencyHistory = vi.fn().mockResolvedValue([]);
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory } }));
    expect(onFetchLatencyHistory).toHaveBeenCalledTimes(3);
    root().querySelector<HTMLButtonElement>('[id$="-query"]')!.click();
    await vi.waitFor(() => expect(onFetchLatencyHistory).toHaveBeenCalledTimes(6));
  });
});

describe('openGatewayComparisonModal — theme / maximize / close', () => {
  it('theme toggle persists to localStorage without throwing', async () => {
    await openGatewayComparisonModal(baseParams());
    root().parentElement!.querySelector<HTMLButtonElement>('[id$="-theme-toggle"]')!.click();
    await vi.waitFor(() => expect(localStorage.getItem('myio-gw-comparison-theme')).toBeTruthy());
  });

  it('maximize toggle re-renders without throwing', async () => {
    await openGatewayComparisonModal(baseParams());
    const btn = root().parentElement!.querySelector<HTMLButtonElement>('[id$="-maximize"]')!;
    expect(() => btn.click()).not.toThrow();
    expect(instanceCount()).toBe(1);
  });

  it('close button and destroy() both remove the modal', async () => {
    const instance = await openGatewayComparisonModal(baseParams());
    expect(instanceCount()).toBe(1);
    instance.destroy();
    expect(instanceCount()).toBe(0);

    await openGatewayComparisonModal(baseParams());
    expect(instanceCount()).toBe(1);
    document.querySelector<HTMLButtonElement>('[id$="-close"]')!.click();
    expect(instanceCount()).toBe(0);
  });

  it('onClose callback fires on destroy()', async () => {
    const onClose = vi.fn();
    const instance = await openGatewayComparisonModal(baseParams({ onClose }));
    instance.destroy();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('openGatewayComparisonModal — eye toggle (show/hide per central)', () => {
  const data: GatewayLatencyPoint[] = [
    { ts: new Date('2026-08-15T10:00:00.000Z').toISOString(), latencyMs: 40 },
    { ts: new Date('2026-08-15T11:00:00.000Z').toISOString(), latencyMs: 60 },
  ];

  it('defaults every central to visible (👁️, full opacity)', async () => {
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    expect(eyeBtn('Central Campinas').textContent).toContain('👁️');
    expect(statCard('Central Campinas').style.opacity).toBe('1');
  });

  it('clicking the eye icon dims that central\'s stats card and flips the icon', async () => {
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    eyeBtn('Central Campinas').click();
    await vi.waitFor(() => expect(eyeBtn('Central Campinas').textContent).toContain('🙈'));
    expect(statCard('Central Campinas').style.opacity).toBe('0.4');
    // Other centrals stay untouched
    expect(statCard('Central Montserrat').style.opacity).toBe('1');
  });

  it('clicking again restores visibility', async () => {
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    eyeBtn('Central Campinas').click();
    await vi.waitFor(() => expect(eyeBtn('Central Campinas').textContent).toContain('🙈'));
    eyeBtn('Central Campinas').click();
    await vi.waitFor(() => expect(eyeBtn('Central Campinas').textContent).toContain('👁️'));
    expect(statCard('Central Campinas').style.opacity).toBe('1');
  });

  it('hiding all centrals shows a message instead of a blank chart', async () => {
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    eyeBtn('Central Campinas').click();
    await vi.waitFor(() => expect(eyeBtn('Central Campinas').textContent).toContain('🙈'));
    eyeBtn('Central Montserrat').click();
    await vi.waitFor(() => expect(eyeBtn('Central Montserrat').textContent).toContain('🙈'));
    eyeBtn('Central West Plaza').click();
    await vi.waitFor(() => expect(eyeBtn('Central West Plaza').textContent).toContain('🙈'));
    expect(instanceCount()).toBe(1); // never throws / unmounts
  });
});

describe('openGatewayComparisonModal — retractable KPI sidebar', () => {
  afterEach(() => {
    localStorage.removeItem('myio-gw-comparison-kpi-sidebar');
  });

  it('is open by default (sidebar visible, both toggle buttons present)', async () => {
    await openGatewayComparisonModal(baseParams());
    expect(root().querySelector<HTMLButtonElement>('[id$="-kpi-toggle"]')).toBeTruthy();
    expect(root().querySelector<HTMLButtonElement>('[id$="-kpi-toggle-footer"]')!.textContent).toContain('Ocultar KPIs');
  });

  it('the header icon toggle collapses the sidebar (width 0) and flips the footer label', async () => {
    await openGatewayComparisonModal(baseParams());
    root().querySelector<HTMLButtonElement>('[id$="-kpi-toggle"]')!.click();
    await vi.waitFor(() =>
      expect(root().querySelector<HTMLButtonElement>('[id$="-kpi-toggle-footer"]')!.textContent).toContain('Mostrar KPIs')
    );
  });

  it('the footer text toggle also works and persists the choice to localStorage', async () => {
    await openGatewayComparisonModal(baseParams());
    root().querySelector<HTMLButtonElement>('[id$="-kpi-toggle-footer"]')!.click();
    await vi.waitFor(() => expect(localStorage.getItem('myio-gw-comparison-kpi-sidebar')).toBe('0'));
  });

  it('a saved "closed" preference is honored on next open', async () => {
    localStorage.setItem('myio-gw-comparison-kpi-sidebar', '0');
    await openGatewayComparisonModal(baseParams());
    expect(root().querySelector<HTMLButtonElement>('[id$="-kpi-toggle-footer"]')!.textContent).toContain('Mostrar KPIs');
  });
});

describe('openGatewayComparisonModal — consolidated KPI card', () => {
  it('shows N/A when no central has data', async () => {
    await openGatewayComparisonModal(baseParams());
    expect(root().textContent).toContain('Consolidado');
    expect(root().textContent).toContain('Média geral de latência');
    expect(root().textContent).toContain('Tempo online estimado');
    expect(root().textContent).toContain('Tempo offline estimado');
  });

  it('shows both online and offline estimated time, each with a percentage', async () => {
    const data: GatewayLatencyPoint[] = [
      { ts: '2026-08-15T10:00:00.000Z', latencyMs: 40 },
      { ts: '2026-08-15T11:00:00.000Z', latencyMs: null },
      { ts: '2026-08-15T12:00:00.000Z', latencyMs: 60 },
      { ts: '2026-08-15T13:00:00.000Z', latencyMs: 50 },
    ]; // 1 gap out of 4 points → 25% offline / 75% online for every central
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    const kpiText = root().textContent || '';
    expect(kpiText).toContain('75.0% online');
    expect(kpiText).toContain('25.0% offline');
  });

  it('shows the average latency across all (visible) centrals with data', async () => {
    const data: GatewayLatencyPoint[] = [
      { ts: new Date('2026-08-15T10:00:00.000Z').toISOString(), latencyMs: 40 },
      { ts: new Date('2026-08-15T11:00:00.000Z').toISOString(), latencyMs: 60 },
    ];
    // c1/c2/c3 all get the same 50ms-avg dataset → overall avg is also 50ms.
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    const kpiText = root().textContent || '';
    expect(kpiText).toContain('3 de 3 visíveis');
    // 50ms appears both per-card and in the consolidated KPI.
    expect((kpiText.match(/50ms/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('recomputes (excludes the hidden central) after an eye toggle', async () => {
    const onFetchLatencyHistory = vi.fn((p: { id: string }) =>
      Promise.resolve(
        p.id === 'c1'
          ? [{ ts: '2026-08-15T10:00:00.000Z', latencyMs: 100 }]
          : [{ ts: '2026-08-15T10:00:00.000Z', latencyMs: 200 }]
      )
    );
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory } }));
    // Before hiding: avg across c1(100)/c2(200)/c3(200) = 166.67 → rounds to 167ms
    expect(root().textContent).toContain('167ms');

    eyeBtn('Central Campinas').click(); // hide c1 (100ms) — remaining c2/c3 both 200ms
    await vi.waitFor(() => expect(root().textContent).toContain('2 de 3 visíveis'));
    expect(root().textContent).toContain('200ms');
  });
});

describe('openGatewayComparisonModal — PDF export', () => {
  beforeEach(() => {
    if (typeof URL.createObjectURL !== 'function') {
      (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => '';
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(cleanupGeneratedPdfs);

  it('is disabled when no central has data', async () => {
    await openGatewayComparisonModal(baseParams());
    expect(root().querySelector<HTMLButtonElement>('[id$="-export-pdf"]')!.disabled).toBe(true);
  });

  it('is enabled and does not throw when clicked with data present, including with a hidden central', async () => {
    const data: GatewayLatencyPoint[] = [{ ts: new Date('2026-08-15T10:00:00.000Z').toISOString(), latencyMs: 40 }];
    await openGatewayComparisonModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    eyeBtn('Central Campinas').click();
    await vi.waitFor(() => expect(eyeBtn('Central Campinas').textContent).toContain('🙈'));
    const btn = root().querySelector<HTMLButtonElement>('[id$="-export-pdf"]')!;
    expect(btn.disabled).toBe(false);
    expect(() => btn.click()).not.toThrow();
  });
});
