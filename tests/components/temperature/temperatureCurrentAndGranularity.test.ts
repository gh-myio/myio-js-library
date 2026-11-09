// TemperatureModal — "Temperatura Atual" (leitura mais recente fora do período), granularidade
// 15/30 min (agregado do Ingestion) e eixo X com uma marca por dia.
import { describe, it, expect, vi } from 'vitest';
import {
  resolveCurrentTemperature,
  fetchIngestionLatestTemperature,
  createIngestionTemperatureAggregateFetcher,
  makeTemperatureValidator,
} from '../../../src/components/temperature/currentTemperature';
import { aggregateByMinutes, buildDayTicks } from '../../../src/components/temperature/utils';
import { buildXAxisTicks, type ChartPoint } from '../../../src/components/temperature/TemperatureModal';

// O DateRangePicker (jQuery/CDN) não inicializa no jsdom — stub resolvido p/ a modal ligar os listeners
vi.mock('../../../src/components/createDateRangePicker', () => ({
  createDateRangePicker: vi.fn().mockResolvedValue({ destroy: () => {} }),
}));

const MIN = 60_000;
const H = 60 * MIN;
const DAY = 24 * H;
const NOW = Date.parse('2026-11-09T11:30:00-03:00');
const SP = 'America/Sao_Paulo';

describe('resolveCurrentTemperature', () => {
  it('ThingsBoard com até 120 min → usa o ThingsBoard (não consulta o Ingestion)', async () => {
    const ing = vi.fn();
    const r = await resolveCurrentTemperature({
      now: NOW,
      maxAgeMinutes: 120,
      fetchThingsboardLatest: async () => ({ ts: NOW - 9 * MIN, value: 22 }),
      fetchIngestionLatest: ing,
    });
    expect(r).toMatchObject({ source: 'thingsboard', value: 22, fresh: true });
    expect(ing).not.toHaveBeenCalled();
  });

  it('ThingsBoard mais velho que 120 min → última do Ingestion', async () => {
    const r = await resolveCurrentTemperature({
      now: NOW,
      maxAgeMinutes: 120,
      fetchThingsboardLatest: async () => ({ ts: NOW - 3 * H, value: 30 }),
      fetchIngestionLatest: async () => ({ ts: NOW - 45 * MIN, value: 23.5 }),
    });
    expect(r).toMatchObject({ source: 'ingestion', value: 23.5, fresh: true });
  });

  it('sem Ingestion → última do ThingsBoard mesmo antiga (marcada como não recente)', async () => {
    const r = await resolveCurrentTemperature({
      now: NOW,
      maxAgeMinutes: 120,
      fetchThingsboardLatest: async () => ({ ts: NOW - 5 * DAY, value: 24 }),
      fetchIngestionLatest: async () => null,
    });
    expect(r).toMatchObject({ source: 'thingsboard', value: 24, fresh: false });
  });

  it('limite configurável e falhas de fetch não derrubam', async () => {
    const r = await resolveCurrentTemperature({
      now: NOW,
      maxAgeMinutes: 30,
      fetchThingsboardLatest: async () => ({ ts: NOW - 60 * MIN, value: 21 }),
      fetchIngestionLatest: async () => {
        throw new Error('429');
      },
    });
    expect(r).toMatchObject({ source: 'thingsboard', fresh: false });
    expect(
      await resolveCurrentTemperature({ now: NOW, fetchThingsboardLatest: async () => { throw new Error('x'); } })
    ).toBeNull();
  });

  it('leitura fora da faixa válida é ignorada', async () => {
    const isValid = makeTemperatureValidator({ min: 15, max: 40 }, 0);
    const r = await resolveCurrentTemperature({
      now: NOW,
      isValid,
      fetchThingsboardLatest: async () => ({ ts: NOW - MIN, value: 85 }),
      fetchIngestionLatest: async () => ({ ts: NOW - 40 * MIN, value: 22 }),
    });
    expect(r).toMatchObject({ source: 'ingestion', value: 22 });
  });
});

describe('fetchIngestionLatestTemperature — busca para trás, independente do filtro', () => {
  it('1 dia vazio → 7 dias; ts = fim da janela (limitado a now)', async () => {
    const calls: [number, number, number][] = [];
    const fetcher = async (s: number, e: number, m: number) => {
      calls.push([s, e, m]);
      if (m === 15) return [];
      return [
        { ts: NOW - 3 * DAY, value: 25 },
        { ts: NOW - 2 * DAY, value: 24 },
      ];
    };
    const r = await fetchIngestionLatestTemperature(fetcher, NOW);
    expect(calls.map((c) => [Math.round((c[1] - c[0]) / DAY), c[2]])).toEqual([
      [1, 15],
      [7, 60],
    ]);
    expect(r).toEqual({ ts: NOW - 2 * DAY + H, value: 24 });
  });

  it('nada em 90 dias → null', async () => {
    expect(await fetchIngestionLatestTemperature(async () => [], NOW)).toBeNull();
  });
});

describe('createIngestionTemperatureAggregateFetcher', () => {
  it('monta a URL do /temperature-readings/aggregate e converte buckets', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { bucket: '2026-11-09T11:00:00-03:00', avg_temperature: 22 },
        { bucket: '2026-11-09T10:45:00-03:00', avg_temperature: '22.5' },
      ],
    });
    const f = createIngestionTemperatureAggregateFetcher({
      apiHost: 'https://api.data.apps.myio-bas.com/api/v1/',
      gatewayId: 'gw-1',
      slaveId: 140,
      getToken: async () => 'tok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const pts = await f(NOW - H, NOW, 15);
    const [url, init] = fetchImpl.mock.calls[0];
    const u = new URL(url);
    expect(u.pathname).toBe('/api/v1/temperature-readings/aggregate');
    expect(u.searchParams.get('gatewayId')).toBe('gw-1');
    expect(u.searchParams.get('slaveId')).toBe('140');
    expect(u.searchParams.get('interval')).toBe('15 minutes');
    expect(u.searchParams.get('timezone')).toBe('America/Sao_Paulo');
    expect(init).toEqual({ headers: { Authorization: 'Bearer tok' } });
    expect(pts).toEqual([
      { ts: Date.parse('2026-11-09T10:45:00-03:00'), value: 22.5 },
      { ts: Date.parse('2026-11-09T11:00:00-03:00'), value: 22 },
    ]);

    await f(NOW - H, NOW, 60);
    expect(new URL(fetchImpl.mock.calls[1][0]).searchParams.get('interval')).toBe('1 hour');
    await f(NOW - H, NOW, 30);
    expect(new URL(fetchImpl.mock.calls[2][0]).searchParams.get('interval')).toBe('30 minutes');
  });

  it('erro HTTP vira exceção; sem token chama sem header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const f = createIngestionTemperatureAggregateFetcher({
      apiHost: 'https://h/api/v1',
      gatewayId: 'g',
      slaveId: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(f(0, 1, 15)).rejects.toThrow('500');
    expect(fetchImpl.mock.calls[0][1]).toBeUndefined();
  });
});

describe('aggregateByMinutes', () => {
  it('janelas de 15 e 30 min fechadas (sem preencher vazias)', () => {
    const t = Date.parse('2026-11-09T10:00:00-03:00');
    const data = [
      { ts: t + 2 * MIN, value: 20 },
      { ts: t + 10 * MIN, value: 22 },
      { ts: t + 20 * MIN, value: 24 },
      { ts: t + 50 * MIN, value: 30 },
    ];
    expect(aggregateByMinutes(data, 15)).toEqual([
      { ts: t, value: 21 },
      { ts: t + 15 * MIN, value: 24 },
      { ts: t + 45 * MIN, value: 30 },
    ]);
    expect(aggregateByMinutes(data, 30)).toEqual([
      { ts: t, value: 22 },
      { ts: t + 30 * MIN, value: 30 },
    ]);
  });
});

describe('openTemperatureModal — integração', () => {
  it('"Atual" vem da leitura recente do TB (com offset), não do card; 15 min usa o agregado', async () => {
    const { openTemperatureModal } = await import('../../../src/components/temperature/TemperatureModal');
    localStorage.removeItem('myio-temp-modal-granularity');
    const now = Date.now();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ temperature: [{ ts: now - 5 * MIN, value: '22' }] }) })
    );
    // canvas não existe no jsdom
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
    const dataFetcher = vi.fn().mockResolvedValue([{ ts: now - 60 * DAY, value: 25 }]);
    const aggregateFetcher = vi.fn().mockResolvedValue([{ ts: now - 60 * DAY, value: 24 }]);

    const inst = await openTemperatureModal({
      token: 't',
      deviceId: 'dev-1',
      startDate: new Date(now - 90 * DAY).toISOString(), // período antigo (60–90 dias atrás)
      endDate: new Date(now - 60 * DAY).toISOString(),
      currentTemperature: 26.3, // valor velho do card
      temperatureMin: 23,
      temperatureMax: 25.5,
      temperatureOffset: 1,
      dataFetcher,
      aggregateFetcher,
      currentTemperatureMaxAgeMinutes: 120,
    });
    const root = document.querySelector('.myio-temp-modal-content') as HTMLElement;
    expect(root.textContent).toContain('23.0°C'); // 22 + offset 1
    expect(root.textContent).toContain('Dentro da faixa');
    expect(root.textContent).toContain('ThingsBoard · há 5 min');
    expect(aggregateFetcher).not.toHaveBeenCalled(); // TB recente → nem busca Ingestion

    const sel = root.querySelector('select') as HTMLSelectElement;
    expect([...sel.options].map((o) => o.value)).toEqual(['15min', '30min', 'hour', 'day']);
    sel.value = '15min';
    sel.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 20));
    expect(aggregateFetcher).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 15);

    inst.destroy();
    vi.unstubAllGlobals();
    localStorage.removeItem('myio-temp-modal-granularity');
  });

  it('dataFetcher horário sem agregado → 15/30 min desabilitados', async () => {
    const { openTemperatureModal } = await import('../../../src/components/temperature/TemperatureModal');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
    const inst = await openTemperatureModal({
      token: 't',
      deviceId: 'd',
      startDate: new Date(Date.now() - DAY).toISOString(),
      endDate: new Date().toISOString(),
      dataFetcher: vi.fn().mockResolvedValue([]),
    });
    const sel = document.querySelector('.myio-temp-modal-content select') as HTMLSelectElement;
    const disabled = [...sel.options].filter((o) => o.disabled).map((o) => o.value);
    expect(disabled).toEqual(['15min', '30min']);
    inst.destroy();
    vi.unstubAllGlobals();
  });
});

describe('eixo X — uma marca por dia à meia-noite', () => {
  it('buildDayTicks: meias-noites de SP, rareadas para ≤ 8', () => {
    const start = Date.parse('2026-11-01T00:00:00-03:00');
    const nine = buildDayTicks(start, start + 8 * DAY + 11 * H, SP, 8);
    expect(nine.length).toBeLessThanOrEqual(8);
    expect(nine[0]).toBe(start);
    nine.forEach((ts) => expect((ts - start) % DAY).toBe(0));

    const thirty = buildDayTicks(start, start + 29 * DAY, SP, 8);
    expect(thirty.length).toBeLessThanOrEqual(8);
    expect(thirty[1] - thirty[0]).toBe(4 * DAY); // passo inteiro de dias

    const mid = Date.parse('2026-11-01T10:00:00-03:00');
    expect(buildDayTicks(mid, mid + 2 * DAY, SP)[0]).toBe(Date.parse('2026-11-02T00:00:00-03:00'));
  });

  const series = (start: number, n: number, step: number): ChartPoint[] =>
    Array.from({ length: n }, (_, i) => ({ x: start + i * step, y: 22, screenX: 60 + i, screenY: 0 }));

  it('9 dias em hora: rótulos dd/mm à meia-noite (não mais 01/11 00:00, 02/11 01:00…)', () => {
    const start = Date.parse('2026-11-01T00:00:00-03:00');
    const pts = series(start, 203, H);
    const ticks = buildXAxisTicks(pts, 'hour', SP, 'pt-BR', false, 60, 1000);
    expect(ticks[0].label).toBe('01/11');
    expect(ticks.map((t) => t.label)).not.toContain('02/11 01:00');
    ticks.forEach((t) => expect((t.ts - start) % DAY).toBe(0));
  });

  it('até 24 h: HH:mm', () => {
    const start = Date.parse('2026-11-09T00:00:00-03:00');
    const ticks = buildXAxisTicks(series(start, 48, 15 * MIN), '15min', SP, 'pt-BR', false, 60, 1000);
    expect(ticks[0].label).toBe('00:00');
    expect(ticks[1].label).toBe('01:30');
  });

  it('eixo por índice (períodos filtrados): marca no primeiro ponto do dia', () => {
    const start = Date.parse('2026-11-01T06:00:00-03:00');
    const pts = series(start, 72, H).filter((p) => {
      const h = new Date(p.x).getUTCHours() - 3;
      const local = (h + 24) % 24;
      return local >= 6 && local < 12; // só manhã
    });
    const ticks = buildXAxisTicks(pts, 'hour', SP, 'pt-BR', true, 60, 1000);
    expect(ticks.map((t) => t.label)).toEqual(['02/11', '03/11']);
    expect(ticks[0].screenX).toBe(pts.find((p) => p.x >= Date.parse('2026-11-02T00:00:00-03:00'))!.screenX);
  });
});
