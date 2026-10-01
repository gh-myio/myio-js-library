// index.ts
export * from './types';
export { openDashboardPopupEnergy } from './energy/openDashboardPopupEnergy';
export { openDashboardPopupReport } from './report-device/openDashboardPopupReport';
export { openDashboardPopupAllReport } from './report-all/openDashboardPopupAllReport';
export { openDashboardPopup } from './settings/openDashboardPopup';
export { openDashboardPopupWaterTank } from './water-tank/openDashboardPopupWaterTank';

// RFC-0103: Power Limits Setup Modal
export { openPowerLimitsSetupModal } from './power-limits/openPowerLimitsSetupModal';

// RFC-0231 (follow-up): Gateway Modal — "gráfico de Centrais" (probe latency
// history), rewritten to closely mirror
// src/components/temperature/TemperatureModal.ts (see GatewayModal.ts's file
// doc for the exact fidelity target).
export { openGatewayModal } from './gateway';
export type {
  GatewayModalParams,
  GatewayModalInstance,
  GatewayModalLabels,
  GatewayModalSourceConfig,
  GatewayLatencyPoint,
  GatewayLatencyStats,
  GatewayGranularity,
} from './gateway';

// RFC-0231 (follow-up): Gateway Comparison Modal — multi-central connectivity
// comparison, near-1:1 structural port of
// src/components/temperature/TemperatureComparisonModal.ts.
export { openGatewayComparisonModal } from './gateway-comparison';
export type {
  CentralForComparison,
  GatewayComparisonModalParams,
  GatewayComparisonModalInstance,
  GatewayComparisonModalSourceConfig,
} from './gateway-comparison';

// RFC-0231 (follow-up): Central Settings Modal — adapted from
// settings/SettingsModalView.ts for a central/gateway.
export { openCentralSettingsModal, minutesToMs, msToMinutes, validateCentralSettings } from './central-settings';
export type {
  CentralSettingsModalParams,
  CentralSettingsModalInstance,
  CentralSettingsModalLabels,
  CentralSettingsData,
  CentralSettingsValidationError,
  CentralSettingsPersistResult,
} from './central-settings';

// RFC-0112: Welcome Modal Head Office
export { openWelcomeModal } from './welcome/openWelcomeModal';
export type {
  WelcomeModalParams,
  WelcomeModalInstance,
  WelcomePalette,
  WelcomeConfigTemplate,
  WelcomeThemeConfig,
  WelcomeThemeMode,
  ShoppingCard,
  ShoppingCardDeviceCounts,
  UserInfo,
} from './welcome/types';
export {
  DEFAULT_PALETTE,
  DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_SHOPPING_CARDS,
} from './welcome/types';

// RFC-0113: Header Component (moved to ../header per RFC-0128, re-exported for backward compatibility)
export { createHeaderComponent } from '../header/createHeaderComponent';
export { HeaderView } from '../header/HeaderView';
export { HeaderFilterModal } from '../header/HeaderFilterModal';
export type {
  HeaderComponentParams,
  HeaderComponentInstance,
  HeaderConfigTemplate,
  HeaderCardColors,
  CardColorConfig,
  CardKPIs,
  EquipmentKPI,
  EnergyKPI,
  TemperatureKPI,
  WaterKPI,
  Shopping,
  FilterSelection,
  FilterPreset,
  CardType,
  HeaderEventType,
} from '../header/types';
export {
  HEADER_DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_CARD_COLORS as HEADER_DEFAULT_CARD_COLORS,
  HEADER_DEFAULT_LOGO_URL,
} from '../header/types';

// RFC-0115: Footer Component
export { createFooterComponent } from '../footer/createFooterComponent';
export type {
  FooterComponentParams,
  FooterComponentInstance,
  FooterColors,
  FooterThemeMode,
  SelectedEntity as FooterSelectedEntity,
  UnitType as FooterUnitType,
  DateRange as FooterDateRange,
} from '../footer/types';
export { DEFAULT_FOOTER_COLORS } from '../footer/types';

// RFC-0174: Integrations Modal
export { openIntegrationsModal } from './integrations/openIntegrationsModal';
export type {
  IntegrationsModalOptions,
  IntegrationsModalInstance,
  IntegrationsThemeMode,
  IntegrationTab,
  IntegrationTabId,
} from './integrations/types';
export { DEFAULT_INTEGRATION_TABS } from './integrations/types';
