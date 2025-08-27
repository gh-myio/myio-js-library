// Format utilities
export { formatEnergy, formatAllInSameUnit } from './format/energy';
export { fmtPerc } from './format/percentage';
export { formatNumberReadable } from './format/numbers';
export { 
  formatWaterVolumeM3, 
  formatTankHeadFromCm, 
  calcDeltaPercent, 
  formatEnergyByGroup, 
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

// ThingsBoard utilities
export {
  getEntityInfoAndAttributesTB,
  type TBFetchOptions,
  type TBEntityInfo
} from './thingsboard/entity';

// Re-export existing utilities
export { detectDeviceType, getAvailableContexts, addDetectionContext } from './utils/deviceType';
export { addNamespace } from './utils/namespace';
export { fmtPerc as fmtPercLegacy, toFixedSafe } from './utils/numbers';
export { normalizeRecipients } from './utils/strings';

// Codec utilities
export { decodePayload } from './codec/decodePayload';

// Network utilities
export { http, fetchWithRetry } from './net/http';

// Codec utilities (additional exports)
export { decodePayloadBase64Xor } from './codec/decodePayload';

// Utils namespace exports
export * as strings from './utils/strings';
export * as numbers from './utils/numbers';
