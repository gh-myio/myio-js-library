/**
 * RFC-0237 — Inventory Panel v2: pure inventory logic (no DOM).
 * Consumed by `src/thingsboard/inventory-panel/v2.0.0` through `window.MyIOLibrary`.
 */

export * from './types';
export {
  INVENTORY_ENTITY_FIELDS,
  INVENTORY_SERVER_ATTRIBUTES,
  buildEntitiesQueryBody,
  isBlank,
  toText,
  toBooleanStrict,
  toTimestamp,
  parseEntityRow,
} from './loader';
export type { ParseOptions } from './loader';
export { resolveLifecycle } from './lifecycle';
export { INVENTORY_RULES, getInventoryRule, isRecognizedProfile, buildRuleContext, evaluateDevice } from './rules';
export type { RuleContext, RuleDefinition, BuildRuleContextOptions } from './rules';
export {
  NO_CUSTOMER_KEY,
  UNCLASSIFIED_PROFILE_LABEL,
  FILTER_DIMENSIONS,
  buildInventoryRows,
  createEmptyFilters,
  normalizeText,
  dimensionValues,
  matchesFilters,
  applyFilters,
  facetCounts,
  displayName,
  compareRows,
  groupKey,
  getVisibleGroups,
  getVisibleRows,
} from './filters';
export type {
  InventoryFilters,
  FilterDimension,
  CadastroFilterValue,
  AtividadeFilterValue,
  InventorySort,
  InventoryGroupBy,
  InventoryGroup,
} from './filters';
export { buildDashboardSummary, customerKeyLabel } from './dashboard';
export type { InventoryDashboard, CustomerProblems, RuleCount, CustomerRuleMatrix, DashboardOptions } from './dashboard';
export { formatDeviceLabel } from './formatLabel';
export type { DeviceLabelParts } from './formatLabel';
export {
  CADASTRO_LABELS,
  ATIVIDADE_LABELS,
  LIFECYCLE_LABELS,
  DOMAIN_LABELS,
  INVENTORY_EXPORT_COLUMNS,
  INVENTORY_PDF_COLUMN_KEYS,
  formatDateTime,
  failedRulesText,
  pickColumns,
  toExportMatrix,
  guardFormula,
  toCSV,
  summarizeFilters,
  exportFileName,
  buildExportSummary,
} from './exportRows';
export type { ExportColumn, ExportMatrix, ExportSummaryMeta } from './exportRows';
