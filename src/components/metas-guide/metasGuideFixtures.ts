/**
 * RFC-0227: co-located MOCK fixtures for the Metas × Consumo guided tour.
 *
 * Two static, deterministic datasets — one energy (MWh) + one water (m³) — plus
 * pure derivation helpers. NOTHING here touches the network, Chart.js, GCDR
 * fetchers, `openGoalsCompare`, or `createCustomerGoalsCard`. Fase 1 = static
 * snapshots only (RFC §P0/§4).
 *
 * KPIs and the consolidated Total are DERIVED from the per-bucket series so the
 * illustrative numbers can never diverge (RFC §P1). Tests re-derive them.
 */

import type {
  MetasGuideFixtures,
  MetasGuideSeries,
  MetasGuideShoppingFixture,
} from './types';

/**
 * Series color map — MUST match the RFC-0217 card so the snapshot reads true
 * against the real panel (RFC §2/§5).
 */
export const SERIES_COLORS = {
  realizado: '#2563eb',
  aMinus1: '#94a3b8',
  orcado: '#f59e0b',
  meta: '#7c3aed',
} as const;

/** Fixture illustration years (NOT the live control labels — see RFC §P1). */
export const FIXTURE_YEAR_PREV = 2025;
export const FIXTURE_YEAR_CUR = 2026;

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const sum = (arr: Array<number | null>): number =>
  arr.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);

/** Build a shopping fixture, deriving the period KPIs from the per-bucket series. */
function makeShopping(
  id: string,
  name: string,
  inaugurationDate: string,
  series: MetasGuideSeries,
): MetasGuideShoppingFixture {
  return {
    id,
    name,
    inaugurationDate,
    aMinus1: Math.round(sum(series.aMinus1)),
    realizado: Math.round(sum(series.realizado)),
    orcado: Math.round(sum(series.orcado)),
    meta: Math.round(sum(series.meta)),
    labels: MONTHS.slice(),
    series,
  };
}

/** Sum every shopping into the consolidated Total row (pure). */
export function deriveTotal(fx: Pick<MetasGuideFixtures, 'shoppings'>): {
  aMinus1: number;
  realizado: number;
  orcado: number;
  meta: number;
} {
  return fx.shoppings.reduce(
    (acc, s) => ({
      aMinus1: acc.aMinus1 + s.aMinus1,
      realizado: acc.realizado + s.realizado,
      orcado: acc.orcado + s.orcado,
      meta: acc.meta + s.meta,
    }),
    { aMinus1: 0, realizado: 0, orcado: 0, meta: 0 },
  );
}

/**
 * Deviation chips for section 6 (pure). Signed ratios, e.g. +0.08 = 8% above.
 * `vsRealizado` compares Orçado to Realizado (illustrative cross-series read).
 */
export function computeChips(s: MetasGuideShoppingFixture): {
  vsAMinus1: number;
  vsMeta: number;
  vsOrcado: number;
  vsRealizado: number;
} {
  return {
    vsAMinus1: s.aMinus1 ? s.realizado / s.aMinus1 - 1 : 0,
    vsMeta: s.meta ? s.realizado / s.meta - 1 : 0,
    vsOrcado: s.orcado ? s.realizado / s.orcado - 1 : 0,
    vsRealizado: s.realizado ? s.orcado / s.realizado - 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Energy dataset (MWh) — 3 shoppings. 8 realized months + 4 pending (null).
// ---------------------------------------------------------------------------

const ENERGY_SHOPPINGS: MetasGuideShoppingFixture[] = [
  makeShopping('mock-sh-1', 'Shopping Aurora', '2015-03-12', {
    aMinus1: [820, 780, 860, 900, 880, 950, 1010, 990, 940, 910, 870, 900],
    realizado: [860, 815, 905, 940, 930, 995, 1055, 1030, null, null, null, null],
    orcado: [840, 800, 880, 920, 900, 970, 1030, 1010, 960, 930, 890, 920],
    meta: [800, 760, 840, 880, 860, 930, 990, 970, 920, 890, 850, 880],
  }),
  makeShopping('mock-sh-2', 'Shopping Bosque', '2019-08-01', {
    aMinus1: [520, 500, 545, 570, 560, 600, 640, 630, 595, 580, 555, 575],
    realizado: [505, 485, 528, 552, 545, 585, 620, 612, null, null, null, null],
    orcado: [530, 510, 555, 580, 570, 610, 650, 640, 605, 590, 565, 585],
    meta: [510, 490, 535, 560, 550, 590, 630, 620, 585, 570, 545, 565],
  }),
  makeShopping('mock-sh-3', 'Shopping Cristal', '2022-11-20', {
    aMinus1: [310, 300, 325, 340, 335, 360, 385, 380, 355, 345, 330, 345],
    realizado: [335, 322, 350, 366, 360, 388, 414, 408, null, null, null, null],
    orcado: [315, 305, 330, 345, 340, 365, 390, 385, 360, 350, 335, 350],
    meta: [305, 295, 320, 335, 330, 355, 380, 375, 350, 340, 325, 340],
  }),
];

export const ENERGY_FIXTURES: MetasGuideFixtures = {
  domain: 'energy',
  unit: 'MWh',
  fixtureYearPrev: FIXTURE_YEAR_PREV,
  fixtureYearCur: FIXTURE_YEAR_CUR,
  shoppings: ENERGY_SHOPPINGS,
  total: deriveTotal({ shoppings: ENERGY_SHOPPINGS }),
};

// ---------------------------------------------------------------------------
// Water dataset (m³) — 2 shoppings.
// ---------------------------------------------------------------------------

const WATER_SHOPPINGS: MetasGuideShoppingFixture[] = [
  makeShopping('mock-wsh-1', 'Shopping Aurora', '2015-03-12', {
    aMinus1: [4200, 3980, 4350, 4510, 4460, 4720, 4980, 4900, 4650, 4530, 4380, 4470],
    realizado: [4020, 3820, 4180, 4330, 4290, 4540, 4790, 4710, null, null, null, null],
    orcado: [4300, 4080, 4450, 4610, 4560, 4820, 5080, 5000, 4750, 4630, 4480, 4570],
    meta: [4150, 3940, 4300, 4450, 4400, 4650, 4900, 4820, 4580, 4470, 4320, 4410],
  }),
  makeShopping('mock-wsh-2', 'Shopping Bosque', '2019-08-01', {
    aMinus1: [2600, 2480, 2700, 2790, 2760, 2920, 3080, 3030, 2870, 2800, 2710, 2760],
    realizado: [2520, 2410, 2620, 2705, 2680, 2830, 2985, 2940, null, null, null, null],
    orcado: [2650, 2530, 2750, 2840, 2810, 2970, 3130, 3080, 2920, 2850, 2760, 2810],
    meta: [2560, 2450, 2660, 2745, 2720, 2870, 3020, 2975, 2820, 2750, 2660, 2710],
  }),
];

export const WATER_FIXTURES: MetasGuideFixtures = {
  domain: 'water',
  unit: 'm³',
  fixtureYearPrev: FIXTURE_YEAR_PREV,
  fixtureYearCur: FIXTURE_YEAR_CUR,
  shoppings: WATER_SHOPPINGS,
  total: deriveTotal({ shoppings: WATER_SHOPPINGS }),
};

/** Default dataset shown by the guide (energy). */
export const DEFAULT_FIXTURES = ENERGY_FIXTURES;
