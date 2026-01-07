import { WaterPanelParams, WaterPanelInstance } from './types';
import { WaterPanelController } from './WaterPanelController';
import { WaterPanelView } from './WaterPanelView';

export function createWaterPanelComponent(params: WaterPanelParams): WaterPanelInstance {
  // Validate required params
  if (!params.container) {
    throw new Error('[WaterPanel] container is required');
  }

  // Create controller and view
  const controller = new WaterPanelController(params);
  const view = new WaterPanelView(params, controller);

  // Render into container
  const element = view.render();
  params.container.appendChild(element);

  // Return public API
  return {
    element,

    // Data methods
    updateSummary: (data) => controller.updateSummary(data),
    getSummary: () => controller.getSummary(),

    // Config methods
    setTheme: (mode) => controller.setTheme(mode),
    getTheme: () => controller.getState().theme,
    setPeriod: (days) => controller.setPeriod(days),
    getPeriod: () => controller.getState().period,
    setVizMode: (mode) => controller.setVizMode(mode),
    getVizMode: () => controller.getState().vizMode,
    setChartType: (type) => controller.setChartType(type),
    getChartType: () => controller.getState().chartType,

    // Filter methods
    applyShoppingFilter: (ids) => controller.applyShoppingFilter(ids),
    getSelectedShoppingIds: () => [...controller.getState().selectedShoppingIds],
    clearFilters: () => controller.clearFilters(),

    // Actions
    refresh: () => {
      params.onRefresh?.();
    },
    openFullscreen: () => {
      params.onMaximizeClick?.();
    },

    // Lifecycle
    destroy: () => view.destroy(),
  };
}
