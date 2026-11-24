/**
 * RFC-0241 Part B (rev. 2) — AllReportModal R$ in exports and in the Diário/Horário rows.
 *
 *  1. ED-1391: in money mode the report is entirely in R$ — CSV (daily + hourly), PDF/XLS
 *     value column = "Custo estimado (R$)" (no kWh column); non-complete rows → "-" + reason,
 *     total only when every row is complete, otherwise "-" + "Cobertura incompleta (n de m)".
 *  2. Physical mode (no params.money): exports byte-identical to the pre-change format.
 *  3. Series rows valued per bucket with the pure valuator (hourly band exact), subtotal
 *     only when all buckets are complete.
 *  4. Period mismatch → R$ withheld; the report falls back to kWh/m³ (ED-1391).
 */
import { describe, expect, it, vi } from 'vitest';
import { AllReportModal } from '../../../src/components/premium-modals/report-all/AllReportModal';
import { toCsv } from '../../../src/components/premium-modals/internal/engines/CsvExporter';
import { buildReportMoneyConfig, valuateDomainMoney, parseMoneyCategoryRule } from '../../../src/components/financial-goals';

const api = { clientId: 'c', clientSecret: 's', dataApiBaseUrl: 'https://api.example.com' };
const sp = (d: string, h = 0) => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00-03:00`);
const PERIOD = { startISO: '2026-01-01T00:00:00-03:00', endISO: '2026-01-31T23:59:59-03:00' };

const ROWS = [
  { id: 'a', identifier: 'LOJA-A', name: 'Loja A', consumption: 100 },
  { id: 'b', identifier: 'LOJA-B', name: 'Loja B', consumption: 50 },
];

async function moneyConfig(withBTariff: boolean) {
  const result = await valuateDomainMoney({
    domain: 'energy',
    startTs: Date.parse(PERIOD.startISO),
    endTs: Date.parse(PERIOD.endISO),
    devices: [
      { key: 'a', group: 'lojas' },
      { key: 'b', group: withBTariff ? 'lojas' : 'areacomum' },
    ],
    rule: parseMoneyCategoryRule({ SPECIFIC: ['lojas'], COMMON_AREA: ['areacomum'] }),
    loadTree: async ({ category, year, domain }) =>
      category === 'SPECIFIC'
        ? ({
            customerId: 'g',
            domain,
            category,
            year,
            version: 1,
            tree: { annual: { price: '0.333333' }, daily: { '01-10': { hourly: { '18': { price: '1.200000' } } } } },
          } as any)
        : null,
    periodTotals: { a: 100, b: 50 },
    fetchSegmentTotals: async (s: number) => (s === sp('2026-01-10') ? { a: 0, b: 0 } : { a: 50, b: 25 }),
  });
  return buildReportMoneyConfig(result, { period: PERIOD });
}

function modal(params: Record<string, unknown> = {}) {
  const m = new AllReportModal({ customerId: 'cust', api, domain: 'energy', ...params } as any) as any;
  m.data = ROWS.map((r) => ({ ...r }));
  m.exportPeriod = { ...PERIOD };
  const files: string[] = [];
  m.downloadCSV = vi.fn((content: string) => files.push(content));
  return { m, files };
}

describe('AllReportModal exports — physical mode is byte-identical (AC-11/AC-19)', () => {
  it('daily CSV keeps the pre-RFC format', async () => {
    const { m, files } = modal();
    await m.exportCSV();
    expect(files[0]).toBe(
      toCsv([
        ['Identificador', 'Nome', 'Consumo (kWh)'],
        ['LOJA-A', 'Loja A', '100,00'],
        ['LOJA-B', 'Loja B', '50,00'],
      ])
    );
  });

  it('PDF/XLS rows and columns unchanged (no extra column / cells)', () => {
    const { m } = modal();
    expect(m.exportColumns()).toBeNull();
    for (const d of m.buildExportDevices()) expect(d).not.toHaveProperty('extraCells');
  });
});

describe('AllReportModal exports — money mode (ED-1391: tudo em R$)', () => {
  it('daily CSV: only "Custo estimado (R$)" (no kWh column), "-" + reason when incomplete, total withheld', async () => {
    const money = await moneyConfig(false); // 'a' partial (hourly band on Jan 10), 'b' no tariff
    const { m, files } = modal({ money });
    await m.exportCSV();
    const lines = files[0].split(/\r?\n/);
    expect(lines[0]).toBe('"Identificador";"Nome";"Custo estimado (R$)";"Observação"');
    expect(files[0]).not.toContain('Consumo (kWh)');
    expect(lines.find((l: string) => l.includes('Loja A'))).toBe('"LOJA-A";"Loja A";"-";"Tarifa parcial"');
    expect(lines.find((l: string) => l.includes('Loja B'))).toBe('"LOJA-B";"Loja B";"-";"Sem tarifa"');
    expect(files[0]).not.toMatch(/R\$ 0|;"0,00"|NaN|Fatura|Faturamento|—/m);
    expect(files[0]).toContain('"Custo estimado total";"";"-";"Cobertura incompleta (0 de 2)"');
  });

  it('daily CSV: total = round(Σ raw) of the rows, only when every row is complete', async () => {
    // every row complete: no hourly band in the trees
    const result = await valuateDomainMoney({
      domain: 'energy',
      startTs: Date.parse(PERIOD.startISO),
      endTs: Date.parse(PERIOD.endISO),
      devices: [
        { key: 'a', group: 'lojas' },
        { key: 'b', group: 'lojas' },
      ],
      rule: parseMoneyCategoryRule({ SPECIFIC: ['lojas'] }),
      loadTree: async ({ category, year, domain }) =>
        ({ customerId: 'g', domain, category, year, version: 1, tree: { annual: { price: '0.333333' } } }) as any,
      periodTotals: { a: 100, b: 50 },
    });
    const { m, files } = modal({ money: buildReportMoneyConfig(result, { period: PERIOD }) });
    await m.exportCSV();
    // a = 33.3333 → 33,33 ; b = 16.66665 → 16,67 ; total = round(49.99995) = 50,00 (not 33,33 + 16,67)
    expect(files[0]).toBe(
      toCsv([
        ['Identificador', 'Nome', 'Custo estimado (R$)'],
        ['LOJA-A', 'Loja A', '33,33'],
        ['LOJA-B', 'Loja B', '16,67'],
        [],
        ['Custo estimado total', '', '50,00'],
      ])
    );
    expect(m.computeKpis().find((k: any) => k.label === 'Custo estimado total')).toEqual({
      value: 'R$ 50,00',
      label: 'Custo estimado total',
    });
  });

  it('PDF/XLS: the value column IS the cost (2dp, "-" when incomplete), reason beside the name', async () => {
    const money = await moneyConfig(false);
    const { m } = modal({ money });
    expect(m.exportColumns()).toEqual({
      valueLabel: 'Custo estimado (R$)',
      valueDecimals: 2,
      emptyValueText: '-',
      percLabel: '% consumo',
    });
    expect(m.exportUnit()).toBe('R$');
    const devices = m.buildExportDevices();
    expect(devices.map((d: any) => [d.val, d.nameNote])).toEqual([
      [null, 'Tarifa parcial'],
      [null, 'Sem tarifa'],
    ]);
    for (const d of devices) expect(d).not.toHaveProperty('extraCells');
    // % keeps the physical share (ED-1389 precedent)
    expect(devices.map((d: any) => Math.round(d.perc))).toEqual([67, 33]);
    expect(m.computeKpis().find((k: any) => k.label === 'Custo estimado total')).toEqual({
      value: '-',
      label: 'Custo estimado total',
      sub: 'Cobertura incompleta (0 de 2)',
    });
  });

  it('hourly CSV: each hour valued at its own price (band exact), "-" for the rest, honest total', async () => {
    const money = await moneyConfig(false);
    const { m, files } = modal({ money, granularity: '1h' });
    m.granularity = '1h';
    m.ensureHourlySeries = vi.fn(async () =>
      new Map([
        ['a', [
          { timestamp: sp('2026-01-10', 18), value: 2 },
          { timestamp: sp('2026-01-10', 19), value: 3 },
        ]],
        ['b', [{ timestamp: sp('2026-01-10', 18), value: 1 }]],
      ])
    );
    await m.exportCSV();
    const lines = files[0].split(/\r?\n/);
    expect(lines[0]).toBe('"Identificador";"Nome";"Data/Hora";"Custo estimado (R$)"');
    expect(lines.find((l: string) => l.includes('Loja A') && l.includes('18:00'))).toMatch(/"2,40"$/); // 2 × 1,20
    expect(lines.find((l: string) => l.includes('Loja A') && l.includes('19:00'))).toMatch(/"1,00"$/); // 3 × 0,333333 → 1,00
    expect(lines.find((l: string) => l.includes('Loja B'))).toMatch(/"-"$/); // 'b' has no COMMON_AREA tariff
    expect(files[0]).toContain('"Custo estimado total";"";"";"-";"Cobertura incompleta (2 de 3)"');
  });

  it('hourly CSV: total line in R$ when every hour is complete', async () => {
    const money = await moneyConfig(false);
    const { m, files } = modal({ money, granularity: '1h' });
    m.data = [ROWS[0]].map((r) => ({ ...r }));
    m.granularity = '1h';
    m.ensureHourlySeries = vi.fn(async () =>
      new Map([['a', [
        { timestamp: sp('2026-01-10', 18), value: 2 },
        { timestamp: sp('2026-01-10', 19), value: 3 },
      ]]])
    );
    await m.exportCSV();
    expect(files[0]).toContain('"Custo estimado total";"";"";"3,40"');
  });
});

describe('AllReportModal — Diário/Horário rows (RFC-0223 expansion) in money mode', () => {
  it('series is in R$ only (kWh in the title), subtotal only when all buckets complete', async () => {
    const money = await moneyConfig(false);
    const { m } = modal({ money });
    m.getDeviceSeries = vi.fn(async () => [
      { timestamp: sp('2026-01-10', 18), value: 2 },
      { timestamp: sp('2026-01-10', 19), value: 3 },
    ]);
    m.granularity = '1h';
    const box = document.createElement('div');
    document.body.appendChild(box);
    await m.fillSeries('a', box);
    expect(Array.from(box.querySelectorAll('th')).map((th) => th.textContent)).toEqual(['Data/Hora', 'Custo estimado (R$)']);
    const cells = Array.from(box.querySelectorAll('[data-money-cell]')).map((c) => c.textContent!.trim());
    expect(cells).toEqual(['2,40', '1,00']);
    expect(box.querySelector('[data-money-cell] span')!.getAttribute('title')).toBe('2,00 kWh');
    expect(box.querySelector('[data-money-subtotal]')!.textContent!.trim()).toBe('3,40');

    // daily bucket of the band day → mixed prices → no amount, subtotal withheld
    m.granularity = '1d';
    m.getDeviceSeries = vi.fn(async () => [{ timestamp: sp('2026-01-10'), value: 24 }]);
    await m.fillSeries('a', box);
    expect(box.querySelector('[data-money-cell]')!.textContent!.trim()).toBe('-');
    expect(box.querySelector('[data-money-subtotal]')!.textContent).toContain('Cobertura incompleta (0 de 1)');
    box.remove();
  });

  it('physical mode: series table unchanged (no R$ column)', async () => {
    const { m } = modal();
    m.getDeviceSeries = vi.fn(async () => [{ timestamp: sp('2026-01-10', 18), value: 2 }]);
    m.granularity = '1h';
    const box = document.createElement('div');
    document.body.appendChild(box);
    await m.fillSeries('a', box);
    expect(box.querySelectorAll('th')).toHaveLength(2);
    expect(box.querySelector('[data-money-cell]')).toBeNull();
    box.remove();
  });
});

describe('AllReportModal — R$ withheld for a different period', () => {
  it('report period ≠ dashboard period → overlay unavailable, no R$ cells', async () => {
    const money = await moneyConfig(true);
    const { m } = modal({ money });
    m.exportPeriod = { startISO: '2025-06-01T00:00:00-03:00', endISO: '2025-06-30T23:59:59-03:00' };
    const active = m.activeMoney();
    expect(active.overlay).toEqual({ state: 'unavailable', reason: 'PERIOD_MISMATCH' });
    expect(active.perDevice).toEqual({});
    expect(active.valuateBucket).toBeUndefined();
  });

  it('ED-1391: other period → the whole report goes back to kWh (+ notice), exports physical', async () => {
    const money = await moneyConfig(true);
    const { m, files } = modal({ money });
    m.exportPeriod = { startISO: '2025-06-01T00:00:00-03:00', endISO: '2025-06-30T23:59:59-03:00' };
    expect(m.moneyMode).toBe(false);
    expect(m.moneyNoticeText()).toBe(
      'Valores em R$ disponíveis só para o período do dashboard (01/01/2026–31/01/2026). Exibindo kWh.'
    );
    expect(m.exportColumns()).toBeNull();
    expect(m.exportUnit()).toBe('kWh');
    expect(m.computeKpis().map((k: any) => k.label)).toContain('Total kWh');
    await m.exportCSV();
    expect(files[0]).toBe(
      toCsv([
        ['Identificador', 'Nome', 'Consumo (kWh)'],
        ['LOJA-A', 'Loja A', '100,00'],
        ['LOJA-B', 'Loja B', '50,00'],
      ])
    );
  });
});
