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

const getDataApiHost =
  window.MyIOUtils?.getDataApiHost ||
  (() => {
    console.error('[EQUIPMENTS] getDataApiHost not available - MAIN widget not loaded');
    return localStorage.getItem('__MYIO_DATA_API_HOST__') || '';
  });

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

// RFC-0093: Centralized header controller
let equipHeaderController = null;

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
    console.error('[EQUIPMENTS] findValue not available - MAIN widget not loaded');
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
function initializeCards(devices) {
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

    // RFC-0091: delayTimeConnectionInMins - configurable via MAIN settings (default 60 minutes)
    MyIOLibrary.renderCardComponentHeadOffice(container, {
      entityObject: device,
      delayTimeConnectionInMins: window.MyIOUtils?.getDelayTimeConnectionInMins?.() ?? 60,
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
            // Se pularmos isso, o Footer vai mostrar um chip vazio ou com erro
            if (MyIOSelectionStore.registerEntity) {
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

      useNewComponents: true,
      enableSelection: true,
      enableDragDrop: true,
      // RFC-0072: Disable "More Information" menu item (redundant with card click)
      hideInfoMenuItem: true,
    });

    // O componente renderCardComponentHeadOffice agora gerencia o estilo baseado em deviceStatus
    // Não é mais necessário aplicar classes manualmente
  });

  LogHelper.log('[EQUIPMENTS] Cards initialized successfully');
}

self.onInit = async function () {
  // RFC-0091: Protection against duplicate onInit calls (use global scope for multiple widget instances)
  if (window.__EQUIPMENTS_INITIALIZED__) {
    LogHelper.log('[EQUIPMENTS] onInit - already initialized, skipping duplicate call');
    return;
  }
  window.__EQUIPMENTS_INITIALIZED__ = true;

  LogHelper.log('[EQUIPMENTS] onInit - ctx:', self.ctx);

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
    CUSTOMER_ID = mainCredentials.customerId || window.myioHoldingCustomerId || ' ';

    // Objeto principal para armazenar os dados dos dispositivos
    const devices = {};

    // 🗺️ NOVO: Mapa para conectar o ingestionId ao ID da entidade do ThingsBoard
    const ingestionIdToEntityIdMap = new Map();

    // --- FASE 1: Monta o objeto inicial e o mapa de IDs ---
    self.ctx.data.forEach((data) => {
      if (data.datasource.aliasName !== 'Shopping') {
        const entityId = data.datasource.entity.id.id;

        // Cria o objeto do dispositivo se for a primeira vez
        if (!devices[entityId]) {
          devices[entityId] = {
            name: data.datasource.name,
            label: data.datasource.entityLabel,
            values: [],
          };
        }

        // Adiciona o valor atual ao array
        // RFC: Rename 'consumption' to 'consumption_power' to avoid confusion with API consumption (kWh)
        const dataType = data.dataKey.name === 'consumption' ? 'consumption_power' : data.dataKey.name;
        devices[entityId].values.push({
          dataType: dataType,
          value: data.data[0][1],
          ts: data.data[0][0],
        });

        // ✅ LÓGICA DO MAPA: Se o dado for o ingestionId, guardamos a relação
        if (data.dataKey.name === 'ingestionId' && data.data[0][1]) {
          const ingestionId = data.data[0][1];
          ingestionIdToEntityIdMap.set(ingestionId, entityId);
        }
      }
    });

    const boolExecSync = false;

    // RFC-0071: Trigger device profile synchronization (runs once)
    if (!__deviceProfileSyncComplete && boolExecSync) {
      try {
        LogHelper.log('[EQUIPMENTS] [RFC-0071] Triggering device profile sync...');
        const syncResult = await syncDeviceProfileAttributes(self.ctx.data);
        __deviceProfileSyncComplete = true;

        if (syncResult.synced > 0) {
          LogHelper.log(
            '[EQUIPMENTS] [RFC-0071] ⚠️ Widget reload recommended to load new deviceProfile attributes'
          );
          LogHelper.log(
            '[EQUIPMENTS] [RFC-0071] You may need to refresh the dashboard to see deviceProfile in ctx.data'
          );
        }
      } catch (error) {
        LogHelper.error('[EQUIPMENTS] [RFC-0071] Sync failed, continuing without it:', error);
        // Don't block widget initialization if sync fails
      }
    }

    // ============================================
    // CREDENTIALS: Prefer MAIN's, fallback to direct fetch
    // ============================================
    // MAIN already fetched credentials, reuse them if available
    if (mainCredentials.clientId && mainCredentials.clientSecret) {
      CLIENT_ID = mainCredentials.clientId;
      CLIENT_SECRET = mainCredentials.clientSecret;
      LogHelper.log('[EQUIPMENTS] Using credentials from MAIN (MyIOUtils)');

      // Still need to fetch mapInstantaneousPower (not in MAIN)
      const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_ID);
      MAP_INSTANTANEOUS_POWER = customerCredentials.mapInstantaneousPower;
      DELAY_TIME_CONNECTION_MINS = window.MyIOUtils?.getDelayTimeConnectionInMins();
    } else {
      // Fallback: fetch all credentials directly
      LogHelper.log('[EQUIPMENTS] MAIN credentials not available, fetching directly...');
      const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_ID);
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

          // Get instantaneous power from ctx.data (renamed to consumption_power to avoid confusion)
          const instantaneousPower = findValue(device.values, 'consumption_power', 0);

          // Calculate device status using range-based calculation
          const deviceStatus = MyIOLibrary.calculateDeviceStatusWithRanges({
            connectionStatus: mappedConnectionStatus,
            lastConsumptionValue: Number(instantaneousPower) || null,
            ranges: rangesWithSource,
          });

          // DEBUG ER 14
          if (device.label && device.label.toLowerCase().includes('er 14')) {
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
            console.log('📊 RANGES:');
            console.log('   rangesWithSource:', JSON.stringify(rangesWithSource, null, 2));
            console.log('');
            console.log('🎯 CALCULATED STATUS:');
            console.log('   deviceStatus:', deviceStatus);
            console.log('');
            console.log('📦 RAW device.values:');
            device.values?.forEach((v, i) => {
              console.log(`   [${i}] ${v.dataKey?.name}: ${v.data?.[0]?.[1]}`);
            });
            console.log('════════════════════════════════════════════════════════════════');
          }

          const ingestionId = findValue(device.values, 'ingestionId', null);
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

          return {
            entityId: entityId,
            labelOrName: device.label,
            val: consumptionValue,
            deviceIdentifier: deviceIdentifier,
            centralName: findValue(device.values, 'centralName', null),
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
          };
        });

      const devicesFormatadosParaCards = await Promise.all(promisesDeCards);

      function isActuallyEquipment(device) {
        // Non-3F_MEDIDOR devices are always equipment
        if (device.deviceType !== '3F_MEDIDOR') {
          return true;
        }
        // For 3F_MEDIDOR, check deviceProfile and labelOrName to determine if it's actually equipment
        const equipmentKeywords = ['MOTOR', 'ELEVADOR', 'ESCADA_ROLANTE', 'CHILLER', 'BOMBA', 'FANCOIL'];
        const profileUpper = (device.deviceProfile || '').toUpperCase();
        const labelUpper = (device.labelOrName || '').toUpperCase();

        return equipmentKeywords.some(
          (keyword) => profileUpper.includes(keyword) || labelUpper.includes(keyword)
        );
      }

      // Separate lojas from equipments based on deviceType
      const lojasDevices = devicesFormatadosParaCards.filter((d) => !isActuallyEquipment(d));
      const equipmentDevices = devicesFormatadosParaCards.filter((d) => isActuallyEquipment(d));

      LogHelper.log('[EQUIPMENTS] Total devices:', devicesFormatadosParaCards.length);
      LogHelper.log('[EQUIPMENTS] Equipment devices:', equipmentDevices.length);
      LogHelper.log('[EQUIPMENTS] Lojas (actual 3F_MEDIDOR stores):', lojasDevices.length);

      // ✅ Emit event to inform MAIN about lojas ingestionIds
      const lojasIngestionIds = lojasDevices.map((d) => d.ingestionId).filter((id) => id); // Remove nulls

      window.dispatchEvent(
        new CustomEvent('myio:lojas-identified', {
          detail: {
            lojasIngestionIds,
            lojasCount: lojasIngestionIds.length,
            timestamp: Date.now(),
          },
        })
      );

      LogHelper.log('[EQUIPMENTS] ✅ Emitted myio:lojas-identified:', {
        lojasCount: lojasIngestionIds.length,
        lojasIngestionIds,
      });

      // ✅ Emit event to inform MAIN about equipment ingestionIds
      const equipmentsIngestionIds = equipmentDevices.map((d) => d.ingestionId).filter((id) => id);

      window.dispatchEvent(
        new CustomEvent('myio:equipments-identified', {
          detail: {
            equipmentsIngestionIds,
            equipmentsCount: equipmentsIngestionIds.length,
            timestamp: Date.now(),
          },
        })
      );

      LogHelper.log('[EQUIPMENTS] ✅ Emitted myio:equipments-identified:', {
        equipmentsCount: equipmentsIngestionIds.length,
      });

      // ✅ Save ONLY equipment devices to global STATE for filtering
      STATE.allDevices = equipmentDevices;

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
      if (equipHeaderController) {
        equipHeaderController.updateFromDevices(equipmentDevices, {
          cache: energyCacheFromMain,
          ctxData: self.ctx.data,
        });
      } else {
        // Fallback to old function if header controller not available
        updateEquipmentStats(equipmentDevices, energyCacheFromMain, self.ctx.data);
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
            // Remove old consumption data if exists
            // RFC-0091: Use 'value' property to match findValue expected format
            const consumptionIndex = device.values.findIndex((v) => v.dataType === 'consumption');
            if (consumptionIndex >= 0) {
              device.values[consumptionIndex] = {
                value: cached.total_value,
                ts: cached.timestamp,
                dataType: 'consumption',
              };
            } else {
              device.values.push({
                value: cached.total_value,
                ts: cached.timestamp,
                dataType: 'consumption',
              });
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
    const orchestrator = await waitForOrchestrator();

    if (orchestrator) {
      const existingCache = orchestrator.getCache();

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
};

/**
 * RFC: Emit event to update HEADER equipment card
 * Sends total equipment count and filtered count
 */
function emitEquipmentCountEvent(filteredDevices) {
  const totalEquipments = STATE.allDevices.length;
  const filteredEquipments = filteredDevices.length;

  // Check if all shoppings are selected (no filter or all selected)
  const allShoppingsSelected =
    STATE.selectedShoppingIds.length === 0 || STATE.selectedShoppingIds.length === STATE.totalShoppings;

  const eventData = {
    totalEquipments,
    filteredEquipments,
    allShoppingsSelected,
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
  const energyCache = window.MyIOOrchestrator?.getCache?.() || null;
  if (equipHeaderController) {
    equipHeaderController.updateFromDevices(filtered, {
      cache: energyCache,
      ctxData: self.ctx.data,
    });
  } else {
    // Fallback to old function if header controller not available
    updateEquipmentStats(filtered, energyCache, self.ctx.data);
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
  const deviceProfile = (device.deviceProfile || '').toUpperCase();
  return deviceType === 'ELEVADOR' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ELEVADOR');
}

function isEscalator(device) {
  const deviceType = (device.deviceType || '').toUpperCase();
  const deviceProfile = (device.deviceProfile || '').toUpperCase();
  return (
    deviceType === 'ESCADA_ROLANTE' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ESCADA_ROLANTE')
  );
}

function isHVAC(device) {
  const deviceType = (device.deviceType || '').toUpperCase();
  const deviceProfile = (device.deviceProfile || '').toUpperCase();
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
    filterTabs: [
      { id: 'all', label: 'Todos', filter: () => true },
      { id: 'online', label: 'Online', filter: (d) => getDeviceConsumption(d) > 0 },
      { id: 'offline', label: 'Offline', filter: (d) => getDeviceConsumption(d) === 0 },
      {
        id: 'normal',
        label: 'Normal',
        filter: (d) => getDeviceStatus(d) === 'power_on' || getDeviceStatus(d) === 'normal',
      },
      { id: 'standby', label: 'Stand By', filter: (d) => getDeviceStatus(d) === 'standby' },
      {
        id: 'alert',
        label: 'Alerta',
        filter: (d) => ['warning', 'alert', 'maintenance'].includes(getDeviceStatus(d)),
      },
      {
        id: 'failure',
        label: 'Falha',
        filter: (d) => getDeviceStatus(d) === 'failure' || getDeviceStatus(d) === 'power_off',
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

/**
 * RFC-0090: Open filter modal
 */
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

  // Open with current devices and state
  equipmentsFilterModal.open(STATE.allDevices, {
    selectedIds: STATE.selectedIds,
    sortMode: STATE.sortMode,
  });
}

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
