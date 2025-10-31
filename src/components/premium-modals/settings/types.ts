export type TbScope = 'CLIENT_SCOPE' | 'SERVER_SCOPE';
export type Domain = 'energy' | 'water' | 'temperature';

export interface OpenDashboardPopupSettingsParams {
  // Device identification
  deviceId: string;
  ingestionId?: string; // Optional for UI display only
  identifier?: string;
  label?: string;
  domain?: Domain; // Domain for the left column section


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
  };
  
  // Pre-populate form with existing values
  seed?: {
    label?: string;
    floor?: string;
    identifier?: string; // Store number (read-only)
    maxDailyKwh?: number;
    maxNightKwh?: number;
    maxBusinessKwh?: number;
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
    entity?: { label?: string };
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
  connectionData?: { // Connection info from card v5
    centralName?: string;
    connectionStatusTime?: string;
    timeVal?: string;
    deviceStatus?: string;
  };
  onSave: (formData: Record<string, any>) => Promise<void>;
  onClose: () => void;
}
