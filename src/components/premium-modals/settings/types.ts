import type { GCDRCustomerBundle } from '../gcdr-sync/types';

export type TbScope = 'CLIENT_SCOPE' | 'SERVER_SCOPE';
export type Domain = 'energy' | 'water' | 'temperature';

export interface OpenDashboardPopupSettingsParams {
  // Device identification
  deviceId: string;
  ingestionId?: string; // Optional for UI display only
  identifier?: string;
  label?: string;
  domain?: Domain; // Domain for the left column section
  deviceType?: string; // Device type for conditional rendering (e.g., TERMOSTATO)
  deviceProfile?: string; // RFC-0076: Device profile for 3F_MEDIDOR fallback (e.g., ELEVADOR, MOTOR)
  customerName?: string; // RFC-0077: Shopping center name to display above device label
  customerId?: string; // RFC-0080: Customer/Shopping ID for fetching GLOBAL mapInstantaneousPower
  mapInstantaneousPower?: object
  deviceMapInstaneousPower?: object

  // RFC-XXXX: SuperAdmin mode - allows editing identifier and offSetTemperature fields
  superadmin?: boolean;

  // RFC-0171: User email for permission check (fields editable only for @myio.com.br domain)
  userEmail?: string;

  // Connection information (from card v5 info panel)
  connectionData?: {
    centralName?: string;
    connectionStatusTime?: string;
    timeVal?: string;
    deviceStatus?: string;
  };

  // Authentication (REQUIRED)
  jwtToken: string; // ThingsBoard JWT token for persistence
  
  // Persistence configuration
  scope?: TbScope; // Default: 'SERVER_SCOPE' for device settings
  
  // Entity-level fields (affect the TB device object)
  entityPatch?: {
    label?: string; // Updates TB device.label via PUT /api/device
  };
  
  // Attribute-level settings (SERVER_SCOPE by default)
  serverScopeAttributes?: Record<string, unknown>; // Namespaced keys: myio.settings.energy.*
  
  // API configuration
  api?: {
    clientId?: string;
    clientSecret?: string;
    dataApiBaseUrl?: string;
    ingestionToken?: string;
    tbBaseUrl?: string; // ThingsBoard base URL, defaults to current origin
  };
  
  // Dependency injection for testing/mocks
  fetcher?: SettingsFetcher;
  persister?: SettingsPersister;
  
  // Event handlers
  onSaved?: (result: PersistResult) => void;
  onClose?: () => void;
  onError?: (error: SettingsError) => void;
  onEvent?: (evt: SettingsEvent) => void; // Analytics/telemetry hook
  
  // UI customization
  ui?: {
    title?: string;
    width?: number | string;
    closeOnBackdrop?: boolean;
    themeTokens?: Record<string, string | number>; // Custom theme variables
    i18n?: { t: (key: string, def?: string) => string }; // Internationalization
    consumptionDecimalPlaces?: number; // Decimal places for consumption values (default: 3)
  };

  /** RFC-0144: If false, annotations onboarding tour is never shown. Default: false */
  enableAnnotationsOnboarding?: boolean;

  // RFC-0180: Raw TB device name (distinct from `label` which is user-editable)
  deviceName?: string;

  // Device timestamps (Unix ms)
  createdTime?: number | null;
  lastActivityTime?: number | null;

  // RFC-0180: GCDR identifiers — required to power the Alarms tab
  gcdrDeviceId?: string;
  gcdrCustomerId?: string;
  gcdrTenantId?: string;
  gcdrApiBaseUrl?: string;
  /** Pre-fetched GCDR bundle from MAIN_VIEW orchestrator */
  prefetchedBundle?: GCDRCustomerBundle | null;
  /** Pre-fetched customer alarms from MAIN_VIEW orchestrator (raw GCDR API format).
   *  AlarmsTab filters by gcdrDeviceId — no per-device fetch needed. */
  prefetchedAlarms?: unknown[] | null;

  // Pre-populate form with existing values
  seed?: {
    label?: string;
    floor?: string;
    identifier?: string; // Store number (read-only)
    maxDailyKwh?: number;
    maxNightKwh?: number;
    maxBusinessKwh?: number;
    minTemperature?: number; // For TERMOSTATO deviceType
    maxTemperature?: number; // For TERMOSTATO deviceType
    offSetTemperature?: number; // RFC-XXXX: Temperature offset (SuperAdmin only, e.g., -20.99, +12.55)
    minWaterLevel?: number; // For CAIXA_DAGUA deviceType (percentage)
    maxWaterLevel?: number; // For CAIXA_DAGUA deviceType (percentage)
  };
}

export interface PersistResult {
  ok: boolean;
  entity?: { 
    ok: boolean; 
    updated?: ('label')[]; 
    error?: { code: string; message: string; cause?: unknown } 
  };
  serverScope?: { 
    ok: boolean; 
    updatedKeys?: string[]; 
    error?: { code: string; message: string; cause?: unknown } 
  };
  timestamp?: string;
}

export interface SettingsError {
  code: 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'AUTH_ERROR' | 'TOKEN_EXPIRED' | 'UNKNOWN_ERROR';
  message: string;
  field?: string;
  userAction?: 'RETRY' | 'RE_AUTH' | 'CONTACT_ADMIN' | 'FIX_INPUT';
  cause?: unknown;
}

export interface SettingsEvent {
  type: 'modal_opened' | 'modal_closed' | 'save_started' | 'save_completed' | 'save_failed' | 'validation_error';
  deviceId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface SettingsFetcher {
  fetchCurrentSettings(deviceId: string, jwtToken: string, scope: TbScope): Promise<{
    entity?: { label?: string; createdTime?: number | null };
    attributes?: Record<string, unknown>;
  }>;
}

export interface SettingsPersister {
  saveEntityLabel(deviceId: string, label: string, jwtToken: string): Promise<{ ok: boolean; error?: SettingsError }>;
  saveServerScopeAttributes(deviceId: string, attributes: Record<string, unknown>, jwtToken: string): Promise<{ ok: boolean; updatedKeys?: string[]; error?: SettingsError }>;
}

export interface ModalConfig {
  title: string;
  width: number | string;
  theme?: 'light' | 'dark';
  closeOnBackdrop?: boolean;
  themeTokens?: Record<string, string | number>;
  i18n?: { t: (key: string, def?: string) => string };
  deviceLabel?: string; // Dynamic label for the left column section
  domain: Domain; // Domain for the left column section
  deviceType?: string; // Device type for conditional rendering (e.g., TERMOSTATO)
  // RFC-0076/0077: deviceProfile fallback when deviceType is 3F_MEDIDOR
  deviceProfile?: string; // Device profile for 3F_MEDIDOR fallback (e.g., ELEVADOR, MOTOR)
  // RFC-0077: Add customer name, device ID, and JWT token for Power Limits feature
  customerName?: string; // Shopping center name to display above device label
  customerId?: string; // RFC-0080: Customer/Shopping ID for fetching GLOBAL mapInstantaneousPower
  mapInstantaneousPower: object; // Map of instantaneous power limits
  deviceMapInstaneousPower: object;
  deviceId?: string; // ThingsBoard device ID for fetching device-level attributes
  jwtToken?: string; // JWT token for API calls
  tbBaseUrl?: string; // ThingsBoard base URL for API calls (defaults to window.location.origin)
  connectionData?: { // Connection info from card v5
    centralName?: string;
    connectionStatusTime?: string;
    timeVal?: string;
    deviceStatus?: string;
    lastDisconnectTime?: string;
  };
  consumptionDecimalPlaces?: number; // Decimal places for consumption values (default: 3)
  superadmin?: boolean; // RFC-XXXX: SuperAdmin mode - allows editing identifier and offSetTemperature fields
  userEmail?: string; // RFC-0171: User email for permission check (fields editable only for @myio.com.br domain)
  /** RFC-0144: If false, annotations onboarding tour is never shown. Default: false */
  enableAnnotationsOnboarding?: boolean;

  // RFC-0180: Raw TB device name shown as muted subtitle in identity card
  deviceName?: string;

  // Device timestamps (Unix ms)
  createdTime?: number | null;
  lastActivityTime?: number | null;

  // RFC-0180: GCDR identifiers — required to power the Alarms tab
  gcdrDeviceId?: string;
  gcdrCustomerId?: string;
  gcdrTenantId?: string;
  gcdrApiBaseUrl?: string;
  /** Pre-fetched GCDR bundle from MAIN_VIEW orchestrator */
  prefetchedBundle?: GCDRCustomerBundle | null;
  /** Pre-fetched customer alarms from MAIN_VIEW orchestrator (raw GCDR API format). */
  prefetchedAlarms?: unknown[] | null;

  onSave: (formData: Record<string, any>) => Promise<void>;
  onClose: () => void;
}
