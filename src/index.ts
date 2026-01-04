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
  temperatureDeviceStatusIcons,
  connectionStatusIcons,
  mapDeviceToConnectionStatus,
  normalizeConnectionStatus, // RFC-0109: Normalize raw connectionStatus values
  isTelemetryStale, // RFC-0110: Check if telemetry is stale based on timestamps (preferred)
  isConnectionStale, // @deprecated - use isTelemetryStale instead
  mapConnectionStatus,
  mapDeviceStatusToCardStatus,
  shouldFlashIcon,
  isDeviceOffline,
  getDeviceStatusIcon,
  getConnectionStatusIcon,
  isValidDeviceStatus,
  isValidConnectionStatus,
  getDeviceStatusInfo,
  calculateDeviceStatus, // RFC-0110: Unified device status calculation with telemetry timestamps
  calculateDeviceStatusWithRanges // @deprecated - use calculateDeviceStatus with ranges parameter
} from './utils/deviceStatus.js';

// RFC-0109: Device Item Factory utilities
export {
  DomainType,
  DeviceCategory,
  isTankDevice,
  isHydrometerDevice,
  isTemperatureDevice,
  isEnergyDevice,
  getDomainFromDeviceType,
  extractPowerLimitsForDevice,
  createDeviceItem,
  createDeviceItemsFromMap,
  recalculateDeviceStatus
} from './utils/deviceItem.js';

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

// SuperAdmin Detection Utilities (RFC-0104)
export {
  fetchCurrentUserInfo,
  detectSuperAdminMyio,
  detectSuperAdminHolding,
  getAnnotationPermissions,
  canModifyAnnotation
} from './utils/superAdminUtils';

// Annotation Types (RFC-0104)
export type {
  AnnotationType,
  ImportanceLevel,
  AnnotationStatus,
  AuditAction,
  UserInfo,
  AuditEntry,
  Annotation,
  LogAnnotationsAttribute,
  AnnotationFilterState,
  PaginationState,
  PermissionSet,
  NewAnnotationData
} from './components/premium-modals/settings/annotations/types';

export {
  ANNOTATION_TYPE_LABELS,
  ANNOTATION_TYPE_LABELS_EN,
  IMPORTANCE_LABELS,
  IMPORTANCE_LABELS_EN,
  STATUS_LABELS,
  STATUS_LABELS_EN,
  ANNOTATION_TYPE_COLORS,
  IMPORTANCE_COLORS,
  STATUS_COLORS
} from './components/premium-modals/settings/annotations/types';

// RFC-0104: Annotation Indicator Component
export {
  AnnotationIndicator,
  createAnnotationIndicator
} from './utils/AnnotationIndicator';

export type {
  AnnotationIndicatorConfig,
  AnnotationIndicatorTheme,
  AnnotationSummary
} from './utils/AnnotationIndicator';

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

// RFC-0112: Welcome Modal Head Office
export { openWelcomeModal } from './components/premium-modals/welcome/openWelcomeModal';
export type {
  WelcomeModalParams,
  WelcomeModalInstance,
  WelcomePalette,
  ShoppingCard,
  ShoppingCardDeviceCounts,
  ShoppingCardMetaCounts,
  UserInfo as WelcomeUserInfo
} from './components/premium-modals/welcome/types';
export { DEFAULT_PALETTE as WELCOME_DEFAULT_PALETTE, DEFAULT_SHOPPING_CARDS } from './components/premium-modals/welcome/types';

// RFC-0115: Footer Component
export { createFooterComponent } from './components/footer';
export type {
  FooterComponentParams,
  FooterComponentInstance,
  FooterColors,
  FooterThemeMode,
  FooterThemeConfig,
  FooterConfigTemplate,
  SelectedEntity as FooterSelectedEntity,
  UnitType as FooterUnitType,
} from './components/footer';
export {
  DEFAULT_FOOTER_COLORS,
  DEFAULT_DARK_THEME as FOOTER_DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME as FOOTER_DEFAULT_LIGHT_THEME,
  DEFAULT_CONFIG_TEMPLATE as FOOTER_DEFAULT_CONFIG_TEMPLATE,
} from './components/footer';

// RFC-0113: Header Component
export { createHeaderComponent } from './components/premium-modals/header/createHeaderComponent';
export { HeaderView } from './components/premium-modals/header/HeaderView';
export type {
  HeaderComponentParams,
  HeaderComponentInstance,
  HeaderConfigTemplate,
  HeaderCardColors,
  CardColorConfig as HeaderCardColorConfig,
  CardKPIs,
  EquipmentKPI,
  EnergyKPI,
  TemperatureKPI,
  WaterKPI,
  Shopping as HeaderShopping,
  FilterSelection as HeaderFilterSelection,
  FilterPreset as HeaderFilterPreset,
  CardType as HeaderCardType,
  HeaderEventType,
} from './components/premium-modals/header/types';
export {
  HEADER_DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_CARD_COLORS as HEADER_DEFAULT_CARD_COLORS,
  HEADER_DEFAULT_LOGO_URL,
} from './components/premium-modals/header/types';

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

// Temperature Range Tooltip (Reusable UI component)
export { TempRangeTooltip } from './utils/TempRangeTooltip';
export type { TempEntityData, TempStatus, TempStatusResult } from './utils/TempRangeTooltip';

// Energy Range Tooltip (Reusable UI component)
export { EnergyRangeTooltip } from './utils/EnergyRangeTooltip';
export type { EnergyEntityData, EnergyStatus, EnergyStatusResult, PowerRange, PowerRanges } from './utils/EnergyRangeTooltip';

// RFC-0105: Energy Summary Tooltip (Dashboard summary on hover)
export { EnergySummaryTooltip } from './utils/EnergySummaryTooltip';
export { WaterSummaryTooltip } from './utils/WaterSummaryTooltip';
export { InfoTooltip } from './utils/InfoTooltip';
export { ModalHeader } from './utils/ModalHeader';
export type {
  ModalHeaderOptions,
  ModalHeaderHandlers,
  ModalHeaderControllerOptions,
  ModalHeaderController,
} from './utils/ModalHeader';
export type { DashboardEnergySummary, CategorySummary, StatusSummary, DeviceInfo } from './utils/EnergySummaryTooltip';
export type { DashboardWaterSummary, WaterCategorySummary } from './utils/WaterSummaryTooltip';

// RFC-0110: Device Comparison Tooltip (Premium device comparison on percentage hover)
export { DeviceComparisonTooltip } from './utils/DeviceComparisonTooltip';
export type { DeviceComparisonData } from './utils/DeviceComparisonTooltip';

// RFC-0110: Temp Comparison Tooltip (Premium temperature comparison with average)
export { TempComparisonTooltip } from './utils/TempComparisonTooltip';
export type { TempComparisonData } from './utils/TempComparisonTooltip';

// Temp Sensor Summary Tooltip (Widget temperature sensors summary)
export { TempSensorSummaryTooltip } from './utils/TempSensorSummaryTooltip';
export type { TempSensorSummaryData, TempSensorDevice } from './utils/TempSensorSummaryTooltip';

// RFC-0107: Contract Summary Tooltip (Shopping Dashboard contract status)
export { ContractSummaryTooltip } from './utils/ContractSummaryTooltip';
export type { ContractSummaryData, ContractDomainCounts, ContractTemperatureCounts } from './utils/ContractSummaryTooltip';

// RFC-0112 Rev-001: Users Summary Tooltip (Welcome Modal meta icons)
export { UsersSummaryTooltip } from './utils/UsersSummaryTooltip';
export type { UsersSummaryData, UsersByRole, UserInfo as UsersTooltipUserInfo } from './utils/UsersSummaryTooltip';

// RFC-0116: Alarms Summary Tooltip (Not yet released - placeholder)
export { AlarmsSummaryTooltip } from './utils/AlarmsSummaryTooltip';
export type { AlarmsSummaryData, AlarmInfo } from './utils/AlarmsSummaryTooltip';

// Notifications Summary Tooltip (Not yet released - placeholder)
export { NotificationsSummaryTooltip } from './utils/NotificationsSummaryTooltip';
export type { NotificationsSummaryData, NotificationInfo } from './utils/NotificationsSummaryTooltip';

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

// RFC-0107: Contract Devices Modal (Shopping Dashboard)
export {
  openContractDevicesModal,
  DEVICE_COUNT_KEYS,
} from './components/premium-modals/contract-devices';

// RFC-0107: Contract Devices Modal Types
export type {
  OpenContractDevicesModalParams,
  ContractDevicesPersistResult,
  ContractDevicesError,
  ContractDeviceCounts,
  DeviceCountKeys,
  ContractDomain,
} from './components/premium-modals/contract-devices';

// RFC-0108: Measurement Setup Modal
export {
  openMeasurementSetupModal,
} from './components/premium-modals/measurement-setup';

// RFC-0108: Measurement Setup Modal Types
export type {
  MeasurementSetupModalParams,
  MeasurementSetupModalInstance,
  MeasurementSetupModalStyles,
  MeasurementSetupFormData,
  MeasurementSetupError,
  MeasurementDisplaySettings,
  WaterDisplaySettings,
  EnergyDisplaySettings,
  TemperatureDisplaySettings,
  WaterUnit,
  EnergyUnit,
  TemperatureUnit,
  MeasurementSetupPersistResult,
} from './components/premium-modals/measurement-setup';

// RFC-0108: Measurement Setup Modal Constants
export {
  WATER_UNITS,
  ENERGY_UNITS,
  TEMPERATURE_UNITS,
  DECIMAL_OPTIONS,
  DOMAIN_CONFIG as MEASUREMENT_DOMAIN_CONFIG,
  DEFAULT_MEASUREMENT_SETTINGS,
} from './components/premium-modals/measurement-setup';

// RFC-0109: Device Type Classification
export {
  handleDeviceType,
  getSuggestedProfiles,
  getSuggestedIdentifier,
  DEVICE_TYPE_DOMAIN,
} from './classify/deviceType';

export type { InferredDeviceType } from './classify/deviceType';

// RFC-0109: Upsell Post-Setup Modal
export { openUpsellModal } from './components/premium-modals/upsell';

export type {
  UpsellModalParams,
  UpsellModalInstance,
  Customer as UpsellCustomer,
  Device as UpsellDevice,
  DeviceAttributes,
  DeviceRelation,
  ValidationMap,
  UpsellModalStyles,
  UpsellModalError,
} from './components/premium-modals/upsell';

// RFC-0114: Menu Component
export { createMenuComponent } from './components/menu';
export { MenuView, MenuController } from './components/menu';

export type {
  MenuComponentParams,
  MenuComponentInstance,
  MenuConfigTemplate,
  TabConfig,
  ContextOption,
  Shopping,
  ThingsboardWidgetContext as MenuThingsboardWidgetContext,
  MenuEventType,
  MenuEventHandler,
  MenuState,
} from './components/menu';

export {
  DEFAULT_MENU_CONFIG,
  DEFAULT_TABS,
} from './components/menu';

// RFC-0121: TelemetryGrid Component
export { createTelemetryGridComponent } from './components/telemetry-grid';
export { TelemetryGridView, TelemetryGridController } from './components/telemetry-grid';

export type {
  TelemetryDomain,
  TelemetryContext,
  ThemeMode as TelemetryThemeMode,
  SortMode as TelemetrySortMode,
  TelemetryDevice,
  FilterState as TelemetryFilterState,
  TelemetryStats,
  TelemetryConfigTemplate,
  Shopping as TelemetryShopping,
  TelemetryGridParams,
  TelemetryGridInstance,
  TelemetryGridEventType,
} from './components/telemetry-grid';

export {
  DOMAIN_CONFIG as TELEMETRY_DOMAIN_CONFIG,
  CONTEXT_CONFIG as TELEMETRY_CONTEXT_CONFIG,
  DEFAULT_FILTER_TABS as TELEMETRY_DEFAULT_FILTER_TABS,
} from './components/telemetry-grid';
