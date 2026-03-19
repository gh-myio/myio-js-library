// ─── Public Options ───────────────────────────────────────────────────────────

export interface PresetupGatewayOptions {
  /** HTMLElement where the component will be mounted */
  mount: HTMLElement;
  /** UUID of the existing gateway in the Ingestion API */
  gatewayId: string;
  /** OAuth2 client ID for the Ingestion API */
  clientId: string;
  /** OAuth2 client secret for the Ingestion API */
  clientSecret: string;
  /** Base URL of the MyIO Ingestion Management API */
  ingestionApiUrl?: string;
  /** Base URL of the MyIO Ingestion Auth API */
  ingestionAuthUrl?: string;
  /** Base URL of the MyIO Provisioning API */
  provisioningApiUrl?: string;
  /** Called after a successful full sync (Ingestion + Provisioning) */
  onSyncComplete?: (result: SyncResult) => void;
  /** Called on any unrecoverable error */
  onError?: (error: Error) => void;
}

// ─── Public Instance ──────────────────────────────────────────────────────────

export interface PresetupGatewayInstance {
  /** Re-fetch device list from Ingestion API */
  refresh(): Promise<void>;
  /** Unmount the component and clean up DOM */
  destroy(): void;
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface GatewayInfo {
  id: string;
  name: string;
  customerId: string;
  assetId: string;
  frequency: number;
  /** [ddd, byte1, byte2, byte3] — used in QR URL and provisioning payload */
  centralId?: number[];
  /** Yggdrasil IPv6 address — required for physical provisioning via SSH */
  ipv6?: string;
  credentials?: {
    mqtt?: {
      clientId: string;
      username: string;
      password: string;
      server?: string;
    };
  };
}

export type DeviceType =
  | '3F_MEDIDOR'
  | 'HIDROMETRO'
  | 'COMPRESSOR'
  | 'VENTILADOR'
  | 'TERMOSTATO'
  | 'MOTOR'
  | 'ESCADA_ROLANTE'
  | 'ELEVADOR'
  | 'SOLENOIDE'
  | 'CONTROLE_REMOTO'
  | 'CAIXA_D_AGUA'
  | 'CONTROLE_AUTOMACAO';

export const DEVICE_TYPES: DeviceType[] = [
  '3F_MEDIDOR',
  'HIDROMETRO',
  'COMPRESSOR',
  'VENTILADOR',
  'TERMOSTATO',
  'MOTOR',
  'ESCADA_ROLANTE',
  'ELEVADOR',
  'SOLENOIDE',
  'CONTROLE_REMOTO',
  'CAIXA_D_AGUA',
  'CONTROLE_AUTOMACAO',
];

export interface DeviceMultipliers {
  amperage?: number;
  voltage?: number;
  power?: number;
  temperature?: number;
}

export interface PresetupDevice {
  /** Temporary local key for UI tracking */
  _localId: string;
  /** Ingestion API device ID (populated after sync) */
  ingestion_device_id?: string;
  /** UUID used as device `id` in Ingestion API and for QR code construction */
  uuid: string;
  name: string;
  type: DeviceType;
  slaveId: number;
  addr_low?: string;
  addr_high?: string;
  identifier?: string;
  multipliers?: DeviceMultipliers;
  /** Whether the device came from the API or was added locally */
  status: 'remote' | 'local' | 'synced' | 'error';
  statusMessage?: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface IngestionApiDevice {
  id: string;
  name: string;
  description?: string;
  deviceType: 'energy' | 'water';
  customerId: string;
  assetId?: string;
  gatewayId: string;
  slaveId: number;
  multipliers?: DeviceMultipliers;
  status?: string;
}

export interface LookupPair {
  gatewayId: string;
  slaveId: number;
}

export interface LookupResult {
  gatewayId: string;
  slaveId: number;
  deviceId: string | null;
}

// ─── Sync result ──────────────────────────────────────────────────────────────

export interface SyncResult {
  ingestion: {
    success: boolean;
    created: number;
    updated: number;
    failed: number;
  };
  provisioning: {
    success: boolean;
    jobId?: string;
    skipped?: boolean;
    skipReason?: string;
  };
}

// ─── Internal auth config ─────────────────────────────────────────────────────

export interface AuthConfig {
  authUrl: string;
  clientId: string;
  clientSecret: string;
  renewSkewSeconds: number;
  retryBaseMs: number;
  retryMaxAttempts: number;
}
