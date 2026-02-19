// RFC-0137: Export library version from package.json
// @ts-ignore - package.json import
import pkg from '../package.json';
export const version: string = pkg.version || '0.0.0';

// Format utilities
export { formatEnergy, formatPower, formatAllInSameUnit } from './format/energy';
export { fmtPerc } from './format/percentage';
export { formatNumberReadable } from './format/numbers';
export {
  formatWater,
  formatWaterVolumeM3,
  formatTankHeadFromCm,
  calcDeltaPercent,
  formatWaterByGroup,
  formatAllInSameWaterUnit,
} from './format/water';

// Time/Duration utilities
export { formatRelativeTime, formatarDuracao, formatDuration } from './format/time';

// Date utilities
export { formatDateToYMD } from './date/ymd';
export { determineInterval } from './date/interval';
export { getSaoPauloISOString } from './date/saoPauloIso';
export { getDateRangeArray } from './date/range';
export { formatDateForInput, parseInputDateToDate } from './date/inputDate';
export {
  timeWindowFromInputYMD,
  formatDateWithTimezoneOffset,
  getSaoPauloISOStringFixed,
} from './date/timeWindow';
export { averageByDay, groupByDay, type TimedValue } from './date/averageByDay';
export {
  getDefaultPeriodCurrentMonthSoFar,
  getDefaultPeriodCurrentDaySoFar,
  getFirstDayOfMonth,
  getFirstDayOfMonthFor,
  getLastDayOfMonth,
} from './utils/dateUtils.js';

// CSV utilities
export { exportToCSV } from './csv/singleReport';
export { exportToCSVAll } from './csv/allStores';
export {
  buildWaterReportCSV,
  buildWaterStoresCSV,
  toCSV,
  type WaterRow,
  type StoreRow,
} from './csv/waterReports';

// Classification utilities
export { classify } from './classify/energyEntity';
export {
  classifyWaterLabel,
  classifyWaterLabels,
  getWaterCategories,
  isWaterCategory,
} from './classify/waterLabel';

// General utilities
export {
  getValueByDatakey,
  getValueByDatakeyLegacy,
  findValue,
  findValueWithDefault,
} from './utils/getValueByDatakey';

// RFC-0122: LogHelper utilities (contextual logging)
export { createLogHelper, LogHelper } from './utils/logHelper.js';

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
  mapDeviceStatusToCardStatus,
  shouldFlashIcon,
  isDeviceOffline,
  getDeviceStatusIcon,
  getConnectionStatusIcon,
  isValidDeviceStatus,
  isValidConnectionStatus,
  getDeviceStatusInfo,
  calculateDeviceStatus, // RFC-0110: Unified device status calculation with telemetry timestamps
  calculateDeviceStatusWithRanges, // @deprecated - use calculateDeviceStatus with ranges parameter
  calculateDeviceStatusMasterRules, // RFC-0110: Simplified status calculation with master rules
} from './utils/deviceStatus.js';

// RFC-0109: Device Item Factory utilities
export {
  DomainType,
  DeviceCategory,
  isTankDevice,
  isHydrometerDevice,
  isSolenoidDevice,
  isTemperatureDevice,
  isEnergyDevice,
  getDomainFromDeviceType,
  extractPowerLimitsForDevice,
  createDeviceItem,
  createDeviceItemsFromMap,
  recalculateDeviceStatus,
} from './utils/deviceItem.js';

// RFC-0111: Device Info utilities (domain and context detection)
export {
  DomainType as DeviceDomainType,
  ContextType as DeviceContextType,
  detectContext,
  detectDomainAndContext,
  mapConnectionStatus,
  calculateShoppingDeviceCounts,
  calculateShoppingDeviceStats, // RFC-0112: Includes consumption values
  extractEntityId,
} from './utils/deviceInfo.js';

// RFC-0128: Equipment Category utilities (energy equipment subcategorization)
export {
  EquipmentCategory,
  EQUIPMENT_CLASSIFICATION_CONFIG,
  classifyEquipment,
  classifyEquipmentSubcategory,
  getCategoryDisplayInfo,
  buildEquipmentCategorySummary,
  buildEquipmentCategoryDataForTooltip,
  isStoreDevice,
  isEquipmentDevice,
  isEntradaDevice,
} from './utils/equipmentCategory.js';

// RFC-0143: Device Grid Widget Factory
export {
  DeviceGridWidgetFactory,
  createWidgetController,
  createState as createDeviceGridState,
  applyFilters as applyDeviceGridFilters,
  recomputePercentages as recomputeDeviceGridPercentages,
  buildEntityObject as buildDeviceGridEntityObject,
  renderList as renderDeviceGridList,
  updateStats as updateDeviceGridStats,
  createBusyModal as createDeviceGridBusyModal,
  getCachedData as getDeviceGridCachedData,
  sortDevices as sortDeviceGridDevices,
} from './utils/DeviceGridWidgetFactory.js';

// ThingsBoard utilities
export { buildListItemsThingsboardByUniqueDatasource } from './thingsboard/utils/buildListItemsThingsboardByUniqueDatasource';
export {
  buildMyioIngestionAuth,
  clearAllAuthCaches,
  getAuthCacheStats,
  type MyIOAuthConfig,
  type MyIOAuthInstance,
} from './thingsboard/auth/buildMyioIngestionAuth';
export {
  fetchThingsboardCustomerServerScopeAttrs,
  fetchThingsboardCustomerAttrsFromStorage,
  extractMyIOCredentials,
  type ThingsboardCustomerAttrsConfig,
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
  canModifyAnnotation,
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
  NewAnnotationData,
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
  STATUS_COLORS,
} from './components/premium-modals/settings/annotations/types';

// RFC-0104: Annotation Indicator Component
export { AnnotationIndicator, createAnnotationIndicator } from './utils/AnnotationIndicator';

export type {
  AnnotationIndicatorConfig,
  AnnotationIndicatorTheme,
  AnnotationSummary,
} from './utils/AnnotationIndicator';

// Re-export existing utilities
export { detectDeviceType, getAvailableContexts, addDetectionContext } from './utils/deviceType';
export { addNamespace } from './utils/namespace';
export { fmtPerc as fmtPercLegacy, toFixedSafe } from './utils/numbers';
export { normalizeRecipients } from './utils/strings';

// RFC-XXXX: Period utilities
export { periodKey, type Period } from './utils/periodUtils';

// Codec utilities
export { decodePayload } from './codec/decodePayload';

// Network utilities
//export { http, fetchWithRetry } from './net/http';

// Codec utilities (additional exports)
export { decodePayloadBase64Xor } from './codec/decodePayload';

export { renderCardComponent } from './thingsboard/main-dashboard-shopping/v-4.0.0/card/template-card.js';
export {
  renderCardComponent as renderCardComponentEnhanced,
  renderCardComponentV2,
  renderCardComponentLegacy,
} from './thingsboard/main-dashboard-shopping/v-4.0.0/card/template-card-v2.js';
export { renderCardComponentHeadOffice } from './thingsboard/main-dashboard-shopping/v-4.0.0/card/head-office';
export {
  renderCardComponent as renderCardComponentV5,
  renderCardComponentV5 as renderCardV5,
} from './thingsboard/main-dashboard-shopping/v-5.2.0/card/template-card-v5.js';
export {
  renderCardComponentV6,
  renderCardComponent as renderCardComponentV6Alias,
} from './components/template-card-v6/template-card-v6.js';

// Ambiente card component (v6) - for BAS dashboard
export { renderCardAmbienteV6 } from './components/template-card-ambiente-v6/template-card-ambiente-v6.js';

// HeaderPanelComponent — Reusable header component for panels
export { HeaderPanelComponent, HEADER_STYLE_SLIM, HEADER_STYLE_DEFAULT, HEADER_STYLE_DARK, HEADER_STYLE_PREMIUM_GREEN } from './components/header-panel/index';
export type { HeaderPanelStyle, HeaderPanelOptions } from './components/header-panel/index';

// EntityListPanel — Reusable sidebar list component
export { EntityListPanel } from './components/entity-list-panel/index';
export type { EntityListItem, EntityListPanelOptions } from './components/entity-list-panel/index';

// CardGridPanel — Reusable card grid panel component
export { CardGridPanel } from './components/card-grid-panel/index';
export type { CardGridItem, CardGridCustomStyle, CardGridPanelOptions } from './components/card-grid-panel/index';

// MYIO Components - Drag-to-Footer Dock Implementation
export { MyIOSelectionStore, MyIOSelectionStoreClass } from './components/SelectionStore.js';
export { MyIODraggableCard } from './components/DraggableCard.js';
export { MyIOChartModal } from './components/ChartModal.js';
export { MyIOToast } from './components/MyIOToast.js';

// RFC-0131: Loading Spinner Component
export { createLoadingSpinner, LoadingSpinner } from './components/loading-spinner';

// RFC-0137: Library Version Checker Component
export { createLibraryVersionChecker } from './components/library-version-checker';

// RFC-0084: Real-Time Telemetry Modal
export { openRealTimeTelemetryModal } from './components/RealTimeTelemetryModal';
export type { RealTimeTelemetryParams, RealTimeTelemetryInstance } from './components/RealTimeTelemetryModal';

// Premium Modal Components
export {
  openDashboardPopupEnergy,
  openDashboardPopupReport,
  openDashboardPopupAllReport,
  openDashboardPopup,
  openDashboardPopupWaterTank,
} from './components/premium-modals';

// Energy Modal Types
export type {
  OpenDashboardPopupEnergyOptions,
  EnergyModalContext,
  EnergyModalI18n,
  EnergyModalStyleOverrides,
  EnergyModalError,
} from './components/premium-modals/energy/openDashboardPopupEnergy';

// Settings Modal Component
export { openDashboardPopupSettings } from './components/premium-modals/settings/openDashboardPopupSettings';
export type {
  OpenDashboardPopupSettingsParams,
  PersistResult,
  SettingsError,
  SettingsEvent,
  TbScope,
} from './components/premium-modals/settings/types';

// Water Tank Modal Types
export type {
  OpenDashboardPopupWaterTankOptions,
  WaterTankModalContext,
  WaterTankModalError,
  WaterTankTelemetryData,
  WaterTankDataPoint,
  WaterTankModalI18n,
  WaterTankModalStyleOverrides,
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
  UserInfo as WelcomeUserInfo,
} from './components/premium-modals/welcome/types';
export {
  DEFAULT_PALETTE as WELCOME_DEFAULT_PALETTE,
  DEFAULT_SHOPPING_CARDS,
} from './components/premium-modals/welcome/types';

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

// RFC-0113: Header Component (moved from premium-modals per RFC-0128)
export { createHeaderComponent } from './components/header/createHeaderComponent';
export { HeaderView } from './components/header/HeaderView';
export { HeaderFilterModal } from './components/header/HeaderFilterModal';
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
  HeaderThemeMode,
  HeaderThemeConfig,
} from './components/header/types';
export {
  HEADER_DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_CARD_COLORS as HEADER_DEFAULT_CARD_COLORS,
  HEADER_DEFAULT_LOGO_URL,
  DEFAULT_HEADER_LIGHT_THEME,
  DEFAULT_HEADER_DARK_THEME,
  HEADER_CSS_PREFIX,
} from './components/header/types';

// DateRangePicker - Public API
export {
  createDateRangePicker,
  type CreateDateRangePickerOptions,
  type DateRangeControl,
  type DateRangeResult,
} from './components/createDateRangePicker';

// Premium Date Range Input Component
export { createInputDateRangePickerInsideDIV } from './components/createInputDateRangePickerInsideDIV';
export type {
  CreateInputDateRangePickerInsideDIVParams,
  DateRangeInputController,
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
  type TelemetryFetcher,
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
  CHART_COLORS,
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
  ClampRange,
} from './components/temperature';

// RFC-0153: Alarm Comparison Modal
export {
  openAlarmComparisonModal,
  type AlarmComparisonModalParams,
  type AlarmComparisonModalInstance,
} from './components/alarms/AlarmComparisonModal';

// RFC-0157: Operational Comparison Modal
export {
  openOperationalComparisonModal,
  type OperationalComparisonModalParams,
  type OperationalComparisonModalInstance,
  type OperationalDevice,
} from './components/operational-comparison-modal';

// Temperature Range Tooltip (Reusable UI component)
export { TempRangeTooltip } from './utils/TempRangeTooltip';
export type { TempEntityData, TempStatus, TempStatusResult } from './utils/TempRangeTooltip';

// Energy Range Tooltip (Reusable UI component)
export { EnergyRangeTooltip } from './utils/EnergyRangeTooltip';
export type {
  EnergyEntityData,
  EnergyStatus,
  EnergyStatusResult,
  PowerRange,
  PowerRanges,
} from './utils/EnergyRangeTooltip';

// RFC-0105: Energy Summary Tooltip (Dashboard summary on hover)
export { EnergySummaryTooltip } from './utils/EnergySummaryTooltip';
export { WaterSummaryTooltip } from './utils/WaterSummaryTooltip';
export { InfoTooltip } from './utils/InfoTooltip';
export type {
  DashboardEnergySummary,
  CategorySummary,
  StatusSummary,
  DeviceInfo,
} from './utils/EnergySummaryTooltip';
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
export type {
  ContractSummaryData,
  ContractDomainCounts,
  ContractTemperatureCounts,
} from './utils/ContractSummaryTooltip';

// RFC-0112 Rev-001: Users Summary Tooltip (Welcome Modal meta icons)
export { UsersSummaryTooltip } from './utils/UsersSummaryTooltip';
export type {
  UsersSummaryData,
  UsersByRole,
  UserInfo as UsersTooltipUserInfo,
} from './utils/UsersSummaryTooltip';

// RFC-0116: Alarms Summary Tooltip (Not yet released - placeholder)
export { AlarmsSummaryTooltip } from './utils/AlarmsSummaryTooltip';
export type { AlarmsSummaryData, AlarmInfo } from './utils/AlarmsSummaryTooltip';

// Notifications Summary Tooltip (Not yet released - placeholder)
export { NotificationsSummaryTooltip } from './utils/NotificationsSummaryTooltip';
export type { NotificationsSummaryData, NotificationInfo } from './utils/NotificationsSummaryTooltip';

// Unified Modal Header Component (RFC-0121)
export { ModalHeader } from './utils/ModalHeader';
export type {
  ModalHeaderOptions,
  ModalHeaderHandlers,
  ModalHeaderControllerOptions,
  ModalHeaderController,
  ExportFormat as ModalExportFormat,
} from './utils/ModalHeader';

// Legacy Modal Header Component (Deprecated - use ModalHeader above)
// @deprecated Use ModalHeader from './utils/ModalHeader' instead
export { createModalHeader, getModalHeaderStyles } from './components/ModalHeader';

export type { ModalHeaderConfig, ModalHeaderInstance, ModalTheme } from './components/ModalHeader';

// RFC-0098: Consumption 7 Days Chart Component
export {
  createConsumption7DaysChart,
  createConsumptionModal,
  createConsumptionChartWidget,
  DEFAULT_COLORS as CONSUMPTION_CHART_COLORS,
  DEFAULT_CONFIG as CONSUMPTION_CHART_DEFAULTS,
  THEME_COLORS as CONSUMPTION_THEME_COLORS,
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
export { openPowerLimitsSetupModal } from './components/premium-modals/power-limits';

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
export { openContractDevicesModal, DEVICE_COUNT_KEYS } from './components/premium-modals/contract-devices';

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
export { openMeasurementSetupModal } from './components/premium-modals/measurement-setup';

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

export { DEFAULT_MENU_CONFIG, DEFAULT_TABS } from './components/menu';

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

// RFC-0125: HeaderDevicesGrid Component
export { createHeaderDevicesGridComponent } from './components/header-devices-grid';
export { HeaderDevicesGridView, HeaderDevicesGridController } from './components/header-devices-grid';

export type {
  HeaderDevicesDomain,
  HeaderDevicesThemeMode,
  HeaderStats,
  HeaderLabels,
  HeaderDevicesGridParams,
  HeaderDevicesGridInstance,
  HeaderDevice,
  HeaderDomainConfig,
} from './components/header-devices-grid';

export { HEADER_DEVICES_GRID_STYLES, injectHeaderDevicesGridStyles } from './components/header-devices-grid';

// RFC-0125: FilterModal Component
export { createFilterModalComponent } from './components/filter-modal';
export { FilterModalView, FilterModalController } from './components/filter-modal';

export type {
  FilterModalThemeMode,
  FilterModalDomain,
  SortMode as FilterSortMode,
  FilterTab,
  FilterableDevice,
  AppliedFilters,
  FilterModalParams,
  FilterModalInstance,
  FilterModalState,
  FilterGroup,
} from './components/filter-modal';

export { FILTER_GROUPS, FILTER_TAB_ICONS, STATUS_TO_CONNECTIVITY } from './components/filter-modal';

export { generateFilterModalStyles } from './components/filter-modal';

// RFC-0160: Simplified category-based filter modal for CardGridPanel
export {
  FilterModalComponent,
  WATER_SORT_OPTIONS,
  ENERGY_SORT_OPTIONS,
  TEMPERATURE_SORT_OPTIONS,
  MOTOR_SORT_OPTIONS,
  WATER_DEVICE_CATEGORIES,
} from './components/filter-modal';

export type {
  FilterCategory,
  FilterSortOption,
  FilterModalOptions,
  FilterState as FilterCategoryState,
} from './components/filter-modal';

// RFC-0127: CustomerCard Components
export { CustomerCardV1, createCustomerCardV1 } from './components/customer-card-v1';
export { injectCustomerCardV1Styles } from './components/customer-card-v1';

export type {
  CustomerCardData,
  CustomerCardV1Params,
  CustomerCardV1Instance,
  CustomerCardDeviceCounts,
  CustomerCardMetaCounts,
  ThemeMode as CustomerCardThemeMode,
} from './components/customer-card-v1';

// RFC-0127: CustomerCardV2 (Metro UI Style)
export { CustomerCardV2, createCustomerCardV2 } from './components/customer-card-v2';
export { injectCustomerCardV2Styles } from './components/customer-card-v2';

export type { CustomerCardV2Params, CustomerCardV2Instance, MetroTile } from './components/customer-card-v2';

export { METRO_TILE_COLORS } from './components/customer-card-v2';

// RFC-0132: EnergyPanel Component
export { createEnergyPanelComponent } from './components/energy-panel';
export type {
  ThemeMode as EnergyPanelThemeMode,
  PeriodDays as EnergyPanelPeriodDays,
  VizMode as EnergyPanelVizMode,
  ChartType as EnergyPanelChartType,
  DistributionMode as EnergyPanelDistributionMode,
  EnergyCategoryData as EnergyPanelEnergyCategoryData,
  EnergySummaryData as EnergyPanelEnergySummaryData,
  ConsumptionDataPoint as EnergyPanelConsumptionDataPoint,
  DistributionDataPoint as EnergyPanelDistributionDataPoint,
  FetchConsumptionFn as EnergyPanelFetchConsumptionFn,
  FetchDistributionFn as EnergyPanelFetchDistributionFn,
  OnFilterChangeCallback as EnergyPanelOnFilterChangeCallback,
  OnPeriodChangeCallback as EnergyPanelOnPeriodChangeCallback,
  OnVizModeChangeCallback as EnergyPanelOnVizModeChangeCallback,
  OnMaximizeCallback as EnergyPanelOnMaximizeCallback,
  OnRefreshCallback as EnergyPanelOnRefreshCallback,
  EnergyPanelParams,
  EnergyPanelInstance,
  EnergyPanelState,
} from './components/energy-panel';

// RFC-0133: WaterPanel Component
export { createWaterPanelComponent } from './components/water-panel';
export type {
  ThemeMode as WaterPanelThemeMode,
  PeriodDays as WaterPanelPeriodDays,
  VizMode as WaterPanelVizMode,
  ChartType as WaterPanelChartType,
  DistributionMode as WaterPanelDistributionMode,
  WaterCategoryData as WaterPanelWaterCategoryData,
  WaterSummaryData as WaterPanelWaterSummaryData,
  ConsumptionDataPoint as WaterPanelConsumptionDataPoint,
  DistributionDataPoint as WaterPanelDistributionDataPoint,
  FetchConsumptionFn as WaterPanelFetchConsumptionFn,
  FetchDistributionFn as WaterPanelFetchDistributionFn,
  OnFilterChangeCallback as WaterPanelOnFilterChangeCallback,
  OnPeriodChangeCallback as WaterPanelOnPeriodChangeCallback,
  OnVizModeChangeCallback as WaterPanelOnVizModeChangeCallback,
  OnMaximizeCallback as WaterPanelOnMaximizeCallback,
  OnRefreshCallback as WaterPanelOnRefreshCallback,
  WaterPanelParams,
  WaterPanelInstance,
  WaterPanelState,
} from './components/water-panel';

// RFC-0144: Onboard Modal Component (MYIO Academy)
export { openOnboardModal, openTutorialModal, openHelpModal, OnboardModalView } from './components/onboard';

export type { OnboardModalConfig, OnboardModalHandle, OnboardFooterLink } from './components/onboard';

// RFC-0139: HeaderShopping Component (Shopping Dashboard toolbar)
export { createHeaderShoppingComponent } from './components/header-shopping';
export { HeaderShoppingView, injectHeaderShoppingStyles } from './components/header-shopping';

export type {
  HeaderShoppingDomainType,
  HeaderShoppingPeriod,
  HeaderShoppingContractState,
  HeaderShoppingConfigTemplate,
  HeaderShoppingParams,
  HeaderShoppingInstance,
  HeaderShoppingEventType,
  HeaderShoppingEventHandler,
} from './components/header-shopping';

export { HEADER_SHOPPING_CSS_PREFIX, DEFAULT_HEADER_SHOPPING_CONFIG } from './components/header-shopping';

// RFC-0140: MenuShopping Component (Shopping Dashboard menu navigation)
export { createMenuShoppingComponent } from './components/menu-shopping';
export { MenuShoppingView, injectMenuShoppingStyles } from './components/menu-shopping';

export type {
  MenuShoppingDomainType,
  MenuShoppingTab,
  MenuShoppingUserInfo,
  MenuShoppingSettings,
  MenuShoppingDashboardStateEvent,
  MenuShoppingConfigTemplate,
  MenuShoppingParams,
  MenuShoppingInstance,
  MenuShoppingEventType,
  MenuShoppingEventHandler,
} from './components/menu-shopping';

export { MENU_SHOPPING_CSS_PREFIX, DEFAULT_MENU_SHOPPING_CONFIG } from './components/menu-shopping';

// RFC-0145: TelemetryGridShopping Component (Shopping Dashboard device grid)
export { createTelemetryGridShoppingComponent } from './components/telemetry-grid-shopping';

export type {
  TelemetryGridShoppingParams,
  TelemetryGridShoppingInstance,
  TelemetryDevice as TelemetryGridShoppingDevice,
  TelemetryDomain as TelemetryGridShoppingDomain,
  TelemetryContext as TelemetryGridShoppingContext,
  ThemeMode as TelemetryGridShoppingThemeMode,
  SortMode as TelemetryGridShoppingSortMode,
  FilterState as TelemetryGridShoppingFilterState,
  TelemetryStats as TelemetryGridShoppingStats,
  CardAction as TelemetryGridShoppingCardAction,
} from './components/telemetry-grid-shopping';

export {
  DOMAIN_CONFIG as TELEMETRY_GRID_SHOPPING_DOMAIN_CONFIG,
  CONTEXT_CONFIG as TELEMETRY_GRID_SHOPPING_CONTEXT_CONFIG,
  ONLINE_STATUSES,
  OFFLINE_STATUSES,
  WAITING_STATUSES,
  getDeviceStatusCategory,
} from './components/telemetry-grid-shopping';

// RFC-0148: TelemetryInfoShopping Component (Shopping Dashboard info panel)
export { createTelemetryInfoShoppingComponent } from './components/telemetry-info-shopping';

export type {
  TelemetryInfoShoppingParams,
  TelemetryInfoShoppingInstance,
  TelemetryDomain as TelemetryInfoShoppingDomain,
  ThemeMode as TelemetryInfoShoppingThemeMode,
  EnergySummary as TelemetryInfoEnergySummary,
  WaterSummary as TelemetryInfoWaterSummary,
  EnergyState as TelemetryInfoEnergyState,
  WaterState as TelemetryInfoWaterState,
  CategoryType as TelemetryInfoCategoryType,
  ChartColors as TelemetryInfoChartColors,
} from './components/telemetry-info-shopping';

export {
  DEFAULT_CHART_COLORS as TELEMETRY_INFO_DEFAULT_CHART_COLORS,
  ENERGY_CATEGORY_CONFIG as TELEMETRY_INFO_ENERGY_CATEGORY_CONFIG,
  WATER_CATEGORY_CONFIG as TELEMETRY_INFO_WATER_CATEGORY_CONFIG,
  formatEnergy as telemetryInfoFormatEnergy,
  formatWater as telemetryInfoFormatWater,
  formatPercentage as telemetryInfoFormatPercentage,
} from './components/telemetry-info-shopping';

// RFC-0152 Phase 3: Operational General List Component
export { createOperationalGeneralListComponent } from './components/operational-general-list';
export {
  OperationalGeneralListView,
  OperationalGeneralListController,
} from './components/operational-general-list';

export type {
  OperationalGeneralListParams,
  OperationalGeneralListInstance,
  ThemeMode as OperationalListThemeMode,
  OperationalGeneralListState,
  OperationalListEventType,
  OperationalListEventHandler,
  StatusConfig as OperationalStatusConfig,
  EquipmentType,
  EquipmentStatus,
  EquipmentCardData,
  EquipmentStats,
  EquipmentFilterState,
} from './components/operational-general-list';

export {
  STATUS_CONFIG as OPERATIONAL_STATUS_CONFIG,
  AVAILABILITY_THRESHOLDS as OPERATIONAL_AVAILABILITY_THRESHOLDS,
  getAvailabilityColorFromThresholds,
  getStatusColors as getOperationalStatusColors,
  getAvailabilityColor as getOperationalAvailabilityColor,
  calculateMTBF,
  calculateMTTR,
  calculateAvailability,
  DEFAULT_EQUIPMENT_STATS,
  DEFAULT_EQUIPMENT_FILTER_STATE,
} from './components/operational-general-list';

export {
  OPERATIONAL_GENERAL_LIST_STYLES,
  injectOperationalGeneralListStyles,
  removeOperationalGeneralListStyles,
} from './components/operational-general-list';

// RFC-0152: Operational Indicators Types (shared across all operational panels)
export type {
  OperationalIndicatorsAttributes,
  DashboardPeriod,
  DashboardKPIs,
  DowntimeEntry,
  TrendDataPoint,
  OperationalIndicatorsAccessEvent,
  OperationalContextChangeEvent,
  OperationalEquipmentReadyEvent,
  OperationalStore,
} from './types/operational';

export { DEFAULT_DASHBOARD_KPIS } from './types/operational';

// RFC-0152: Alarm Types (for Phase 4 - Alarms and Notifications Panel)
export type { AlarmSeverity, AlarmState, Alarm, AlarmStats, AlarmFilters } from './types/alarm';

export {
  SEVERITY_CONFIG as ALARM_SEVERITY_CONFIG,
  STATE_CONFIG as ALARM_STATE_CONFIG,
  DEFAULT_ALARM_STATS,
  DEFAULT_ALARM_FILTERS,
  getSeverityConfig as getAlarmSeverityConfig,
  getStateConfig as getAlarmStateConfig,
  isAlarmActive,
  formatAlarmRelativeTime,
} from './types/alarm';

// RFC-0152 Phase 4: Device Operational Card Component
export { createDeviceOperationalCardComponent } from './components/device-operational-card';
export {
  DeviceOperationalCardView,
  DeviceOperationalCardController,
} from './components/device-operational-card';

export type {
  DeviceOperationalCardParams,
  DeviceOperationalCardInstance,
  ThemeMode as DeviceOperationalCardThemeMode,
  DeviceOperationalCardState,
  DeviceOperationalCardFilterState,
  AlarmSortMode,
  AlarmAction,
  OnAlarmClickCallback,
  OnAlarmActionCallback,
  OnAlarmFilterChangeCallback,
  OnAlarmStatsUpdateCallback,
  DeviceOperationalCardEventType,
  DeviceOperationalCardEventHandler,
  AlarmSortOption,
  AlarmFilterTab,
} from './components/device-operational-card';

export {
  ALARM_SORT_OPTIONS,
  SEVERITY_ORDER,
  DEFAULT_DEVICE_OPERATIONAL_CARD_FILTER_STATE,
  DEFAULT_ALARM_FILTER_TABS,
} from './components/device-operational-card';

export {
  DEVICE_OPERATIONAL_CARD_STYLES,
  injectDeviceOperationalCardStyles,
  removeDeviceOperationalCardStyles,
} from './components/device-operational-card';

// RFC-0152 Phase 3: Device Operational Card Grid Component
export { createDeviceOperationalCardGridComponent } from './components/device-operational-card-grid';
export {
  DeviceOperationalCardGridView,
  DeviceOperationalCardGridController,
} from './components/device-operational-card-grid';

export type {
  OperationalEquipment,
  EquipmentType as GridEquipmentType,
  EquipmentStatus as GridEquipmentStatus,
  DeviceOperationalCardGridParams,
  DeviceOperationalCardGridInstance,
  ThemeMode as DeviceOperationalCardGridThemeMode,
  SortMode as DeviceOperationalCardGridSortMode,
  DeviceOperationalCardGridState,
  DeviceOperationalCardGridFilterState,
  DeviceOperationalCardGridStats,
  EquipmentAction,
  OnEquipmentClickCallback,
  OnEquipmentActionCallback,
  OnGridFilterChangeCallback,
  OnGridStatsUpdateCallback,
  DeviceOperationalCardGridEventType,
  DeviceOperationalCardGridEventHandler,
  GridSortOption,
  GridFilterTab,
  CustomerOption as GridCustomerOption,
} from './components/device-operational-card-grid';

export {
  GRID_SORT_OPTIONS,
  DEFAULT_GRID_FILTER_STATE,
  DEFAULT_GRID_FILTER_TABS,
  STATUS_CONFIG as EQUIPMENT_STATUS_CONFIG,
  TYPE_CONFIG as EQUIPMENT_TYPE_CONFIG,
} from './components/device-operational-card-grid';

export {
  DEVICE_OPERATIONAL_CARD_GRID_STYLES,
  injectDeviceOperationalCardGridStyles,
  removeDeviceOperationalCardGridStyles,
} from './components/device-operational-card-grid';

// RFC-0152: Operational Header Devices Grid Component (Premium Header)
export { createOperationalHeaderDevicesGridComponent } from './components/operational-header-devices-grid';
export { OperationalHeaderDevicesGridView } from './components/operational-header-devices-grid';

export type {
  OperationalHeaderDevicesGridParams,
  OperationalHeaderDevicesGridInstance,
  OperationalHeaderStats,
  OperationalHeaderThemeMode,
  OperationalHeaderLabels,
  CustomerOption,
} from './components/operational-header-devices-grid';

export {
  OPERATIONAL_HEADER_DEVICES_GRID_STYLES,
  injectOperationalHeaderDevicesGridStyles,
  removeOperationalHeaderDevicesGridStyles,
} from './components/operational-header-devices-grid';
// RFC-0152 Phase 4: Alarms Notifications Panel Component
export { createAlarmsNotificationsPanelComponent } from './components/AlarmsNotificationsPanel';
export {
  AlarmsNotificationsPanelView,
  AlarmsNotificationsPanelController,
} from './components/AlarmsNotificationsPanel';
export { renderAlarmCard, createAlarmCardElement } from './components/AlarmsNotificationsPanel';
export {
  renderKPICards,
  renderTrendChart,
  renderStateDonutChart,
  renderSeverityBarChart,
} from './components/AlarmsNotificationsPanel';

export type {
  AlarmsNotificationsPanelParams,
  AlarmsNotificationsPanelInstance,
  AlarmsTab,
  AlarmsNotificationsPanelState,
  AlarmsEventType,
  AlarmsEventHandler,
  AlarmCardParams,
  TrendChartOptions,
  DonutChartOptions,
  BarChartOptions,
} from './components/AlarmsNotificationsPanel';

export {
  ALARMS_NOTIFICATIONS_PANEL_STYLES,
  injectAlarmsNotificationsPanelStyles,
  removeAlarmsNotificationsPanelStyles,
} from './components/AlarmsNotificationsPanel';

// RFC-0152 Phase 5: Operational Dashboard Component
export { createOperationalDashboardComponent } from './components/operational-dashboard';

export type {
  OperationalDashboardParams,
  OperationalDashboardInstance,
  DashboardKPIs as OperationalDashboardKPIs,
  TrendDataPoint as OperationalTrendDataPoint,
  DowntimeEntry as OperationalDowntimeEntry,
  DashboardPeriod as OperationalDashboardPeriod,
  DashboardThemeMode as OperationalDashboardThemeMode,
} from './components/operational-dashboard';

export {
  DEFAULT_DASHBOARD_KPIS as OPERATIONAL_DASHBOARD_DEFAULT_KPIS,
  PERIOD_OPTIONS as OPERATIONAL_DASHBOARD_PERIOD_OPTIONS,
} from './components/operational-dashboard';

export {
  calculateMTBF as calculateDashboardMTBF,
  calculateMTTR as calculateDashboardMTTR,
  calculateAvailability as calculateDashboardAvailability,
  calculateFleetKPIs,
  formatHours,
  formatPercentage as formatDashboardPercentage,
  formatTrend,
  getTrendIcon,
  getTrendClass,
  getPeriodDateRange,
  generateMockTrendData,
  generateMockDowntimeList,
  generateMockKPIs,
} from './components/operational-dashboard';

export {
  renderLineChart,
  renderDualLineChart,
  renderStatusDonutChart,
  renderDowntimeList as renderDashboardDowntimeList,
} from './components/operational-dashboard';

export {
  OPERATIONAL_DASHBOARD_STYLES,
  injectOperationalDashboardStyles,
  removeOperationalDashboardStyles,
} from './components/operational-dashboard';

// RFC-0158: BAS Dashboard Component (Building Automation System)
export { createBASDashboard } from './components/bas-dashboard';
export { BASDashboardView, BASDashboardController } from './components/bas-dashboard';

export type {
  BASDashboardParams,
  BASDashboardInstance,
  BASDashboardData,
  BASDashboardThemeMode,
  BASDashboardSettings,
  WaterDevice as BASWaterDevice,
  HVACDevice as BASHVACDevice,
  MotorDevice as BASMotorDevice,
  WaterDeviceType as BASWaterDeviceType,
  WaterDeviceStatus as BASWaterDeviceStatus,
  HVACDeviceStatus as BASHVACDeviceStatus,
  MotorDeviceStatus as BASMotorDeviceStatus,
  MotorDeviceType as BASMotorDeviceType,
  BASDashboardState,
  BASEventType,
} from './components/bas-dashboard';

export {
  DEFAULT_BAS_SETTINGS,
  BAS_DASHBOARD_CSS_PREFIX,
  BAS_DASHBOARD_STYLES,
  injectBASDashboardStyles,
  removeBASDashboardStyles,
} from './components/bas-dashboard';

// RFC-0158: Fancoil Remote Control Component
export { createFancoilRemote, FancoilRemoteController, FancoilRemoteView } from './components/fancoil-remote';

export type {
  FancoilStatus,
  FancoilMode,
  FancoilThemeMode,
  FancoilRemoteSettings,
  FancoilState,
  FancoilRemoteParams,
  FancoilRemoteInstance,
} from './components/fancoil-remote';

export {
  FANCOIL_IMAGES,
  DEFAULT_FANCOIL_SETTINGS,
  DEFAULT_FANCOIL_STATE,
  FANCOIL_REMOTE_CSS_PREFIX,
  injectFancoilRemoteStyles,
  getImageByConsumption,
} from './components/fancoil-remote';

// RFC-0158: Solenoid Control Component
export { createSolenoidControl, SolenoidControlController, SolenoidControlView } from './components/solenoid-control';

export type {
  SolenoidStatus,
  SolenoidThemeMode,
  SolenoidControlSettings,
  SolenoidState,
  SolenoidControlParams,
  SolenoidControlInstance,
} from './components/solenoid-control';

export {
  SOLENOID_IMAGES,
  DEFAULT_SOLENOID_SETTINGS,
  DEFAULT_SOLENOID_STATE,
  SOLENOID_CONTROL_CSS_PREFIX,
  injectSolenoidControlStyles,
} from './components/solenoid-control';

// RFC-0172: Switch Control Component (On/Off Interruptor)
export { createSwitchControl, SwitchControlController, SwitchControlView } from './components/switch-control';

export type {
  SwitchStatus,
  SwitchThemeMode,
  SwitchControlSettings,
  SwitchState,
  SwitchControlParams,
  SwitchControlInstance,
} from './components/switch-control';

export {
  DEFAULT_SWITCH_SETTINGS,
  DEFAULT_SWITCH_STATE,
  SWITCH_CONTROL_CSS_PREFIX,
  injectSwitchControlStyles,
} from './components/switch-control';

// RFC-0158: Action Button Component
export { createActionButton, ActionButtonController, ActionButtonView } from './components/action-button';

export type {
  ActionButtonThemeMode,
  ActionButtonVariant,
  ActionButtonSize,
  ActionButtonSettings,
  ActionButtonParams,
  ActionButtonInstance,
} from './components/action-button';

export {
  DEFAULT_ACTION_BUTTON_SETTINGS,
  ACTION_BUTTON_CSS_PREFIX,
  injectActionButtonStyles,
} from './components/action-button';

// Scheduling Shared Module
export {
  DEFAULT_DAYS_WEEK,
  DAY_LABELS,
  DAY_LABELS_FULL,
  SCHED_CSS_PREFIX,
  injectSchedulingSharedStyles,
  removeSchedulingSharedStyles,
  // View helpers
  escapeHtml as schedEscapeHtml,
  createDaysGrid,
  createTimeInput as schedCreateTimeInput,
  createNumberInput as schedCreateNumberInput,
  createDateInput as schedCreateDateInput,
  createScheduleCard,
  createGroupScheduleCard,
  showConfirmModal as schedShowConfirmModal,
  showNotificationModal as schedShowNotificationModal,
  createErrorSpan,
  createToggleSwitch,
  createButtonBar,
  createSelect as schedCreateSelect,
  // Validation
  timeToMinutes,
  isValidTimeFormat,
  isEndAfterStart,
  doSchedulesOverlap,
  hasSelectedDays,
  isInRange,
} from './components/scheduling-shared';

export type {
  SchedulingThemeMode,
  DaysWeek,
  ScheduleEntryBase,
  SchedulingBaseSettings,
  NotifyFn as SchedulingNotifyFn,
  ConfirmFn as SchedulingConfirmFn,
} from './components/scheduling-shared';

// Schedule On/Off Component
export { createScheduleOnOff, ScheduleOnOffController, ScheduleOnOffView } from './components/schedule-on-off';

export type {
  OnOffScheduleEntry,
  OnOffGroupScheduleEntry,
  ScheduleOnOffSettings,
  ScheduleOnOffState,
  ScheduleOnOffParams,
  ScheduleOnOffInstance,
} from './components/schedule-on-off';

export {
  DEFAULT_ON_OFF_SCHEDULE,
  DEFAULT_ON_OFF_STATE,
  DEFAULT_ON_OFF_SETTINGS,
  SCHEDULE_ON_OFF_CSS_PREFIX,
  injectScheduleOnOffStyles,
} from './components/schedule-on-off';

// Schedule IR Component
export { createScheduleIR, ScheduleIRController, ScheduleIRView } from './components/schedule-ir';

export type {
  IRCommand,
  IRScheduleEntry,
  IRGroupScheduleEntry,
  ScheduleIRSettings,
  ScheduleIRState,
  ScheduleIRParams,
  ScheduleIRInstance,
} from './components/schedule-ir';

export {
  DEFAULT_IR_SCHEDULE,
  DEFAULT_IR_STATE,
  DEFAULT_IR_SETTINGS,
  SCHEDULE_IR_CSS_PREFIX,
  injectScheduleIRStyles,
} from './components/schedule-ir';

// Schedule Setpoint Component
export { createScheduleSetpoint, ScheduleSetpointController, ScheduleSetpointView } from './components/schedule-setpoint';

export type {
  SetpointScheduleEntry,
  ScheduleSetpointSettings,
  ScheduleSetpointDevices,
  ScheduleSetpointState,
  ScheduleSetpointParams,
  ScheduleSetpointInstance,
} from './components/schedule-setpoint';

export {
  DEFAULT_SETPOINT_SCHEDULE,
  DEFAULT_SETPOINT_STATE,
  DEFAULT_SETPOINT_SETTINGS,
  SCHEDULE_SETPOINT_CSS_PREFIX,
  injectScheduleSetpointStyles,
} from './components/schedule-setpoint';

// DeviceGridV6 — Simplified device grid for BAS dashboard panels
export { createDeviceGridV6 } from './components/device-grid-v6';
export { DeviceGridV6View, DeviceGridV6Controller } from './components/device-grid-v6';
export { injectDeviceGridV6Styles, getDeviceGridV6StatusCategory } from './components/device-grid-v6';

export type {
  DeviceGridV6Item,
  DeviceGridV6CustomStyle,
  DeviceGridV6SortMode,
  DeviceGridV6Stats,
  DeviceGridV6Params,
  DeviceGridV6Instance,
} from './components/device-grid-v6';

// Schedule Holiday Component
export { createScheduleHoliday, ScheduleHolidayController, ScheduleHolidayView } from './components/schedule-holiday';

export type {
  HolidayEntry,
  ScheduleHolidaySettings,
  ScheduleHolidayState,
  ScheduleHolidayParams,
  ScheduleHolidayInstance,
} from './components/schedule-holiday';

export {
  DEFAULT_HOLIDAY_STATE,
  DEFAULT_HOLIDAY_SETTINGS,
  SCHEDULE_HOLIDAY_CSS_PREFIX,
  injectScheduleHolidayStyles,
} from './components/schedule-holiday';

// RFC-0167: On/Off Device Modal (Solenoids, Switches, Relays, Pumps)
export {
  createOnOffDeviceModal,
  openOnOffDeviceModal,
  OnOffDeviceModalController,
  OnOffDeviceModalView,
} from './components/premium-modals/on-off-device';

export type {
  OnOffDeviceType,
  OnOffDeviceThemeMode,
  OnOffModalView,
  OnOffDeviceData,
  DeviceTypeConfig,
  OnOffScheduleEntry as OnOffDeviceScheduleEntry,
  UsageDataPoint,
  OnOffDeviceModalParams,
  OnOffDeviceModalInstance,
  OnOffDeviceModalState,
} from './components/premium-modals/on-off-device';

export {
  ON_OFF_DEVICE_PROFILES,
  DEVICE_CONFIG as ON_OFF_DEVICE_CONFIG,
  DEFAULT_DEVICE_CONFIG as ON_OFF_DEFAULT_DEVICE_CONFIG,
  isOnOffDeviceProfile,
  getDeviceConfig as getOnOffDeviceConfig,
  getDeviceType as getOnOffDeviceType,
  getModalTitle as getOnOffModalTitle,
  DEFAULT_MODAL_STATE as ON_OFF_DEFAULT_MODAL_STATE,
  ON_OFF_MODAL_CSS_PREFIX,
  injectOnOffDeviceModalStyles,
} from './components/premium-modals/on-off-device';

// RFC-0167: On/Off Timeline Chart (for On/Off Device Modal)
export {
  createOnOffTimelineChart,
  renderOnOffTimelineChart,
  initOnOffTimelineTooltips,
  generateMockOnOffTimelineData,
  ONOFF_TIMELINE_CSS_PREFIX,
  injectOnOffTimelineStyles,
} from './components/on-off-timeline-chart';

export type {
  OnOffActivationPoint,
  OnOffTimelineSegment,
  OnOffTimelineData,
  OnOffTimelineChartConfig,
  OnOffTimelineChartInstance,
  OnOffTimelineChartParams,
} from './components/on-off-timeline-chart';

// RFC-0168: Ambiente Detail Modal
export {
  createAmbienteDetailModal,
  openAmbienteDetailModal,
  AMBIENTE_MODAL_CSS_PREFIX,
  injectAmbienteModalStyles,
} from './components/ambiente-detail-modal';

export type {
  AmbienteData as AmbienteDetailData,
  AmbienteDetailModalConfig,
  AmbienteDetailModalInstance,
  AmbienteEnergyDevice,
  AmbienteRemoteDevice,
  AmbienteHierarchyNode,
  AmbienteChildDevice,
} from './components/ambiente-detail-modal';

// RFC-0170: Ambiente Group Modal (aggregated sub-ambientes view)
export {
  createAmbienteGroupModal,
  openAmbienteGroupModal,
  buildAmbienteGroupData,
  calculateGroupMetrics,
  AMBIENTE_GROUP_CSS_PREFIX,
  injectAmbienteGroupModalStyles,
} from './components/ambiente-group-modal';

export type {
  AmbienteGroupData,
  AmbienteGroupModalConfig,
  AmbienteGroupModalInstance,
  SubAmbienteItem,
  AggregatedGroupMetrics,
} from './components/ambiente-group-modal';

// RFC-0173: Premium Sidebar Menu Component
export {
  createSidebarMenu,
  SidebarMenuController,
  SidebarMenuView,
  SIDEBAR_MENU_CSS_PREFIX,
  injectSidebarMenuStyles,
  SIDEBAR_ICONS,
  getIcon as getSidebarIcon,
  DEFAULT_SIDEBAR_CONFIG,
} from './components/sidebar-menu';

export type {
  SidebarThemeMode,
  SidebarState,
  SidebarMenuItem,
  SidebarMenuSection,
  SidebarHeaderConfig,
  SidebarFooterConfig,
  SidebarMenuConfig,
  SidebarMenuInstance,
} from './components/sidebar-menu';

// RFC-0174: Integrations Modal (iFrame tabs for external integrations)
export { openIntegrationsModal } from './components/premium-modals/integrations';
export type {
  IntegrationsModalOptions,
  IntegrationsModalInstance,
  IntegrationsThemeMode,
  IntegrationTab,
  IntegrationTabId,
} from './components/premium-modals/integrations';
export { DEFAULT_INTEGRATION_TABS } from './components/premium-modals/integrations';

// RFC-0175: Alarm Service (Alarms Backend integration — MTBF, MTTR, Availability)
export { AlarmService } from './services/alarm';
export type {
  AvailabilityResponse,
  AvailabilitySummary,
  AvailabilityFleet,
  DeviceAvailability,
  AvailabilityParams,
  AvailabilityStatus,
} from './services/alarm';
