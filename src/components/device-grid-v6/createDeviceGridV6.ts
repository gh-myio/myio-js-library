/**
 * DeviceGridV6 Factory
 * Entry point — creates Controller + View, mounts to container, returns public API
 */

import type { CardGridItem, SortMode, DeviceGridV6Params, DeviceGridV6Instance } from './types';
import { DeviceGridV6Controller } from './DeviceGridV6Controller';
import { DeviceGridV6View } from './DeviceGridV6View';

export function createDeviceGridV6(params: DeviceGridV6Params): DeviceGridV6Instance {
  const controller = new DeviceGridV6Controller({
    items: params.items || [],
    debugActive: params.debugActive,
    onStatsUpdate: params.onStatsUpdate,
  });

  const view = new DeviceGridV6View(params, controller);
  const element = view.render();

  // Mount into container
  params.container.appendChild(element);

  // Public API
  return {
    element,

    updateItems(items: CardGridItem[]): void {
      controller.updateItems(items);
      view.refresh();
    },

    setTitle(title: string): void {
      view.setTitle(title);
    },

    getElement(): HTMLElement {
      return view.getElement();
    },

    setSearchTerm(term: string): void {
      controller.setSearchTerm(term);
      view.setSearchTerm(term);
      view.refresh();
    },

    setSortMode(mode: SortMode): void {
      controller.setSortMode(mode);
      view.setSortMode(mode);
      view.refresh();
    },

    getStats() {
      return controller.getStats();
    },

    destroy(): void {
      view.destroy();
    },
  };
}
