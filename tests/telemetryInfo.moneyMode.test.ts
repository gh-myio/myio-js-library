/**
 * ED-1389 — TELEMETRY_INFO (v5.2.0) 100% em R$ no modo "R$ em vez de kWh/m³".
 *
 * Executa as FUNÇÕES REAIS do controller (cards de KPI, pizzas/legendas, tooltips e o
 * resumo ℹ️) num sandbox com STATE/STATE_WATER/window injetados. O `MyIOUtils` simula a
 * MAIN_VIEW: `getItemMoney` por `ingestionId` e `formatMoneyTotal` com a mesma regra
 * (R$ só com TODOS os membros completos), usando os helpers reais da lib.
 *
 * Contrato:
 *   - grupo completo → R$ (o kWh/m³ só no title);
 *   - parcial / sem tarifa / sem devices → "-" (+ "Cobertura incompleta (n de m)");
 *   - Entrada e residuais (Área Comum de energia, Pontos Não Mapeados) → sempre "-";
 *   - totais com residual > 0 → "-";
 *   - percentuais e fatias da pizza seguem a participação física;
 *   - devices `excludedFromTotal` ficam fora da soma; Climatização com pai usa o pai;
 *   - modo físico: os formatadores de sempre (nada de R$).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractTelemetryInfoMoneyBlock } from './thingsboard/helpers/extractControllerFunction';
import {
  buildMoneyChipHTML,
  formatItemMoney,
  moneyCoverageTitle,
  sumItemMoney,
} from '../src/components/financial-goals/moneyDisplay';
import { formatBRL } from '../src/components/financial-goals/moneyFormat';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTROLLER = resolve(
  __dirname,
  '../src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/controller.js',
);

/** Extrai o texto de uma função top-level `function NAME(...) { ... }`. */
function extractFn(src: string, name: string): string {
  const lines = src.replace(/\r/g, '').split('\n');
  const start = lines.findIndex((l) => l.startsWith(`function ${name}(`));
  if (start < 0) throw new Error(`função não encontrada: ${name}`);
  const end = lines.findIndex((l, i) => i > start && l === '}');
  if (end < 0) throw new Error(`fim da função não encontrado: ${name}`);
  return lines.slice(start, end + 1).join('\n');
}

const FUNCTIONS = [
  'getWidgetDomain',
  'formatEnergy',
  'formatValue',
  '_waterAreaComumDisplay',
  'getEnergyTaxonomyCategories',
  'isEnergyCategoryVisible',
  '_energyChartSlices',
  '_visibleMainCategoryLabels',
  'renderPieChart',
  'renderChartLegend',
  'renderModalChart',
  'renderModalChartLegend',
  'renderWaterPieChart',
  'buildDeviceExpandList',
  'buildExportFooter',
  '_buildSimpleGroupContent',
  'buildEntradaContent',
  'buildLojasContent',
  'buildTotalConsumidoresContent',
  'buildAreaComumContentEnergy',
  'buildAreaComumContentWater',
  'buildClimatizacaoContent',
  'buildExcludedFromCAGNotice',
  'buildTransformadoresInfoSection',
  'buildExcludedFromEntradaNotice',
  'buildOutrosContent',
  'buildBanheirosContent',
  'buildPontosNaoMapeadosContent',
];

const EXPORTS = [
  '_displayGroup',
  '_displayConsumersTotal',
  '_applyMoneyToStats',
  '_applyMoneyToSummary',
  'renderPieChart',
  'renderModalChart',
  'renderWaterPieChart',
  'buildLojasContent',
  'buildEntradaContent',
  'buildTotalConsumidoresContent',
  'buildAreaComumContentEnergy',
  'buildAreaComumContentWater',
  'buildClimatizacaoContent',
  'buildOutrosContent',
  'buildBanheirosContent',
  'buildPontosNaoMapeadosContent',
  'buildTransformadoresInfoSection',
  'buildExcludedFromEntradaNotice',
];

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------
type Money = { state: string; amount?: string; currency: string; coverage: number; reason?: string };
const complete = (amount: string): Money => ({ state: 'complete', amount, currency: 'BRL', coverage: 1 });
const missing: Money = { state: 'missing', currency: 'BRL', coverage: 0, reason: 'no-tariff' };

const dev = (id: string, value: number, extra: Record<string, unknown> = {}) => ({
  id: `tb-${id}`,
  ingestionId: `ING-${id}`,
  label: `Dev ${id}`,
  value,
  ...extra,
});

/** item.money por ingestionId (o que a MAIN publica). Entrada nunca é valorada. */
const MONEY: Record<string, Money> = {
  'ING-L1': complete('100.00'),
  'ING-L2': complete('50.50'),
  'ING-C1': complete('70.00'),
  'ING-C2': missing,
  'ING-P1': complete('88.00'),
  'ING-ESC1': complete('20.00'),
  'ING-O1': complete('30.00'),
  'ING-O2': complete('999.00'), // excludedFromTotal → fora da soma
  'ING-WL1': complete('10.00'),
  'ING-WB1': complete('5.00'),
  'ING-WA1': complete('7.00'),
};

function energyState(opts: { areaComum?: number; parents?: unknown[]; climComplete?: boolean } = {}) {
  const C1 = dev('C1', 120);
  const C2 = opts.climComplete ? dev('C1', 80) : dev('C2', 80);
  return {
    entrada: { devices: [dev('E1', 1000)], total: 1000, perc: 100 },
    consumidores: {
      lojas: { devices: [dev('L1', 200), dev('L2', 100)], total: 300, perc: 30 },
      climatizacao: {
        devices: [C1, C2],
        total: 200,
        perc: 20,
        parents: opts.parents || [],
        subcategories: {
          chillers: { summary: { count: 1, total: 120 }, details: { name: 'Chillers', devices: [C1] } },
          fancoils: { summary: { count: 1, total: 80 }, details: { name: 'Fancoils', devices: [C2] } },
        },
      },
      elevadores: { devices: [], total: 0, perc: 0 },
      escadasRolantes: { devices: [dev('ESC1', 40)], total: 40, perc: 4 },
      outros: {
        devices: [dev('O1', 60), dev('O2', 500, { excludedFromTotal: true })],
        total: 60,
        perc: 6,
        subcategories: {
          iluminacao: { summary: { count: 1, total: 60 }, details: { name: 'Iluminação', devices: [dev('O1', 60)] } },
        },
      },
      areaComum: { devices: [], total: opts.areaComum ?? 400, perc: 40 },
      totalGeral: 1000,
    },
    tooltipData: {
      byCategory: {
        areaComum: { details: { devices: [dev('L1', 200), dev('O1', 60)] } },
        climatizacao: { subcategories: { chillers: { details: { devices: [C1] } } } },
      },
      excludedFromCAG: [],
      excludedFromEntrada: [],
    },
  };
}

function waterState(includeBathrooms = false) {
  return {
    includeBathrooms,
    entrada: { devices: [dev('WE1', 500)], total: 500, perc: 100 },
    lojas: { devices: [dev('WL1', 200)], total: 200, perc: 40 },
    banheiros: { devices: [dev('WB1', 50)], total: 50, perc: 10 },
    areaComum: { devices: [dev('WA1', 100)], total: 100, perc: 20 },
    pontosNaoMapeados: { devices: [], total: 150, perc: 30, hasInconsistency: false },
  };
}

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------
type Node = { html?: string; text?: string; title?: string | null; appended: string[] };

function makeSandbox(opts: {
  domain: 'energy' | 'water';
  mode: 'money' | 'physical';
  state?: unknown;
  stateWater?: unknown;
  groupFilter?: Record<string, Record<string, boolean>>;
  /** MyIOUtils.isMoneyReady: true (default) | false (valoração recalculando) | 'absent' (MAIN antiga) */
  ready?: boolean | 'absent';
}) {
  const src = readFileSync(CONTROLLER, 'utf8');
  const body =
    'let pieChartInstance = null;\nlet modalPieChartInstance = null;\n' +
    FUNCTIONS.map((n) => extractFn(src, n)).join('\n') +
    '\n' +
    extractTelemetryInfoMoneyBlock(src) +
    `\nreturn { ${EXPORTS.join(', ')} };`;

  const U: Record<string, any> = {
    formatEnergy: (v: number) => `${v} kWh`,
    formatWaterWithSettings: (v: number) => `${v} m³`,
    getValueDisplayMode: () => opts.mode,
    getItemMoney: (it: any) => {
      if (opts.mode !== 'money') return null;
      const key = typeof it === 'string' ? it : it?.ingestionId;
      return (key && MONEY[key]) || null;
    },
    // Mesma regra de MyIOUtils.formatMoneyTotal (MAIN_VIEW)
    formatMoneyTotal: (items: unknown[], domain: string) => {
      if (opts.mode !== 'money') return null;
      const list = (items || []).map((it) => U.getItemMoney(it, domain));
      if (!list.length || list.every((m: unknown) => m == null)) return null;
      const sum = sumItemMoney(list.map((m: Money | null) => m || { state: 'missing' }));
      const ok = sum.state === 'complete';
      return {
        complete: ok,
        amount: ok ? sum.amount : null,
        text: ok ? formatBRL(sum.amount) : null,
        covered: sum.covered,
        total: sum.total,
        markerHTML: '',
      };
    },
    formatItemMoney,
    buildMoneyChipHTML,
    moneyCoverageTitle,
  };
  if (opts.ready !== 'absent') {
    // Mesma regra de MyIOUtils.isMoneyReady (MAIN_VIEW): modo R$ + resultado do período pronto
    U.isMoneyReady = () => opts.mode === 'money' && opts.ready !== false;
  }

  const nodes: Record<string, Node> = {};
  const node = (sel: string) => (nodes[sel] ||= { appended: [], title: null });
  const $ = (sel: string) => {
    const n = node(sel);
    const o: any = {
      length: 1,
      0: { id: sel, getContext: () => ({ canvasId: sel.replace('#', '') }) },
      empty: () => ((n.appended = []), o),
      append: (h: string) => (n.appended.push(h), o),
      html: (h: string) => ((n.html = h), o),
      text: (t: string) => ((n.text = t), o),
      attr: (k: string, v: string) => (k === 'title' && (n.title = v), o),
      removeAttr: (k: string) => {
        if (k === 'title') sel.split(',').forEach((s) => (node(s.trim()).title = null));
        return o;
      },
      css: () => 'none',
    };
    return o;
  };
  const charts: Record<string, any> = {};
  function Chart(this: unknown, target: { canvasId?: string; id?: string }, config: any) {
    charts[target.canvasId || target.id || '?'] = config;
    return { destroy() {} };
  }
  const doc = { getElementById: (id: string) => ({ id, getContext: () => ({ canvasId: id }) }) };
  const silent = { log() {}, warn() {}, error() {} };
  const CHART_COLORS = {
    climatizacao: '#1',
    elevadores: '#2',
    escadasRolantes: '#3',
    lojas: '#4',
    outros: '#5',
    areaComum: '#6',
  };
  const groupFilter = opts.groupFilter || {
    energy: { entrada: true, lojas: true, climatizacao: true, elevadores: true, escadasRolantes: true, outros: true },
    water: { entrada: true, lojas: true, banheiros: true, areaComum: true },
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const api = new Function(
    'STATE', 'STATE_WATER', 'GROUP_FILTER', 'window', 'self', 'document', 'Chart', 'CHART_COLORS',
    '$J', '$$', 'LogHelper', 'console',
    body,
  )(
    opts.state || energyState(),
    opts.stateWater || waterState(),
    groupFilter,
    { MyIOUtils: U },
    { ctx: { settings: { DOMAIN: opts.domain } } },
    doc,
    Chart,
    CHART_COLORS,
    $,
    $,
    silent,
    silent,
  );
  return { api, nodes, charts };
}

/** Texto visível (sem atributos — o físico pode ficar no title). */
const visible = (html: string) => html.replace(/\s(title|style)="[^"]*"/g, '');

/** Chama o callback `label` do tooltip de uma pizza para a fatia `index`. */
function sliceLabel(config: any, index: number): string {
  const data = config.data.datasets[0].data;
  return config.options.plugins.tooltip.callbacks.label({
    label: config.data.labels[index],
    parsed: data[index],
    dataset: { data },
    dataIndex: index,
  });
}

// ---------------------------------------------------------------------------
describe('ED-1389 — valor de grupo em modo R$', () => {
  const { api } = makeSandbox({ domain: 'energy', mode: 'money' });

  it('grupo completo → R$ (kWh só no title)', () => {
    const v = api._displayGroup('lojas', 300);
    expect(v.text).toBe('R$ 150,50');
    expect(v.html).toBe('R$ 150,50');
    expect(v.title).toBe('Custo estimado — 300 kWh');
  });

  it('cobertura parcial → "-" + "Cobertura incompleta (1 de 2)", nunca soma parcial', () => {
    const v = api._displayGroup('climatizacao', 200);
    expect(v.text).toBe('-');
    expect(v.html).toContain('Cobertura incompleta (1 de 2)');
    expect(visible(v.html)).not.toContain('R$');
    expect(visible(v.html)).not.toContain('kWh');
  });

  it('grupo sem devices → "-" (nunca R$ 0)', () => {
    const v = api._displayGroup('elevadores', 0);
    expect(v.text).toBe('-');
    expect(v.html).not.toContain('R$ 0');
  });

  it('device excludedFromTotal fica fora da soma (como no kWh)', () => {
    expect(api._displayGroup('outros', 60).text).toBe('R$ 30,00');
  });

  it('Entrada e Área Comum residual → sempre "-"', () => {
    const e = api._displayGroup('entrada', 1000);
    expect(e.text).toBe('-');
    expect(e.title).toContain('Entrada não é valorada');
    const ac = api._displayGroup('areaComum', 400);
    expect(ac.text).toBe('-');
    expect(ac.title).toContain('residual');
  });

  it('Climatização com pai declarado → R$ do pai (filhos não somam)', () => {
    const parent = { id: 'tb-P1', ingestionId: 'ING-P1', label: 'Pai', total: 200 };
    const { api: a } = makeSandbox({ domain: 'energy', mode: 'money', state: energyState({ parents: [parent] }) });
    expect(a._displayGroup('climatizacao', 200).text).toBe('R$ 88,00');
  });

  it('Total Consumidores com residual > 0 → "-" + cobertura incompleta', () => {
    const v = api._displayConsumersTotal(1000);
    expect(v.text).toBe('-');
    expect(v.html).toContain('Cobertura incompleta');
    expect(v.title).toContain('Área Comum');
  });

  it('Total Consumidores sem residual e todos completos → R$ da soma', () => {
    const { api: a } = makeSandbox({
      domain: 'energy',
      mode: 'money',
      state: energyState({ areaComum: 0, climComplete: true }),
    });
    // 100 + 50,50 + (70 + 70) + 20 + 30
    expect(a._displayConsumersTotal(600).text).toBe('R$ 340,50');
  });

  it('filtro de grupo: só grupos ativos; residual fora quando nem todos estão ativos', () => {
    const { api: a } = makeSandbox({
      domain: 'energy',
      mode: 'money',
      groupFilter: {
        energy: { entrada: true, lojas: true, climatizacao: false, elevadores: true, escadasRolantes: true, outros: true },
        water: {},
      },
    });
    // lojas 150,50 + esc 20 + outros 30 (sem climatização incompleta, sem residual)
    expect(a._displayConsumersTotal(400).text).toBe('R$ 200,50');
  });

  it('modo físico: formatadores de sempre, sem title', () => {
    const { api: a } = makeSandbox({ domain: 'energy', mode: 'physical' });
    expect(a._displayGroup('lojas', 300)).toEqual({ html: '300 kWh', compact: '300 kWh', text: '300 kWh', title: '' });
    expect(a._displayGroup('entrada', 1000).text).toBe('1000 kWh');
    expect(a._displayConsumersTotal(1000).text).toBe('1000 kWh');
  });
});

describe('ED-1389 — cards de KPI', () => {
  it('modo R$: todos os cards em R$/"-"; voltar ao físico limpa os títulos', () => {
    const money = makeSandbox({ domain: 'energy', mode: 'money' });
    money.api._applyMoneyToStats('energy');
    const n = money.nodes;
    expect(n['#lojasTotal'].html).toBe('R$ 150,50');
    expect(n['#lojasTotal'].title).toBe('Custo estimado — 300 kWh');
    expect(n['#escadasRolantesTotal'].html).toBe('R$ 20,00');
    for (const sel of ['#entradaTotal', '#areaComumTotal', '#consumidoresTotal', '#elevadoresTotal', '#climatizacaoTotal']) {
      expect(visible(n[sel].html!)).toMatch(/^<span class="ti-money-dash">-<\/span>/);
    }
    for (const sel of Object.keys(n)) expect(visible(n[sel].html || '')).not.toContain('kWh');
  });

  it('modo físico: _applyMoneyToStats não escreve valores', () => {
    const phys = makeSandbox({ domain: 'energy', mode: 'physical' });
    phys.api._applyMoneyToStats('energy');
    expect(Object.values(phys.nodes).some((x) => x.html !== undefined)).toBe(false);
  });

  it('água: Área Comum soma banheiros sem card próprio; Pontos Não Mapeados e total com residual → "-"', () => {
    const w = makeSandbox({ domain: 'water', mode: 'money' });
    w.api._applyMoneyToStats('water');
    expect(w.nodes['#lojasTotal'].html).toBe('R$ 10,00');
    expect(w.nodes['#areaComumTotal'].html).toBe('R$ 12,00'); // 7 + 5 (banheiros)
    expect(w.nodes['#consumidoresTotal'].html).toContain('>-</span>'); // Pontos Não Mapeados
    expect(w.nodes['#waterTotalConsumidores'].html).toContain('Cobertura incompleta');
    expect(w.nodes['#entradaTotal'].html).toContain('>-</span>');
  });

  it('água com banheiros: card Banheiros e Área Comum sem banheiros', () => {
    const w = makeSandbox({ domain: 'water', mode: 'money', stateWater: waterState(true) });
    w.api._applyMoneyToStats('water');
    expect(w.nodes['#banheirosTotal'].html).toBe('R$ 5,00');
    expect(w.nodes['#areaComumTotal'].html).toBe('R$ 7,00');
  });
});

describe('ED-1389 — pizza "Distribuição de Consumo" e modal', () => {
  it('energia: tooltip e legendas em R$/"-", % físico; fatias continuam físicas', () => {
    const { api, charts, nodes } = makeSandbox({ domain: 'energy', mode: 'money' });
    api.renderPieChart();
    api.renderModalChart();
    for (const id of ['consumptionPieChart', 'modalConsumptionPieChart']) {
      const cfg = charts[id];
      const labels: string[] = cfg.data.labels;
      expect(cfg.data.datasets[0].data).toEqual([200, 0, 40, 300, 60, 400]); // tamanhos físicos
      expect(sliceLabel(cfg, labels.indexOf('Lojas'))).toBe('Lojas: R$ 150,50 (30,00%)');
      expect(sliceLabel(cfg, labels.indexOf('Área Comum'))).toBe('Área Comum: - (40,00%)');
      expect(sliceLabel(cfg, labels.indexOf('Climatização'))).toBe('Climatização: - (20,00%)');
    }
    const legend = nodes['#chartLegend'].appended.join('');
    const modalLegend = nodes['#modalChartLegend'].appended.join('');
    expect(legend).toContain('R$ 150,50 (30,00%)');
    expect(modalLegend).toContain('R$ 150,50');
    for (const h of [legend, modalLegend]) {
      expect(visible(h)).not.toContain('kWh');
      expect(h).not.toContain('myio-money-coverage'); // legenda compacta: só "-" (motivo no title, sem chip)
    }
  });

  it('água: tooltip e legenda em R$/"-"', () => {
    const { api, charts, nodes } = makeSandbox({ domain: 'water', mode: 'money' });
    api.renderWaterPieChart();
    const cfg = charts.consumptionPieChart;
    const labels: string[] = cfg.data.labels;
    expect(sliceLabel(cfg, labels.indexOf('Lojas'))).toBe('Lojas: R$ 10,00 (40,00%)');
    expect(sliceLabel(cfg, labels.indexOf('Área Comum'))).toBe('Área Comum: R$ 12,00 (20,00%)');
    expect(sliceLabel(cfg, labels.indexOf('Pontos Não Mapeados'))).toBe('Pontos Não Mapeados: - (30,00%)');
    expect(visible(nodes['#chartLegend'].appended.join(''))).not.toContain('m³');
  });

  it('modo físico: textos de sempre', () => {
    const { api, charts, nodes } = makeSandbox({ domain: 'energy', mode: 'physical' });
    api.renderPieChart();
    const cfg = charts.consumptionPieChart;
    expect(sliceLabel(cfg, cfg.data.labels.indexOf('Lojas'))).toBe('Lojas: 300 kWh (30,00%)');
    expect(nodes['#chartLegend'].appended.join('')).toContain('300 kWh (30,00%)');
    expect(nodes['#chartLegend'].appended.join('')).not.toContain('R$');
  });
});

describe('ED-1389 — tooltips dos cards em R$', () => {
  const { api } = makeSandbox({ domain: 'energy', mode: 'money' });

  it('Lojas: total e devices em R$, nada de kWh visível', () => {
    const html = api.buildLojasContent();
    expect(html).toContain('R$ 150,50');
    expect(html).toContain('R$ 100,00');
    expect(html).toContain('R$ 50,50');
    expect(visible(html)).not.toContain('kWh');
  });

  it('Entrada: total e devices "-"', () => {
    const html = api.buildEntradaContent();
    expect(visible(html)).not.toContain('kWh');
    expect(visible(html)).not.toContain('R$');
    expect(html).toContain('Entrada não é valorada');
  });

  it('Total Consumidores: "-" + cobertura incompleta (residual)', () => {
    const html = api.buildTotalConsumidoresContent();
    expect(html).toContain('Cobertura incompleta');
    expect(visible(html)).not.toContain('kWh');
  });

  it('Área Comum: linhas em R$/"-"', () => {
    const html = api.buildAreaComumContentEnergy();
    expect(html).toContain('R$ 150,50'); // Lojas
    expect(html).toContain('R$ 30,00'); // Outros
    expect(visible(html)).not.toContain('kWh');
  });

  it('Climatização: subcategoria completa em R$, incompleta "-" + chip; sem kWh', () => {
    const html = api.buildClimatizacaoContent();
    expect(html).toContain('R$ 70,00'); // Chillers
    expect(html).toContain('Sem tarifa'); // device C2 (chip do estado)
    expect(visible(html)).not.toContain('kWh');
  });

  it('Climatização com pai: linha do pai em R$ e saldo "-"', () => {
    const parent = { id: 'tb-P1', ingestionId: 'ING-P1', label: 'Pai', total: 300 };
    const { api: a } = makeSandbox({ domain: 'energy', mode: 'money', state: energyState({ parents: [parent] }) });
    const html = a.buildClimatizacaoContent();
    expect(html).toContain('R$ 88,00');
    expect(html).toContain('Pontos não mapeados');
    expect(visible(html)).not.toContain('kWh');
  });

  it('Outros: subcategoria e total em R$', () => {
    const html = api.buildOutrosContent();
    expect(html).toContain('R$ 30,00');
    expect(visible(html)).not.toContain('kWh');
  });

  it('água: Banheiros, Área Comum e Pontos Não Mapeados sem m³ visível', () => {
    const { api: w } = makeSandbox({ domain: 'water', mode: 'money', stateWater: waterState(true) });
    const banheiros = w.buildBanheirosContent();
    expect(banheiros).toContain('R$ 5,00');
    const ac = w.buildAreaComumContentWater();
    expect(ac).toContain('R$ 12,00'); // grupo inteiro
    expect(ac).toContain('R$ 7,00'); // = Área Comum (sem banheiros)
    const pontos = w.buildPontosNaoMapeadosContent();
    expect(pontos).toContain('R$ 10,00'); // Lojas
    for (const h of [banheiros, ac, pontos]) expect(visible(h)).not.toContain('m³');
  });

  it('modo físico: tooltip de Lojas igual ao de sempre (kWh, sem R$)', () => {
    const { api: a } = makeSandbox({ domain: 'energy', mode: 'physical' });
    const html = a.buildLojasContent();
    expect(html).toContain('300 kWh');
    expect(html).not.toContain('R$');
  });
});

describe('ED-1389 — resumo ℹ️ do header', () => {
  const summary = () => ({
    totalConsumption: 1000,
    unit: 'kWh',
    byCategory: [
      { id: 'entrada', consumption: 1000 },
      { id: 'lojas', consumption: 300 },
      {
        id: 'areaComum',
        consumption: 260,
        children: [
          { id: 'climatizacao', consumption: 200, children: [{ id: 'chillers', consumption: 120 }] },
          { id: 'outros', consumption: 60 },
        ],
      },
    ],
  });

  it('modo R$: cada linha R$/"-", total "-" e rótulos de custo', () => {
    const { api } = makeSandbox({ domain: 'energy', mode: 'money' });
    const s = api._applyMoneyToSummary(summary(), 'energy');
    const [entrada, lojas, ac] = s.byCategory;
    expect(entrada.displayValue).toBe('-');
    expect(lojas.displayValue).toBe('R$ 150,50');
    expect(ac.displayValue).toBe('R$ 130,00'); // grupo Área Comum (L1 + O1)
    expect(ac.children[0].displayValue).toBe('-'); // climatização incompleta
    expect(ac.children[0].children[0].displayValue).toBe('R$ 70,00'); // chillers
    expect(ac.children[1].displayValue).toBe('R$ 30,00');
    expect(s.totalDisplayValue).toBe('-');
    expect(s.valueLabel).toBe('Custo estimado');
  });

  it('modo físico: resumo intocado', () => {
    const { api } = makeSandbox({ domain: 'energy', mode: 'physical' });
    expect(api._applyMoneyToSummary(summary(), 'energy')).toEqual(summary());
  });
});

// ---------------------------------------------------------------------------
// Revisão do PR #171
// ---------------------------------------------------------------------------
describe('ED-1389 (revisão) — valoração ainda não pronta', () => {
  it('isMoneyReady=false → widget inteiro no físico (sem "-" nem "sem tarifa" falso)', () => {
    const { api, nodes } = makeSandbox({ domain: 'energy', mode: 'money', ready: false });
    expect(api._displayGroup('lojas', 300)).toEqual({ html: '300 kWh', compact: '300 kWh', text: '300 kWh', title: '' });
    expect(api._displayGroup('entrada', 1000).text).toBe('1000 kWh');
    expect(api._displayConsumersTotal(1000).text).toBe('1000 kWh');
    api._applyMoneyToStats('energy');
    expect(nodes['#lojasTotal']?.html).toBeUndefined(); // cards não reescritos
    const lojas = api.buildLojasContent();
    expect(lojas).not.toContain('R$');
    expect(lojas).not.toContain('ti-money-dash');
    expect(lojas).not.toContain('indisponível');
  });

  it('MAIN antiga sem isMoneyReady → comportamento R$ de antes (compatível)', () => {
    const { api } = makeSandbox({ domain: 'energy', mode: 'money', ready: 'absent' });
    expect(api._displayGroup('lojas', 300).text).toBe('R$ 150,50');
  });

  it('água: isMoneyReady=false → m³ de sempre', () => {
    const { api } = makeSandbox({ domain: 'water', mode: 'money', ready: false });
    expect(api._displayGroup('lojas', 200).text).toBe('200 m³');
  });
});

describe('ED-1389 (revisão) — Entrada e Transformadores com o motivo certo', () => {
  const withEntradaExtras = () => {
    const s: any = energyState();
    s.tooltipData.byCategory.transformadores = {
      summary: { total: 300 },
      details: { devices: [dev('T1', 300)] },
    };
    s.tooltipData.excludedFromEntrada = [dev('X1', 50)];
    return s;
  };

  it('lista de devices do tooltip de Entrada: "-" com "Entrada não é valorada" (não "sem tarifa")', () => {
    const { api } = makeSandbox({ domain: 'energy', mode: 'money', state: withEntradaExtras() });
    const html = api.buildEntradaContent();
    expect(visible(html)).not.toContain('kWh');
    expect(html).toContain('Entrada não é valorada em R$');
    expect(html).not.toContain('sem tarifa ou sem categoria');
  });

  it('Transformadores: devices e total "-" com "Transformadores não são valorados"', () => {
    const { api } = makeSandbox({ domain: 'energy', mode: 'money', state: withEntradaExtras() });
    const html = api.buildTransformadoresInfoSection();
    expect(visible(html)).not.toContain('kWh');
    expect((html.match(/Transformadores não são valorados em R\$/g) || []).length).toBe(2);
    expect(html).not.toContain('sem tarifa ou sem categoria');
  });

  it('excluídos da Entrada: devices e total "-" com "Entrada não é valorada"', () => {
    const { api } = makeSandbox({ domain: 'energy', mode: 'money', state: withEntradaExtras() });
    const html = api.buildExcludedFromEntradaNotice();
    expect(visible(html)).not.toContain('kWh');
    expect((html.match(/Entrada não é valorada em R\$/g) || []).length).toBe(2);
  });

  it('modo físico: Transformadores e excluídos da Entrada em kWh de sempre', () => {
    const { api } = makeSandbox({ domain: 'energy', mode: 'physical', state: withEntradaExtras() });
    expect(api.buildTransformadoresInfoSection()).toContain('300 kWh');
    expect(api.buildExcludedFromEntradaNotice()).toContain('50 kWh');
  });
});
