/* global self, ctx */

const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
let CUSTOMER_ID;
let CLIENT_ID;
let CLIENT_SECRET;
let INGESTION_ID;

// RFC-0057: Removed unused utility functions: d(), clamp(), formatNumber(), formatHours(), escapeHtml(), isDanger()

// RFC: Global refresh counter to limit data updates to 3 times maximum
let _dataRefreshCount = 0;
const MAX_DATA_REFRESHES = 1;

// RFC-0071: Device Profile Synchronization
// Global flag to track if sync has been completed
let __deviceProfileSyncComplete = false;

// ============================================
// RFC-0071: DEVICE PROFILE SYNCHRONIZATION
// ============================================

/**
 * Fetches all active device profiles from ThingsBoard
 * @returns {Promise<Map<string, string>>} Map of profileId -> profileName
 */
async function fetchDeviceProfiles() {
  const token = localStorage.getItem("jwt_token");
  if (!token) throw new Error("[RFC-0071] JWT token not found");

  const url = "/api/deviceProfile/names?activeOnly=true";

  console.log("[EQUIPMENTS] [RFC-0071] Fetching device profiles...");

  const response = await fetch(url, {
    headers: {
      "X-Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device profiles: ${response.status}`);
  }

  const profiles = await response.json();

  // Build Map: profileId -> profileName
  const profileMap = new Map();
  profiles.forEach(profile => {
    const profileId = profile.id.id;
    const profileName = profile.name;
    profileMap.set(profileId, profileName);
  });

  console.log(`[EQUIPMENTS] [RFC-0071] Loaded ${profileMap.size} device profiles:`,
    Array.from(profileMap.entries()).map(([id, name]) => name).join(", "));

  return profileMap;
}

/**
 * Fetches device details including deviceProfileId
 * @param {string} deviceId - Device entity ID
 * @returns {Promise<Object>}
 */
async function fetchDeviceDetails(deviceId) {
  const token = localStorage.getItem("jwt_token");
  if (!token) throw new Error("[RFC-0071] JWT token not found");

  const url = `/api/device/${deviceId}`;

  const response = await fetch(url, {
    headers: {
      "X-Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device ${deviceId}: ${response.status}`);
  }

  return await response.json();
}

/**
 * Saves deviceProfile as a server-scope attribute on the device
 * @param {string} deviceId - Device entity ID
 * @param {string} deviceProfile - Profile name (e.g., "MOTOR", "3F_MEDIDOR")
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function addDeviceProfileAttribute(deviceId, deviceProfile) {
  const t = Date.now();

  try {
    if (!deviceId) throw new Error("deviceId is required");
    if (deviceProfile == null || deviceProfile === "") {
      throw new Error("deviceProfile is required");
    }

    const token = localStorage.getItem("jwt_token");
    if (!token) throw new Error("jwt_token not found in localStorage");

    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
    const headers = {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${token}`,
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ deviceProfile }),
    });

    const bodyText = await res.text().catch(() => "");

    if (!res.ok) {
      throw new Error(
        `[RFC-0071] HTTP ${res.status} ${res.statusText} - ${bodyText}`
      );
    }

    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // Response may not be JSON
    }

    const dt = Date.now() - t;
    console.log(
      `[EQUIPMENTS] [RFC-0071] ✅ Saved deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms`
    );

    return { ok: true, status: res.status, data };
  } catch (err) {
    const dt = Date.now() - t;
    console.error(
      `[EQUIPMENTS] [RFC-0071] ❌ Failed to save deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms | error: ${err?.message || err}`
    );
    throw err;
  }
}

/**
 * Main synchronization function
 * Checks all devices and syncs missing deviceProfile attributes
 * @returns {Promise<{synced: number, skipped: number, errors: number}>}
 */
async function syncDeviceProfileAttributes() {
  console.log("[EQUIPMENTS] [RFC-0071] 🔄 Starting device profile synchronization...");

  try {
    // Step 1: Fetch all device profiles
    const profileMap = await fetchDeviceProfiles();

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Step 2: Build a map of devices that need sync
    const deviceMap = new Map();

    self.ctx.data.forEach((data) => {
      const entityId = data.datasource?.entity?.id?.id;
      const existingProfile = data.datasource?.deviceProfile;

      if (!entityId) return;

      // Skip if already has deviceProfile attribute
      if (existingProfile) {
        skipped++;
        return;
      }

      // Store for processing (deduplicate by entityId)
      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, {
          entityLabel: data.datasource?.entityLabel,
          entityName: data.datasource?.entityName,
          name: data.datasource?.name,
        });
      }
    });

    console.log(`[EQUIPMENTS] [RFC-0071] Found ${deviceMap.size} devices without deviceProfile attribute`);
    console.log(`[EQUIPMENTS] [RFC-0071] Skipped ${skipped} devices that already have deviceProfile`);

    if (deviceMap.size === 0) {
      console.log("[EQUIPMENTS] [RFC-0071] ✅ All devices already synchronized!");
      return { synced: 0, skipped, errors: 0 };
    }

    // Step 3: Fetch device details and sync attributes
    let processed = 0;
    for (const [entityId, deviceInfo] of deviceMap) {
      processed++;
      const deviceLabel = deviceInfo.entityLabel || deviceInfo.entityName || deviceInfo.name || entityId;

      try {
        console.log(`[EQUIPMENTS] [RFC-0071] Processing ${processed}/${deviceMap.size}: ${deviceLabel}`);

        // Fetch device details to get deviceProfileId
        const deviceDetails = await fetchDeviceDetails(entityId);
        const deviceProfileId = deviceDetails.deviceProfileId?.id;

        if (!deviceProfileId) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Device ${deviceLabel} has no deviceProfileId`);
          errors++;
          continue;
        }

        // Look up profile name from map
        const profileName = profileMap.get(deviceProfileId);

        if (!profileName) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Profile ID ${deviceProfileId} not found in map`);
          errors++;
          continue;
        }

        // Save attribute
        await addDeviceProfileAttribute(entityId, profileName);
        synced++;

        console.log(`[EQUIPMENTS] [RFC-0071] ✅ Synced ${deviceLabel} -> ${profileName}`);

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[EQUIPMENTS] [RFC-0071] ❌ Failed to sync device ${deviceLabel}:`, error);
        errors++;
      }
    }

    console.log(`[EQUIPMENTS] [RFC-0071] 🎉 Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);

    return { synced, skipped, errors };

  } catch (error) {
    console.error("[EQUIPMENTS] [RFC-0071] ❌ Fatal error during sync:", error);
    throw error;
  }
}

// ============================================
// END RFC-0071
// ============================================

const MyIOAuth = (() => {
  // ==== CONFIG ====
  const AUTH_URL = new URL(`${DATA_API_HOST}/api/v1/auth`);

  // ⚠️ Substitua pelos seus valores:

  // Margem para renovar o token antes de expirar (em segundos)
  const RENEW_SKEW_S = 60; // 1 min
  // Em caso de erro, re-tenta com backoff simples
  const RETRY_BASE_MS = 500;
  const RETRY_MAX_ATTEMPTS = 3;

  // Cache em memória (por aba). Se quiser compartilhar entre widgets/abas,
  // você pode trocar por localStorage (com os devidos cuidados de segurança).
  let _token = null; // string
  let _expiresAt = 0; // epoch em ms
  let _inFlight = null; // Promise em andamento para evitar corridas

  function _now() {
    return Date.now();
  }

  function _aboutToExpire() {
    // true se não temos token ou se falta pouco para expirar
    if (!_token) return true;
    const skewMs = RENEW_SKEW_S * 1000;
    return _now() >= _expiresAt - skewMs;
  }

  async function _sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async function _requestNewToken() {
    const body = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    };

    let attempt = 0;
    while (true) {
      try {
        const resp = await fetch(AUTH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(
            `Auth falhou: HTTP ${resp.status} ${resp.statusText} ${text}`
          );
        }

        const json = await resp.json();
        // Espera formato:
        // { access_token, token_type, expires_in, scope }
        if (!json || !json.access_token || !json.expires_in) {
          throw new Error("Resposta de auth não contem campos esperados.");
        }

        _token = json.access_token;
        // Define expiração absoluta (agora + expires_in)
        _expiresAt = _now() + Number(json.expires_in) * 1000;

        // Logs úteis para depuração (não imprimem o token)
        console.log(
          "[equipaments] [MyIOAuth] Novo token obtido. Expira em ~",
          Math.round(Number(json.expires_in) / 60),
          "min"
        );

        return _token;
      } catch (err) {
        attempt++;
        console.warn(
          `[equipaments] [MyIOAuth] Erro ao obter token (tentativa ${attempt}/${RETRY_MAX_ATTEMPTS}):`,
          err?.message || err
        );
        if (attempt >= RETRY_MAX_ATTEMPTS) {
          throw err;
        }
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await _sleep(backoff);
      }
    }
  }

  async function getToken() {
    // Evita múltiplas chamadas paralelas de renovação
    if (_inFlight) {
      return _inFlight;
    }

    if (_aboutToExpire()) {
      _inFlight = _requestNewToken().finally(() => {
        _inFlight = null;
      });
      return _inFlight;
    }

    return _token;
  }

  function clearCache() {
    _token = null;
    _expiresAt = 0;
    _inFlight = null;
  }

  // RFC-0057: Removed unused getExpiryInfo()

  return {
    getToken,
    clearCache,
  };
})();

async function fetchCustomerServerScopeAttrs(customerTbId) {
  if (!customerTbId) return {};
  const tbToken = localStorage.getItem("jwt_token");
  if (!tbToken)
    throw new Error(
      "JWT do ThingsBoard não encontrado (localStorage.jwt_token)."
    );

  const url = `/api/plugins/telemetry/CUSTOMER/${customerTbId}/values/attributes/SERVER_SCOPE`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Authorization": `Bearer ${tbToken}`,
    },
  });
  if (!res.ok) {
    console.warn(`[equipaments] [customer attrs] HTTP ${res.status}`);
    return {};
  }
  const payload = await res.json();

  // Pode vir como array [{key,value}] OU como objeto { key: [{value}] }
  const map = {};
  if (Array.isArray(payload)) {
    for (const it of payload) map[it.key] = it.value;
  } else if (payload && typeof payload === "object") {
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      if (Array.isArray(v) && v.length) map[k] = v[0]?.value ?? v[0];
    }
  }
  return map;
}

// RFC-0057: Removed unused functions: toSpOffsetNoMs(), getTimeWindowRange()

/**
 * Converte um timestamp em uma string de tempo relativo (ex: "há 5 minutos").
 * @param {number} timestamp - O timestamp em milissegundos.
 * @returns {string} A string formatada.
 */
function formatRelativeTime(timestamp) {
  if (!timestamp || timestamp <= 0) {
    return "—"; // Retorna um traço se não houver timestamp válido
  }

  const now = Date.now();
  const diffSeconds = Math.round((now - timestamp) / 1000);

  if (diffSeconds < 10) {
    return "agora";
  }
  if (diffSeconds < 60) {
    return `há ${diffSeconds}s`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes === 1) {
    return "há 1 min";
  }
  if (diffMinutes < 60) {
    return `há ${diffMinutes} mins`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) {
    return "há 1 hora";
  }
  if (diffHours < 24) {
    return `há ${diffHours} horas`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) {
    return "ontem";
  }
  if (diffDays <= 30) {
    return `há ${diffDays} dias`;
  }

  // Se for mais antigo, mostra a data
  return new Date(timestamp).toLocaleDateString("pt-BR");
}

/**
 * Função MOCK para simular a busca do último valor de temperatura de um dispositivo no ThingsBoard.
 * Ela imita uma chamada de API assíncrona, retornando uma Promise.
 *
 * @param {string} deviceId - O ID do dispositivo que você quer consultar.
 * @returns {Promise<Array<{ts: number, value: number}>>} Uma promise que resolve com um array contendo
 * o dado de telemetria mais recente (timestamp e valor).
 */
async function getDeviceTemperature(deviceId, token) {
  // 1. Validação básica da entrada
  if (!deviceId) {
    return Promise.reject(new Error("O ID do dispositivo não pode ser nulo."));
  }

  // 2. Simula um atraso de rede (entre 300ms e 1000ms)
  const networkDelay = Math.random() * 700 + 300;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 3. Simula uma chance de sucesso
      const isSuccess = true;

      if (isSuccess) {
        // Gera um valor de temperatura aleatório entre 18.0 e 32.0
        const mockTemperature = (Math.random() * 14 + 18).toFixed(2);
        const mockTimestamp = Date.now();

        // 4. Monta a resposta em um formato similar ao da API do ThingsBoard
        // A API geralmente retorna um array de objetos, mesmo para o valor mais recente.
        const responseData = [
          {
            ts: mockTimestamp,
            value: parseFloat(mockTemperature), // A API retorna um número
          },
        ];

        resolve(responseData);
      } else {
        // 5. Simula um erro de API
        const errorMessage = `[MOCK] Erro: Não foi possível encontrar o dispositivo com ID ${deviceId}.`;
        console.error(errorMessage);
        reject(new Error(errorMessage));
      }
    }, networkDelay);
  });
}

// RFC-0057: Removed unused functions: isValidUUID(), updateTotalConsumption(), fetchWithAuth(), latestNumber(), resolveEntityValue(), getKeyByValue()

// Log function
function log(message, type = "info") {
  const logOutput = document.getElementById("log-output");
  const time = new Date().toLocaleTimeString("pt-BR");
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<span class="log-time">${time}</span>${message}`;
}

function formatarDuracao(ms) {
  // 1. Lida com casos de entrada inválida ou zero.
  if (typeof ms !== "number" || ms < 0 || !isFinite(ms)) {
    return "0s";
  }
  if (ms === 0) {
    return "0s";
  }

  // 2. Calcula cada componente da duração.
  const segundos = Math.floor((ms / 1000) % 60);
  const minutos = Math.floor((ms / (1000 * 60)) % 60);
  const horas = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));

  // 3. Monta a string de resultado de forma inteligente.
  const parts = [];
  if (dias > 0) {
    parts.push(`${dias}d`);
    if (horas > 0) {
      parts.push(`${horas}h`);
    }
  } else if (horas > 0) {
    parts.push(`${horas}h`);
    if (minutos > 0) {
      parts.push(`${minutos}m`);
    }
  } else if (minutos > 0) {
    parts.push(`${minutos}m`);
    if (segundos > 0) {
      parts.push(`${segundos}s`);
    }
  } else {
    parts.push(`${segundos}s`);
  }

  // 4. Retorna a string final, ou "0s" se for muito pequena.
  return parts.length > 0 ? parts.join(" ") : "0s";
}

// RFC-0057: Removed unused function: fetchLastConnectTime() (was commented out in usage anyway)

// Show/hide loading overlay
function showLoadingOverlay(show) {
  const overlay = document.getElementById("equipments-loading-overlay");
  if (overlay) {
    overlay.style.display = show ? "flex" : "none";
  }
}

/**
 * Update equipment statistics header
 * @param {Array} devices - Array of device objects with consumption data
 */
function updateEquipmentStats(devices) {
  const connectivityEl = document.getElementById("equipStatsConnectivity");
  const totalEl = document.getElementById("equipStatsTotal");
  const consumptionEl = document.getElementById("equipStatsConsumption");
  const zeroEl = document.getElementById("equipStatsZero");

  if (!connectivityEl || !totalEl || !consumptionEl || !zeroEl) {
    console.warn("[EQUIPMENTS] Stats header elements not found");
    return;
  }

  // Calculate connectivity (online vs total) from ctx.data
  // Group by entityId to count each device only once
  const deviceMap = new Map(); // entityId -> { hasConnectionStatus: bool, isOnline: bool }

  if (self.ctx && Array.isArray(self.ctx.data)) {
    self.ctx.data.forEach((data) => {
      const entityId = data.datasource?.entityId;
      const dataKeyName = data.dataKey?.name;

      if (!entityId) return;

      // Initialize device entry if doesn't exist
      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, { hasConnectionStatus: false, isOnline: false });
      }

      // Check if this is the connectionStatus dataKey
      if (dataKeyName === "connectionStatus") {
        const status = String(data.data?.[0]?.[1] || '').toLowerCase();
        deviceMap.get(entityId).hasConnectionStatus = true;
        deviceMap.get(entityId).isOnline = (status === "online");
      }
    });
  }

  // Count online devices (only EQUIPMENTS, exclude lojas)
  let onlineCount = 0;
  let totalWithStatus = 0;

  devices.forEach(device => {
    const deviceData = deviceMap.get(device.entityId);
    if (deviceData && deviceData.hasConnectionStatus) {
      totalWithStatus++;
      if (deviceData.isOnline) {
        onlineCount++;
      }
    }
  });

  // Get total consumption from MAIN orchestrator (same source as ENERGY widget)
  let totalConsumption = 0;
  if (typeof window.MyIOOrchestrator?.getTotalEquipmentsConsumption === 'function') {
    totalConsumption = window.MyIOOrchestrator.getTotalEquipmentsConsumption();
    console.log("[EQUIPMENTS] Got total from orchestrator:", totalConsumption, "kWh");
  } else {
    console.warn("[EQUIPMENTS] MyIOOrchestrator not available, calculating locally");
    // Fallback: calculate locally
    devices.forEach(device => {
      const consumption = Number(device.val) || Number(device.lastValue) || 0;
      totalConsumption += consumption;
    });
  }

  // Calculate zero consumption count locally (not available in orchestrator)
  let zeroConsumptionCount = 0;
  devices.forEach(device => {
    const consumption = Number(device.val) || Number(device.lastValue) || 0;
    if (consumption === 0) {
      zeroConsumptionCount++;
    }
  });

  // Calculate connectivity percentage
  const connectivityPercentage = totalWithStatus > 0
    ? ((onlineCount / totalWithStatus) * 100).toFixed(1)
    : "0.0";

  // Update UI
  connectivityEl.textContent = `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`;
  totalEl.textContent = devices.length.toString();
  consumptionEl.textContent = MyIOLibrary.formatEnergy(totalConsumption);
  zeroEl.textContent = zeroConsumptionCount.toString();

  console.log("[EQUIPMENTS] Stats updated:", {
    connectivity: `${onlineCount}/${totalWithStatus} (${connectivityPercentage}%)`,
    total: devices.length,
    consumptionFromOrchestrator: totalConsumption,
    zeroCount: zeroConsumptionCount
  });
}

// Initialize cards
function initializeCards(devices) {
  const grid = document.getElementById("cards-grid");

  grid.innerHTML = "";

  devices.forEach((device, index) => {
    const container = document.createElement("div");
    //console.log("[EQUIPMENTS] Rendering device:", device);
    grid.appendChild(container);

    // Garantir que o deviceStatus existe (fallback para no_info se não existir)
    if (!device.deviceStatus) {
      device.deviceStatus = 'no_info';
    }

    const handle = MyIOLibrary.renderCardComponentHeadOffice(container, {
      entityObject: device,
      handleActionDashboard: async () => {
        try {
          const tokenIngestionDashBoard = await MyIOAuth.getToken();
          const myTbTokenDashBoard = localStorage.getItem("jwt_token");
          const modal = MyIOLibrary.openDashboardPopupEnergy({
            deviceId: device.entityId,
            readingType: "energy",
            startDate: self.ctx.$scope.startDateISO,
            endDate: self.ctx.$scope.endDateISO,
            tbJwtToken: myTbTokenDashBoard,
            ingestionToken: tokenIngestionDashBoard,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            onOpen: (context) => {
              console.log("Modal opened:", context);
            },
            onError: (error) => {
              console.error("Modal error:", error);
              alert(`Erro: ${error.message}`);
            },
            onClose: () => {
              const overlay = document.querySelector(".myio-modal-overlay");
              if (overlay) {
                overlay.remove();
                console.log("Overlay removido com sucesso.");
              }
            },
          });
        } catch (err) {
          console.warn(
            "[DeviceCards] Report open blocked:",
            err?.message || err
          );
          alert("Credenciais ainda carregando. Tente novamente em instantes.");
        } finally {
        }
      },

      handleActionReport: async () => {
        try {
          const ingestionToken = await MyIOAuth.getToken();

          if (!ingestionToken) throw new Error("No ingestion token");

          await MyIOLibrary.openDashboardPopupReport({
            ingestionId: device.ingestionId,
            identifier: device.deviceIdentifier,
            label: device.labelOrName,
            domain: "energy",
            api: {
              dataApiBaseUrl: DATA_API_HOST,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken,
            },
          });
        } catch (err) {
          console.warn(
            "[DeviceCards] Report open blocked:",
            err?.message || err
          );
          alert("Credenciais ainda carregando. Tente novamente em instantes.");
        } finally {
        }
      },

      handleActionSettings: async () => {
        const jwt = localStorage.getItem("jwt_token");
        try {
          await MyIOLibrary.openDashboardPopupSettings({
            deviceId: device.entityId, // TB deviceId
            label: device.labelOrName,
            jwtToken: jwt,
            ui: { title: "Configurações", width: 900 },
            onSaved: (payload) => {
              console.log(payload);
              // Mostra modal global de sucesso com contador e reload
              showGlobalSuccessModal(6);
            },
            onClose: () => {
              $(".myio-settings-modal-overlay").remove();
              const overlay = document.querySelector(".myio-modal-overlay");
              if (overlay) {
                overlay.remove();
                console.log("Overlay removido com sucesso.");
              }
            },
          });
        } catch (e) {}
      },
      handleSelect: (checked, entity) => {
        log(
          `Selection ${checked ? "checked" : "unchecked"}: ${
            entity.labelOrName
          }`
        );
      },
      handleClickCard: (ev, entity) => {
        log(`Card clicked: ${entity.labelOrName} - Power: ${entity.val}kWh`);
      },
      useNewComponents: true,
      enableSelection: true,
      enableDragDrop: true,
    });

    // O componente renderCardComponentHeadOffice agora gerencia o estilo baseado em deviceStatus
    // Não é mais necessário aplicar classes manualmente
  });

  log("Cards initialized successfully");
}

self.onInit = async function () {
  console.log("[EQUIPMENTS] onInit - ctx:", self.ctx);
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
          resolve({ start: s, end: e, from: "state/event" });
          return true;
        }
        return false;
      };

      const onEvt = (ev) => {
        tryResolve(ev.detail);
      };

      const cleanup = () => {
        window.removeEventListener("myio:date-params", onEvt);
        if (poller) clearInterval(poller);
        if (timer) clearTimeout(timer);
      };

      // 1) escuta evento do pai
      window.addEventListener("myio:date-params", onEvt);

      // 2) tenta estado atual imediatamente
      if (tryResolve(window.myioStateParams || {})) return;

      // 3) solicita explicitamente ao pai
      window.dispatchEvent(new CustomEvent("myio:request-date-params"));

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
          resolve({ start: startISO, end: endISO, from: "fallback-7d" });
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
  console.log("[EQUIPMENTS] date params ready:", datesFromParent);

  // agora já pode carregar dados / inicializar UI dependente de datas
  if (typeof self.loadData === "function") {
    await self.loadData(
      self.ctx.$scope.startDateISO,
      self.ctx.$scope.endDateISO
    );
  }

  //console.log("[EQUIPAMENTS] scope", scope.ctx)

  // mantém sincronizado em updates futuros do pai/irmão A
  self._onDateParams = (ev) => {
    applyParams(ev.detail);
    if (typeof self.loadData === "function") {
      self.loadData(self.ctx.$scope.startDateISO, self.ctx.$scope.endDateISO);
    }
  };
  window.addEventListener("myio:date-params", self._onDateParams);

  // ✅ Listen for shopping filter from MENU
  self._onFilterApplied = (ev) => {
    console.log("[EQUIPMENTS] heard myio:filter-applied:", ev.detail);

    // Extract shopping IDs from selection
    const selection = ev.detail?.selection || [];
    const shoppingIds = selection.map(s => s.value).filter(v => v);

    console.log("[EQUIPMENTS] Applying shopping filter:", shoppingIds.length === 0 ? "ALL" : `${shoppingIds.length} shoppings`);

    // Update STATE and reflow cards
    STATE.selectedShoppingIds = shoppingIds;

    // Render shopping filter chips
    renderShoppingFilterChips(selection);

    reflowCards();
  };
  window.addEventListener("myio:filter-applied", self._onFilterApplied);

  // Function to render shopping filter chips in toolbar
  function renderShoppingFilterChips(selection) {
    const chipsContainer = document.getElementById("shoppingFilterChips");
    if (!chipsContainer) return;

    chipsContainer.innerHTML = "";

    if (!selection || selection.length === 0) {
      return; // No filter applied, hide chips
    }

    selection.forEach(shopping => {
      const chip = document.createElement("span");
      chip.className = "filter-chip";
      chip.innerHTML = `<span class="filter-chip-icon">🏬</span><span>${shopping.name}</span>`;
      chipsContainer.appendChild(chip);
    });

    console.log("[EQUIPMENTS] 📍 Rendered", selection.length, "shopping filter chips");
  }

  //  console.log("[equipaments] self.ctx:", self.ctx);
  CUSTOMER_ID = self.ctx.settings.customerId || " ";
  // console.log("[equipaments] CUSTOMER_ID:", CUSTOMER_ID);

  // Objeto principal para armazenar os dados dos dispositivos
  const devices = {};

  // 🗺️ NOVO: Mapa para conectar o ingestionId ao ID da entidade do ThingsBoard
  const ingestionIdToEntityIdMap = new Map();

  // --- FASE 1: Monta o objeto inicial e o mapa de IDs ---
  self.ctx.data.forEach((data) => {
    if (data.datasource.aliasName !== "Shopping") {
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
      devices[entityId].values.push({
        dataType: data.dataKey.name,
        value: data.data[0][1],
        ts: data.data[0][0],
      });

      //console.log(`[EQUIPMENTS] Device ${entityId} - Added dataKey: ${data.dataKey.name} with value: ${data.data[0][1]}`);
      //console.log(`[EQUIPMENTS] Current device values:`, devices[entityId].values);

      // ✅ LÓGICA DO MAPA: Se o dado for o ingestionId, guardamos a relação
      if (data.dataKey.name === "ingestionId" && data.data[0][1]) {
        const ingestionId = data.data[0][1];
        ingestionIdToEntityIdMap.set(ingestionId, entityId);
      }
    }
  });

  const boolExecSync = false;

  // RFC-0071: Trigger device profile synchronization (runs once)
  if (!__deviceProfileSyncComplete && boolExecSync) {
    try {
      console.log("[EQUIPMENTS] [RFC-0071] Triggering device profile sync...");
      const syncResult = await syncDeviceProfileAttributes();
      __deviceProfileSyncComplete = true;

      if (syncResult.synced > 0) {
        console.log("[EQUIPMENTS] [RFC-0071] ⚠️ Widget reload recommended to load new deviceProfile attributes");
        console.log("[EQUIPMENTS] [RFC-0071] You may need to refresh the dashboard to see deviceProfile in ctx.data");
      }
    } catch (error) {
      console.error("[EQUIPMENTS] [RFC-0071] Sync failed, continuing without it:", error);
      // Don't block widget initialization if sync fails
    }
  }

  const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_ID);

  CLIENT_ID = customerCredentials.client_id || " ";
  CLIENT_SECRET = customerCredentials.client_secret || " ";
  INGESTION_ID = customerCredentials.ingestionId || " ";

  // ✅ Loading overlay already shown at start of onInit (moved up for better UX)
   async function renderDeviceCards() {
    const promisesDeCards = Object.entries(devices)
      .filter(([entityId, device]) =>
        device.values.some((valor) => valor.dataType === "total_consumption")
      )
      .map(async ([entityId, device]) => {
        const tbToken = localStorage.getItem("jwt_token");       
        const lastConnectTimestamp = findValue(device.values, "lastConnectTime", "");

        let operationHoursFormatted = "0s";

        if (lastConnectTimestamp) {
          const nowMs = new Date().getTime();
          const durationMs = nowMs - lastConnectTimestamp;
          operationHoursFormatted = formatarDuracao(durationMs > 0 ? durationMs : 0);
        }

        const deviceTemperature = await getDeviceTemperature(entityId, tbToken);
        const latestTimestamp = Math.max(...device.values.map((v) => v.ts || 0));
        const updatedFormatted = formatRelativeTime(latestTimestamp);

        const rawConnectionStatus = findValue(device.values, "connectionStatus", "offline");
        const consumptionValue = findValue(device.values, "total_consumption", 0);

        let mappedConnectionStatus = "offline";
        const statusLower = String(rawConnectionStatus).toLowerCase();
        
        if (statusLower === "online" || statusLower === "ok" || statusLower === "running") {
          mappedConnectionStatus = "online";
        } else if (statusLower === "waiting") {
          mappedConnectionStatus = "waiting";
        }

        const deviceProfile = findValue(device.values, "deviceProfile", "").toUpperCase();
        let deviceType = findValue(device.values, "deviceType", "").toUpperCase();

        if (deviceType === "3F_MEDIDOR" && deviceProfile !== "N/D") {
          deviceType = deviceProfile;
        }

        let standbyLimit = 100;
        let alertLimit = 1000;
        let failureLimit = 2000;

        switch(deviceType) {
          case 'CHILLER':
            standbyLimit = 1000;
            alertLimit = 6000;
            failureLimit = 8000;
            break;
          case 'AR_CONDICIONADO':
          case 'AC':
            standbyLimit = 500;
            alertLimit = 3000;
            failureLimit = 5000;
            break;
          case 'ELEVADOR':
          case 'ELEVATOR':
            standbyLimit = 150;
            alertLimit = 800;
            failureLimit = 1200;
            break;
          case 'BOMBA':
          case 'PUMP':
            standbyLimit = 200;
            alertLimit = 1000;
            failureLimit = 1500;
            break;
          default:
            break;
        }

        const deviceStatus = MyIOLibrary.calculateDeviceStatus({
          connectionStatus: mappedConnectionStatus,
          lastConsumptionValue: Number(consumptionValue) || null,
          limitOfPowerOnStandByWatts: standbyLimit,
          limitOfPowerOnAlertWatts: alertLimit,
          limitOfPowerOnFailureWatts: failureLimit
        });

        const ingestionId = findValue(device.values, "ingestionId", null);
        let customerId = findValue(device.values, "customerId", null);

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

        return {
          entityId: entityId,
          labelOrName: device.label,
          val: consumptionValue,
          deviceIdentifier: findValue(device.values, "identifier"),
          centralName: findValue(device.values, "centralName", null),
          ingestionId: ingestionId,
          customerId: customerId, // Shopping ingestionId for filtering
          deviceType: deviceType,
          deviceStatus: deviceStatus,
          valType: "power_kw",
          perc: Math.floor(Math.random() * (95 - 70 + 1)) + 70,
          temperatureC: deviceTemperature[0].value,
          operationHours: operationHoursFormatted || 0,
          updated: updatedFormatted,
          // RFC-0058: Add properties for MyIOSelectionStore (FOOTER)
          id: entityId,                    // Alias for entityId
          name: device.label,              // Alias for labelOrName
          lastValue: consumptionValue,     // Alias for val
          unit: 'kWh',                     // Energy unit
          icon: 'energy'                   // Domain identifier for SelectionStore
        };
      });

    const devicesFormatadosParaCards = await Promise.all(promisesDeCards);

    /**
     * TODO: TEMPORARY FIX - Remove when backend data is corrected
     * Some devices have deviceType = 3F_MEDIDOR but are actually equipment.
     * Check label for equipment keywords to properly classify them.
     */
    function isActuallyEquipment(device) {
      if (device.deviceType !== "3F_MEDIDOR") {
        return true; // Not 3F_MEDIDOR, definitely equipment
      }

      // Check if label contains equipment keywords
      /*
      const label = String(device.labelOrName || "").toLowerCase();
      const equipmentKeywords = ["elevador", "chiller", "bomba", "escada", "casa de m"];

      return equipmentKeywords.some(keyword => label.includes(keyword));
      */

      const deviceTypeEquipmentKeywords = ["MOTOR", "ELEVADOR", "ESCADA_ROLANTE"];

      return deviceTypeEquipmentKeywords.some(keyword => device.deviceType.toLowerCase().includes(keyword));      
    }

    // ✅ Separate lojas from equipments based on deviceType AND label validation
    const lojasDevices = devicesFormatadosParaCards.filter(d => !isActuallyEquipment(d));
    const equipmentDevices = devicesFormatadosParaCards.filter(d => isActuallyEquipment(d));

    // Debug: Log 3F_MEDIDOR devices classified as equipment (TODO: temporary)
    const medidorAsEquipment = equipmentDevices.filter(d => d.deviceType === "3F_MEDIDOR");
    if (medidorAsEquipment.length > 0) {
      console.warn("[EQUIPMENTS] ⚠️ Found", medidorAsEquipment.length, "3F_MEDIDOR devices classified as equipment (based on label):");
      medidorAsEquipment.forEach(d => {
        console.log("  -", d.labelOrName, "(deviceType:", d.deviceType, ")");
      });
    }

    console.log("[EQUIPMENTS] Total devices:", devicesFormatadosParaCards.length);
    console.log("[EQUIPMENTS] Equipment devices:", equipmentDevices.length);
    console.log("[EQUIPMENTS] Lojas (actual 3F_MEDIDOR stores):", lojasDevices.length);

    // ✅ Emit event to inform MAIN about lojas ingestionIds
    const lojasIngestionIds = lojasDevices.map(d => d.ingestionId).filter(id => id); // Remove nulls

    window.dispatchEvent(new CustomEvent('myio:lojas-identified', {
      detail: {
        lojasIngestionIds,
        lojasCount: lojasIngestionIds.length,
        timestamp: Date.now()
      }
    }));

    console.log("[EQUIPMENTS] ✅ Emitted myio:lojas-identified:", {
      lojasCount: lojasIngestionIds.length,
      lojasIngestionIds
    });

    // ✅ Save ONLY equipment devices to global STATE for filtering
    STATE.allDevices = equipmentDevices;

    // Log device-to-shopping mapping stats
    if (window.myioDeviceToShoppingMap) {
      console.log(`[EQUIPMENTS] 🗺️ Device-to-shopping map populated: ${window.myioDeviceToShoppingMap.size} devices mapped`);

      // Debug: show sample mappings
      if (window.myioDeviceToShoppingMap.size > 0) {
        const samples = Array.from(window.myioDeviceToShoppingMap.entries()).slice(0, 3);
        console.log(`[EQUIPMENTS] 📋 Sample mappings:`, samples.map(([deviceId, shopId]) => `${deviceId.substring(0, 8)}... → ${shopId.substring(0, 8)}...`));
      }
    }

    initializeCards(equipmentDevices);

    // Update statistics header (only equipments)
    updateEquipmentStats(equipmentDevices);

    // Hide loading after rendering
    showLoadingOverlay(false);
  }

    function enrichDevicesWithConsumption() {
    if (!energyCacheFromMain) {
      console.warn("[EQUIPMENTS] No energy from MAIN available yet");
      return;
    }

    console.log("[EQUIPMENTS] Enriching devices with consumption from MAIN...");

    // Iterate through devices and add consumption from cache
    Object.entries(devices).forEach(([entityId, device]) => {
      // Find ingestionId for this device
      const ingestionIdItem = device.values.find(v => v.dataType === "ingestionId");
      if (ingestionIdItem && ingestionIdItem.value) {
        const ingestionId = ingestionIdItem.value;
        const cached = energyCacheFromMain.get(ingestionId);

        if (cached) {
          // Remove old consumption data if exists
          const consumptionIndex = device.values.findIndex(v => v.dataType === "total_consumption");
          if (consumptionIndex >= 0) {
            device.values[consumptionIndex] = {
              val: cached.total_value,
              ts: cached.timestamp,
              dataType: "total_consumption",
            };
          } else {
            device.values.push({
              val: cached.total_value,
              ts: cached.timestamp,
              dataType: "total_consumption",
            });
          }
        }
      }
    });

    // Re-render cards and hide loading
    renderDeviceCards().then(() => {
      showLoadingOverlay(false);
    });
  }

    const findValue = (values, dataType, defaultValue = "N/D") => {
    const item = values.find((v) => v.dataType === dataType);
    if (!item) return defaultValue;
    // Retorna a propriedade 'val' (da nossa API) ou 'value' (do ThingsBoard)
    return item.val !== undefined ? item.val : item.value;
  };

  async function waitForOrchestrator(timeoutMs = 15000) {
  return new Promise((resolve) => {
    let interval;
    const timeout = setTimeout(() => {
      clearInterval(interval);
      console.error("[EQUIPMENTS] Timeout: MyIOOrchestrator não foi encontrado na window.");
      resolve(null);
    }, timeoutMs);

    interval = setInterval(() => {
      // RFC-0057: No longer checking window.parent - not using iframes
      const orchestrator = window.MyIOOrchestrator;
      if (orchestrator) {
        clearTimeout(timeout);
        clearInterval(interval);
        console.log("[EQUIPMENTS] MyIOOrchestrator encontrado!");
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
        console.warn("[EQUIPMENTS] Cache de energia está vazio. Nenhum card será renderizado.");
        showLoadingOverlay(false);
        return;
      }
      
      energyCacheFromMain = cache;
      enrichDevicesWithConsumption(); // A sua função original é chamada aqui
      await renderDeviceCards();      // E a sua outra função original é chamada aqui
    }

    // Lógica principal: "verificar-depois-ouvir"
const orchestrator = await waitForOrchestrator();

if (orchestrator) {
  const existingCache = orchestrator.getCache();

  if (existingCache && existingCache.size > 0) {
    // CAMINHO 1: (Navegação de volta)
    console.log("[EQUIPMENTS] Cache do Orquestrador já existe. Usando-o diretamente.");
    await processAndRender(existingCache);
  } else {
    // CAMINHO 2: (Primeiro carregamento)
    console.log("[EQUIPMENTS] Cache vazio. Aguardando evento 'myio:energy-data-ready'...");
    const waitForEnergyCache = new Promise((resolve) => {
      const handlerTimeout = setTimeout(() => {
        console.warn("[EQUIPMENTS] Timeout esperando pelo evento de cache.");
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
  // ZOOM de fontes — agora usando o WRAP como root das variáveis
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
    }, 0)

  // ====== FILTER & SEARCH LOGIC ======
  bindFilterEvents();
};

// Global state for filters
const STATE = {
  allDevices: [],
  searchActive: false,
  searchTerm: "",
  selectedIds: null,
  sortMode: 'cons_desc',
  selectedShoppingIds: [] // Shopping filter from MENU
};

/**
 * Apply filters and sorting to devices
 */
function applyFilters(devices, searchTerm, selectedIds, sortMode) {
  let filtered = devices.slice();

  // Apply shopping filter (from MENU)
  if (STATE.selectedShoppingIds && STATE.selectedShoppingIds.length > 0) {
    const before = filtered.length;
    filtered = filtered.filter(d => {
      // If device has no customerId, include it (safety)
      if (!d.customerId) return true;
      // Check if device's customerId is in the selected shoppings
      return STATE.selectedShoppingIds.includes(d.customerId);
    });
    console.log(`[EQUIPMENTS] Shopping filter applied: ${before} -> ${filtered.length} devices (${before - filtered.length} filtered out)`);
  }

  // Apply multiselect filter
  if (selectedIds && selectedIds.size > 0) {
    filtered = filtered.filter(d => selectedIds.has(d.entityId));
  }

  // Apply search filter
  const query = (searchTerm || "").trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(d =>
      String(d.labelOrName || "").toLowerCase().includes(query) ||
      String(d.deviceIdentifier || "").toLowerCase().includes(query) ||
      String(d.deviceType || "").toLowerCase().includes(query)
    );
  }

  // Apply sorting
  filtered.sort((a, b) => {
    const valA = Number(a.val) || Number(a.lastValue) || 0;
    const valB = Number(b.val) || Number(b.lastValue) || 0;
    const nameA = String(a.labelOrName || "").toLowerCase();
    const nameB = String(b.labelOrName || "").toLowerCase();

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

  console.log("[EQUIPMENTS] Reflow with filters:", {
    total: STATE.allDevices.length,
    filtered: filtered.length,
    searchTerm: STATE.searchTerm,
    selectedCount: STATE.selectedIds?.size || 0,
    sortMode: STATE.sortMode
  });

  initializeCards(filtered);
  updateEquipmentStats(filtered);
}

/**
 * Open filter modal
 */
function openFilterModal() {
  const modal = document.getElementById("filterModal");
  if (!modal) return;

  modal.classList.remove("hidden");

  // Populate device checklist
  const checklist = document.getElementById("deviceChecklist");
  if (!checklist) return;

  checklist.innerHTML = "";

  STATE.allDevices.forEach(device => {
    const isChecked = !STATE.selectedIds || STATE.selectedIds.has(device.entityId);

    const item = document.createElement("div");
    item.className = "check-item";
    item.innerHTML = `
      <input type="checkbox" id="check-${device.entityId}" ${isChecked ? 'checked' : ''} data-device-id="${device.entityId}">
      <label for="check-${device.entityId}">${device.labelOrName || device.deviceIdentifier || device.entityId}</label>
    `;

    checklist.appendChild(item);
  });

  // Set current sort mode
  const sortRadios = modal.querySelectorAll('input[name="sortMode"]');
  sortRadios.forEach(radio => {
    radio.checked = radio.value === STATE.sortMode;
  });
}

/**
 * Bind all filter-related events
 */
function bindFilterEvents() {
  // Search button toggle
  const btnSearch = document.getElementById("btnSearch");
  const searchWrap = document.getElementById("searchWrap");
  const searchInput = document.getElementById("equipSearch");

  if (btnSearch && searchWrap && searchInput) {
    btnSearch.addEventListener("click", () => {
      STATE.searchActive = !STATE.searchActive;
      searchWrap.classList.toggle("active", STATE.searchActive);
      if (STATE.searchActive) {
        setTimeout(() => searchInput.focus(), 100);
      }
    });

    searchInput.addEventListener("input", (e) => {
      STATE.searchTerm = e.target.value || "";
      reflowCards();
    });
  }

  // Filter button
  const btnFilter = document.getElementById("btnFilter");
  if (btnFilter) {
    btnFilter.addEventListener("click", openFilterModal);
  }

  // Modal close button
  const closeFilter = document.getElementById("closeFilter");
  const modal = document.getElementById("filterModal");
  if (closeFilter && modal) {
    closeFilter.addEventListener("click", () => {
      modal.classList.add("hidden");
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });
  }

  // Select all button
  const selectAll = document.getElementById("selectAll");
  if (selectAll) {
    selectAll.addEventListener("click", () => {
      const checkboxes = document.querySelectorAll("#deviceChecklist input[type='checkbox']");
      checkboxes.forEach(cb => cb.checked = true);
    });
  }

  // Clear all button
  const clearAll = document.getElementById("clearAll");
  if (clearAll) {
    clearAll.addEventListener("click", () => {
      const checkboxes = document.querySelectorAll("#deviceChecklist input[type='checkbox']");
      checkboxes.forEach(cb => cb.checked = false);
    });
  }

  // Select with consumption button
  const selectWithConsumption = document.getElementById("selectWithConsumption");
  if (selectWithConsumption) {
    selectWithConsumption.addEventListener("click", () => {
      const checkboxes = document.querySelectorAll("#deviceChecklist input[type='checkbox']");
      checkboxes.forEach(cb => {
        const deviceId = cb.getAttribute("data-device-id");
        const device = STATE.allDevices.find(d => d.entityId === deviceId);
        if (device) {
          const consumption = Number(device.val) || Number(device.lastValue) || 0;
          cb.checked = consumption > 0;
        }
      });
    });
  }

  // Select without consumption button
  const selectWithoutConsumption = document.getElementById("selectWithoutConsumption");
  if (selectWithoutConsumption) {
    selectWithoutConsumption.addEventListener("click", () => {
      const checkboxes = document.querySelectorAll("#deviceChecklist input[type='checkbox']");
      checkboxes.forEach(cb => {
        const deviceId = cb.getAttribute("data-device-id");
        const device = STATE.allDevices.find(d => d.entityId === deviceId);
        if (device) {
          const consumption = Number(device.val) || Number(device.lastValue) || 0;
          cb.checked = consumption === 0;
        }
      });
    });
  }

  // Filter device search inside modal
  const filterDeviceSearch = document.getElementById("filterDeviceSearch");
  if (filterDeviceSearch) {
    filterDeviceSearch.addEventListener("input", (e) => {
      const query = (e.target.value || "").trim().toLowerCase();
      const checkItems = document.querySelectorAll("#deviceChecklist .check-item");

      checkItems.forEach(item => {
        const label = item.querySelector("label");
        const text = (label?.textContent || "").toLowerCase();
        item.style.display = text.includes(query) ? "flex" : "none";
      });
    });
  }

  // Clear filter search button
  const filterDeviceClear = document.getElementById("filterDeviceClear");
  if (filterDeviceClear && filterDeviceSearch) {
    filterDeviceClear.addEventListener("click", () => {
      filterDeviceSearch.value = "";
      const checkItems = document.querySelectorAll("#deviceChecklist .check-item");
      checkItems.forEach(item => item.style.display = "flex");
      filterDeviceSearch.focus();
    });
  }

  // Apply filters button
  const applyFilters = document.getElementById("applyFilters");
  if (applyFilters && modal) {
    applyFilters.addEventListener("click", () => {
      // Get selected devices
      const checkboxes = document.querySelectorAll("#deviceChecklist input[type='checkbox']:checked");
      const selectedSet = new Set();
      checkboxes.forEach(cb => {
        const deviceId = cb.getAttribute("data-device-id");
        if (deviceId) selectedSet.add(deviceId);
      });

      // If all devices are selected, treat as "no filter"
      STATE.selectedIds = selectedSet.size === STATE.allDevices.length ? null : selectedSet;

      // Get sort mode
      const sortRadio = document.querySelector('input[name="sortMode"]:checked');
      if (sortRadio) {
        STATE.sortMode = sortRadio.value;
      }

      // Apply filters and close modal
      reflowCards();
      modal.classList.add("hidden");

      console.log("[EQUIPMENTS] Filters applied:", {
        selectedCount: STATE.selectedIds?.size || STATE.allDevices.length,
        sortMode: STATE.sortMode
      });
    });
  }

  // Reset filters button
  const resetFilters = document.getElementById("resetFilters");
  if (resetFilters && modal) {
    resetFilters.addEventListener("click", () => {
      // Reset state
      STATE.selectedIds = null;
      STATE.sortMode = 'cons_desc';
      STATE.searchTerm = "";
      STATE.searchActive = false;

      // Reset UI
      if (searchInput) searchInput.value = "";
      if (searchWrap) searchWrap.classList.remove("active");

      // Apply and close
      reflowCards();
      modal.classList.add("hidden");

      console.log("[EQUIPMENTS] Filters reset");
    });
  }
}

self.onDestroy = function () {
  if (self._onDateParams) {
    window.removeEventListener("myio:date-params", self._onDateParams);
  }
  if (self._onFilterApplied) {
    window.removeEventListener("myio:filter-applied", self._onFilterApplied);
  }
};
