// FilterableCardGrid.utils.ts
import type { FilterableItem, SortMode } from './FilterableCardGrid.types';

/**
 * Normalize text for search comparison (diacritics and case insensitive)
 */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Filter items based on search term and specified fields
 */
export function filterItems(
  items: FilterableItem[],
  searchTerm: string,
  searchFields: string[] = ['label', 'deviceType']
): FilterableItem[] {
  if (!searchTerm) return items;

  const normalizedQuery = normalizeText(searchTerm);

  return items.filter(item => {
    return searchFields.some(field => {
      const value = item[field];
      if (typeof value === 'string') {
        return normalizeText(value).includes(normalizedQuery);
      }
      return false;
    });
  });
}

/**
 * Sort items according to the specified sort mode
 */
export function sortItems(items: FilterableItem[], mode: SortMode): FilterableItem[] {
  const sorted = [...items];

  const compareLabels = (a: FilterableItem, b: FilterableItem) => {
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) || (a.id > b.id ? 1 : -1);
  };

  const safeConsumption = (value?: number | null) => {
    return value == null ? Number.NEGATIVE_INFINITY : value;
  };

  switch (mode) {
    case 'CONSUMPTION_DESC':
      return sorted.sort((a, b) => {
        const diff = safeConsumption(b.consumption) - safeConsumption(a.consumption);
        return diff !== 0 ? diff : compareLabels(a, b);
      });

    case 'CONSUMPTION_ASC':
      return sorted.sort((a, b) => {
        const diff = safeConsumption(a.consumption) - safeConsumption(b.consumption);
        return diff !== 0 ? diff : compareLabels(a, b);
      });

    case 'ALPHA_ASC':
      return sorted.sort(compareLabels);

    case 'ALPHA_DESC':
      return sorted.sort((a, b) => -compareLabels(a, b));

    default:
      return sorted;
  }
}

/**
 * Debounce function to limit the rate of function execution
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Generate a unique ID for elements
 */
export function generateId(prefix: string = 'myio'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format consumption value for display
 */
export function formatConsumption(value?: number | null): string {
  if (value == null || isNaN(value)) {
    return '—';
  }

  if (value >= 1000) {
    return (value / 1000).toFixed(1) + ' MWh';
  }

  return value.toFixed(1) + ' kWh';
}

/**
 * Format selection counter text
 */
export function formatSelectionCounter(selectedCount: number, totalCount: number): string {
  if (selectedCount === 0) {
    return `${totalCount} ${totalCount === 1 ? 'item' : 'itens'}`;
  }

  if (selectedCount === totalCount) {
    return `Todos os ${totalCount} ${totalCount === 1 ? 'item selecionado' : 'itens selecionados'}`;
  }

  return `${selectedCount} de ${totalCount} ${totalCount === 1 ? 'item selecionado' : 'itens selecionados'}`;
}

/**
 * Check if an element is currently visible in the viewport
 */
export function isElementInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Safely remove an element from the DOM
 */
export function safeRemoveElement(element: HTMLElement | null): void {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * Deep clone an object (simple implementation for FilterableItem)
 */
export function cloneItem(item: FilterableItem): FilterableItem {
  try {
    return JSON.parse(JSON.stringify(item));
  } catch {
    // Fallback for objects with functions or circular references
    return { ...item };
  }
}

/**
 * Validate that a FilterableItem has required properties
 */
export function validateFilterableItem(item: any): item is FilterableItem {
  return (
    item &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.label === 'string' &&
    item.id.length > 0 &&
    item.label.length > 0
  );
}

/**
 * Batch DOM updates for better performance
 */
export function batchDOMUpdates(callback: () => void): void {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(callback);
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(callback, 0);
  }
}