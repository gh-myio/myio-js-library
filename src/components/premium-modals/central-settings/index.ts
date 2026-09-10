/**
 * Central Settings Modal — literally `extends SettingsModalView`
 * (src/components/premium-modals/settings/SettingsModalView.ts, the device
 * settings modal). See CentralSettingsModal.ts's file doc for the mechanics
 * and the current list of not-yet-customized device-shaped rough edges.
 */
export { openCentralSettingsModal, CentralSettingsModal } from './CentralSettingsModal';
export type {
  CentralSettingsModalParams,
  CentralSettingsModalInstance,
  CentralSettingsModalLabels,
} from './CentralSettingsModal';

export type {
  CentralSettingsData,
  CentralSettingsValidationError,
  CentralSettingsPersistResult,
} from './utils';

export { minutesToMs, msToMinutes, validateCentralSettings } from './utils';
