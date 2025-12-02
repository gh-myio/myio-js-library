// src/thingsboard/main-dashboard-shopping/v-4.0.0/card/head-office/card-head-office.types.ts
// TypeScript type definitions for Head Office card component

/**
 * Entity object representing a device/entity with its metrics and metadata
 */
export interface EntityObject {
  /** Unique identifier for the entity */
  entityId: string;
  
  /** Display name for the entity (e.g., "Elevador Social Norte 01") */
  labelOrName: string;
  
  /** Device identifier code (e.g., "ELV-002") */
  deviceIdentifier?: string;
  
  /** Type of entity (typically "DEVICE") */
  entityType?: string;
  
  /** Device type for icon mapping (e.g., "ELEVATOR", "ESCADA_ROLANTE", "CHILLER") */
  deviceType?: string;
  
  /** Slave ID for device communication */
  slaveId?: string | number;
  
  /** Ingestion ID for data processing */
  ingestionId?: string | number;
  
  /** Central system ID */
  centralId?: string;
  
  /** Central system name */
  centralName?: string;

  // Primary metric
  /** Current value (e.g., power consumption in kW) */
  val?: number | null;
  
  /** Type of the primary value for formatting */
  valType?: 'power_kw' | 'flow_m3h' | 'temp_c' | 'custom';
  
  /** Timestamp of the primary value (milliseconds since epoch) */
  timaVal?: number | null;

  // Efficiency (0..100)
  /** Efficiency percentage (0-100) */
  perc?: number;

  // Status
  /** Connection/operational status */
  connectionStatus?: 'ONLINE' | 'OFFLINE' | 'ALERT' | 'FAILURE' | 'RUNNING' | 'PAUSED';
  
  /** Timestamp of status change (milliseconds since epoch) */
  connectionStatusTime?: number;

  // Secondary metrics
  /** Temperature in Celsius */
  temperatureC?: number | null;
  
  /** Operation hours (decimal hours, e.g., 12.847) */
  operationHours?: number | null;

  // Optional dictionary for updated IDs
  /** Updated identifiers mapping */
  updatedIdentifiers?: Record<string, string>;
}

/**
 * Internationalization labels map
 */
export interface I18NMap {
  // Status labels (with icons)
  in_operation: string;
  standby: string;
  alert: string;
  failure: string;
  maintenance: string;
  not_installed: string;
  offline: string;

  // Metric labels
  efficiency: string;
  temperature: string;
  operation_time: string;
  updated: string;
  current_suffix: string;

  // Menu labels
  menu_dashboard: string;
  menu_report: string;
  menu_settings: string;
}

/**
 * Default i18n labels (Portuguese) with icons
 * Icons are prefixed to labels for visual clarity
 */
export const DEFAULT_I18N: I18NMap = {
  // Status labels with icons
  in_operation: '⚡ Em funcionamento',
  standby: '💤 Em standby',
  alert: '⚠️ Alerta',
  failure: '🚨 Falha',
  maintenance: '🔧 Manutenção',
  not_installed: '📦 Não instalado',
  offline: '📡 Offline',

  // Metric labels
  efficiency: 'Eficiência',
  temperature: 'Temperatura',
  operation_time: 'Tempo em operação',
  updated: 'Atualizado',
  current_suffix: 'Atual',

  // Menu labels
  menu_dashboard: 'Dashboard',
  menu_report: 'Relatório',
  menu_settings: 'Configurações'
};

/**
 * Parameters for the renderCardCompenteHeadOffice function
 */
export interface RenderCardParams {
  /** Entity object with device data and metrics */
  entityObject: EntityObject;
  
  /** Callback for dashboard action in menu */
  handleActionDashboard?: (ev: Event, entity: EntityObject) => void;
  
  /** Callback for report action in menu */
  handleActionReport?: (ev: Event, entity: EntityObject) => void;
  
  /** Callback for settings action in menu */
  handleActionSettings?: (ev: Event, entity: EntityObject) => void;
  
  /** Callback for selection checkbox toggle */
  handleSelect?: (checked: boolean, entity: EntityObject) => void;
  
  /** Callback for info icon click */
  handInfo?: (ev: Event, entity: EntityObject) => void;
  
  /** Callback for card body click */
  handleClickCard?: (ev: Event, entity: EntityObject) => void;
  
  /** Enable new component features */
  useNewComponents?: boolean;
  
  /** Enable selection checkbox */
  enableSelection?: boolean;
  
  /** Enable drag and drop functionality */
  enableDragDrop?: boolean;
  
  /** Custom i18n labels (partial override) */
  i18n?: Partial<I18NMap>;
}

/**
 * Return type for the renderCardCompenteHeadOffice function
 */
export interface CardHandle {
  /** Update the card with new entity data */
  update(next: Partial<EntityObject>): void;
  
  /** Destroy the card and clean up event listeners */
  destroy(): void;
  
  /** Get the root DOM element */
  getRoot(): HTMLElement;
}

/**
 * Internal state for the card component
 */
export interface CardState {
  entityObject: EntityObject;
  i18n: I18NMap;
  enableSelection: boolean;
  enableDragDrop: boolean;
  useNewComponents: boolean;
}

/**
 * Connection status to chip class mapping
 */
export type StatusChipClass = 'chip--ok' | 'chip--alert' | 'chip--failure' | 'chip--offline';

/**
 * Connection status to card state class mapping
 */
export type CardStateClass = '' | 'is-alert' | 'is-failure';
