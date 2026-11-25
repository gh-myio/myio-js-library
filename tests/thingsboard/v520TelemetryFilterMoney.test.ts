/**
 * ED-1405 — modal "Filtros & Ordenação" do TELEMETRY (v5.2.0) no modo R$.
 * ED-1406 — tooltip (i) "Resumo — <coluna>" (header da coluna + modal) no modo R$.
 *
 * Executa as FUNÇÕES REAIS do controller num sandbox. A "MAIN" também é real:
 * getItemMoney / formatMoneyTotal / formatItemValue extraídos do MAIN_VIEW, com o estado
 * da valoração stubado e os helpers reais da lib (sumItemMoney, formatBRL, …).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ColumnSummaryTooltip } from '../../src/utils/tooltips/ColumnSummaryTooltip';
import { extractFunction, readControllerSource } from './helpers/extractControllerFunction';
import {
  buildMoneyCoverageMarkerHTML,
  formatItemMoney,
  sumItemMoney,
} from '../../src/components/financial-goals/moneyDisplay';
import { formatBRL } from '../../src/components/financial-goals/moneyFormat';

const TLM_SRC = readControllerSource('TELEMETRY');
const MAIN_SRC = readControllerSource('MAIN_VIEW');

type Domain = 'energy' | 'water' | 'temperature';
type Money = { state: string; amount?: string; currency: string; coverage: number; reason?: string };
const complete = (amount: string): Money => ({ state: 'complete', amount, currency: 'BRL', coverage: 1 });
const missing: Money = { state: 'missing', currency: 'BRL', coverage: 0, reason: 'no-tariff' };

// Formatadores físicos determinísticos (no lugar dos *WithSettings da MAIN)
const fmtKwh = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(3).replace('.', ',')} MWh` : `${v.toFixed(3).replace('.', ',')} kWh`;
const fmtM3 = (v: number) => `${v.toFixed(2).replace('.', ',')} m³`;
const fmtC = (v: number) => `${v.toFixed(1).replace('.', ',')} °C`;

const TLM_FUNCTIONS = [
  'escapeHtml',
  '_getExportUnit',
  '_isMoneyMode',
  '_fmtDeviceValue',
  '_fmtPct',
  '_isTempOffline',
  '_filterValueBase',
  '_filterValueLabels',
  '_renderFilterStats',
  '_renderTemperatureFilterStats',
  '_buildPeriodLabel',
  '_buildColumnSummaryData',
];

// self.ctx do widget (título da coluna + período do dashboard)
const SELF = {
  ctx: {
    settings: { labelWidget: 'Lojas' },
    scope: { startDateISO: '2026-11-01T00:00:00-03:00', endDateISO: '2026-11-25T23:59:59-03:00' },
  },
};

/** getItemMoney / formatMoneyTotal / formatItemValue REAIS da MAIN_VIEW. */
function makeMainMoney(win: any, mode: string, byKey: Map<string, Money> | null) {
  const body =
    "const MONEY_DOMAINS = ['energy', 'water'];\n" +
    ['getItemMoney', 'formatMoneyTotal', 'formatItemValue']
      .map((n) => extractFunction(MAIN_SRC, n))
      .join('\n') +
    '\nreturn { getItemMoney, formatMoneyTotal, formatItemValue };';
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function('window', '_moneyState', '_moneyCurrentResult', '_moneyLib', body)(
    win,
    { mode },
    () => (byKey ? { byKey } : null),
    () => win.MyIOLibrary
  );
}

function makeTelemetry(opts: {
  domain: Domain;
  mode: 'money' | 'physical';
  money?: Record<string, Money>;
  /** valoração do período pronta (false = MAIN ainda calculando) */
  ready?: boolean;
  /** STATE.itemsBase (tooltip da coluna) */
  items?: unknown[];
}) {
  const win: any = {
    MyIOLibrary: { sumItemMoney, formatMoneyBRL: formatBRL, buildMoneyCoverageMarkerHTML, formatItemMoney },
    MyIOUtils: {
      getValueDisplayMode: () => opts.mode,
      formatEnergyWithSettings: fmtKwh,
      formatWaterWithSettings: fmtM3,
      formatTemperatureWithSettings: fmtC,
    },
  };
  const byKey = opts.ready === false ? null : new Map(Object.entries(opts.money || {}));
  Object.assign(win.MyIOUtils, makeMainMoney(win, opts.mode, byKey));
  const body =
    TLM_FUNCTIONS.map((n) => extractFunction(TLM_SRC, n)).join('\n') +
    `\nreturn { ${TLM_FUNCTIONS.join(', ')} };`;
  const STATE = { itemsBase: opts.items || [] };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function('window', 'WIDGET_DOMAIN', 'MyIO', 'STATE', 'self', body)(
    win,
    opts.domain,
    undefined,
    STATE,
    SELF
  ) as Record<string, (...a: any[]) => any>;
}

/** $m falso: só o card do resumo. */
function renderStats(sb: Record<string, (...a: any[]) => any>, list: unknown[], ...rest: unknown[]): string {
  const card = {
    length: 1,
    out: '',
    html(s: string) {
      this.out = s;
      return this;
    },
    empty() {
      this.out = '';
      return this;
    },
  };
  const $m = { find: (sel: string) => (sel === '#filterStatsCard' ? card : { length: 0 }) };
  sb._renderFilterStats($m, list, ...rest);
  return card.out;
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------
const dev = (id: string, value: number | null, extra: Record<string, unknown> = {}) => ({
  id: `tb-${id}`,
  ingestionId: `ING-${id}`,
  label: `Loja ${id}`,
  value,
  ...extra,
});

// Ordem por R$ ≠ ordem por kWh (L2 tem tarifa mais cara; L6 mais barata)
const STORES = [
  dev('L1', 200),
  dev('L2', 100),
  dev('L3', 50),
  dev('L4', 1500, { label: 'C&A' }),
  dev('L5', 0),
  dev('L6', 300),
];
const STORES_MONEY: Record<string, Money> = {
  'ING-L1': complete('100.00'),
  'ING-L2': complete('150.00'),
  'ING-L3': complete('10.00'),
  'ING-L4': complete('900.00'),
  'ING-L5': complete('0.00'),
  'ING-L6': complete('40.00'),
};

const WATER = [dev('W1', 10), dev('W2', 20), dev('W3', 5)];
const WATER_MONEY: Record<string, Money> = {
  'ING-W1': complete('55.55'),
  'ING-W2': complete('44.45'),
  'ING-W3': complete('0.00'),
};

const TEMPS = [dev('T1', 22.5), dev('T2', 24.1), dev('T3', null, { deviceStatus: 'offline' }), dev('T4', 23)];

// ---------------------------------------------------------------------------
// Modo físico: HTML byte-idêntico ao de antes do ED-1405 (snapshot gravado antes da mudança)
// ---------------------------------------------------------------------------
describe('ED-1405 — modo físico byte-idêntico', () => {
  it('energia, modo físico', () => {
    expect(renderStats(makeTelemetry({ domain: 'energy', mode: 'physical' }), STORES)).toMatchSnapshot();
  });

  it('água, modo físico', () => {
    expect(renderStats(makeTelemetry({ domain: 'water', mode: 'physical' }), WATER)).toMatchSnapshot();
  });

  it('temperatura, modo físico', () => {
    expect(renderStats(makeTelemetry({ domain: 'temperature', mode: 'physical' }), TEMPS)).toMatchSnapshot();
  });

  it('temperatura com o modo R$ ligado → igual ao físico (nunca valorada)', () => {
    const phys = renderStats(makeTelemetry({ domain: 'temperature', mode: 'physical' }), TEMPS);
    expect(renderStats(makeTelemetry({ domain: 'temperature', mode: 'money' }), TEMPS)).toBe(phys);
  });

  it('energia, modo R$ com a valoração pendente → físico, sem chip', () => {
    const out = renderStats(
      makeTelemetry({ domain: 'energy', mode: 'money', money: STORES_MONEY, ready: false }),
      STORES
    );
    expect(out).toMatchSnapshot();
    expect(out).toBe(renderStats(makeTelemetry({ domain: 'energy', mode: 'physical' }), STORES));
  });
});

// ---------------------------------------------------------------------------
// Modo R$
// ---------------------------------------------------------------------------
/** Linhas (nome | valor | %) de um grupo do Resumo, na ordem renderizada. */
function groupRows(html: string, label: string): string[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const group = [...doc.querySelectorAll('.filter-stats-group')].find((g) =>
    g.querySelector('.filter-stats-group-label')?.textContent?.includes(label)
  );
  return [...(group?.querySelectorAll('.filter-stats-row') || [])].map((r) =>
    [...r.querySelectorAll('span')].map((s) => s.textContent?.trim()).join(' | ')
  );
}
const textOf = (html: string, sel: string) =>
  new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').querySelector(sel)?.textContent?.trim();

describe('ED-1405 — Resumo no modo R$ com cobertura completa', () => {
  const sb = makeTelemetry({ domain: 'energy', mode: 'money', money: STORES_MONEY });
  const out = renderStats(sb, STORES);

  it('título "Resumo de Custo estimado" e média em R$ (total R$ 1.200,00 / 6)', () => {
    expect(textOf(out, '.filter-stats-head')).toBe('📊 Resumo de Custo estimado');
    expect(textOf(out, '.filter-stats-avg-val')).toBe('R$ 200,00');
  });

  it('maiores / menores / na média ordenados por R$ (não por kWh), % sobre o total em R$', () => {
    expect(groupRows(out, '3 maiores')).toEqual([
      'C&A | R$ 900,00 | 75,00%',
      'Loja L2 | R$ 150,00 | 12,50%', // em kWh seria a L6 (300 kWh)
      'Loja L1 | R$ 100,00 | 8,33%',
    ]);
    expect(groupRows(out, '3 menores')).toEqual([
      'Loja L5 | R$ 0,00 | 0,00%',
      'Loja L3 | R$ 10,00 | 0,83%',
      'Loja L6 | R$ 40,00 | 3,33%',
    ]);
    expect(groupRows(out, '3 na média')).toEqual([
      'Loja L2 | R$ 150,00 | 12,50%',
      'Loja L1 | R$ 100,00 | 8,33%',
      'Loja L6 | R$ 40,00 | 3,33%',
    ]);
  });

  it('nenhuma unidade física e nenhum marcador de cobertura', () => {
    expect(out).not.toMatch(/kWh|MWh/);
    expect(out).not.toContain('Cobertura incompleta');
  });

  it('água (m³ → R$): mesma regra; média arredondada só na exibição', () => {
    const w = renderStats(makeTelemetry({ domain: 'water', mode: 'money', money: WATER_MONEY }), WATER);
    expect(textOf(w, '.filter-stats-head')).toBe('📊 Resumo de Custo estimado');
    expect(textOf(w, '.filter-stats-avg-val')).toBe('R$ 33,33'); // 100,00 / 3
    expect(groupRows(w, '3 maiores')[0]).toBe('Loja W1 | R$ 55,55 | 55,55%'); // em m³ seria a W2
    expect(w).not.toContain('m³');
  });

  it('o 3º parâmetro (base da openFilterModal) é respeitado', () => {
    expect(renderStats(sb, STORES, sb._filterValueBase(STORES))).toBe(out);
  });
});

describe('ED-1405 — modo R$ com cobertura incompleta → físico + "Cobertura incompleta"', () => {
  const money = { ...STORES_MONEY, 'ING-L3': missing };
  const out = renderStats(makeTelemetry({ domain: 'energy', mode: 'money', money }), STORES);
  const phys = renderStats(makeTelemetry({ domain: 'energy', mode: 'physical' }), STORES);

  it('título físico + chip (5 de 6), sem nenhum R$ parcial', () => {
    // o chip tem margin-left próprio (como no total do grupo) → sem espaço no textContent
    expect(textOf(out, '.filter-stats-head')).toBe('📊 Resumo de ConsumoCobertura incompleta (5 de 6)');
    expect(textOf(out, '.filter-stats-head .myio-money-coverage')).toBe('Cobertura incompleta (5 de 6)');
    expect(out).not.toContain('R$');
  });

  it('fora o chip, idêntico ao modo físico', () => {
    const chip = buildMoneyCoverageMarkerHTML({ covered: 5, total: 6 });
    expect(out.replace(chip, '')).toBe(phys);
  });
});

describe('ED-1405 — _filterValueBase (lista: data-value, %, ordenação, Faixa)', () => {
  it('modo R$ completo: valor e total em R$', () => {
    const sb = makeTelemetry({ domain: 'energy', mode: 'money', money: STORES_MONEY });
    const base = sb._filterValueBase(STORES);
    expect(base.money).toBe(true);
    expect(base.marker).toBe('');
    expect(STORES.map(base.valueOf)).toEqual([100, 150, 10, 900, 0, 40]);
    expect(base.total).toBe(1200);
    expect(sb._fmtPct(base.valueOf(STORES[3]), base.total)).toBe('75,00%');
  });

  it('modo R$ incompleto: kWh + marcador', () => {
    const sb = makeTelemetry({
      domain: 'energy',
      mode: 'money',
      money: { ...STORES_MONEY, 'ING-L3': missing },
    });
    const base = sb._filterValueBase(STORES);
    expect(base.money).toBe(false);
    expect(base.marker).toContain('Cobertura incompleta (5 de 6)');
    expect(STORES.map(base.valueOf)).toEqual([200, 100, 50, 1500, 0, 300]);
    expect(base.total).toBe(2150);
  });

  it('modo físico / valoração pendente: kWh, sem marcador', () => {
    for (const sb of [
      makeTelemetry({ domain: 'energy', mode: 'physical', money: STORES_MONEY }),
      makeTelemetry({ domain: 'energy', mode: 'money', money: STORES_MONEY, ready: false }),
    ]) {
      const base = sb._filterValueBase(STORES);
      expect(base.money).toBe(false);
      expect(base.marker).toBe('');
      expect(base.total).toBe(2150);
    }
  });
});

describe('ED-1405 — rótulos da Faixa / ordenação', () => {
  it('modo R$ completo → "Faixa de Custo (R$)" e "Custo ↓/↑"', () => {
    const sb = makeTelemetry({ domain: 'energy', mode: 'money', money: STORES_MONEY });
    expect(sb._filterValueLabels(sb._filterValueBase(STORES))).toEqual({
      unit: '(R$)',
      rangeLabel: 'Faixa de Custo ',
      sortDesc: 'Custo ↓',
      sortAsc: 'Custo ↑',
    });
  });

  it('modo físico / R$ incompleto → os textos de sempre', () => {
    const phys = makeTelemetry({ domain: 'water', mode: 'physical' });
    expect(phys._filterValueLabels(phys._filterValueBase(WATER))).toEqual({
      unit: '(m³)',
      rangeLabel: 'Faixa de Consumo ',
      sortDesc: 'Consumo ↓',
      sortAsc: 'Consumo ↑',
    });
    const inc = makeTelemetry({
      domain: 'energy',
      mode: 'money',
      money: { ...STORES_MONEY, 'ING-L3': missing },
    });
    expect(inc._filterValueLabels(inc._filterValueBase(STORES)).unit).toBe('(kWh)');
  });

  it('temperatura → inalterado, mesmo com o modo R$ ligado', () => {
    const sb = makeTelemetry({ domain: 'temperature', mode: 'money' });
    expect(sb._filterValueLabels(sb._filterValueBase(TEMPS))).toEqual({
      unit: '(°C)',
      rangeLabel: 'Faixa de Temperatura ',
      sortDesc: 'Temperatura ↓',
      sortAsc: 'Temperatura ↑',
    });
  });
});

// ---------------------------------------------------------------------------
// ED-1406 — tooltip (i) "Resumo — <coluna>"
// ---------------------------------------------------------------------------
/** Mostra o tooltip REAL da lib com o payload do controller e lê um KPI pelo rótulo. */
function showTooltip(data: Parameters<typeof ColumnSummaryTooltip.show>[1]) {
  const trigger = document.createElement('span');
  document.body.appendChild(trigger);
  ColumnSummaryTooltip.show(trigger, data);
  const kpi = (label: string) =>
    [...document.querySelectorAll('.myio-col-summary__kpi')]
      .find((k) => k.querySelector('.myio-col-summary__kpi-label')?.textContent?.trim() === label)
      ?.querySelector('.myio-col-summary__kpi-value')
      ?.textContent?.trim();
  const rows = (label: string) => {
    const group = [...document.querySelectorAll('.myio-col-summary__group')].find((g) =>
      g.querySelector('.myio-col-summary__group-label')?.textContent?.includes(label)
    );
    return [...(group?.querySelectorAll('.myio-col-summary__row') || [])].map((r) =>
      [...r.querySelectorAll('span')].map((s) => s.textContent?.trim()).join(' | ')
    );
  };
  return { kpi, rows, text: document.body.textContent || '' };
}

describe('ED-1406 — tooltip (i) da coluna', () => {
  afterEach(() => {
    ColumnSummaryTooltip.hide();
    document.body.innerHTML = '';
  });

  it('modo físico: o mesmo payload de antes (kWh, _fmtDeviceValue, sem campos novos)', () => {
    const sb = makeTelemetry({ domain: 'energy', mode: 'physical', money: STORES_MONEY, items: STORES });
    const data = sb._buildColumnSummaryData();
    expect(Object.keys(data)).toEqual(['title', 'periodLabel', 'unit', 'devices', 'formatValue']);
    expect(data.title).toBe('Lojas');
    expect(data.periodLabel).toBe('01/11/2026 — 25/11/2026');
    expect(data.unit).toBe('kWh');
    expect(data.formatValue).toBe(sb._fmtDeviceValue);
    expect(data.devices.map((d: any) => d.value)).toEqual([200, 100, 50, 1500, 0, 300]);
  });

  it('modo R$ com a valoração pendente → igual ao físico', () => {
    const sb = makeTelemetry({
      domain: 'energy',
      mode: 'money',
      money: STORES_MONEY,
      ready: false,
      items: STORES,
    });
    const data = sb._buildColumnSummaryData();
    expect(Object.keys(data)).toEqual(['title', 'periodLabel', 'unit', 'devices', 'formatValue']);
    expect(data.formatValue).toBe(sb._fmtDeviceValue);
    expect(data.devices.map((d: any) => d.value)).toEqual([200, 100, 50, 1500, 0, 300]);
  });

  it('modo R$ completo: payload em R$ ("Custo"), sem marcador de cobertura', () => {
    const sb = makeTelemetry({ domain: 'energy', mode: 'money', money: STORES_MONEY, items: STORES });
    const data = sb._buildColumnSummaryData();
    expect(data.unit).toBe('');
    expect(data.measureLabel).toBe('Custo');
    expect(data.moneyCoverage).toBeUndefined();
    expect(data.mode).toBeUndefined();
    expect(data.devices.map((d: any) => d.value)).toEqual([100, 150, 10, 900, 0, 40]);
    expect(data.formatValue(900)).toBe('R$ 900,00');
  });

  it('modo R$ completo: tooltip inteiro em R$ e "Custo total" = total do cabeçalho (formatMoneyTotal)', () => {
    const sb = makeTelemetry({ domain: 'energy', mode: 'money', money: STORES_MONEY, items: STORES });
    const t = showTooltip(sb._buildColumnSummaryData());
    const headerTotal = formatBRL(sumItemMoney(Object.values(STORES_MONEY)).amount); // = renderHeader
    expect(t.kpi('Custo total')).toBe(headerTotal);
    expect(t.kpi('Custo total')).toBe('R$ 1.200,00');
    expect(t.kpi('Custo médio')).toBe('R$ 200,00');
    expect(t.rows('3 maiores')).toEqual([
      'C&A | R$ 900,00 | 75,00%',
      'Loja L2 | R$ 150,00 | 12,50%',
      'Loja L1 | R$ 100,00 | 8,33%',
    ]);
    expect(t.text).toContain('Custo Total · 6 dispositivos');
    expect(t.text).not.toMatch(/kWh|MWh|Consumo/);
  });

  // Limite conhecido (documentado em _filterValueBase): diverge só a ~1e-9 de uma fronteira de
  // meio centavo (ex.: '0.004999999999' → R$ 0,01 no tooltip, R$ 0,00 no card).
  it('valor de cada device igual ao do card/lista (amount exato, 12 casas), inclusive meio centavo exato', () => {
    const money = {
      ...STORES_MONEY,
      'ING-L1': complete('12.345'), // meio centavo exato → R$ 12,35 (toFixed(6/9) não perde)
      'ING-L2': complete('36208.744123456789'), // 12 casas, como sai da valoração
      'ING-L3': complete('0.004871000000'),
    };
    const sb = makeTelemetry({ domain: 'energy', mode: 'money', money, items: STORES });
    const data = sb._buildColumnSummaryData();
    for (const [i, key] of [
      [0, 'ING-L1'],
      [1, 'ING-L2'],
      [2, 'ING-L3'],
    ] as const) {
      expect(data.formatValue(data.devices[i].value)).toBe(formatItemMoney(money[key]));
    }
    expect(data.formatValue(data.devices[0].value)).toBe('R$ 12,35');
    expect(data.formatValue(data.devices[1].value)).toBe('R$ 36.208,74');
  });

  it('modo R$ incompleto: físico + "Cobertura incompleta (n de m)", nenhum R$', () => {
    const money = { ...STORES_MONEY, 'ING-L3': missing };
    const sb = makeTelemetry({ domain: 'energy', mode: 'money', money, items: STORES });
    const data = sb._buildColumnSummaryData();
    expect(data.unit).toBe('kWh');
    expect(data.formatValue).toBe(sb._fmtDeviceValue);
    expect(data.measureLabel).toBeUndefined();
    expect(data.moneyCoverage).toEqual({ covered: 5, total: 6 });
    expect(data.devices.map((d: any) => d.value)).toEqual([200, 100, 50, 1500, 0, 300]);
    const t = showTooltip(data);
    expect(t.kpi('Consumo total')).toBe('2,150 MWhCobertura incompleta (5 de 6)');
    expect(t.text).not.toContain('R$');
  });

  it('água (m³ → R$) completa: tooltip em R$', () => {
    const sb = makeTelemetry({ domain: 'water', mode: 'money', money: WATER_MONEY, items: WATER });
    const t = showTooltip(sb._buildColumnSummaryData());
    expect(t.kpi('Custo total')).toBe('R$ 100,00');
    expect(t.kpi('Custo médio')).toBe('R$ 33,33');
    expect(t.text).not.toContain('m³');
  });

  it('temperatura com o modo R$ ligado → inalterado (modo average)', () => {
    const sb = makeTelemetry({ domain: 'temperature', mode: 'money', items: TEMPS });
    const data = sb._buildColumnSummaryData();
    expect(Object.keys(data)).toEqual([
      'title',
      'periodLabel',
      'unit',
      'devices',
      'formatValue',
      'mode',
      'measureLabel',
    ]);
    expect(data.unit).toBe('°C');
    expect(data.mode).toBe('average');
    expect(data.measureLabel).toBe('Temperatura');
    expect(data.formatValue).toBe(sb._fmtDeviceValue);
    expect(data.devices.map((d: any) => d.offline)).toEqual([false, false, true, false]);
  });
});
