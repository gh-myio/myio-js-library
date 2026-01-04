/**
 * CustomerCardV2 Types
 * Types for the Metro UI style customer card component
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

export interface CustomerCardV2Params {
  /** Container element to render the card into */
  container: HTMLElement;
  /** Card data */
  card: CustomerCardData;
  /** Card index (for data attributes) */
  index: number;
  /** Theme mode */
  themeMode?: ThemeMode;
  /** Click handler for the entire card */
  onClick?: (card: CustomerCardData) => void;
  /** Tile click handler */
  onTileClick?: (type: string, card: CustomerCardData, index: number) => void;
  /** Debug mode */
  debugActive?: boolean;
}

export interface CustomerCardV2Instance {
  /** Update card data */
  update: (card: Partial<CustomerCardData>) => void;
  /** Set theme mode */
  setThemeMode: (mode: ThemeMode) => void;
  /** Get the root element */
  getElement: () => HTMLElement;
  /** Destroy the component */
  destroy: () => void;
}

/** Metro tile configuration */
export interface MetroTile {
  type: string;
  icon: string;
  label: string;
  color: string;
  hoverColor: string;
}

/** Default Metro tile colors */
export const METRO_TILE_COLORS: Record<string, { bg: string; hover: string }> = {
  energy: { bg: '#16a34a', hover: '#15803d' },      // Green
  water: { bg: '#2563eb', hover: '#1d4ed8' },       // Blue
  temperature: { bg: '#ea580c', hover: '#c2410c' }, // Orange
  users: { bg: '#7c3aed', hover: '#6d28d9' },       // Purple
  alarms: { bg: '#dc2626', hover: '#b91c1c' },      // Red
  notifications: { bg: '#ca8a04', hover: '#a16207' } // Yellow/Amber
};
