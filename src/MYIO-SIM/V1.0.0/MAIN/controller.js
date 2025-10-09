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

function renderCard(dev, idx) {
  const status = (dev.status || "ok").toLowerCase();
  const statusCls =
    status === "ok" ? "chip ok" : status === "alert" ? "chip warn" : "chip err";
  const chipText =
    status === "ok"
      ? `<span class="dot"></span> Em operação`
      : status === "alert"
      ? `⚠️ Alerta`
      : `✖ Falha`;
  const dangerCls = isDanger(status) ? "danger" : "";

  return `
  <section class="equip-card ${dangerCls}">
    <header class="equip-hd">
      <div class="equip-id">
        <div class="equip-icon" aria-hidden="true">${dev.icon}</div>
        <div class="equip-meta">
          <div class="equip-title">${escapeHtml(dev.name)}</div>
          <div class="equip-code">${escapeHtml(dev.code)}</div>
        </div>
      </div>
      <button class="equip-menu" aria-label="menu">⋮</button>
    </header>

    <div class="equip-status">
      <span class="${statusCls}">${chipText}</span>
    </div>

    <div class="equip-power">
      <span class="power">${formatNumber(dev.powerKw, 1)}</span>
      <span class="unit">kW</span>
      <div class="sub">Atual</div>
    </div>

    <div class="equip-eff">
      <div class="label">Eficiência</div>
      <div class="bar"><div class="fill" id="effFill_${idx}" style="width:0%"></div></div>
      <div class="pct">${Math.round(dev.effPct)}%</div>
    </div>

    <footer class="equip-ft">
      <div class="ft-item">
        <div class="ico">🌡️</div>
        <div>
          <div class="k">Temperatura</div>
          <div class="v">${formatNumber(dev.tempC, 0)}°C</div>
        </div>
      </div>
      <div class="ft-item">
        <div class="ico">⏱️</div>
        <div>
          <div class="k">Tempo de operação</div>
          <div class="v">${formatHours(dev.hours)}h</div>
        </div>
      </div>
    </footer>
  </section>`;
}

function renderGrid(list) {
  const grid = document.getElementById("equipGrid");
  grid.innerHTML = list.map(renderCard).join("");
  list.forEach((dev, i) => {
    const fill = document.querySelector(`#effFill_${i}`);
    if (fill) fill.style.width = clamp(dev.effPct, 0, 100) + "%";
  });
}

// Log function
function log(message, type = "info") {
  const logOutput = document.getElementById("log-output");
  const time = new Date().toLocaleTimeString("pt-BR");
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<span class="log-time">${time}</span>${message}`;
  //logOutput.appendChild(entry);
  //logOutput.scrollTop = logOutput.scrollHeight;
}

async function getDeviceData() {
  try {
    const { startTs, endTs } = getTimeWindowRange(); // Pega o período de tempo atual
    console.log("[equipaments] startTs", new Date(1758833451000));
    //console.log("endTs",endTs)
    const baseUrl = `${DATA_API_HOST}/api/v1/telemetry/customers/${CUSTOMER_ID}/energy/devices/totals?startTime=${encodeURIComponent(
      new Date(1758833451000)
    )}&endTime=${encodeURIComponent(new Date(1758833451000))}`;
    // url.searchParams.set("startTime", toSpOffsetNoMs(startTs));
    // url.searchParams.set("endTime", toSpOffsetNoMs(endTs, true));
    // url.searchParams.set("deep", "1");

    const DATA_API_TOKEN = await MyIOAuth.getToken();
    const res = await fetch(baseUrl.toString(), {
      headers: { Authorization: `Bearer ${DATA_API_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }

    const payload = await res.json();
    const dataList = Array.isArray(payload) ? payload : payload.data || [];

    // Cria um mapa para busca rápida usando o ingestionId
    const deviceDataMap = new Map();
    dataList.forEach((device) => {
      if (device.id) {
        deviceDataMap.set(String(device.id), device);
      }
    });

    return deviceDataMap;
  } catch (err) {
    console.error(
      "[equipaments] Falha ao buscar dados de consumo da API:",
      err
    );
  }
}

// Initialize cards
function initializeCards(devices) {
  const grid = document.getElementById("cards-grid");

  devices.forEach((device, index) => {
    const container = document.createElement("div");
    grid.appendChild(container);

    const handle = MyIOLibrary.renderCardCompenteHeadOffice(container, {
      entityObject: device,
      handleActionDashboard: (ev, entity) => {
        log(`Dashboard clicked: ${entity.labelOrName} (${entity.entityId})`);
      },
      handleActionReport: (ev, entity) => {
        log(`Report clicked: ${entity.labelOrName} (${entity.entityId})`);
      },
      handleActionSettings: (ev, entity) => {
        log(`Settings clicked: ${entity.labelOrName} (${entity.entityId})`);
      },
      handleSelect: (checked, entity) => {
        log(
          `Selection ${checked ? "checked" : "unchecked"}: ${
            entity.labelOrName
          }`
        );
      },
      handleClickCard: (ev, entity) => {
        log(`Card clicked: ${entity.labelOrName} - Power: ${entity.val}kW`);
      },
      useNewComponents: true,
      enableSelection: true,
      enableDragDrop: true,
    });

    //cardHandles.push({ handle, device, container });
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

//   console.log("[equipaments] Devices Iniciais:", devices);
//   console.log(
//     "[equipaments] Mapa de IDs (ingestionId -> entityId):",
//     ingestionIdToEntityIdMap
//   );

//   console.log("[equipaments] devices", devices);
//   console.log("[equipaments] Tamanho:", Object.keys(devices).length);

  const customerCredentials = await fetchCustomerServerScopeAttrs(CUSTOMER_ID);

  CLIENT_ID = customerCredentials.client_id || " ";
  CLIENT_SECRET = customerCredentials.client_secret || " ";
  INGESTION_ID = customerCredentials.ingestionId || " ";

//   console.log("[equipaments] CLIENT_ID:", CLIENT_ID);
//   console.log("[equipaments] CLIENT_SECRET:", CLIENT_SECRET);
//   console.log("[equipaments] INGESTION_ID:", INGESTION_ID);

  // const devices = await getDeviceData();
  // console.log("devices:", devices);

  /*
  const hoje = new Date();
  // início do mês → 00:00:00
  
  const startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0);
  const startDateISO = startDate.toISOString().replace(".000Z", "-03:00"); // ISO com timezone
  self.ctx.$scope.startDateISO = startDateISO;
  */

  /*

  const endDate = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate(),
    23,
    59,
    59
  );
  const endDateISO = endDate.toISOString().replace(".000Z", "-03:00");
  self.ctx.$scope.endDateISO = endDateISO;
  */

  const custumer = [];

  self.ctx.data.forEach((data) => {
    if (data.datasource.aliasName === "Shopping") {
      // adiciona no array custumes
      custumer.push({
        name: data.datasource.entityLabel, // ou outro campo que seja o "nome"
        value: data.data[0][1], // ou o dado que você precisa salvar
      });
    }
  });

//   console.log("[equipaments] on init Equipments >> custumer: ", custumer);
//   console.log("[equipaments] on init Equipments >> startDateISO: ", datesFromParent.start);
//   console.log("[equipaments] on init Equipments >> endDateISO: ", datesFromParent.end);

  const apiDevices = await updateTotalConsumption(custumer, datesFromParent.start, datesFromParent.end);

  const devicesArray = Array.isArray(apiDevices)
    ? apiDevices
    : Object.values(apiDevices);

  // Pega a lista correta de dispositivos que está no PRIMEIRO elemento do array
  const listaDeDispositivosDaApi = devicesArray[0];

//   console.log(
//     "[equipaments] Lista de dispositivos que veio da API:",
//     listaDeDispositivosDaApi
//   );

  // Agora o loop é feito na lista correta
  listaDeDispositivosDaApi.forEach((dispositivoDaApi) => {
    // Agora 'dispositivoDaApi' é o objeto que você espera, como {id: "...", total_value: ...}
    const ingestionId = dispositivoDaApi.id;

    // O resto da sua lógica para usar o mapa continua igual
    const entityId = ingestionIdToEntityIdMap.get(ingestionId);

    if (entityId && devices[entityId]) {
      devices[entityId].values.push({
        val: dispositivoDaApi.total_value,
        ts: Date.now(),
        dataType: "total_consumption",
      });
    }
  });

  // Helper para encontrar um valor específico no array 'values' de cada device
  const findValue = (values, dataType, defaultValue = "N/D") => {
    const item = values.find((v) => v.dataType === dataType);
    if (!item) return defaultValue;
    // Retorna a propriedade 'val' (da nossa API) ou 'value' (do ThingsBoard)
    return item.val !== undefined ? item.val : item.value;
  };

  // 1. Usamos Object.entries para manter o [entityId, deviceObject]
  const devicesFormatadosParaCards = Object.entries(devices)
    // 2. Filtramos para manter apenas os que receberam o valor da API
    .filter(([entityId, device]) =>
      device.values.some((valor) => valor.dataType === "total_consumption")
    )
    // 3. Mapeamos os filtrados para o formato final do card
    .map(([entityId, device]) => {
      return {
        entityId: entityId,
        labelOrName: device.label,
        val: findValue(device.values, "total_consumption", 0),
        deviceIdentifier: findValue(device.values, "identifier"),
        deviceType: findValue(device.values, "deviceType"),
        connectionStatus: findValue(device.values, "connectionStatus"),
        valType: "power_kw",
        perc: Math.floor(Math.random() * (95 - 70 + 1)) + 70,
        temperatureC: Math.floor(Math.random() * (35 - 25 + 1)) + 25,
        operationHours: parseFloat((Math.random() * 100).toFixed(3)),
      };
    });
renderAllCards()
//   console.log(
//     "[equipaments] 🚀 Array Final formatado para os cards:",
//     devicesFormatadosParaCards
//   );
//   console.log(
//     `[equipaments] Total de cards a serem renderizados: ${devicesFormatadosParaCards.length}`
//   );

  // AGORA, a sua função initializeCards deve receber esta nova variável!
  initializeCards(devicesFormatadosParaCards);

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
