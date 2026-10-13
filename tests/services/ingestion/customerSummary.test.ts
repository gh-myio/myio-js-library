// tests/services/ingestion/customerSummary.test.ts
// Ingestion GET /telemetry/customers/{id}/summary — paginação, adaptação para o formato do
// /devices/totals e temperatura atual a partir da série horária.
import { describe, it, expect, vi } from 'vitest';
import {
  fetchCustomerSummary,
  summaryDeviceToTotalsRow,
  summaryLookbackFromIso,
  latestHourlyTemperature,
  CustomerSummaryError,
  type SummaryDevice,
} from '../../../src/services/ingestion/customerSummary';

const period = {
  start: '2026-10-01T00:00:00-03:00',
  end: '2026-10-09T14:37:52-03:00',
  asOf: '2026-10-09T14:37:52-03:00',
  timezone: 'America/Sao_Paulo',
  granularity: '1d',
  readingType: 'energy',
  unit: 'kWh',
  metric: 'sum',
  lastReadingLookbackDays: 30,
};

const dev = (id: string, extra: Partial<SummaryDevice> = {}): SummaryDevice => ({ id, name: `D ${id}`, total: 1, ...extra });

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('fetchCustomerSummary', () => {
  it('percorre as páginas: página 1 com resumo; demais sem resumo e com o período da página 1', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          customer: { id: 'c1' },
          period,
          summary: { devices: 3, devicesWithoutData: 0, total: 3 },
          devices: [dev('a'), dev('b')],
          pagination: { page: 1, limit: 2, total: 3 },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ period, devices: [dev('c')], pagination: { page: 2, limit: 2, total: 3 } }));

    const r = await fetchCustomerSummary({
      dataApiHost: 'https://api.example/api/v1/',
      token: 'tk',
      customerId: 'c1',
      readingType: 'energy',
      startTime: '2026-10-01T00:00:00-03:00',
      endTime: '2026-10-09T23:59:59-03:00',
      limit: 2,
      fetchImpl,
    });

    expect(r.devices.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(r.summary?.devices).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const u1 = new URL(fetchImpl.mock.calls[0][0]);
    expect(u1.pathname).toBe('/api/v1/telemetry/customers/c1/summary');
    expect(Object.fromEntries(u1.searchParams)).toMatchObject({
      readingType: 'energy',
      granularity: '1d',
      deep: '1',
      includeSeries: '0',
      limit: '2',
      page: '1',
      startTime: '2026-10-01T00:00:00-03:00',
      endTime: '2026-10-09T23:59:59-03:00',
    });
    expect(u1.searchParams.has('includeSummary')).toBe(false);
    expect(fetchImpl.mock.calls[0][1]).toEqual({ headers: { Authorization: 'Bearer tk' } });

    const u2 = new URL(fetchImpl.mock.calls[1][0]);
    expect(u2.searchParams.get('page')).toBe('2');
    expect(u2.searchParams.get('includeSummary')).toBe('0');
    expect(u2.searchParams.get('startTime')).toBe(period.start);
    expect(u2.searchParams.get('endTime')).toBe(period.end);
  });

  it('para quando uma página vem vazia', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ period, summary: null, devices: [dev('a')], pagination: { total: 5 } }))
      .mockResolvedValueOnce(jsonResponse({ period, devices: [], pagination: { total: 5 } }));
    const r = await fetchCustomerSummary({ dataApiHost: 'h', token: 't', customerId: 'c', readingType: 'water', fetchImpl });
    expect(r.devices).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('sem datas: não envia startTime/endTime (mês atual até agora)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ period, devices: [], pagination: { total: 0 } }));
    await fetchCustomerSummary({ dataApiHost: 'https://h/api/v1', token: 't', customerId: 'c', readingType: 'energy', fetchImpl });
    const u = new URL(fetchImpl.mock.calls[0][0]);
    expect(u.searchParams.has('startTime')).toBe(false);
    expect(u.searchParams.has('endTime')).toBe(false);
  });

  it('temperatura: granularidade 1h com série', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ period, devices: [], pagination: { total: 0 } }));
    await fetchCustomerSummary({
      dataApiHost: 'https://h/api/v1',
      token: 't',
      customerId: 'c',
      readingType: 'temperature',
      granularity: '1h',
      includeSeries: true,
      fetchImpl,
    });
    const u = new URL(fetchImpl.mock.calls[0][0]);
    expect(u.searchParams.get('granularity')).toBe('1h');
    expect(u.searchParams.get('includeSeries')).toBe('1');
  });

  it('erro HTTP vira CustomerSummaryError com status e code', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ code: 'VALIDATION_ERROR', message: 'period too long' }, 400)
    );
    const p = fetchCustomerSummary({ dataApiHost: 'h', token: 't', customerId: 'c', readingType: 'energy', fetchImpl });
    await expect(p).rejects.toBeInstanceOf(CustomerSummaryError);
    await expect(p).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'HTTP 400: period too long' });
  });
});

describe('summaryDeviceToTotalsRow', () => {
  it('mapeia total → total_value e a última leitura → lastTelemetryTs', () => {
    const row = summaryDeviceToTotalsRow(
      dev('a', {
        total: 122.58,
        slaveId: 1,
        gatewayId: 'g',
        assetName: '102',
        lastReadings: [{ channel: null, ts: '2026-10-09T14:00:00-03:00', value: 2516, unit: 'W' }],
      })
    );
    expect(row).toMatchObject({
      id: 'a',
      total_value: 122.58,
      hasData: true,
      slaveId: 1,
      gatewayId: 'g',
      assetName: '102',
      lastTelemetryTs: '2026-10-09T17:00:00.000Z',
    });
  });

  it('água: usa o canal mais recente', () => {
    const row = summaryDeviceToTotalsRow(
      dev('w', {
        lastReadings: [
          { channel: 2, ts: '2026-10-09T10:00:00-03:00', value: 1, unit: 'm³' },
          { channel: 1, ts: '2026-10-09T13:55:00-03:00', value: 0.21, unit: 'm³' },
        ],
      })
    );
    expect(row.lastTelemetryTs).toBe('2026-10-09T16:55:00.000Z');
  });

  it('total null → total_value 0 com hasData false; sem leitura → início da janela de busca', () => {
    const from = summaryLookbackFromIso(period as never);
    expect(from).toBe('2026-09-09T17:37:52.000Z');
    const row = summaryDeviceToTotalsRow(dev('x', { total: null, lastReadings: [] }), from);
    expect(row.total_value).toBe(0);
    expect(row.hasData).toBe(false);
    expect(row.lastTelemetryTs).toBe(from);
  });
});

describe('latestHourlyTemperature', () => {
  const series = [
    { ts: '2026-10-09T11:00:00-03:00', value: 25 },
    { ts: '2026-10-09T12:00:00-03:00', value: 26 },
    { ts: '2026-10-09T13:00:00-03:00', value: 27.5, partial: true },
  ];

  it('hora mais recente; lastTs = última leitura medida quando válida', () => {
    const r = latestHourlyTemperature(
      dev('t', { series, lastReadings: [{ channel: null, ts: '2026-10-09T13:40:00-03:00', value: 27.8, unit: '°C' }] }),
      { offset: -2 }
    );
    expect(r).toEqual({
      value: 27.5,
      hourTs: Date.parse('2026-10-09T13:00:00-03:00'),
      lastTs: Date.parse('2026-10-09T13:40:00-03:00'),
    });
  });

  it('descarta horas fora da faixa válida (com offset)', () => {
    const r = latestHourlyTemperature(
      dev('t', { series: [...series, { ts: '2026-10-09T14:00:00-03:00', value: 45 }] }),
      { offset: -2, validRange: { min: 15, max: 40 } }
    );
    expect(r?.value).toBe(27.5);
  });

  it('última leitura inválida → lastTs = último bloco de 15 min da hora válida', () => {
    const r = latestHourlyTemperature(
      dev('t', { series, lastReadings: [{ channel: null, ts: '2026-10-09T13:50:00-03:00', value: -6.4, unit: '°C' }] })
    );
    expect(r?.lastTs).toBe(Date.parse('2026-10-09T13:45:00-03:00'));
  });

  it('sem série válida → null', () => {
    expect(latestHourlyTemperature(dev('t', { series: [] }))).toBeNull();
    expect(latestHourlyTemperature(dev('t', { series: [{ ts: '2026-10-09T13:00:00-03:00', value: 120 }] }))).toBeNull();
  });
});
