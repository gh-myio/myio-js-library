// Format utilities
export { formatEnergy, formatAllInSameUnit } from './format/energy';
export { fmtPerc } from './format/percentage';
export { formatNumberReadable } from './format/numbers';
export {
  formatWater,
  formatWaterVolumeM3,
  formatTankHeadFromCm,
  calcDeltaPercent,
  formatWaterByGroup,
  formatAllInSameWaterUnit
} from './format/water';

// Time/Duration utilities
export {
  formatRelativeTime,
  formatarDuracao,
  formatDuration
} from './format/time';

// Date utilities
export { formatDateToYMD } from './date/ymd';
export { determineInterval } from './date/interval';
export { getSaoPauloISOString } from './date/saoPauloIso';
export { getDateRangeArray } from './date/range';
export { formatDateForInput, parseInputDateToDate } from './date/inputDate';
export { 
  timeWindowFromInputYMD, 
  formatDateWithTimezoneOffset, 
  getSaoPauloISOStringFixed 
} from './date/timeWindow';
export { averageByDay, groupByDay, type TimedValue } from './date/averageByDay';

// CSV utilities
export { exportToCSV } from './csv/singleReport';
export { exportToCSVAll } from './csv/allStores';
export { 
  buildWaterReportCSV, 
  buildWaterStoresCSV, 
  toCSV, 
  type WaterRow, 
  type StoreRow 
} from './csv/waterReports';

// Classification utilities
export { classify } from './classify/energyEntity';
export { 
  classifyWaterLabel, 
  classifyWaterLabels, 
  getWaterCategories, 
  isWaterCategory 
} from './classify/waterLabel';

// General utilities
export { getValueByDatakey, getValueByDatakeyLegacy, findValue, findValueWithDefault } from './utils/getValueByDatakey';

// Device Status utilities
export {
  DeviceStatusType,
  ConnectionStatusType,
  deviceStatusIcons,
  waterDeviceStatusIcons,
  connectionStatusIcons,
  mapDeviceToConnectionStatus,
  mapConnectionStatus,
  mapDeviceStatusToCardStatus,
  shouldFlashIcon,
  isDeviceOffline,
  getDeviceStatusIcon,
  getConnectionStatusIcon,
  isValidDeviceStatus,
  isValidConnectionStatus,
  getDeviceStatusInfo,
  calculateDeviceStatus,
  calculateDeviceStatusWithRanges // RFC-0077: Range-based device status calculation
} from './utils/deviceStatus.js';

// ThingsBoard utilities
export { buildListItemsThingsboardByUniqueDatasource } from './thingsboard/utils/buildListItemsThingsboardByUniqueDatasource';
export { 
  buildMyioIngestionAuth, 
  clearAllAuthCaches, 
  getAuthCacheStats,
  type MyIOAuthConfig,
  type MyIOAuthInstance 
} from './thingsboard/auth/buildMyioIngestionAuth';
export {
  fetchThingsboardCustomerServerScopeAttrs,
  fetchThingsboardCustomerAttrsFromStorage,
  extractMyIOCredentials,
  type ThingsboardCustomerAttrsConfig
} from './thingsboard/api/fetchThingsboardCustomerServerScopeAttrs';
// export {
//   getEntityInfoAndAttributesTB,
//   type TBFetchOptions,
//   type TBEntityInfo
// } from './thingsboard/entity';

// Re-export existing utilities
export { detectDeviceType, getAvailableContexts, addDetectionContext } from './utils/deviceType';
export { addNamespace } from './utils/namespace';
export { fmtPerc as fmtPercLegacy, toFixedSafe } from './utils/numbers';
export { normalizeRecipients } from './utils/strings';

// Codec utilities
export { decodePayload } from './codec/decodePayload';

// Network utilities
//export { http, fetchWithRetry } from './net/http';

// Codec utilities (additional exports)
export { decodePayloadBase64Xor } from './codec/decodePayload';

export { renderCardComponent } from './thingsboard/main-dashboard-shopping/v-4.0.0/card/template-card.js';
export { renderCardComponent as renderCardComponentEnhanced, renderCardComponentV2, renderCardComponentLegacy } from './thingsboard/main-dashboard-shopping/v-4.0.0/card/template-card-v2.js';
export { renderCardComponentHeadOffice } from './thingsboard/main-dashboard-shopping/v-4.0.0/card/head-office';
export { renderCardComponent as renderCardComponentV5, renderCardComponentV5 as renderCardV5 } from './thingsboard/main-dashboard-shopping/v-5.2.0/card/template-card-v5.js';

// MYIO Components - Drag-to-Footer Dock Implementation
export { MyIOSelectionStore, MyIOSelectionStoreClass } from './components/SelectionStore.js';
export { MyIODraggableCard } from './components/DraggableCard.js';
export { MyIOChartModal } from './components/ChartModal.js';
export { MyIOToast } from './components/MyIOToast.js';

// RFC-0084: Real-Time Telemetry Modal
export { openRealTimeTelemetryModal } from './components/RealTimeTelemetryModal';
export type { RealTimeTelemetryParams, RealTimeTelemetryInstance } from './components/RealTimeTelemetryModal';

// Premium Modal Components
export {
  openDashboardPopupEnergy,
  openDashboardPopupReport,
  openDashboardPopupAllReport,
  openDashboardPopup,
  openDashboardPopupWaterTank
} from './components/premium-modals';

// Energy Modal Types
export type {
  OpenDashboardPopupEnergyOptions,
  EnergyModalContext,
  EnergyModalI18n,
  EnergyModalStyleOverrides,
  EnergyModalError
} from './components/premium-modals/energy/openDashboardPopupEnergy';

// Settings Modal Component
export { openDashboardPopupSettings } from './components/premium-modals/settings/openDashboardPopupSettings';
export type {
  OpenDashboardPopupSettingsParams,
  PersistResult,
  SettingsError,
  SettingsEvent,
  TbScope
} from './components/premium-modals/settings/types';

// Water Tank Modal Types
export type {
  OpenDashboardPopupWaterTankOptions,
  WaterTankModalContext,
  WaterTankModalError,
  WaterTankTelemetryData,
  WaterTankDataPoint,
  WaterTankModalI18n,
  WaterTankModalStyleOverrides
} from './components/premium-modals/water-tank/openDashboardPopupWaterTank';

// DateRangePicker - Public API
export { createDateRangePicker, type CreateDateRangePickerOptions, type DateRangeControl, type DateRangeResult } from './components/createDateRangePicker';

// Premium Date Range Input Component
export { createInputDateRangePickerInsideDIV } from './components/createInputDateRangePickerInsideDIV';
export type { 
  CreateInputDateRangePickerInsideDIVParams, 
  DateRangeInputController 
} from './components/createInputDateRangePickerInsideDIV';

// Utils namespace exports
export * as strings from './utils/strings';
export * as numbers from './utils/numbers';

// Demand Modal Component
export {
  openDemandModal,
  type DemandModalParams,
  type DemandModalPdfConfig,
  type DemandModalStyles,
  type DemandModalInstance,
  type TelemetryFetcher
} from './components/DemandModal';

// Goals Panel Component (RFC-0075)
export { openGoalsPanel } from './components/GoalsPanel.js';

// RFC-0085: Temperature Modal Components
export {
  openTemperatureModal,
  openTemperatureComparisonModal,
  openTemperatureSettingsModal,
  // Utility functions
  fetchTemperatureData,
  clampTemperature,
  calculateStats,
  interpolateTemperature,
  aggregateByDay,
  formatTemperature,
  exportTemperatureCSV,
  // Constants
  DEFAULT_CLAMP_RANGE,
  CHART_COLORS
} from './components/temperature';

// RFC-0085: Temperature Modal Types
export type {
  TemperatureModalParams,
  TemperatureModalInstance,
  TemperatureComparisonModalParams,
  TemperatureComparisonModalInstance,
  TemperatureSettingsParams,
  TemperatureSettingsInstance,
  TemperatureDevice,
  TemperatureTelemetry,
  TemperatureStats,
  TemperatureGranularity,
  ClampRange
} from './components/temperature';

// Modal Header Component (Reusable)
export {
  createModalHeader,
  getModalHeaderStyles
} from './components/ModalHeader';

export type {
  ModalHeaderConfig,
  ModalHeaderInstance,
  ModalTheme,
  ExportFormat as ModalExportFormat
} from './components/ModalHeader';

// RFC-0098: Consumption 7 Days Chart Component
export {
  createConsumption7DaysChart,
  createConsumptionModal,
  createConsumptionChartWidget,
  DEFAULT_COLORS as CONSUMPTION_CHART_COLORS,
  DEFAULT_CONFIG as CONSUMPTION_CHART_DEFAULTS,
  THEME_COLORS as CONSUMPTION_THEME_COLORS
} from './components/Consumption7DaysChart';

// RFC-0098: Consumption 7 Days Chart Types
export type {
  Consumption7DaysConfig,
  Consumption7DaysInstance,
  Consumption7DaysData,
  Consumption7DaysColors,
  ConsumptionDataPoint,
  ShoppingDataPoint,
  ChartDomain,
  ChartType as ConsumptionChartType,
  VizMode as ConsumptionVizMode,
  ThemeMode as ConsumptionThemeMode,
  ThemeColors as ConsumptionThemeColors,
  ConsumptionModalConfig,
  ConsumptionModalInstance,
  ConsumptionWidgetConfig,
  ConsumptionWidgetInstance,
  // Ideal range (all domains)
  IdealRangeConfig as ConsumptionIdealRangeConfig,
  // Temperature types
  TemperatureConfig as ConsumptionTemperatureConfig,
  TemperatureReferenceLine as ConsumptionTemperatureReferenceLine,
} from './components/Consumption7DaysChart';

// RFC-0101: Export Data Smart Component
export {
  buildTemplateExport,
  myioExportData,
  // Utility exports
  EXPORT_DEFAULT_COLORS,
  EXPORT_DOMAIN_ICONS,
  EXPORT_DOMAIN_LABELS,
  EXPORT_DOMAIN_UNITS,
  calculateExportStats,
  generateExportFilename,
} from './components/ExportData';

// RFC-0101: Export Data Types
export type {
  ExportDomain,
  ExportFormat,
  ExportType,
  BuildTemplateExportParams,
  ExportConfigTemplate,
  ExportColorsPallet,
  ExportData,
  ExportComparisonData,
  ExportCustomerData,
  ExportGroupData,
  ExportDataInput,
  ExportDataPoint,
  ExportDeviceInfo,
  ExportCustomerInfo,
  ExportStats,
  ExportResult,
  ExportDataInstance,
  ExportOptions,
  ExportProgressCallback,
} from './components/ExportData';

// RFC-0102: Distribution Chart Widget Component
export {
  createDistributionChartWidget,
  // Color management utilities
  DEFAULT_SHOPPING_COLORS,
  DEFAULT_ENERGY_GROUP_COLORS,
  DEFAULT_WATER_GROUP_COLORS,
  DEFAULT_GAS_GROUP_COLORS,
  getDefaultGroupColors,
  assignShoppingColors,
  getShoppingColor,
  getGroupColor,
  getThemeColors as getDistributionThemeColors,
  getHashColor,
} from './components/DistributionChart';

// RFC-0102: Distribution Chart Types
export type {
  DistributionDomain,
  DistributionMode,
  DistributionData,
  GroupColors,
  ShoppingColors,
  DistributionThemeColors,
  DistributionChartConfig,
  DistributionChartInstance,
} from './components/DistributionChart';

// RFC-0103: Power Limits Setup Modal
export {
  openPowerLimitsSetupModal,
} from './components/premium-modals/power-limits';

// RFC-0103: Power Limits Setup Modal Types
export type {
  PowerLimitsModalParams,
  PowerLimitsModalInstance,
  PowerLimitsModalStyles,
  PowerLimitsFormData,
  PowerLimitsError,
  InstantaneousPowerLimits,
  TelemetryTypeLimits,
  DeviceTypeLimits,
  StatusLimits,
  DeviceStatusName,
} from './components/premium-modals/power-limits';

// RFC-0103: Power Limits Setup Modal Constants
export {
  DEVICE_TYPES as POWER_LIMITS_DEVICE_TYPES,
  TELEMETRY_TYPES as POWER_LIMITS_TELEMETRY_TYPES,
  STATUS_CONFIG as POWER_LIMITS_STATUS_CONFIG,
} from './components/premium-modals/power-limits';
