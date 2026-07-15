// components/granularity-selector — seletor de granularidade (tabs 1h / 1d)
// extraído do EnergyModal (RFC-0097) como componente reutilizável da lib.

export { createGranularitySelector } from './createGranularitySelector';
export {
  GRANULARITY_SELECTOR_CSS_PREFIX,
  injectGranularitySelectorStyles,
} from './styles';
export { DEFAULT_GRANULARITY_OPTIONS } from './types';
export type {
  Granularity,
  GranularitySelectorThemeMode,
  GranularitySelectorOption,
  GranularitySelectorTooltip,
  GranularitySelectorSettings,
  GranularitySelectorParams,
  GranularitySelectorInstance,
} from './types';
