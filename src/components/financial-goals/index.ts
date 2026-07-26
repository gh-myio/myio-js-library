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
