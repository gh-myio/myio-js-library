// AllReportModal.ensureDeviceSeries — RFC-0223 per-device series fetch, with
// mocked global.fetch (no live network). Covers batching, per-device coverage
// tracking (AC19), cache-key sensitivity to the device set, and the
// in-flight-discarded-on-mode-change race the RFC calls out explicitly.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

describe('AllReportModal.ensureDeviceSeries', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches per-device points, records coverage=ok, and caches under a granularity-aware key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ consumption: [{ timestamp: '2026-07-01T12:00:00Z', value: 5 }] })
    );
    vi.stubGlobal('fetch', fetchMock);

    const modal = new AllReportModal(baseParams());
    (modal as any).exportPeriod = PERIOD;
    const rows = [{ identifier: 'A', name: 'A', consumption: 0, id: 'a' }];

    const raw = await (modal as any).ensureDeviceSeries(rows, '1d');
    expect(raw.get('a')).toEqual([{ timestamp: new Date('2026-07-01T12:00:00Z').getTime(), value: 5 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('granularity=1d');

    const cache = (modal as any).deviceSeriesCache;
    expect(cache.granularity).toBe('1d');
    expect(cache.coverage.get('a')).toBe('ok');

    // Second call with the SAME rows/granularity/period reuses the cache — no new fetch.
    await (modal as any).ensureDeviceSeries(rows, '1d');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('AC19: a non-ok response marks that device coverage=failed without throwing for the whole batch', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        url.includes('/devices/a/')
          ? Promise.resolve(jsonResponse({ consumption: [{ timestamp: '2026-07-01T12:00:00Z', value: 5 }] }))
          : Promise.resolve(jsonResponse(null, false))
      );
    vi.stubGlobal('fetch', fetchMock);

    const modal = new AllReportModal(baseParams());
    (modal as any).exportPeriod = PERIOD;
    const rows = [
      { identifier: 'A', name: 'A', consumption: 0, id: 'a' },
      { identifier: 'B', name: 'B', consumption: 0, id: 'b' },
    ];

    const raw = await (modal as any).ensureDeviceSeries(rows, '1d');
    expect(raw.has('a')).toBe(true);
    expect(raw.has('b')).toBe(false);
    const cache = (modal as any).deviceSeriesCache;
    expect(cache.coverage.get('a')).toBe('ok');
    expect(cache.coverage.get('b')).toBe('failed');
  });

  it('a thrown network error marks coverage=failed instead of propagating out of the batch', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const modal = new AllReportModal(baseParams());
    (modal as any).exportPeriod = PERIOD;
    const rows = [{ identifier: 'A', name: 'A', consumption: 0, id: 'a' }];

    const raw = await (modal as any).ensureDeviceSeries(rows, '1d');
    expect(raw.size).toBe(0);
    expect((modal as any).deviceSeriesCache.coverage.get('a')).toBe('failed');
  });

  it('batches requests in groups of 6 concurrent devices', async () => {
    let maxConcurrent = 0;
    let inFlight = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      inFlight++;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await Promise.resolve();
      inFlight--;
      return jsonResponse({ consumption: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const modal = new AllReportModal(baseParams());
    (modal as any).exportPeriod = PERIOD;
    const rows = Array.from({ length: 14 }, (_, i) => ({
      identifier: `D${i}`,
      name: `D${i}`,
      consumption: 0,
      id: `d${i}`,
    }));

    await (modal as any).ensureDeviceSeries(rows, '1d');
    expect(fetchMock).toHaveBeenCalledTimes(14);
    expect(maxConcurrent).toBeLessThanOrEqual(6);
  });

  it('cache key changes when the device set changes (exclusion toggle), forcing a refetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ consumption: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const modal = new AllReportModal(baseParams());
    (modal as any).exportPeriod = PERIOD;
    const rowsAB = [
      { identifier: 'A', name: 'A', consumption: 0, id: 'a' },
      { identifier: 'B', name: 'B', consumption: 0, id: 'b' },
    ];
    const rowsA = [rowsAB[0]];

    await (modal as any).ensureDeviceSeries(rowsAB, '1d');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await (modal as any).ensureDeviceSeries(rowsA, '1d'); // different idsKey -> refetch
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('discards a stale in-flight result if reportMode changed to a different granularity before it resolved', async () => {
    let resolveFirst!: (v: unknown) => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue(jsonResponse({ consumption: [{ timestamp: '2026-07-02T12:00:00Z', value: 9 }] }));
    vi.stubGlobal('fetch', fetchMock);

    const modal = new AllReportModal(baseParams());
    (modal as any).exportPeriod = PERIOD;
    const rows = [{ identifier: 'A', name: 'A', consumption: 0, id: 'a' }];

    // Start a 1d fetch, but don't await it yet.
    (modal as any).reportMode = '1d';
    const firstFetch = (modal as any).ensureDeviceSeries(rows, '1d');

    // User switches to Horário before the 1d fetch resolves — this fetch
    // completes synchronously (mockResolvedValue) and caches under '1h'.
    (modal as any).reportMode = '1h';
    await (modal as any).ensureDeviceSeries(rows, '1h');
    expect((modal as any).deviceSeriesCache.granularity).toBe('1h');

    // Now the stale 1d fetch resolves — it must NOT clobber the '1h' cache.
    resolveFirst(jsonResponse({ consumption: [{ timestamp: '2026-07-01T12:00:00Z', value: 1 }] }));
    const staleRaw = await firstFetch;
    expect(staleRaw.get('a')).toEqual([{ timestamp: new Date('2026-07-01T12:00:00Z').getTime(), value: 1 }]);
    // The caller (e.g. an already-abandoned render) still gets its data, but
    // the shared cache must still reflect the CURRENT mode ('1h'), not '1d'.
    expect((modal as any).deviceSeriesCache.granularity).toBe('1h');
  });
});
