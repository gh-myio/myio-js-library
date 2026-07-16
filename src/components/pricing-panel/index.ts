// RFC-0222 — Customer Energy/Water Pricing Panel (prototype). Barrel export.
export { openPricingPanel } from './openPricingPanel';
export {
  DOMAIN_LABEL,
  CATEGORY_LABEL,
  unitLabel,
  formatBRL,
  parseBRL,
  isPricingAllowed,
  resolveCustomerId,
  upsertEntry,
  removeEntryByBounds,
  computePricingKpis,
  auditFor,
  entryBounds,
  intervalsOverlap,
  sameScope,
  periodIdentity,
  formatPeriodLabel,
} from './helpers';
export type { UpsertResult, RemoveResult, MutationOptions } from './helpers';
export type {
  OpenPricingPanelParams,
  PricingCustomerRef,
  PricingDomain,
  PricingCategory,
  PricingEntry,
  PricingPeriodType,
  PricingAuditAction,
  PricingAuditRecord,
  PricingKpis,
  PricingPanelEvent,
  PricingPanelHandle,
  PricingPanelThemeSource,
} from './types';
