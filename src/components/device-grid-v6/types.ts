/**
 * DeviceGridV6 Component Types
 * Simplified grid component for BAS dashboard panels (motors, etc.)
 */

import type { CardGridItem, CardGridCustomStyle } from '../card-grid-panel/CardGridPanel';

// Re-export for convenience
export type { CardGridItem, CardGridCustomStyle };

// ============================================
// SORT MODE
// ============================================

export type SortMode = 'alpha_asc' | 'alpha_desc' | 'status_online' | 'status_offline';

// ============================================
// STATS
// ============================================

export interface DeviceGridV6Stats {
  total: number;
  filtered: number;
  online: number;
  offline: number;
  noInfo: number;
}

// ============================================
// COMPONENT PARAMS
// ============================================

export interface DeviceGridV6Params {
  /** Host element to mount into */
  container: HTMLElement;
  /** Panel title */
  title: string;
  /** Initial items */
  items?: CardGridItem[];
  /** Custom card style applied to every card */
  cardCustomStyle?: CardGridCustomStyle;
  /** Callback when a card is clicked */
  handleClickCard?: (item: CardGridItem) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Min card width for grid (default: 140px) */
  gridMinCardWidth?: string;
  /** Show temp range tooltip on cards */
  showTempRangeTooltip?: boolean;
  /** Enable debug logging */
  debugActive?: boolean;
  /** Callback when stats change */
  onStatsUpdate?: (stats: DeviceGridV6Stats) => void;
}

// ============================================
// COMPONENT INSTANCE (public API)
// ============================================

export interface DeviceGridV6Instance {
  /** Root DOM element */
  element: HTMLElement;
  /** Replace all items and re-render */
  updateItems: (items: CardGridItem[]) => void;
  /** Update panel title */
  setTitle: (title: string) => void;
  /** Get root element */
  getElement: () => HTMLElement;
  /** Set search term programmatically */
  setSearchTerm: (term: string) => void;
  /** Set sort mode programmatically */
  setSortMode: (mode: SortMode) => void;
  /** Get current stats */
  getStats: () => DeviceGridV6Stats;
  /** Tear down */
  destroy: () => void;
}

// ============================================
// STATUS CLASSIFICATION (subset from telemetry-grid-shopping)
// ============================================

const ONLINE_STATUSES = ['power_on', 'online', 'normal', 'ok', 'running', 'active'];
const OFFLINE_STATUSES = ['offline'];
const NO_INFO_STATUSES = ['no_info'];

export function getStatusCategory(status: string): 'online' | 'offline' | 'no_info' {
  const s = (status || '').toLowerCase();
  if (ONLINE_STATUSES.includes(s)) return 'online';
  if (OFFLINE_STATUSES.includes(s)) return 'offline';
  // anything else (no_info, waiting, unknown, '') → no_info
  return 'no_info';
}
