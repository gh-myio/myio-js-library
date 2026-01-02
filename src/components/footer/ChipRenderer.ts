/**
 * RFC-0115: Footer Component Library
 * Chip rendering utilities for the Footer Component
 */

import { SelectedEntity } from './types';

/**
 * X icon SVG for remove button
 */
const X_ICON_SVG = `
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="6" x2="6" y2="18"></line>
  <line x1="6" y1="6" x2="18" y2="18"></line>
</svg>
`;

/**
 * ChipRenderer class for creating and managing chip elements
 */
export class ChipRenderer {
  /**
   * Create a chip element for a selected entity
   */
  createChip(entity: SelectedEntity): HTMLElement {
    const chip = document.createElement('div');
    chip.className = 'myio-footer-chip';
    chip.dataset.entityId = entity.id;

    // Content container
    const content = document.createElement('div');
    content.className = 'myio-footer-chip-content';

    // Name
    const name = document.createElement('span');
    name.className = 'myio-footer-chip-name';
    name.textContent = this.formatName(entity);

    // Value
    const value = document.createElement('span');
    value.className = 'myio-footer-chip-value';
    value.textContent = this.formatValue(entity.lastValue, entity.unit);

    content.appendChild(name);
    content.appendChild(value);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'myio-footer-chip-remove';
    removeBtn.type = 'button';
    removeBtn.title = `Remover ${entity.name}`;
    removeBtn.setAttribute('aria-label', `Remover ${entity.name}`);
    removeBtn.dataset.entityId = entity.id;
    removeBtn.innerHTML = X_ICON_SVG;

    chip.appendChild(content);
    chip.appendChild(removeBtn);

    return chip;
  }

  /**
   * Format entity name with customer name
   */
  formatName(entity: SelectedEntity): string {
    if (entity.customerName) {
      return `${entity.name} ${entity.customerName}`;
    }
    return entity.name;
  }

  /**
   * Format a numeric value with unit for display
   */
  formatValue(value: number | undefined | null, unit?: string): string {
    if (value === undefined || value === null || typeof value !== 'number' || isNaN(value)) {
      return 'Sem dados';
    }

    const formatted = this.formatNumber(value);
    if (unit) {
      return `${formatted} ${unit}`;
    }
    return formatted;
  }

  /**
   * Format a number for display (Brazilian locale)
   */
  formatNumber(value: number): string {
    if (typeof value !== 'number' || isNaN(value)) return '0';

    // For large values (>= 1000), use separators
    if (Math.abs(value) >= 1000) {
      return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    }

    // For small values, show up to 2 decimal places
    const fixed = value.toFixed(2);
    // Remove trailing zeros after decimal
    return fixed.replace(/\.?0+$/, '');
  }

  /**
   * Create empty state element
   */
  createEmptyState(message: string): HTMLElement {
    const emptyEl = document.createElement('span');
    emptyEl.className = 'myio-footer-empty';
    emptyEl.textContent = message;
    return emptyEl;
  }
}

/**
 * Singleton instance
 */
export const chipRenderer = new ChipRenderer();
