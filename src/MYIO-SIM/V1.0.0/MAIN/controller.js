/* global self, ctx */

const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
let CUSTOMER_ID;
let CLIENT_ID;
let CLIENT_SECRET;
let INGESTION_ID;

// NOTE: Funções de formatação removidas - não são mais usadas no MAIN
// O MAIN agora é apenas o orquestrador de dados

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

function isValidUUID(str) {
  if (!str || typeof str !== "string") return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// NOTE: Funções de rendering e device data removidas
// Essas responsabilidades agora pertencem aos widgets HEADER e EQUIPMENTS


// ===== ORCHESTRATOR: Energy Cache Management =====
const MyIOOrchestrator = (() => {
  // In-memory cache for energy data
  let energyCache = new Map(); // Map<ingestionId, energyData>
  let isFetching = false;
  let lastFetchParams = null;

  async function fetchEnergyData(customersArray, startDateISO, endDateISO) {
    // Prevent duplicate fetches
    const fetchKey = `${JSON.stringify(customersArray)}_${startDateISO}_${endDateISO}`;
    if (isFetching && lastFetchParams === fetchKey) {
      console.log("[MAIN] [Orchestrator] Fetch already in progress, skipping...");
      return energyCache;
    }

    isFetching = true;
    lastFetchParams = fetchKey;
    console.log("[MAIN] [Orchestrator] Fetching energy data...", { startDateISO, endDateISO, customers: customersArray.length });

    try {
      const TOKEN_INGESTION = await MyIOAuth.getToken();

      // Fetch energy data for all customers
      const allDevicesData = [];
      for (const customer of customersArray) {
        if (!customer.value) continue;

        try {
          const response = await fetch(
            `${DATA_API_HOST}/api/v1/telemetry/customers/${customer.value}/energy/devices/totals?startTime=${encodeURIComponent(startDateISO)}&endTime=${encodeURIComponent(endDateISO)}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${TOKEN_INGESTION}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!response.ok) {
            console.warn(`[MAIN] [Orchestrator] Failed to fetch energy for customer ${customer.value}: HTTP ${response.status}`);
            continue;
          }

          const data = await response.json();
          const devicesList = Array.isArray(data) ? data : (data[0] || []);
          allDevicesData.push(...devicesList);

        } catch (err) {
          console.error(`[MAIN] [Orchestrator] Error fetching energy for customer ${customer.value}:`, err);
        }
      }

      // Clear and repopulate cache
      energyCache.clear();
      allDevicesData.forEach(device => {
        if (device.id) {
          energyCache.set(device.id, {
            ingestionId: device.id,
            total_value: device.total_value || 0,
            timestamp: Date.now()
          });
        }
      });

      console.log(`[MAIN] [Orchestrator] Energy cache updated: ${energyCache.size} devices`);

      // Emit event with cached data
      window.dispatchEvent(new CustomEvent('myio:energy-data-ready', {
        detail: {
          cache: energyCache,
          totalDevices: energyCache.size,
          startDate: startDateISO,
          endDate: endDateISO,
          timestamp: Date.now()
        }
      }));

      return energyCache;

    } catch (err) {
      console.error("[MAIN] [Orchestrator] Fatal error fetching energy data:", err);
      return energyCache;
    } finally {
      isFetching = false;
    }
  }

  function getCache() {
    return energyCache;
  }

  function getCachedDevice(ingestionId) {
    return energyCache.get(ingestionId) || null;
  }

  return {
    fetchEnergyData,
    getCache,
    getCachedDevice
  };
})();

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
        console.log("[MAIN] DATE-PARAMS", ev)  
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

  // ===== ORCHESTRATOR: Listen for date updates from MENU =====
  window.addEventListener('myio:update-date', async (ev) => {
    console.log("[MAIN] [Orchestrator] Date update received:", ev.detail);
    const { startDate, endDate } = ev.detail;

    if (startDate && endDate) {
      // Update scope
      applyParams({
        globalStartDateFilter: startDate,
        globalEndDateFilter: endDate
      });

      // Use customerId from settings
      const customerId = self.ctx.settings.customerId;
      if (!customerId) {
        console.error("[MAIN] [Orchestrator] customerId não encontrado em settings");
        return;
      }

      const custumer = [{
        name: "Customer",
        value: customerId
      }];

      // Fetch and cache energy data
      await MyIOOrchestrator.fetchEnergyData(custumer, startDate, endDate);
    }
  });

  window.addEventListener('myio:filter-params', (ev) => {
    console.log("[EQUIPAMENTS]filtro",ev.detail )
  });

  // ====== fluxo do widget ======
  // tenta aplicar o que já existir (não bloqueia)
  applyParams(window.myioStateParams || {});

  // garante sincronização inicial antes de continuar
  const datesFromParent = await waitForDateParams({ pollMs: 300, timeoutMs: 15000 });
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

  // NOTE: MAIN agora é apenas o orquestrador
  // Não precisa processar devices localmente

  // ===== ORCHESTRATOR: Initial energy data fetch =====
  // Use apenas o customerId do settings, não precisa iterar datasources
  const customerId = self.ctx.settings.customerId;

  if (!customerId) {
    console.error("[MAIN] [Orchestrator] customerId não encontrado em settings");
    return;
  }

  const custumer = [{
    name: "Customer",
    value: customerId
  }];

  console.log("[MAIN] [Orchestrator] Initial setup with customerId:", customerId);
  console.log("[MAIN] [Orchestrator] Date range:", { start: datesFromParent.start, end: datesFromParent.end });

  // Fetch energy data using orchestrator
  await MyIOOrchestrator.fetchEnergyData(custumer, datesFromParent.start, datesFromParent.end);

  // NOTE: O MAIN não precisa mais renderizar cards próprios
  // Os dados de energia agora vêm do cache do orchestrador
  // e são consumidos pelos widgets HEADER e EQUIPMENTS via eventos

  console.log("[MAIN] [Orchestrator] Initialization complete - data available via cache");

};

self.onDestroy = function () {
  if (self._onDateParams) {
    window.removeEventListener("myio:date-params", self._onDateParams);
  }
};
