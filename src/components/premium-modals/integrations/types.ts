/**
 * RFC-0174: Integrations Modal Types
 */

/**
 * Theme mode for the modal
 */
export type IntegrationsThemeMode = 'light' | 'dark';

/**
 * Tab identifier
 */
export type IntegrationTabId = 'chiller' | 'vrf' | 'gerador';

/**
 * Configuration for a single integration tab
 */
export interface IntegrationTab {
  /** Unique identifier */
  id: IntegrationTabId;
  /** Display label */
  label: string;
  /** URL to load in iframe */
  url: string;
}

/**
 * Options for opening the integrations modal
 */
export interface IntegrationsModalOptions {
  /** Theme mode (light or dark) */
  theme?: IntegrationsThemeMode;
  /** Default tab to show on open */
  defaultTab?: IntegrationTabId;
  /** Callback when modal is closed */
  onClose?: () => void;
  /** Callback when tab changes */
  onTabChange?: (tabId: IntegrationTabId) => void;
}

/**
 * Instance returned by openIntegrationsModal
 */
export interface IntegrationsModalInstance {
  /** Close the modal */
  close: () => void;
  /** The modal container element */
  element: HTMLElement;
  /** Register event handler */
  on: (event: 'close', handler: () => void) => void;
  /** Get current active tab */
  getActiveTab: () => IntegrationTabId;
  /** Switch to a specific tab */
  setActiveTab: (tabId: IntegrationTabId) => void;
}

/**
 * Default integration tabs configuration
 */
export const DEFAULT_INTEGRATION_TABS: IntegrationTab[] = [
  { id: 'chiller', label: 'CHILLER', url: 'https://melicidade1.myio-bas.com/' },
  { id: 'vrf', label: 'VRF', url: 'https://melicidade2.myio-bas.com/' },
  { id: 'gerador', label: 'GERADOR', url: 'https://melicidade3.myio-bas.com/' },
];
