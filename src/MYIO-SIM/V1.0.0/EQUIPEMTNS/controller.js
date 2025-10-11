/* global self, ctx */

const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
let CUSTOMER_ID;
let CLIENT_ID;
let CLIENT_SECRET;
let INGESTION_ID;

function d(name, code, icon, status, powerKw, effPct, tempC, hours) {
  return { name, code, icon, status, powerKw, effPct, tempC, hours };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function formatNumber(n, d = 0) {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}
function formatHours(h) {
  return formatNumber(h, 3);
}
function escapeHtml(s = "") {
  return String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}
function isDanger(status) {
  const s = String(status || "").toLowerCase();
  return s === "alert" || s === "fail" || s === "erro" || s === "fault";
}

// RFC: Global refresh counter to limit data updates to 3 times maximum
let _dataRefreshCount = 0;
const MAX_DATA_REFRESHES = 1;

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

  // Helpers opcionais
  function getExpiryInfo() {
    return {
      expiresAt: _expiresAt,
      expiresInSeconds: Math.max(0, Math.floor((_expiresAt - _now()) / 1000)),
    };
  }

  function clearCache() {
    _token = null;
    _expiresAt = 0;
    _inFlight = null;
  }

  return {
    getToken,
    getExpiryInfo,
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

// Helper: aceita number | Date | string e retorna "YYYY-MM-DDTHH:mm:ss-03:00"
function toSpOffsetNoMs(input, endOfDay = false) {
  const d =
    typeof input === "number"
      ? new Date(input)
      : input instanceof Date
      ? input
      : new Date(String(input));

  if (Number.isNaN(d.getTime())) throw new Error("Data inválida");

  if (endOfDay) d.setHours(23, 59, 59, 999);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const MM = String(d.getMinutes()).padStart(2, "0");
  const SS = String(d.getSeconds()).padStart(2, "0");

  // São Paulo (sem DST hoje): -03:00
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}-03:00`;
}

// Função para pegar timestamps das datas internas completas
function getTimeWindowRange() {
  let startTs = 0;
  let endTs = 0;

  if (self.startDate) {
    const startDateObj = new Date(self.startDate);

    if (!isNaN(startDateObj)) {
      startDateObj.setHours(0, 0, 0, 0);
      startTs = startDateObj.getTime();
    }
  }

  if (self.endDate) {
    const endDateObj = new Date(self.endDate);

    if (!isNaN(endDateObj)) {
      endDateObj.setHours(23, 59, 59, 999);
      endTs = endDateObj.getTime();
    }
  }

  return {
    startTs,
    endTs,
  };
}

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

function isValidUUID(str) {
  if (!str || typeof str !== "string") return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

async function updateTotalConsumption(
  customersArray,
  startDateISO,
  endDateISO
) {
  let totalConsumption = 0;
  for (const c of customersArray) {
    // Pula se value estiver vazio
    if (!c.value) continue;
    try {
      const TOKEN_INJESTION = await MyIOAuth.getToken();
      const response = await fetch(
        `${DATA_API_HOST}/api/v1/telemetry/customers/${
          c.value
        }/energy/devices/totals?startTime=${encodeURIComponent(
          startDateISO
        )}&endTime=${encodeURIComponent(endDateISO)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${TOKEN_INJESTION}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
      const data = await response.json();
      console.log(`[equipaments] Dados do customer ${c.value}:`, data);

      return data;
    } catch (err) {
      console.error(
        `[equipaments] Falha ao buscar dados do customer ${c.value}:`,
        err
      );
    }
  }
}

// Helper: Authenticated fetch with 401 retry
async function fetchWithAuth(url, opts = {}, retry = true) {
  const token = await MyIOAuth.getToken();
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 && retry) {
    console.warn(
      `[equipaments] [fetchWithAuth] 401 on ${
        url.split("?")[0]
      } - refreshing token and retrying`
    );
    MyIOAuth.clearCache(); // Force token refresh
    const token2 = await MyIOAuth.getToken();
    const res2 = await fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        Authorization: `Bearer ${token2}`,
      },
    });
    if (!res2.ok) {
      const errorText = await res2.text().catch(() => "");
      throw new Error(`[HTTP ${res2.status}] ${errorText}`);
    }
    return res2;
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`[HTTP ${res.status}] ${errorText}`);
  }

  return res;
}

function latestNumber(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;

  const v = Number(arr[arr.length - 1][1]);

  return Number.isFinite(v) ? v : null;
}

function resolveEntityValue(chunks) {
  for (const key of CONFIG.valueKeysTry) {
    const ch = chunks.find((c) => c.dataKey?.name === key);

    if (ch) {
      const v = latestNumber(ch.data);
      if (v !== null) return v;
    }
  }
  // fallback: primeiro numérico válido
  for (const ch of chunks) {
    const v = latestNumber(ch.data);

    if (v !== null) return v;
  }
  return 0;
}

function getKeyByValue(map, searchValue) {
  for (let [key, value] of map.entries()) {
    if (value === searchValue) {
      return key; // Retorna a primeira chave encontrada
    }
  }
  // Opcional: retorna undefined se não encontrar
  return undefined;
}

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

async function fetchLastConnectTime(deviceId, jwtToken) {
  const apiUrl = `https://dashboard.myio-bas.com/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?keys=lastConnectTime`;
  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { "X-Authorization": `Bearer ${jwtToken}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    // O valor do atributo está em data[0].value
    return data[0]?.value || null;
  } catch (error) {
    console.error(`Erro ao buscar lastConnectTime para ${deviceId}:`, error);
    return null;
  }
}

// Show/hide loading overlay
function showLoadingOverlay(show) {
  const overlay = document.getElementById("equipments-loading-overlay");
  if (overlay) {
    overlay.style.display = show ? "flex" : "none";
  }
}

// Initialize cards
function initializeCards(devices) {
  const grid = document.getElementById("cards-grid");

  grid.innerHTML = "";

  devices.forEach((device, index) => {
    const container = document.createElement("div");
    console.log("[EQUIPMENTS] Rendering device:", device);
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

      // ✅ LÓGICA DO MAPA: Se o dado for o ingestionId, guardamos a relação
      if (data.dataKey.name === "ingestionId" && data.data[0][1]) {
        const ingestionId = data.data[0][1];
        ingestionIdToEntityIdMap.set(ingestionId, entityId);
      }
    }
  });

  const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_ID);

  CLIENT_ID = customerCredentials.client_id || " ";
  CLIENT_SECRET = customerCredentials.client_secret || " ";
  INGESTION_ID = customerCredentials.ingestionId || " ";

  // Show loading overlay initially
  showLoadingOverlay(true);

  // ===== EQUIPMENTS: Listen for energy cache from MAIN orchestrator =====
  let energyCacheFromMain = null;

  window.addEventListener('myio:energy-data-ready', (ev) => {
    console.log("[EQUIPMENTS] Received energy data from orchestrator:", ev.detail);
    energyCacheFromMain = ev.detail.cache;

    // Re-render cards with updated consumption data
    if (energyCacheFromMain) {
      enrichDevicesWithConsumption();
    }
  });

  // Helper function to enrich devices with consumption from cache
  function enrichDevicesWithConsumption() {
    if (!energyCacheFromMain) {
      console.warn("[EQUIPMENTS] No energy cache available yet");
      return;
    }

    console.log("[EQUIPMENTS] Enriching devices with consumption from cache...");

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

  // Wait for initial energy cache from MAIN
  const waitForEnergyCache = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn("[EQUIPMENTS] Timeout waiting for energy cache, proceeding without it");
      showLoadingOverlay(false); // Hide loading on timeout
      resolve(null);
    }, 10000); // 10 second timeout

    const handler = (ev) => {
      clearTimeout(timeout);
      window.removeEventListener('myio:energy-data-ready', handler);
      energyCacheFromMain = ev.detail.cache;
      console.log("[EQUIPMENTS] Initial energy cache received:", energyCacheFromMain.size, "devices");
      resolve(energyCacheFromMain);
    };

    window.addEventListener('myio:energy-data-ready', handler);
  });

  // Wait for energy cache before rendering
  const initialCache = await waitForEnergyCache;

  if (initialCache) {
    // Add consumption data from cache to devices
    initialCache.forEach((cached, ingestionId) => {
      const entityId = ingestionIdToEntityIdMap.get(ingestionId);
      if (entityId && devices[entityId]) {
        devices[entityId].values.push({
          val: cached.total_value,
          ts: cached.timestamp,
          dataType: "total_consumption",
        });
      }
    });
  }

  // Helper function to render device cards
  async function renderDeviceCards() {
    const promisesDeCards = Object.entries(devices)
      .filter(([entityId, device]) =>
        device.values.some((valor) => valor.dataType === "total_consumption")
      )
      .map(async ([entityId, device]) => {
        const tbToken = localStorage.getItem("jwt_token");
        const lastConnectTimestamp = await fetchLastConnectTime(entityId, tbToken);

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

        const deviceType = findValue(device.values, "deviceType", "").toUpperCase();
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

        return {
          entityId: entityId,
          labelOrName: device.label,
          val: consumptionValue,
          deviceIdentifier: findValue(device.values, "identifier"),
          centralName: findValue(device.values, "centralName", null),
          ingestionId: findValue(device.values, "ingestionId", null),
          deviceType: deviceType,
          deviceStatus: deviceStatus,
          valType: "power_kw",
          perc: Math.floor(Math.random() * (95 - 70 + 1)) + 70,
          temperatureC: deviceTemperature[0].value,
          operationHours: operationHoursFormatted || 0,
          updated: updatedFormatted,
        };
      });

    const devicesFormatadosParaCards = await Promise.all(promisesDeCards);
    initializeCards(devicesFormatadosParaCards);

    // Hide loading after rendering
    showLoadingOverlay(false);
  }

  // Helper para encontrar um valor específico no array 'values' de cada device
  const findValue = (values, dataType, defaultValue = "N/D") => {
    const item = values.find((v) => v.dataType === dataType);
    if (!item) return defaultValue;
    // Retorna a propriedade 'val' (da nossa API) ou 'value' (do ThingsBoard)
    return item.val !== undefined ? item.val : item.value;
  };

  // Render initial cards with energy data from cache
  await renderDeviceCards();

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
};

self.onDestroy = function () {
  if (self._onDateParams) {
    window.removeEventListener("myio:date-params", self._onDateParams);
  }
};
