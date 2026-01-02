/**
 * RFC-0115: Footer Component Library
 * Main entry point - creates the Footer Component
 */

import {
  FooterComponentParams,
  FooterComponentInstance,
  FooterThemeMode,
} from './types';
import { FooterView } from './FooterView';
import { FooterController } from './FooterController';

/**
 * Create a Footer Component instance
 *
 * @example
 * ```typescript
 * import { createFooterComponent } from 'myio-js-library';
 *
 * const footer = createFooterComponent({
 *   container: document.getElementById('footer-container'),
 *   theme: 'dark',
 *   maxSelections: 6,
 *   onCompareClick: (entities, unitType) => {
 *     console.log('Compare clicked:', entities.length, unitType);
 *   },
 *   onSelectionChange: (entities) => {
 *     console.log('Selection changed:', entities.length);
 *   },
 * });
 *
 * // Later: cleanup
 * footer.destroy();
 * ```
 */
export function createFooterComponent(params: FooterComponentParams): FooterComponentInstance {
  // Validate container
  if (!params.container) {
    throw new Error('[FooterComponent] Container element is required');
  }

  if (!(params.container instanceof HTMLElement)) {
    throw new Error('[FooterComponent] Container must be an HTMLElement');
  }

  // Create view
  const view = new FooterView(params);

  // Create controller
  const controller = new FooterController(params, view);

  // Render the component
  view.render();

  // Build instance object
  const instance: FooterComponentInstance = {
    // Selection methods
    addEntity: (entity) => controller.addEntity(entity),
    removeEntity: (entityId) => controller.removeEntity(entityId),
    clearSelection: () => controller.clearSelection(),
    getSelectedEntities: () => controller.getSelectedEntities(),
    getSelectionCount: () => controller.getSelectionCount(),

    // State methods
    getCurrentUnitType: () => controller.getCurrentUnitType(),
    setDateRange: (start, end) => controller.setDateRange(start, end),
    setTheme: (theme: FooterThemeMode) => view.setTheme(theme),
    getTheme: () => view.getTheme(),

    // UI methods
    openCompareModal: () => controller.openCompareModal(),
    showLimitAlert: () => controller.showLimitAlert(),
    showMixedTypesAlert: () => controller.showMixedTypesAlert(),
    hideAlert: () => controller.hideAlert(),

    // Lifecycle
    destroy: () => {
      controller.destroy();
      view.destroy();
    },

    // Element reference
    element: view.getElement(),
  };

  return instance;
}
