/**
 * Lightweight tooltip-only entry point (`myio-js-library/tooltips`).
 *
 * Lets consumers that only need the premium tooltips avoid pulling the
 * full library bundle. Keep this barrel free of heavy imports — everything
 * here must stay self-contained (no components/, no jspdf, no services/).
 */
export { InfoTooltip } from './utils/InfoTooltip';
export type { InfoTooltipOptions } from './utils/InfoTooltip';
export { ColumnSummaryTooltip } from './utils/ColumnSummaryTooltip';
export type { ColumnSummaryDevice, ColumnSummaryData } from './utils/ColumnSummaryTooltip';
