/**
 * RFC-0139: HeaderShopping Component Types
 * Types for the Shopping Dashboard header toolbar component
 */

export type DomainType = 'energy' | 'water' | 'temperature' | null;
export type ThemeMode = 'light' | 'dark';

export interface HeaderShoppingPeriod {
  startISO: string;
  endISO: string;
  granularity: 'hour' | 'day' | 'month';
  tz: string;
}

export interface ContractState {
  isLoaded: boolean;
  isValid: boolean;
  energy?: { total: number };
  water?: { total: number };
  temperature?: { total: number };
}

export interface HeaderShoppingConfigTemplate {
  /** Enable debug logging */
  enableDebugMode?: boolean;
  /** Data API host URL */
  dataApiHost?: string;
  /** Default timezone */
  timezone?: string;
  /** Enable contract status icon */
  showContractStatus?: boolean;
  /** Enable report button */
  showReportButton?: boolean;
  /** Enable force refresh button */
  showForceRefreshButton?: boolean;
}

export interface HeaderShoppingParams {
  /** Container element to mount the component */
  container: HTMLElement;
  /** Theme mode (light/dark), defaults to light */
  themeMode?: ThemeMode;
  /** Initial preset start date */
  presetStart?: Date;
  /** Initial preset end date */
  presetEnd?: Date;
  /** Configuration template */
  configTemplate?: HeaderShoppingConfigTemplate;
  /** ThingsBoard context (optional, for datasource access) */
  tbContext?: {
    datasources?: unknown[];
    data?: unknown[];
    $scope?: Record<string, unknown>;
  };
  /** API credentials */
  credentials?: {
    customerId?: string;
    clientId?: string;
    clientSecret?: string;
    ingestionId?: string;
  };
  /** Callback when load button is clicked */
  onLoad?: (period: HeaderShoppingPeriod) => void;
  /** Callback when force refresh button is clicked */
  onForceRefresh?: () => void;
  /** Callback when report button is clicked */
  onReportClick?: (domain: DomainType) => void;
  /** Callback when date range changes */
  onDateChange?: (period: HeaderShoppingPeriod) => void;
}

export interface HeaderShoppingInstance {
  /** Update the current domain */
  setDomain(domain: DomainType): void;
  /** Get the current domain */
  getDomain(): DomainType;
  /** Update the theme mode */
  setThemeMode(mode: ThemeMode): void;
  /** Get current filter values (dates) */
  getFilters(): {
    startDate: string | null;
    endDate: string | null;
    startAt: string | null;
    endAt: string | null;
    _displayRange: string | null;
  };
  /** Update contract status display */
  updateContractStatus(state: ContractState): void;
  /** Enable/disable controls */
  setControlsEnabled(enabled: boolean): void;
  /** Programmatically click load button */
  triggerLoad(): void;
  /** Programmatically click force refresh */
  triggerForceRefresh(skipConfirmation?: boolean): void;
  /** Destroy the component */
  destroy(): void;
  /** Root element */
  element: HTMLElement;
  /** Event registration */
  on(event: HeaderShoppingEventType, handler: HeaderShoppingEventHandler): void;
  off(event: HeaderShoppingEventType, handler: HeaderShoppingEventHandler): void;
}

export type HeaderShoppingEventType =
  | 'load'
  | 'force-refresh'
  | 'report-click'
  | 'date-change'
  | 'domain-change';

export type HeaderShoppingEventHandler = (...args: unknown[]) => void;

/** CSS class prefix */
export const HEADER_SHOPPING_CSS_PREFIX = 'tbx';

/** Default configuration */
export const DEFAULT_HEADER_SHOPPING_CONFIG: Required<HeaderShoppingConfigTemplate> = {
  enableDebugMode: false,
  dataApiHost: '',
  timezone: 'America/Sao_Paulo',
  showContractStatus: true,
  showReportButton: true,
  showForceRefreshButton: true,
};
