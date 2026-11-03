/**
 * RFC-0241 Part B (rev. 2) — AllReportModal R$ in exports and in the Diário/Horário rows.
 *
 *  1. CSV (daily + hourly), PDF/XLS rows carry "Custo estimado (R$)" after the physical
 *     column; non-complete rows → empty cell, total only when every row is complete,
 *     otherwise "Cobertura incompleta (n de m)" — never 0.
 *  2. Physical mode (no params.money): exports byte-identical to the pre-change format.
 *  3. Series rows valued per bucket with the pure valuator (hourly band exact), subtotal
 *     only when all buckets are complete.
 *  4. Period mismatch → R$ withheld.
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

describe('AllReportModal exports — money mode (rev. 2)', () => {
  it('daily CSV: "Custo estimado (R$)" after the physical column, empty when incomplete, total withheld', async () => {
    const money = await moneyConfig(false); // 'a' partial (hourly band on Jan 10), 'b' no tariff
    const { m, files } = modal({ money });
    await m.exportCSV();
    const lines = files[0].split(/\r?\n/);
    expect(lines[0]).toContain('Consumo (kWh)');
    expect(lines[0].indexOf('Consumo (kWh)')).toBeLessThan(lines[0].indexOf('Custo estimado (R$)'));
    expect(files[0]).not.toMatch(/R\$ 0|;0,00\s*$|NaN|Fatura|Faturamento/m);
    expect(files[0]).toContain('Cobertura incompleta (0 de 2)');
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
    expect(files[0]).toContain('33,33');
    expect(files[0]).toContain('16,67');
    expect(files[0]).toMatch(/Custo estimado \(R\$\) — total[^\n]*50,00/);
    expect(m.computeMoneyKpi()).toEqual({ value: 'R$ 50,00', label: 'Custo estimado (R$)' });
  });

  it('PDF/XLS: extra column with the R$ cell, empty (never R$ 0) when incomplete', async () => {
    const money = await moneyConfig(false);
    const { m } = modal({ money });
    expect(m.exportColumns()).toEqual({ extraColumns: [{ label: 'Custo estimado (R$)', pdfW: 40 }] });
    const cells = m.buildExportDevices().map((d: any) => d.extraCells);
    expect(cells).toEqual([[''], ['']]);
    expect(m.computeKpis().find((k: any) => k.label === 'Custo estimado (R$)')).toEqual({
      value: 'Cobertura incompleta',
      label: 'Custo estimado (R$)',
    });
  });

  it('hourly CSV: each hour valued at its own price (band exact), incomplete marker for the rest', async () => {
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
    expect(lines[0]).toContain('Custo estimado (R$)');
    expect(lines.find((l: string) => l.includes('Loja A') && l.includes('18:00'))).toMatch(/2,40/); // 2 × 1,20
    expect(lines.find((l: string) => l.includes('Loja A') && l.includes('19:00'))).toMatch(/1,00/); // 3 × 0,333333 = 0,999999 → 1,00
    expect(files[0]).toContain('Cobertura incompleta (2 de 3)'); // 'b' has no COMMON_AREA tariff
  });
});

describe('AllReportModal — Diário/Horário rows (RFC-0223 expansion) in money mode', () => {
  it('values each bucket, subtotal only when all buckets complete', async () => {
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
    const cells = Array.from(box.querySelectorAll('[data-money-cell]')).map((c) => c.textContent!.trim());
    expect(cells).toEqual(['R$ 2,40', 'R$ 1,00']);
    expect(box.querySelector('[data-money-subtotal]')!.textContent!.trim()).toBe('R$ 3,40');

    // daily bucket of the band day → mixed prices → no amount, subtotal withheld
    m.granularity = '1d';
    m.getDeviceSeries = vi.fn(async () => [{ timestamp: sp('2026-01-10'), value: 24 }]);
    await m.fillSeries('a', box);
    expect(box.querySelector('[data-money-cell]')!.textContent!.trim()).toBe('—');
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
});
