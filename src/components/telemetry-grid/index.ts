/**
 * RFC-0121: TelemetryGrid Component
 * Unified device cards grid component for energy, water, and temperature domains
 */

// Factory function
export { createTelemetryGridComponent } from './createTelemetryGridComponent';

// View and Controller classes
export { TelemetryGridView } from './TelemetryGridView';
export { TelemetryGridController } from './TelemetryGridController';

// Types
export type {
  // Core types
  TelemetryDomain,
  TelemetryContext,
  ThemeMode,
  SortMode,

  // Device types
  TelemetryDevice,

  // State types
  FilterState,
  TelemetryStats,

  // Config types
  DomainConfig,
  ContextConfig,
  TelemetryConfigTemplate,

  // Shopping
  Shopping,

  // Callback types
  CardAction,
  OnCardClickCallback,
  OnCardActionCallback,
  OnDeviceSelectCallback,
  OnFilterChangeCallback,
  OnStatsUpdateCallback,
  OnContextChangeCallback,

  // Component types
  TelemetryGridParams,
  TelemetryGridInstance,

  // Header types
  HeaderGridConfig,
  HeaderController,

  // Filter modal types
  FilterTab,
  SortOption,
  FilterModalConfig,
  FilterModalController,

  // Event types
  TelemetryGridEventType,
  TelemetryGridEventHandler,
} from './types';

// Constants
export {
  DOMAIN_CONFIG,
  CONTEXT_CONFIG,
  mapContextToOrchestrator,
  DEFAULT_FILTER_TABS,
  getSortOptions,
} from './types';

// Styles
export {
  TELEMETRY_GRID_STYLES,
  injectTelemetryGridStyles,
  removeTelemetryGridStyles,
} from './styles';
