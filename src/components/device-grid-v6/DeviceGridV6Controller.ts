/**
 * DeviceGridV6 Controller
 * Business logic: search filtering, sorting, stats calculation
 */

import type { CardGridItem } from '../card-grid-panel/CardGridPanel';
import type { SortMode, DeviceGridV6Stats } from './types';
import { getStatusCategory } from './types';

export class DeviceGridV6Controller {
  private allItems: CardGridItem[] = [];
  private filteredItems: CardGridItem[] = [];
  private searchTerm = '';
  private sortMode: SortMode = 'alpha_asc';
  private debugActive: boolean;

  private onStatsUpdate?: (stats: DeviceGridV6Stats) => void;

  constructor(options: {
    items?: CardGridItem[];
    debugActive?: boolean;
    onStatsUpdate?: (stats: DeviceGridV6Stats) => void;
  }) {
    this.allItems = options.items || [];
    this.debugActive = options.debugActive || false;
    this.onStatsUpdate = options.onStatsUpdate;
    this.applyPipeline();
  }

  private log(...args: unknown[]): void {
    if (this.debugActive) {
      console.log('[DeviceGridV6Controller]', ...args);
    }
  }

  // =========================================================================
  // Items
  // =========================================================================

  updateItems(items: CardGridItem[]): void {
    this.log('updateItems:', items.length);
    this.allItems = items;
    this.applyPipeline();
  }

  getFilteredItems(): CardGridItem[] {
    return this.filteredItems;
  }

  // =========================================================================
  // Search
  // =========================================================================

  setSearchTerm(term: string): void {
    this.log('setSearchTerm:', term);
    this.searchTerm = term;
    this.applyPipeline();
  }

  getSearchTerm(): string {
    return this.searchTerm;
  }

  // =========================================================================
  // Sort
  // =========================================================================

  setSortMode(mode: SortMode): void {
    this.log('setSortMode:', mode);
    this.sortMode = mode;
    this.applyPipeline();
  }

  getSortMode(): SortMode {
    return this.sortMode;
  }

  // =========================================================================
  // Stats
  // =========================================================================

  getStats(): DeviceGridV6Stats {
    let online = 0;
    let offline = 0;
    let noInfo = 0;

    this.filteredItems.forEach((item) => {
      const status = String((item.entityObject as Record<string, unknown>).deviceStatus || '');
      const cat = getStatusCategory(status);
      if (cat === 'online') online++;
      else if (cat === 'offline') offline++;
      else noInfo++;
    });

    return {
      total: this.allItems.length,
      filtered: this.filteredItems.length,
      online,
      offline,
      noInfo,
    };
  }

  // =========================================================================
  // Pipeline: search → sort
  // =========================================================================

  private applyPipeline(): void {
    let result = [...this.allItems];

    // 1. Search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter((item) => {
        const eo = item.entityObject as Record<string, unknown>;
        const label = String(eo.labelOrName || '').toLowerCase();
        const id = String(eo.deviceIdentifier || item.id || '').toLowerCase();
        return label.includes(term) || id.includes(term);
      });
    }

    // 2. Sort
    result = this.sortItems(result, this.sortMode);

    this.filteredItems = result;
    this.log('pipeline result:', result.length, 'items');

    // Notify
    if (this.onStatsUpdate) {
      this.onStatsUpdate(this.getStats());
    }
  }

  private sortItems(items: CardGridItem[], mode: SortMode): CardGridItem[] {
    return [...items].sort((a, b) => {
      const aEo = a.entityObject as Record<string, unknown>;
      const bEo = b.entityObject as Record<string, unknown>;
      const aName = String(aEo.labelOrName || '').toLowerCase();
      const bName = String(bEo.labelOrName || '').toLowerCase();
      const aStatus = getStatusCategory(String(aEo.deviceStatus || ''));
      const bStatus = getStatusCategory(String(bEo.deviceStatus || ''));

      switch (mode) {
        case 'alpha_asc':
          return aName.localeCompare(bName);
        case 'alpha_desc':
          return bName.localeCompare(aName);
        case 'status_online': {
          const order: Record<string, number> = { online: 0, offline: 1, no_info: 2 };
          const diff = (order[aStatus] ?? 2) - (order[bStatus] ?? 2);
          return diff !== 0 ? diff : aName.localeCompare(bName);
        }
        case 'status_offline': {
          const order: Record<string, number> = { offline: 0, online: 1, no_info: 2 };
          const diff = (order[aStatus] ?? 2) - (order[bStatus] ?? 2);
          return diff !== 0 ? diff : aName.localeCompare(bName);
        }
        default:
          return 0;
      }
    });
  }
}
