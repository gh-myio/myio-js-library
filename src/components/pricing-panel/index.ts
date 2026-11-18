// RFC-0222 — Customer Energy/Water Pricing Panel (prototype). Barrel export.
export { openPricingPanel } from './openPricingPanel';
export {
  DOMAIN_LABEL,
  categoryLabel,
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
  TariffCategory,
  PricingEntry,
  PricingPeriodType,
  PricingAuditAction,
  PricingAuditRecord,
  PricingKpis,
  PricingPanelEvent,
  PricingPanelHandle,
  PricingPanelThemeSource,
  TariffApiPanelConfig,
} from './types';

// RFC-0228 A1 — GCDR hourly-tariff client + panel↔wire adapter.
export {
  TariffApiClient,
  TariffApiError,
  createTariffApiClient,
} from './tariffApiClient';
export type {
  TariffApiClientConfig,
  TariffSelector,
  TariffBucket,
  TariffTreeNode,
  TariffTreeResponse,
  TariffGranularity,
  WireDomain,
  WireCategory,
  WireTariffCategory,
} from './tariffApiClient';
export {
  TariffApiAdapter,
  createTariffApiAdapter,
  PANEL_TO_WIRE_DOMAIN,
  WIRE_TO_PANEL_DOMAIN,
  panelDomainToWire,
  wireDomainToPanel,
  normalizePriceString,
  priceToNumber,
  isLeapYear,
  daysInMonthYear,
  assertValidCivilDate,
  eachDate,
  normalizeBand,
  bandSelector,
  panelEntryToBand,
  bandToPanelEntry,
  expandDayToHourBuckets,
  expandBandHours,
  bandDateBounds,
  expandBandToHourBucketsByYear,
  collapseHoursToBands,
  collapseTreeToBands,
} from './tariffApiAdapter';
export type {
  TariffApiAdapterOptions,
  TariffBand,
  TariffBandInput,
  TariffBandPeriod,
} from './tariffApiAdapter';
