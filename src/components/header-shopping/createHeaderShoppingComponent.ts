/**
 * RFC-0139: HeaderShopping Component Factory
 * Factory function for creating the Shopping Dashboard header toolbar
 *
 * This component provides:
 * - DateRangePicker for period selection
 * - Contract status icon with tooltip
 * - Load/Refresh/Report buttons
 * - Domain state tracking (energy/water)
 * - Event emission for myio:update-date
 */

import { HeaderShoppingView } from './HeaderShoppingView';
import {
  DomainType,
  HeaderShoppingPeriod,
  HeaderShoppingParams,
  HeaderShoppingInstance,
  HeaderShoppingEventType,
  HeaderShoppingEventHandler,
  ContractState,
  DEFAULT_HEADER_SHOPPING_CONFIG,
  ThemeMode,
} from './types';

// Type-safe window access helpers (avoiding global declaration conflicts)
/* eslint-disable @typescript-eslint/no-explicit-any */
const getWindow = (): any => window;
const getLib = (): any => getWindow().MyIOLibrary;
const getOrchestrator = (): any => getWindow().MyIOOrchestrator;
const getUtils = (): any => getWindow().MyIOUtils;
const getMoment = (): any => getWindow().moment;

/**
 * Create a HeaderShopping Component instance
 */
export function createHeaderShoppingComponent(params: HeaderShoppingParams): HeaderShoppingInstance {
  const { container } = params;

  // Validate container
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('[HeaderShoppingComponent] Invalid container element');
  }

  // Configuration
  const config = { ...DEFAULT_HEADER_SHOPPING_CONFIG, ...params.configTemplate };
  const debug = config.enableDebugMode;
  const tz = config.timezone;

  // Logging helper
  const utilsLogHelper = getUtils()?.LogHelper;
  const LogHelper = utilsLogHelper || {
    log: (...args: unknown[]) => debug && console.log('[HeaderShopping]', ...args),
    warn: (...args: unknown[]) => console.warn('[HeaderShopping]', ...args),
    error: (...args: unknown[]) => console.error('[HeaderShopping]', ...args),
  };

  // Event handlers
  const eventHandlers = new Map<HeaderShoppingEventType, Set<HeaderShoppingEventHandler>>();

  // State
  let currentDomain: DomainType = getWindow().__myioCurrentDomain || null;
  let currentRange: { start: any; end: any } = { start: null, end: null };
  let lastEmission: Record<string, number> = {};

  // Auth instance (lazy)
  let myioAuth: { getToken: () => Promise<string> } | null = null;

  // Create view
  const themeMode: ThemeMode = params.themeMode || 'light';
  const view = new HeaderShoppingView(params.configTemplate, themeMode);
  const element = view.render();

  // ===========================================================================
  // Utility functions
  // ===========================================================================

  function toISO(dt: Date | number | string): string {
    const d = typeof dt === 'number' ? new Date(dt) : dt instanceof Date ? dt : new Date(String(dt));
    if (Number.isNaN(d.getTime())) throw new Error('Invalid date');

    const offset = -d.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offset) / 60);
    const offsetMins = Math.abs(offset) % 60;
    const offsetStr = `${offset >= 0 ? '+' : '-'}${String(offsetHours).padStart(2, '0')}:${String(
      offsetMins
    ).padStart(2, '0')}`;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetStr}`;
  }

  function calcGranularity(startISO: string, endISO: string): 'hour' | 'day' | 'month' {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 92) return 'month';
    if (diffDays > 3) return 'day';
    return 'hour';
  }

  function getDefaultPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
    return { start, end };
  }

  function emitToAllContexts(eventName: string, detail: unknown): void {
    const now = Date.now();
    const key = `${eventName}:${JSON.stringify(detail)}`;

    if (lastEmission[key] && now - lastEmission[key] < 200) {
      LogHelper.warn(`Skipping duplicate ${eventName} emission`);
      return;
    }
    lastEmission[key] = now;

    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    LogHelper.log(`Emitted ${eventName}`);
  }

  // ===========================================================================
  // Initialize DateRangePicker
  // ===========================================================================

  async function initDateRangePicker(): Promise<void> {
    const dateInput = view.getDateRangeInput();
    if (!dateInput) {
      LogHelper.warn('Date range input not found');
      return;
    }

    // Determine preset dates
    let presetStart = params.presetStart;
    let presetEnd = params.presetEnd;

    if (!presetStart || !presetEnd) {
      const defaults = getDefaultPeriod();
      presetStart = presetStart || defaults.start;
      presetEnd = presetEnd || defaults.end;
    }

    const lib = getLib();
    if (!lib?.createDateRangePicker) {
      LogHelper.warn('createDateRangePicker not available in MyIOLibrary');
      // Fallback: just display the range
      const displayFmt = 'DD/MM/YYYY HH:mm';
      const m = getMoment();
      if (m) {
        const startM = m(presetStart);
        const endM = m(presetEnd);
        view.setDateRangeDisplay(`${startM.format(displayFmt)} - ${endM.format(displayFmt)}`);
        currentRange.start = startM;
        currentRange.end = endM;
      }
      return;
    }

    try {
      await lib.createDateRangePicker(dateInput, {
        presetStart,
        presetEnd,
        onApply: (result: { startISO: string; endISO: string }) => {
          LogHelper.log('DateRangePicker applied:', result);

          // Update internal range
          const m = getMoment();
          if (m && result.startISO && result.endISO) {
            currentRange.start = m(result.startISO);
            currentRange.end = m(result.endISO);
          }

          // Notify listeners
          emit('date-change', {
            startISO: result.startISO,
            endISO: result.endISO,
            granularity: calcGranularity(result.startISO, result.endISO),
            tz,
          });
          params.onDateChange?.({
            startISO: result.startISO,
            endISO: result.endISO,
            granularity: calcGranularity(result.startISO, result.endISO),
            tz,
          });
        },
      });

      // Initialize range state
      const m = getMoment();
      if (m) {
        currentRange.start = m(presetStart);
        currentRange.end = m(presetEnd);
        const displayFmt = 'DD/MM/YYYY HH:mm';
        const startM = m(presetStart);
        const endM = m(presetEnd);
        view.setDateRangeDisplay(`${startM.format(displayFmt)} - ${endM.format(displayFmt)}`);
      }

      LogHelper.log('DateRangePicker initialized');
    } catch (err) {
      LogHelper.error('Failed to initialize DateRangePicker:', err);
    }
  }

  // ===========================================================================
  // Initialize Auth
  // ===========================================================================

  async function initAuth(): Promise<void> {
    const lib = getLib();
    if (!lib?.buildMyioIngestionAuth) return;

    const utils = getUtils();
    const dataApiHost =
      config.dataApiHost || utils?.DATA_API_HOST || 'https://api.data.apps.myio-bas.com';

    const clientId = params.credentials?.clientId || '';
    const clientSecret = params.credentials?.clientSecret || '';

    if (!clientId || !clientSecret) {
      LogHelper.warn('Missing credentials for auth');
      return;
    }

    myioAuth = lib.buildMyioIngestionAuth({
      dataApiHost,
      clientId,
      clientSecret,
    });

    LogHelper.log('Auth initialized');
  }

  // ===========================================================================
  // View event handlers
  // ===========================================================================

  view.on('load-click', () => {
    LogHelper.log('Load clicked, domain:', currentDomain);

    const lib = getLib();
    const MyIOToast = lib?.MyIOToast;

    // Validate domain
    if (!currentDomain) {
      LogHelper.warn('No domain selected, attempting auto-select energy');
      currentDomain = 'energy';
      getWindow().__myioCurrentDomain = 'energy';
      window.dispatchEvent(new CustomEvent('myio:dashboard-state', { detail: { tab: 'energy' } }));
    }

    if (currentDomain !== 'energy' && currentDomain !== 'water') {
      LogHelper.warn(`Domain ${currentDomain} not supported`);
      MyIOToast?.warning(`Dominio "${currentDomain}" nao suporta carregamento de dados.`, 5000);
      return;
    }

    // Build period from current range
    const startDate = currentRange.start;
    const endDate = currentRange.end;

    let startISO: string;
    let endISO: string;

    if (startDate && endDate && typeof startDate.toDate === 'function') {
      startISO = toISO(startDate.toDate());
      endISO = toISO(endDate.toDate());
    } else {
      // Fallback to defaults
      const defaults = getDefaultPeriod();
      startISO = toISO(defaults.start);
      endISO = toISO(defaults.end);
    }

    const period: HeaderShoppingPeriod = {
      startISO,
      endISO,
      granularity: calcGranularity(startISO, endISO),
      tz,
    };

    LogHelper.log('Emitting period:', period);

    // Show busy overlay
    try {
      const orchestrator = getOrchestrator();
      if (orchestrator?.showGlobalBusy) {
        orchestrator.showGlobalBusy(currentDomain, 'Carregando dados...', 25000, { force: true });
      }
    } catch (err) {
      LogHelper.warn('Failed to show busy overlay:', err);
    }

    // Invalidate cache
    try {
      const orchestrator = getOrchestrator();
      if (orchestrator?.getSharedWidgetState) {
        const state = orchestrator.getSharedWidgetState();
        if (state?.lastProcessedPeriodKey) {
          state.lastProcessedPeriodKey = null;
        }
      }
      const orchData = getWindow().MyIOOrchestratorData;
      if (orchData?.[currentDomain]) {
        delete orchData[currentDomain];
      }
    } catch (err) {
      LogHelper.warn('Error clearing cache:', err);
    }

    // Emit event
    emitToAllContexts('myio:update-date', { period });
    getWindow().__myioInitialPeriod = period;

    // Legacy event
    emitToAllContexts('myio:update-date-legacy', {
      startDate: startISO,
      endDate: endISO,
    });

    // Callbacks
    emit('load', period);
    params.onLoad?.(period);
  });

  view.on('force-refresh-click', () => {
    LogHelper.log('Force refresh clicked');

    const lib = getLib();
    const MyIOToast = lib?.MyIOToast;

    // Show confirmation
    const confirmed = window.confirm('Isso vai limpar todo o cache e recarregar os dados. Continuar?');
    if (!confirmed) {
      LogHelper.log('Force refresh cancelled');
      return;
    }

    try {
      // Clear localStorage cache
      const utils = getUtils();
      const customerTbId = utils?.customerTB_ID || 'default';
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const energyPrefix = `myio:cache:${customerTbId}:energy:`;
        const waterPrefix = `myio:cache:${customerTbId}:water:`;

        if (key.startsWith(energyPrefix) || key.startsWith(waterPrefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
        LogHelper.log(`Removed cache key: ${key}`);
      });

      // Invalidate orchestrator cache
      const orchestrator = getOrchestrator();
      if (orchestrator?.invalidateCache) {
        orchestrator.invalidateCache('energy');
        orchestrator.invalidateCache('water');
      }

      // Emit clear event
      window.dispatchEvent(
        new CustomEvent('myio:telemetry:clear', {
          detail: { domain: currentDomain },
        })
      );

      MyIOToast?.success(
        "Cache limpo com sucesso! Clique em 'Carregar' para buscar dados atualizados.",
        5000
      );
      LogHelper.log('Force refresh completed');
    } catch (err) {
      LogHelper.error('Error during force refresh:', err);
      MyIOToast?.error('Erro ao limpar cache. Consulte o console para detalhes.', 5000);
    }

    emit('force-refresh');
    params.onForceRefresh?.();
  });

  view.on('report-click', async () => {
    LogHelper.log('Report clicked');

    const lib = getLib();

    if (!currentDomain || (currentDomain !== 'energy' && currentDomain !== 'water')) {
      const MyIOToast = lib?.MyIOToast;
      MyIOToast?.error('Dominio invalido. Por favor, selecione Energia ou Agua no menu.', 5000);
      return;
    }

    emit('report-click', currentDomain);
    params.onReportClick?.(currentDomain);

    // Open report modal if library available
    if (!lib?.openDashboardPopupAllReport) {
      LogHelper.warn('openDashboardPopupAllReport not available');
      return;
    }

    try {
      const ingestionToken = myioAuth ? await myioAuth.getToken() : '';

      const utils = getUtils();
      const dataApiHost =
        config.dataApiHost || utils?.DATA_API_HOST || 'https://api.data.apps.myio-bas.com';

      // Build items list from datasources if available
      let itemsList: unknown[] = [];
      if (
        params.tbContext?.datasources &&
        params.tbContext?.data &&
        lib.buildListItemsThingsboardByUniqueDatasource
      ) {
        itemsList = lib.buildListItemsThingsboardByUniqueDatasource(
          params.tbContext.datasources,
          params.tbContext.data
        );
        LogHelper.log(`Built ${itemsList.length} items for report`);
      }

      lib.openDashboardPopupAllReport({
        customerId: params.credentials?.ingestionId || '',
        domain: currentDomain,
        debug: 0,
        api: {
          clientId: params.credentials?.clientId || '',
          clientSecret: params.credentials?.clientSecret || '',
          dataApiBaseUrl: dataApiHost,
          ingestionToken,
        },
        itemsList,
        ui: { theme: 'light' },
      });
    } catch (err) {
      LogHelper.error('Failed to open report modal:', err);
      const MyIOToast = lib?.MyIOToast;
      MyIOToast?.error('Erro ao abrir relatorio geral. Tente novamente.', 5000);
    }
  });

  view.on('contract-click', () => {
    LogHelper.log('Contract status clicked');

    const lib = getLib();
    const ContractSummaryTooltip = lib?.ContractSummaryTooltip;
    if (!ContractSummaryTooltip) {
      LogHelper.warn('ContractSummaryTooltip not available');
      return;
    }

    const contractState = getWindow().CONTRACT_STATE;
    if (!contractState?.isLoaded) {
      LogHelper.warn('Contract state not loaded');
      return;
    }

    try {
      const data = ContractSummaryTooltip.buildFromGlobalState();
      if (data) {
        const contractEl = view.getElement().querySelector('#tbx-contract-status');
        if (contractEl) {
          ContractSummaryTooltip.show(contractEl as HTMLElement, data);
        }
      }
    } catch (err) {
      LogHelper.error('Error showing ContractSummaryTooltip:', err);
    }
  });

  // ===========================================================================
  // Global event listeners
  // ===========================================================================

  function handleDashboardState(ev: Event): void {
    const { tab } = (ev as CustomEvent).detail || {};
    const previousDomain = currentDomain;

    LogHelper.log(`Dashboard state changed to: ${tab} (previous: ${previousDomain})`);

    currentDomain = tab;
    getWindow().__myioCurrentDomain = tab;

    view.updateControlsForDomain(tab);

    // Emit period when domain changes to energy or water
    if (tab === 'energy' || tab === 'water') {
      setTimeout(() => {
        const startDate = currentRange.start;
        const endDate = currentRange.end;

        if (startDate && endDate && typeof startDate.toDate === 'function') {
          const startISO = toISO(startDate.toDate());
          const endISO = toISO(endDate.toDate());

          const period: HeaderShoppingPeriod = {
            startISO,
            endISO,
            granularity: calcGranularity(startISO, endISO),
            tz,
          };

          getWindow().__myioInitialPeriod = period;
          LogHelper.log(`Emitting period for domain ${tab}:`, period);
          emitToAllContexts('myio:update-date', { period });
        }
      }, 300);
    }

    emit('domain-change', tab);
  }

  function handleContractLoaded(ev: Event): void {
    const detail = (ev as CustomEvent).detail as ContractState;
    LogHelper.log('Contract loaded:', detail);
    view.updateContractStatus(detail);
  }

  function handleDataReady(): void {
    if (currentDomain === 'energy' || currentDomain === 'water') {
      view.updateControlsForDomain(currentDomain);
    }
  }

  function setupEventListeners(): void {
    window.addEventListener('myio:dashboard-state', handleDashboardState);
    window.addEventListener('myio:contract:loaded', handleContractLoaded);
    window.addEventListener('myio:energy-summary-ready', handleDataReady);
    window.addEventListener('myio:water-summary-ready', handleDataReady);
    window.addEventListener('myio:data-ready', handleDataReady);
    window.addEventListener('myio:telemetry:provide-data', handleDataReady);
    LogHelper.log('Event listeners registered');
  }

  function removeEventListeners(): void {
    window.removeEventListener('myio:dashboard-state', handleDashboardState);
    window.removeEventListener('myio:contract:loaded', handleContractLoaded);
    window.removeEventListener('myio:energy-summary-ready', handleDataReady);
    window.removeEventListener('myio:water-summary-ready', handleDataReady);
    window.removeEventListener('myio:data-ready', handleDataReady);
    window.removeEventListener('myio:telemetry:provide-data', handleDataReady);
    LogHelper.log('Event listeners removed');
  }

  // ===========================================================================
  // Event emission
  // ===========================================================================

  function emit(event: HeaderShoppingEventType, ...args: unknown[]): void {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((h) => h(...args));
    }
  }

  function on(event: HeaderShoppingEventType, handler: HeaderShoppingEventHandler): void {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, new Set());
    }
    eventHandlers.get(event)!.add(handler);
  }

  function off(event: HeaderShoppingEventType, handler: HeaderShoppingEventHandler): void {
    eventHandlers.get(event)?.delete(handler);
  }

  // ===========================================================================
  // Instance methods
  // ===========================================================================

  function setDomain(domain: DomainType): void {
    currentDomain = domain;
    getWindow().__myioCurrentDomain = domain;
    view.updateControlsForDomain(domain);
  }

  function getDomain(): DomainType {
    return currentDomain;
  }

  function setThemeMode(mode: ThemeMode): void {
    view.setThemeMode(mode);
  }

  function getFilters(): {
    startDate: string | null;
    endDate: string | null;
    startAt: string | null;
    endAt: string | null;
    _displayRange: string | null;
  } {
    const startM = currentRange.start;
    const endM = currentRange.end;

    const displayFmt = 'DD/MM/YYYY HH:mm';
    const dateFmt = 'YYYY-MM-DD';
    const fullFmt = 'YYYY-MM-DD HH:mm:ss';

    return {
      startDate: startM?.format?.(dateFmt) ?? null,
      endDate: endM?.format?.(dateFmt) ?? null,
      startAt: startM?.format?.(fullFmt) ?? null,
      endAt: endM?.format?.(fullFmt) ?? null,
      _displayRange: startM && endM ? `${startM.format(displayFmt)} - ${endM.format(displayFmt)}` : null,
    };
  }

  function updateContractStatus(state: ContractState): void {
    view.updateContractStatus(state);
  }

  function setControlsEnabled(enabled: boolean): void {
    view.setControlsEnabled(enabled);
  }

  function triggerLoad(): void {
    view.clickLoad();
  }

  function triggerForceRefresh(skipConfirmation = false): void {
    if (skipConfirmation) {
      // Programmatic trigger - skip confirmation
      const btn = view.getElement().querySelector('#tbx-btn-force-refresh');
      if (btn) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    } else {
      view.clickForceRefresh();
    }
  }

  function destroy(): void {
    LogHelper.log('Destroying component');
    removeEventListeners();
    eventHandlers.clear();
    view.destroy();
  }

  // ===========================================================================
  // Initialize
  // ===========================================================================

  setupEventListeners();
  container.appendChild(element);

  // Initialize async components
  Promise.all([initDateRangePicker(), initAuth()]).catch((err) => {
    LogHelper.error('Initialization error:', err);
  });

  // Check if contract already loaded
  const existingContract = getWindow().CONTRACT_STATE;
  if (existingContract?.isLoaded) {
    view.updateContractStatus(existingContract);
  }

  // Check if domain already set
  if (currentDomain && (currentDomain === 'energy' || currentDomain === 'water')) {
    view.updateControlsForDomain(currentDomain);
  }

  LogHelper.log('Component mounted');

  // ===========================================================================
  // Return instance
  // ===========================================================================

  return {
    setDomain,
    getDomain,
    setThemeMode,
    getFilters,
    updateContractStatus,
    setControlsEnabled,
    triggerLoad,
    triggerForceRefresh,
    destroy,
    element,
    on,
    off,
  };
}
