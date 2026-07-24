/**
 * RFC-0227: Metas × Consumo — "?" Help Button + Mock-Data Guided Tour (Wizard)
 *
 * Public types for the self-contained `openMetasGuide` wizard.
 *
 * The guide runs 100% on self-contained MOCK fixtures — it NEVER performs a
 * network request. See `metasGuideFixtures.ts` for the illustrative data.
 */

/** Theme inherited from the host panel (Metas × Consumo `--gc-*` vars / `GP`). */
export interface MetasGuideTheme {
  /** Primary accent (e.g. `GP.accent`). */
  accent: string;
  /** Darker accent used on the header gradient (e.g. `GP.accentDark`). */
  accentDark: string;
  /** Foreground color used over the accent (e.g. `GP.accentText`). */
  accentText: string;
  /** Light / dark surface mode. */
  mode: 'light' | 'dark';
}

/** Time-series (per bucket) for one mock shopping, for the mini-chart. */
export interface MetasGuideSeries {
  /** A-1 (previous year) consumption, per bucket. */
  aMinus1: number[];
  /** Realizado (current year) consumption, per bucket; `null` = not yet realized. */
  realizado: (number | null)[];
  /** Orçado (budget) line, per bucket. */
  orcado: number[];
  /** Meta (adjusted budget) line, per bucket. */
  meta: number[];
}

/** One fictitious shopping used to illustrate the panel. */
export interface MetasGuideShoppingFixture {
  /** Stable mock id (e.g. `mock-sh-1`). */
  id: string;
  /** Fictitious display name (e.g. `Shopping Aurora`). */
  name: string;
  /** `YYYY-MM-DD` — illustrates the "Data de Inauguração" ordering control. */
  inaugurationDate: string;
  /** Period KPI: A-1 (previous year) — energy in MWh, water in m³. */
  aMinus1: number;
  /** Period KPI: Realizado (current year). */
  realizado: number;
  /** Period KPI: Orçado (raw budget value). */
  orcado: number;
  /** Period KPI: Meta (adjusted value = Orçado × margin). */
  meta: number;
  /** Bucket labels shared by the 4 series (e.g. `['Jan','Fev',...]`). */
  labels: string[];
  /** Per-bucket series for the mini-chart. */
  series: MetasGuideSeries;
}

/** A complete mock dataset for one domain (energy or water). */
export interface MetasGuideFixtures {
  domain: 'energy' | 'water';
  unit: 'MWh' | 'm³';
  /**
   * Fixture years used ONLY to illustrate the snapshots. Live control labels
   * are derived dynamically from `new Date().getFullYear()` in the tour copy
   * (RFC §P1 — "Ano anterior / Ano atual", never hardcoded).
   */
  fixtureYearPrev: number;
  fixtureYearCur: number;
  shoppings: MetasGuideShoppingFixture[];
  /**
   * Consolidated "Total" row. MUST equal the sum of `shoppings` (see
   * `deriveTotal`). Tests derive from `shoppings` so numbers never diverge.
   */
  total: { aMinus1: number; realizado: number; orcado: number; meta: number };
}

/** Options accepted by `openMetasGuide`. The widget passes only these. */
export interface MetasGuideOptions {
  /** Inherit the host panel theme; fallback = Academy purple. */
  theme?: Partial<MetasGuideTheme>;
  /** Override the mock dataset (default = embedded energy + water fixtures). */
  mockData?: MetasGuideFixtures;
  /**
   * Water dataset override (used by the domain section). Defaults to the
   * embedded water fixtures.
   */
  mockDataWater?: MetasGuideFixtures;
  /**
   * Enables the opt-in "não mostrar novamente" checkbox. When present AND the
   * user ticks the box, the guide writes this key to `localStorage`. Without a
   * `persistKey`, or without the tick, the guide NEVER writes.
   * e.g. `myio:metas-guide:seen:v1`
   */
  persistKey?: string;
  /** Called after the guide fully closes. */
  onClose?: () => void;
  /** Called when the user reaches "Concluir" on the last section. */
  onFinish?: () => void;
}

/** Handle returned by `openMetasGuide` — compatible with `OnboardModalHandle`. */
export interface MetasGuideHandle {
  /** Close and dispose the guide (restores focus to the opener). */
  close: () => void;
  /** Replace the body of the current section (compat shim). */
  setContent: (content: string | HTMLElement) => void;
  /** Root modal element, or `null` once closed. */
  getElement: () => HTMLElement | null;
  /** Jump to a section by 0-based index. */
  goToStep: (index: number) => void;
}
