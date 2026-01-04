/**
 * CustomerCardV1 Types
 * Types for the customer card component used in Welcome Modal
 */

export type ThemeMode = 'dark' | 'light';

export interface CustomerCardDeviceCounts {
  energy?: number | null;
  energyConsumption?: number | null;
  water?: number | null;
  waterConsumption?: number | null;
  temperature?: number | null;
  temperatureAvg?: number | null;
}

export interface CustomerCardMetaCounts {
  users?: number;
  alarms?: number;
  notifications?: number;
}

export interface CustomerCardData {
  title: string;
  subtitle?: string;
  dashboardId: string;
  entityId: string;
  entityType?: string;
  bgImageUrl?: string;
  buttonId?: string;
  deviceCounts?: CustomerCardDeviceCounts;
  metaCounts?: CustomerCardMetaCounts;
}

export interface CustomerCardV1Params {
  /** Container element to render the card into */
  container: HTMLElement;
  /** Card data */
  card: CustomerCardData;
  /** Card index (for data attributes) */
  index: number;
  /** Theme mode */
  themeMode?: ThemeMode;
  /** Click handler */
  onClick?: (card: CustomerCardData) => void;
  /** Badge click handler (for tooltips) */
  onBadgeClick?: (type: string, card: CustomerCardData, index: number) => void;
  /** Enable lazy loading for background images */
  enableLazyLoading?: boolean;
  /** Debug mode */
  debugActive?: boolean;
}

export interface CustomerCardV1Instance {
  /** Update card data */
  update: (card: Partial<CustomerCardData>) => void;
  /** Set theme mode */
  setThemeMode: (mode: ThemeMode) => void;
  /** Get the root element */
  getElement: () => HTMLElement;
  /** Destroy the component */
  destroy: () => void;
}
