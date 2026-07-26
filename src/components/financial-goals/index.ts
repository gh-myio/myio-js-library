// RFC-0228 F0 — Financial Goals money foundation. Barrel export.
// Pure types/client/formatters (no UI); the shared spine A4/A2a/A3 consume.

// Naming bridge + normalized money types (resolves the 3-way `budget` collision).
export {
  MONEY_REQUIRES_DEVICE_GRANULARITY,
  normalizeMoneyBlock,
  normalizeBudgetBlock,
} from './moneyTypes';
export type {
  MoneyDomain,
  QuantityGoal,
  GoalTreeNode,
  MonetaryProjection,
  CurrencyBudget,
  BudgetVerdict,
  BudgetOverlay,
  MoneyOverlay,
  UncategorizedDevice,
  TariffCoverageGaps,
  RawMoneyBlock,
  RawBudgetBlock,
} from './moneyTypes';

// Goals-money API client (mirrors the A1 tariff client).
export { GoalsMoneyClient, GoalsMoneyApiError, createGoalsMoneyClient } from './goalsMoneyClient';
export type {
  GoalsMoneyClientConfig,
  GoalSelector,
  GoalGranularity,
  CurrencyBudgetResponse,
} from './goalsMoneyClient';

// Money display formatting (decimal-string in, pt-BR BRL out).
export {
  DASH,
  formatBRL as formatMoneyBRL,
  formatBRLDelta,
  formatDeltaPct,
  computeDeltaPct,
  signOf,
} from './moneyFormat';

// A4 — Honest coverage UI (reusable renderer consumed by A2a/A3).
export {
  renderCoverageView,
  buildCoverageHTML,
  coveragePercentLabel,
} from './coverageView';
export type { CoverageViewOptions } from './coverageView';
export { injectCoverageStyles, COVERAGE_STYLE_ID } from './coverageStyles';

// A2a — R$ money overlay row for one Metas × Consumo card (pilot). Renders the R$
// row when coverage is complete; defers to A4 (`renderCoverageView`) otherwise.
export {
  renderFinancialIndicators,
  buildFinancialRowHTML,
  resolveMoneyRowValues,
  subtractDecimals,
} from './financialIndicators';
export type {
  FinancialIndicatorsOptions,
  FinancialMoneyValues,
  FinancialChipColors,
  FinancialValueColors,
} from './financialIndicators';

// A3 — Native CURRENCY budget view (Target/Projected + DEC-6 verdict). Renders the
// native R$ budget beside the A2a R$ row; withholds the verdict while coverage is
// incomplete (defers to A4 for the why).
export {
  renderBudgetView,
  buildBudgetHTML,
  buildVerdictHTML,
  resolveBudget,
} from './budgetView';
export type {
  BudgetViewOptions,
  BudgetValueColors,
  BudgetChipColors,
} from './budgetView';

// A5a — Device tariff-category management UI. Depends only on the injectable
// DeviceCategoryPort SEAM (B6 implements it later); never on a concrete device
// HTTP shape. Reuses A1's category map (tariffApiAdapter) for panel-term display.
export {
  createFakeDeviceCategoryPort,
  createHttpDeviceCategoryPort,
  DeviceCategoryConflictError,
} from './deviceCategoryPort';
export type {
  DeviceCategory,
  DeviceCategoryRow,
  DeviceCategoryPort,
  FakeDeviceSeed,
  FakeDeviceCategoryPortOptions,
  FakeDeviceCategoryPortHandle,
  HttpDeviceCategoryPortConfig,
} from './deviceCategoryPort';
export {
  openDeviceCategoryPanel,
  createCoverageDeepLink,
  deviceCategoryLabel,
  deviceCategoryToPanelTerm,
  panelTermToDeviceCategory,
} from './deviceCategoryPanel';
export type {
  OpenDeviceCategoryPanelParams,
  DeviceCategoryPanelHandle,
  DeviceCategoryFilter,
} from './deviceCategoryPanel';
export {
  injectDeviceCategoryStyles,
  DEVICE_CATEGORY_STYLE_ID,
} from './deviceCategoryStyles';

// A6 — R$ money column for aggregate report rows/totals (AllReportModal + energy
// summaries). Reuses A2a/F0 formatting + A4 coverage under the DEC-8 rounding
// contract; a null config yields a disabled (byte-identical-when-off) column.
export {
  createReportMoneyColumn,
  isMoneyColumnConfident,
  sumMoneyDecimals,
  decimalStringToCents,
  centsToDecimalString,
  REPORT_MONEY_HEADER,
} from './reportMoneyColumn';
export type {
  ReportMoneyColumnConfig,
  ReportMoneyColumn,
  ReportMoneyTotal,
} from './reportMoneyColumn';

// A7 — per-consumer realized-vs-goal variance in R$ (RFC-0182 rows / RFC-0217 card).
// Reuses A2a's `subtractDecimals` + A6's `decimalStringToCents`; honors DEC-6
// withholding (indeterminate/incomplete → "Variação indisponível", never green/red).
// Naming bridge: `monetaryProjection` (realized R$) vs `currencyBudget` (goal R$) —
// never the quantity `budget` prop.
export {
  computeMoneyVariance,
  buildMoneyVarianceHTML,
  renderMoneyVariance,
  createMoneyVarianceColumn,
  resolveGoalAmount,
  overlayWithholdsVerdict,
  VARIANCE_LABEL_ABOVE,
  VARIANCE_LABEL_BELOW,
  VARIANCE_LABEL_ONTARGET,
  VARIANCE_LABEL_WITHHELD,
  MONEY_VARIANCE_HEADER,
} from './moneyVariance';
export type {
  MoneyVarianceInput,
  MoneyVarianceResult,
  MoneyVarianceVerdict,
  MoneyVarianceOptions,
  MoneyVarianceColumn,
  MoneyVarianceColumnConfig,
} from './moneyVariance';
