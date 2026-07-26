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
