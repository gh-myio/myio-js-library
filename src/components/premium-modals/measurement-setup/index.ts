// RFC-0108: Measurement Setup Modal - Public Exports

export { openMeasurementSetupModal } from './openMeasurementSetupModal';
export { MeasurementSetupView } from './MeasurementSetupView';
export { MeasurementSetupPersister } from './MeasurementSetupPersister';

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
  PersistResult as MeasurementSetupPersistResult,
} from './types';

export {
  WATER_UNITS,
  ENERGY_UNITS,
  TEMPERATURE_UNITS,
  DECIMAL_OPTIONS,
  DOMAIN_CONFIG,
  DEFAULT_SETTINGS as DEFAULT_MEASUREMENT_SETTINGS,
} from './types';
