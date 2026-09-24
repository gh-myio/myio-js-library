// premium-modals/internal/report-mode-selector — Consolidado | Diário | Horário
// report-mode selector (RFC-0223), wrapping granularity-selector unchanged.

export { createReportModeSelector } from './ReportModeSelector';
export { REPORT_MODE_SELECTOR_CSS_PREFIX, injectReportModeSelectorStyles } from './styles';
export type {
  ReportMode,
  ReportModeSelectorThemeMode,
  ReportModeSelectorSettings,
  ReportModeSelectorParams,
  ReportModeSelectorInstance,
} from './types';
