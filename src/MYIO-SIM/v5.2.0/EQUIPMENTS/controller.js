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
let myIOAuth; // Instance of MyIO auth component from MyIOLibrary

LogHelper.log('[MYIO EQUIPMENTS] Script loaded, using shared utilities:', !!window.MyIOUtils);

// RFC-0071: Device Profile Synchronization - Global flag to track if sync has been completed
let __deviceProfileSyncComplete = false;

// Store customer limits JSON globally for the widget session
window.__customerPowerLimitsJSON = null;

// findValue helper function (from MAIN via MyIOUtils)
const findValue =
  window.MyIOUtils?.findValue ||
  ((values, key, defaultValue = null) => {
    console.error('[EQUIPMENTS] findValue not available - MAIN widget not loaded');
    if (!Array.isArray(values)) return defaultValue;
    const found = values.find((v) => v.key === key);
    return found ? found.value : defaultValue;
  });

// NOTE: RFC-0071 functions (fetchDeviceProfiles, fetchDeviceDetails, addDeviceProfileAttribute, syncDeviceProfileAttributes)
// are now provided by MAIN via window.MyIOUtils

// NOTE: RFC-0078 functions (DEFAULT_CONSUMPTION_RANGES, fetchInstantaneousPowerLimits, extractLimitsFromJSON,
// getDefaultRanges, getCachedPowerLimitsJSON, getConsumptionRangesHierarchical, getCachedConsumptionLimits)
// are now provided by MAIN via window.MyIOUtils

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

    MyIOLibrary.renderCardComponentHeadOffice(container, {
      entityObject: device,
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

          // 3. Get tokens
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
        LogHelper.log('[EQUIPMENTS] [RFC-0072] Opening settings for device:', device.entityId);

        const jwt = localStorage.getItem('jwt_token');
        if (!jwt) {
          LogHelper.error('[EQUIPMENTS] [RFC-0072] JWT token not found');
          window.alert('Token de autenticação não encontrado');
          return;
        }

        LogHelper.log('[EQUIPMENTS] device.deviceStatus:', device.deviceStatus);
        LogHelper.log('[EQUIPMENTS] device.lastConnectTime:', device.lastConnectTime);

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
  LogHelper.log('[EQUIPMENTS] onInit - ctx:', self.ctx);
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
    } else {
      // Fallback: fetch all credentials directly
      LogHelper.log('[EQUIPMENTS] MAIN credentials not available, fetching directly...');
      const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_ID);
      LogHelper.log('customerCredentials', customerCredentials);

      CLIENT_ID = customerCredentials.client_id || ' ';
      CLIENT_SECRET = customerCredentials.client_secret || ' ';
      MAP_INSTANTANEOUS_POWER = customerCredentials.mapInstantaneousPower;
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
          const mappedConnectionStatus =
            window.MyIOUtils?.mapConnectionStatus?.(rawConnectionStatus) || 'offline';
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
              LogHelper.log(`[RFC-0078] ✅ Found deviceMapInstaneousPower in ctx.data for ${deviceId}`);
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
            valType: 'power_w',
            perc: Math.floor(Math.random() * (95 - 70 + 1)) + 70,
            temperatureC: deviceTemperature[0].value,
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

      // Update statistics header (only equipments)
      updateEquipmentStats(equipmentDevices, energyCacheFromMain, self.ctx.data);

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
            const consumptionIndex = device.values.findIndex((v) => v.dataType === 'consumption');
            if (consumptionIndex >= 0) {
              device.values[consumptionIndex] = {
                val: cached.total_value,
                ts: cached.timestamp,
                dataType: 'consumption',
              };
            } else {
              device.values.push({
                val: cached.total_value,
                ts: cached.timestamp,
                dataType: 'consumption',
              });
            }
          }
        }
      });

      // RFC-0076: CRITICAL FIX - Enrich energyCache with full device metadata
      // This ensures ENERGY widget can classify elevators correctly
      LogHelper.log(
        '[EQUIPMENTS] 🔧 Enriching energyCache with device metadata (deviceType, deviceProfile)...'
      );

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

            // RFC-0076: Log elevators specifically (by deviceProfile OR deviceType OR name)
            if (
              deviceType === 'ELEVADOR' ||
              deviceProfile === 'ELEVADOR' || // ← FIXED: Check deviceProfile independently!
              (deviceType === '3F_MEDIDOR' && deviceProfile === 'ELEVADOR') ||
              (deviceName && deviceName.toUpperCase().includes('ELV'))
            ) {
              /*
            LogHelper.log(`[EQUIPMENTS] ⚡ ELEVATOR enriched:`, {
              ingestionId,
              name: deviceName,
              deviceType: deviceType || "(empty)",
              deviceProfile,
              deviceIdentifier,
              consumption: cached.total_value
            });
            */
            }
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
    // RFC-0072: Zoom controls removed - use browser native zoom instead
    // Zoom functionality commented out to reduce complexity and rely on browser zoom
    /*
  const wrap = document.getElementById("equipWrap");
  const key = `tb-font-scale:${ctx?.widget?.id || "equip"}`;
  const saved = +localStorage.getItem(key);
  if (saved && saved >= 0.8 && saved <= 1.4)
    wrap.style.setProperty("--fs", saved);

  const getScale = () => +getComputedStyle(wrap).getPropertyValue("--fs") || 1;
  const setScale = (v) => {
    const s = Math.min(1.3, Math.max(0.8, +v.toFixed(2)));
    wrap.style.setProperty("--fs", s);
    localStorage.setItem(key, s);
  };

  document
    .getElementById("fontMinus")
    ?.addEventListener("click", () => setScale(getScale() - 0.06));
  document
    .getElementById("fontPlus")
    ?.addEventListener("click", () => setScale(getScale() + 0.06));
  */
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

  // Get energy cache from orchestrator for consumption calculation
  const energyCache = window.MyIOOrchestrator?.getCache?.() || null;
  updateEquipmentStats(filtered, energyCache, self.ctx.data);

  // RFC: Emit event to update HEADER card
  emitEquipmentCountEvent(filtered);
}

/**
 * RFC-0072: Setup modal handlers (called once when modal is moved to document.body)
 */
function setupModalCloseHandlers(modal) {
  // Close button
  const closeBtn = modal.querySelector('#closeFilter');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeFilterModal);
  }

  // Backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeFilterModal();
    }
  });

  // Apply filters button
  const applyBtn = modal.querySelector('#applyFilters');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      // Get selected devices
      const checkboxes = modal.querySelectorAll("#deviceChecklist input[type='checkbox']:checked");
      const selectedSet = new Set();
      checkboxes.forEach((cb) => {
        const deviceId = cb.getAttribute('data-device-id');
        if (deviceId) selectedSet.add(deviceId);
      });

      // If all devices are selected, treat as "no filter"
      STATE.selectedIds = selectedSet.size === STATE.allDevices.length ? null : selectedSet;

      // Get sort mode
      const sortRadio = modal.querySelector('input[name="sortMode"]:checked');
      if (sortRadio) {
        STATE.sortMode = sortRadio.value;
      }

      LogHelper.log('[EQUIPMENTS] [RFC-0072] Filters applied:', {
        selectedCount: STATE.selectedIds?.size || STATE.allDevices.length,
        totalDevices: STATE.allDevices.length,
        sortMode: STATE.sortMode,
        selectedIds: STATE.selectedIds ? Array.from(STATE.selectedIds).slice(0, 5) : 'all', // Show first 5 IDs
      });

      // Apply filters and close modal with cleanup
      reflowCards();
      closeFilterModal();
    });
  }

  // Reset filters button
  const resetBtn = modal.querySelector('#resetFilters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      // Reset state
      STATE.selectedIds = null;
      STATE.sortMode = 'cons_desc';
      STATE.searchTerm = '';
      STATE.searchActive = false;

      // Reset UI
      const searchInput = document.getElementById('equipSearch');
      const searchWrap = document.getElementById('searchWrap');
      if (searchInput) searchInput.value = '';
      if (searchWrap) searchWrap.classList.remove('active');

      // Apply and close with cleanup
      reflowCards();
      closeFilterModal();

      LogHelper.log('[EQUIPMENTS] [RFC-0072] Filters reset');
    });
  }

  // Clear selection button - unchecks all checkboxes without closing modal
  const clearSelectionBtn = modal.querySelector('#clearSelection');
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', () => {
      // Uncheck all checkboxes in the checklist
      const checkboxes = modal.querySelectorAll("#deviceChecklist input[type='checkbox']");
      checkboxes.forEach((cb) => {
        cb.checked = false;
      });

      // Reset filter tabs to "all" active state
      const filterTabs = modal.querySelectorAll('.filter-tab');
      filterTabs.forEach((t) => t.classList.remove('active'));
      const allTab = modal.querySelector('.filter-tab[data-filter="all"]');
      if (allTab) allTab.classList.add('active');

      LogHelper.log('[EQUIPMENTS] [RFC-0072] Selection cleared - all checkboxes unchecked');
    });
  }

  // Bind filter tab click handlers (must be done after modal is moved to document.body)
  const filterTabs = modal.querySelectorAll('.filter-tab');
  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const filterType = tab.getAttribute('data-filter');

      // Update active state
      filterTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      // Filter checkboxes based on selected tab
      const checkboxes = modal.querySelectorAll("#deviceChecklist input[type='checkbox']");
      checkboxes.forEach((cb) => {
        const deviceId = cb.getAttribute('data-device-id');
        const device = STATE.allDevices.find((d) => d.entityId === deviceId);

        if (!device) return;

        const consumption = Number(device.val) || Number(device.lastValue) || 0;
        const deviceType = (device.deviceType || '').toUpperCase();
        const deviceProfile = (device.deviceProfile || '').toUpperCase();
        const identifier = (device.deviceIdentifier || '').toUpperCase();
        const labelOrName = (device.labelOrName || '').toUpperCase();

        // RFC: Check if device has CAG in identifier or labelOrName (climatização)
        const hasCAG = identifier.includes('CAG') || labelOrName.includes('CAG');

        let shouldCheck = false;

        // Get device status for filtering
        const deviceStatusValue = (device.deviceStatus || '').toLowerCase();

        switch (filterType) {
          case 'all':
            shouldCheck = true;
            break;
          case 'online':
            shouldCheck = consumption > 0;
            break;
          case 'offline':
            shouldCheck = consumption === 0;
            break;
          case 'normal':
            shouldCheck = deviceStatusValue === 'power_on' || deviceStatusValue === 'normal';
            break;
          case 'standby':
            shouldCheck = deviceStatusValue === 'standby';
            break;
          case 'alert':
            shouldCheck =
              deviceStatusValue === 'warning' ||
              deviceStatusValue === 'alert' ||
              deviceStatusValue === 'maintenance';
            break;
          case 'failure':
            shouldCheck = deviceStatusValue === 'failure' || deviceStatusValue === 'power_off';
            break;
          case 'with-consumption':
            shouldCheck = consumption > 0;
            break;
          case 'no-consumption':
            shouldCheck = consumption === 0;
            break;
          case 'elevators':
            shouldCheck =
              deviceType === 'ELEVADOR' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ELEVADOR');
            break;
          case 'escalators':
            shouldCheck =
              deviceType === 'ESCADA_ROLANTE' ||
              (deviceType === '3F_MEDIDOR' && deviceProfile === 'ESCADA_ROLANTE');
            break;
          case 'hvac':
            shouldCheck =
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
                  deviceProfile === 'HVAC'));
            break;
          case 'others':
            shouldCheck = !(
              hasCAG ||
              deviceType === 'ELEVADOR' ||
              (deviceType === '3F_MEDIDOR' && deviceProfile === 'ELEVADOR') ||
              deviceType === 'ESCADA_ROLANTE' ||
              (deviceType === '3F_MEDIDOR' && deviceProfile === 'ESCADA_ROLANTE') ||
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
            break;
        }

        cb.checked = shouldCheck;
      });

      // Count how many checkboxes are now checked
      const checkedCount = Array.from(checkboxes).filter((cb) => cb.checked).length;
      LogHelper.log(
        `[EQUIPMENTS] Filter tab selected: ${filterType}, checked: ${checkedCount}/${checkboxes.length}`
      );
    });
  });

  // Bind filter device search inside modal
  const filterDeviceSearch = modal.querySelector('#filterDeviceSearch');
  if (filterDeviceSearch) {
    filterDeviceSearch.addEventListener('input', (e) => {
      const query = (e.target.value || '').trim().toLowerCase();
      const checkItems = modal.querySelectorAll('#deviceChecklist .check-item');

      checkItems.forEach((item) => {
        const label = item.querySelector('label');
        const text = (label?.textContent || '').toLowerCase();
        item.style.display = text.includes(query) ? 'flex' : 'none';
      });
    });
  }

  // Bind clear filter search button
  const filterDeviceClear = modal.querySelector('#filterDeviceClear');
  if (filterDeviceClear && filterDeviceSearch) {
    filterDeviceClear.addEventListener('click', () => {
      filterDeviceSearch.value = '';
      const checkItems = modal.querySelectorAll('#deviceChecklist .check-item');
      checkItems.forEach((item) => (item.style.display = 'flex'));
      filterDeviceSearch.focus();
    });
  }

  LogHelper.log('[EQUIPMENTS] [RFC-0072] Modal handlers bound (close, apply, reset, filter tabs, search)');
}

/**
 * RFC-0072: Open filter modal with full-screen support and ESC key handling
 * Following MENU widget pattern: modal attached to document.body
 */
function openFilterModal() {
  // DEBUG: Always log to console (not LogHelper which may be disabled)
  LogHelper.log('[EQUIPMENTS] [RFC-0072] 🔍 Opening filter modal...');
  LogHelper.log('[EQUIPMENTS] [RFC-0072] STATE.allDevices:', STATE.allDevices);
  LogHelper.log('[EQUIPMENTS] [RFC-0072] STATE.allDevices.length:', STATE.allDevices?.length || 0);

  if (!STATE.allDevices || STATE.allDevices.length === 0) {
    console.error('[EQUIPMENTS] ❌ No devices in STATE.allDevices! Modal will be empty.');
    LogHelper.log('[EQUIPMENTS] STATE object:', STATE);
    window.alert('Nenhum equipamento encontrado. Por favor, aguarde o carregamento dos dados.');
    return;
  }

  // RFC-0072: Get or create global modal container (like MENU widget)
  let globalContainer = document.getElementById('equipmentsFilterModalGlobal');
  LogHelper.log('[EQUIPMENTS] globalContainer exists:', !!globalContainer);

  if (!globalContainer) {
    // Modal doesn't exist, move it from widget to document.body
    LogHelper.log('[EQUIPMENTS] 🔄 Creating global container, looking for filterModal in widget...');
    const widgetModal = document.getElementById('filterModal');
    LogHelper.log('[EQUIPMENTS] widgetModal found:', !!widgetModal, widgetModal);
    if (widgetModal) {
      // Extract modal from widget and wrap in global container
      globalContainer = document.createElement('div');
      globalContainer.id = 'equipmentsFilterModalGlobal';

      // RFC-0072: Inject styles inline (like MENU widget) so they work outside widget scope
      globalContainer.innerHTML = `
        <style>
          /* RFC-0072: EQUIPMENTS Filter Modal Styles (injected for document.body scope) */
          #equipmentsFilterModalGlobal .equip-modal {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            backdrop-filter: blur(4px);
            animation: fadeIn 0.2s ease-in;
          }

          #equipmentsFilterModalGlobal .equip-modal.hidden {
            display: none;
          }

          #equipmentsFilterModalGlobal .equip-modal-card {
            background: #fff;
            border-radius: 0;
            width: 100%;
            height: 100%;
            max-width: 100%;
            max-height: 100%;
            display: flex;
            flex-direction: column;
            box-shadow: none;
            overflow: hidden;
          }

          @media (min-width: 768px) {
            #equipmentsFilterModalGlobal .equip-modal-card {
              border-radius: 16px;
              width: 90%;
              max-width: 1125px; /* 900px + 25% = 1125px */
              height: auto;
              max-height: 90vh;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
          }

          #equipmentsFilterModalGlobal .equip-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid #DDE7F1;
          }

          #equipmentsFilterModalGlobal .equip-modal-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #1C2743;
          }

          #equipmentsFilterModalGlobal .equip-modal-body {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          #equipmentsFilterModalGlobal .equip-modal-footer {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            padding: 16px 20px;
            border-top: 1px solid #DDE7F1;
          }

          #equipmentsFilterModalGlobal .filter-block {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          #equipmentsFilterModalGlobal .block-label {
            font-size: 14px;
            font-weight: 600;
            color: #1C2743;
          }

          /* RFC: Filter tabs header with counts */
          #equipmentsFilterModalGlobal .filter-tabs {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid #E6EEF5;
          }

          #equipmentsFilterModalGlobal .filter-tab {
            border: 1px solid #DDE7F1;
            background: #fff;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.3px;
            cursor: pointer;
            transition: all 0.2s;
            color: #6b7a90;
            white-space: nowrap;
          }

          #equipmentsFilterModalGlobal .filter-tab:hover {
            background: #f7fbff;
            border-color: #2563eb;
            color: #1C2743;
          }

          #equipmentsFilterModalGlobal .filter-tab.active {
            background: #2563eb;
            border-color: #2563eb;
            color: #fff;
          }

          #equipmentsFilterModalGlobal .filter-tab span {
            font-weight: 700;
          }

          #equipmentsFilterModalGlobal .inline-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          #equipmentsFilterModalGlobal .tiny-btn {
            border: 1px solid #DDE7F1;
            background: #fff;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          #equipmentsFilterModalGlobal .tiny-btn:hover {
            background: #f8f9fa;
            border-color: #1f6fb5;
          }

          #equipmentsFilterModalGlobal .filter-search {
            position: relative;
            display: flex;
            align-items: center;
            margin-bottom: 12px;
          }

          #equipmentsFilterModalGlobal .filter-search svg {
            position: absolute;
            left: 12px;
            width: 18px;
            height: 18px;
            fill: #6b7a90;
          }

          #equipmentsFilterModalGlobal .filter-search input {
            width: 100%;
            padding: 10px 12px 10px 40px;
            border: 2px solid #DDE7F1;
            border-radius: 10px;
            font-size: 14px;
            outline: none;
          }

          #equipmentsFilterModalGlobal .filter-search input:focus {
            border-color: #1f6fb5;
          }

          #equipmentsFilterModalGlobal .filter-search .clear-x {
            position: absolute;
            right: 12px;
            border: 0;
            background: transparent;
            cursor: pointer;
            padding: 4px;
          }

          #equipmentsFilterModalGlobal .checklist {
            min-height: 150px;
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #DDE7F1;
            border-radius: 10px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          #equipmentsFilterModalGlobal .check-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 6px;
            transition: background 0.2s;
          }

          #equipmentsFilterModalGlobal .check-item:hover {
            background: #f8f9fa;
          }

          #equipmentsFilterModalGlobal .check-item input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          #equipmentsFilterModalGlobal .check-item label {
            flex: 1;
            cursor: pointer;
            font-size: 14px;
            color: #1C2743;
          }

          #equipmentsFilterModalGlobal .radio-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          #equipmentsFilterModalGlobal .radio-grid label {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px;
            border: 1px solid #DDE7F1;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
          }

          #equipmentsFilterModalGlobal .radio-grid label:hover {
            background: #f8f9fa;
            border-color: #1f6fb5;
          }

          #equipmentsFilterModalGlobal .radio-grid input[type="radio"] {
            width: 16px;
            height: 16px;
            cursor: pointer;
          }

          #equipmentsFilterModalGlobal .muted {
            font-size: 12px;
            color: #6b7a90;
            margin-top: 4px;
          }

          #equipmentsFilterModalGlobal .btn {
            padding: 10px 16px;
            border: 1px solid #DDE7F1;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          #equipmentsFilterModalGlobal .btn:hover {
            background: #f8f9fa;
          }

          #equipmentsFilterModalGlobal .btn.primary {
            background: #1f6fb5;
            color: #fff;
            border-color: #1f6fb5;
          }

          #equipmentsFilterModalGlobal .btn.primary:hover {
            background: #1a5a8f;
            border-color: #1a5a8f;
          }

          #equipmentsFilterModalGlobal .icon-btn {
            border: 0;
            background: transparent;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: background 0.2s;
          }

          #equipmentsFilterModalGlobal .icon-btn:hover {
            background: #f0f0f0;
          }

          #equipmentsFilterModalGlobal .icon-btn svg {
            width: 18px;
            height: 18px;
            fill: #1C2743;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          body.modal-open {
            overflow: hidden !important;
          }
        </style>
      `;

      // Move modal content to global container (after styles)
      LogHelper.log('[EQUIPMENTS] 📦 Moving widgetModal to globalContainer...');
      widgetModal.remove();
      globalContainer.appendChild(widgetModal);

      // Attach to document.body (like MENU widget)
      document.body.appendChild(globalContainer);
      LogHelper.log('[EQUIPMENTS] ✅ Global container attached to document.body');

      // RFC-0072: Bind close handlers now that modal is in document.body
      setupModalCloseHandlers(widgetModal);

      LogHelper.log('[EQUIPMENTS] [RFC-0072] Modal moved to document.body with inline styles and handlers');
    } else {
      console.error('[EQUIPMENTS] [RFC-0072] ❌ Filter modal not found in template!');
      return;
    }
  }

  const modal = globalContainer.querySelector('#filterModal');
  LogHelper.log('[EQUIPMENTS] modal from globalContainer:', !!modal, modal);
  if (!modal) {
    console.error('[EQUIPMENTS] ❌ modal not found in globalContainer!');
    return;
  }

  modal.classList.remove('hidden');
  LogHelper.log('[EQUIPMENTS] ✅ Modal visible (hidden class removed)');

  // RFC-0072: Add body class to prevent scrolling
  document.body.classList.add('modal-open');

  // RFC: Calculate counts for filter tabs
  const counts = {
    all: STATE.allDevices.length,
    online: 0,
    offline: 0,
    normal: 0,
    standby: 0,
    alert: 0,
    failure: 0,
    withConsumption: 0,
    noConsumption: 0,
    elevators: 0,
    escalators: 0,
    hvac: 0,
    others: 0,
  };

  STATE.allDevices.forEach((device) => {
    const consumption = Number(device.val) || Number(device.lastValue) || 0;
    const deviceType = (device.deviceType || '').toUpperCase();
    const deviceProfile = (device.deviceProfile || '').toUpperCase();
    const identifier = (device.deviceIdentifier || '').toUpperCase();
    const labelOrName = (device.labelOrName || '').toUpperCase();

    // Count online/offline status
    // Note: connectionStatus may not be available from API, using consumption as proxy
    // Devices with consumption > 0 are considered "online" (actively reporting)
    const hasConsumption = consumption > 0;

    if (hasConsumption) {
      counts.online++;
    } else {
      counts.offline++;
    }

    // Count by deviceStatus (Normal, Stand By, Alerta, Falha)
    const deviceStatus = (device.deviceStatus || '').toLowerCase();
    if (deviceStatus === 'power_on' || deviceStatus === 'normal') {
      counts.normal++;
    } else if (deviceStatus === 'standby') {
      counts.standby++;
    } else if (deviceStatus === 'warning' || deviceStatus === 'alert' || deviceStatus === 'maintenance') {
      counts.alert++;
    } else if (deviceStatus === 'failure' || deviceStatus === 'power_off') {
      counts.failure++;
    }

    // Count consumption status
    if (consumption > 0) {
      counts.withConsumption++;
    } else {
      counts.noConsumption++;
    }

    // RFC: Check if device has CAG in identifier or labelOrName (climatização)
    const hasCAG = identifier.includes('CAG') || labelOrName.includes('CAG');

    // Count by type (using same classification logic as the rest of the widget)
    if (deviceType === 'ELEVADOR' || (deviceType === '3F_MEDIDOR' && deviceProfile === 'ELEVADOR')) {
      counts.elevators++;
    } else if (
      deviceType === 'ESCADA_ROLANTE' ||
      (deviceType === '3F_MEDIDOR' && deviceProfile === 'ESCADA_ROLANTE')
    ) {
      counts.escalators++;
    } else if (
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
    ) {
      counts.hvac++;
    } else {
      counts.others++;
    }
  });

  // Update count displays
  const updateCount = (id, value) => {
    const el = modal.querySelector(`#${id}`);
    if (el) el.innerHTML = value;
  };

  updateCount('countAll', counts.all);
  updateCount('countOnline', counts.online);
  updateCount('countOffline', counts.offline);
  updateCount('countNormal', counts.normal);
  updateCount('countStandby', counts.standby);
  updateCount('countAlert', counts.alert);
  updateCount('countFailure', counts.failure);
  updateCount('countWithConsumption', counts.withConsumption);
  updateCount('countNoConsumption', counts.noConsumption);
  updateCount('countElevators', counts.elevators);
  updateCount('countEscalators', counts.escalators);
  updateCount('countHvac', counts.hvac);
  updateCount('countOthers', counts.others);

  LogHelper.log('[EQUIPMENTS] 📊 Filter counts:', counts);

  // Debug: Log sample device to check connectionStatus field
  if (STATE.allDevices.length > 0) {
    LogHelper.log('[EQUIPMENTS] 📄 Sample device for debugging:', STATE.allDevices[0]);
  }

  // Populate device checklist - need to find it within the global container
  LogHelper.log('[EQUIPMENTS] 🔍 Looking for deviceChecklist in globalContainer...');
  let checklist = globalContainer.querySelector('#deviceChecklist');
  LogHelper.log('[EQUIPMENTS] checklist from globalContainer:', checklist);

  if (!checklist) {
    // Fallback to document search
    LogHelper.log('[EQUIPMENTS] ⚠️ Not found in globalContainer, trying document.getElementById...');
    checklist = document.getElementById('deviceChecklist');
    LogHelper.log('[EQUIPMENTS] checklist from document:', checklist);
  }
  if (!checklist) {
    console.error('[EQUIPMENTS] ❌ deviceChecklist element not found anywhere!');
    return;
  }

  LogHelper.log('[EQUIPMENTS] ✅ deviceChecklist found, populating with', STATE.allDevices.length, 'devices');

  checklist.innerHTML = '';

  // Sort devices alphabetically by label
  const sortedDevices = STATE.allDevices
    .slice()
    .sort((a, b) =>
      (a.labelOrName || '').localeCompare(b.labelOrName || '', 'pt-BR', { sensitivity: 'base' })
    );

  LogHelper.log('[EQUIPMENTS] 📋 Sorted devices count:', sortedDevices.length);

  sortedDevices.forEach((device, index) => {
    const isChecked = !STATE.selectedIds || STATE.selectedIds.has(device.entityId);

    // Get shopping name and consumption value
    const shoppingName = device.customerName || getCustomerNameForDevice(device);
    const consumption = Number(device.val) || Number(device.lastValue) || 0;
    const formattedConsumption = MyIOLibrary?.formatEnergy
      ? MyIOLibrary.formatEnergy(consumption)
      : consumption.toFixed(2);

    // Debug first 3 devices
    if (index < 3) {
      LogHelper.log(`[EQUIPMENTS] Device ${index + 1}:`, {
        entityId: device.entityId,
        labelOrName: device.labelOrName,
        consumption,
        formattedConsumption,
        shoppingName,
      });
    }

    const item = document.createElement('div');
    item.className = 'check-item';
    item.innerHTML = `
      <input type="checkbox" id="check-${device.entityId}" ${isChecked ? 'checked' : ''} data-device-id="${
      device.entityId
    }">
      <label for="check-${device.entityId}" style="flex: 1;">${
      device.labelOrName || device.deviceIdentifier || device.entityId
    }</label>
      <span style="color: #64748b; font-size: 11px; margin-right: 8px;">${shoppingName}</span>
      <span style="color: ${
        consumption > 0 ? '#16a34a' : '#94a3b8'
      }; font-size: 11px; font-weight: 600; min-width: 70px; text-align: right;">${formattedConsumption}</span>
    `;

    checklist.appendChild(item);
  });

  LogHelper.log('[EQUIPMENTS] ✅ Checklist populated. Total items:', checklist.children.length);

  // Set current sort mode
  const sortRadios = modal.querySelectorAll('input[name="sortMode"]');
  sortRadios.forEach((radio) => {
    radio.checked = radio.value === STATE.sortMode;
  });

  // RFC-0072: Add ESC key handler
  if (!modal._escHandler) {
    modal._escHandler = (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeFilterModal();
      }
    };
    document.addEventListener('keydown', modal._escHandler);
  }
}

/**
 * RFC-0072: Close filter modal and cleanup
 */
function closeFilterModal() {
  // RFC-0072: Modal is now in document.body, not in widget
  const globalContainer = document.getElementById('equipmentsFilterModalGlobal');
  if (!globalContainer) return;

  const modal = globalContainer.querySelector('#filterModal');
  if (!modal) return;

  LogHelper.log('[EQUIPMENTS] [RFC-0072] Closing filter modal');

  modal.classList.add('hidden');

  // RFC-0072: Remove body class to restore scrolling
  document.body.classList.remove('modal-open');

  // RFC-0072: Remove ESC handler
  if (modal._escHandler) {
    document.removeEventListener('keydown', modal._escHandler);
    modal._escHandler = null;
  }
}

/**
 * Bind all filter-related events
 */
function bindFilterEvents() {
  // Search button toggle
  const btnSearch = document.getElementById('btnSearch');
  const searchWrap = document.getElementById('searchWrap');
  const searchInput = document.getElementById('equipSearch');

  if (btnSearch && searchWrap && searchInput) {
    btnSearch.addEventListener('click', () => {
      STATE.searchActive = !STATE.searchActive;
      searchWrap.classList.toggle('active', STATE.searchActive);
      if (STATE.searchActive) {
        setTimeout(() => searchInput.focus(), 100);
      }
    });

    searchInput.addEventListener('input', (e) => {
      STATE.searchTerm = e.target.value || '';
      reflowCards();
    });
  }

  // Filter button (opens modal which will be moved to document.body on first open)
  const btnFilter = document.getElementById('btnFilter');
  if (btnFilter) {
    btnFilter.addEventListener('click', openFilterModal);
  }

  // RFC-0072: All filter-related handlers (filter tabs, search, apply, reset)
  // are now set up in setupModalCloseHandlers() when modal is moved to document.body
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

  // RFC-0072: Cleanup filter modal ESC handler
  const globalContainer = document.getElementById('equipmentsFilterModalGlobal');
  if (globalContainer) {
    const modal = globalContainer.querySelector('#filterModal');
    if (modal && modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
      modal._escHandler = null;
    }

    // RFC-0072: Remove global modal container from document.body
    globalContainer.remove();
    LogHelper.log('[EQUIPMENTS] [RFC-0072] Global modal container removed on destroy');
  }

  // RFC-0072: Remove modal-open class if widget is destroyed with modal open
  document.body.classList.remove('modal-open');
};
