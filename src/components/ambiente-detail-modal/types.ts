/**
 * RFC-0168: Ambiente Detail Modal Types
 * TypeScript types for the ambiente detail modal component
 */

/**
 * Energy device data within an ambiente
 */
export interface AmbienteEnergyDevice {
  id: string;
  name: string;
  label: string;
  deviceType: string;
  deviceProfile?: string;
  consumption: number | null;
  status: string;
  entityId?: string;
  rawData?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}

/**
 * Remote control device data within an ambiente
 */
export interface AmbienteRemoteDevice {
  id: string;
  name: string;
  label: string;
  deviceType: string;
  isOn: boolean;
  status: string;
}

/**
 * Child device in the ambiente hierarchy
 */
export interface AmbienteChildDevice {
  id: string;
  name: string;
  label: string;
  deviceType: string;
  deviceProfile?: string;
  status: string;
  rawData?: Record<string, unknown>;
}

/**
 * Ambiente data passed from the card click
 */
export interface AmbienteData {
  id: string;
  label: string;
  identifier?: string;
  temperature: number | null;
  humidity: number | null;
  consumption: number | null;
  energyDevices: AmbienteEnergyDevice[];
  remoteDevices: AmbienteRemoteDevice[];
  isOn?: boolean;
  hasRemote?: boolean;
  status: 'online' | 'offline' | 'warning';
  hasSetupWarning: boolean;
  devices: AmbienteChildDevice[];
  childDeviceCount: number;
}

/**
 * Source hierarchy node from ASSET_AMBIENT
 */
export interface AmbienteHierarchyNode {
  id: string;
  name: string;
  assetType: 'ASSET_AMBIENT';
  originalLabel: string;
  displayLabel: string;
  devices: AmbienteChildDevice[];
  hasSetupWarning: boolean;
  aggregatedData?: Record<string, unknown>;
}

/**
 * Modal configuration options
 */
export interface AmbienteDetailModalConfig {
  /** Theme mode for the modal */
  themeMode?: 'light' | 'dark';
  /** JWT token for API calls */
  jwtToken?: string;
  /** Show on/off timeline chart */
  showTimelineChart?: boolean;
  /** Callback when remote toggle is clicked */
  onRemoteToggle?: (isOn: boolean, remote: AmbienteRemoteDevice) => void;
  /** Callback when energy device is clicked (closes modal and opens device modal) */
  onEnergyDeviceClick?: (device: AmbienteEnergyDevice) => void;
  /** Callback when modal is closed */
  onClose?: () => void;
  /** i18n translation function */
  i18n?: { t: (key: string, defaultText: string) => string };
}

/**
 * Modal instance returned by createAmbienteDetailModal
 */
export interface AmbienteDetailModalInstance {
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /** Update the ambiente data */
  update: (data: AmbienteData) => void;
  /** Destroy the modal and cleanup */
  destroy: () => void;
}
