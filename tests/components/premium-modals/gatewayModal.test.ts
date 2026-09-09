/**
 * GatewayModal — probe latency history, rewritten to closely mirror
 * `src/components/temperature/TemperatureModal.ts` (see GatewayModal.ts's
 * file doc). Exercises the REAL self-contained DOM (own overlay, own
 * `ModalHeader`-rendered chrome) — no more `openGenericModal` mocking.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';

// createDateRangePicker does real network/CDN work (jQuery/moment/daterangepicker) —
// mocked so tests stay fast/deterministic and exercise the onApply contract directly.
const createDateRangePickerMock = vi.fn();
const fakeDateRangeControl = { getDates: vi.fn(), setDates: vi.fn(), destroy: vi.fn() };
vi.mock('../../../src/components/createDateRangePicker', () => ({
  createDateRangePicker: (...args: unknown[]) => createDateRangePickerMock(...args),
}));

import { readdirSync, unlinkSync } from 'node:fs';
import { openGatewayModal, calculateLatencyStats, calculateUptimeStats } from '../../../src/components/premium-modals/gateway';
import type { GatewayLatencyPoint } from '../../../src/components/premium-modals/gateway';

function root(): HTMLElement {
  const els = document.querySelectorAll<HTMLElement>('.myio-gwmodal-content');
  return els[els.length - 1];
}
function instanceCount(): number {
  return document.querySelectorAll('.myio-gwmodal-content').length;
}
function chartContainer(): HTMLElement {
  return root().querySelector<HTMLElement>('[id$="-chart"]')!;
}
function queryBtn(): HTMLButtonElement {
  return root().querySelector<HTMLButtonElement>('[id$="-query"]')!;
}
function exportBtn(): HTMLButtonElement {
  return root().querySelector<HTMLButtonElement>('[id$="-export"]')!;
}
function exportPdfBtn(): HTMLButtonElement {
  return root().querySelector<HTMLButtonElement>('[id$="-export-pdf"]')!;
}
function granularitySelect(): HTMLSelectElement {
  return root().querySelector<HTMLSelectElement>('[id$="-granularity"]')!;
}

// `exportGatewayPdf` calls jsPDF's `.save()`, which in the Node/jsdom test
// environment writes straight to disk (bypasses the stubbed anchor download
// path) — clean up any file it emits so it never leaks into the working tree.
function cleanupGeneratedPdfs(): void {
  try {
    for (const f of readdirSync(process.cwd())) {
      if (/^relatorio_conectividade_.*\.pdf$/i.test(f)) {
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
  fakeDateRangeControl.destroy.mockClear();
  createDateRangePickerMock.mockResolvedValue(fakeDateRangeControl);
});

afterEach(() => {
  document.querySelectorAll('[id^="myio-gwmodal-"]').forEach((el) => el.remove());
});

const baseParams = (overrides: Partial<Parameters<typeof openGatewayModal>[0]> = {}) => ({
  id: 'gw-1',
  name: 'Central Teste',
  source: {},
  ...overrides,
});

describe('calculateLatencyStats', () => {
  it('computes avg/min/max/count over non-null readings and counts gaps', () => {
    const data: GatewayLatencyPoint[] = [
      { ts: '2026-09-01T00:00:00.000Z', latencyMs: 40 },
      { ts: '2026-09-01T01:00:00.000Z', latencyMs: null },
      { ts: '2026-09-01T02:00:00.000Z', latencyMs: 60 },
    ];
    const stats = calculateLatencyStats(data);
    expect(stats.avg).toBe(50);
    expect(stats.min).toBe(40);
    expect(stats.max).toBe(60);
    expect(stats.count).toBe(2);
    expect(stats.gaps).toBe(1);
  });

  it('all-null data returns nulls and gaps === length, without dividing by zero', () => {
    const data: GatewayLatencyPoint[] = [
      { ts: '2026-09-01T00:00:00.000Z', latencyMs: null },
      { ts: '2026-09-01T01:00:00.000Z', latencyMs: null },
    ];
    const stats = calculateLatencyStats(data);
    expect(stats.avg).toBeNull();
    expect(stats.gaps).toBe(2);
    expect(stats.count).toBe(0);
  });
});

describe('calculateUptimeStats', () => {
  const startTs = new Date('2026-09-01T00:00:00.000Z').getTime();
  const endTs = new Date('2026-09-01T10:00:00.000Z').getTime(); // 10h window

  it('all readings succeed → 100% online, 0h offline', () => {
    const stats = calculateLatencyStats([
      { ts: '2026-09-01T01:00:00.000Z', latencyMs: 40 },
      { ts: '2026-09-01T02:00:00.000Z', latencyMs: 50 },
    ]);
    const uptime = calculateUptimeStats(stats, startTs, endTs);
    expect(uptime.hasData).toBe(true);
    expect(uptime.onlinePercent).toBe(100);
    expect(uptime.offlinePercent).toBe(0);
    expect(uptime.offlineHours).toBe(0);
    expect(uptime.totalHours).toBe(10);
  });

  it('proportionally scales the gap ratio across the period (25% gaps → 25% of 10h offline)', () => {
    const stats = calculateLatencyStats([
      { ts: '1', latencyMs: 40 },
      { ts: '2', latencyMs: 40 },
      { ts: '3', latencyMs: 40 },
      { ts: '4', latencyMs: null },
    ]);
    const uptime = calculateUptimeStats(stats, startTs, endTs);
    expect(uptime.offlinePercent).toBe(25);
    expect(uptime.onlinePercent).toBe(75);
    expect(uptime.offlineHours).toBeCloseTo(2.5, 5);
    expect(uptime.onlineHours).toBeCloseTo(7.5, 5);
  });

  it('no sampled points at all → hasData: false, not a divide-by-zero NaN', () => {
    const stats = calculateLatencyStats([]);
    const uptime = calculateUptimeStats(stats, startTs, endTs);
    expect(uptime.hasData).toBe(false);
    expect(Number.isNaN(uptime.onlinePercent)).toBe(false);
    expect(uptime.onlinePercent).toBe(0);
  });

  it('all readings fail → 0% online, offline hours === total period hours', () => {
    const stats = calculateLatencyStats([
      { ts: '1', latencyMs: null },
      { ts: '2', latencyMs: null },
    ]);
    const uptime = calculateUptimeStats(stats, startTs, endTs);
    expect(uptime.onlinePercent).toBe(0);
    expect(uptime.offlinePercent).toBe(100);
    expect(uptime.offlineHours).toBe(10);
  });
});

describe('openGatewayModal — data source', () => {
  it('calls source.onFetchLatencyHistory with {id, startTs, endTs} (ms)', async () => {
    const onFetchLatencyHistory = vi.fn().mockResolvedValue([]);
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory } }));
    expect(onFetchLatencyHistory).toHaveBeenCalledTimes(1);
    const call = onFetchLatencyHistory.mock.calls[0][0];
    expect(call.id).toBe('gw-1');
    expect(typeof call.startTs).toBe('number');
    expect(typeof call.endTs).toBe('number');
    expect(call.startTs).toBeLessThan(call.endTs);
  });

  it('builds a URL with start/end ISO query params when using baseUrl (no onFetchLatencyHistory)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    await openGatewayModal(baseParams({ id: 'gcdr-gw-42', source: { baseUrl: 'https://gcdr.example.com/' } }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('https://gcdr.example.com/admin/orchestrator-devices/api/centrals/gcdr-gw-42/latency');
    expect(url).toContain('start=');
    expect(url).toContain('end=');
    fetchSpy.mockRestore();
  });

  it('throws (surfaced as the error state) when neither baseUrl nor onFetchLatencyHistory is given', async () => {
    await openGatewayModal(baseParams({ source: {} }));
    expect(root().textContent).toContain('Erro ao carregar dados');
  });
});

describe('openGatewayModal — rendering (mirrors TemperatureModal.ts chrome)', () => {
  it('mounts one modal with ModalHeader chrome (theme toggle, maximize, close)', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    expect(instanceCount()).toBe(1);
    expect(root().querySelector('[id$="-theme-toggle"]')).toBeTruthy();
    expect(root().querySelector('[id$="-maximize"]')).toBeTruthy();
    expect(root().querySelector('[id$="-close"]')).toBeTruthy();
  });

  it('shows the 4 stats cards, granularity select, day-period button, and date-range input', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    expect(root().textContent).toContain('Latência Atual');
    expect(root().textContent).toContain('Média do Período');
    expect(root().textContent).toContain('Min / Max');
    expect(root().textContent).toContain('Alvo (SLA)');
    expect(granularitySelect()).toBeTruthy();
    expect(root().querySelector('[id$="-period-btn"]')).toBeTruthy();
    expect(root().querySelector('[id$="-date-range"]')).toBeTruthy();
    expect(queryBtn()).toBeTruthy();
  });

  it('shows an empty-state message when there is no data', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    expect(root().textContent).toContain('Sem dados para o período selecionado');
    expect(exportBtn().disabled).toBe(true);
  });

  it('renders a canvas and enables CSV export when data is present', async () => {
    const data: GatewayLatencyPoint[] = [
      { ts: new Date().toISOString(), latencyMs: 40 },
      { ts: new Date(Date.now() - 3600000).toISOString(), latencyMs: 60 },
    ];
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    expect(chartContainer().querySelector('canvas')).toBeTruthy();
    expect(exportBtn().disabled).toBe(false);
  });

  it('shows targetLatencyMs as the SLA card value, or "Não definido" when absent', async () => {
    const withTarget = await openGatewayModal(
      baseParams({ targetLatencyMs: 500, source: { onFetchLatencyHistory: () => Promise.resolve([]) } })
    );
    expect(root().textContent).toContain('500ms');
    withTarget.close();

    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    expect(root().textContent).toContain('Não definido');
  });
});

describe('openGatewayModal — Query button (Carregar)', () => {
  it('re-fetches with the current start/end when clicked', async () => {
    const onFetchLatencyHistory = vi.fn().mockResolvedValue([]);
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory } }));
    expect(onFetchLatencyHistory).toHaveBeenCalledTimes(1);

    queryBtn().click();
    await vi.waitFor(() => expect(onFetchLatencyHistory).toHaveBeenCalledTimes(2));
  });

  it('disables the Query button and shows a loading spinner while fetching', async () => {
    let resolveFetch: (v: GatewayLatencyPoint[]) => void = () => {};
    const onFetchLatencyHistory = vi.fn(() => new Promise<GatewayLatencyPoint[]>((r) => (resolveFetch = r)));
    // Don't await — inspect the loading state synchronously right after invocation.
    const openPromise = openGatewayModal(baseParams({ source: { onFetchLatencyHistory } }));
    expect(queryBtn().disabled).toBe(true);
    expect(root().textContent).toContain('Carregando dados');
    resolveFetch([]);
    await openPromise;
  });
});

describe('openGatewayModal — theme / maximize toggles', () => {
  it('theme toggle persists to localStorage and re-renders without throwing', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    const themeBtn = root().querySelector<HTMLButtonElement>('[id$="-theme-toggle"]')!;
    themeBtn.click();
    await vi.waitFor(() => expect(localStorage.getItem('myio-gwmodal-theme')).toBe('dark'));
  });

  it('maximize toggle re-renders without throwing', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    const maxBtn = root().querySelector<HTMLButtonElement>('[id$="-maximize"]')!;
    expect(() => maxBtn.click()).not.toThrow();
    expect(instanceCount()).toBe(1);
  });
});

describe('openGatewayModal — day-period filter + granularity', () => {
  it('day-period dropdown toggles open/closed and updates the button label', async () => {
    const data: GatewayLatencyPoint[] = [{ ts: new Date().toISOString(), latencyMs: 40 }];
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    const periodBtn = root().querySelector<HTMLButtonElement>('[id$="-period-btn"]')!;
    const dropdown = root().querySelector<HTMLElement>('[id$="-period-dropdown"]')!;
    expect(dropdown.style.display).toBe('none');
    periodBtn.click();
    expect(dropdown.style.display).toBe('block');

    const clearBtn = root().querySelector<HTMLButtonElement>('[id$="-period-clear"]')!;
    clearBtn.click();
    // getSelectedPeriodsLabel([]) === getSelectedPeriodsLabel(all 4) === "Todos os
    // períodos" — inherited as-is from temperature/utils.ts's own ambiguity
    // (0-selected and all-selected both mean "no filter"), not a new bug here.
    expect(periodBtn.textContent).toContain('Todos os períodos');

    const selectAllBtn = root().querySelector<HTMLButtonElement>('[id$="-period-select-all"]')!;
    selectAllBtn.click();
    expect(periodBtn.textContent).toContain('Todos os períodos');
  });

  it('granularity change persists to localStorage', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    const select = granularitySelect();
    select.value = 'day';
    select.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('myio-gwmodal-granularity')).toBe('day');
  });
});

describe('openGatewayModal — chart type selector', () => {
  function typeBtn(id: string): HTMLButtonElement {
    return root().querySelector<HTMLButtonElement>(`[id$="-charttype-${id}"]`)!;
  }

  afterEach(() => {
    localStorage.removeItem('myio-gwmodal-charttype');
  });

  it('defaults to "line" (pressed), all 5 options present', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    expect(typeBtn('line').getAttribute('aria-pressed')).toBe('true');
    ['line', 'smooth', 'bar', 'area', 'pie'].forEach((id) => expect(typeBtn(id)).toBeTruthy());
  });

  it('clicking a type switches aria-pressed and persists to localStorage', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    typeBtn('bar').click();
    await vi.waitFor(() => expect(typeBtn('bar').getAttribute('aria-pressed')).toBe('true'));
    expect(typeBtn('line').getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem('myio-gwmodal-charttype')).toBe('bar');
  });

  it('a saved chart type is honored on next open', async () => {
    localStorage.setItem('myio-gwmodal-charttype', 'area');
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    expect(typeBtn('area').getAttribute('aria-pressed')).toBe('true');
  });

  it('switching through every type with gap-containing data does not throw', async () => {
    const now = Date.now();
    const data: GatewayLatencyPoint[] = [
      { ts: new Date(now - 3 * 3600000).toISOString(), latencyMs: 40 },
      { ts: new Date(now - 2 * 3600000).toISOString(), latencyMs: null },
      { ts: new Date(now - 1 * 3600000).toISOString(), latencyMs: null },
      { ts: new Date(now).toISOString(), latencyMs: 55 },
    ];
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    for (const id of ['smooth', 'bar', 'area', 'pie', 'line']) {
      expect(() => typeBtn(id).click()).not.toThrow();
    }
  });
});

describe('openGatewayModal — Disponibilidade (uptime) card', () => {
  it('shows N/A when there is no data', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    expect(root().textContent).toContain('Disponibilidade');
    expect(root().textContent).toContain('N/A');
  });

  it('shows onlinePercent + offline hours/percent when data is present', async () => {
    const now = Date.now();
    const data: GatewayLatencyPoint[] = [
      { ts: new Date(now).toISOString(), latencyMs: 40 },
      { ts: new Date(now - 3600000).toISOString(), latencyMs: null },
      { ts: new Date(now - 7200000).toISOString(), latencyMs: 50 },
      { ts: new Date(now - 10800000).toISOString(), latencyMs: 60 },
    ];
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve(data) } }));
    expect(root().textContent).toContain('% online');
    expect(root().textContent).toMatch(/offline \(\d+(\.\d+)?%\)/);
  });
});

describe('openGatewayModal — PDF export', () => {
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

  it('is disabled when there is no data', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    expect(exportPdfBtn().disabled).toBe(true);
  });

  it('is enabled and does not throw when clicked with data present', async () => {
    const data: GatewayLatencyPoint[] = [
      { ts: new Date().toISOString(), latencyMs: 40 },
      { ts: new Date(Date.now() - 3600000).toISOString(), latencyMs: 60 },
    ];
    await openGatewayModal(
      baseParams({ targetLatencyMs: 100, currentLatencyMs: 40, source: { onFetchLatencyHistory: () => Promise.resolve(data) } })
    );
    expect(exportPdfBtn().disabled).toBe(false);
    expect(() => exportPdfBtn().click()).not.toThrow();
  });
});

describe('openGatewayModal — close behavior', () => {
  it('close button removes the modal from the DOM', async () => {
    await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    expect(instanceCount()).toBe(1);
    root().querySelector<HTMLButtonElement>('[id$="-close"]')!.click();
    expect(instanceCount()).toBe(0);
  });

  it('the instance returned close() also removes the modal', async () => {
    const instance = await openGatewayModal(baseParams({ source: { onFetchLatencyHistory: () => Promise.resolve([]) } }));
    expect(instanceCount()).toBe(1);
    instance.close();
    expect(instanceCount()).toBe(0);
  });
});
