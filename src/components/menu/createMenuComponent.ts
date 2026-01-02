/**
 * RFC-0114: Menu Component Library
 * Main entry function for creating the Menu Component
 */

import { MenuController } from './MenuController';
import { MenuComponentParams, MenuComponentInstance } from './types';

/**
 * Creates a Menu Component and renders it in the specified container
 *
 * @example
 * ```typescript
 * import { createMenuComponent } from 'myio-js-library';
 *
 * const menu = createMenuComponent({
 *   container: document.getElementById('menu-mount')!,
 *   ctx: self.ctx,
 *   configTemplate: {
 *     tabSelecionadoBackgroundColor: '#2F5848',
 *     tabSelecionadoFontColor: '#F2F2F2',
 *     // ... other settings from settingsSchema.json
 *   },
 *   initialTab: 'energy',
 *   initialDateRange: {
 *     start: new Date(2024, 0, 1),
 *     end: new Date(),
 *   },
 *   onTabChange: (tabId, contextId, target) => {
 *     console.log('Tab changed:', tabId, contextId, target);
 *   },
 *   onContextChange: (tabId, contextId, target) => {
 *     console.log('Context changed:', tabId, contextId, target);
 *   },
 *   onDateRangeChange: (start, end) => {
 *     console.log('Date range changed:', start, end);
 *   },
 *   onLoad: () => {
 *     console.log('Load clicked');
 *   },
 * });
 *
 * // Later: update shoppings from datasource
 * menu.updateShoppings([
 *   { name: 'Shopping A', value: 'ing-a', customerId: 'cust-a' },
 *   { name: 'Shopping B', value: 'ing-b', customerId: 'cust-b' },
 * ]);
 *
 * // Programmatic control
 * menu.setActiveTab('water');
 * menu.setDateRange(new Date(2024, 6, 1), new Date());
 *
 * // Cleanup when done
 * menu.destroy();
 * ```
 */
export function createMenuComponent(params: MenuComponentParams): MenuComponentInstance {
  // Validate container
  if (!params.container) {
    throw new Error('[createMenuComponent] Container element is required');
  }

  if (!(params.container instanceof HTMLElement)) {
    throw new Error('[createMenuComponent] Container must be an HTMLElement');
  }

  // Create controller (which creates and manages the view)
  const controller = new MenuController(params);

  // Initialize (render and setup)
  controller.initialize();

  // Return the controller as the public instance
  return controller;
}
