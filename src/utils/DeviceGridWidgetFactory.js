/**
 * RFC-0143: Device Grid Widget Factory
 *
 * Factory pattern to eliminate code duplication across device grid widgets
 * (EQUIPMENTS, STORES, WATER_STORES, WATER_COMMON_AREA).
 *
 * Reduces ~9,400 lines of duplicated code to ~300 lines of configuration.
 *
 * @module DeviceGridWidgetFactory
 * @version 1.0.0
 */

/* eslint-disable no-undef */

import { createLogHelper } from './logHelper.js';

const LogHelper = createLogHelper('DeviceGridWidgetFactory');

/**
 * @typedef {Object} DeviceGridWidgetConfig
 * @property {string} widgetName - Widget identifier (e.g., 'STORES', 'EQUIPMENTS')
 * @property {string} idPrefix - DOM ID prefix (e.g., 'stores', 'equip')
 * @property {'energy'|'water'|'temperature'} domain - Device domain
 * @property {string} context - Device context (e.g., 'stores', 'hidrometro')
 * @property {Function} deviceFilter - Function to filter devices for this widget
 * @property {'master_rules'|'always_online'} statusCalculation - How to calculate device status
 * @property {Function} formatValue - Value formatter (e.g., formatEnergy, formatWaterVolumeM3)
 * @property {string} unit - Unit string (e.g., 'kWh', 'm3')
 * @property {string} valType - Value type (e.g., 'power_kw', 'volume_m3')
 * @property {string} icon - Icon identifier (e.g., 'energy', 'water')
 * @property {string} primaryColor - Primary color hex
 * @property {string} listElementId - DOM ID for cards container
 * @property {Array} filterTabs - Filter tab definitions
 * @property {Object} headerLabels - Labels for header elements
 * @property {boolean} hasRealTimeMode - Whether widget supports real-time mode
 * @property {string} summaryReadyEvent - Event name for summary data
 * @property {number} delayTimeConnectionInMins - Delay threshold for connection status
 */

/**
 * Create initial state object for a device grid widget
 * @returns {Object} Initial state
 */
export function createState() {
  return {
    itemsBase: [],
    itemsEnriched: [],
    dataFromMain: false,
    searchActive: false,
    searchTerm: '',
    selectedIds: null,
    sortMode: 'cons_desc',
    selectedShoppingIds: [],
    firstHydrates: 0,
  };
}

/**
 * Sort devices based on sort mode
 * @param {Object} a - First device
 * @param {Object} b - Second device
 * @param {string} sortMode - Sort mode
 * @param {DeviceGridWidgetConfig} config - Widget configuration
 * @returns {number} Sort comparison result
 */
export function sortDevices(a, b, sortMode, config) {
  const getCustomerNameForDevice =
    (typeof window !== 'undefined' && window.MyIOUtils?.getCustomerNameForDevice) ||
    ((d) => d?.customerId || '');

  switch (sortMode) {
    case 'cons_desc':
      if (a.value !== b.value) return b.value - a.value;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' });

    case 'cons_asc':
      if (a.value !== b.value) return a.value - b.value;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' });

    case 'alpha_desc':
      return (
        (b.label || '').localeCompare(a.label || '', 'pt-BR', { sensitivity: 'base' }) ||
        b.value - a.value
      );

    case 'status_asc': {
      const statusA = (a.connectionStatus || 'offline').toLowerCase();
      const statusB = (b.connectionStatus || 'offline').toLowerCase();
      const cmp = statusA.localeCompare(statusB, 'pt-BR', { sensitivity: 'base' });
      return cmp !== 0
        ? cmp
        : (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' });
    }

    case 'status_desc': {
      const statusA = (a.connectionStatus || 'offline').toLowerCase();
      const statusB = (b.connectionStatus || 'offline').toLowerCase();
      const cmp = statusB.localeCompare(statusA, 'pt-BR', { sensitivity: 'base' });
      return cmp !== 0
        ? cmp
        : (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' });
    }

    case 'shopping_asc': {
      const shopA = getCustomerNameForDevice(a) || '';
      const shopB = getCustomerNameForDevice(b) || '';
      const cmp = shopA.localeCompare(shopB, 'pt-BR', { sensitivity: 'base' });
      return cmp !== 0
        ? cmp
        : (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' });
    }

    case 'shopping_desc': {
      const shopA = getCustomerNameForDevice(a) || '';
      const shopB = getCustomerNameForDevice(b) || '';
      const cmp = shopB.localeCompare(shopA, 'pt-BR', { sensitivity: 'base' });
      return cmp !== 0
        ? cmp
        : (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' });
    }

    default:
      // alpha_asc
      return (
        (a.label || '').localeCompare(b.label || '', 'pt-BR', { sensitivity: 'base' }) ||
        a.value - b.value
      );
  }
}

/**
 * Apply filters to enriched items
 * @param {DeviceGridWidgetConfig} config - Widget configuration
 * @param {Object} STATE - Widget state
 * @param {Array} enriched - Enriched items array
 * @returns {Array} Filtered and sorted items
 */
export function applyFilters(config, STATE, enriched) {
  let v = enriched.slice();

  // RFC-0093: Shopping filter from MENU
  if (STATE.selectedShoppingIds?.length > 0) {
    v = v.filter((x) => {
      if (!x.customerId) return true;
      return STATE.selectedShoppingIds.includes(x.customerId);
    });
    LogHelper.log(`[${config.widgetName}] Shopping filter: ${enriched.length} -> ${v.length}`);
  }

  // Multiselect filter
  if (STATE.selectedIds?.size) {
    v = v.filter((x) => STATE.selectedIds.has(String(x.id)));
  }

  // Search filter
  const q = (STATE.searchTerm || '').trim().toLowerCase();
  if (q) {
    v = v.filter(
      (x) =>
        (x.label || '').toLowerCase().includes(q) ||
        (x.identifier || '').toLowerCase().includes(q)
    );
  }

  // Sorting
  v.sort((a, b) => sortDevices(a, b, STATE.sortMode, config));

  return v;
}

/**
 * Recompute percentages based on visible items
 * @param {Array} visible - Visible items
 * @returns {Object} Updated visible items and group sum
 */
export function recomputePercentages(visible) {
  const groupSum = visible.reduce((acc, x) => acc + (x.value || 0), 0);
  const updated = visible.map((x) => ({
    ...x,
    perc: groupSum > 0 ? (x.value / groupSum) * 100 : 0,
  }));
  return { visible: updated, groupSum };
}

/**
 * Build entity object for card rendering
 * @param {DeviceGridWidgetConfig} config - Widget configuration
 * @param {Object} item - Device item
 * @param {Object} context - Render context
 * @returns {Object} Entity object for card component
 */
export function buildEntityObject(config, item, context) {
  const getCustomerNameForDevice =
    (typeof window !== 'undefined' && window.MyIOUtils?.getCustomerNameForDevice) ||
    ((d) => d?.customerId || 'N/A');
  const mapConnectionStatus =
    (typeof window !== 'undefined' && window.MyIOUtils?.mapConnectionStatus) ||
    ((s) => s || 'offline');
  const formatarDuracao =
    (typeof window !== 'undefined' && window.MyIOUtils?.formatarDuracao) ||
    ((ms) => `${Math.round(ms / 1000)}s`);

  const valNum = Number(item.value || 0);
  const resolvedTbId = item.tbId || item.id || item.ingestionId;
  const customerName = getCustomerNameForDevice(item);

  // Status calculation
  let deviceStatus;
  if (config.statusCalculation === 'always_online') {
    deviceStatus = 'online';
  } else {
    const calculateDeviceStatusMasterRules =
      typeof window !== 'undefined' && window.MyIOUtils?.calculateDeviceStatusMasterRules;
    if (calculateDeviceStatusMasterRules) {
      deviceStatus = calculateDeviceStatusMasterRules(item, {
        delayTimeConnectionInMins: config.delayTimeConnectionInMins || 1440,
        domain: config.domain,
      });
    } else {
      deviceStatus = mapConnectionStatus(item.connectionStatus);
    }
  }

  // Identifier display logic
  let deviceIdentifierToDisplay = item.identifier || 'N/A';
  if (String(deviceIdentifierToDisplay).includes('Sem Identificador')) {
    const label = String(item.label || '').toLowerCase();
    if (label.includes('fancoil')) deviceIdentifierToDisplay = 'FANCOIL';
    else if (label.includes('cag')) deviceIdentifierToDisplay = 'CAG';
    else if (label.includes('elevador') || label.includes('elv')) deviceIdentifierToDisplay = 'ELV';
    else if (label.includes('escada')) deviceIdentifierToDisplay = 'ESC';
    else deviceIdentifierToDisplay = 'N/A';
  }

  // Operation hours
  let operationHoursFormatted = '0s';
  const lastConnectTimestamp = item.lastConnectTime ? Number(item.lastConnectTime) : null;
  if (lastConnectTimestamp) {
    const nowMs = Date.now();
    const durationMs = nowMs - lastConnectTimestamp;
    operationHoursFormatted = formatarDuracao(durationMs > 0 ? durationMs : 0);
  }

  return {
    entityId: resolvedTbId,
    id: resolvedTbId,
    labelOrName: item.label,
    name: item.label,
    customerName: customerName,
    centralName: item.centralName || 'N/A',
    deviceIdentifier: deviceIdentifierToDisplay,
    val: valNum,
    value: valNum,
    lastValue: valNum,
    valType: config.valType,
    unit: config.unit,
    icon: config.icon,
    domain: config.domain,
    deviceType: item.deviceType,
    deviceProfile: item.deviceProfile || 'N/D',
    deviceStatus: deviceStatus,
    perc: item.perc ?? 0,
    slaveId: item.slaveId || 'N/A',
    ingestionId: item.ingestionId || 'N/A',
    centralId: item.centralId || 'N/A',
    customerId: item.customerId || null,
    updatedIdentifiers: item.updatedIdentifiers || {},
    connectionStatusTime: item.connectionStatusTime || Date.now(),
    timeVal: item.timeVal || Date.now(),
    lastDisconnectTime: item.lastDisconnectTime || 0,
    lastConnectTime: item.lastConnectTime || item.lastActivityTime || item.timeVal || Date.now(),
    lastActivityTime: item.timeVal || item.lastActivityTime || null,
    instantaneousPower:
      config.statusCalculation === 'always_online'
        ? Number(item.consumptionPower || item.consumption_power) || null
        : deviceStatus === 'offline'
          ? null
          : Number(item.consumptionPower || item.consumption_power) || null,
    operationHours: operationHoursFormatted,
    temperatureC: item.temperature || 0,
    mapInstantaneousPower: context?.mapInstantaneousPower || null,
    deviceMapInstaneousPower: item.deviceMapInstaneousPower || null,
    powerRanges: item.powerRanges || null,
  };
}

/**
 * Render device cards list
 * @param {DeviceGridWidgetConfig} config - Widget configuration
 * @param {Object} STATE - Widget state
 * @param {Array} visible - Visible items
 * @param {Object} context - Render context
 */
export async function renderList(config, STATE, visible, context) {
  const listElement = document.getElementById(config.listElementId);
  if (!listElement) {
    LogHelper.warn(`[${config.widgetName}] List element #${config.listElementId} not found`);
    return;
  }

  listElement.innerHTML = '';

  const MyIOLibrary = typeof window !== 'undefined' && window.MyIOLibrary;

  for (const item of visible) {
    const container = document.createElement('div');
    listElement.appendChild(container);

    const entityObject = buildEntityObject(config, item, context);

    if (MyIOLibrary?.renderCardComponentHeadOffice) {
      MyIOLibrary.renderCardComponentHeadOffice(container, {
        entityObject: entityObject,
        debugActive: context?.debugActive || false,
        activeTooltipDebug: context?.activeTooltipDebug || false,
        delayTimeConnectionInMins: config.delayTimeConnectionInMins || 1440,
        handleClickCard: (ev, entity) => {
          LogHelper.log(`[${config.widgetName}] Card clicked: ${entity.name}`);
        },
        handleActionDashboard: () => context?.handleActionDashboard?.(entityObject, item),
        handleActionReport: () => context?.handleActionReport?.(entityObject, item),
        handleActionSettings: () => context?.handleActionSettings?.(entityObject, item),
        handleSelect: (checked, entity) => {
          if (!STATE.selectedIds) STATE.selectedIds = new Set();
          if (checked) {
            STATE.selectedIds.add(String(entity.id));
          } else {
            STATE.selectedIds.delete(String(entity.id));
          }
        },
        useNewComponents: true,
        enableSelection: true,
        enableDragDrop: true,
        hideInfoMenuItem: true,
      });
    }
  }
}

/**
 * Update statistics header
 * @param {DeviceGridWidgetConfig} config - Widget configuration
 * @param {Array} items - Device items
 * @param {Object} context - Render context
 * @returns {Object} Statistics object
 */
export function updateStats(config, items, context) {
  const total = items.length;
  let onlineCount = 0;
  let totalConsumption = 0;
  let zeroConsumptionCount = 0;

  items.forEach((item) => {
    let isOnline = false;

    if (config.statusCalculation === 'always_online') {
      isOnline = true;
    } else {
      const calculateDeviceStatusMasterRules =
        typeof window !== 'undefined' && window.MyIOUtils?.calculateDeviceStatusMasterRules;
      if (calculateDeviceStatusMasterRules) {
        const status = calculateDeviceStatusMasterRules(item, {
          delayTimeConnectionInMins: config.delayTimeConnectionInMins || 1440,
          domain: config.domain,
        });
        isOnline = ['online', 'power_on', 'normal', 'ok', 'running', 'active'].includes(
          status?.toLowerCase?.() || ''
        );
      }
    }

    if (isOnline) onlineCount++;

    const consumption = Number(item.value) || Number(item.val) || 0;
    totalConsumption += consumption;

    if (consumption === 0) {
      zeroConsumptionCount++;
    }
  });

  const connectivityPercentage = total > 0 ? ((onlineCount / total) * 100).toFixed(1) : '0.0';

  if (context?.headerController?.update) {
    context.headerController.update({
      connectivity: `${onlineCount}/${total} (${connectivityPercentage}%)`,
      total: total,
      consumption: config.formatValue(totalConsumption),
      zeroCount: zeroConsumptionCount,
    });
  }

  return { onlineCount, total, totalConsumption, zeroConsumptionCount };
}

/**
 * Create busy modal functions
 * @param {DeviceGridWidgetConfig} config - Widget configuration
 * @param {Function} $root - jQuery root accessor
 * @returns {Object} Busy modal functions
 */
export function createBusyModal(config, $root) {
  const BUSY_ID = `myio-busy-modal-${config.idPrefix}`;

  function ensureBusyModalDOM() {
    let $m = $root().find(`#${BUSY_ID}`);
    if ($m.length) return $m;

    const html = `
    <div id="${BUSY_ID}" style="
        position:absolute; inset:0; display:none;
        background: rgba(150,132,181,0.45);
        backdrop-filter: blur(5px);
        z-index:9999; align-items:center; justify-content:center;
        font-family: Inter, system-ui, sans-serif;">
      <div style="
          background:#2d1458; color:#fff;
          border:1px solid rgba(255,255,255,0.10);
          box-shadow:0 12px 40px rgba(0,0,0,.35);
          border-radius:18px; padding:22px 26px; min-width:320px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="spinner" style="
              width:22px;height:22px;border-radius:50%;
              border:3px solid rgba(255,255,255,.25);
              border-top-color:#ffffff; animation:spin .9s linear infinite;"></div>
          <div id="${BUSY_ID}-msg" style="font-weight:600; font-size:14px;">
            Carregando dados...
          </div>
        </div>
      </div>
    </div>
    <style>
      @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
    </style>`;
    $root().css('position', 'relative');
    $root().append(html);
    return $root().find(`#${BUSY_ID}`);
  }

  function showBusy(message) {
    if (typeof window !== 'undefined' && window.MyIOOrchestrator?.showGlobalBusy) {
      window.MyIOOrchestrator.showGlobalBusy(config.domain, message || 'Carregando dados...', 35000);
    } else {
      const $m = ensureBusyModalDOM();
      $m.find(`#${BUSY_ID}-msg`).text(message || 'Carregando dados...');
      $m.css('display', 'flex');
    }
  }

  function hideBusy() {
    if (typeof window !== 'undefined' && window.MyIOOrchestrator?.hideGlobalBusy) {
      window.MyIOOrchestrator.hideGlobalBusy();
    } else {
      $root().find(`#${BUSY_ID}`).css('display', 'none');
    }
  }

  return { showBusy, hideBusy };
}

/**
 * Get cached data from orchestrator
 * @param {DeviceGridWidgetConfig} config - Widget configuration
 * @returns {Array|null} Cached device data
 */
export function getCachedData(config) {
  if (typeof window === 'undefined') return null;

  const classified = window.MyIOOrchestratorData?.classified;
  if (!classified) return null;

  const domainData = classified[config.domain];
  if (!domainData) return null;

  return domainData[config.context] || null;
}

/**
 * Create widget controller from configuration
 * @param {DeviceGridWidgetConfig} config - Widget configuration
 * @returns {Object} Widget controller with onInit, onDataUpdated, onDestroy
 */
export function createWidgetController(config) {
  const requiredFields = [
    'widgetName',
    'domain',
    'context',
    'deviceFilter',
    'formatValue',
    'listElementId',
  ];
  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`[DeviceGridWidgetFactory] Missing required config field: ${field}`);
    }
  }

  config.statusCalculation = config.statusCalculation || 'master_rules';
  config.delayTimeConnectionInMins =
    config.delayTimeConnectionInMins ||
    (config.statusCalculation === 'always_online' ? 86400 : 1440);
  config.unit = config.unit || 'kWh';
  config.valType = config.valType || 'power_kw';
  config.icon = config.icon || config.domain;
  config.primaryColor = config.primaryColor || '#3E1A7D';
  config.idPrefix = config.idPrefix || config.widgetName.toLowerCase();

  const STATE = createState();
  const eventHandlers = [];

  let context = {
    debugActive: false,
    activeTooltipDebug: false,
    headerController: null,
    filterModalController: null,
    mapInstantaneousPower: null,
    MyIOAuth: null,
    handleActionDashboard: null,
    handleActionReport: null,
    handleActionSettings: null,
  };

  let $root = null;

  async function reflow() {
    const filtered = applyFilters(config, STATE, STATE.itemsEnriched);
    const { visible } = recomputePercentages(filtered);
    updateStats(config, visible, context);
    await renderList(config, STATE, visible, context);
  }

  function registerEventHandlers(busyModal) {
    const dataReadyHandler = () => {
      const items = getCachedData(config);
      if (items && items.length > 0) {
        LogHelper.log(`[${config.widgetName}] Data ready event: ${items.length} items`);
        STATE.itemsBase = items;
        STATE.itemsEnriched = items.map((item) => ({
          ...item,
          value: Number(item.value || item.consumption || item.pulses || 0),
        }));
        STATE.dataFromMain = true;
        busyModal.hideBusy();
        reflow();
      }
    };

    const filterAppliedHandler = (ev) => {
      const selection = ev.detail?.selection || [];
      STATE.selectedShoppingIds = selection.map((s) => s.id || s);
      LogHelper.log(`[${config.widgetName}] Filter applied: ${selection.length} shoppings`);
      reflow();
    };

    const summaryReadyHandler = () => {
      const items = getCachedData(config);
      if (items && items.length > 0 && STATE.itemsBase.length === 0) {
        LogHelper.log(`[${config.widgetName}] Summary ready, loading from cache: ${items.length} items`);
        STATE.itemsBase = items;
        STATE.itemsEnriched = items.map((item) => ({
          ...item,
          value: Number(item.value || item.consumption || item.pulses || 0),
        }));
        STATE.dataFromMain = true;
        busyModal.hideBusy();
        reflow();
      }
    };

    window.addEventListener('myio:data-ready', dataReadyHandler);
    window.addEventListener('myio:filter-applied', filterAppliedHandler);
    window.addEventListener(config.summaryReadyEvent, summaryReadyHandler);

    eventHandlers.push(
      { event: 'myio:data-ready', handler: dataReadyHandler },
      { event: 'myio:filter-applied', handler: filterAppliedHandler },
      { event: config.summaryReadyEvent, handler: summaryReadyHandler }
    );
  }

  function unregisterEventHandlers() {
    eventHandlers.forEach(({ event, handler }) => {
      window.removeEventListener(event, handler);
    });
    eventHandlers.length = 0;
  }

  return {
    onInit: async function () {
      LogHelper.log(`[${config.widgetName}] RFC-0143 Factory Controller - onInit`);

      // eslint-disable-next-line no-undef
      $root = () => $(self.ctx.$container[0]);

      const busyModal = createBusyModal(config, $root);

      if (typeof window !== 'undefined' && window.MyIOUtils?.buildHeaderDevicesGrid) {
        context.headerController = window.MyIOUtils.buildHeaderDevicesGrid({
          $container: $root(),
          idPrefix: config.idPrefix,
          labels: config.headerLabels,
          onSortChange: (mode) => {
            STATE.sortMode = mode;
            reflow();
          },
          onSearchChange: (term) => {
            STATE.searchTerm = term;
            STATE.searchActive = term.length > 0;
            reflow();
          },
        });
      }

      if (typeof window !== 'undefined' && window.MyIOUtils?.createFilterModal) {
        context.filterModalController = window.MyIOUtils.createFilterModal({
          $container: $root(),
          tabs: config.filterTabs || [{ id: 'all', label: 'Todos', filter: () => true }],
          onApply: (selectedIds) => {
            STATE.selectedIds = selectedIds;
            reflow();
          },
        });
      }

      context.handleActionDashboard = config.handleActionDashboard || null;
      context.handleActionReport = config.handleActionReport || null;
      context.handleActionSettings = config.handleActionSettings || null;

      registerEventHandlers(busyModal);

      const cachedData = getCachedData(config);
      if (cachedData && cachedData.length > 0) {
        LogHelper.log(`[${config.widgetName}] Found cached data: ${cachedData.length} items`);
        STATE.itemsBase = cachedData;
        STATE.itemsEnriched = cachedData.map((item) => ({
          ...item,
          value: Number(item.value || item.consumption || item.pulses || 0),
        }));
        STATE.dataFromMain = true;
        reflow();
      } else {
        busyModal.showBusy('Carregando dados...');
      }

      if (typeof window !== 'undefined' && window.custumersSelected?.length > 0) {
        STATE.selectedShoppingIds = window.custumersSelected.map((s) => s.id || s);
      }
    },

    onDataUpdated: function () {
      // No-op - data is received via events from MAIN/Orchestrator
    },

    onDestroy: function () {
      LogHelper.log(`[${config.widgetName}] RFC-0143 Factory Controller - onDestroy`);
      unregisterEventHandlers();

      context.headerController?.destroy?.();
      context.filterModalController?.destroy?.();

      STATE.itemsBase = [];
      STATE.itemsEnriched = [];
      STATE.selectedIds = null;
    },

    getState: () => STATE,
    reflow,
  };
}

/**
 * DeviceGridWidgetFactory - Main factory object
 */
export const DeviceGridWidgetFactory = {
  createWidgetController,
  createState,
  applyFilters,
  recomputePercentages,
  buildEntityObject,
  renderList,
  updateStats,
  createBusyModal,
  getCachedData,
  sortDevices,
};

export default DeviceGridWidgetFactory;
