/**
 * ED-1390 — Report Device 100% em R$ (RFC-0241 rev. 5).
 *
 * Config real (valuateDomainMoney → buildReportMoneyConfig) com tarifa anual 0,50 R$/kWh e uma
 * faixa horária (10/01 às 18h = 1,20 R$/kWh). Decisões do owner:
 *  - cada hora valorada pelo seu preço; dia = soma das horas (exato mesmo com faixa horária);
 *  - sem tarifa → "-" + chip; dia sem leituras → "-" + "Sem dados", fora da cobertura;
 *  - total só com cobertura completa, senão "-" + "Cobertura incompleta (n de m)";
 *  - trafo/entrada (itemMoney null) ou período fora dos anos com tarifa → físico + aviso;
 *  - gráfico/% pelo custo; período inicial = período do dashboard.
 */
import { describe, expect, it, vi } from 'vitest';
import { DeviceReportModal } from '../../../src/components/premium-modals/report-device/DeviceReportModal';
import { toCsv } from '../../../src/components/premium-modals/internal/engines/CsvExporter';
import {
  buildReportMoneyConfig,
  valuateDomainMoney,
  parseMoneyCategoryRule,
} from '../../../src/components/financial-goals';
import {
  combineBucketMoney,
  deviceMoneyChartItems,
  deviceMoneyTotal,
  deviceRowMoneyView,
  isHourlySeries,
} from '../../../src/components/premium-modals/report-device/deviceReportMoneyView';

const HOUR = 3600 * 1000;
const sp = (d: string, h = 0, m = 0) =>
  Date.parse(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`);
const PERIOD = { startISO: '2026-01-01T00:00:00-03:00', endISO: '2026-01-31T23:59:59-03:00' };
const api = { clientId: 'c', clientSecret: 's', dataApiBaseUrl: 'https://api.example.com', ingestionToken: 't' };

async function moneyConfig() {
  const result = await valuateDomainMoney({
    domain: 'energy',
    startTs: Date.parse(PERIOD.startISO),
    endTs: Date.parse(PERIOD.endISO),
    devices: [
      { key: 'loja', group: 'lojas' },
      { key: 'sem-tarifa', group: 'lojas', category: 'GENERIC' },
      { key: 'trafo', group: 'transformadores' },
    ],
    rule: parseMoneyCategoryRule({ SPECIFIC: ['lojas'] }),
    loadTree: async ({ category, year, domain }) =>
      category === 'SPECIFIC'
        ? ({
            customerId: 'g',
            domain,
            category,
            year,
            version: 1,
            tree: { annual: { price: '0.5' }, daily: { '01-10': { hourly: { '18': { price: '1.2' } } } } },
          } as any)
        : null,
    periodTotals: { loja: 100, 'sem-tarifa': 100 },
  });
  return buildReportMoneyConfig(result, { period: PERIOD });
}

/** Fetcher mock: 1 kWh por hora (quatro blocos de 15 min), exceto os dias em `skipDays`. */
function hourlyFetcher(skipDays: string[] = []) {
  const calls: any[] = [];
  const fetcher = vi.fn(async (args: any) => {
    calls.push(args);
    const s = Date.parse(args.startISO);
    const e = Date.parse(args.endISO);
    const consumption: Array<{ timestamp: string; value: number }> = [];
    for (let t = Math.ceil(s / (15 * 60000)) * 15 * 60000; t <= e; t += 15 * 60000) {
      const day = new Date(t - 3 * HOUR).toISOString().slice(0, 10);
      if (skipDays.includes(day)) continue;
      consumption.push({ timestamp: new Date(t).toISOString(), value: 0.25 });
    }
    return { data: [{ id: args.ingestionId, consumption }] };
  });
  return { fetcher, calls };
}

/** Fetcher mock que IGNORA `granularity`: 1 ponto por dia SP (24 kWh às 00:00). */
function dailyFetcher() {
  const calls: any[] = [];
  const fetcher = vi.fn(async (args: any) => {
    calls.push(args);
    const s = Date.parse(args.startISO);
    const e = Date.parse(args.endISO);
    const consumption: Array<{ timestamp: string; value: number }> = [];
    for (let t = Math.ceil((s - 21 * HOUR) / (24 * HOUR)) * 24 * HOUR + 3 * HOUR; t <= e; t += 24 * HOUR) {
      consumption.push({ timestamp: new Date(t).toISOString(), value: 24 });
    }
    return { data: [{ id: args.ingestionId, consumption }] };
  });
  return { fetcher, calls };
}

async function loaded(opts: {
  id?: string;
  gran?: '1d' | '1h';
  start: string;
  end: string;
  skipDays?: string[];
  money?: any;
  mock?: { fetcher: any; calls: any[] };
}) {
  document.body.innerHTML =
    '<button id="load-btn"></button><span id="load-spinner"></span><div id="money-notice"></div><div id="table-container"></div>';
  const { fetcher, calls } = opts.mock || hourlyFetcher(opts.skipDays);
  const money = opts.money === undefined ? await moneyConfig() : opts.money;
  const m = new DeviceReportModal({
    ingestionId: opts.id || 'loja',
    identifier: 'LOJA-1',
    label: 'Loja 1',
    domain: 'energy',
    granularity: opts.gran || '1d',
    api,
    fetcher,
    ...(money ? { money } : {}),
  } as any) as any;
  m.dateRangePicker = { getDates: () => ({ startISO: opts.start, endISO: opts.end }) };
  const files: string[] = [];
  m.downloadCSV = vi.fn((c: string) => files.push(c));
  await m.loadData();
  return { m, calls, files };
}

describe('buildReportMoneyConfig — tariffYears (ED-1390)', () => {
  it('lists the years whose tariff trees were loaded (dashboard period)', async () => {
    expect((await moneyConfig()).tariffYears).toEqual([2026]);
  });
});

describe('Report Device em R$ — granularidade Dia', () => {
  it('each day = sum of its hours at their own price (hourly band exact), total complete', async () => {
    const { m, calls } = await loaded({ start: '2026-01-09T00:00:00-03:00', end: '2026-01-11T23:59:59-03:00' });
    expect(m.moneyActive).toBe(true);
    expect(calls.every((c) => c.granularity === '1h')).toBe(true);
    expect(m.data.map((r: any) => [r.date, deviceRowMoneyView(r).text])).toEqual([
      ['2026-01-09', '12,00'], // 24 h × 1 kWh × 0,50
      ['2026-01-10', '12,70'], // 23 × 0,50 + 1 × 1,20 (faixa das 18h) — um bloco de 24 h sairia "-"
      ['2026-01-11', '12,00'],
    ]);
    expect(m.data[1].consumption).toBeCloseTo(24);
    expect(deviceMoneyTotal(m.data)).toMatchObject({ amount: '36.70', text: 'R$ 36,70', note: '' });
  });

  it('KPIs in R$', async () => {
    const { m } = await loaded({ start: '2026-01-09T00:00:00-03:00', end: '2026-01-11T23:59:59-03:00' });
    expect(m.computeKpis()).toEqual([
      { value: 'R$ 36,70', label: 'Custo estimado total' },
      { value: 'R$ 12,23', label: 'Média por Dia' },
      { value: 'R$ 12,70', label: 'Dia com Maior Custo', sub: '10/01/2026' },
      { value: 'R$ 12,00', label: 'Dia com Menor Custo', sub: '09/01/2026' },
      { value: '0', label: 'Dias sem Consumo' },
    ]);
  });

  it('day without readings → "-" + "Sem dados", outside the coverage (total still complete)', async () => {
    const { m } = await loaded({
      start: '2026-01-09T00:00:00-03:00',
      end: '2026-01-11T23:59:59-03:00',
      skipDays: ['2026-01-11'],
    });
    const v = deviceRowMoneyView(m.data[2]);
    expect(v).toMatchObject({ text: '-', chip: 'Sem dados', amount: null });
    expect(deviceMoneyTotal(m.data)).toMatchObject({ amount: '24.70', withData: 2, note: '' });
  });

  it('table: "Custo estimado (R$)" header, R$ cells (kWh in the title), "-" + chip', async () => {
    const { m } = await loaded({
      start: '2026-01-09T00:00:00-03:00',
      end: '2026-01-11T23:59:59-03:00',
      skipDays: ['2026-01-11'],
    });
    m.renderTable();
    const box = document.getElementById('table-container')!;
    expect(box.querySelector('th[data-sort="consumption"]')!.textContent).toContain('Custo estimado (R$)');
    expect(box.textContent).not.toContain('Consumo (kWh)');
    const cells = Array.from(box.querySelectorAll('[data-money-cell]'));
    expect(cells.map((c) => c.textContent)).toEqual(['12,00', '12,70', '-']);
    expect(cells[1].getAttribute('title')).toBe('24,00 kWh');
    expect(box.querySelector('.myio-money-chip')!.textContent).toBe('Sem dados');
  });

  it('sorting by the value column sorts by cost, rows without R$ last', async () => {
    const { m } = await loaded({
      start: '2026-01-09T00:00:00-03:00',
      end: '2026-01-11T23:59:59-03:00',
      skipDays: ['2026-01-09'],
    });
    m.sortData('consumption'); // asc
    expect(m.data.map((r: any) => r.date)).toEqual(['2026-01-11', '2026-01-10', '2026-01-09']);
    m.sortData('consumption'); // desc
    expect(m.data.map((r: any) => r.date)).toEqual(['2026-01-10', '2026-01-11', '2026-01-09']);
  });

  it('CSV: KPIs + "Data | Custo estimado (R$) | Observação", "-" + reason, never 0 or kWh', async () => {
    const { m, files } = await loaded({
      start: '2026-01-09T00:00:00-03:00',
      end: '2026-01-11T23:59:59-03:00',
      skipDays: ['2026-01-11'],
    });
    m.exportPeriod = { startISO: '2026-01-09T00:00:00-03:00', endISO: '2026-01-11T23:59:59-03:00' };
    m.exportCSV();
    const tail = toCsv([
      ['Data', 'Custo estimado (R$)', 'Observação'],
      ['09/01/2026', '12,00', ''],
      ['10/01/2026', '12,70', ''],
      ['11/01/2026', '-', 'Sem dados'],
    ]);
    expect(files[0].endsWith(tail)).toBe(true);
    expect(files[0]).toContain('"Custo estimado total";"R$ 24,70"');
    expect(files[0]).not.toMatch(/kWh|NaN|Fatura/);
  });

  it('PDF/XLS: value = cost (2dp, "-"), "% do custo" with complete coverage, unit R$', async () => {
    const { m } = await loaded({ start: '2026-01-09T00:00:00-03:00', end: '2026-01-11T23:59:59-03:00' });
    expect(m.exportColumnOptions()).toEqual({
      nameLabel: 'Data',
      hideIdentifier: true,
      valueLabel: 'Custo estimado (R$)',
      countLabel: 'dia(s)',
      valueDecimals: 2,
      emptyValueText: '-',
      percLabel: '% do custo',
    });
    expect(m.exportUnit()).toBe('R$');
    const devs = m.buildExportDevices();
    expect(devs.map((d: any) => d.val)).toEqual([12, 12.7, 12]);
    expect(devs.map((d: any) => Math.round(d.perc * 10) / 10)).toEqual([32.7, 34.6, 32.7]);
  });

  it('chart in R$: one bar per day with complete R$; days without R$ excluded with a note', () => {
    const rows = [
      { date: '2026-01-09', consumption: 24, money: { state: 'complete', amount: '12', covered: 24, total: 24 } },
      { date: '2026-01-10', consumption: 24, money: { state: 'missing', reason: 'no-tariff', covered: 0, total: 24 } },
      { date: '2026-01-11', consumption: 0, money: null },
    ];
    expect(deviceMoneyChartItems(rows)).toEqual({
      items: [{ id: '2026-01-09', label: '09/01', value: 12 }],
      excluded: 1,
      note: '1 dia(s) sem R$ fora do gráfico',
    });
  });
});

describe('Report Device em R$ — granularidade Hora', () => {
  it('one row per hour at its own price; KPIs per hour', async () => {
    const { m } = await loaded({ gran: '1h', start: '2026-01-10T17:00:00-03:00', end: '2026-01-10T19:59:59-03:00' });
    expect(m.data.map((r: any) => deviceRowMoneyView(r).text)).toEqual(['0,50', '1,20', '0,50']);
    const kpis = m.computeKpis();
    expect(kpis[0]).toEqual({ value: 'R$ 2,20', label: 'Custo estimado total' });
    expect(kpis[2]).toEqual({ value: 'R$ 0,73', label: 'Média por Hora' });
    expect(kpis[3].label).toBe('Hora com Maior Custo');
    expect(m.exportColumnOptions().countLabel).toBe('hora(s)');
  });
});

describe('Report Device em R$ — sem tarifa', () => {
  it('every value "-" + "Sem tarifa"; total "-" + Cobertura incompleta; no %', async () => {
    const { m } = await loaded({ id: 'sem-tarifa', start: '2026-01-09T00:00:00-03:00', end: '2026-01-11T23:59:59-03:00' });
    expect(m.moneyActive).toBe(true);
    expect(m.data.map((r: any) => deviceRowMoneyView(r).text)).toEqual(['-', '-', '-']);
    expect(deviceRowMoneyView(m.data[0]).chip).toBe('Sem tarifa');
    const kpis = m.computeKpis();
    expect(kpis[0]).toEqual({ value: '-', label: 'Custo estimado total', sub: 'Cobertura incompleta (0 de 3)' });
    expect(kpis.find((k: any) => k.label === 'Dias sem custo')).toEqual({ value: '3', label: 'Dias sem custo', sub: '3 Sem tarifa' });
    expect(kpis.some((k: any) => /sem tarifa/.test(k.label))).toBe(false);
    expect(m.exportColumnOptions()).toMatchObject({ hidePerc: true, emptyValueText: '-' });
    expect(m.buildExportDevices().map((d: any) => [d.val, d.nameNote, d.perc])).toEqual([
      [null, 'Sem tarifa', undefined],
      [null, 'Sem tarifa', undefined],
      [null, 'Sem tarifa', undefined],
    ]);
  });
});

describe('Report Device em R$ — quando fica físico (+ aviso)', () => {
  it('trafo (outside the valuation) → physical report + notice', async () => {
    const { m, calls } = await loaded({ id: 'trafo', start: '2026-01-09T00:00:00-03:00', end: '2026-01-11T23:59:59-03:00' });
    expect(m.moneyActive).toBe(false);
    expect(calls[0].granularity).toBe('1d');
    expect(document.getElementById('money-notice')!.textContent).toBe(
      'Dispositivo não valorado em R$ (ex.: Entrada/Transformadores). Exibindo kWh.'
    );
    expect(m.computeKpis()[0].label).toBe('Total (kWh)');
    expect(m.exportUnit()).toBe('kWh');
  });

  it('period outside the tariff years → physical + notice', async () => {
    const { m } = await loaded({ start: '2025-12-30T00:00:00-03:00', end: '2026-01-02T23:59:59-03:00' });
    expect(m.moneyActive).toBe(false);
    expect(document.getElementById('money-notice')!.textContent).toBe(
      'Valores em R$ disponíveis só para períodos em 2026. Exibindo kWh.'
    );
  });

  it('another period inside the tariff year stays in R$ (rows priced from their own buckets)', async () => {
    const { m } = await loaded({ start: '2026-03-02T00:00:00-03:00', end: '2026-03-02T23:59:59-03:00' });
    expect(m.moneyActive).toBe(true);
    expect(deviceRowMoneyView(m.data[0]).text).toBe('12,00');
    expect(document.getElementById('money-notice')!.style.display).toBe('none');
  });

  it('custom fetcher that ignores 1h (daily points) → physical + notice, never a "complete" R$', async () => {
    const mock = dailyFetcher();
    const { m, calls } = await loaded({ mock, start: '2026-01-09T00:00:00-03:00', end: '2026-01-11T23:59:59-03:00' });
    expect(calls[0].granularity).toBe('1h'); // tentou a série horária…
    expect(m.moneyActive).toBe(false); // …não veio horária → físico
    expect(calls[calls.length - 1].granularity).toBe('1d'); // recarregou na granularidade física
    expect(document.getElementById('money-notice')!.textContent).toBe(
      'Série horária indisponível para o cálculo em R$. Exibindo kWh.'
    );
    expect(document.getElementById('money-notice')!.style.display).toBe('block');
    expect(m.data.every((r: any) => r.money === undefined)).toBe(true);
    expect(m.computeKpis()[0].label).toBe('Total (kWh)');
    expect(m.exportUnit()).toBe('kWh');
  });

  it('custom fetcher that honors 1h (hourly points, with a day missing) → R$ normally', async () => {
    const { m } = await loaded({
      start: '2026-01-09T00:00:00-03:00',
      end: '2026-01-11T23:59:59-03:00',
      skipDays: ['2026-01-10'], // buraco de 24 h é falta de leitura, não série diária
    });
    expect(m.moneyActive).toBe(true);
    expect(m.moneyNotice).toBeNull();
    expect(m.data.map((r: any) => deviceRowMoneyView(r).text)).toEqual(['12,00', '-', '12,00']);
  });

  it('no money param → physical, no notice', async () => {
    const { m, calls } = await loaded({ money: null, start: '2026-01-09T00:00:00-03:00', end: '2026-01-11T23:59:59-03:00' });
    expect(m.moneyActive).toBe(false);
    expect(m.moneyNotice).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].granularity).toBe('1d');
  });
});

describe('Report Device em R$ — busca e período', () => {
  it('hourly series fetched in contiguous chunks of up to 10 days with granularity 1h', async () => {
    const { calls } = await loaded({ start: '2026-01-01T00:00:00-03:00', end: '2026-01-25T23:59:59-03:00' });
    expect(calls.map((c) => [c.startISO, c.endISO, c.granularity])).toEqual([
      ['2026-01-01T00:00:00-03:00', '2026-01-10T23:59:59-03:00', '1h'],
      ['2026-01-11T00:00:00-03:00', '2026-01-20T23:59:59-03:00', '1h'],
      ['2026-01-21T00:00:00-03:00', '2026-01-25T23:59:59-03:00', '1h'],
    ]);
  });

  it('start off the full hour (14:30) + 12 days: inner chunk boundary on the full hour, boundary hour summed once', async () => {
    const calls: any[] = [];
    // A API arredonda para a hora cheia: cada bloco devolve TODAS as horas que toca —
    // a hora da fronteira (11/01 14:00) viria nos dois blocos com fronteiras desalinhadas
    const fetcher = vi.fn(async (args: any) => {
      calls.push(args);
      const s = Math.floor(Date.parse(args.startISO) / HOUR) * HOUR;
      const e = Date.parse(args.endISO);
      const consumption: Array<{ timestamp: string; value: number }> = [];
      for (let t = s; t <= e; t += HOUR) consumption.push({ timestamp: new Date(t).toISOString(), value: 1 });
      const boundary = sp('2026-01-11', 14);
      if (!consumption.some((p) => Date.parse(p.timestamp) === boundary)) {
        consumption.push({ timestamp: new Date(boundary).toISOString(), value: 1 }); // repetida
      }
      return { data: [{ id: args.ingestionId, consumption }] };
    });
    const { m } = await loaded({
      gran: '1h',
      mock: { fetcher, calls },
      start: '2026-01-01T14:30:00-03:00',
      end: '2026-01-13T14:29:59-03:00',
    });
    expect(calls.map((c) => [c.startISO, c.endISO])).toEqual([
      ['2026-01-01T14:30:00-03:00', '2026-01-11T13:59:59-03:00'],
      ['2026-01-11T14:00:00-03:00', '2026-01-13T14:29:59-03:00'],
    ]);
    expect(calls).toHaveLength(2);
    expect(m.moneyActive).toBe(true);
    const boundaryRow = m.data.find((r: any) => Date.parse(r.date) === sp('2026-01-11', 14));
    expect(boundaryRow.consumption).toBe(1); // uma vez, não 2
    expect(m.data.every((r: any) => r.consumption === 1)).toBe(true);
  });

  it('picker preset = dashboard period (São Paulo dates)', async () => {
    const m = new DeviceReportModal({ ingestionId: 'loja', domain: 'energy', api, money: await moneyConfig() } as any) as any;
    expect(m.moneyPresetDates()).toEqual({ start: '2026-01-01', end: '2026-01-31' });
    const physical = new DeviceReportModal({ ingestionId: 'loja', domain: 'energy', api } as any) as any;
    expect(physical.moneyPresetDates()).toBeNull();
    const temp = new DeviceReportModal({ ingestionId: 'loja', domain: 'temperature', api, money: await moneyConfig() } as any) as any;
    expect(temp.moneyPresetDates()).toBeNull();
  });
});

describe('isHourlySeries', () => {
  const s = sp('2026-01-09');
  const e = sp('2026-01-11', 23, 59);
  const at = (...ts: number[]) => ts.map((t) => ({ timestamp: new Date(t).toISOString() }));
  it('min gap ≤ 1 h → hourly (gaps larger than that are missing readings)', () => {
    expect(isHourlySeries(at(s, s + HOUR / 4, s + 30 * HOUR), s, e)).toBe(true);
    expect(isHourlySeries(at(s, s + HOUR), s, e)).toBe(true);
  });
  it('daily points / single point over a multi-hour period → not hourly; no points → ok', () => {
    expect(isHourlySeries(at(s, s + 24 * HOUR, s + 48 * HOUR), s, e)).toBe(false);
    expect(isHourlySeries(at(s), s, e)).toBe(false);
    expect(isHourlySeries(at(s), s, s + HOUR - 1000)).toBe(true);
    expect(isHourlySeries([], s, e)).toBe(true);
  });
});

describe('combineBucketMoney', () => {
  it('complete only when every hour is complete; otherwise the first incomplete state/reason', () => {
    const ok = combineBucketMoney([{ state: 'complete', amount: '0.5' }, { state: 'complete', amount: '1.2' }]);
    expect(ok).toMatchObject({ state: 'complete', covered: 2, total: 2 });
    expect(Number(ok.amount)).toBeCloseTo(1.7, 10); // soma crua (DEC-8: arredonda só na exibição)
    expect(combineBucketMoney([{ state: 'complete', amount: '0.5' }, { state: 'partial', reason: 'no-data' }])).toEqual({
      state: 'partial',
      reason: 'no-data',
      covered: 1,
      total: 2,
    });
  });
});

describe('Report Device em R$ — DOM', () => {
  it('money notice slot only exists when params.money is present (physical DOM unchanged)', async () => {
    document.body.innerHTML = '';
    const h1 = new DeviceReportModal({ ingestionId: 'loja', domain: 'energy', api } as any).show();
    expect(document.getElementById('table-container')).not.toBeNull();
    expect(document.getElementById('money-notice')).toBeNull();
    h1.close();
    document.body.innerHTML = '';
    const h2 = new DeviceReportModal({ ingestionId: 'loja', domain: 'energy', api, money: await moneyConfig() } as any).show();
    expect(document.getElementById('money-notice')).not.toBeNull();
    h2.close();
    document.body.innerHTML = '';
  });

  it('chart: "Custo por Dia" in R$, recreated as "Participação por Dia" when the next load is physical', async () => {
    const { m } = await loaded({ start: '2026-01-09T00:00:00-03:00', end: '2026-01-11T23:59:59-03:00' });
    const box = document.createElement('div');
    box.id = 'participation-chart-container';
    document.body.appendChild(box);
    m.updateDayChart();
    expect(box.textContent).toContain('Custo por Dia');
    expect(box.textContent).toContain('R$ 12,70');
    m.moneyActive = false;
    m.updateDayChart();
    expect(box.textContent).toContain('Participação por Dia');
    expect(box.textContent).not.toContain('Custo por Dia');
    m.participationChart?.destroy();
    box.remove();
  });
});
