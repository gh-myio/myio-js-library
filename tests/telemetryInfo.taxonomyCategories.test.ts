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

function makeApi(myioUtils: Record<string, unknown>, cons = consumidores()): Api {
  const src = readFileSync(CONTROLLER, 'utf8');
  const body =
    [
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
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function('STATE', 'window', 'CHART_COLORS', 'console', body) as (
    s: unknown,
    w: unknown,
    c: unknown,
    k: unknown,
  ) => Api;
  return factory(state, win, CHART_COLORS, console);
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
