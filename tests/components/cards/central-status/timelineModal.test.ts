/**
 * RFC-0231 (follow-up) — openCentralTimelineModal
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const openGenericModalMock = vi.fn();
vi.mock('../../../../src/components/premium-modals/dialog', () => ({
  openGenericModal: (...args: unknown[]) => openGenericModalMock(...args),
}));

import { openCentralTimelineModal } from '../../../../src/components/cards/central-status/v1.0.0';
import type { CentralTimelineResponse } from '../../../../src/components/cards/central-status/v1.0.0';

function fakeGenericModal(params: { bodyHtml: string }) {
  const bodyEl = document.createElement('div');
  bodyEl.innerHTML = params.bodyHtml;
  document.body.appendChild(bodyEl);
  return {
    close: vi.fn(),
    setBodyHtml: (html: string) => {
      bodyEl.innerHTML = html;
    },
    setTitle: vi.fn(),
    getBodyEl: () => bodyEl,
    getRoot: () => bodyEl,
  };
}

beforeEach(() => {
  openGenericModalMock.mockReset();
  openGenericModalMock.mockImplementation(fakeGenericModal);
});

const baseCallParams = (overrides: Partial<Parameters<typeof openCentralTimelineModal>[0]> = {}) => ({
  id: 'gw-1',
  name: 'Central Teste',
  timeline: {},
  labels: {},
  language: 'pt' as const,
  theme: 'light' as const,
  ...overrides,
});

describe('openCentralTimelineModal — data source', () => {
  it('uses onFetchTimeline when provided, with {id, days}', async () => {
    const onFetchTimeline = vi.fn().mockResolvedValue({ transitions: [], segments: [] } as CentralTimelineResponse);
    openCentralTimelineModal(baseCallParams({ timeline: { onFetchTimeline } }));
    await vi.waitFor(() => expect(onFetchTimeline).toHaveBeenCalledWith({ id: 'gw-1', days: 30 }));
  });

  it('builds the URL from baseUrl + path template, substituting :id and appending ?days=N', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ transitions: [], segments: [] }),
    } as Response);
    openCentralTimelineModal(
      baseCallParams({
        id: 'gcdr-gw-42',
        timeline: { baseUrl: 'https://gcdr.example.com/' },
      })
    );
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://gcdr.example.com/admin/orchestrator-devices/api/centrals/gcdr-gw-42/timeline?days=30'
    );
    fetchSpy.mockRestore();
  });

  it('honors a custom `path` template', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ transitions: [], segments: [] }),
    } as Response);
    openCentralTimelineModal(
      baseCallParams({
        id: 'gw-7',
        timeline: { baseUrl: 'https://gcdr.example.com', path: '/v2/centrals/:id/history' },
      })
    );
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][0]).toBe('https://gcdr.example.com/v2/centrals/gw-7/history?days=30');
    fetchSpy.mockRestore();
  });

  it('passes `fetchOptions` through to fetch() verbatim (headers/credentials — the card never invents auth)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ transitions: [], segments: [] }),
    } as Response);
    const fetchOptions = { headers: { 'X-Api-Key': 'secret' } };
    openCentralTimelineModal(
      baseCallParams({ timeline: { baseUrl: 'https://gcdr.example.com', fetchOptions } })
    );
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][1]).toBe(fetchOptions);
    fetchSpy.mockRestore();
  });

  it('rejects when neither baseUrl nor onFetchTimeline is given', async () => {
    openCentralTimelineModal(baseCallParams({ timeline: {} }));
    await vi.waitFor(() => {
      const body = openGenericModalMock.mock.results[0].value.getBodyEl();
      expect(body.textContent).toMatch(/Não foi possível carregar a timeline\./);
    });
  });
});

describe('openCentralTimelineModal — rendering', () => {
  it('default period is 30 days, selected in the period bar', async () => {
    openCentralTimelineModal(
      baseCallParams({ timeline: { onFetchTimeline: () => Promise.resolve({ transitions: [], segments: [] }) } })
    );
    await vi.waitFor(() => {
      const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
      const selected = body.querySelector('[data-days="30"]');
      expect(selected?.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('renders the legend with DEGRADED labeled "ATENÇÃO" in pt, "DEGRADED" in en', async () => {
    const ptCard = openCentralTimelineModal(
      baseCallParams({ timeline: { onFetchTimeline: () => Promise.resolve({ transitions: [], segments: [] }) } })
    );
    const ptBody = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
    expect(ptBody.textContent).toContain('ATENÇÃO');

    openCentralTimelineModal(
      baseCallParams({
        language: 'en',
        timeline: { onFetchTimeline: () => Promise.resolve({ transitions: [], segments: [] }) },
      })
    );
    const enBody = openGenericModalMock.mock.results[1].value.getBodyEl() as HTMLElement;
    expect(enBody.textContent).toContain('DEGRADED');
    void ptCard;
  });

  it('empty transitions renders the "no transitions" message', async () => {
    openCentralTimelineModal(
      baseCallParams({ timeline: { onFetchTimeline: () => Promise.resolve({ transitions: [], segments: [] }) } })
    );
    await vi.waitFor(() => {
      const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
      expect(body.textContent).toContain('Sem transições registradas nesse período.');
    });
  });

  it('bar segments are rendered in order with a >=0.3% floor that still sums to ~100%', async () => {
    const data: CentralTimelineResponse = {
      transitions: [],
      segments: [
        { status: 'ONLINE', start: '2026-09-01T00:00:00.000Z', end: '2026-09-07T23:59:00.000Z', durationMs: 7 * 86400000 },
        { status: 'OFFLINE', start: '2026-09-07T23:59:00.000Z', end: '2026-09-08T00:00:00.000Z', durationMs: 1000 }, // a tiny blip
      ],
    };
    openCentralTimelineModal(
      baseCallParams({ timeline: { onFetchTimeline: () => Promise.resolve(data) } })
    );
    await vi.waitFor(() => {
      const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
      const segs = body.querySelectorAll<HTMLElement>('.myio-tlmodal__seg');
      expect(segs.length).toBe(2);
      expect(segs[0].classList.contains('myio-tlmodal__seg--ONLINE')).toBe(true);
      expect(segs[1].classList.contains('myio-tlmodal__seg--OFFLINE')).toBe(true);
      const pct0 = parseFloat(segs[0].style.flexBasis);
      const pct1 = parseFloat(segs[1].style.flexBasis);
      expect(pct1).toBeGreaterThanOrEqual(0.29); // the 1s blip still gets a visible floor
      expect(pct0 + pct1).toBeCloseTo(100, 0);
    });
  });

  it('transitions list is sorted most-recent-first regardless of input order', async () => {
    const data: CentralTimelineResponse = {
      segments: [],
      transitions: [
        { from_status: 'ONLINE', to_status: 'OFFLINE', probe_result: 'TIMEOUT', mode: 'shadow', created_at: '2026-09-01T10:00:00.000Z' },
        { from_status: 'OFFLINE', to_status: 'ONLINE', probe_result: null, mode: 'canonical', created_at: '2026-09-05T10:00:00.000Z' },
      ],
    };
    openCentralTimelineModal(
      baseCallParams({ timeline: { onFetchTimeline: () => Promise.resolve(data) } })
    );
    await vi.waitFor(() => {
      const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
      const items = body.querySelectorAll('.myio-tlmodal__list-item');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('OFFLINE → ONLINE'); // 09-05, most recent, comes first
      expect(items[1].textContent).toContain('ONLINE → OFFLINE'); // 09-01
    });
  });

  it('a probe_result of null omits the probe chip; mode is always shown', async () => {
    const data: CentralTimelineResponse = {
      segments: [],
      transitions: [
        { from_status: 'OFFLINE', to_status: 'ONLINE', probe_result: null, mode: 'canonical', created_at: '2026-09-05T10:00:00.000Z' },
      ],
    };
    openCentralTimelineModal(
      baseCallParams({ timeline: { onFetchTimeline: () => Promise.resolve(data) } })
    );
    await vi.waitFor(() => {
      const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
      expect(body.querySelector('.myio-tlmodal__list-probe')).toBeNull();
      expect(body.querySelector('.myio-tlmodal__list-mode--canonical')).toBeTruthy();
    });
  });
});

describe('openCentralTimelineModal — period switching', () => {
  it('clicking a different period button re-fetches with the new `days` and updates aria-selected', async () => {
    const onFetchTimeline = vi.fn().mockResolvedValue({ transitions: [], segments: [] });
    openCentralTimelineModal(baseCallParams({ timeline: { onFetchTimeline, periods: [1, 7, 30, 90] } }));
    const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
    // Wait for the FINAL observable effect (button re-enabled after the loading
    // render), not just "the mock was called" — the mock call happens
    // synchronously before setBodyHtml re-renders the (still-disabled) buttons.
    await vi.waitFor(() => expect(body.querySelector<HTMLButtonElement>('[data-days="30"]')?.disabled).toBe(false));

    body.querySelector<HTMLButtonElement>('[data-days="7"]')!.click();
    await vi.waitFor(() => expect(onFetchTimeline).toHaveBeenCalledWith({ id: 'gw-1', days: 7 }));

    const freshBody = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
    await vi.waitFor(() => expect(freshBody.querySelector('[data-days="7"]')?.getAttribute('aria-selected')).toBe('true'));
  });

  it('clicking the currently-selected period is a no-op (no redundant fetch)', async () => {
    const onFetchTimeline = vi.fn().mockResolvedValue({ transitions: [], segments: [] });
    openCentralTimelineModal(baseCallParams({ timeline: { onFetchTimeline } }));
    const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
    await vi.waitFor(() => expect(onFetchTimeline).toHaveBeenCalledTimes(1));
    body.querySelector<HTMLButtonElement>('[data-days="30"]')!.click();
    expect(onFetchTimeline).toHaveBeenCalledTimes(1);
  });

  it('respects a custom `periods` list and `defaultDays`', async () => {
    openCentralTimelineModal(
      baseCallParams({
        timeline: {
          onFetchTimeline: () => Promise.resolve({ transitions: [], segments: [] }),
          periods: [7, 90],
          defaultDays: 90,
        },
      })
    );
    const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
    const buttons = Array.from(body.querySelectorAll<HTMLElement>('[data-days]'));
    expect(buttons.map((b) => b.dataset.days)).toEqual(['7', '90']);
    expect(body.querySelector('[data-days="90"]')?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('openCentralTimelineModal — error + retry', () => {
  it('a rejected fetch shows the error message with a retry button', async () => {
    const onFetchTimeline = vi.fn().mockRejectedValueOnce(new Error('network down'));
    openCentralTimelineModal(baseCallParams({ timeline: { onFetchTimeline } }));
    await vi.waitFor(() => {
      const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
      expect(body.querySelector('[data-role="timeline-retry"]')).toBeTruthy();
    });
  });

  it('clicking retry re-fetches the same period and can succeed', async () => {
    const onFetchTimeline = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ transitions: [], segments: [] });
    openCentralTimelineModal(baseCallParams({ timeline: { onFetchTimeline } }));
    await vi.waitFor(() => {
      const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
      expect(body.querySelector('[data-role="timeline-retry"]')).toBeTruthy();
    });
    const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
    body.querySelector<HTMLButtonElement>('[data-role="timeline-retry"]')!.click();
    await vi.waitFor(() => expect(onFetchTimeline).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => {
      const freshBody = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
      expect(freshBody.querySelector('[data-role="timeline-retry"]')).toBeNull();
    });
  });
});

describe('openCentralTimelineModal — labels override', () => {
  it('every default text is overridable via `labels`', async () => {
    openCentralTimelineModal(
      baseCallParams({
        timeline: { onFetchTimeline: () => Promise.resolve({ transitions: [], segments: [] }) },
        labels: {
          timelineModalTitle: 'Custom title for {name}',
          timelineEmptyState: 'Custom empty state',
          timelineLegend: { DEGRADED: 'Custom Degraded' },
        },
      })
    );
    expect(openGenericModalMock.mock.calls[0][0].title).toBe('Custom title for Central Teste');
    await vi.waitFor(() => {
      const body = openGenericModalMock.mock.results[0].value.getBodyEl() as HTMLElement;
      expect(body.textContent).toContain('Custom empty state');
      expect(body.textContent).toContain('Custom Degraded');
    });
  });
});
