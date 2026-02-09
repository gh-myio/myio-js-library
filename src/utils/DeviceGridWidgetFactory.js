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
 * @property {Object} [headerController] - Optional pre-built header controller
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
  let connectionStatus;
  if (config.statusCalculation === 'always_online') {
    // RFC-0144: When always_online, force both deviceStatus AND connectionStatus to 'online'
    // This prevents the card component from overriding deviceStatus based on connectionStatus
    deviceStatus = 'online';
    connectionStatus = 'online';
  } else {
    connectionStatus = mapConnectionStatus(item.connectionStatus);
    const calculateDeviceStatusMasterRules =
      typeof window !== 'undefined' && window.MyIOUtils?.calculateDeviceStatusMasterRules;
    if (calculateDeviceStatusMasterRules) {
      deviceStatus = calculateDeviceStatusMasterRules(item, {
        delayTimeConnectionInMins: config.delayTimeConnectionInMins || 1440,
        domain: config.domain,
      });
    } else {
      deviceStatus = connectionStatus;
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
    connectionStatus: connectionStatus, // RFC-0144: Include connectionStatus for card component
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
 * RFC-0144: Create default action handlers for device cards
 * These handlers use window globals to work without direct widget context
 */
function createDefaultActionHandlers(config, entityObject, item) {
  const MyIOLibrary = typeof window !== 'undefined' && window.MyIOLibrary;
  const MyIOUtils = typeof window !== 'undefined' && window.MyIOUtils;
  const MyIOAuth = MyIOUtils?.MyIOAuth;
  const CLIENT_ID = MyIOUtils?.CLIENT_ID;
  const CLIENT_SECRET = MyIOUtils?.CLIENT_SECRET;
  const getDataApiHost = MyIOUtils?.getDataApiHost || (() => 'https://api.data.apps.myio-bas.com');

  return {
    handleActionDashboard: async () => {
      LogHelper.log(`[${config.widgetName}] Opening dashboard for:`, entityObject.entityId);
      try {
        if (typeof MyIOLibrary?.openDashboardPopupEnergy !== 'function') {
          window.alert('Dashboard component não disponível');
          return;
        }
        // Get dates from window.STATE or MyIOUtils
        const startDate = window.STATE?.period?.startDateISO || MyIOUtils?.currentPeriod?.startDateISO;
        const endDate = window.STATE?.period?.endDateISO || MyIOUtils?.currentPeriod?.endDateISO;
        if (!startDate || !endDate) {
          window.alert('Período de datas não definido.');
          return;
        }
        if (!MyIOAuth || typeof MyIOAuth.getToken !== 'function') {
          LogHelper.error(`[${config.widgetName}] MyIOAuth not available`);
          window.alert('Autenticação não disponível. Recarregue a página.');
          return;
        }
        const tokenIngestionDashBoard = await MyIOAuth.getToken();
        const myTbTokenDashBoard = localStorage.getItem('jwt_token');

        MyIOLibrary.openDashboardPopupEnergy({
          deviceId: entityObject.entityId,
          readingType: config.domain, // 'water' or 'energy'
          startDate,
          endDate,
          tbJwtToken: myTbTokenDashBoard,
          ingestionToken: tokenIngestionDashBoard,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          onClose: () => {
            const o = document.querySelector('.myio-modal-overlay');
            if (o) o.remove();
          },
        });
      } catch (err) {
        LogHelper.error(`[${config.widgetName}] Error opening dashboard:`, err);
        window.alert('Erro ao abrir dashboard');
      }
    },

    handleActionReport: async () => {
      LogHelper.log(`[${config.widgetName}] Opening report for:`, item.ingestionId);
      try {
        if (!MyIOAuth || typeof MyIOAuth.getToken !== 'function') {
          LogHelper.error(`[${config.widgetName}] MyIOAuth not available for report`);
          window.alert('Autenticação não disponível. Recarregue a página.');
          return;
        }
        const ingestionToken = await MyIOAuth.getToken();
        await MyIOLibrary?.openDashboardPopupReport?.({
          ingestionId: item.ingestionId,
          identifier: item.identifier,
          label: item.label,
          domain: config.domain,
          api: {
            dataApiBaseUrl: getDataApiHost(),
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            ingestionToken,
          },
        });
      } catch (err) {
        LogHelper.error(`[${config.widgetName}] Error opening report:`, err);
        window.alert('Erro ao abrir relatório');
      }
    },

    handleActionSettings: async () => {
      LogHelper.log(`[${config.widgetName}] Opening settings for:`, entityObject.entityId);
      const jwt = localStorage.getItem('jwt_token');

      if (!jwt) {
        LogHelper.error(`[${config.widgetName}] JWT token not found`);
        window.alert('Token de autenticação não encontrado');
        return;
      }

      const tbId = entityObject.entityId;
      if (!tbId || tbId === item.ingestionId) {
        window.alert('ID inválido');
        return;
      }

      try {
        await MyIOLibrary?.openDashboardPopupSettings?.({
          deviceId: tbId,
          label: item.label,
          jwtToken: jwt,
          domain: config.domain,
          deviceType: entityObject.deviceType,
          deviceProfile: entityObject.deviceProfile,
          customerName: entityObject.customerName,
          connectionData: {
            centralName: entityObject.centralName,
            connectionStatusTime: entityObject.connectionStatusTime,
            timeVal: entityObject.timeVal || new Date('1970-01-01').getTime(),
            deviceStatus:
              entityObject.deviceStatus !== 'power_off' && entityObject.deviceStatus !== 'not_installed'
                ? 'power_on'
                : 'power_off',
            lastDisconnectTime: entityObject.lastDisconnectTime || 0,
          },
          ui: { title: 'Configurações', width: 900 },
          mapInstantaneousPower: entityObject.mapInstantaneousPower,
          onSaved: (payload) => {
            LogHelper.log(`[${config.widgetName}] Settings saved:`, payload);
            // Try to show success modal if available
            if (typeof window.showGlobalSuccessModal === 'function') {
              window.showGlobalSuccessModal(6);
            }
          },
          onClose: () => {
            const settingsOverlay = document.querySelector('.myio-settings-modal-overlay');
            if (settingsOverlay) settingsOverlay.remove();
            const overlay = document.querySelector('.myio-modal-overlay');
            if (overlay) overlay.remove();
            LogHelper.log(`[${config.widgetName}] Settings modal closed`);
          },
        });
      } catch (e) {
        LogHelper.error(`[${config.widgetName}] Error opening settings:`, e);
        window.alert('Erro ao abrir configurações');
      }
    },
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

    // RFC-0144: Create default handlers if none provided in context
    const defaultHandlers = createDefaultActionHandlers(config, entityObject, item);

    if (MyIOLibrary?.renderCardComponentHeadOffice) {
      MyIOLibrary.renderCardComponentHeadOffice(container, {
        entityObject: entityObject,
        debugActive: context?.debugActive || false,
        activeTooltipDebug: context?.activeTooltipDebug || false,
        delayTimeConnectionInMins: config.delayTimeConnectionInMins || 1440,
        handleClickCard: (ev, entity) => {
          LogHelper.log(`[${config.widgetName}] Card clicked: ${entity.name}`);
        },
        // RFC-0144: Use context handlers if provided, otherwise use defaults
        handleActionDashboard: context?.handleActionDashboard
          ? () => context.handleActionDashboard(entityObject, item)
          : defaultHandlers.handleActionDashboard,
        handleActionReport: context?.handleActionReport
          ? () => context.handleActionReport(entityObject, item)
          : defaultHandlers.handleActionReport,
        handleActionSettings: context?.handleActionSettings
          ? () => context.handleActionSettings(entityObject, item)
          : defaultHandlers.handleActionSettings,
        handleSelect: (checked, entity) => {
          if (!STATE.selectedIds) STATE.selectedIds = new Set();

          // RFC-0144: Notify MyIOSelectionStore for FOOTER integration
          const MyIOSelectionStore =
            (typeof window !== 'undefined' && window.MyIOLibrary?.MyIOSelectionStore) ||
            (typeof window !== 'undefined' && window.MyIOSelectionStore);

          if (checked) {
            STATE.selectedIds.add(String(entity.id));
            // Register and add to selection store for FOOTER
            if (MyIOSelectionStore) {
              if (MyIOSelectionStore.registerEntity) {
                MyIOSelectionStore.registerEntity(entity);
              }
              MyIOSelectionStore.add(entity.entityId || entity.id);
            }
          } else {
            STATE.selectedIds.delete(String(entity.id));
            // Remove from selection store
            if (MyIOSelectionStore) {
              MyIOSelectionStore.remove(entity.entityId || entity.id);
            }
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

  // RFC-0144 FIX: The header controller method is 'updateStats', not 'update'
  if (context?.headerController?.updateStats) {
    context.headerController.updateStats({
      online: onlineCount,
      total: total,
      consumption: totalConsumption,
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
 * Get cached data from orchestrator (MAIN v5.2.0 architecture)
 * Data structures:
 * - Energy: window.MyIOOrchestratorData[domain].items
 * - Water: window.MyIOOrchestratorData.waterClassified.{stores|commonArea|entrada}.items
 * Items are filtered using config.deviceFilter
 * @param {DeviceGridWidgetConfig} config - Widget configuration
 * @returns {Array|null} Cached device data
 */
export function getCachedData(config) {
  if (typeof window === 'undefined') return null;

  const orchestratorData = window.MyIOOrchestratorData;
  if (!orchestratorData) {
    LogHelper.log(`[${config.widgetName}] getCachedData: MyIOOrchestratorData not available`);
    return null;
  }

  // Water domain uses waterClassified structure
  if (config.domain === 'water') {
    const waterClassified = orchestratorData.waterClassified;
    if (waterClassified) {
      // Map context to waterClassified category
      // hidrometro (stores) -> waterClassified.stores
      // hidrometro_area_comum -> waterClassified.commonArea
      let categoryItems = null;
      if (config.context === 'hidrometro' || config.context === 'stores') {
        categoryItems = waterClassified.stores?.items;
        if (categoryItems?.length > 0) {
          LogHelper.log(
            `[${config.widgetName}] getCachedData: Found ${categoryItems.length} items via waterClassified.stores`
          );
          return categoryItems;
        }
      } else if (config.context === 'hidrometro_area_comum' || config.context === 'commonArea') {
        categoryItems = waterClassified.commonArea?.items;
        if (categoryItems?.length > 0) {
          LogHelper.log(
            `[${config.widgetName}] getCachedData: Found ${categoryItems.length} items via waterClassified.commonArea`
          );
          return categoryItems;
        }
      } else if (config.context === 'entrada') {
        categoryItems = waterClassified.entrada?.items;
        if (categoryItems?.length > 0) {
          LogHelper.log(
            `[${config.widgetName}] getCachedData: Found ${categoryItems.length} items via waterClassified.entrada`
          );
          return categoryItems;
        }
      }

      // Fallback: try 'all' items with deviceFilter
      const allItems = waterClassified.all?.items;
      if (allItems && Array.isArray(allItems) && config.deviceFilter) {
        const filteredItems = allItems.filter(config.deviceFilter);
        if (filteredItems.length > 0) {
          LogHelper.log(
            `[${config.widgetName}] getCachedData: Found ${filteredItems.length} items via waterClassified.all (filtered from ${allItems.length})`
          );
          return filteredItems;
        }
      }

      LogHelper.log(`[${config.widgetName}] getCachedData: waterClassified exists but no items for context ${config.context}`);
    } else {
      LogHelper.log(`[${config.widgetName}] getCachedData: waterClassified not available`);
    }
    return null;
  }

  // Energy/Temperature domain: [domain].items
  const domainCache = orchestratorData[config.domain];
  if (domainCache?.items && Array.isArray(domainCache.items)) {
    // Filter items using the deviceFilter from config
    const filteredItems = config.deviceFilter
      ? domainCache.items.filter(config.deviceFilter)
      : domainCache.items;

    if (filteredItems.length > 0) {
      LogHelper.log(
        `[${config.widgetName}] getCachedData: Found ${filteredItems.length} items via ${config.domain}.items (filtered from ${domainCache.items.length})`
      );
      return filteredItems;
    }
    LogHelper.log(
      `[${config.widgetName}] getCachedData: ${config.domain}.items has ${domainCache.items.length} items but none matched deviceFilter`
    );
  } else {
    LogHelper.log(`[${config.widgetName}] getCachedData: No cached data found for domain ${config.domain}`);
  }

  return null;
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
    headerControllerExternal: false, // RFC-0159: Flag to indicate if header was provided externally
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

  let busyModalRef = null; // RFC-0144: Store reference for onDataUpdated

  function registerEventHandlers(busyModal) {
    busyModalRef = busyModal; // RFC-0144: Save reference

    const dataReadyHandler = () => {
      const items = getCachedData(config);
      if (items && items.length > 0) {
        // RFC-0144 FIX: Don't overwrite good data with worse data
        if (STATE.itemsBase.length > 0 && items.length < STATE.itemsBase.length) {
          LogHelper.log(`[${config.widgetName}] Data ready skipped: current ${STATE.itemsBase.length} items > cache ${items.length} items`);
          return;
        }
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
      // RFC-0144 FIX: Always update data on summary-ready, not just the first time
      if (items && items.length > 0) {
        // RFC-0144 FIX: Don't overwrite good data with worse data
        if (STATE.itemsBase.length > 0 && items.length < STATE.itemsBase.length) {
          LogHelper.log(`[${config.widgetName}] Summary ready skipped: current ${STATE.itemsBase.length} items > cache ${items.length} items`);
          return;
        }
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

    // RFC-0143 FIX: Also listen to MAIN's provide-data event for compatibility
    const provideDataHandler = (ev) => {
      const { domain, items } = ev.detail || {};
      // Only process if this event is for our domain
      if (domain !== config.domain) return;

      // Filter items using deviceFilter
      const filteredItems = config.deviceFilter
        ? items.filter(config.deviceFilter)
        : items;

      // RFC-0144 FIX: Only update if filtered result is better (more items) than current
      // This prevents bad filtered data from overwriting good cached data
      if (filteredItems && filteredItems.length > 0) {
        // Skip if we already have more/equal items (don't overwrite good data with worse)
        if (STATE.itemsBase.length > 0 && filteredItems.length < STATE.itemsBase.length) {
          LogHelper.log(`[${config.widgetName}] Provide-data event skipped: current ${STATE.itemsBase.length} items > filtered ${filteredItems.length} items`);
          return;
        }
        LogHelper.log(`[${config.widgetName}] Provide-data event: ${filteredItems.length} items (from ${items?.length || 0})`);
        STATE.itemsBase = filteredItems;
        STATE.itemsEnriched = filteredItems.map((item) => ({
          ...item,
          value: Number(item.value || item.consumption || item.pulses || 0),
        }));
        STATE.dataFromMain = true;
        busyModal.hideBusy();
        reflow();
      }
    };

    // RFC-0143 FIX: Listen to MAIN's water-tb-data-ready event for water domain
    const waterTbDataReadyHandler = (ev) => {
      // Only process for water domain widgets
      if (config.domain !== 'water') return;

      const waterClassified = ev.detail || {};
      let items = null;

      // Map context to waterClassified category
      if (config.context === 'hidrometro' || config.context === 'stores') {
        items = waterClassified.stores?.items;
      } else if (config.context === 'hidrometro_area_comum' || config.context === 'commonArea') {
        items = waterClassified.commonArea?.items;
      } else if (config.context === 'entrada') {
        items = waterClassified.entrada?.items;
      }

      // RFC-0144 FIX: Always update data, not just the first time
      if (items && items.length > 0) {
        // RFC-0144 FIX: Don't overwrite good data with worse data
        if (STATE.itemsBase.length > 0 && items.length < STATE.itemsBase.length) {
          LogHelper.log(`[${config.widgetName}] water-tb-data-ready skipped: current ${STATE.itemsBase.length} items > event ${items.length} items`);
          return;
        }
        LogHelper.log(`[${config.widgetName}] water-tb-data-ready event: ${items.length} items for context ${config.context}`);
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
    window.addEventListener('myio:telemetry:provide-data', provideDataHandler);
    window.addEventListener('myio:water-tb-data-ready', waterTbDataReadyHandler);
    window.addEventListener('myio:filter-applied', filterAppliedHandler);
    window.addEventListener(config.summaryReadyEvent, summaryReadyHandler);

    eventHandlers.push(
      { event: 'myio:data-ready', handler: dataReadyHandler },
      { event: 'myio:telemetry:provide-data', handler: provideDataHandler },
      { event: 'myio:water-tb-data-ready', handler: waterTbDataReadyHandler },
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
    onInit: async function (selfCtx) {
      LogHelper.log(`[${config.widgetName}] RFC-0143 Factory Controller - onInit`);

      // RFC-0143 FIX: selfCtx is passed from widget controller (self.ctx)
      // This is needed because 'self' is not available in the bundled library context
      if (!selfCtx || !selfCtx.$container) {
        LogHelper.error(`[${config.widgetName}] onInit: selfCtx or $container not provided`);
        return;
      }

      $root = () => $(selfCtx.$container[0]);

      const busyModal = createBusyModal(config, $root);

      // RFC-0144: Initialize filter modal FIRST so we can reference it in header's onFilterClick
      // RFC-0159: Use config.createFilterModal if provided, otherwise fallback to window.MyIOUtils
      const createFilterModal =
        config.createFilterModal ||
        (typeof window !== 'undefined' && window.MyIOUtils?.createFilterModal);

      if (createFilterModal) {
        context.filterModalController = createFilterModal({
          $container: $root(),
          tabs: config.filterTabs || [{ id: 'all', label: 'Todos', filter: () => true }],
          onApply: (selectedIds) => {
            STATE.selectedIds = selectedIds;
            reflow();
          },
        });
      }

      // RFC-0144: Function to open filter modal (called by header's onFilterClick)
      function openFilterModal() {
        if (context.filterModalController?.open) {
          context.filterModalController.open();
        } else if (context.filterModalController?.show) {
          context.filterModalController.show();
        } else {
          LogHelper.warn(`[${config.widgetName}] Filter modal controller has no open/show method`);
        }
      }

      // RFC-0159: Use pre-built headerController if provided
      if (config.headerController) {
        context.headerController = config.headerController;
        context.headerControllerExternal = true; // Don't destroy on cleanup
        LogHelper.log(`[${config.widgetName}] Using pre-built header controller from config`);
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
      // RFC-0144 FIX: Actually refresh data from cache when called
      const items = getCachedData(config);
      if (items && items.length > 0) {
        // RFC-0144 FIX: Don't overwrite good data with worse data
        if (STATE.itemsBase.length > 0 && items.length < STATE.itemsBase.length) {
          LogHelper.log(`[${config.widgetName}] onDataUpdated skipped: current ${STATE.itemsBase.length} items > cache ${items.length} items`);
          return;
        }
        LogHelper.log(`[${config.widgetName}] onDataUpdated: refreshing from cache with ${items.length} items`);
        STATE.itemsBase = items;
        STATE.itemsEnriched = items.map((item) => ({
          ...item,
          value: Number(item.value || item.consumption || item.pulses || 0),
        }));
        STATE.dataFromMain = true;
        if (busyModalRef) busyModalRef.hideBusy();
        reflow();
      }
    },

    onDestroy: function () {
      LogHelper.log(`[${config.widgetName}] RFC-0143 Factory Controller - onDestroy`);
      unregisterEventHandlers();

      // RFC-0159: Only destroy header if it was created internally
      if (!context.headerControllerExternal) {
        context.headerController?.destroy?.();
      }
      context.filterModalController?.destroy?.();

      STATE.itemsBase = [];
      STATE.itemsEnriched = [];
      STATE.selectedIds = null;
    },

    getState: () => STATE,
    getHeaderController: () => context.headerController,
    getFilterModalController: () => context.filterModalController,
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
