/**
 * RFC-0227: Metas × Consumo — "?" Help Button + Mock-Data Guided Tour (Wizard).
 *
 * Self-contained, reusable library component. The widget calls
 * `MyIOLibrary.openMetasGuide(...)` and passes only theme / persistKey /
 * callbacks — never fixture or adapter internals.
 *
 * @module metas-guide
 */

export { openMetasGuide } from './openMetasGuide';

export {
  DEFAULT_FIXTURES,
  ENERGY_FIXTURES,
  WATER_FIXTURES,
  SERIES_COLORS,
  FIXTURE_YEAR_PREV,
  FIXTURE_YEAR_CUR,
  deriveTotal,
  computeChips,
} from './metasGuideFixtures';

export type {
  MetasGuideOptions,
  MetasGuideHandle,
  MetasGuideTheme,
  MetasGuideFixtures,
  MetasGuideShoppingFixture,
  MetasGuideSeries,
} from './types';
