/**
 * RFC-0148: TelemetryInfoShopping Component Factory
 * Creates category breakdown panel with pie chart
 */

import {
  TelemetryInfoShoppingParams,
  TelemetryInfoShoppingInstance,
  TelemetryDomain,
  ThemeMode,
  EnergySummary,
  WaterSummary,
  EnergyState,
  WaterState,
} from './types';
import { TelemetryInfoShoppingView } from './TelemetryInfoShoppingView';

/**
 * Create a TelemetryInfoShopping Component instance
 *
 * @param params - Configuration parameters
 * @returns TelemetryInfoShoppingInstance with methods to control the component
 *
 * @example
 * ```typescript
 * const telemetryInfo = createTelemetryInfoShoppingComponent({
 *   container: document.getElementById('telemetryInfoContainer'),
 *   domain: 'energy',
 *   themeMode: 'light',
 *   showChart: true,
 *   showExpandButton: true,
 *
 *   onCategoryClick: (category) => {
 *     console.log('Category clicked:', category);
 *   },
 * });
 *
 * // Update with energy data
 * telemetryInfo.setEnergyData({
 *   entrada: { total: 15000 },
 *   lojas: { total: 5000 },
 *   climatizacao: { total: 4500 },
 *   elevadores: { total: 1500 },
 *   escadasRolantes: { total: 750 },
 *   outros: { total: 1250 },
 * });
 *
 * // Switch to water domain
 * telemetryInfo.setDomain('water');
 * telemetryInfo.setWaterData({
 *   entrada: { total: 1000 },
 *   lojas: { total: 300 },
 *   banheiros: { total: 200 },
 *   areaComum: { total: 400 },
 * });
 * ```
 */
export function createTelemetryInfoShoppingComponent(
  params: TelemetryInfoShoppingParams
): TelemetryInfoShoppingInstance {
  const { container } = params;

  // Validate container
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error(
      '[TelemetryInfoShoppingComponent] Invalid container element. Please provide a valid HTMLElement.'
    );
  }

  // Debug logging
  const debug = params.debugActive ?? false;
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[TelemetryInfoShoppingComponent]', ...args);
    }
  };

  log('Creating component with params:', {
    domain: params.domain,
    themeMode: params.themeMode,
    showChart: params.showChart,
    showExpandButton: params.showExpandButton,
  });

  // Create view
  const view = new TelemetryInfoShoppingView(params);

  // Render the component
  const element = view.render();

  // Mount to container
  container.innerHTML = '';
  container.appendChild(element);

  log('Component mounted');

  // =========================================================================
  // Instance Methods
  // =========================================================================

  function setEnergyData(summary: EnergySummary): void {
    log('setEnergyData called');
    view.setEnergyData(summary);
  }

  function setWaterData(summary: WaterSummary): void {
    log('setWaterData called');
    view.setWaterData(summary);
  }

  function clearData(): void {
    log('clearData called');
    view.clearData();
  }

  function getState(): EnergyState | WaterState | null {
    return view.getState();
  }

  function getDomain(): TelemetryDomain {
    return view.getDomain();
  }

  function setDomain(domain: TelemetryDomain): void {
    log('setDomain called:', domain);
    view.setDomain(domain);
  }

  function setThemeMode(mode: ThemeMode): void {
    log('setThemeMode called:', mode);
    view.setThemeMode(mode);
  }

  function setLabel(label: string): void {
    log('setLabel called:', label);
    view.setLabel(label);
  }

  function openModal(): void {
    log('openModal called');
    view.openModal();
  }

  function closeModal(): void {
    log('closeModal called');
    view.closeModal();
  }

  function isModalOpen(): boolean {
    return view.isModalOpen();
  }

  function refreshChart(): void {
    log('refreshChart called');
    view.refreshChart();
  }

  function destroy(): void {
    log('destroy called');
    view.destroy();
  }

  // =========================================================================
  // Return Instance
  // =========================================================================

  return {
    element,

    // Data methods
    setEnergyData,
    setWaterData,
    clearData,

    // State
    getState,
    getDomain,

    // Config
    setDomain,
    setThemeMode,
    setLabel,

    // Modal
    openModal,
    closeModal,
    isModalOpen,

    // Chart
    refreshChart,

    // Lifecycle
    destroy,
  };
}
