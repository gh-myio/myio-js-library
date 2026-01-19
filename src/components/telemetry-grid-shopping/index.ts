/**
 * RFC-0145: TelemetryGridShopping Component
 * Shopping-style device grid with filters, search, and sorting
 */

export { createTelemetryGridShoppingComponent } from './createTelemetryGridShoppingComponent';

export type {
  TelemetryGridShoppingParams,
  TelemetryGridShoppingInstance,
  TelemetryDevice,
  TelemetryDomain,
  TelemetryContext,
  ThemeMode,
  SortMode,
  FilterState,
  TelemetryStats,
  CardAction,
  OnCardActionCallback,
  OnStatsUpdateCallback,
  OnFilterChangeCallback,
  OnSearchChangeCallback,
  DomainConfig,
  ContextConfig,
} from './types';

export {
  DOMAIN_CONFIG,
  CONTEXT_CONFIG,
  ONLINE_STATUSES,
  OFFLINE_STATUSES,
  WAITING_STATUSES,
  getDeviceStatusCategory,
} from './types';
