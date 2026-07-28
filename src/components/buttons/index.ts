// components/buttons — factory de botões MYIO
// Export buttons (PDF/CSV/XLS) padrão MAN4 + action-button (RFC-0158, movido para cá).

export { createExportButton } from './createExportButton';
export { createPdfButton } from './button-pdf';
export { createCsvButton } from './button-csv';
export { createXlsButton } from './button-xls';
export { EXPORT_BUTTON_CSS_PREFIX, injectExportButtonStyles } from './styles';
export {
  EXPORT_BUTTON_KIND_DEFAULTS,
  EXPORT_BUTTON_CUSTOM_COLORS,
} from './types';
export type {
  ExportButtonKind,
  ExportButtonThemeMode,
  ExportButtonColors,
  ExportButtonTooltip,
  ExportButtonSettings,
  ExportButtonParams,
  ExportButtonInstance,
} from './types';

// action-button (movido de src/components/action-button)
export * from './action-button';
