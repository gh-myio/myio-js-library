/* global self, window, document, localStorage, MyIOLibrary */

/**
 * RFC-0092: TEMPERATURE_SENSORS Widget Controller
 *
 * Displays temperature sensor cards in an EQUIPMENTS-style grid layout.
 * Fetches sensor data from ThingsBoard API and supports shopping filter synchronization.
 */

// ============================================
// SHARED UTILITIES (from MAIN via window.MyIOUtils)
// ============================================
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

const getDataApiHost = () => {
  const host = window.MyIOUtils?.DATA_API_HOST;
  if (!host) {
    console.error('[TEMPERATURE_SENSORS] DATA_API_HOST not available - MAIN widget not loaded');
  }
  return host || '';
};

const formatRelativeTime =
  window.MyIOUtils?.formatRelativeTime || ((ts) => (ts ? new Date(ts).toLocaleString() : '—'));

const getCustomerNameForDevice =
  window.MyIOUtils?.getCustomerNameForDevice ||
  ((device) => device.customerName || device.customerId || 'N/A');

// ============================================
// TEMPERATURE_SENSORS WIDGET STATE
// ============================================
const STATE = {
  allSensors: [],
  searchActive: false,
  searchTerm: '',
  selectedIds: null,
  sortMode: 'temp_desc',
  selectedShoppingIds: [],
  totalShoppings: 0,
  isLoading: true,
};

let myIOAuth = null;
let CLIENT_ID = '';
let CLIENT_SECRET = '';

LogHelper.log('[TEMPERATURE_SENSORS] Script loaded, using shared utilities:', !!window.MyIOUtils);

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatTemperature(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `${Number(value).toFixed(1)}°C`;
}

function getTemperatureStatus(temp, min = 18, max = 26) {
  if (temp === null || temp === undefined || isNaN(temp)) return 'no_info';
  if (temp < min) return 'cold';
  if (temp > max) return 'hot';
  return 'normal';
}

function getStatusLabel(status) {
  const labels = {
    normal: 'Normal',
    cold: 'Frio',
    hot: 'Quente',
    no_info: 'Sem Dados',
    offline: 'Offline',
  };
  return labels[status] || status;
}

function showLoadingOverlay(show) {
  const overlay = document.getElementById('temperature-sensors-loading-overlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

// ============================================
// CARD RENDERING
// ============================================

function initializeSensorCards(sensors) {
  const grid = document.getElementById('temp-sensors-grid');
  if (!grid) {
    LogHelper.error('[TEMPERATURE_SENSORS] Grid element not found');
    return;
  }

  grid.innerHTML = '';

  if (sensors.length === 0) {
    grid.innerHTML = `
      <div class="temp-sensors-empty">
        <div class="empty-icon">🌡️</div>
        <div class="empty-text">Nenhum sensor de temperatura encontrado</div>
      </div>
    `;
    return;
  }

  sensors.forEach((sensor) => {
    const container = document.createElement('div');
    grid.appendChild(container);

    // Verifica se a biblioteca existe
    if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.renderCardComponentHeadOffice) {
      // --- LÓGICA DE STATUS CORRIGIDA ---
      // 1. Define constantes que a biblioteca ENTENDE (running/no_info)
      const STATUS_ONLINE = window.MyIOLibrary?.DeviceStatusType?.POWER_ON || 'running';
      const STATUS_OFFLINE = window.MyIOLibrary?.DeviceStatusType?.NO_INFO || 'no_info';

      // 2. Se tem temperatura válida, forçamos o status para ONLINE (Verde)
      // Isso evita mandar 'normal'/'hot' que a lib não reconhece e joga para Offline
      const visualStatus =
        sensor.temperature !== null && sensor.temperature !== undefined ? STATUS_ONLINE : STATUS_OFFLINE;

      const entityObject = {
        entityId: sensor.id,
        labelOrName: sensor.label || sensor.name,
        deviceIdentifier: sensor.identifier || 'TEMP-SENSOR',

        // Dados de valor
        val: sensor.temperature,
        valType: 'temperature',
        deviceType: 'TEMPERATURE_SENSOR',
        temperatureC: sensor.temperature,

        // Dados de Cliente
        customerName: sensor.customerName,
        customerId: sensor.customerId,
        updated: formatRelativeTime(sensor.lastUpdate),
        domain: 'temperature',

        // --- CORREÇÃO DO WATCHDOG ---
        // Informa que a última conexão foi agora (data da leitura)
        lastConnectTime: sensor.lastUpdate,

        // --- CORREÇÃO VISUAL ---
        // Aqui usamos o status 'traduzido' (running) em vez de sensor.status (normal)
        deviceStatus: visualStatus,
      };

      MyIOLibrary.renderCardComponentHeadOffice(container, {
        entityObject: entityObject,
        debugActive: true,
        activeTooltipDebug: true,
        delayTimeConnectionInMins: window.MyIOUtils?.getDelayTimeConnectionInMins?.() ?? 60,
        handleActionDashboard: async () => {
          openTemperatureModal(sensor);
        },
        handleActionSettings: async () => {
          // TODO: Implement settings
        },
        handleSelect: (checked, entity) => {
          const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
          if (MyIOSelectionStore) {
            if (checked) {
              if (MyIOSelectionStore.registerEntity) {
                MyIOSelectionStore.registerEntity(entity);
              }
              MyIOSelectionStore.add(entity.entityId || entity.id);
            } else {
              MyIOSelectionStore.remove(entity.entityId || entity.id);
            }
          }
        },
        handleClickCard: (ev, entity) => {
          LogHelper.log(`[TEMPERATURE_SENSORS] Card clicked: ${entity.labelOrName}`);
        },
        useNewComponents: true,
        enableSelection: true,
        hideInfoMenuItem: true,
      });
    } else {
      // Fallback para card customizado
      renderCustomSensorCard(container, sensor);
    }
  });

  LogHelper.log('[TEMPERATURE_SENSORS] Rendered', sensors.length, 'sensor cards');
}

function renderCustomSensorCard(container, sensor) {
  const statusClass = `status-${sensor.status}`;
  const statusLabel = getStatusLabel(sensor.status);

  container.innerHTML = `
    <div class="temp-sensor-card ${statusClass}">
      <div class="temp-sensor-header">
        <div class="temp-sensor-icon">🌡️</div>
        <div class="temp-sensor-info">
          <div class="temp-sensor-name">${sensor.label || sensor.name}</div>
          <div class="temp-sensor-location">${sensor.customerName || 'N/A'}</div>
        </div>
        <button class="temp-sensor-menu" title="Opções">⋮</button>
      </div>
      <div class="temp-sensor-value">
        <span class="temp-value">${formatTemperature(sensor.temperature)}</span>
      </div>
      <div class="temp-sensor-status">
        <span class="status-chip ${statusClass}">
          <span class="status-dot"></span>
          ${statusLabel}
        </span>
      </div>
      <div class="temp-sensor-footer">
        <span class="temp-sensor-updated">Atualizado: ${formatRelativeTime(sensor.lastUpdate)}</span>
      </div>
    </div>
  `;

  // Add click handler
  container.querySelector('.temp-sensor-card').addEventListener('click', () => {
    openTemperatureModal(sensor);
  });
}

async function openTemperatureModal(sensor) {
  if (typeof MyIOLibrary !== 'undefined' && MyIOLibrary.openTemperatureComparisonModal) {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      LogHelper.error('[TEMPERATURE_SENSORS] JWT token not found');
      return;
    }

    try {
      // Get date range from global state or use defaults
      const dateRange = window.myioDateRange || {};
      const now = new Date();
      const startDate = dateRange.startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = dateRange.endDate || now.toISOString();

      await MyIOLibrary.openTemperatureComparisonModal({
        token: token,
        devices: [
          {
            id: sensor.tbId || sensor.id,
            label: sensor.label || sensor.name,
            customerName: sensor.customerName,
            temperatureMin: sensor.temperatureMin || 18,
            temperatureMax: sensor.temperatureMax || 26,
          },
        ],
        startDate: startDate,
        endDate: endDate,
        locale: 'pt-BR',
        theme: 'dark',
        onClose: () => {
          LogHelper.log('[TEMPERATURE_SENSORS] Temperature modal closed');
        },
      });
    } catch (error) {
      LogHelper.error('[TEMPERATURE_SENSORS] Error opening temperature modal:', error);
    }
  } else {
    LogHelper.warn('[TEMPERATURE_SENSORS] openTemperatureComparisonModal not available');
    window.alert('Modal de temperatura não disponível');
  }
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchTemperatureSensors() {
  LogHelper.log('[TEMPERATURE_SENSORS] Fetching temperature sensors...');
  STATE.isLoading = true;
  showLoadingOverlay(true);

  try {
    const sensors = [];

    // Method 1: Try to get sensors from ctx.data (ThingsBoard datasources)
    if (self.ctx && self.ctx.data) {
      self.ctx.data.forEach((data) => {
        // Ignora dados do Alias "Shopping" se houver
        if (data.datasource && data.datasource.aliasName !== 'Shopping') {
          const entityId = data.datasource.entity?.id?.id;

          if (entityId) {
            // 1. Tenta encontrar o sensor já criado na lista
            let existingSensor = sensors.find((s) => s.id === entityId);

            // 2. Se não existir, cria o esqueleto inicial e adiciona ao array
            if (!existingSensor) {
              existingSensor = {
                id: entityId,
                tbId: entityId,
                name: data.datasource.name,
                label: data.datasource.entityLabel || data.datasource.name,
                temperature: null,
                lastUpdate: null,
                customerId: data.datasource.customerId || null,
                customerName: 'N/A', // Inicializa com N/A
                status: 'no_info',
                temperatureMin: 18,
                temperatureMax: 26,
              };
              sensors.push(existingSensor);
            }

            // 3. Verifica qual é a chave de dados atual e atualiza o campo correspondente
            const keyName = data.dataKey?.name;
            const value = data.data?.[0]?.[1];
            const ts = data.data?.[0]?.[0];

            if (keyName === 'temperature') {
              existingSensor.temperature = value || existingSensor.temperature;
              existingSensor.lastUpdate = ts || existingSensor.lastUpdate;
              existingSensor.status = getTemperatureStatus(existingSensor.temperature);
            } else if (keyName === 'ownerName') {
              // [CORREÇÃO] Agora o código consegue entrar aqui
              if (value) {
                existingSensor.customerName = value;
              }
            }
          }
        }
      });
    }

    // Method 2: If no sensors from ctx.data, try API fetch
    if (sensors.length === 0) {
      LogHelper.log('[TEMPERATURE_SENSORS] No sensors in ctx.data, trying API...');
      const apiSensors = await fetchSensorsFromAPI();
      sensors.push(...apiSensors);
    }

    STATE.allSensors = sensors;
    LogHelper.log('[TEMPERATURE_SENSORS] Loaded', sensors.length, 'sensors');

    return sensors;
  } catch (error) {
    LogHelper.error('[TEMPERATURE_SENSORS] Error fetching sensors:', error);
    return [];
  } finally {
    STATE.isLoading = false;
    showLoadingOverlay(false);
  }
}

async function fetchSensorsFromAPI() {
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    LogHelper.warn('[TEMPERATURE_SENSORS] No JWT token for API fetch');
    return [];
  }

  try {
    // Busca dispositivos do tipo TEMPERATURE_SENSOR
    const response = await fetch('/api/tenant/devices?pageSize=1000&page=0&type=TEMPERATURE_SENSOR', {
      headers: {
        'X-Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const devices = result.data || [];

    // Busca última telemetria para cada dispositivo e aplica o "Enrich"
    const sensors = await Promise.all(
      devices.map(async (device) => {
        try {
          const telemetryResponse = await fetch(
            `/api/plugins/telemetry/DEVICE/${device.id.id}/values/timeseries?keys=temperature`,
            {
              headers: {
                'X-Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          let temperature = null;
          let lastUpdate = null;

          if (telemetryResponse.ok) {
            const telemetry = await telemetryResponse.json();
            if (telemetry.temperature && telemetry.temperature.length > 0) {
              temperature = telemetry.temperature[0].value;
              lastUpdate = telemetry.temperature[0].ts;
            }
          }

          // =========================================================================
          // [FIX] LÓGICA TIPO "enrichItemsWithTotals"
          // Garante recuperação robusta de customerId e customerName
          // =========================================================================

          // 1. Tenta pegar o ID de várias fontes possíveis (fallback)
          const finalCustomerId = device.customerId?.id || device.customer_id || null;

          // 2. Tenta pegar o Nome de várias fontes possíveis (o TB retorna como customerTitle ou name)
          const finalCustomerName =
            device.customerTitle || device.customerName || device.customer_name || 'N/A';

          return {
            id: device.id.id,
            tbId: device.id.id,
            name: device.name,
            label: device.label || device.name,
            temperature: temperature,
            lastUpdate: lastUpdate,

            // [FIX] Usa os valores "enriquecidos"
            customerId: finalCustomerId,
            customerName: finalCustomerName,

            status: getTemperatureStatus(temperature),
            temperatureMin: 18,
            temperatureMax: 26,
          };
        } catch (err) {
          LogHelper.warn('[TEMPERATURE_SENSORS] Error fetching telemetry for device:', device.id.id, err);

          // [FIX] Mesmo no erro, tentamos garantir os dados do cliente
          const finalCustomerId = device.customerId?.id || null;
          const finalCustomerName = device.customerTitle || 'N/A';

          return {
            id: device.id.id,
            tbId: device.id.id,
            name: device.name,
            label: device.label || device.name,
            temperature: null,
            lastUpdate: null,
            customerId: finalCustomerId,
            customerName: finalCustomerName,
            status: 'no_info',
            temperatureMin: 18,
            temperatureMax: 26,
          };
        }
      })
    );

    return sensors;
  } catch (error) {
    LogHelper.error('[TEMPERATURE_SENSORS] API fetch error:', error);
    return [];
  }
}

// ============================================
// FILTERING & SORTING
// ============================================

function applyFilters(sensors, searchTerm, selectedIds, sortMode) {
  let filtered = sensors.slice();

  // Apply shopping filter
  if (STATE.selectedShoppingIds && STATE.selectedShoppingIds.length > 0) {
    filtered = filtered.filter((s) => {
      if (!s.customerId) return true;
      return STATE.selectedShoppingIds.includes(s.customerId);
    });
  }

  // Apply multiselect filter
  if (selectedIds && selectedIds.size > 0) {
    filtered = filtered.filter((s) => selectedIds.has(s.id));
  }

  // Apply search filter
  const query = (searchTerm || '').trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(
      (s) =>
        String(s.label || '')
          .toLowerCase()
          .includes(query) ||
        String(s.name || '')
          .toLowerCase()
          .includes(query) ||
        String(s.customerName || '')
          .toLowerCase()
          .includes(query)
    );
  }

  // Apply sorting
  filtered.sort((a, b) => {
    const tempA = Number(a.temperature) || 0;
    const tempB = Number(b.temperature) || 0;
    const nameA = String(a.label || a.name || '').toLowerCase();
    const nameB = String(b.label || b.name || '').toLowerCase();

    switch (sortMode) {
      case 'temp_desc':
        return tempB !== tempA ? tempB - tempA : nameA.localeCompare(nameB);
      case 'temp_asc':
        return tempA !== tempB ? tempA - tempB : nameA.localeCompare(nameB);
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

function reflowCards() {
  const filtered = applyFilters(STATE.allSensors, STATE.searchTerm, STATE.selectedIds, STATE.sortMode);

  LogHelper.log('[TEMPERATURE_SENSORS] Reflow with filters:', {
    total: STATE.allSensors.length,
    filtered: filtered.length,
    searchTerm: STATE.searchTerm,
    sortMode: STATE.sortMode,
  });

  initializeSensorCards(filtered);
  updateSensorStats(filtered);
}

function updateSensorStats(sensors) {
  const statsTotal = document.getElementById('tempSensorsStatsTotal');
  const statsAvg = document.getElementById('tempSensorsStatsAvg');
  const statsOnline = document.getElementById('tempSensorsStatsOnline');
  const statsAlert = document.getElementById('tempSensorsStatsAlert');

  if (statsTotal) statsTotal.textContent = sensors.length;

  // Calculate average temperature
  const validTemps = sensors.filter((s) => s.temperature !== null && !isNaN(s.temperature));
  const avgTemp =
    validTemps.length > 0
      ? validTemps.reduce((sum, s) => sum + Number(s.temperature), 0) / validTemps.length
      : 0;

  if (statsAvg) statsAvg.textContent = formatTemperature(avgTemp);

  // Count online sensors (with recent data)
  const onlineCount = sensors.filter((s) => s.status !== 'no_info' && s.status !== 'offline').length;
  if (statsOnline) statsOnline.textContent = onlineCount;

  // Count alert sensors (hot or cold)
  const alertCount = sensors.filter((s) => s.status === 'hot' || s.status === 'cold').length;
  if (statsAlert) statsAlert.textContent = alertCount;
}

// ============================================
// EVENT HANDLERS
// ============================================

// RFC-0096: Filter modal instance (lazy initialized)
let temperatureFilterModal = null;

/**
 * RFC-0096: Initialize filter modal using shared factory from MAIN
 */
function initFilterModal() {
  const createFilterModal = window.MyIOUtils?.createFilterModal;

  if (!createFilterModal) {
    LogHelper.error('[TEMPERATURE_SENSORS] createFilterModal not available from MAIN');
    return null;
  }

  return createFilterModal({
    widgetName: 'TEMPERATURE_SENSORS',
    containerId: 'temperatureSensorsFilterModalGlobal',
    modalClass: 'temperature-sensors-modal',
    primaryColor: '#e65100', // Orange for temperature
    itemIdAttr: 'data-entity',

    // Filter tabs configuration - specific for TEMPERATURE_SENSORS
    filterTabs: [
      {
        id: 'all',
        label: 'Todos',
        filter: () => true,
      },
      {
        id: 'online',
        label: 'Online',
        filter: (s) => s.status !== 'no_info' && s.status !== 'offline',
      },
      {
        id: 'offline',
        label: 'Offline',
        filter: (s) => s.status === 'no_info' || s.status === 'offline',
      },
      {
        id: 'normal',
        label: 'Normal',
        filter: (s) => s.status === 'normal',
      },
      {
        id: 'alert',
        label: 'Alerta',
        filter: (s) => s.status === 'hot' || s.status === 'cold',
      },
    ],

    // Data accessors
    getItemId: (item) => item.id,
    getItemLabel: (item) => item.label || item.name || item.id,
    getItemValue: (item) => item.temperature,
    getItemSubLabel: (item) => getCustomerNameForDevice(item),
    formatValue: (val) => formatTemperature(val),

    // Callbacks
    onApply: ({ selectedIds, sortMode }) => {
      STATE.selectedIds = selectedIds;
      STATE.sortMode = sortMode;
      reflowCards();
      LogHelper.log('[TEMPERATURE_SENSORS] [RFC-0096] Filters applied via shared modal');
    },

    onReset: () => {
      STATE.selectedIds = null;
      STATE.sortMode = 'temp_desc';
      STATE.searchTerm = '';
      STATE.searchActive = false;

      // Reset search UI
      const searchWrap = document.getElementById('tempSearchWrap');
      const searchInput = document.getElementById('tempSensorSearch');
      if (searchWrap) searchWrap.classList.remove('active');
      if (searchInput) searchInput.value = '';

      reflowCards();
      LogHelper.log('[TEMPERATURE_SENSORS] [RFC-0096] Filters reset via shared modal');
    },

    onClose: () => {
      LogHelper.log('[TEMPERATURE_SENSORS] [RFC-0096] Filter modal closed');
    },
  });
}

/**
 * RFC-0096: Open filter modal
 */
function openFilterModal() {
  // Lazy initialize modal
  if (!temperatureFilterModal) {
    temperatureFilterModal = initFilterModal();
  }

  if (!temperatureFilterModal) {
    LogHelper.error('[TEMPERATURE_SENSORS] Failed to initialize filter modal');
    window.alert('Erro ao inicializar modal de filtros. Verifique se o widget MAIN foi carregado.');
    return;
  }

  // Open with current sensors and state
  temperatureFilterModal.open(STATE.allSensors, {
    selectedIds: STATE.selectedIds,
    sortMode: STATE.sortMode,
  });
}

function bindFilterEvents() {
  // Search button toggle
  const btnSearch = document.getElementById('btnTempSearch');
  const searchWrap = document.getElementById('tempSearchWrap');
  const searchInput = document.getElementById('tempSensorSearch');

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

  // Filter button - RFC-0096: Now opens filter modal
  const btnFilter = document.getElementById('btnTempFilter');
  if (btnFilter) {
    btnFilter.addEventListener('click', () => {
      LogHelper.log('[TEMPERATURE_SENSORS] Filter button clicked - opening modal');
      openFilterModal();
    });
  }
}

function renderShoppingFilterChips(selection) {
  const chipsContainer = document.getElementById('tempShoppingFilterChips');
  if (!chipsContainer) return;

  chipsContainer.innerHTML = '';

  if (!selection || selection.length === 0) {
    return;
  }

  selection.forEach((shopping) => {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.innerHTML = `<span class="filter-chip-icon">🏬</span><span>${shopping.name}</span>`;
    chipsContainer.appendChild(chip);
  });

  LogHelper.log('[TEMPERATURE_SENSORS] Rendered', selection.length, 'shopping filter chips');
}

// ============================================
// WIDGET LIFECYCLE
// ============================================

self.onInit = async function () {
  LogHelper.log('[TEMPERATURE_SENSORS] onInit - RFC-0092');
  showLoadingOverlay(true);

  setTimeout(async () => {
    // Wait for date params from parent
    function waitForDateParams({ pollMs = 300, timeoutMs = 10000 } = {}) {
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
            resolve({
              start: s,
              end: e,
              from: 'state/event',
            });
            return true;
          }
          return false;
        };

        const cleanup = () => {
          window.removeEventListener('myio:date-params', onEvt);
          if (poller) clearInterval(poller);
          if (timer) clearTimeout(timer);
        };

        const onEvt = (ev) => tryResolve(ev.detail);
        window.addEventListener('myio:date-params', onEvt);

        if (tryResolve(window.myioStateParams || {})) return;

        poller = setInterval(() => tryResolve(window.myioStateParams || {}), pollMs);

        timer = setTimeout(() => {
          if (!resolved) {
            cleanup();
            const end = new Date();
            const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
            resolve({
              start: start.toISOString(),
              end: end.toISOString(),
              from: 'fallback-7d',
            });
          }
        }, timeoutMs);
      });
    }

    const dateParams = await waitForDateParams();
    LogHelper.log('[TEMPERATURE_SENSORS] Date params ready:', dateParams);

    // Listen for shopping filter events
    self._onFilterApplied = (ev) => {
      LogHelper.log('[TEMPERATURE_SENSORS] heard myio:filter-applied:', ev.detail);

      const selection = ev.detail?.selection || [];
      const shoppingIds = selection.map((s) => s.value).filter((v) => v);

      STATE.selectedShoppingIds = shoppingIds;
      renderShoppingFilterChips(selection);
      reflowCards();
    };
    window.addEventListener('myio:filter-applied', self._onFilterApplied);

    // Listen for customers ready
    self._onCustomersReady = (ev) => {
      LogHelper.log('[TEMPERATURE_SENSORS] heard myio:customers-ready:', ev.detail);
      const customers = ev.detail?.customers || [];
      if (customers.length > 0) {
        STATE.totalShoppings = customers.length;
        renderShoppingFilterChips(customers);
      }
    };
    window.addEventListener('myio:customers-ready', self._onCustomersReady, {
      once: true,
    });

    // Fetch and render sensors
    const sensors = await fetchTemperatureSensors();
    initializeSensorCards(sensors);
    updateSensorStats(sensors);

    // Bind filter events
    bindFilterEvents();

    showLoadingOverlay(false);
  }, 0);
};

self.onDataUpdated = function () {
  /*
    LogHelper.log('[TEMPERATURE_SENSORS] onDataUpdated');
    fetchTemperatureSensors().then((sensors) => {
      STATE.allSensors = sensors;
      reflowCards();
    });
    */
};

self.onDestroy = function () {
  if (self._onFilterApplied) {
    window.removeEventListener('myio:filter-applied', self._onFilterApplied);
  }
  if (self._onCustomersReady) {
    window.removeEventListener('myio:customers-ready', self._onCustomersReady);
  }

  // RFC-0096: Cleanup filter modal
  if (temperatureFilterModal) {
    temperatureFilterModal.destroy();
    temperatureFilterModal = null;
    LogHelper.log('[TEMPERATURE_SENSORS] [RFC-0096] Filter modal destroyed');
  }

  LogHelper.log('[TEMPERATURE_SENSORS] Widget destroyed');
};
