/**
 * ED-1391 — All Report (MENU → Relatórios) 100% em R$ com devices misturados.
 *
 * Fixture "todos" de energia: transformador + entrada (fora da valoração, RFC-0241 Q8),
 * loja com tarifa, loja sem tarifa e área comum com tarifa. Decisões do owner:
 *  - trafo/entrada → "-" + "Não valorado", FORA do total (não conta como falta de cobertura);
 *  - valorável sem tarifa → total "-" + "Cobertura incompleta (n de m)" (nunca soma parcial);
 *  - % e fatias continuam físicos; o seletor abre no período do dashboard.
 */
import { describe, expect, it, vi } from 'vitest';
import { AllReportModal } from '../../../src/components/premium-modals/report-all/AllReportModal';
import { toCsv } from '../../../src/components/premium-modals/internal/engines/CsvExporter';
import {
  buildReportMoneyConfig,
  valuateDomainMoney,
  parseMoneyCategoryRule,
} from '../../../src/components/financial-goals';
import {
  divideMoney,
  moneyGroupSummary,
  moneyTotalView,
  rowMoneyView,
} from '../../../src/components/premium-modals/report-all/allReportMoneyView';

const api = { clientId: 'c', clientSecret: 's', dataApiBaseUrl: 'https://api.example.com' };
const sp = (d: string, h = 0) => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00-03:00`);
const PERIOD = { startISO: '2026-01-01T00:00:00-03:00', endISO: '2026-01-31T23:59:59-03:00' };

// Ordem de chegada da API (o modal reordena pelo custo)
const ROWS = [
  { id: 't1', identifier: 'TRAFO-1', name: 'Trafo 1', consumption: 1000, groupLabel: 'transformadores' },
  { id: 'e1', identifier: 'ENT-1', name: 'Entrada 1', consumption: 900, groupLabel: 'Entrada' },
  { id: 'a', identifier: 'LOJA-A', name: 'Loja A', consumption: 100, groupLabel: 'Lojas' },
  { id: 'b', identifier: 'LOJA-B', name: 'Loja B', consumption: 40, groupLabel: 'Lojas' },
  { id: 'c', identifier: 'AC-C', name: 'Área C', consumption: 200, groupLabel: 'Área Comum' },
];

/** a/c com tarifa; b sem tarifa (categoria própria sem árvore) — ou com tarifa (allPriced). */
async function mixedMoney(allPriced = false) {
  const result = await valuateDomainMoney({
    domain: 'energy',
    startTs: Date.parse(PERIOD.startISO),
    endTs: Date.parse(PERIOD.endISO),
    devices: [
      { key: 't1', group: 'transformadores' },
      { key: 'e1', group: 'entrada' },
      { key: 'a', group: 'lojas' },
      { key: 'b', group: 'lojas', category: allPriced ? null : 'GENERIC' },
      { key: 'c', group: 'areacomum' },
    ],
    rule: parseMoneyCategoryRule({ SPECIFIC: ['lojas'], COMMON_AREA: ['areacomum'] }),
    loadTree: async ({ category, year, domain }) => {
      const price = category === 'SPECIFIC' ? '0.5' : category === 'COMMON_AREA' ? '0.25' : null;
      return price
        ? ({ customerId: 'g', domain, category, year, version: 1, tree: { annual: { price } } } as any)
        : null;
    },
    periodTotals: { t1: 1000, e1: 900, a: 100, b: 40, c: 200 },
  });
  return buildReportMoneyConfig(result, { period: PERIOD });
}

function modal(params: Record<string, unknown> = {}) {
  const m = new AllReportModal({ customerId: 'cust', api, domain: 'energy', group: 'todos', ...params } as any) as any;
  m.data = ROWS.map((r) => ({ ...r }));
  m.exportPeriod = { ...PERIOD };
  const files: string[] = [];
  m.downloadCSV = vi.fn((content: string) => files.push(content));
  return { m, files };
}

describe('buildReportMoneyConfig.itemMoney — "não valorado" ≠ "sem tarifa"', () => {
  it('null for trafo/entrada (outside the valuation), item.money for the priceable ones', async () => {
    const money = await mixedMoney();
    expect(money.itemMoney!('t1')).toBeNull();
    expect(money.itemMoney!('e1')).toBeNull();
    expect(money.itemMoney!('a')).toMatchObject({ state: 'complete', amount: expect.any(String) });
    expect(money.itemMoney!('b')).toMatchObject({ state: 'missing' });
    expect(money.itemMoney!('desconhecido')).toBeNull();
  });
});

describe('allReportMoneyView (pure)', () => {
  it('row views: R$ for complete, "-" + chip for no tariff, "-" + "Não valorado" for trafo', async () => {
    const money = await mixedMoney();
    expect(rowMoneyView(money, 'a')).toMatchObject({ scope: 'in', state: 'complete', amount: '50.00', text: '50,00', chip: '' });
    expect(rowMoneyView(money, 'b')).toMatchObject({ scope: 'in', state: 'missing', amount: null, text: '-', chip: 'Sem tarifa' });
    expect(rowMoneyView(money, 't1')).toMatchObject({ scope: 'out', amount: null, text: '-', chip: 'Não valorado' });
  });

  it('total: trafo/entrada out of the total; a priceable "-" → "-" + Cobertura incompleta (never a partial sum)', async () => {
    const total = moneyTotalView(await mixedMoney(), ROWS);
    expect(total).toMatchObject({
      amount: null,
      text: '-',
      covered: 2,
      scopeCount: 3,
      outCount: 2,
      coverageNote: 'Cobertura incompleta (2 de 3)',
      outNote: '2 não valorados fora do total',
    });
  });

  it('total: every priceable device complete → round(Σ raw) of them even with trafo in the report', async () => {
    const money = await mixedMoney(true);
    const total = moneyTotalView(money, ROWS);
    // a = 100 × 0,5 = 50 ; b = 40 × 0,5 = 20 ; c = 200 × 0,25 = 50 → 120 (trafo/entrada fora)
    expect(total.amount).toBe('120.00');
    expect(total.text).toBe('R$ 120,00');
    expect(total.coverageNote).toBe('');
    expect(total.outNote).toBe('2 não valorados fora do total');
  });

  it('only non-valued devices → "-" and no coverage note', async () => {
    const total = moneyTotalView(await mixedMoney(), ROWS.slice(0, 2));
    expect(total).toMatchObject({ amount: null, text: '-', scopeCount: 0, coverageNote: '', outNote: '2 não valorados' });
  });

  it('group summaries', async () => {
    const money = await mixedMoney();
    expect(moneyGroupSummary(money, ROWS.filter((r) => r.groupLabel === 'Lojas'))).toBe(
      '2 dispositivos · - · Cobertura incompleta (1 de 2)'
    );
    expect(moneyGroupSummary(money, ROWS.filter((r) => r.groupLabel === 'Área Comum'))).toBe('1 dispositivo · R$ 50,00');
    expect(moneyGroupSummary(money, ROWS.filter((r) => r.groupLabel === 'Entrada'))).toBe('1 dispositivo · - · não valorado');
  });

  it('divideMoney: cents, half up', () => {
    expect(divideMoney('100.00', 3)).toBe('33.33');
    expect(divideMoney('0.05', 2)).toBe('0.03');
    expect(divideMoney(null, 2)).toBeNull();
    expect(divideMoney('10.00', 0)).toBeNull();
  });
});

describe('AllReportModal — money mode with mixed devices ("todos")', () => {
  it('grid header: value column is "Custo estimado (R$)" sortable by cost, "% consumo"', async () => {
    const { m } = modal({ money: await mixedMoney() });
    const html = m.renderHeaderCellsHTML(true);
    expect(html).toContain('data-sort="money"');
    expect(html).toContain('Custo estimado (R$)');
    expect(html).toContain('% consumo');
    expect(html).not.toContain('Consumo (kWh)');
  });

  it('grid rows: R$ (kWh in title), "-" + chip, physical % share', async () => {
    const { m } = modal({ money: await mixedMoney() });
    const grand = m.calculateTotalConsumption(); // 2240
    const wrap = (html: string) => {
      const t = document.createElement('table');
      t.innerHTML = `<tbody>${html}</tbody>`;
      return t;
    };
    const rowA = wrap(m.renderRowHTML(m.data[2], grand, true));
    const cellA = rowA.querySelector('[data-money-cell]')!;
    expect(cellA.textContent).toBe('50,00');
    expect(cellA.getAttribute('title')).toBe('100,00 kWh');
    expect(rowA.textContent).toContain('4,46%'); // 100 / 2240

    const rowB = wrap(m.renderRowHTML(m.data[3], grand, true));
    expect(rowB.querySelector('[data-money-cell]')!.textContent).toBe('-');
    expect(rowB.querySelector('.myio-money-chip')!.textContent).toBe('Sem tarifa');

    const rowT = wrap(m.renderRowHTML(m.data[0], grand, true));
    expect(rowT.querySelector('[data-money-cell]')!.textContent).toBe('-');
    expect(rowT.querySelector('.myio-money-chip')!.textContent).toBe('Não valorado');
    expect(rowT.querySelector('[data-money-cell]')!.getAttribute('title')).toContain('1.000,00 kWh');
    // valores visíveis: "-" (nunca "—", "R$ 0" ou NaN); o "—" só aparece no title explicativo
    expect(rowT.textContent).not.toMatch(/R\$ 0|NaN|—/);
  });

  it('sorting: cost desc by default, devices without R$ last', async () => {
    const { m } = modal({ money: await mixedMoney() });
    expect(m.getFilteredData().map((r: any) => r.id)).toEqual(['a', 'c', 't1', 'e1', 'b']);
    m.sortDirection = 'asc';
    expect(m.getFilteredData().map((r: any) => r.id).slice(-3)).toEqual(['t1', 'e1', 'b']);
  });

  it('KPIs: total "-" with coverage + out-of-total note, max/min in R$, "Sem custo" count (sub per state)', async () => {
    const { m } = modal({ money: await mixedMoney() });
    expect(m.computeKpis()).toEqual([
      { value: '5', label: 'Dispositivos' },
      {
        value: '-',
        label: 'Custo estimado total',
        sub: 'Cobertura incompleta (2 de 3) · 2 não valorados fora do total',
      },
      { value: '-', label: 'Média por Dispositivo' },
      { value: 'R$ 50,00', label: 'Máximo', sub: 'Loja A' },
      { value: 'R$ 50,00', label: 'Mínimo', sub: 'Loja A' },
      { value: '0', label: 'Sem Consumo' },
      { value: '1', label: 'Sem custo', sub: '1 Sem tarifa' },
    ]);
  });

  it('KPIs: all priceable complete → total and average over the priceable devices only', async () => {
    const { m } = modal({ money: await mixedMoney(true) });
    const kpis = m.computeKpis();
    expect(kpis[1]).toEqual({ value: 'R$ 120,00', label: 'Custo estimado total', sub: '2 não valorados fora do total' });
    expect(kpis[2]).toEqual({ value: 'R$ 40,00', label: 'Média por Dispositivo' }); // 120 / 3
    expect(kpis[4]).toEqual({ value: 'R$ 20,00', label: 'Mínimo', sub: 'Loja B' });
    expect(kpis.find((k: any) => k.label === 'Sem custo')).toBeUndefined();
  });

  it('daily CSV: R$ only, "-" + reason, honest total with both notes', async () => {
    const { m, files } = modal({ money: await mixedMoney() });
    await m.exportCSV();
    expect(files[0]).toBe(
      toCsv([
        ['Identificador', 'Nome', 'Custo estimado (R$)', 'Observação'],
        ['LOJA-A', 'Loja A', '50,00', ''],
        ['AC-C', 'Área C', '50,00', ''],
        ['TRAFO-1', 'Trafo 1', '-', 'Não valorado'],
        ['ENT-1', 'Entrada 1', '-', 'Não valorado'],
        ['LOJA-B', 'Loja B', '-', 'Sem tarifa'],
        [],
        ['Custo estimado total', '', '-', 'Cobertura incompleta (2 de 3) · 2 não valorados fora do total'],
      ])
    );
  });

  it('daily CSV: all priceable complete → total in R$ (trafo stays "-" and out of the total)', async () => {
    const { m, files } = modal({ money: await mixedMoney(true) });
    await m.exportCSV();
    expect(files[0]).toContain('"TRAFO-1";"Trafo 1";"-";"Não valorado"');
    expect(files[0]).toContain('"Custo estimado total";"";"120,00";"2 não valorados fora do total"');
  });

  it('hourly CSV: trafo hours "-" and out of the total', async () => {
    const { m, files } = modal({ money: await mixedMoney(true) });
    m.granularity = '1h';
    m.ensureHourlySeries = vi.fn(async () =>
      new Map([
        ['t1', [{ timestamp: sp('2026-01-10', 10), value: 30 }]],
        ['a', [{ timestamp: sp('2026-01-10', 10), value: 2 }]],
      ])
    );
    await m.exportCSV();
    const lines = files[0].split(/\r?\n/);
    expect(lines.find((l: string) => l.includes('Trafo 1'))).toMatch(/"-"$/);
    expect(lines.find((l: string) => l.includes('Loja A'))).toMatch(/"1,00"$/);
    expect(files[0]).toContain('"Custo estimado total";"";"";"1,00";"1 hora(s) de devices não valorados fora do total"');
  });

  it('PDF/XLS: group headers in R$, values = cost or null, reason in nameNote', async () => {
    const { m } = modal({ money: await mixedMoney() });
    const out = m.buildExportDevices();
    expect(out.filter((d: any) => d.groupHeader).map((d: any) => d.groupHeader)).toEqual([
      'LOJAS  ·  2 dispositivos · - · Cobertura incompleta (1 de 2)',
      'ÁREA COMUM  ·  1 dispositivo · R$ 50,00',
      'TRANSFORMADORES  ·  1 dispositivo · - · não valorado',
      'ENTRADA  ·  1 dispositivo · - · não valorado',
    ]);
    const devs = out.filter((d: any) => !d.groupHeader);
    expect(devs.map((d: any) => [d.deviceIdentifier, d.val, d.nameNote ?? null])).toEqual([
      ['LOJA-A', 50, null],
      ['LOJA-B', null, 'Sem tarifa'],
      ['AC-C', 50, null],
      ['TRAFO-1', null, 'Não valorado'],
      ['ENT-1', null, 'Não valorado'],
    ]);
  });

  it('series of a non-valued device → explicit message, no R$ table', async () => {
    const { m } = modal({ money: await mixedMoney() });
    m.getDeviceSeries = vi.fn(async () => [{ timestamp: sp('2026-01-10', 18), value: 2 }]);
    const box = document.createElement('div');
    document.body.appendChild(box);
    await m.fillSeries('t1', box);
    expect(box.querySelector('table')).toBeNull();
    expect(box.textContent).toContain('Não valorado');
    box.remove();
  });

  it('filter modal items carry the cost (null = sem R$)', async () => {
    const { m } = modal({ money: await mixedMoney() });
    expect(m.convertToStoreItems().map((i: any) => i.consumption)).toEqual([null, null, 50, null, 50]);
  });
});

describe('AllReportModal — period (ED-1391 D3)', () => {
  it('money mode presets the picker with the dashboard period (São Paulo dates)', async () => {
    const { m } = modal({ money: await mixedMoney() });
    expect(m.moneyPresetDates()).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });

  it('exclusive end (00:00 of the next day) stays on the last day', async () => {
    const money = { ...(await mixedMoney()), period: { startISO: '2026-01-01T00:00:00-03:00', endISO: '2026-02-01T00:00:00-03:00' } };
    const { m } = modal({ money });
    expect(m.moneyPresetDates()).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });

  it('no money / temperature → no preset (current-month default kept)', async () => {
    expect(modal().m.moneyPresetDates()).toBeNull();
    const { m } = modal({ money: await mixedMoney(), domain: 'temperature' });
    expect(m.moneyPresetDates()).toBeNull();
    expect(m.moneyMode).toBe(false);
  });
});

describe('AllReportModal — physical mode untouched (no params.money)', () => {
  it('header/rows/KPIs/sort stay physical', () => {
    const { m } = modal();
    const html = m.renderHeaderCellsHTML(true);
    expect(html).toContain('Consumo (kWh)');
    expect(html).toContain('data-sort="consumption"');
    expect(html).not.toMatch(/Custo|R\$|% consumo/);
    expect(m.renderRowHTML(m.data[2], 2240, true)).not.toContain('data-money');
    expect(m.computeKpis().map((k: any) => k.label)).toEqual([
      'Dispositivos',
      'Total kWh',
      'Média por Dispositivo',
      'Máximo (kWh)',
      'Mínimo (kWh)',
      'Sem Consumo',
    ]);
    expect(m.getFilteredData().map((r: any) => r.id)).toEqual(['t1', 'e1', 'c', 'a', 'b']);
    // (o sort físico é in-place em this.data — comportamento de sempre)
    expect(m.convertToStoreItems().map((i: any) => i.consumption)).toEqual([1000, 900, 200, 100, 40]);
    expect(m.moneyNoticeText()).toBeNull();
  });
});

describe('AllReportModal.show() — money notice slot', () => {
  it('only rendered when params.money is present (physical DOM unchanged)', async () => {
    document.body.innerHTML = '';
    const physical = new AllReportModal({ customerId: 'c', api, domain: 'energy' } as any);
    const h1 = physical.show();
    expect(document.getElementById('table-container')).not.toBeNull();
    expect(document.getElementById('money-notice')).toBeNull();
    h1.close();
    document.body.innerHTML = '';

    const withMoney = new AllReportModal({ customerId: 'c', api, domain: 'energy', money: await mixedMoney() } as any);
    const h2 = withMoney.show();
    const notice = document.getElementById('money-notice') as HTMLElement | null;
    expect(notice).not.toBeNull();
    expect(notice!.style.display).toBe('none');
    h2.close();
    document.body.innerHTML = '';
  });
});

// ---------------------------------------------------------------------------
// Revisão do PR #172 (pontos 1–4)
// ---------------------------------------------------------------------------
describe('ED-1391 (revisão) — KPI "Sem custo", outro período, ordenação e concordância', () => {
  const OTHER_PERIOD = { startISO: '2026-02-01T00:00:00-03:00', endISO: '2026-02-28T23:59:59-03:00' };

  it('1) KPI conta todos os estados sem R$ sob "Sem custo", com o detalhe por estado no sub', async () => {
    const money = await mixedMoney();
    const { m } = modal({ money });
    // força "b" parcial e "c" sem categoria — o KPI conta os dois, cada estado no sub
    const orig = money.itemMoney!;
    money.itemMoney = (id: string) =>
      id === 'b' ? { state: 'partial', reason: 'no-tariff' } : id === 'c' ? { state: 'uncategorized' } : orig(id);
    const kpi = m.computeKpis().find((k: any) => k.label === 'Sem custo');
    expect(kpi.value).toBe('2');
    expect(kpi.sub).toContain('1 Tarifa parcial');
    expect(kpi.sub).toContain('1 Sem categoria');
    expect(m.computeKpis().find((k: any) => k.label === 'Sem tarifa')).toBeUndefined();
  });

  it('2) período diferente do dashboard: nenhum acesso a R$ sobra (itemMoney também desligado)', async () => {
    const { m } = modal({ money: await mixedMoney() });
    m.exportPeriod = { ...OTHER_PERIOD };
    const active = m.activeMoney();
    expect(active.overlay).toEqual({ state: 'unavailable', reason: 'PERIOD_MISMATCH' });
    expect(active.itemMoney).toBeUndefined();
    expect(active.totalFor).toBeUndefined();
    expect(active.valuateBucket).toBeUndefined();
    expect(active.perDevice).toEqual({});
    expect(m.moneyMode).toBe(false);
    // relatório físico: KPIs sem R$
    expect(m.computeKpis().map((k: any) => k.label)).not.toContain('Custo estimado total');
    // mesmo período continua com R$
    m.exportPeriod = { ...PERIOD };
    expect(typeof m.activeMoney().itemMoney).toBe('function');
    expect(m.moneyMode).toBe(true);
  });

  function sortableHeaders() {
    document.body.innerHTML = '<table><tr><th data-sort="name"></th><th data-sort="money"></th><th data-sort="consumption"></th></tr></table>';
    const th = (k: string) => document.querySelector(`[data-sort="${k}"]`) as HTMLElement;
    return th;
  }

  it('3) modo R$: clicar na coluna de custo (ordenação padrão) inverte a direção já no 1º clique', async () => {
    const { m } = modal({ money: await mixedMoney() });
    m.renderTable = vi.fn();
    const th = sortableHeaders();
    m.setupTableSorting();
    expect(m.effectiveSortField()).toBe('money');
    expect(m.sortDirection).toBe('desc');
    th('money').click();
    expect(m.sortDirection).toBe('asc');
    th('money').click();
    expect(m.sortDirection).toBe('desc');
    document.body.innerHTML = '';
  });

  it('3) outro período (físico) com sortField "money": 1º clique em Consumo inverte a direção (antes só trocava o campo)', async () => {
    const { m } = modal({ money: await mixedMoney() });
    m.renderTable = vi.fn();
    m.exportPeriod = { ...OTHER_PERIOD };
    const th = sortableHeaders();
    m.setupTableSorting();
    expect(m.sortField).toBe('money');
    expect(m.effectiveSortField()).toBe('consumption');
    expect(m.sortDirection).toBe('desc');
    th('consumption').click();
    expect(m.sortField).toBe('consumption');
    expect(m.sortDirection).toBe('asc');
    // outra coluna continua começando na direção padrão dela
    th('name').click();
    expect(m.sortField).toBe('name');
    expect(m.sortDirection).toBe('asc');
    document.body.innerHTML = '';
  });

  it('4) concordância: "1 dispositivo" / "2 dispositivos" (R$ e físico) e "1 sensor"', async () => {
    const money = await mixedMoney();
    expect(moneyGroupSummary(money, ROWS.filter((r) => r.groupLabel === 'Lojas'))).toMatch(/^2 dispositivos · /);
    expect(moneyGroupSummary(money, ROWS.filter((r) => r.groupLabel === 'Área Comum'))).toMatch(/^1 dispositivo · /);

    const { m: physical } = modal();
    expect(physical.groupSummaryText([ROWS[2]])).toMatch(/^1 dispositivo · .* kWh$/);
    expect(physical.groupSummaryText([ROWS[2], ROWS[3]])).toMatch(/^2 dispositivos · .* kWh$/);

    const temp = new AllReportModal({ customerId: 'c', api, domain: 'temperature' } as any) as any;
    expect(temp.groupSummaryText([{ id: 's1', name: 'S1', consumption: 25 }])).toMatch(/^1 sensor · média /);
    expect(temp.groupSummaryText([{ id: 's1', name: 'S1', consumption: 25 }, { id: 's2', name: 'S2', consumption: 27 }])).toMatch(
      /^2 sensores · média /
    );
  });
});
