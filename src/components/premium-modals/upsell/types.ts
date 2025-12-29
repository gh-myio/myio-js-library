/**
 * RFC-0109: Upsell Post-Setup Modal Types
 */

import type { InferredDeviceType } from '../../../classify/deviceType';

/** Modal configuration parameters */
export interface UpsellModalParams {
  /** ThingsBoard JWT token (from localStorage.jwt_token) */
  thingsboardToken: string;

  /** Ingestion API JWT token (pre-authenticated) */
  ingestionToken: string;

  /** ThingsBoard API base URL (optional, defaults to current instance) */
  tbApiBase?: string;

  /** Ingestion API base URL (optional) */
  ingestionApiBase?: string;

  /** Callback when attributes are saved */
  onSave?: (deviceId: string, attributes: DeviceAttributes) => void;

  /** Callback when modal is closed */
  onClose?: () => void;

  /** Custom styles override */
  styles?: UpsellModalStyles;

  /** Language (default: 'pt') */
  lang?: 'pt' | 'en';
}

/** Modal instance returned after creation */
export interface UpsellModalInstance {
  /** Closes the modal */
  close: () => void;

  /** Gets current step (1-3) */
  getStep: () => number;

  /** Gets selected customer */
  getCustomer: () => Customer | null;

  /** Gets selected device */
  getDevice: () => Device | null;

  /** Gets modal container element */
  getContainer: () => HTMLElement;
}

/** ThingsBoard Entity ID structure */
export interface TbEntityId {
  entityType: string;
  id: string;
}

/** Customer entity (matches ThingsBoard API response) */
export interface Customer {
  id: TbEntityId;
  name: string;
  title?: string;
  cnpj?: string;
  createdTime?: number;
  parentCustomerId?: TbEntityId | null;
  tenantId?: TbEntityId;
  ownerId?: TbEntityId;
  additionalInfo?: Record<string, unknown>;
}

/** Device entity (matches ThingsBoard API response) */
export interface Device {
  id: TbEntityId;
  name: string;
  type?: string;
  label?: string;
  createdTime?: number;
  deviceProfileId?: TbEntityId;
  deviceProfileName?: string;
  customerId?: TbEntityId;
  tenantId?: TbEntityId;
  /** Server-scope attributes loaded separately */
  serverAttrs?: DeviceServerAttrs;
  /** Latest telemetry loaded separately */
  latestTelemetry?: DeviceLatestTelemetry;
}

/** Server-scope attributes for device (loaded separately) */
export interface DeviceServerAttrs {
  deviceType?: string;
  deviceProfile?: string;
  centralId?: string;
  centralName?: string;
  slaveId?: string | number;
  identifier?: string;
  ingestionId?: string;
}

/** Latest telemetry for device (loaded separately) */
export interface DeviceLatestTelemetry {
  pulses?: { value: number; ts: number };
  consumption?: { value: number; ts: number };
  temperature?: { value: number; ts: number };
  connectionStatus?: { value: 'online' | 'offline' | 'waiting' | 'bad'; ts: number };
}

/** Server-scope device attributes */
export interface DeviceAttributes {
  centralId?: string;
  slaveId?: number | string;
  centralName?: string;
  deviceType?: InferredDeviceType | string;
  deviceProfile?: string;
  identifier?: string;
  ingestionId?: string;
}

/** Device relation (TO direction) */
export interface DeviceRelation {
  toEntityType: 'ASSET' | 'CUSTOMER';
  toEntityId: string;
  toEntityName?: string;
  parentType?: 'CUSTOMER' | 'ASSET' | null;
  parentName?: string;
}

/** Ingestion device record */
export interface IngestionDevice {
  id: string;
  centralId: string;
  slaveId: number;
  customerId?: string;
}

/** Validation status for an attribute */
export type ValidationStatus = 'valid' | 'warning' | 'error' | 'unknown';

/** Attribute validation result */
export interface AttributeValidation {
  key: string;
  value: unknown;
  status: ValidationStatus;
  message?: string;
  suggestion?: unknown;
}

/** Complete validation map for a device */
export interface ValidationMap {
  attributes: AttributeValidation[];
  relation: {
    status: ValidationStatus;
    relation: DeviceRelation | null;
    message?: string;
  };
  owner: {
    status: ValidationStatus;
    ownerId: string | null;
    expectedOwnerId: string;
    message?: string;
  };
}

/** Custom styles for the modal */
export interface UpsellModalStyles {
  primaryColor?: string;
  primaryDarkColor?: string;
  successColor?: string;
  warningColor?: string;
  dangerColor?: string;
  borderRadius?: string;
  fontFamily?: string;
}

/** Ingestion cache entry */
export interface IngestionCache {
  customerId: string;
  devices: IngestionDevice[];
  timestamp: number;
  ttl: number;
}

/** API error response */
export interface UpsellModalError {
  code: string;
  message: string;
  details?: unknown;
}
