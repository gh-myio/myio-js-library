/**
 * ED-1388 — TELEMETRY_INFO (v5.2.0) respeita a taxonomia GCDR do customer.
 *
 * Extrai as FUNÇÕES REAIS do controller (visibilidade por taxonomia, fatias da
 * pizza/legendas e o tooltip de Área Comum) e as executa num sandbox com
 * STATE/window injetados. Os perfis são montados como o MAIN_VIEW monta:
 * `parseGcdrEntityForest(roots)` → `resolveActiveProfile` (o que
 * `setActiveProfile` aplica e o MAIN_VIEW grava em
 * `MyIOUtils.deviceClassificationProfile`).
 *
 * Contrato:
 *   - Taboão (taxonomia sem escada rolante): sem card/fatia/legenda de Esc. Rolantes.
 *   - Customer com escada rolante na taxonomia: tudo como antes.
 *   - Taxonomia degradada (piso baked) ou sem perfil: tudo como antes.
 *   - Nunca esconde consumo real (categoria ausente mas com total > 0 aparece).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  DEFAULT_DEVICE_CLASSIFICATION_PROFILE,
  parseGcdrEntityForest,
  resolveActiveProfile,
  validateProfile,
  type DeviceClassificationProfile,
  type GcdrEntityNode,
} from '../src/utils/devices/deviceClassificationProfile';

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

// ---------------------------------------------------------------------------
// Taxonomias (mesmo formato do GCDR `entities/resolve`)
// ---------------------------------------------------------------------------
const leaf = (key: string, children: string[]): GcdrEntityNode => ({
  entityType: 'GROUP',
  entityKey: key,
  entityValue: key,
  children: children.map((p) => ({ entityType: 'PROFILE', entityKey: p, entityValue: p, children: [] })),
});

function energyRoot(withEscadas: boolean): GcdrEntityNode {
  const categories = [
    leaf('climatizacao', ['CHILLER', 'FANCOIL', 'BOMBA_CAG']),
    leaf('elevadores', ['ELEVADOR']),
    ...(withEscadas ? [leaf('escada-rolante', ['ESCADA_ROLANTE'])] : []),
  ];
  return {
    entityType: 'GROUP',
    entityKey: 'energy',
    entityValue: 'Energia',
    children: [
      leaf('energy-transformers', ['TRANSFORMADOR']),
      leaf('energy-entry', ['ENTRADA', 'RELOGIO', 'SUBESTACAO']),
      leaf('energy-stores', ['3F_MEDIDOR']),
      { entityType: 'GROUP', entityKey: 'energy-commonarea', entityValue: 'Área Comum', children: categories },
    ],
  };
}

/** Perfil "aplicado" como o MAIN_VIEW (createGcdrGroupProfileSource + setActiveProfile). */
function appliedProfile(withEscadas: boolean): DeviceClassificationProfile {
  const raw: DeviceClassificationProfile = {
    schemaVersion: 1,
    domains: {
      energy: parseGcdrEntityForest([energyRoot(withEscadas)]).energy!,
      water: DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.water,
      temperature: DEFAULT_DEVICE_CLASSIFICATION_PROFILE.domains.temperature,
    },
  };
  expect(validateProfile(raw)).toEqual([]); // inválido cairia no DEFAULT e mascararia o teste
  return resolveActiveProfile(raw, { warn: () => {}, log: () => {}, error: () => {} } as never);
}

// ---------------------------------------------------------------------------
// Sandbox com as funções reais do controller
// ---------------------------------------------------------------------------
type Slice = { key: string; label: string; color: string; value: number; perc: number };
interface Api {
  isEnergyCategoryVisible(key: string): boolean;
  _energyChartSlices(opts?: { includeOutros?: boolean; includeAreaComum?: boolean }): Slice[];
  buildAreaComumContentEnergy(): string;
}

const CHART_COLORS = {
  climatizacao: '#00C896',
  elevadores: '#5B2EBC',
  escadasRolantes: '#FF6B6B',
  lojas: '#FFC107',
  outros: '#9C27B0',
  areaComum: '#4CAF50',
};

function consumidores(overrides: Record<string, number> = {}) {
  const g = (total: number) => ({ devices: [], total, perc: total / 10 });
  return {
    climatizacao: g(overrides.climatizacao ?? 40),
    elevadores: g(overrides.elevadores ?? 10),
    escadasRolantes: g(overrides.escadasRolantes ?? 0),
    lojas: g(overrides.lojas ?? 30),
    outros: g(overrides.outros ?? 5),
    areaComum: g(overrides.areaComum ?? 15),
    totalGeral: 100,
  };
}

function makeApi(myioUtils: Record<string, unknown>, cons = consumidores(), domain = 'energy'): Api {
  const src = readFileSync(CONTROLLER, 'utf8');
  const body =
    [
      'getWidgetDomain',
      'formatEnergy',
      'getEnergyTaxonomyCategories',
      'isEnergyCategoryVisible',
      '_energyChartSlices',
      '_visibleMainCategoryLabels',
      'buildAreaComumContentEnergy',
    ]
      .map((n) => extractFn(src, n))
      .join('\n') +
    '\nreturn { isEnergyCategoryVisible, _energyChartSlices, buildAreaComumContentEnergy };';
  const win = { MyIOUtils: { formatEnergy: (v: number) => `${v} kWh`, ...myioUtils } };
  const state = { entrada: { total: 100 }, consumidores: cons };
  const self = { ctx: { settings: { DOMAIN: domain } } };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function('STATE', 'window', 'CHART_COLORS', 'console', 'self', body) as (
    s: unknown,
    w: unknown,
    c: unknown,
    k: unknown,
    f: unknown,
  ) => Api;
  return factory(state, win, CHART_COLORS, console, self);
}

/**
 * Executa as 4 funções REAIS de pizza/legenda (renderPieChart, renderChartLegend,
 * renderModalChart, renderModalChartLegend) com Chart.js e jQuery simulados, e
 * devolve o que cada uma desenhou.
 */
function renderAll(opts: { domain: string; myioUtils: Record<string, unknown>; includeBathrooms?: boolean }) {
  const src = readFileSync(CONTROLLER, 'utf8');
  const body =
    'let pieChartInstance = null;\nlet modalPieChartInstance = null;\n' +
    [
      'getWidgetDomain',
      'formatEnergy',
      'getEnergyTaxonomyCategories',
      'isEnergyCategoryVisible',
      '_energyChartSlices',
      'renderPieChart',
      'renderChartLegend',
      'renderModalChart',
      'renderModalChartLegend',
    ]
      .map((n) => extractFn(src, n))
      .join('\n') +
    '\nrenderPieChart();\nrenderModalChart();';

  const charts: Record<string, { labels: string[]; data: number[]; colors: string[] }> = {};
  const legendHtml: Record<string, string[]> = {};
  const jq = (sel: string) => {
    const o = {
      empty: () => ((legendHtml[sel] = []), o),
      append: (html: string) => (legendHtml[sel].push(html), o),
    };
    return o;
  };
  const doc = { getElementById: (id: string) => ({ id, getContext: () => ({ canvasId: id }) }) };
  function Chart(this: unknown, target: { id?: string; canvasId?: string }, config: any) {
    const ds = config.data.datasets[0];
    charts[target.canvasId || target.id || '?'] = {
      labels: config.data.labels,
      data: ds.data,
      colors: ds.backgroundColor,
    };
    return { destroy() {} };
  }
  const silent = { log() {}, warn() {}, error() {} };
  const win = { MyIOUtils: { formatEnergy: (v: number) => `${v} kWh`, ...opts.myioUtils } };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function(
    'STATE', 'STATE_WATER', 'window', 'self', 'document', 'Chart', 'CHART_COLORS', '$J', '$$', 'LogHelper', 'console',
    body,
  )(
    { entrada: { total: 100 }, consumidores: consumidores() },
    { includeBathrooms: Boolean(opts.includeBathrooms) },
    win,
    { ctx: { settings: { DOMAIN: opts.domain } } },
    doc,
    Chart,
    CHART_COLORS,
    jq,
    jq,
    silent,
    silent,
  );
  const labelsOf = (sel: string) =>
    (legendHtml[sel] || []).map((h) => /legend-label">([^<]+):</.exec(h)?.[1] ?? '?');
  return {
    pie: charts.consumptionPieChart,
    modalPie: charts.modalConsumptionPieChart,
    legend: labelsOf('#chartLegend'),
    modalLegend: labelsOf('#modalChartLegend'),
  };
}

const customerSource = { source: 'customer', version: 'v_test', degraded: false, reason: null };
const keys = (slices: Slice[]) => slices.map((s) => s.key);

// ---------------------------------------------------------------------------
describe('ED-1388 — TELEMETRY_INFO segue a taxonomia GCDR do customer', () => {
  it('Taboão (sem escada rolante na taxonomia): sem card, fatia e legenda de Esc. Rolantes', () => {
    const api = makeApi({
      deviceClassificationProfile: appliedProfile(false),
      deviceClassificationProfileSource: customerSource,
    });

    expect(api.isEnergyCategoryVisible('escadasRolantes')).toBe(false);
    expect(api.isEnergyCategoryVisible('climatizacao')).toBe(true);
    expect(api.isEnergyCategoryVisible('elevadores')).toBe(true);
    // Entrada, Lojas, Outros e Área Comum aparecem sempre
    for (const k of ['entrada', 'lojas', 'outros', 'areaComum']) expect(api.isEnergyCategoryVisible(k)).toBe(true);

    // pizza / legenda do modal
    expect(keys(api._energyChartSlices())).toEqual(['climatizacao', 'elevadores', 'lojas', 'outros', 'areaComum']);
    // legenda principal (sem Outros, como antes)
    expect(keys(api._energyChartSlices({ includeOutros: false }))).toEqual([
      'climatizacao',
      'elevadores',
      'lojas',
      'areaComum',
    ]);
    expect(api._energyChartSlices().map((s) => s.label)).not.toContain('Esc. Rolantes');
  });

  it('Taboão: tooltip de Área Comum sem Esc. Rolantes nas linhas nem na fórmula', () => {
    const html = makeApi({
      deviceClassificationProfile: appliedProfile(false),
      deviceClassificationProfileSource: customerSource,
    }).buildAreaComumContentEnergy();

    expect(html).not.toContain('Esc. Rolantes');
    expect(html).toContain('➖ Climatização:');
    expect(html).toContain('➖ Elevadores:');
    expect(html).toContain('Área Comum = Entrada − (Lojas + Climatização + Elevadores + Outros)');
  });

  it('customer com escada rolante na taxonomia continua mostrando o card e a fatia', () => {
    const api = makeApi({
      deviceClassificationProfile: appliedProfile(true),
      deviceClassificationProfileSource: customerSource,
    });
    expect(api.isEnergyCategoryVisible('escadasRolantes')).toBe(true);
    expect(keys(api._energyChartSlices())).toEqual([
      'climatizacao',
      'elevadores',
      'escadasRolantes',
      'lojas',
      'outros',
      'areaComum',
    ]);
    expect(api.buildAreaComumContentEnergy()).toContain(
      'Área Comum = Entrada − (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros)',
    );
  });

  it('taxonomia degradada (piso baked) mantém o comportamento atual', () => {
    const api = makeApi({
      deviceClassificationProfile: resolveActiveProfile(DEFAULT_DEVICE_CLASSIFICATION_PROFILE),
      deviceClassificationProfileSource: { source: 'baked', version: 'b', degraded: true, reason: 'timeout' },
    });
    expect(keys(api._energyChartSlices())).toHaveLength(6);
    expect(api.isEnergyCategoryVisible('escadasRolantes')).toBe(true);
  });

  it('degradado mesmo com um perfil de customer em memória: mostra tudo', () => {
    const api = makeApi({
      deviceClassificationProfile: appliedProfile(false),
      deviceClassificationProfileSource: { source: 'baked', version: 'b', degraded: true, reason: 'x' },
    });
    expect(api.isEnergyCategoryVisible('escadasRolantes')).toBe(true);
  });

  it('sem perfil em MyIOUtils (MAIN_VIEW/lib antigos): mostra tudo, como antes', () => {
    const api = makeApi({});
    expect(keys(api._energyChartSlices())).toHaveLength(6);
  });

  it('usa deviceClassificationProfileRaw quando o perfil aplicado não está disponível', () => {
    const raw = appliedProfile(false);
    const api = makeApi({ deviceClassificationProfileRaw: raw, deviceClassificationProfileSource: customerSource });
    expect(api.isEnergyCategoryVisible('escadasRolantes')).toBe(false);
  });

  it('nunca esconde consumo: categoria ausente na taxonomia mas com total > 0 aparece', () => {
    const api = makeApi(
      { deviceClassificationProfile: appliedProfile(false), deviceClassificationProfileSource: customerSource },
      consumidores({ escadasRolantes: 12 }),
    );
    expect(api.isEnergyCategoryVisible('escadasRolantes')).toBe(true);
    expect(keys(api._energyChartSlices())).toContain('escadasRolantes');
  });
});

// ---------------------------------------------------------------------------
// Revisão do PR #170 — a taxonomia é de ENERGIA; no domínio água nada muda.
// As expectativas abaixo são as saídas de antes do ED-1388 (arrays fixos).
// ---------------------------------------------------------------------------
const ALL_LABELS = ['Climatização', 'Elevadores', 'Esc. Rolantes', 'Lojas', 'Outros', 'Área Comum'];
const ALL_DATA = [40, 10, 0, 30, 5, 15]; // consumidores() — escadas = 0
const ALL_COLORS = [
  CHART_COLORS.climatizacao,
  CHART_COLORS.elevadores,
  CHART_COLORS.escadasRolantes,
  CHART_COLORS.lojas,
  CHART_COLORS.outros,
  CHART_COLORS.areaComum,
];
const taboao = () => ({
  deviceClassificationProfile: appliedProfile(false),
  deviceClassificationProfileSource: customerSource,
});

describe('ED-1388 — domínio água ignora a taxonomia de energia (pizza e legendas como antes)', () => {
  it('água + taxonomia sem escada rolante: pizza, legenda, modal e legenda do modal iguais a antes do PR', () => {
    const out = renderAll({ domain: 'water', myioUtils: taboao() });

    expect(out.pie).toEqual({ labels: ALL_LABELS, data: ALL_DATA, colors: ALL_COLORS });
    expect(out.modalPie).toEqual({ labels: ALL_LABELS, data: ALL_DATA, colors: ALL_COLORS });
    // legenda principal: sem "Outros" (como sempre foi)
    expect(out.legend).toEqual(['Climatização', 'Elevadores', 'Esc. Rolantes', 'Lojas', 'Área Comum']);
    expect(out.modalLegend).toEqual(ALL_LABELS);
  });

  it('água + banheiros (hideAreaComum) + taxonomia sem escada rolante: igual a antes do PR', () => {
    const out = renderAll({ domain: 'water', myioUtils: taboao(), includeBathrooms: true });
    const five = ALL_LABELS.slice(0, 5);

    expect(out.pie).toEqual({ labels: five, data: ALL_DATA.slice(0, 5), colors: ALL_COLORS.slice(0, 5) });
    expect(out.modalPie).toEqual({ labels: five, data: ALL_DATA.slice(0, 5), colors: ALL_COLORS.slice(0, 5) });
    expect(out.legend).toEqual(['Climatização', 'Elevadores', 'Esc. Rolantes', 'Lojas']);
    expect(out.modalLegend).toEqual(five);
  });

  it('água: a regra de visibilidade nunca esconde categoria (Área Comum/tooltips também ficam como antes)', () => {
    const api = makeApi(taboao(), consumidores(), 'water');
    expect(api.isEnergyCategoryVisible('escadasRolantes')).toBe(true);
    expect(keys(api._energyChartSlices())).toHaveLength(6);
  });

  it('energia (Taboão), mesmas funções de render: sem Esc. Rolantes em nenhuma pizza/legenda', () => {
    const out = renderAll({ domain: 'energy', myioUtils: taboao() });
    const expected = ['Climatização', 'Elevadores', 'Lojas', 'Outros', 'Área Comum'];

    expect(out.pie.labels).toEqual(expected);
    expect(out.pie.data).toEqual([40, 10, 30, 5, 15]);
    expect(out.modalPie.labels).toEqual(expected);
    expect(out.legend).toEqual(['Climatização', 'Elevadores', 'Lojas', 'Área Comum']);
    expect(out.modalLegend).toEqual(expected);
  });
});
