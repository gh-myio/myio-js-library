// Format utilities
export { formatEnergy, formatAllInSameUnit } from './format/energy';
export { fmtPerc } from './format/percentage';
export { formatNumberReadable } from './format/numbers';
export { 
  formatWaterVolumeM3, 
  formatTankHeadFromCm, 
  calcDeltaPercent, 
  formatWaterByGroup, 
  formatAllInSameWaterUnit 
} from './format/water';

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
export { getValueByDatakey, getValueByDatakeyLegacy, findValue } from './utils/getValueByDatakey';

// Device Status utilities
export {
  DeviceStatusType,
  ConnectionStatusType,
  deviceStatusIcons,
  waterDeviceStatusIcons,
  connectionStatusIcons,
  mapDeviceToConnectionStatus,
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
  TemperatureDevice,
  TemperatureTelemetry,
  TemperatureStats,
  TemperatureGranularity,
  ClampRange
} from './components/temperature';
