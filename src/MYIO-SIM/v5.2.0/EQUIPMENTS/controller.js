/* global self, window, document, localStorage, MyIOLibrary, requestAnimationFrame, $ */

// ============================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================
// Use shared utilities from MAIN, with fallback to local implementation
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const getDataApiHost = () => {
  const host = window.MyIOUtils?.DATA_API_HOST;
  if (!host) {
    console.error('[EQUIPMENTS] DATA_API_HOST not available - MAIN widget not loaded');
  }
  return host || '';
};

// RFC-0071: Device Profile functions (from MAIN)
const syncDeviceProfileAttributes = window.MyIOUtils?.syncDeviceProfileAttributes;

// RFC-0078: Power Limits functions (from MAIN)
const getConsumptionRangesHierarchical = window.MyIOUtils?.getConsumptionRangesHierarchical;
const getCachedConsumptionLimits = window.MyIOUtils?.getCachedConsumptionLimits;

// UI Helpers (from MAIN)
const formatRelativeTime =
  window.MyIOUtils?.formatRelativeTime || ((ts) => (ts ? new Date(ts).toLocaleString() : '—'));
const formatarDuracao = window.MyIOUtils?.formatarDuracao || ((ms) => `${Math.round(ms / 1000)}s`);
const showLoadingOverlay =
  window.MyIOUtils?.showLoadingOverlay ||
  ((show) => {
    const overlay = document.getElementById('equipments-loading-overlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
  });
const updateEquipmentStats = window.MyIOUtils?.updateEquipmentStats;
const getCustomerNameForDevice =
  window.MyIOUtils?.getCustomerNameForDevice || ((device) => device.customerId || 'N/A');

// ============================================
// EQUIPMENTS WIDGET STATE
// ============================================
let CUSTOMER_ID;
let CLIENT_ID;
let CLIENT_SECRET;
let MAP_INSTANTANEOUS_POWER;
let DELAY_TIME_CONNECTION_MINS;
let myIOAuth; // Instance of MyIO auth component from MyIOLibrary
let activeCardComponents = [];

// RFC-0093: Centralized header controller
let equipHeaderController = null;

// Card rendering options (from settings, with defaults)
let USE_NEW_COMPONENTS = true;
let ENABLE_SELECTION = true;
let ENABLE_DRAG_DROP = true;
let HIDE_INFO_MENU_ITEM = true;
let DEBUG_ACTIVE = false;
let ACTIVE_TOOLTIP_DEBUG = false;

LogHelper.log('[MYIO EQUIPMENTS] Script loaded, using shared utilities:', !!window.MyIOUtils);

// RFC-0071: Device Profile Synchronization - Global flag to track if sync has been completed
let __deviceProfileSyncComplete = false;

// Store customer limits JSON globally for the widget session
window.__customerPowerLimitsJSON = null;

// findValue helper function (from MAIN via MyIOUtils)
// RFC-0091: Fallback supports both { key, value } and { dataType, value } formats
const findValue =
  window.MyIOUtils?.findValue ||
  ((values, key, defaultValue = null) => {
    // Fallback implementation when MAIN is not loaded yet
    if (!Array.isArray(values)) return defaultValue;
    const found = values.find((v) => v.key === key || v.dataType === key);
    return found ? found.value : defaultValue;
  });

// NOTE: fetchCustomerServerScopeAttrs is provided by MAIN via window.MyIOUtils
const fetchCustomerServerScopeAttrs =
  window.MyIOUtils?.fetchCustomerServerScopeAttrs ||
  (() => {
    console.error('[EQUIPMENTS] fetchCustomerServerScopeAttrs not available - MAIN widget not loaded');
    return {};
  });

/**
 * Creates a proper modal backdrop
 * @returns {HTMLElement} The backdrop element
 */
function createModalBackdrop() {
  const backdrop = document.createElement('div');
  backdrop.className = 'dashboard-modal-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 9998;
    animation: fadeIn 0.2s ease-in;
  `;

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeExistingModals();
    }
  });

  return backdrop;
}

/**
 * Closes any existing modal instances to prevent conflicts
 */
function closeExistingModals() {
  // Close any existing energy dashboards
  const existingModals = document.querySelectorAll(
    '.energy-dashboard-modal, .dashboard-popup, .myio-modal-overlay'
  );
  existingModals.forEach((modal) => {
    modal.remove();
  });

  // Remove backdrops
  const backdrops = document.querySelectorAll('.dashboard-modal-backdrop, .modal-backdrop');
  backdrops.forEach((backdrop) => {
    backdrop.remove();
  });

  LogHelper.log('[EQUIPMENTS] [RFC-0072] Cleaned up existing modals');
}

// NOTE: getCustomerNameForDevice is now provided by MAIN via window.MyIOUtils (see const declaration at top of file)

// ============================================
// END RFC-0072 MODAL UTILITIES
// ============================================

// Initialize cards
// Initialize cards
function initializeCards(devices) {
  // 1. LIMPEZA: Destrói instâncias antigas para remover ouvintes de eventos da memória
  if (typeof activeCardComponents !== 'undefined' && Array.isArray(activeCardComponents)) {
    activeCardComponents.forEach((comp) => {
      if (comp && typeof comp.destroy === 'function') {
        comp.destroy();
      }
    });
    activeCardComponents = []; // Zera a lista
  }

  const grid = document.getElementById('cards-grid');
  grid.innerHTML = '';

  devices.forEach((device, _index) => {
    const container = document.createElement('div');
    //LogHelper.log("[EQUIPMENTS] Rendering device:", device);
    grid.appendChild(container);

    // Garantir que o deviceStatus existe (fallback para no_info se não existir)
    if (!device.deviceStatus) {
      LogHelper.log('[EQUIPMENTS] Rendering device:', device);
      device.deviceStatus = device.connectionStatus;
    }

    const customerName = getCustomerNameForDevice(device);
    device.customerName = customerName;
    device.domain = 'energy'; // RFC-0087: Energy domain for kWh/MWh/GWh formatting

    // RFC-0091: delayTimeConnectionInMins - configurable via MAIN settings (required)
    const delayTimeConnectionInMins = window.MyIOUtils?.getDelayTimeConnectionInMins?.();
    if (delayTimeConnectionInMins === undefined || delayTimeConnectionInMins === null) {
      LogHelper.error(
        '[EQUIPMENTS] delayTimeConnectionInMins não informado. Verifique se MyIOUtils.getDelayTimeConnectionInMins() está disponível.'
      );
    }

    // 2. RENDERIZAÇÃO: Capturamos a instância retornada na variável 'cardInstance'
    const cardInstance = MyIOLibrary.renderCardComponentHeadOffice(container, {
      entityObject: device,
      debugActive: DEBUG_ACTIVE,
      activeTooltipDebug: ACTIVE_TOOLTIP_DEBUG,
      delayTimeConnectionInMins,

      // 3. SELEÇÃO INICIAL: Verifica na Store se este card já deve nascer selecionado
      isSelected: (function () {
        const store = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
        // Verifica se a store existe e se o ID deste device está na lista
        return store ? store.getSelectedIds().includes(device.entityId) : false;
      })(),

      handleActionDashboard: async () => {
        // RFC-0072: Enhanced modal handling to prevent corruption
        LogHelper.log('[EQUIPMENTS] [RFC-0072] Opening energy dashboard for:', device.entityId);

        try {
          // 1. Ensure component is available
          if (typeof MyIOLibrary.openDashboardPopupEnergy !== 'function') {
            LogHelper.error('[EQUIPMENTS] [RFC-0072] openDashboardPopupEnergy component not loaded');
            window.window.alert('Dashboard component não disponível');
            return;
          }

          // 2. Clean up any existing modal state
          closeExistingModals();

          // 3. Get tokens (RFC-0093: Guard against undefined myIOAuth)
          if (!myIOAuth || typeof myIOAuth.getToken !== 'function') {
            LogHelper.error('[EQUIPMENTS] myIOAuth not available');
            window.alert('Autenticação não disponível. Recarregue a página.');
            return;
          }

          const tokenIngestionDashBoard = await myIOAuth.getToken();
          const myTbTokenDashBoard = localStorage.getItem('jwt_token');

          if (!myTbTokenDashBoard) {
            throw new Error('JWT token não encontrado');
          }

          // 4. Inject backdrop first
          const backdrop = createModalBackdrop();
          document.body.appendChild(backdrop);

          // 5. Wait for next frame to ensure DOM is ready
          await new Promise((resolve) => requestAnimationFrame(resolve));

          // 6. Open modal with proper error handling
          const modal = MyIOLibrary.openDashboardPopupEnergy({
            deviceId: device.entityId,
            readingType: 'energy',
            startDate: self.ctx.$scope.startDateISO,
            endDate: self.ctx.$scope.endDateISO,
            tbJwtToken: myTbTokenDashBoard,
            ingestionToken: tokenIngestionDashBoard,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            onOpen: (context) => {
              LogHelper.log('[EQUIPMENTS] [RFC-0072] Modal opened:', context);
            },
            onError: (error) => {
              LogHelper.error('[EQUIPMENTS] [RFC-0072] Modal error:', error);
              backdrop.remove();
              window.alert(`Erro: ${error.message}`);
            },
            onClose: () => {
              backdrop.remove();
              const overlay = document.querySelector('.myio-modal-overlay');
              if (overlay) {
                overlay.remove();
              }
              LogHelper.log('[EQUIPMENTS] [RFC-0072] Energy dashboard closed');
            },
          });

          // 7. Verify modal was created
          if (!modal) {
            LogHelper.error('[EQUIPMENTS] [RFC-0072] Modal failed to initialize');
            backdrop.remove();
            window.alert('Erro ao abrir dashboard');
            return;
          }

          LogHelper.log('[EQUIPMENTS] [RFC-0072] Energy dashboard opened successfully');
        } catch (err) {
          LogHelper.error('[EQUIPMENTS] [RFC-0072] Error opening energy dashboard:', err);
          closeExistingModals();
          window.alert('Credenciais ainda carregando. Tente novamente em instantes.');
        }
      },

      handleActionReport: async () => {
        try {
          // RFC-0093: Guard against undefined myIOAuth
          if (!myIOAuth || typeof myIOAuth.getToken !== 'function') {
            LogHelper.error('[EQUIPMENTS] myIOAuth not available for report');
            window.alert('Autenticação não disponível. Recarregue a página.');
            return;
          }
          const ingestionToken = await myIOAuth.getToken();

          if (!ingestionToken) throw new Error('No ingestion token');

          await MyIOLibrary.openDashboardPopupReport({
            ingestionId: device.ingestionId,
            identifier: device.deviceIdentifier,
            label: device.labelOrName,
            domain: 'energy',
            api: {
              dataApiBaseUrl: getDataApiHost(),
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken,
            },
          });
        } catch (err) {
          LogHelper.warn('[EQUIPMENTS] Report open blocked:', err?.message || err);
          window.alert('Credenciais ainda carregando. Tente novamente em instantes.');
        }
      },

      handleActionSettings: async () => {
        // RFC-0072: Standardized settings handler following TELEMETRY pattern
        const jwt = localStorage.getItem('jwt_token');

        if (!jwt) {
          LogHelper.error('[EQUIPMENTS] [RFC-0072] JWT token not found');
          window.alert('Token de autenticação não encontrado');
          return;
        }

        try {
          // RFC-0072: Following exact TELEMETRY pattern with domain and connectionData
          // RFC-0077: Added customerName and deviceType parameters
          // RFC-0076: Added deviceProfile for 3F_MEDIDOR fallback rule
          await MyIOLibrary.openDashboardPopupSettings({
            deviceId: device.entityId, // TB deviceId
            label: device.labelOrName,
            jwtToken: jwt,
            domain: 'energy', // Same as TELEMETRY WIDGET_DOMAIN
            deviceType: device.deviceType, // RFC-0077: Pass deviceType for Power Limits feature
            deviceProfile: device.deviceProfile, // RFC-0076: Pass deviceProfile for 3F_MEDIDOR fallback
            customerName: device.customerName || getCustomerNameForDevice(device), // RFC-0077: Pass shopping name
            connectionData: {
              centralName: device.centralName || getCustomerNameForDevice(device),
              connectionStatusTime: device.lastConnectTime,
              timeVal: device.lastActivityTime || new Date('1970-01-01').getTime(),
              deviceStatus:
                device.deviceStatus !== 'power_off' && device.deviceStatus !== 'not_installed'
                  ? 'power_on'
                  : 'power_off',
              lastDisconnectTime: device.lastDisconnectTime || 0,
            },
            ui: { title: 'Configurações', width: 900 },
            mapInstantaneousPower: device.mapInstantaneousPower, // RFC-0078: Pass existing map if available
            onSaved: (payload) => {
              LogHelper.log('[EQUIPMENTS] [RFC-0072] Settings saved:', payload);
              // Mostra modal global de sucesso com contador e reload
              //showGlobalSuccessModal(6);
            },
            onClose: () => {
              $('.myio-settings-modal-overlay').remove();
              const overlay = document.querySelector('.myio-modal-overlay');
              if (overlay) {
                overlay.remove();
              }
              LogHelper.log('[EQUIPMENTS] [RFC-0072] Settings modal closed');
            },
          });
        } catch (e) {
          LogHelper.error('[EQUIPMENTS] [RFC-0072] Error opening settings:', e);
          window.alert('Erro ao abrir configurações');
        }
      },

      handleSelect: (checked, entity) => {
        // Busca a Store global
        const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
        if (MyIOSelectionStore) {
          if (checked) {
            // 1. IMPORTANTE: Registra os dados (Nome, Valor, Unidade) na Store
            if (MyIOSelectionStore.registerEntity) {
              // console.log('[Main Widget] Registering entity in MyIOSelectionStore:', entity);
              MyIOSelectionStore.registerEntity(entity);
            }
            // 2. Adiciona o ID na lista de selecionados
            MyIOSelectionStore.add(entity.entityId || entity.id);
          } else {
            // 3. Remove o ID da lista
            MyIOSelectionStore.remove(entity.entityId || entity.id);
          }
        } else {
          console.warn('[Main Widget] MyIOSelectionStore não encontrada!');
        }
      },

      handleClickCard: (ev, entity) => {
        LogHelper.log(`Card clicked: ${entity.labelOrName} - Power: ${entity.val}kWh`);
      },

      useNewComponents: USE_NEW_COMPONENTS,
      enableSelection: ENABLE_SELECTION,
      enableDragDrop: ENABLE_DRAG_DROP,
      // RFC-0072: Disable "More Information" menu item (redundant with card click)
      hideInfoMenuItem: HIDE_INFO_MENU_ITEM,
    });

    // 4. PERSISTÊNCIA: Guarda a instância criada na lista global para limpeza futura
    activeCardComponents.push(cardInstance);
  });

  LogHelper.log('[EQUIPMENTS] Cards initialized successfully (Event-Driven Mode)');
}

self.onInit = async function () {
  // RFC-0091: Protection against duplicate onInit calls (use global scope for multiple widget instances)
  if (window.__EQUIPMENTS_INITIALIZED__) {
    LogHelper.log('[EQUIPMENTS] onInit - already initialized, skipping duplicate call');
    return;
  }
  window.__EQUIPMENTS_INITIALIZED__ = true;

  LogHelper.log('[EQUIPMENTS] onInit - ctx:', self.ctx);

  // Load card rendering options from settings
  USE_NEW_COMPONENTS = self.ctx.settings?.useNewComponents ?? true;
  ENABLE_SELECTION = self.ctx.settings?.enableSelection ?? true;
  ENABLE_DRAG_DROP = self.ctx.settings?.enableDragDrop ?? true;
  HIDE_INFO_MENU_ITEM = self.ctx.settings?.hideInfoMenuItem ?? true;
  DEBUG_ACTIVE = self.ctx.settings?.debugActive ?? false;
  ACTIVE_TOOLTIP_DEBUG = self.ctx.settings?.activeTooltipDebug ?? false;
  LogHelper.log(
    `[EQUIPMENTS] Configured: debugActive=${DEBUG_ACTIVE}, activeTooltipDebug=${ACTIVE_TOOLTIP_DEBUG}`
  );

  // RFC-0093: Build centralized header via buildHeaderDevicesGrid
  const buildHeaderDevicesGrid = window.MyIOUtils?.buildHeaderDevicesGrid;
  if (buildHeaderDevicesGrid) {
    equipHeaderController = buildHeaderDevicesGrid({
      container: '#equipHeaderContainer',
      domain: 'energy',
      idPrefix: 'equip',
      labels: {
        total: 'Total de Equipamentos',
        consumption: 'Consumo Total de Todos Equipamentos',
      },
      includeSearch: true,
      includeFilter: true,
      onSearchClick: () => {
        STATE.searchActive = !STATE.searchActive;
        if (STATE.searchActive) {
          const input = equipHeaderController?.getSearchInput();
          if (input) setTimeout(() => input.focus(), 100);
        }
      },
      onFilterClick: () => {
        openFilterModal();
      },
    });

    // Setup search input listener
    const searchInput = equipHeaderController?.getSearchInput();
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        STATE.searchTerm = e.target.value || '';
        reflowCards();
      });
    }

    LogHelper.log('[EQUIPMENTS] RFC-0093: Header built via buildHeaderDevicesGrid');
  } else {
    LogHelper.warn('[EQUIPMENTS] RFC-0093: buildHeaderDevicesGrid not available');
  }

  // ⭐ CRITICAL FIX: Show loading IMMEDIATELY before setTimeout
  showLoadingOverlay(true);

  setTimeout(async () => {
    // -- util: aplica no $scope e roda digest
    function applyParams(p) {
      self.ctx.$scope.startDateISO = p?.globalStartDateFilter || null;
      self.ctx.$scope.endDateISO = p?.globalEndDateFilter || null;
      if (self.ctx?.$scope?.$applyAsync) self.ctx.$scope.$applyAsync();
    }

    // -- util: espera até ter datas (evento + polling), sem bloquear
    function waitForDateParams({ pollMs = 300, timeoutMs = 15000 } = {}) {
      return new Promise((resolve) => {
        let resolved = false;
        let poller = null;
        let timer = null;

        const tryResolve = (p) => {
          const s = p?.globalStartDateFilter || null;
          const e = p?.globalEndDateFilter || null;
          if (s && e) {
            resolved = true;
            cleanup();
            applyParams(p);
            resolve({ start: s, end: e, from: 'state/event' });
            return true;
          }
          return false;
        };

        const onEvt = (ev) => {
          tryResolve(ev.detail);
        };

        const cleanup = () => {
          window.removeEventListener('myio:date-params', onEvt);
          if (poller) clearInterval(poller);
          if (timer) clearTimeout(timer);
        };

        // 1) escuta evento do pai
        window.addEventListener('myio:date-params', onEvt);

        // 2) tenta estado atual imediatamente
        if (tryResolve(window.myioStateParams || {})) return;

        // 3) solicita explicitamente ao pai
        window.dispatchEvent(new CustomEvent('myio:request-date-params'));

        // 4) polling leve a cada 300ms
        poller = setInterval(() => {
          tryResolve(window.myioStateParams || {});
        }, pollMs);

        // 5) timeout de segurança -> usa fallback (últimos 7 dias)
        timer = setTimeout(() => {
          if (!resolved) {
            cleanup();
            const end = new Date();
            const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
            const startISO = start.toISOString();
            const endISO = end.toISOString();
            applyParams({
              globalStartDateFilter: startISO,
              globalEndDateFilter: endISO,
            });
            resolve({ start: startISO, end: endISO, from: 'fallback-7d' });
          }
        }, timeoutMs);
      });
    }

    // ====== fluxo do widget ======
    // tenta aplicar o que já existir (não bloqueia)
    applyParams(window.myioStateParams || {});

    // garante sincronização inicial antes de continuar
    const datesFromParent = await waitForDateParams({
      pollMs: 300,
      timeoutMs: 15000,
    });
    LogHelper.log('[EQUIPMENTS] date params ready:', datesFromParent);

    // agora já pode carregar dados / inicializar UI dependente de datas
    if (typeof self.loadData === 'function') {
      await self.loadData(self.ctx.$scope.startDateISO, self.ctx.$scope.endDateISO);
    }

    // mantém sincronizado em updates futuros do pai/irmão A
    self._onDateParams = (ev) => {
      applyParams(ev.detail);
      if (typeof self.loadData === 'function') {
        self.loadData(self.ctx.$scope.startDateISO, self.ctx.$scope.endDateISO);
      }
    };
    window.addEventListener('myio:date-params', self._onDateParams);

    // ✅ Listen for shopping filter from MENU
    self._onFilterApplied = (ev) => {
      LogHelper.log('[EQUIPMENTS] heard myio:filter-applied:', ev.detail);

      // Extract shopping IDs from selection
      const selection = ev.detail?.selection || [];
      const shoppingIds = selection.map((s) => s.value).filter((v) => v);

      LogHelper.log(
        '[EQUIPMENTS] Applying shopping filter:',
        shoppingIds.length === 0 ? 'ALL' : `${shoppingIds.length} shoppings`
      );

      // Update STATE and reflow cards
      STATE.selectedShoppingIds = shoppingIds;

      // Render shopping filter chips
      renderShoppingFilterChips(selection);

      reflowCards();
    };
    window.addEventListener('myio:filter-applied', self._onFilterApplied);

    // Function to render shopping filter chips in toolbar
    function renderShoppingFilterChips(selection) {
      const chipsContainer = document.getElementById('shoppingFilterChips');
      if (!chipsContainer) return;

      chipsContainer.innerHTML = '';

      LogHelper.log('[EQUIPMENTS] STATE.selectedShoppingIds', STATE.selectedShoppingIds);

      if (!selection || selection.length === 0) {
        return; // No filter applied, hide chips
      }

      selection.forEach((shopping) => {
        const chip = document.createElement('span');
        chip.className = 'filter-chip';
        chip.innerHTML = `<span class="filter-chip-icon">🏬</span><span>${shopping.name}</span>`;
        chipsContainer.appendChild(chip);
      });

      LogHelper.log('[EQUIPMENTS] 📍 Rendered', selection.length, 'shopping filter chips');
    }

    // ============================================
    // CREDENTIALS: Use MAIN's credentials via MyIOUtils
    // ============================================
    // Hierarchy:
    // 1. window.MyIOUtils.getCredentials() - from MAIN (preferred)
    // 2. fetchCustomerServerScopeAttrs() - direct fetch (fallback)
    const mainCredentials = window.MyIOUtils?.getCredentials?.() || {};
    // RFC-0091 FIX: For API calls, use customerId (ingestionId) from credentials
    // For SERVER_SCOPE fetch, use customerTB_ID (ThingsBoard entity ID)
    CUSTOMER_ID = mainCredentials.customerId || window.myioHoldingCustomerId || '';
    const CUSTOMER_TB_ID = window.MyIOOrchestrator?.customerTB_ID || window.MyIOUtils?.customerTB_ID || '';

    // Objeto principal para armazenar os dados dos dispositivos
    const devices = {};

    // 🗺️ NOVO: Mapa para conectar o ingestionId ao ID da entidade do ThingsBoard
    const ingestionIdToEntityIdMap = new Map();

    // --- FASE 1: RFC-0102 - Get EQUIPMENT devices from Orchestrator (not ctx.data) ---
    // MAIN already has TB datasource "Equipamentos e Lojas" and classifies devices
    // EQUIPMENTS widget should only show equipment devices (NOT lojas)
    const orchestrator = window.MyIOOrchestrator;
    let orchestratorDevices = [];

    if (orchestrator?.isDevicesClassified?.()) {
      // Devices already classified - get ONLY equipment devices
      orchestratorDevices = orchestrator.getEquipmentDevices() || [];
      LogHelper.log(
        `[EQUIPMENTS] RFC-0102: Got ${orchestratorDevices.length} EQUIPMENT devices from Orchestrator (already classified)`
      );
    } else {
      // Wait for classification to complete
      LogHelper.log('[EQUIPMENTS] RFC-0102: Waiting for MAIN to classify devices...');
      await new Promise((resolve) => {
        const handler = (ev) => {
          window.removeEventListener('myio:devices-classified', handler);
          // Get ONLY equipment devices after classification
          orchestratorDevices = orchestrator?.getEquipmentDevices?.() || [];
          LogHelper.log(
            `[EQUIPMENTS] RFC-0102: Got ${orchestratorDevices.length} EQUIPMENT devices after classification event`
          );
          resolve();
        };
        window.addEventListener('myio:devices-classified', handler);
        // Also trigger extraction in case MAIN hasn't processed yet
        if (orchestrator?.extractEnergyDevicesMetadata) {
          orchestrator.extractEnergyDevicesMetadata();
        }
        // Timeout fallback
        setTimeout(() => {
          window.removeEventListener('myio:devices-classified', handler);
          if (orchestratorDevices.length === 0) {
            LogHelper.warn('[EQUIPMENTS] RFC-0102: Classification timeout, using fallback');
            orchestratorDevices = orchestrator?.getEquipmentDevices?.() || [];
          }
          resolve();
        }, 3000);
      });
    }

    // Transform orchestrator devices to the format expected by renderDeviceCards
    // Each device needs: name, label, values[] array for findValue() compatibility
    orchestratorDevices.forEach((device) => {
      const entityId = device.entityId || device.tbId;
      if (!entityId) return;

      // Build values array from flat orchestrator properties
      const values = [];
      const now = Date.now();

      if (device.ingestionId != null)
        values.push({ dataType: 'ingestionId', value: device.ingestionId, ts: now });
      if (device.identifier != null)
        values.push({ dataType: 'identifier', value: device.identifier, ts: now });
      if (device.deviceType != null)
        values.push({ dataType: 'deviceType', value: device.deviceType, ts: now });
      if (device.deviceProfile != null)
        values.push({ dataType: 'deviceProfile', value: device.deviceProfile, ts: now });
      if (device.connectionStatus != null)
        values.push({ dataType: 'connectionStatus', value: device.connectionStatus, ts: now });
      if (device.centralName != null)
        values.push({ dataType: 'centralName', value: device.centralName, ts: now });
      if (device.ownerName != null) values.push({ dataType: 'ownerName', value: device.ownerName, ts: now });
      if (device.assetName != null) values.push({ dataType: 'assetName', value: device.assetName, ts: now });
      if (device.lastActivityTime != null)
        values.push({ dataType: 'lastActivityTime', value: device.lastActivityTime, ts: now });
      if (device.lastConnectTime != null)
        values.push({ dataType: 'lastConnectTime', value: device.lastConnectTime, ts: now });
      if (device.lastDisconnectTime != null)
        values.push({ dataType: 'lastDisconnectTime', value: device.lastDisconnectTime, ts: now });
      if (device.customerId != null)
        values.push({ dataType: 'customerId', value: device.customerId, ts: now });
      if (device.deviceMapInstaneousPower != null)
        values.push({
          dataType: 'deviceMapInstaneousPower',
          value: device.deviceMapInstaneousPower,
          ts: now,
        });

      // Consumption value from Orchestrator (can be 'value' or 'consumption' or 'consumptionPower')
      // The Orchestrator stores consumption in 'value' field (from API response)
      const consumptionValue = device.value ?? device.consumption ?? device.consumptionPower ?? null;
      if (consumptionValue != null) {
        values.push({
          dataType: 'consumption_power',
          value: consumptionValue,
          ts: device.consumptionTimestamp || now,
        });
        // Also add as 'consumption' for backward compatibility in renderDeviceCards filter
        values.push({
          dataType: 'consumption',
          value: consumptionValue,
          ts: device.consumptionTimestamp || now,
        });
      }

      devices[entityId] = {
        name: device.name || device.label || 'Unknown',
        label: device.label || device.name || 'Unknown',
        values: values,
      };

      // Build ingestionId to entityId map
      if (device.ingestionId) {
        ingestionIdToEntityIdMap.set(device.ingestionId, entityId);
      }
    });

    LogHelper.log(`[EQUIPMENTS] RFC-0102: Built ${Object.keys(devices).length} devices from Orchestrator`);

    // Note: RFC-0071 device profile sync disabled - profiles now come from MAIN's TB datasource
    const boolExecSync = false;

    // ============================================
    // CREDENTIALS: Prefer MAIN's, fallback to direct fetch
    // ============================================
    // MAIN already fetched credentials, reuse them if available
    if (mainCredentials.clientId && mainCredentials.clientSecret) {
      CLIENT_ID = mainCredentials.clientId;
      CLIENT_SECRET = mainCredentials.clientSecret;
      LogHelper.log('[EQUIPMENTS] Using credentials from MAIN (MyIOUtils)');

      // Still need to fetch mapInstantaneousPower (not in MAIN)
      const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_TB_ID);
      MAP_INSTANTANEOUS_POWER = customerCredentials.mapInstantaneousPower;
      DELAY_TIME_CONNECTION_MINS = window.MyIOUtils?.getDelayTimeConnectionInMins();
    } else {
      // Fallback: fetch all credentials directly
      LogHelper.log('[EQUIPMENTS] MAIN credentials not available, fetching directly...');
      const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_TB_ID);
      LogHelper.log('customerCredentials', customerCredentials);

      CLIENT_ID = customerCredentials.client_id || ' ';
      CLIENT_SECRET = customerCredentials.client_secret || ' ';
      MAP_INSTANTANEOUS_POWER = customerCredentials.mapInstantaneousPower;
      DELAY_TIME_CONNECTION_MINS = window.MyIOUtils?.getDelayTimeConnectionInMins();
    }

    // Initialize MyIO Auth using MyIOLibrary (like MAIN widget)
    if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.buildMyioIngestionAuth) {
      myIOAuth = MyIOLibrary.buildMyioIngestionAuth({
        dataApiHost: getDataApiHost(),
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
      });
      LogHelper.log('[EQUIPMENTS] MyIO Auth initialized using MyIOLibrary');
    } else {
      LogHelper.error(
        '[EQUIPMENTS] MyIOLibrary não está disponível. Verifique se a biblioteca foi carregada.'
      );
    }

    // 🚨 RFC-0077: Fetch customer consumption limits ONCE before processing devices
    // This will be used by getConsumptionRangesHierarchical as TIER 2 fallback
    LogHelper.log(
      '[EQUIPMENTS] [RFC-0077] Fetching customer consumption limits for CUSTOMER_ID:',
      CUSTOMER_ID
    );
    try {
      window.__customerConsumptionLimits = await getCachedConsumptionLimits(CUSTOMER_ID);
      LogHelper.log(
        '[EQUIPMENTS] [RFC-0077] Customer consumption limits loaded:',
        window.__customerConsumptionLimits
      );
    } catch (error) {
      LogHelper.error(
        '[EQUIPMENTS] [RFC-0077] Failed to fetch customer consumption limits, will use hardcoded defaults:',
        error
      );
      window.__customerConsumptionLimits = null;
    }

    // ✅ Loading overlay already shown at start of onInit (moved up for better UX)
    async function renderDeviceCards() {
      const promisesDeCards = Object.entries(devices)
        .filter(([_entityId, device]) => device.values.some((valor) => valor.dataType === 'consumption'))
        .map(async ([entityId, device]) => {
          const lastConnectTimestamp = findValue(device.values, 'lastConnectTime', '');
          const lastDisconnectTimestamp = findValue(device.values, 'lastDisconnectTime', '');
          const deviceMapInstaneousPower = findValue(device.values, 'deviceMapInstaneousPower', '');

          let operationHoursFormatted = '0s';

          if (lastConnectTimestamp) {
            const nowMs = new Date().getTime();
            const durationMs = nowMs - lastConnectTimestamp;
            operationHoursFormatted = formatarDuracao(durationMs > 0 ? durationMs : 0);
          }

          const deviceTemperature = 0;
          const latestTimestamp = Math.max(...device.values.map((v) => v.ts || 0));
          const updatedFormatted = formatRelativeTime(latestTimestamp);
          const rawConnectionStatus = findValue(device.values, 'connectionStatus', 'offline');
          const consumptionValue = findValue(device.values, 'consumption', 0);
          const mappedConnectionStatus = window.MyIOUtils?.mapConnectionStatus?.(rawConnectionStatus);
          const deviceProfile = findValue(device.values, 'deviceProfile', '').toUpperCase();
          let deviceType = findValue(device.values, 'deviceType', '').toUpperCase();

          if (deviceType === '3F_MEDIDOR' && deviceProfile !== 'N/D') {
            deviceType = deviceProfile;
          }

          // 🚨 RFC-0077: HARDCODED SWITCH ELIMINATED!
          // Now using hierarchical resolution: DeviceMap (ctx.data) → Device → Customer → Hardcoded defaults

          // Get deviceId for TIER 1 lookup
          const deviceId = entityId;

          // RFC: Parse deviceMapInstaneousPower from ctx.data (TIER 0 - highest priority)
          let deviceMapLimits = null;
          if (deviceMapInstaneousPower && typeof deviceMapInstaneousPower === 'string') {
            try {
              deviceMapLimits = JSON.parse(deviceMapInstaneousPower);
              //LogHelper.log(`[RFC-0078] ✅ Found deviceMapInstaneousPower in ctx.data for ${deviceId}`);
            } catch (e) {
              LogHelper.warn(
                `[RFC-0078] Failed to parse deviceMapInstaneousPower for ${deviceId}:`,
                e.message
              );
            }
          }

          // Get consumption ranges using hierarchical resolution
          // If deviceMapLimits exists, use it instead of customerLimits (higher priority)
          const rangesWithSource = await getConsumptionRangesHierarchical(
            deviceId,
            deviceType,
            deviceMapLimits || window.__customerConsumptionLimits, // TIER 0 (deviceMap) > TIER 2 (customer)
            'consumption',
            null
          );

          // If deviceMapLimits was used, update the source to reflect it
          if (deviceMapLimits && rangesWithSource.source === 'customer') {
            rangesWithSource.source = 'deviceMap';
            rangesWithSource.tier = 0;
            LogHelper.log(`[RFC-0078] Using deviceMapInstaneousPower (TIER 0) for ${deviceId}`);
          }

          const findTimestampAtTelemetry = (values, dataType, defaultValue = 'N/D') => {
            const item = values.find((v) => v.dataType === dataType);

            if (!item) return defaultValue;
            // Retorna a propriedade 'val' (da nossa API) ou 'value' (do ThingsBoard)
            return item.ts;
          };

          // Get instantaneous power from ctx.data (renamed to consumption_power to avoid confusion)
          let instantaneousPower = findValue(device.values, 'consumption_power', 0);
          const instantaneousPowerTs = new Date(
            findTimestampAtTelemetry(device.values, 'consumption_power', 0) || 0
          );
          const now = new Date();
          // RFC-0091: Use configurable delay time (in minutes) instead of hardcoded 15 minutes
          const delayTimeConnectionInMins = window.MyIOUtils?.getDelayTimeConnectionInMins?.() || 1440;
          const delayLimitTimeInMiliseconds = delayTimeConnectionInMins * 60 * 1000;
          const timeSinceLastTelemetry = now.getTime() - instantaneousPowerTs.getTime();

          if (timeSinceLastTelemetry > delayLimitTimeInMiliseconds) {
            instantaneousPower = null;
          }

          // RFC-0110: Get lastActivityTime for timestamp fallback
          const lastActivityTime = findValue(device.values, 'lastActivityTime', null);

          // Calculate device status using range-based calculation
          const parsedInstantaneousPower = Number(instantaneousPower);
          const lastConsumptionValue = Number.isNaN(parsedInstantaneousPower)
            ? null
            : parsedInstantaneousPower;

          // RFC-0110 v5: MASTER RULES implementation (same as shopping TELEMETRY)
          const lib = window.MyIOLibrary;
          const SHORT_DELAY_MINS = 60;
          const LONG_DELAY_MINS = 1440; // 24h for stale detection

          // RFC-0110 v5 FIX: Get telemetry timestamp from MAIN's cache (correct timestamp)
          // The subscription timestamp (instantaneousPowerTs) is always "now", not the real telemetry time
          // MAIN's cache has consumptionTs extracted correctly from ctx.data
          const ingestionId = findValue(device.values, 'ingestionId', null);
          const cachedItem = ingestionId && energyCacheFromMain ? energyCacheFromMain.get(ingestionId) : null;
          const consumptionTsFromMain = cachedItem?.consumptionTs || null;

          // DEBUG: Log cache lookup for first 3 devices
          if (!window._debugCacheLookup) window._debugCacheLookup = 0;
          if (window._debugCacheLookup < 3 && ingestionId) {
            window._debugCacheLookup++;
            const cacheSize = energyCacheFromMain?.size || 0;
            const cacheKeys = energyCacheFromMain ? Array.from(energyCacheFromMain.keys()).slice(0, 3) : [];
            LogHelper.log(
              `[EQUIPMENTS] 🔎 RFC-0110 cache lookup #${
                window._debugCacheLookup
              }: ingestionId='${ingestionId}', found=${!!cachedItem}, cacheSize=${cacheSize}, sampleKeys=[${cacheKeys.join(
                ', '
              )}]`
            );
            if (cachedItem) {
              LogHelper.log(`[EQUIPMENTS] 🔎   cachedItem keys: ${Object.keys(cachedItem).join(', ')}`);
              LogHelper.log(
                `[EQUIPMENTS] 🔎   cachedItem.consumptionTs=${cachedItem.consumptionTs}, cachedItem.connectionStatus='${cachedItem.connectionStatus}'`
              );
            }
          }

          // Use MAIN's consumptionTs (correct) or fallback to subscription ts (always recent, incorrect)
          const telemetryTs =
            consumptionTsFromMain ||
            (instantaneousPowerTs.getTime() > 0 ? instantaneousPowerTs.getTime() : null);
          const hasConsumptionTs = telemetryTs !== null && telemetryTs > 0;

          // DEBUG RFC-0110: Log first 5 devices to see timestamps
          if (!window._debugEquipTsLogged) window._debugEquipTsLogged = 0;
          if (window._debugEquipTsLogged < 5) {
            window._debugEquipTsLogged++;
            const nowMs = Date.now();
            const ageMs = telemetryTs ? nowMs - telemetryTs : 'N/A';
            const ageMins = telemetryTs ? Math.round(ageMs / 60000) : 'N/A';
            LogHelper.log(
              `[EQUIPMENTS] 🔍 RFC-0110 ts #${window._debugEquipTsLogged}: label='${device.label}', telemetryTs=${telemetryTs}, consumptionTsFromMain=${consumptionTsFromMain}, ageMins=${ageMins}, lastActivityTime=${lastActivityTime}, connectionStatus='${mappedConnectionStatus}'`
            );
          }

          // DEBUG: Log specific device "Bombas Hidráulicas 6"
          if (device.label && device.label.includes('Hidráulicas 6')) {
            const nowMs = Date.now();
            const ageMs = telemetryTs ? nowMs - telemetryTs : 'N/A';
            const ageMins = telemetryTs ? Math.round(ageMs / 60000) : 'N/A';
            const staleCheck = telemetryTs ? lib?.isTelemetryStale(telemetryTs, LONG_DELAY_MINS) : 'N/A';
            LogHelper.log(
              `[EQUIPMENTS] 🎯 BOMBAS 6 DEBUG: telemetryTs=${telemetryTs}, consumptionTsFromMain=${consumptionTsFromMain}, ageMins=${ageMins}, staleCheck=${staleCheck}, lastActivityTime=${lastActivityTime}, connectionStatus='${mappedConnectionStatus}'`
            );
          }

          // RFC-0110 v5: Fallback to lastActivityTime if no domain telemetry
          const hasLastActivityTime =
            lastActivityTime !== null && lastActivityTime !== undefined && lastActivityTime > 0;
          const effectiveTimestamp = hasConsumptionTs
            ? telemetryTs
            : hasLastActivityTime
            ? lastActivityTime
            : null;
          const hasEffectiveTimestamp = effectiveTimestamp !== null;

          // RFC-0110 v5: Calculate telemetry freshness
          const hasRecentTelemetry =
            hasEffectiveTimestamp && lib?.isTelemetryStale
              ? !lib.isTelemetryStale(effectiveTimestamp, SHORT_DELAY_MINS) // < 60 mins
              : false;
          const telemetryStaleForOnline =
            !hasEffectiveTimestamp ||
            (lib?.isTelemetryStale
              ? lib.isTelemetryStale(effectiveTimestamp, LONG_DELAY_MINS) // > 24h
              : true);

          // Normalize connection status
          const normalizedConnStatus = String(mappedConnectionStatus || '')
            .toLowerCase()
            .trim();
          const isWaitingStatus = ['waiting', 'connecting', 'pending'].includes(normalizedConnStatus);
          const isBadConnection = ['bad', 'weak', 'unstable', 'poor', 'degraded'].includes(
            normalizedConnStatus
          );
          const isOfflineStatusRaw =
            ['offline', 'disconnected', 'false', '0'].includes(normalizedConnStatus) ||
            !mappedConnectionStatus;
          const isOnlineStatus =
            normalizedConnStatus === 'online' ||
            ['online', 'true', 'connected', 'active', 'ok', 'running', '1'].includes(normalizedConnStatus);

          // RFC-0110 v5: MASTER RULES (telemetryTs with lastActivityTime fallback)
          let deviceStatus;
          if (isWaitingStatus) {
            deviceStatus = 'not_installed'; // WAITING = NOT_INSTALLED
          } else if (isBadConnection) {
            // BAD: Check recent telemetry (< 60 mins) → ONLINE, otherwise BAD
            deviceStatus = hasRecentTelemetry ? 'power_on' : 'weak_connection';
          } else if (isOfflineStatusRaw) {
            // OFFLINE: Check recent telemetry (< 60 mins) → ONLINE, otherwise OFFLINE
            deviceStatus = hasRecentTelemetry ? 'power_on' : 'offline';
          } else if (isOnlineStatus) {
            // ONLINE: Verify with telemetry - no telemetry or stale (> 24h) → OFFLINE
            if (!hasEffectiveTimestamp || telemetryStaleForOnline) {
              deviceStatus = 'offline'; // Can't trust ONLINE without recent telemetry
            } else {
              deviceStatus = 'power_on'; // Default, may be refined below
            }
          } else {
            deviceStatus = 'no_info';
          }

          // RFC-0078: For ONLINE devices with fresh telemetry, refine status using power ranges
          const shouldCalculateRanges =
            deviceStatus === 'power_on' &&
            isOnlineStatus &&
            hasEffectiveTimestamp &&
            !telemetryStaleForOnline;
          if (shouldCalculateRanges && rangesWithSource) {
            deviceStatus = MyIOLibrary.calculateDeviceStatusWithRanges({
              connectionStatus: mappedConnectionStatus,
              lastConsumptionValue,
              ranges: {
                standbyRange: rangesWithSource.standbyRange,
                normalRange: rangesWithSource.normalRange,
                alertRange: rangesWithSource.alertRange,
                failureRange: rangesWithSource.failureRange,
              },
              telemetryTimestamp: telemetryTs,
              lastActivityTime: lastActivityTime > 0 ? lastActivityTime : null,
              delayTimeConnectionInMins: LONG_DELAY_MINS,
            });
          }

          // RFC-0110 v5: Clear instantaneousPower for offline devices (show "-" instead of stale value)
          const isOfflineDevice = ['offline', 'no_info', 'not_installed'].includes(deviceStatus);
          if (isOfflineDevice) {
            instantaneousPower = null;
          }

          // DEBUG // TODO REMOVER DEPOIS
          if (device.label && device.label.toLowerCase().includes('er 14') && 3 > 2) {
            console.log('╔══════════════════════════════════════════════════════════════╗');
            console.log('║                    DEBUG ER 14 - EQUIPMENTS                  ║');
            console.log('╚══════════════════════════════════════════════════════════════╝');
            console.log('📋 device.label:', device.label);
            console.log('📋 device.entityId:', device.entityId?.id);
            console.log('');
            console.log('🔌 CONNECTION STATUS:');
            console.log('   rawConnectionStatus:', rawConnectionStatus);
            console.log('   mappedConnectionStatus:', mappedConnectionStatus);
            console.log('');
            console.log('⚡ POWER:');
            console.log('   instantaneousPower:', instantaneousPower);
            console.log('   consumptionValue:', consumptionValue);
            console.log('');
            console.log('⏱️ TIMING:');
            console.log('   instantaneousPowerTs (raw):', instantaneousPowerTs.getTime());
            console.log('   instantaneousPowerTs (formatted):', instantaneousPowerTs.toLocaleString('pt-BR'));
            console.log('   now (raw):', now.getTime());
            console.log('   now (formatted):', now.toLocaleString('pt-BR'));
            console.log(
              '   delayLimitTimeInMiliseconds:',
              delayLimitTimeInMiliseconds,
              `(${delayLimitTimeInMiliseconds / 60000} min)`
            );
            console.log(
              '   timeSinceLastTelemetry:',
              timeSinceLastTelemetry,
              `(${(timeSinceLastTelemetry / 60000).toFixed(2)} min)`
            );
            console.log(
              '   isStale (timeSince > delay):',
              timeSinceLastTelemetry > delayLimitTimeInMiliseconds
            );
            console.log('');
            console.log('📊 RANGES:');
            console.log('   rangesWithSource:', JSON.stringify(rangesWithSource, null, 2));
            console.log('');
            console.log('🎯 CALCULATED STATUS:');
            console.log('   deviceStatus:', deviceStatus);
            console.log('');
            console.log('📦 RAW device.values:');
            device.values?.forEach((v, i) => {
              console.log(
                `   [${i}] ${v.dataType}: ${v.value} (ts: ${v.ts} = ${new Date(v.ts).toLocaleString(
                  'pt-BR'
                )})`
              );
            });
            console.log('════════════════════════════════════════════════════════════════');
          }

          // ingestionId já declarado acima (RFC-0110 cache lookup)
          let customerId = findValue(device.values, 'customerId', null);

          // Fallback: Try to get customerId from MAIN's energyCache (API has it, ctx.data doesn't)
          if (!customerId && ingestionId && energyCacheFromMain && energyCacheFromMain.has(ingestionId)) {
            customerId = energyCacheFromMain.get(ingestionId).customerId;
          }

          // Populate global device-to-shopping map for filter fallback
          if (ingestionId && customerId) {
            if (!window.myioDeviceToShoppingMap) {
              window.myioDeviceToShoppingMap = new Map();
            }
            window.myioDeviceToShoppingMap.set(ingestionId, customerId);
          }

          // Get identifier and normalize - if empty or contains "sem identificador", show "Sem identificador"
          const rawIdentifier = String(findValue(device.values, 'identifier') || '').trim();
          const deviceIdentifier = !rawIdentifier
            ? 'Sem identificador'
            : rawIdentifier.toUpperCase().includes('SEM IDENTIFICADOR')
            ? 'Sem identificador'
            : rawIdentifier;

          // RFC-0102: ownerName from ctx.data is the customerName for the device
          const ownerName = findValue(device.values, 'ownerName', null);
          const assetName = findValue(device.values, 'assetName', null);

          return {
            entityId: entityId,
            labelOrName: device.label,
            val: consumptionValue,
            deviceIdentifier: deviceIdentifier,
            centralName: findValue(device.values, 'centralName', null),
            ownerName: ownerName, // RFC-0102: customerName from ctx.data
            assetName: assetName, // RFC-0102: assetName for fallback
            customerName:
              ownerName || assetName || findValue(device.values, 'centralName', null) || customerId, // RFC-0102: Resolved customer name
            ingestionId: ingestionId,
            customerId: customerId, // Shopping ingestionId for filtering
            deviceType: deviceType,
            deviceStatus: deviceStatus,
            connectionStatus: mappedConnectionStatus, // RFC-0093: Add connectionStatus for online/offline display
            valType: 'power_w',
            perc: Math.floor(Math.random() * (95 - 70 + 1)) + 70,
            temperatureC: deviceTemperature || 0, // RFC-0091: Fixed - deviceTemperature is a number, not array
            operationHours: operationHoursFormatted || 0,
            updated: updatedFormatted,
            instantaneousPower: instantaneousPower, // Potência instantânea (kW) from ctx.data
            lastDisconnectTime: lastDisconnectTimestamp,
            lastConnectTime: lastConnectTimestamp,
            lastActivityTime: findValue(device.values, 'lastActivityTime', null),
            mapInstantaneousPower: MAP_INSTANTANEOUS_POWER,
            deviceMapInstaneousPower: deviceMapInstaneousPower,
            // RFC-0058: Add properties for MyIOSelectionStore (FOOTER)
            id: entityId, // Alias for entityId
            name: device.label, // Alias for labelOrName
            lastValue: consumptionValue, // Alias for val
            unit: 'kWh', // Energy unit
            icon: 'energy', // Domain identifier for SelectionStore
            domain: 'energy', // Domain for card component tooltip
            // Power ranges for tooltip visualization
            powerRanges: rangesWithSource
              ? {
                  standbyRange: rangesWithSource.standbyRange,
                  normalRange: rangesWithSource.normalRange,
                  alertRange: rangesWithSource.alertRange,
                  failureRange: rangesWithSource.failureRange,
                  source: rangesWithSource.source,
                  tier: rangesWithSource.tier,
                }
              : null,
          };
        });

      const devicesFormatadosParaCards = await Promise.all(promisesDeCards);

      // RFC-0102: Classification is done by MAIN's Orchestrator
      // We already called getEquipmentDevices() so all devices are equipment (no lojas)
      const equipmentDevices = devicesFormatadosParaCards;

      LogHelper.log('[EQUIPMENTS] RFC-0102: Equipment devices from orchestrator:', equipmentDevices.length);

      // Note: RFC-0102 - Events myio:lojas-identified and myio:equipments-identified
      // are now dispatched by MAIN's classifyEnergyDevices() function

      // ✅ Save ONLY equipment devices to global STATE for filtering
      STATE.allDevices = equipmentDevices;

      // RFC-0110 v5 DEBUG: Log deviceStatus distribution
      const statusCounts = {};
      equipmentDevices.forEach((d) => {
        const status = d.deviceStatus || 'undefined';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      LogHelper.log('[EQUIPMENTS] RFC-0110 DEBUG deviceStatus distribution:', JSON.stringify(statusCounts));

      // Count offline devices using isDeviceOffline logic
      const offlineCount = equipmentDevices.filter((d) => {
        const connStatus = (d.connectionStatus || '').toLowerCase();
        const devStatus = (d.deviceStatus || '').toLowerCase();
        return connStatus === 'offline' || ['offline', 'no_info'].includes(devStatus);
      }).length;
      LogHelper.log(
        `[EQUIPMENTS] RFC-0110 DEBUG offline count: ${offlineCount} of ${equipmentDevices.length}`
      );

      // Log device-to-shopping mapping stats
      if (window.myioDeviceToShoppingMap) {
        LogHelper.log(
          `[EQUIPMENTS] 🗺️ Device-to-shopping map populated: ${window.myioDeviceToShoppingMap.size} devices mapped`
        );

        // Debug: show sample mappings
        if (window.myioDeviceToShoppingMap.size > 0) {
          const samples = Array.from(window.myioDeviceToShoppingMap.entries()).slice(0, 3);
          LogHelper.log(
            `[EQUIPMENTS] 📋 Sample mappings:`,
            samples.map(
              ([deviceId, shopId]) => `${deviceId.substring(0, 8)}... → ${shopId.substring(0, 8)}...`
            )
          );
        }
      }

      initializeCards(equipmentDevices);

      // RFC-0093: Update statistics header via centralized controller
      // RFC-0102: ctxData removed (data now comes from orchestrator)
      if (equipHeaderController) {
        equipHeaderController.updateFromDevices(equipmentDevices, {
          cache: energyCacheFromMain,
        });
      } else {
        // Fallback to old function if header controller not available
        updateEquipmentStats(equipmentDevices, energyCacheFromMain);
      }

      // RFC: Emit initial equipment count to HEADER
      emitEquipmentCountEvent(equipmentDevices);

      // Hide loading after rendering
      showLoadingOverlay(false);
    }

    // Function to render all available shoppings as chips (default: all selected)
    function renderAllShoppingsChips(customers) {
      if (!customers || !Array.isArray(customers) || customers.length === 0) {
        LogHelper.warn('[EQUIPMENTS] ⚠️ No customers provided to render as chips');
        return;
      }

      LogHelper.log(`[EQUIPMENTS] 🏬 Rendering ${customers.length} shoppings as pre-selected`);

      // Render chips with all customers
      renderShoppingFilterChips(customers);
    }

    // ✅ Listen for customers ready event from MENU
    self._onCustomersReady = (ev) => {
      LogHelper.log('[EQUIPMENTS] 🔔 heard myio:customers-ready:', ev.detail);

      const customers = ev.detail?.customers || [];
      if (customers.length > 0) {
        // RFC: Save total shoppings count for HEADER card logic
        STATE.totalShoppings = customers.length;
        LogHelper.log(`[EQUIPMENTS] 📊 Total shoppings available: ${STATE.totalShoppings}`);

        renderAllShoppingsChips(customers);
      }
    };

    window.addEventListener('myio:customers-ready', self._onCustomersReady, { once: true });

    function enrichDevicesWithConsumption() {
      if (!energyCacheFromMain) {
        LogHelper.warn('[EQUIPMENTS] No energy from MAIN available yet');
        return;
      }

      LogHelper.log('[EQUIPMENTS] Enriching devices with consumption from MAIN...');

      // Iterate through devices and add consumption from cache
      Object.entries(devices).forEach(([_entityId, device]) => {
        // Find ingestionId for this device
        const ingestionIdItem = device.values.find((v) => v.dataType === 'ingestionId');
        if (ingestionIdItem && ingestionIdItem.value) {
          const ingestionId = ingestionIdItem.value;
          const cached = energyCacheFromMain.get(ingestionId);

          if (cached) {
            // Get consumption value from cache (can be 'value' or 'total_value')
            const consumptionFromCache = cached.value ?? cached.total_value ?? null;
            if (consumptionFromCache != null) {
              // Remove old consumption data if exists
              // RFC-0091: Use 'value' property to match findValue expected format
              const consumptionIndex = device.values.findIndex((v) => v.dataType === 'consumption');
              if (consumptionIndex >= 0) {
                device.values[consumptionIndex] = {
                  value: consumptionFromCache,
                  ts: cached.timestamp || Date.now(),
                  dataType: 'consumption',
                };
              } else {
                device.values.push({
                  value: consumptionFromCache,
                  ts: cached.timestamp || Date.now(),
                  dataType: 'consumption',
                });
              }
            }
          }
        }
      });

      // RFC-0076: CRITICAL FIX - Enrich energyCache with full device metadata
      // This ensures ENERGY widget can classify elevators correctly
      let enrichedCount = 0;
      Object.entries(devices).forEach(([_entityId2, device]) => {
        const ingestionIdItem = device.values.find((v) => v.dataType === 'ingestionId');
        if (ingestionIdItem && ingestionIdItem.value) {
          const ingestionId = ingestionIdItem.value;
          const cached = energyCacheFromMain.get(ingestionId);

          if (cached) {
            // Get metadata from device.values
            const deviceType = findValue(device.values, 'type', '');
            const deviceProfile = findValue(device.values, 'deviceProfile', '');
            const deviceIdentifier = findValue(device.values, 'deviceIdentifier', '');
            const deviceName = findValue(device.values, 'name', '');

            // RFC-0076: Enrich cache with full metadata
            cached.deviceType = deviceType;
            cached.deviceProfile = deviceProfile;
            cached.deviceIdentifier = deviceIdentifier;
            cached.name = cached.name || deviceName;

            enrichedCount++;
          }
        }
      });

      LogHelper.log(`[EQUIPMENTS] ✅ Enriched ${enrichedCount} devices in energyCache with metadata`);

      // RFC-0076: Force update on ENERGY widget by re-emitting the cache
      const orchestrator = window.MyIOOrchestrator || window.parent?.MyIOOrchestrator;
      if (orchestrator) {
        LogHelper.log('[EQUIPMENTS] 🔄 Forcing ENERGY widget update...');
        window.dispatchEvent(
          new CustomEvent('myio:equipment-metadata-enriched', {
            detail: {
              cache: energyCacheFromMain,
              deviceCount: enrichedCount,
              timestamp: Date.now(),
            },
          })
        );
      }

      // Re-render cards and hide loading
      renderDeviceCards().then(() => {
        showLoadingOverlay(false);
      });
    }

    async function waitForOrchestrator(timeoutMs = 15000) {
      return new Promise((resolve) => {
        let interval;
        const timeout = setTimeout(() => {
          clearInterval(interval);
          LogHelper.error('[EQUIPMENTS] Timeout: MyIOOrchestrator não foi encontrado na window.');
          resolve(null);
        }, timeoutMs);

        interval = setInterval(() => {
          // RFC-0057: No longer checking window.parent - not using iframes
          const orchestrator = window.MyIOOrchestrator;
          if (orchestrator) {
            clearTimeout(timeout);
            clearInterval(interval);
            LogHelper.log('[EQUIPMENTS] MyIOOrchestrator encontrado!');
            resolve(orchestrator);
          }
        }, 100); // Verifica a cada 100ms
      });
    }

    // ===== EQUIPMENTS: Listen for energy cache from MAIN orchestrator =====
    let energyCacheFromMain = null;

    // Função para processar os dados recebidos e renderizar
    async function processAndRender(cache) {
      if (!cache || cache.size === 0) {
        LogHelper.warn('[EQUIPMENTS] Cache de energia está vazio. Nenhum card será renderizado.');
        showLoadingOverlay(false);

        // RFC-0093: Show toast to reload page
        const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;
        if (MyIOToast) {
          MyIOToast.warning('Dados não carregados. Por favor, recarregue a página.', { duration: 8000 });
        }
        return;
      }

      energyCacheFromMain = cache;
      enrichDevicesWithConsumption(); // A sua função original é chamada aqui
      await renderDeviceCards(); // E a sua outra função original é chamada aqui
    }

    // Lógica principal: "verificar-depois-ouvir"
    const orchestratorInstance = await waitForOrchestrator();

    if (orchestratorInstance) {
      const existingCache = orchestratorInstance.getCache();

      if (existingCache && existingCache.size > 0) {
        // CAMINHO 1: (Navegação de volta)
        LogHelper.log('[EQUIPMENTS] Cache do Orquestrador já existe. Usando-o diretamente.');
        await processAndRender(existingCache);
      } else {
        // CAMINHO 2: (Primeiro carregamento)
        LogHelper.log("[EQUIPMENTS] Cache vazio. Aguardando evento 'myio:energy-data-ready'...");
        const waitForEnergyCache = new Promise((resolve) => {
          const handlerTimeout = setTimeout(() => {
            LogHelper.warn('[EQUIPMENTS] Timeout esperando pelo evento de cache.');
            resolve(null);
          }, 15000);

          const handler = (ev) => {
            clearTimeout(handlerTimeout);
            window.removeEventListener('myio:energy-data-ready', handler);
            resolve(ev.detail.cache);
          };
          window.addEventListener('myio:energy-data-ready', handler);
        });

        const initialCache = await waitForEnergyCache;
        await processAndRender(initialCache);
      }
    } else {
      // O erro do timeout já terá sido logado pela função 'waitForOrchestrator'
      showLoadingOverlay(false);
    }
  }, 0);

  // ====== FILTER & SEARCH LOGIC ======
  bindFilterEvents();

  // RFC-0093: Bind real-time toggle button
  bindRealTimeToggle();

  // RFC-0103: Bind Power Limits Setup button
  bindPowerLimitsButton();
};

// Global state for filters
const STATE = {
  allDevices: [],
  searchActive: false,
  searchTerm: '',
  selectedIds: null,
  sortMode: 'cons_desc',
  selectedShoppingIds: [], // Shopping filter from MENU
  totalShoppings: 0, // Total number of shoppings available
  // RFC-0093: Real-Time Mode State
  realTimeActive: false,
  realTimePowerMap: new Map(), // deviceId -> { value: number, timestamp: number }
  realTimeIntervalId: null,
  realTimeCountdownId: null,
  realTimeStartedAt: null,
  realTimeNextRefresh: 0,
  // RFC-0093: WebSocket Engine State
  realTimeEngine: 'websocket', // 'websocket' | 'rest'
  wsConsecutiveFailures: 0,
};

// RFC-0093: Real-Time Mode Constants
const REALTIME_CONFIG = {
  // Engine settings
  DEFAULT_ENGINE: 'websocket',
  FALLBACK_AFTER_FAILURES: 6,
  // WebSocket settings
  WS_URL: 'wss://dashboard.myio-bas.com/api/ws',
  WS_RECONNECT_BACKOFF: [1000, 2000, 5000, 10000, 30000],
  // REST fallback settings
  REST_INTERVAL_MS: 30000,
  BATCH_SIZE: 10,
  BATCH_DELAY_MS: 50,
  // General settings
  MAX_RUNTIME_MS: 30 * 60 * 1000, // 30 minutes auto-disable
  INTERVAL_OPTIONS: [10, 15, 30, 45, 60, 90, 120],
  COUNTDOWN_UPDATE_MS: 100,
};

/**
 * RFC: Emit event to update HEADER equipment card
 * Sends total equipment count, filtered count, and category breakdown
 */
function emitEquipmentCountEvent(filteredDevices) {
  const totalEquipments = STATE.allDevices.length;
  const filteredEquipments = filteredDevices.length;

  // Check if all shoppings are selected (no filter or all selected)
  const allShoppingsSelected =
    STATE.selectedShoppingIds.length === 0 || STATE.selectedShoppingIds.length === STATE.totalShoppings;

  // RFC: Calculate category breakdown for filtered devices
  const categories = {
    climatizacao: { total: 0, filtered: 0, label: 'Climatização', icon: '❄️' },
    elevadores: { total: 0, filtered: 0, label: 'Elevadores', icon: '🛗' },
    escadasRolantes: { total: 0, filtered: 0, label: 'Escadas Rolantes', icon: '📶' },
    outros: { total: 0, filtered: 0, label: 'Outros Equipamentos', icon: '⚙️' },
  };

  // Count totals from all devices
  STATE.allDevices.forEach((device) => {
    if (isHVAC(device)) {
      categories.climatizacao.total++;
    } else if (isElevator(device)) {
      categories.elevadores.total++;
    } else if (isEscalator(device)) {
      categories.escadasRolantes.total++;
    } else {
      categories.outros.total++;
    }
  });

  // Count filtered devices
  filteredDevices.forEach((device) => {
    if (isHVAC(device)) {
      categories.climatizacao.filtered++;
    } else if (isElevator(device)) {
      categories.elevadores.filtered++;
    } else if (isEscalator(device)) {
      categories.escadasRolantes.filtered++;
    } else {
      categories.outros.filtered++;
    }
  });

  const eventData = {
    totalEquipments,
    filteredEquipments,
    allShoppingsSelected,
    categories,
    timestamp: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent('myio:equipment-count-updated', {
      detail: eventData,
    })
  );

  LogHelper.log('[EQUIPMENTS] ✅ Emitted myio:equipment-count-updated:', eventData);
}

/**
 * Apply filters and sorting to devices
 */
function applyFilters(devices, searchTerm, selectedIds, sortMode) {
  let filtered = devices.slice();

  // Apply shopping filter (from MENU)
  if (STATE.selectedShoppingIds && STATE.selectedShoppingIds.length > 0) {
    const before = filtered.length;
    filtered = filtered.filter((d) => {
      // If device has no customerId, include it (safety)
      if (!d.customerId) return true;
      // Check if device's customerId is in the selected shoppings
      return STATE.selectedShoppingIds.includes(d.customerId);
    });
    LogHelper.log(
      `[EQUIPMENTS] Shopping filter applied: ${before} -> ${filtered.length} devices (${
        before - filtered.length
      } filtered out)`
    );
  }

  // Apply multiselect filter
  if (selectedIds && selectedIds.size > 0) {
    filtered = filtered.filter((d) => selectedIds.has(d.entityId));
  }

  // Apply search filter
  const query = (searchTerm || '').trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(
      (d) =>
        String(d.labelOrName || '')
          .toLowerCase()
          .includes(query) ||
        String(d.deviceIdentifier || '')
          .toLowerCase()
          .includes(query) ||
        String(d.deviceType || '')
          .toLowerCase()
          .includes(query)
    );
  }

  // Apply sorting
  filtered.sort((a, b) => {
    const valA = Number(a.val) || Number(a.lastValue) || 0;
    const valB = Number(b.val) || Number(b.lastValue) || 0;
    const nameA = String(a.labelOrName || '').toLowerCase();
    const nameB = String(b.labelOrName || '').toLowerCase();

    switch (sortMode) {
      case 'cons_desc':
        return valB !== valA ? valB - valA : nameA.localeCompare(nameB);
      case 'cons_asc':
        return valA !== valB ? valA - valB : nameA.localeCompare(nameB);
      case 'alpha_asc':
        return nameA.localeCompare(nameB);
      case 'alpha_desc':
        return nameB.localeCompare(nameA);
      // RFC-0095: Status sorting
      case 'status_asc': {
        const statusA = (a.deviceStatus || a.connectionStatus || 'offline').toLowerCase();
        const statusB = (b.deviceStatus || b.connectionStatus || 'offline').toLowerCase();
        const cmp = statusA.localeCompare(statusB, 'pt-BR', { sensitivity: 'base' });
        return cmp !== 0 ? cmp : nameA.localeCompare(nameB);
      }
      case 'status_desc': {
        const statusA = (a.deviceStatus || a.connectionStatus || 'offline').toLowerCase();
        const statusB = (b.deviceStatus || b.connectionStatus || 'offline').toLowerCase();
        const cmp = statusB.localeCompare(statusA, 'pt-BR', { sensitivity: 'base' });
        return cmp !== 0 ? cmp : nameA.localeCompare(nameB);
      }
      // RFC-0095: Shopping sorting
      case 'shopping_asc': {
        const shopA = (a.customerName || getCustomerNameForDevice(a) || '').toLowerCase();
        const shopB = (b.customerName || getCustomerNameForDevice(b) || '').toLowerCase();
        const cmp = shopA.localeCompare(shopB, 'pt-BR', { sensitivity: 'base' });
        return cmp !== 0 ? cmp : nameA.localeCompare(nameB);
      }
      case 'shopping_desc': {
        const shopA = (a.customerName || getCustomerNameForDevice(a) || '').toLowerCase();
        const shopB = (b.customerName || getCustomerNameForDevice(b) || '').toLowerCase();
        const cmp = shopB.localeCompare(shopA, 'pt-BR', { sensitivity: 'base' });
        return cmp !== 0 ? cmp : nameA.localeCompare(nameB);
      }
      default:
        return 0;
    }
  });

  return filtered;
}

/**
 * Re-render cards with current filters
 */
function reflowCards() {
  const filtered = applyFilters(STATE.allDevices, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);

  LogHelper.log('[EQUIPMENTS] Reflow with filters:', {
    total: STATE.allDevices.length,
    filtered: filtered.length,
    searchTerm: STATE.searchTerm,
    selectedCount: STATE.selectedIds?.size || 0,
    sortMode: STATE.sortMode,
  });

  initializeCards(filtered);

  // RFC-0093: Update statistics header via centralized controller
  // RFC-0102: ctxData removed (data now comes from orchestrator)
  const energyCache = window.MyIOOrchestrator?.getCache?.() || null;
  if (equipHeaderController) {
    equipHeaderController.updateFromDevices(filtered, {
      cache: energyCache,
    });
  } else {
    // Fallback to old function if header controller not available
    updateEquipmentStats(filtered, energyCache);
  }

  // RFC: Emit event to update HEADER card
  emitEquipmentCountEvent(filtered);
}

// ============================================
// RFC-0090: EQUIPMENTS FILTER MODAL (using shared factory from MAIN)
// ============================================

// Helper functions for equipment classification
function isElevator(device) {
  const deviceType = (device.deviceType || '').toUpperCase();
  // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
  const deviceProfile = (device.deviceProfile || device.deviceType || '').toUpperCase();
  return deviceType === 'ELEVADOR' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ELEVADOR');
}

function isEscalator(device) {
  const deviceType = (device.deviceType || '').toUpperCase();
  // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
  const deviceProfile = (device.deviceProfile || device.deviceType || '').toUpperCase();
  return (
    deviceType === 'ESCADA_ROLANTE' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ESCADA_ROLANTE')
  );
}

function isHVAC(device) {
  const deviceType = (device.deviceType || '').toUpperCase();
  // RFC-0140: If deviceProfile is null/empty, assume it equals deviceType
  const deviceProfile = (device.deviceProfile || device.deviceType || '').toUpperCase();
  const identifier = (device.deviceIdentifier || '').toUpperCase();
  const hasCAG = identifier.includes('CAG');

  return (
    hasCAG ||
    deviceType === 'CHILLER' ||
    deviceType === 'FANCOIL' ||
    deviceType === 'AR_CONDICIONADO' ||
    deviceType === 'BOMBA' ||
    deviceType === 'HVAC' ||
    (deviceType === '3F_MEDIDOR' &&
      (deviceProfile === 'CHILLER' ||
        deviceProfile === 'FANCOIL' ||
        deviceProfile === 'AR_CONDICIONADO' ||
        deviceProfile === 'BOMBA' ||
        deviceProfile === 'HVAC'))
  );
}

function getDeviceConsumption(device) {
  return Number(device.val) || Number(device.lastValue) || 0;
}

function getDeviceStatus(device) {
  return (device.deviceStatus || '').toLowerCase();
}

/**
 * RFC-0110 v5: Check if device is offline based on deviceStatus ONLY
 * deviceStatus is calculated using RFC-0110 MASTER RULES (stale telemetry detection)
 * This must match the header's logic in updateFromDevices for consistent counts
 * NOTE: not_installed is now a separate category, not counted as offline
 */
function isDeviceOffline(device) {
  const devStatus = (device.deviceStatus || '').toLowerCase();
  // Device is offline if deviceStatus is offline or no_info (not_installed is separate)
  return ['offline', 'no_info'].includes(devStatus);
}

/**
 * RFC-0110: Check if device is not installed (waiting status)
 * WAITING → NOT_INSTALLED (absolute, no discussion)
 */
function isDeviceNotInstalled(device) {
  const devStatus = (device.deviceStatus || '').toLowerCase();
  return devStatus === 'not_installed';
}

/**
 * RFC-0103: Check if device is online based on both connectionStatus and deviceStatus
 */
function isDeviceOnline(device) {
  return !isDeviceOffline(device);
}

// Filter modal instance (lazy initialized)
let equipmentsFilterModal = null;

/**
 * RFC-0090: Initialize filter modal using shared factory from MAIN
 */
function initFilterModal() {
  const createFilterModal = window.MyIOUtils?.createFilterModal;

  if (!createFilterModal) {
    LogHelper.error('[EQUIPMENTS] createFilterModal not available from MAIN');
    return null;
  }

  return createFilterModal({
    widgetName: 'EQUIPMENTS',
    containerId: 'equipmentsFilterModalGlobal',
    modalClass: 'equip-modal',
    primaryColor: '#2563eb',
    itemIdAttr: 'data-device-id',

    // Filter tabs configuration - specific for EQUIPMENTS
    // RFC-0103: Use isDeviceOnline/isDeviceOffline for consistent counting with header
    filterTabs: [
      { id: 'all', label: 'Todos', filter: () => true },
      { id: 'online', label: 'Online', filter: isDeviceOnline },
      { id: 'offline', label: 'Offline', filter: isDeviceOffline },
      { id: 'notInstalled', label: 'Não Instalado', filter: isDeviceNotInstalled },
      {
        id: 'normal',
        label: 'Normal',
        filter: (d) =>
          isDeviceOnline(d) && (getDeviceStatus(d) === 'power_on' || getDeviceStatus(d) === 'normal'),
      },
      {
        id: 'standby',
        label: 'Stand By',
        filter: (d) => isDeviceOnline(d) && getDeviceStatus(d) === 'standby',
      },
      {
        id: 'alert',
        label: 'Alerta',
        filter: (d) => isDeviceOnline(d) && ['warning', 'alert', 'maintenance'].includes(getDeviceStatus(d)),
      },
      {
        id: 'failure',
        label: 'Falha',
        filter: (d) =>
          isDeviceOnline(d) && (getDeviceStatus(d) === 'failure' || getDeviceStatus(d) === 'power_off'),
      },
      { id: 'elevators', label: 'Elevadores', filter: isElevator },
      { id: 'escalators', label: 'Escadas', filter: isEscalator },
      { id: 'hvac', label: 'Climatização', filter: isHVAC },
      { id: 'others', label: 'Outros', filter: (d) => !isElevator(d) && !isEscalator(d) && !isHVAC(d) },
    ],

    // Data accessors
    getItemId: (device) => device.entityId,
    getItemLabel: (device) => device.labelOrName || device.deviceIdentifier || device.entityId,
    getItemValue: getDeviceConsumption,
    getItemSubLabel: (device) => device.customerName || getCustomerNameForDevice(device),
    formatValue: (val) => (MyIOLibrary?.formatEnergy ? MyIOLibrary.formatEnergy(val) : val.toFixed(2)),

    // Callbacks
    onApply: ({ selectedIds, sortMode }) => {
      STATE.selectedIds = selectedIds;
      STATE.sortMode = sortMode;
      reflowCards();
      LogHelper.log('[EQUIPMENTS] [RFC-0090] Filters applied via shared modal');
    },

    onReset: () => {
      STATE.selectedIds = null;
      STATE.sortMode = 'cons_desc';
      STATE.searchTerm = '';
      STATE.searchActive = false;

      // RFC-0093: Reset UI via header controller
      if (equipHeaderController) {
        const searchInput = equipHeaderController.getSearchInput();
        if (searchInput) searchInput.value = '';
        equipHeaderController.toggleSearch(false);
      }

      reflowCards();
      LogHelper.log('[EQUIPMENTS] [RFC-0090] Filters reset via shared modal');
    },

    onClose: () => {
      LogHelper.log('[EQUIPMENTS] [RFC-0090] Filter modal closed');
    },
  });
}

function openFilterModal() {
  // Lazy initialize modal
  if (!equipmentsFilterModal) {
    equipmentsFilterModal = initFilterModal();
  }

  if (!equipmentsFilterModal) {
    LogHelper.error('[EQUIPMENTS] Failed to initialize filter modal');
    window.alert('Erro ao inicializar modal de filtros. Verifique se o widget MAIN foi carregado.');
    return;
  }

  // 1. Pega a lista completa de dispositivos
  let items = STATE.allDevices || [];

  // 2. APLICA O FILTRO DE SHOPPING (Correção aqui)
  // Filtra a lista antes de mandar para o modal, assim o contador "Todos"
  // mostrará apenas a quantidade do shopping selecionado.
  if (STATE.selectedShoppingIds && STATE.selectedShoppingIds.length > 0) {
    items = items.filter((d) => {
      // Se não tem customerId ou não está na lista de selecionados, remove.
      return d.customerId && STATE.selectedShoppingIds.includes(d.customerId);
    });
  }

  // 3. Abre o modal com a lista filtrada
  equipmentsFilterModal.open(items, {
    selectedIds: STATE.selectedIds,
    sortMode: STATE.sortMode,
  });
}

// ============================================
// RFC-0093: REAL-TIME WEBSOCKET SERVICE
// ============================================

// Store references
let realtimeSettingsModal = null;
let websocketService = null;
let filterDebounceTimer = null;

/**
 * RFC-0093: WebSocket Real-Time Service Class
 */
class RealTimeWebSocketService {
  constructor(config) {
    this.config = {
      wsUrl: REALTIME_CONFIG.WS_URL,
      keys: ['power'],
      onData: () => {},
      onConnectionChange: () => {},
      onError: () => {},
      autoReconnect: true,
      ...config,
    };

    this.ws = null;
    this.cmdIdCounter = 0;
    this.currentCmdId = null;
    this.lastSubscribedDevices = [];
    this.reconnectAttempts = 0;
    this.reconnectTimeoutId = null;
    this.isAuthenticated = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        reject(new Error('No JWT token available'));
        return;
      }

      try {
        this.ws = new WebSocket(this.config.wsUrl);
      } catch (err) {
        reject(err);
        return;
      }

      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close();
          reject(new Error('Connection timeout'));
        }
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        LogHelper.log('[WebSocket] Connected to', this.config.wsUrl);
        this.authenticate(token);
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          this.handleMessage(JSON.parse(event.data));
        } catch (err) {
          LogHelper.error('[WebSocket] Error parsing message:', err);
        }
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        LogHelper.log('[WebSocket] Disconnected:', event.code, event.reason);
        this.isAuthenticated = false;
        this.config.onConnectionChange(false);

        if (this.config.autoReconnect && event.code !== 1000) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        LogHelper.error('[WebSocket] Error:', error);
        this.config.onError(error);
      };
    });
  }

  authenticate(token) {
    const authCmd = {
      authCmd: {
        cmdId: this.nextCmdId(),
        token: token,
      },
    };
    this.ws.send(JSON.stringify(authCmd));
    LogHelper.log('[WebSocket] Sent auth command');
  }

  subscribe(deviceIds) {
    if (!this.isConnected()) {
      LogHelper.warn('[WebSocket] Not connected, cannot subscribe');
      return null;
    }

    if (!this.isAuthenticated) {
      LogHelper.warn('[WebSocket] Not authenticated yet, waiting...');
      // Queue subscription for after auth
      setTimeout(() => this.subscribe(deviceIds), 500);
      return null;
    }

    // Unsubscribe previous if exists
    if (this.currentCmdId !== null) {
      this.unsubscribe(this.currentCmdId);
    }

    const cmdId = this.nextCmdId();

    const subscribeCmd = {
      cmds: [
        {
          cmdId: cmdId,
          type: 'ENTITY_DATA',
          query: {
            entityFilter: {
              type: 'entityList',
              entityType: 'DEVICE',
              entityList: deviceIds,
            },
            entityFields: [{ type: 'ENTITY_FIELD', key: 'name' }],
            latestValues: this.config.keys.map((key) => ({
              type: 'TIME_SERIES',
              key: key,
            })),
          },
        },
      ],
    };

    this.ws.send(JSON.stringify(subscribeCmd));
    this.currentCmdId = cmdId;
    this.lastSubscribedDevices = [...deviceIds];

    LogHelper.log(`[WebSocket] Subscribed to ${deviceIds.length} devices (cmdId: ${cmdId})`);
    return cmdId;
  }

  unsubscribe(cmdId) {
    if (!this.isConnected() || cmdId === null) return;

    const unsubscribeCmd = {
      cmds: [
        {
          cmdId: cmdId,
          type: 'ENTITY_DATA_UNSUBSCRIBE',
        },
      ],
    };

    this.ws.send(JSON.stringify(unsubscribeCmd));

    if (this.currentCmdId === cmdId) {
      this.currentCmdId = null;
    }

    LogHelper.log(`[WebSocket] Unsubscribed (cmdId: ${cmdId})`);
  }

  handleMessage(message) {
    // Handle authentication response
    if (message.authCmd !== undefined) {
      if (message.authCmd.success !== false) {
        LogHelper.log('[WebSocket] Authentication successful');
        this.isAuthenticated = true;
        this.reconnectAttempts = 0;
        STATE.wsConsecutiveFailures = 0;
        this.config.onConnectionChange(true);
      } else {
        LogHelper.error('[WebSocket] Authentication failed:', message.authCmd.errorMsg);
        this.config.onError(new Error('Authentication failed: ' + (message.authCmd.errorMsg || 'Unknown')));
      }
      return;
    }

    // Handle initial data
    if (message.cmdId && message.data?.data) {
      LogHelper.log(`[WebSocket] Received initial data for ${message.data.data.length} devices`);
      this.processDataUpdate(message.data.data);
    }

    // Handle push updates
    if (message.cmdId && message.update) {
      LogHelper.log(`[WebSocket] Received update for ${message.update.length} devices`);
      this.processDataUpdate(message.update);
    }

    // Handle errors
    if (message.errorCode) {
      LogHelper.error('[WebSocket] Error response:', message.errorCode, message.errorMsg);
      this.config.onError(new Error(message.errorMsg || 'Unknown error'));
    }
  }

  processDataUpdate(dataArray) {
    if (!Array.isArray(dataArray)) return;

    dataArray.forEach((item) => {
      const deviceId = item.entityId?.id;
      if (!deviceId) return;

      const latest = item.latest?.TIME_SERIES || {};

      Object.entries(latest).forEach(([key, entry]) => {
        const value = parseFloat(entry.value) || 0;
        const timestamp = entry.ts || Date.now();

        this.config.onData(deviceId, key, value, timestamp);
      });
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    const backoff = REALTIME_CONFIG.WS_RECONNECT_BACKOFF;
    const delay = backoff[Math.min(this.reconnectAttempts, backoff.length - 1)];

    this.reconnectAttempts++;
    STATE.wsConsecutiveFailures++;

    if (STATE.wsConsecutiveFailures >= REALTIME_CONFIG.FALLBACK_AFTER_FAILURES) {
      LogHelper.error('[WebSocket] Max reconnect attempts reached, triggering fallback to REST');
      this.config.onError(new Error('Max reconnect attempts reached'));
      return;
    }

    LogHelper.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeoutId = setTimeout(async () => {
      try {
        await this.connect();

        // Re-subscribe to previous devices
        if (this.lastSubscribedDevices.length > 0) {
          setTimeout(() => this.subscribe(this.lastSubscribedDevices), 500);
        }
      } catch (err) {
        LogHelper.error('[WebSocket] Reconnect failed:', err);
        // Will trigger another reconnect via onclose
      }
    }, delay);
  }

  disconnect() {
    this.config.autoReconnect = false;

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      if (this.currentCmdId !== null) {
        this.unsubscribe(this.currentCmdId);
      }

      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.currentCmdId = null;
    this.lastSubscribedDevices = [];
    this.isAuthenticated = false;
  }

  nextCmdId() {
    return ++this.cmdIdCounter;
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSubscribedDevices() {
    return [...this.lastSubscribedDevices];
  }
}

// ============================================
// RFC-0093: REAL-TIME MODE FUNCTIONS
// ============================================

/**
 * RFC-0093: Handle WebSocket data updates
 */
function handleWebSocketData(deviceId, key, value, timestamp) {
  if (key === 'power') {
    STATE.realTimePowerMap.set(deviceId, { value, timestamp });
    updateCardPowerDisplay(deviceId, { value, timestamp });
  }
}

/**
 * RFC-0093: Handle WebSocket connection changes
 */
function handleWebSocketConnectionChange(isConnected) {
  updateConnectionIndicator(isConnected ? 'websocket' : 'disconnected');

  if (isConnected && STATE.realTimeActive) {
    // Subscribe to visible devices
    const visibleDeviceIds = getVisibleDeviceIds();
    if (visibleDeviceIds.length > 0 && websocketService) {
      websocketService.subscribe(visibleDeviceIds);
    }
  }
}

/**
 * RFC-0093: Handle WebSocket errors - trigger fallback to REST
 */
function handleWebSocketError(error) {
  LogHelper.error('[RealTime] WebSocket error:', error.message);

  if (STATE.wsConsecutiveFailures >= REALTIME_CONFIG.FALLBACK_AFTER_FAILURES) {
    LogHelper.warn('[RealTime] Falling back to REST polling mode');

    // Show notification
    const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;
    if (MyIOToast) {
      MyIOToast.warning('WebSocket indisponível. Usando modo REST polling.', { duration: 5000 });
    }

    // Switch to REST mode
    STATE.realTimeEngine = 'rest';
    updateConnectionIndicator('rest');

    // Start REST polling if real-time is still active
    if (STATE.realTimeActive) {
      startRestPollingMode();
    }
  }
}

/**
 * RFC-0093: Get visible device IDs based on current filters
 */
function getVisibleDeviceIds() {
  const filtered = applyFilters(STATE.allDevices, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);
  return filtered.map((d) => d.entityId).filter((id) => id);
}

/**
 * RFC-0093: Update connection status indicator in UI
 */
function updateConnectionIndicator(mode) {
  const indicator = document.getElementById('realtimeConnectionIndicator');
  if (!indicator) return;

  indicator.className = 'realtime-connection-indicator';

  switch (mode) {
    case 'websocket':
      indicator.innerHTML = '<span class="ws-dot"></span> WebSocket';
      indicator.classList.add('ws-connected');
      break;
    case 'rest':
      indicator.innerHTML = '<span class="rest-dot"></span> REST Polling';
      indicator.classList.add('rest-mode');
      break;
    case 'disconnected':
      indicator.innerHTML = '<span class="disconnected-dot"></span> Reconectando...';
      indicator.classList.add('disconnected');
      break;
    default:
      indicator.innerHTML = '';
  }
}

/**
 * RFC-0093: Start WebSocket real-time mode
 */
async function startWebSocketMode() {
  LogHelper.log('[RealTime] Starting WebSocket mode...');

  STATE.realTimeEngine = 'websocket';
  STATE.wsConsecutiveFailures = 0;

  // Create WebSocket service
  websocketService = new RealTimeWebSocketService({
    onData: handleWebSocketData,
    onConnectionChange: handleWebSocketConnectionChange,
    onError: handleWebSocketError,
    autoReconnect: true,
  });

  try {
    await websocketService.connect();
    updateConnectionIndicator('websocket');
  } catch (err) {
    LogHelper.error('[RealTime] WebSocket connection failed:', err);
    STATE.wsConsecutiveFailures++;

    if (STATE.wsConsecutiveFailures >= REALTIME_CONFIG.FALLBACK_AFTER_FAILURES) {
      handleWebSocketError(err);
    } else {
      // Try reconnecting
      websocketService.scheduleReconnect();
    }
  }
}

/**
 * RFC-0093: Start REST polling mode (fallback)
 */
function startRestPollingMode() {
  LogHelper.log('[RealTime] Starting REST polling mode...');

  STATE.realTimeEngine = 'rest';
  updateConnectionIndicator('rest');

  // Initial fetch
  fetchAllDevicesPowerREST();

  // Start polling loop
  STATE.realTimeIntervalId = setInterval(() => {
    if (!STATE.realTimeActive) return;

    // Check max runtime
    if (Date.now() - STATE.realTimeStartedAt > REALTIME_CONFIG.MAX_RUNTIME_MS) {
      LogHelper.log('[RealTime] Max runtime reached, stopping...');
      stopRealTimeMode();
      return;
    }

    fetchAllDevicesPowerREST();
  }, REALTIME_CONFIG.REST_INTERVAL_MS);

  // Start countdown update
  STATE.realTimeCountdownId = setInterval(updateProgressBar, REALTIME_CONFIG.COUNTDOWN_UPDATE_MS);
}

/**
 * RFC-0093: Fetch power via REST API (fallback mode)
 */
async function fetchAllDevicesPowerREST() {
  const filtered = applyFilters(STATE.allDevices, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);

  if (filtered.length === 0) {
    LogHelper.log('[REST] No devices to fetch');
    return;
  }

  setProgressFetchingState(true);
  LogHelper.log(`[REST] Fetching power for ${filtered.length} devices...`);

  const batches = [];
  for (let i = 0; i < filtered.length; i += REALTIME_CONFIG.BATCH_SIZE) {
    batches.push(filtered.slice(i, i + REALTIME_CONFIG.BATCH_SIZE));
  }

  let fetchedCount = 0;

  for (const batch of batches) {
    const promises = batch.map(async (device) => {
      const entityId = device.entityId;
      if (!entityId) return;

      const powerData = await fetchDevicePowerREST(entityId);
      if (powerData) {
        STATE.realTimePowerMap.set(entityId, powerData);
        updateCardPowerDisplay(entityId, powerData);
        fetchedCount++;
      }
    });

    await Promise.all(promises);

    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, REALTIME_CONFIG.BATCH_DELAY_MS));
    }
  }

  setProgressFetchingState(false);
  STATE.realTimeStartedAt = Date.now(); // Reset for countdown
  LogHelper.log(`[REST] Updated ${fetchedCount} cards`);
}

/**
 * RFC-0093: Fetch single device power via REST (fallback)
 */
async function fetchDevicePowerREST(deviceId) {
  try {
    const token = localStorage.getItem('jwt_token');
    if (!token) return null;

    const tbHost = window.MyIOUtils?.getTbHost?.() || '';
    const url = `${tbHost}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=power&limit=1&agg=NONE&useStrictDataTypes=true`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.power && data.power.length > 0) {
      return {
        value: Number(data.power[0].value) || 0,
        timestamp: data.power[0].ts || Date.now(),
      };
    }

    return { value: 0, timestamp: Date.now() };
  } catch (err) {
    return null;
  }
}

/**
 * RFC-0093: Set progress bar fetching state
 */
function setProgressFetchingState(isFetching) {
  const progressFill = document.getElementById('realtimeProgressFill');
  const progressText = document.getElementById('realtimeProgressText');

  if (progressFill) {
    progressFill.classList.toggle('fetching', isFetching);
    if (isFetching) progressFill.style.width = '100%';
  }

  if (progressText) {
    progressText.classList.toggle('fetching', isFetching);
    if (isFetching) progressText.textContent = '...';
  }
}

/**
 * RFC-0093: Update a single card's power display
 */
function updateCardPowerDisplay(entityId, powerData) {
  const card = document.querySelector(`[data-entity-id="${entityId}"]`);
  if (!card) return;

  if (!card.classList.contains('realtime-mode')) {
    card.classList.add('realtime-mode');
  }

  const powerEl = card.querySelector('.power');
  if (powerEl) {
    const powerKw = (powerData.value / 1000).toFixed(2);
    powerEl.textContent = powerKw;
  }

  let lastUpdateEl = card.querySelector('.last-update');
  if (!lastUpdateEl) {
    const subEl = card.querySelector('.sub');
    if (subEl) {
      subEl.innerHTML = `<span class="last-update"><span class="update-icon">🕐</span> ${formatTimeAgo(
        powerData.timestamp
      )}</span>`;
    }
  } else {
    lastUpdateEl.innerHTML = `<span class="update-icon">🕐</span> ${formatTimeAgo(powerData.timestamp)}`;
  }

  if (!card.querySelector('.realtime-badge')) {
    const badge = document.createElement('div');
    badge.className = 'realtime-badge';
    badge.innerHTML = '<span class="live-dot"></span> LIVE';
    card.appendChild(badge);
  }
}

/**
 * RFC-0093: Format timestamp as relative time
 */
function formatTimeAgo(timestamp) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5) return 'agora';
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  return `há ${Math.floor(diff / 3600)}h`;
}

/**
 * RFC-0093: Update progress bar (REST mode only)
 */
function updateProgressBar() {
  if (STATE.realTimeEngine !== 'rest') return;

  const progressContainer = document.getElementById('realtimeProgressContainer');
  const progressFill = document.getElementById('realtimeProgressFill');
  const progressText = document.getElementById('realtimeProgressText');

  if (!progressContainer || !progressFill || !progressText) return;
  if (!STATE.realTimeActive) {
    progressContainer.style.display = 'none';
    return;
  }

  progressContainer.style.display = 'flex';

  const elapsed = (Date.now() - STATE.realTimeStartedAt) % REALTIME_CONFIG.REST_INTERVAL_MS;
  const remaining = Math.max(0, Math.ceil((REALTIME_CONFIG.REST_INTERVAL_MS - elapsed) / 1000));
  const percentage = ((REALTIME_CONFIG.REST_INTERVAL_MS - elapsed) / REALTIME_CONFIG.REST_INTERVAL_MS) * 100;

  progressFill.style.width = `${Math.max(0, percentage)}%`;
  progressText.textContent = `${remaining}s`;
}

/**
 * RFC-0093: Start real-time mode (WebSocket default, REST fallback)
 */
async function startRealTimeMode() {
  if (STATE.realTimeActive) return;

  LogHelper.log('[RealTime] Starting real-time mode...');

  STATE.realTimeActive = true;
  STATE.realTimeStartedAt = Date.now();
  STATE.realTimePowerMap.clear();
  STATE.realTimeEngine = REALTIME_CONFIG.DEFAULT_ENGINE;
  STATE.wsConsecutiveFailures = 0;

  // Update toggle button UI
  const toggleBtn = document.getElementById('realtimeToggleBtn');
  if (toggleBtn) {
    toggleBtn.classList.add('active');
    toggleBtn.querySelector('.toggle-status').textContent = 'ON';
    toggleBtn.title = 'Desativar modo tempo real';
  }

  // Show settings and connection indicator
  const settingsBtn = document.getElementById('realtimeSettingsBtn');
  if (settingsBtn) settingsBtn.style.display = 'flex';

  const progressContainer = document.getElementById('realtimeProgressContainer');
  if (progressContainer) progressContainer.style.display = 'flex';

  const connectionIndicator = document.getElementById('realtimeConnectionIndicator');
  if (connectionIndicator) connectionIndicator.style.display = 'flex';

  // Start with WebSocket (default)
  if (REALTIME_CONFIG.DEFAULT_ENGINE === 'websocket') {
    await startWebSocketMode();
  } else {
    startRestPollingMode();
  }

  LogHelper.log(`[RealTime] Mode started (engine: ${STATE.realTimeEngine})`);
}

/**
 * RFC-0093: Stop real-time mode
 */
function stopRealTimeMode() {
  if (!STATE.realTimeActive) return;

  LogHelper.log('[RealTime] Stopping real-time mode...');

  STATE.realTimeActive = false;

  // Stop WebSocket
  if (websocketService) {
    websocketService.disconnect();
    websocketService = null;
  }

  // Clear REST intervals
  if (STATE.realTimeIntervalId) {
    clearInterval(STATE.realTimeIntervalId);
    STATE.realTimeIntervalId = null;
  }
  if (STATE.realTimeCountdownId) {
    clearInterval(STATE.realTimeCountdownId);
    STATE.realTimeCountdownId = null;
  }

  // Clear debounce timer
  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = null;
  }

  // Update toggle button UI
  const toggleBtn = document.getElementById('realtimeToggleBtn');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
    toggleBtn.querySelector('.toggle-status').textContent = 'OFF';
    toggleBtn.title = 'Ativar modo tempo real';
  }

  // Hide UI elements
  const settingsBtn = document.getElementById('realtimeSettingsBtn');
  if (settingsBtn) settingsBtn.style.display = 'none';

  const progressContainer = document.getElementById('realtimeProgressContainer');
  if (progressContainer) progressContainer.style.display = 'none';

  const connectionIndicator = document.getElementById('realtimeConnectionIndicator');
  if (connectionIndicator) connectionIndicator.style.display = 'none';

  // Remove realtime-mode from cards
  document.querySelectorAll('.equip-card.realtime-mode').forEach((card) => {
    card.classList.remove('realtime-mode');
    const badge = card.querySelector('.realtime-badge');
    if (badge) badge.remove();
  });

  // Re-render cards with original data
  reflowCards();

  STATE.realTimePowerMap.clear();
  STATE.realTimeStartedAt = null;
  STATE.realTimeEngine = REALTIME_CONFIG.DEFAULT_ENGINE;

  LogHelper.log('[RealTime] Mode stopped');
}

/**
 * RFC-0093: Toggle real-time mode
 */
function toggleRealTimeMode() {
  if (STATE.realTimeActive) {
    stopRealTimeMode();
  } else {
    startRealTimeMode();
  }
}

/**
 * RFC-0093: Show settings modal
 */
function showRealtimeSettingsModal() {
  if (realtimeSettingsModal) realtimeSettingsModal.remove();

  const currentInterval = REALTIME_CONFIG.REST_INTERVAL_MS / 1000;
  const currentEngine = STATE.realTimeEngine;

  const modalHTML = `
    <div class="realtime-settings-modal" id="realtimeSettingsModal">
      <div class="realtime-settings-card">
        <div class="realtime-settings-header">
          <h3>⚡ Configurações Tempo Real</h3>
          <button class="realtime-settings-close" id="realtimeSettingsClose">×</button>
        </div>
        <div class="realtime-settings-body">
          <div class="realtime-settings-group">
            <label class="realtime-settings-label">
              Motor de Atualização
              <span class="realtime-settings-sublabel">WebSocket para true real-time, REST como fallback</span>
            </label>
            <div class="realtime-engine-selector" id="engineSelector">
              <button class="realtime-engine-btn ${
                currentEngine === 'websocket' ? 'active' : ''
              }" data-engine="websocket">
                <span>🔌</span> WebSocket
              </button>
              <button class="realtime-engine-btn ${
                currentEngine === 'rest' ? 'active' : ''
              }" data-engine="rest">
                <span>🔄</span> REST Polling
              </button>
            </div>
          </div>
          <div class="realtime-settings-group">
            <label class="realtime-settings-label">
              Intervalo REST (fallback)
              <span class="realtime-settings-sublabel">Usado quando WebSocket não está disponível</span>
            </label>
            <div class="realtime-interval-selector" id="intervalSelector">
              ${REALTIME_CONFIG.INTERVAL_OPTIONS.map(
                (sec) =>
                  `<button class="realtime-interval-btn ${
                    sec === currentInterval ? 'active' : ''
                  }" data-interval="${sec}">${sec}s</button>`
              ).join('')}
            </div>
          </div>
          <div class="realtime-settings-group" style="margin-bottom: 0;">
            <label class="realtime-settings-label">Informações</label>
            <p style="font-size: 12px; color: var(--ink-2); margin: 0; line-height: 1.5;">
              • <b>WebSocket:</b> Atualizações instantâneas (< 100ms)<br>
              • <b>REST:</b> Polling periódico, maior latência<br>
              • Auto-fallback após 6 falhas de conexão<br>
              • Desliga automaticamente após 30 minutos
            </p>
          </div>
        </div>
        <div class="realtime-settings-footer">
          <button class="realtime-settings-btn-cancel" id="realtimeSettingsCancel">Cancelar</button>
          <button class="realtime-settings-btn-save" id="realtimeSettingsSave">Salvar</button>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHTML;
  realtimeSettingsModal = container.firstElementChild;
  document.body.appendChild(realtimeSettingsModal);

  let selectedEngine = currentEngine;
  let selectedInterval = currentInterval;

  // Engine buttons
  realtimeSettingsModal.querySelectorAll('.realtime-engine-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      realtimeSettingsModal
        .querySelectorAll('.realtime-engine-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedEngine = btn.dataset.engine;
    });
  });

  // Interval buttons
  realtimeSettingsModal.querySelectorAll('.realtime-interval-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      realtimeSettingsModal
        .querySelectorAll('.realtime-interval-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedInterval = parseInt(btn.dataset.interval, 10);
    });
  });

  // Close/Cancel
  realtimeSettingsModal
    .querySelector('#realtimeSettingsClose')
    .addEventListener('click', hideRealtimeSettingsModal);
  realtimeSettingsModal
    .querySelector('#realtimeSettingsCancel')
    .addEventListener('click', hideRealtimeSettingsModal);

  // Save
  realtimeSettingsModal.querySelector('#realtimeSettingsSave').addEventListener('click', () => {
    REALTIME_CONFIG.REST_INTERVAL_MS = selectedInterval * 1000;

    // If engine changed and real-time is active, restart
    if (selectedEngine !== STATE.realTimeEngine && STATE.realTimeActive) {
      stopRealTimeMode();
      REALTIME_CONFIG.DEFAULT_ENGINE = selectedEngine;
      startRealTimeMode();
    } else {
      REALTIME_CONFIG.DEFAULT_ENGINE = selectedEngine;
    }

    LogHelper.log(`[RealTime] Settings saved - Engine: ${selectedEngine}, Interval: ${selectedInterval}s`);
    hideRealtimeSettingsModal();
  });

  // Click outside / ESC
  realtimeSettingsModal.addEventListener('click', (e) => {
    if (e.target === realtimeSettingsModal) hideRealtimeSettingsModal();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      hideRealtimeSettingsModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * RFC-0093: Hide settings modal
 */
function hideRealtimeSettingsModal() {
  if (realtimeSettingsModal) {
    realtimeSettingsModal.remove();
    realtimeSettingsModal = null;
  }
}

/**
 * RFC-0093: Bind real-time toggle and settings events
 */
function bindRealTimeToggle() {
  const toggleBtn = document.getElementById('realtimeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleRealTimeMode);
    LogHelper.log('[RealTime] Toggle button bound');
  }

  const settingsBtn = document.getElementById('realtimeSettingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showRealtimeSettingsModal);
    LogHelper.log('[RealTime] Settings button bound');
  }
}

// ============================================
// END RFC-0093: REAL-TIME WEBSOCKET SERVICE
// ============================================

// ============================================
// RFC-0103: POWER LIMITS SETUP MODAL
// ============================================

/**
 * RFC-0103: Bind Power Limits Setup button
 */
function bindPowerLimitsButton() {
  const powerLimitsBtn = document.getElementById('powerLimitsBtn');
  if (powerLimitsBtn) {
    powerLimitsBtn.addEventListener('click', openPowerLimitsModal);
    LogHelper.log('[PowerLimits] Button bound');
  }
}

/**
 * RFC-0103: Open Power Limits Setup Modal
 */
async function openPowerLimitsModal() {
  LogHelper.log('[PowerLimits] Opening modal...');

  try {
    // Check if MyIOLibrary is available
    if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.openPowerLimitsSetupModal) {
      console.error('[PowerLimits] MyIOLibrary.openPowerLimitsSetupModal not available');
      window.alert('Configuração de limites não disponível. Verifique se a biblioteca está carregada.');
      return;
    }

    // Get JWT token from widgetContext
    //const jwtToken = self.ctx?.http?.getJwtToken?.() || self.ct/x?.dashboard?.getJwtToken?.();
    const jwtToken = localStorage.getItem('jwt_token');
    if (!jwtToken) {
      console.error('[PowerLimits] JWT token not available');
      window.alert('Erro de autenticação. Por favor, atualize a página.');
      return;
    }

    // Get ThingsBoard base URL
    const tbBaseUrl = window.location.origin;

    // Open the modal
    await MyIOLibrary.openPowerLimitsSetupModal({
      token: jwtToken,
      customerId: CUSTOMER_ID,
      tbBaseUrl: tbBaseUrl,
      domain: 'energy', // RFC-0103: EQUIPMENTS widget uses energy domain
      existingMapPower: MAP_INSTANTANEOUS_POWER || null,
      onSave: (updatedJson) => {
        LogHelper.log('[PowerLimits] Configuration saved:', updatedJson);
        // Update local cache
        MAP_INSTANTANEOUS_POWER = updatedJson;
        // Show success notification
        showPowerLimitsNotification('Limites salvos com sucesso!', 'success');
      },
      onClose: () => {
        LogHelper.log('[PowerLimits] Modal closed');
      },
    });

    LogHelper.log('[PowerLimits] Modal opened successfully');
  } catch (error) {
    console.error('[PowerLimits] Error opening modal:', error);
    window.alert('Erro ao abrir configuração de limites: ' + error.message);
  }
}

/**
 * RFC-0103: Show notification for Power Limits actions
 */
function showPowerLimitsNotification(message, type = 'info') {
  // Use existing toast system if available, otherwise console
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.MyIOToast) {
    MyIOLibrary.MyIOToast.show(message, type);
  } else {
    console.log(`[PowerLimits][${type.toUpperCase()}] ${message}`);
  }
}

// ============================================
// END RFC-0103: POWER LIMITS SETUP MODAL
// ============================================

/**
 * Bind all filter-related events
 * RFC-0093: Search and filter button events are now handled by buildHeaderDevicesGrid
 */
function bindFilterEvents() {
  // RFC-0093: Search and filter buttons are now configured in onInit via buildHeaderDevicesGrid
  // This function is kept for backwards compatibility but the main logic is in the header controller

  // RFC-0072: All filter-related handlers (filter tabs, search, apply, reset)
  // are now set up in setupModalCloseHandlers() when modal is moved to document.body
  LogHelper.log('[EQUIPMENTS] bindFilterEvents - events managed by header controller');
}

self.onDestroy = function () {
  if (self._onDateParams) {
    window.removeEventListener('myio:date-params', self._onDateParams);
  }
  if (self._onFilterApplied) {
    window.removeEventListener('myio:filter-applied', self._onFilterApplied);
  }
  if (self._onCustomersReady) {
    window.removeEventListener('myio:customers-ready', self._onCustomersReady);
  }

  // RFC-0093: Cleanup real-time mode and WebSocket
  if (STATE.realTimeActive) {
    stopRealTimeMode();
  }
  if (websocketService) {
    websocketService.disconnect();
    websocketService = null;
  }
  if (STATE.realTimeIntervalId) {
    clearInterval(STATE.realTimeIntervalId);
    STATE.realTimeIntervalId = null;
  }
  if (STATE.realTimeCountdownId) {
    clearInterval(STATE.realTimeCountdownId);
    STATE.realTimeCountdownId = null;
  }
  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = null;
  }
  LogHelper.log('[EQUIPMENTS] [RFC-0093] Real-time mode and WebSocket cleanup complete');

  // RFC-0093: Cleanup header controller
  if (equipHeaderController) {
    equipHeaderController.destroy();
    equipHeaderController = null;
    LogHelper.log('[EQUIPMENTS] [RFC-0093] Header controller destroyed');
  }

  // RFC-0090: Cleanup filter modal using shared factory
  if (equipmentsFilterModal) {
    equipmentsFilterModal.destroy();
    equipmentsFilterModal = null;
    LogHelper.log('[EQUIPMENTS] [RFC-0090] Filter modal destroyed');
  }
};
