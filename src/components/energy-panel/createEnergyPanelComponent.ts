import { EnergyPanelParams, EnergyPanelInstance } from './types';
import { EnergyPanelController } from './EnergyPanelController';
import { EnergyPanelView } from './EnergyPanelView';

export function createEnergyPanelComponent(params: EnergyPanelParams): EnergyPanelInstance {
  if (!params.container) {
    throw new Error('[EnergyPanel] container is required');
  }

  const controller = new EnergyPanelController(params);
  const view = new EnergyPanelView(params, controller);

  const element = view.render();
  params.container.appendChild(element);

  return {
    element,

    updateSummary: (data) => controller.updateSummary(data),
    getSummary: () => controller.getSummary(),

    setTheme: (mode) => controller.setTheme(mode),
    getTheme: () => controller.getState().theme,
    setPeriod: (days) => controller.setPeriod(days),
    getPeriod: () => controller.getState().period,
    setVizMode: (mode) => controller.setVizMode(mode),
    getVizMode: () => controller.getState().vizMode,
    setChartType: (type) => controller.setChartType(type),
    getChartType: () => controller.getState().chartType,

    applyShoppingFilter: (ids) => controller.applyShoppingFilter(ids),
    getSelectedShoppingIds: () => [...controller.getState().selectedShoppingIds],
    clearFilters: () => controller.clearFilters(),

    refresh: () => {
      params.onRefresh?.();
    },
    openFullscreen: () => {
      params.onMaximizeClick?.();
    },

    destroy: () => view.destroy(),
  };
}
