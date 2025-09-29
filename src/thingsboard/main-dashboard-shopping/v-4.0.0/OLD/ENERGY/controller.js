// ✨ NEW - temporary Customer Data API token & switch
const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
const GROUPS = {
  "Entrada e Relógios": [],
  "Administração e Bombas": [],
  Lojas: [],
};

// ✨ NEW - optional: hardcode customerId here OR read from widget settings (preferred)
let CUSTOMER_ID;
let CLIENT_ID;
let CLIENT_SECRET;
let administration;
let entranceClock;
let hierarchyMap = new Map();

// --- Config centralizada (fácil de manter/trocar ícones) ---
const DEVICE_SPRITES = {
  relogio: {
    on: "/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB",
    off: "/api/images/public/rYrcTQlf90m7zH9ZIbldz6KIZ7jdb5DU",
  },
  subestacao: {
    on: "/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU",
    off: "/api/images/public/HnlvjodeBRFBc90xVglYI9mIpF6UgUmi",
  },
  bomba_chiller: {
    on: "/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT",
    off: "/api/images/public/8Ezn8qVBJ3jXD0iDfnEAZ0MZhAP1b5Ts",
  },
  default: {
    on: "/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k",
    off: "/api/images/public/sdTe2CPTbLPkbEXBHwaxjSAGVbp4wtIa",
  },
};

// --- Util: normaliza acentos/caixa  e espaços para comparar com segurança ---
function normalizeLabel(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // opcional: colapsa espaços
}

// --- Classificador por palavras-chave (rápido e legível) ---
function classifyDevice(labelOrName = "") {
  const s = normalizeLabel(labelOrName);
  if (/\brelogio\b/.test(s)) return "relogio";
  if (/subesta/.test(s)) return "subestacao";
  if (/bomba|chiller/.test(s)) return "bomba_chiller";
  if (/administra/.test(s)) return "administracao";

  return "default";
}

/**
 * Retorna a URL da imagem do device.
 * @param {string} labelOrName - título/label do device
 * @param {object} [opts]
 * @param {boolean} [opts.isOn] - se informado, escolhe on/off; se omitido, usa 'on' como padrão visual
 * @returns {string} URL do ícone
 */
function getDeviceImage(labelOrName, opts = {}) {
  const cat = classifyDevice(labelOrName);
  const sprite = DEVICE_SPRITES[cat] || DEVICE_SPRITES.default;
  const isOn = opts.isOn ?? true; // se não passar, assume 'on' (mesmo comportamento da versão simples)
  return isOn ? sprite.on : sprite.off;
}

function isLojaLabel(labelOrName = "") {
  const cat = classifyDevice(labelOrName);
  return cat === "default";
}

// Se quiser expor global:
window.getDeviceImage = getDeviceImage;

// --- DATES STORE MODULE (replaces shared date state) ---
const DatesStore = (() => {
  let state = {
    start: "",
    end: "",
  };

  function normalize(d) {
    return d && d.includes("T") ? d.slice(0, 10) : d;
  }

  return {
    get() {
      return {
        ...state,
      };
    },
    set({ start, end } = {}) {
      if (start) state.start = normalize(start);
      if (end) state.end = normalize(end);
      console.log("[DATES] set →", JSON.stringify(state));
      // Reflect to main board inputs only (not popups)
      $("#startDate").val(state.start || "");
      $("#endDate").val(state.end || "");
      EventBus.emit("dates:changed", {
        ...state,
      });
    },
  };
})();

// Small event bus used only for logs/notification (no behavior attached)
const EventBus = (() => {
  const handlers = {};
  return {
    on(evt, fn) {
      (handlers[evt] = handlers[evt] || []).push(fn);
    },
    off(evt, fn) {
      handlers[evt] = (handlers[evt] || []).filter((h) => h !== fn);
    },
    emit(evt, payload) {
      (handlers[evt] || []).forEach((h) => h(payload));
    },
  };
})();

function initializeMainBoardController() {
  // MAIN controller bootstrap
  self.ctx.getDates = () => DatesStore.get();
  self.ctx.setDates = (d) => DatesStore.set(d);

  // Initialize MyIOLibrary.createDateRangePicker
  const dateRangePickerContainer = document.getElementById('myio-date-range-picker');
  if (dateRangePickerContainer) {
    // Get default dates (current month start to today)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultStart = firstDay.toISOString().split('T')[0];
    const defaultEnd = now.toISOString().split('T')[0];

    // Initialize the date range picker
    const dateRangePicker = MyIOLibrary.createDateRangePicker({
      container: dateRangePickerContainer,
      startDate: defaultStart,
      endDate: defaultEnd,
      maxRangeDays: 31,
      onChange: (dates) => {
        console.log("[MAIN] Date range picker changed", dates);
        DatesStore.set({
          start: dates.startDate,
          end: dates.endDate,
        });
      }
    });

    // Store reference for later use
    self.ctx.dateRangePicker = dateRangePicker;

    // Set initial dates in store
    DatesStore.set({
      start: defaultStart,
      end: defaultEnd,
    });
  } else {
    console.warn("[MAIN] Date range picker container not found");
  }

  // Main load button ONLY updates main board; no popup calls
  $(document)
    .off("click.myioLoadMain", "#btn-load")
    .on("click.myioLoadMain", "#btn-load", async (ev) => {
      ev.preventDefault();
      const { start, end } = DatesStore.get();
      if (!start || !end) return alert("Selecione as duas datas.");

      console.log("[MAIN] Load clicked with", {
        start,
        end,
      });
      await loadMainBoardData(start, end);
      console.log("[MAIN] Board refresh completed");
    });
}

// Main board data loading function (isolated)
async function loadMainBoardData(start, end) {
  try {
    // Update scope dates for main board
    self.ctx.$scope.startDate = start;
    self.ctx.$scope.endDate = end;
    self.ctx.$scope.startTs = new Date(`${start}T00:00:00-03:00`).getTime();
    self.ctx.$scope.endTs = new Date(`${end}T23:59:59-03:00`).getTime();

    // Reload main board data only
    await self.onInit();
    self.ctx.detectChanges?.();
  } catch (err) {
    console.error("[MAIN] Error loading board data:", err);
  }
}

// --- VISIBILIDADE + MAPA DE COLUNAS ---
// chama no início do onInit
function applyGroupVisibilityAndMap() {
  const s = self.ctx.settings || {};
  const commomAreaRaw = (s.existsCommomArea ?? "").toString().toLowerCase();
  const entryPowerRaw = (s.existsEntryPower ?? "").toString().toLowerCase();

  const hideCommonArea = commomAreaRaw === "false"; // ℹ️ Informações
  const hideEntryPower = entryPowerRaw === "false"; // Entrada e Relógios

  // 1) Esconde/Remove colunas
  if (hideCommonArea) $(".group-card.area-comum").remove();
  if (hideEntryPower) $(".group-card.entrada").remove();

  // 2) (Opcional) evita lógicas futuras nesses grupos
  try {
    if (hideEntryPower) delete GROUPS["Entrada e Relógios"];
  } catch (e) {}

  // 3) Reconstrói o mapa só com colunas que existem
  self.ctx.groupDivs = {
    "Entrada e Relógios": $(".group-card.entrada"),
    "Administração e Bombas": $(".group-card.administracao"),
    Lojas: $(".group-card.lojas"),
    "ℹ️ Informações": $(".group-card.area-comum"), // se você usa essa chave em algum lugar
  };

  // Remove chaves cujos seletores não encontraram nada
  Object.keys(self.ctx.groupDivs).forEach((k) => {
    const $col = self.ctx.groupDivs[k];

    if (!$col || $col.length === 0) delete self.ctx.groupDivs[k];
  });

  // Helper para testar se um grupo está visível
  self.ctx.isGroupVisible = (name) =>
    !!(
      self.ctx.groupDivs &&
      self.ctx.groupDivs[name] &&
      self.ctx.groupDivs[name].length
    );

  // Protege atualizações de header de grupos inexistentes
  window.updateGroupHeader = function (groupName, count, totalText) {
    if (!self.ctx.isGroupVisible(groupName)) return; // grupo oculto

    const $title = $(
      `.group-title .group-count[data-group-count="${groupName}"]`
    ).closest(".group-title");

    if (!$title.length) return;
    if (count !== undefined)
      $title.find(`[data-group-count="${groupName}"]`).text(count);
    if (totalText !== undefined)
      $title.find(`[data-group="${groupName}"]`).text(totalText);
  };
}
// --- fim: VISIBILIDADE + MAPA DE COLUNAS ---

/************************************************************
 * MyIOAuth - Cache e renovação de access_token para ThingsBoard
 * Autor: você :)
 * Dependências: nenhuma (usa fetch nativo)
 ************************************************************/
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
          "[MyIOAuth] Novo token obtido. Expira em ~",
          Math.round(Number(json.expires_in) / 60),
          "min"
        );

        return _token;
      } catch (err) {
        attempt++;
        console.warn(
          `[MyIOAuth] Erro ao obter token (tentativa ${attempt}/${RETRY_MAX_ATTEMPTS}):`,
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

// Helper: RFC-compliant ISO timestamp with timezone offset
function toISOWithOffset(dateOrMs, endOfDay = false, tz = "America/Sao_Paulo") {
  const d = new Date(dateOrMs);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");

  if (endOfDay) d.setHours(23, 59, 59, 999);

  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = fmt
    .formatToParts(d)
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;

  // Compute the numeric offset for the given tz at 'd'
  const localMs = new Date(local).getTime();
  const offsetMin = Math.round((localMs - d.getTime()) / 60000);
  const sign = offsetMin <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");

  return `${local}${sign}${hh}:${mm}`;
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
      `[fetchWithAuth] 401 on ${
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

// Helper: Fetch all customer totals with pagination.
/*
async function fetchAllCustomerTotals(baseUrl) {
  let page = 1;
  const pageSize = 100;
  let all = [];
  
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${baseUrl}&page=${page}&pageSize=${pageSize}&deep=0`;
    const res = await fetchWithAuth(url);
    const chunk = await res.json();
    
    const dataList = Array.isArray(chunk) ? chunk : (chunk.data || []);
    if (!Array.isArray(dataList) || dataList.length === 0) break;
    
    all = all.concat(dataList);
    if (dataList.length < pageSize) break;
    page++;
  }
  
  return all;
}
*/

// Helper: Lightweight UUID validation
function isValidUUID(str) {
  if (!str || typeof str !== "string") return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to format timestamp to YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
function formatDateToYMD(timestampMs, withTime = false) {
  const tzIdentifier =
    self.ctx.timeWindow.timezone ||
    self.ctx.settings.timezone ||
    "America/Sao_Paulo";
  const date = new Date(timestampMs);

  if (withTime) {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: tzIdentifier,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    let formatted = formatter.format(date);

    // Se o format não tiver espaço (só data), completa com T00:00:00
    if (!formatted.includes(" ")) {
      return `${formatted}T00:00:00`;
    }

    return formatted.replace(" ", "T"); // YYYY-MM-DDTHH:mm:ss
  } else {
    // Só a data
    const formatter = new Intl.DateTimeFormat("default", {
      timeZone: tzIdentifier,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year").value;
    const month = parts.find((p) => p.type === "month").value;
    const day = parts.find((p) => p.type === "day").value;

    return `${year}-${month}-${day}`;
  }
}

// Helper function to determine a suitable interval based on time duration
function determineInterval(startTimeMs, endTimeMs) {
  const durationMs = endTimeMs - startTimeMs;
  const durationDays = durationMs / (1000 * 60 * 60 * 24);

  if (durationDays > 2) {
    // More than 2 days
    return "1 month";
  } else {
    // 2 days or less
    return "1 day";
  }
}

function fmtPerc(v) {
  const num = Number(v);
  if (isNaN(num)) return "0.0"; // fallback seguro
  if (num > 0 && num < 0.1) return "<0,1";
  return num.toFixed(1);
}

function createInfoCard(title, value, percentage, img) {
  return $(`
<div class="info-card" style="height: 170px;">
  <div class="device-main-content" style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 4px;">
    
    <div class="device-title-row" style="margin-bottom: 2px;">
      <span class="device-title" title="${title}">${title}</span>
    </div>

    ${img ? `<img class="device-image" src="${img}" />` : ""}

    <div class="device-data-row">
        <div style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: bold; color: #28a745;">
          <span class="flash-icon flash">⚡</span>
          <span class="consumption-value">${MyIOLibrary.formatEnergy(
            value
          )}</span>
          ${
            percentage != null
              ? `<span class="device-title-percent" style="color: rgba(0,0,0,0.5); font-weight: 500;">(${MyIOLibrary.formatNumberReadable(
                  percentage
                )}%)</span>`
              : ""
          }
        </div>
    </div>

  </div>
</div>
`);
}

async function openDashboardPopupEnergy(
  entityId,
  entityType,
  entitySlaveId,
  entityCentralId,
  entityIngestionId,
  entityLabel,
  entityComsuption
) {
  $("#dashboard-popup").remove();
  const settings = self.ctx.settings || {};

  // ✨ FIX: usa o estado compartilhado (getDates) como fonte única da verdade
  const { start, end } = self.ctx.getDates();
  $("#start-date").val(start || "");
  $("#end-date").val(end || "");

  const startDateTs = new Date(`${start}T00:00:00-03:00`);
  const endDateTs = new Date(`${end}T23:59:59-03:00`);

  const startTs = startDateTs.getTime();
  const endTs = endDateTs.getTime();
  const labelDefault = entityLabel || "SEM-LABEL";
  const gatewayId = entityCentralId;
  // ✨ FIX: Use toISOWithOffset instead of formatDateToYMD for v2 chart
  const startDateTime = toISOWithOffset(startTs);
  const endDateTime = toISOWithOffset(endTs, true);

  // Estado/variáveis globais para o widget
  window.consumption = 0;
  let percentageValue = 0; // percentual com sinal, número
  let percentages = 0; // percentual sem sinal, string formatada (ex: "12.3")
  let percentageType = "neutral"; // "increase", "decrease", "neutral"
  let isLoading = false;
  let errorMessage = "";
  let lastConsumption = 0;
  const measurement = "kWh";

  const img = getDeviceImage(labelDefault);
  const deviceId = entityId;
  const jwtToken = localStorage.getItem("jwt_token");

  // Variáveis para atributos da API que preencherão o widget
  let attrs = {
    label: "",
    andar: "",
    numeroLoja: "",
    identificadorMedidor: "",
    identificadorDispositivo: "",
    guid: "",
    consumoDiario: 0,
    consumoMadrugada: 0,
  };

  async function getEntityInfoAndAttributes() {
    try {
      const entityResponse = await fetch(`/api/device/${deviceId}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwtToken}`,
        },
      });
      if (!entityResponse.ok) throw new Error("Erro ao buscar entidade");

      const entity = await entityResponse.json();
      const label = entity.label || entity.name || "Sem etiqueta";

      const attrResponse = await fetch(
        `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?scope=SERVER_SCOPE`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `Bearer ${jwtToken}`,
          },
        }
      );
      if (!attrResponse.ok) throw new Error("Erro ao buscar atributos");

      const attributes = await attrResponse.json();
      const get = (key) => {
        const found = attributes.find((attr) => attr.key === key);
        return found ? found.value : "";
      };

      return {
        label,
        andar: get("floor") || "",
        numeroLoja: get("NumLoja") || "",
        identificadorMedidor: get("IDMedidor") || "",
        identificadorDispositivo: get("deviceId") || "",
        guid: get("guid") || "",
        consumoDiario: Number(get("maxDailyConsumption")) || 0,
        consumoMadrugada: Number(get("maxNightConsumption")) || 0,
      };
    } catch (error) {
      console.error("Erro ao buscar dados da entidade/atributos:", error);
      return {};
    }
  }

  function renderWidget() {
    const displayLabel = attrs.label
      ? attrs.label.toUpperCase()
      : labelDefault.toUpperCase();

    // Determinar cor, sinal e seta com base no tipo e valor real
    const sign =
      percentageType === "increase"
        ? "+"
        : percentageType === "decrease"
        ? "-"
        : "";
    const arrow =
      percentageType === "increase"
        ? "▲"
        : percentageType === "decrease"
        ? "▼"
        : "";
    const color =
      percentageType === "increase"
        ? "#D32F2F"
        : percentageType === "decrease"
        ? "#388E3C"
        : "#000";

    return `
<div class="myio-sum-comparison-card" style="
    flex: 1; 
    display: flex; 
    flex-direction: column; 
    justify-content: flex-start; 
    padding: 12px; 
    box-sizing: border-box; 
    background-color: var(--tb-service-background,#fff); 
    border-radius: var(--tb-border-radius,4px); 
    box-shadow: 0 2px 4px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.05);
    min-height: 0;
">
    <!-- Título -->
    <div style="text-align:center; font-size:1.2rem; font-weight:600; margin-bottom:4px; display:flex; align-items:center; justify-content:center; gap:8px;">
     <div class="myio-lightning-icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" width="28px" height="28px" viewBox="0 -880 960 960" fill="var(--tb-primary-700,#FFC107)" style="display:block;">
                <path d="m456-200 174-340H510v-220L330-420h126v220Zm24 120q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
            </svg>
        </div>
        ${displayLabel}
    </div>

    <!-- Ícone -->
    <div style="text-align:center; margin-bottom:8px;">
        <img src="${img}" alt="ícone" width="92" height="92" style="object-fit: contain;" />
    </div>

    <!-- Valor + Percentual -->
    <div style="display:flex; justify-content:center; align-items:center; margin-bottom:4px; display: none">
        <div style="font-size:1.4rem; font-weight:600; color:#212121;">
            ${MyIOLibrary.formatEnergy(window.consumption)}
        </div>
        <div style="margin-left:8px; font-size:1rem; font-weight:600; color: ${color};">
            ${sign}${MyIOLibrary.formatNumberReadable(percentageValue)}%
            ${arrow}
        </div>
    </div>
      <style>
    .info-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #f9f9f9;
    }
    .info-item label {
      font-size: 0.85rem;
      font-weight: 600;
    }
    .info-item input {
      padding: 4px;
      border: 1px solid #ddd;
      border-radius: 4px;
      outline: none;
      font-size: 0.85rem;
      background: #fff;
    }
  </style>

    <!-- Último período -->
    <div style="text-align:center; font-size:0.85rem; color:#757575; margin-bottom:12px; display: none">
        Último período: <strong>${MyIOLibrary.formatEnergy(
          lastConsumption
        )}</strong>
    </div>

    <!-- Campos extras -->
    <div style="display:flex; flex-direction:column; gap:6px; font-size:0.85rem;">
      
      <div class="info-item">
        <label>Etiqueta</label>
        <input type="text" value="${displayLabel}" readonly>
      </div>
      
      <div class="info-item">
        <label>Andar</label>
        <input type="text" value="${attrs.andar}" readonly>
      </div>
      
      <div class="info-item">
        <label>Número da Loja</label>
        <input type="text" value="${attrs.numeroLoja}" readonly>
      </div>
      
      <div class="info-item">
        <label>Identificador do Medidor</label>
        <input type="text" value="${attrs.identificadorMedidor}" readonly>
      </div>
      
      <div class="info-item">
        <label>Identificador do Dispositivo</label>
        <input type="text" value="${attrs.identificadorDispositivo}" readonly>
      </div>
      
      <div class="info-item">
        <label>GUID</label>
        <input type="text" value="${attrs.guid}" readonly>
      </div>

    </div>

</div>
        `;
  }

  function updateWidgetContent() {
    const container = document.getElementById("consumo-widget-container");
    if (container) {
      container.innerHTML = renderWidget();
    }
  }

  async function enviarDados() {
    isLoading = true;
    errorMessage = "";
    updateWidgetContent();

    try {
      const consumoAtual = attrs.consumoDiario || 0;
      const consumoAnterior = attrs.consumoMadrugada || 0;

      window.consumption = consumoAtual;
      lastConsumption = consumoAnterior;

      if (consumoAnterior === 0 && consumoAtual === 0) {
        percentageValue = 0;
        percentages = "0";
        percentageType = "neutral";
      } else if (consumoAnterior === 0 && consumoAtual > 0) {
        percentageValue = 100;
        percentages = "100";
        percentageType = "increase";
      } else {
        const diff = consumoAtual - consumoAnterior;
        const percent = (diff / consumoAnterior) * 100;
        percentageValue = percent;
        percentages = Math.abs(percent).toFixed(1);
        if (percent > 0) {
          percentageType = "increase";
        } else if (percent < 0) {
          percentageType = "decrease";
        } else {
          percentageType = "neutral";
        }
      }
    } catch (error) {
      errorMessage = "Erro ao carregar dados: " + error.message;
      console.error(error);
    } finally {
      isLoading = false;
      updateWidgetContent();
    }
  }

  // Criar popup HTML e inserir no body
  const $popup = $(`
  <div id="dashboard-overlay" style="
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    background: rgba(0,0,0,0.25);
  ">
    <div id="dashboard-modal" style="
      width: 80vw;
      border-radius: 10px;
      background: #f7f7f7;
      box-shadow: 0 0 20px rgba(0,0,0,0.35);
      overflow: auto;
      display: flex;
      flex-direction: column;
    ">
      <!-- cabeçalho -->
      <div id="dashboard-header" style="
        height: 56px;
        background: #4A148C;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        font-weight: 700;
        font-size: 1.05rem;
      ">
        <div>Consumo de Energia</div>
        <button id="close-dashboard-popup" style="
          background: #f44336;
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          line-height: 1;
        ">×</button>
      </div>

      <!-- conteúdo com os cards -->
      <div id="dashboard-cards-wrap" style="
        display: flex;
        gap: 20px;
        padding: 20px;
        box-sizing: border-box;
        align-items: stretch;
        min-height: calc(90vh - 56px);
      ">
        <!-- Card 1 (33%) -->
        <div style="
          flex: 0 0 33%;
          display: flex;
          flex-direction: column;
          min-width: 0;
          border-radius: 6px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          overflow: hidden;
        ">
          <div id="consumo-widget-container" class="myio-sum-comparison-card" style="
            padding: 16px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100%;
            box-sizing: border-box;
          ">
            ${renderWidget()}
          </div>
        </div>

        <!-- Card 2 (65%) -->
        <div style="
          flex: 0 0 65%;
          display: flex;
          flex-direction: column;
          min-width: 0;
          border-radius: 6px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          overflow: hidden;
        ">
          <div id="chart-container" style="
            padding: 16px;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
          ">
            <!-- gráfico -->
          </div>
        </div>

      </div>
    </div>
  </div>
`);

  $("body").append($popup);

  // === DEVICE DETAIL POPUP: FULLY LOCAL STATE + LOCAL BUTTON ===
  const detailState = {
    start: "",
    end: "",
  };

  function setDetailDates({ start, end }) {
    if (start) detailState.start = start;
    if (end) detailState.end = end;
    console.log("[DETAIL] set dates →", detailState);
    $popup.find("#start-date").val(detailState.start || "");
    $popup.find("#end-date").val(detailState.end || "");
  }

  // Initialize with current main dates (read-only copy)
  setDetailDates(DatesStore.get());

  // Local inputs (scoped to this popup)
  $popup
    .off("change.detailDates", "#start-date,#end-date")
    .on("change.detailDates", "#start-date,#end-date", () => {
      setDetailDates({
        start: $popup.find("#start-date").val(),
        end: $popup.find("#end-date").val(),
      });
    });

  // Local load button (scoped) – no global $scope.loadDataForPopup
  $popup
    .off("click.detailLoad", ".detail-load")
    .on("click.detailLoad", ".detail-load", async () => {
      const { start, end } = detailState;
      if (!start || !end) return alert("Selecione as datas de início e fim.");
      console.log("[DETAIL] Load clicked with", {
        start,
        end,
      });

      try {
        // Build ISO range and render the v2 chart here (local only)
        const startIso = toISOWithOffset(new Date(`${start}T00:00:00`));
        const endIso = toISOWithOffset(new Date(`${end}T23:59:59`), true);
        console.log("[DETAIL] Rendering chart", {
          startIso,
          endIso,
          deviceId: entityIngestionId,
        });

        // Destroy previous chart instance
        if (self.chartInstance?.destroy) {
          console.log("[DETAIL] Destroying existing chart instance");
          self.chartInstance.destroy();
        }
        if (self.chartContainerElement) {
          self.chartContainerElement.innerHTML = "";
        }

        // Render new chart with local dates
        const timeZoneIdentifier =
          self.ctx.timeWindow.timezone ||
          self.ctx.settings.timezone ||
          "America/Sao_Paulo";

        self.chartInstance = window.EnergyChartSDK.renderTelemetryChart(
          self.chartContainerElement,
          {
            version: "v2",
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            deviceId: entityIngestionId,
            readingType: "energy",
            startDate: startIso,
            endDate: endIso,
            granularity: "1d",
            theme: self.ctx.settings?.theme || "light",
            timezone: timeZoneIdentifier,
            iframeBaseUrl: "https://graphs.apps.myio-bas.com",
            apiBaseUrl: DATA_API_HOST,
          }
        );

        // Update comparison data with local dates
        const u = new Date(`${start}T00:00:00-03:00`).getTime();
        const f = new Date(`${end}T23:59:59-03:00`).getTime();

        console.log(
          `[DETAIL] Fetching comparison data for gatewayId: ${entityCentralId}, slaveId: ${entitySlaveId}`
        );
        const sum =
          await window.EnergyChartSDK.EnergyChart.getEnergyComparisonSum({
            gatewayId: entityCentralId,
            slaveId: entitySlaveId,
            startTs: new Date(u),
            endTs: new Date(f),
            apiBaseUrl: DATA_API_HOST,
          });

        console.log("[DETAIL] Comparison data received:", sum);

        window.consumption = sum.currentPeriod.totalKwh || 0;
        lastConsumption = sum.previousPeriod.totalKwh || 0;

        const diff = window.consumption - lastConsumption;
        let pct = 0;
        if (lastConsumption !== 0)
          pct = (diff / Math.abs(lastConsumption)) * 100;
        else if (window.consumption > 0) pct = 100;

        percentageValue = pct;
        percentages = Math.abs(pct).toFixed(1);
        percentageType =
          pct > 0 ? "increase" : pct < 0 ? "decrease" : "neutral";

        console.log(
          `[DETAIL] Updated consumption: ${window.consumption} kWh, percentage: ${percentageValue}%`
        );

        updateWidgetContent(); // refresh the left card display
        console.log("[DETAIL] Data refresh complete");
      } catch (err) {
        console.error("[DETAIL] Error", err);
        // Show error in popup if needed
        if (self.chartContainerElement) {
          self.chartContainerElement.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">Erro: ${err.message}</div>`;
        }
      }
    });

  self.chartContainerElement = document.getElementById("chart-container");
  if (!self.chartContainerElement) {
    console.error("[DETAIL] #chart-container not found. Abort chart render.");
    return;
  }

  // Log popup open event
  console.log("[DETAIL] popup open", {
    deviceId: entityId,
    gatewayId: entityCentralId,
    slaveId: entitySlaveId,
  });
  $popup.on("remove", () => console.log("[DETAIL] popup closed"));

  // Fechar popup no botão
  $(document).on("click", "#close-dashboard-popup", () => {
    $("#dashboard-overlay").remove();
  });

  // Buscar atributos e atualizar o widget
  attrs = await getEntityInfoAndAttributes();

  // Atualiza a label também, que era fixa
  if (attrs.label) {
    entityLabel = attrs.label;
  }

  // Atualiza o widget com os dados novos
  updateWidgetContent();

  // Atualiza o consumo e percentual (usa dados dos atributos)
  await enviarDados();

  function createRenderTelemetryChartSDK() {
    if (
      window.EnergyChartSDK &&
      typeof window.EnergyChartSDK.renderTelemetryChart === "function"
    ) {
      return window.EnergyChartSDK.renderTelemetryChart;
    } else {
      console.error("EnergyChartSDK v2 (renderTelemetryChart) not loaded!");

      if (self.chartContainerElement) {
        self.chartContainerElement.innerHTML =
          '<div style="padding: 20px; text-align: center; color: red;">EnergyChartSDK v2 (renderTelemetryChart) not loaded. Check widget configuration and browser console.</div>';
      }

      return;
    }
  }

  function doInitialSetupToRenderEnergyChart() {
    // Destroy previous instance if it exists
    if (
      self.chartInstance &&
      typeof self.chartInstance.destroy === "function"
    ) {
      self.chartInstance.destroy();
      self.chartInstance = null;
    }
    // Ensure container is clean (SDK's destroy should handle iframe, but good practice)
    if (self.chartContainerElement) {
      self.chartContainerElement.innerHTML = "";
    }
  }

  // Função para renderizar o gráfico de energia no popup
  function renderEnergyChartInPopup({
    ingestionId,
    startDateTime,
    endDateTime,
    settings,
  }) {
    //doInitialSetupToRenderEnergyChart();

    // Destroy previous instance if it exists
    if (
      self.chartInstance &&
      typeof self.chartInstance.destroy === "function"
    ) {
      self.chartInstance.destroy();
      self.chartInstance = null;
    }
    // Ensure container is clean (SDK's destroy should handle iframe, but good practice)
    if (self.chartContainerElement) {
      self.chartContainerElement.innerHTML = "";
    }

    let renderTelemetryChart;
    if (
      window.EnergyChartSDK &&
      typeof window.EnergyChartSDK.renderTelemetryChart === "function"
    ) {
      renderTelemetryChart = window.EnergyChartSDK.renderTelemetryChart;
    } else {
      console.error("EnergyChartSDK v2 (renderTelemetryChart) not loaded!");
      if (self.chartContainerElement) {
        self.chartContainerElement.innerHTML =
          '<div style="padding: 20px; text-align: center; color: red;">EnergyChartSDK v2 (renderTelemetryChart) not loaded. Check widget configuration and browser console.</div>';
      }
      return;
    }

    const tzIdentifier =
      self.ctx.timeWindow.timezone ||
      self.ctx.settings.timezone ||
      "America/Sao_Paulo";

    // Format datetime with hour/minute/second precision for v2 API
    const granularity = "1d"; // determineGranularity(timeWindow.minTime, timeWindow.maxTime);
    const theme = settings.theme || "light";
    //const CLIENT_ID = "ADMIN_DASHBOARD_CLIENT";
    //const CLIENT_SECRET = "admin_dashboard_secret_2025";

    // ✨ ADD: Sanity logs for debugging
    console.log("[popup] deviceId:", ingestionId);
    console.log("[popup] start:", startDateTime, "end:", endDateTime);

    console.log(
      `Initializing v2 chart with: deviceId=${ingestionId}, startDateTime=${startDateTime}, endDateTime=${endDateTime}, granularity=${granularity}, theme=${theme}, apiBaseUrl=${DATA_API_HOST}, timezone=${tzIdentifier}`
    );

    self.chartInstance = renderTelemetryChart(self.chartContainerElement, {
      version: "v2",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      deviceId: ingestionId,
      readingType: "energy",
      startDate: startDateTime,
      endDate: endDateTime,
      granularity: granularity,
      theme: theme,
      timezone: tzIdentifier,
      iframeBaseUrl: "https://graphs.apps.myio-bas.com",
      apiBaseUrl: DATA_API_HOST,
    });

    // Attach event listeners if SDK supports it
    if (self.chartInstance && typeof self.chartInstance.on === "function") {
      self.chartInstance.on("drilldown", (data) => {
        console.log("v2 SDK Drilldown Event:", data);
        // Example: Emit custom event for ThingsBoard dashboard actions
        // self.ctx.actionsApi.handleWidgetAction({ actionIdentifier: 'customDrilldownV2', dataContext: data });
      });
      self.chartInstance.on("error", (errorData) => {
        console.error("v2 SDK Error Event:", errorData);
        if (self.chartContainerElement) {
          self.chartContainerElement.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">v2 Chart Error: ${
            errorData.message || "Unknown error"
          }</div>`;
        }
      });
    } else if (self.chartInstance) {
      console.warn(
        "EnergyChartSDK v2 instance does not have an 'on' method for event listeners."
      );
    }
  }

  renderEnergyChartInPopup({
    ingestionId: entityIngestionId,
    startDateTime,
    endDateTime,
    settings,
  });

  // Atualiza dados comparativos do consumo
  async function updateComparativeConsumptionData() {
    const params = {
      gatewayId: gatewayId,
      slaveId: entitySlaveId,
      startTs: new Date(startTs),
      endTs: new Date(endTs),
      apiBaseUrl: DATA_API_HOST,
    };

    try {
      const comparisonData =
        await window.EnergyChartSDK.EnergyChart.getEnergyComparisonSum(params);
      window.consumption = comparisonData.currentPeriod.totalKwh || 0;
      lastConsumption = comparisonData.previousPeriod.totalKwh || 0;

      const diff = window.consumption - lastConsumption;
      let percentageChange = 0;
      if (lastConsumption !== 0) {
        percentageChange = (diff / Math.abs(lastConsumption)) * 100;
      } else if (window.consumption > 0) {
        percentageChange = 100;
      }
      percentageValue = percentageChange;
      percentages = Math.abs(percentageChange).toFixed(1);
      percentageType =
        percentageChange > 0
          ? "increase"
          : percentageChange < 0
          ? "decrease"
          : "neutral";

      updateWidgetContent();
    } catch (error) {
      console.error("Erro ao buscar dados comparativos:", error);
    }
  }

  await updateComparativeConsumptionData();

  // Event listener para fechar popup (se ainda não foi definido)
  $("#close-dashboard-popup").on("click", () =>
    $("#dashboard-overlay").remove()
  );
}

async function openDashboardPopup(entityId, entityType, insueDate) {
  $("#dashboard-popup").remove();

  const jwtToken = localStorage.getItem("jwt_token");

  async function getEntityInfoAndAttributes(deviceId, jwtToken) {
    try {
      // 1. Buscar info da entidade (label verdadeiro)
      const entityResponse = await fetch(`/api/device/${deviceId}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwtToken}`,
        },
      });
      if (!entityResponse.ok) throw new Error("Erro ao buscar entidade");

      const entity = await entityResponse.json();
      const label = entity.label || entity.name || "Sem etiqueta";

      // 2. Buscar atributos SERVER_SCOPE
      const attrResponse = await fetch(
        `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?scope=SERVER_SCOPE`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `Bearer ${jwtToken}`,
          },
        }
      );
      if (!attrResponse.ok) throw new Error("Erro ao buscar atributos");

      const attributes = await attrResponse.json();
      const get = (key) => {
        const found = attributes.find((attr) => attr.key === key);
        return found ? found.value : "";
      };

      return {
        etiqueta: label,
        andar: get("floor"),
        numeroLoja: get("NumLoja"),
        identificadorMedidor: get("IDMedidor"),
        identificadorDispositivo: get("deviceId"),
        guid: get("guid"),
        consumoDiario: Number(get("maxDailyConsumption")) || 0,
        consumoMadrugada: Number(get("maxNightConsumption")) || 0,
        consumoComercial: Number(get("maxBusinessConsumption")) || 0,
      };
    } catch (error) {
      console.error("Erro ao buscar dados da entidade/atributos:", error);
      return {};
    }
  }

  const valores = await getEntityInfoAndAttributes(entityId, jwtToken);

  const $popup = $(`
<div id="dashboard-popup"
    style="position: fixed; top: 5%; left: 5%; width: 90%; height: 90%; background: #f7f7f7; border-radius: 10px; box-shadow: 0 0 15px rgba(0,0,0,0.4); z-index: 10000; display: flex; flex-direction: column; font-family: Arial, sans-serif;">

    <!-- Cabeçalho -->
    <div
        style="background: #4A148C; color: white; padding: 12px 20px; font-weight: bold; font-size: 1.1rem; border-top-left-radius: 10px; border-top-right-radius: 10px; flex-shrink: 0;">
        Configurações
        <button id="close-dashboard-popup"
            style="float: right; background: #f44336; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-weight: bold; cursor: pointer;">×</button>
    </div>

    <!-- Conteúdo -->
    <div class="popup-content" style="display: flex; justify-content: space-evenly; gap: 10px; padding: 10px; flex: 1; flex-wrap: wrap; box-sizing: border-box; overflow-y: auto;">
        
        <!-- Card Esquerdo -->
        <div class="card"
            style="flex: 1 1 300px; max-width: 45%; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 4px rgba(0,0,0,0.1); display: flex; flex-direction: column; box-sizing: border-box; min-height: 0;">
            
            <div style="flex: 1 1 auto; overflow-y: auto; min-height: 0;">
                <h3 style="color: #4A148C; margin-bottom: 20px;">${
                  valores.etiqueta || ""
                }</h3>

                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Etiqueta</label>
                <input type="text" class="form-input" value="${
                  valores.etiqueta || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Andar</label>
                <input type="text" class="form-input" value="${
                  valores.andar || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Número da Loja</label>
                <input type="text" class="form-input" value="${
                  valores.numeroLoja || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Identificador do Medidor</label>
                <input type="text" class="form-input" value="${
                  valores.identificadorMedidor || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Identificador do Dispositivo</label>
                <input type="text" class="form-input" value="${
                  valores.identificadorDispositivo || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">GUID</label>
                <input type="text" class="form-input" value="${
                  valores.guid || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />
            </div>

            <div style="margin-top: 20px; text-align: right; flex-shrink: 0;">
 </div>
        </div>

        <!-- Card Direito -->
        <div class="card"
            style="flex: 1 1 300px; max-width: 45%; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 0 4px rgba(0,0,0,0.1); display: flex; flex-direction: column; box-sizing: border-box; min-height: 0;">
            
            <div style="flex: 1 1 auto; overflow-y: auto; min-height: 0;">
                <h3 style="color: #4A148C; margin-bottom: 20px;">Alarmes Energia - ${
                  valores.etiqueta
                }</h3>

                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Consumo Máximo Diário (kWh)</label>
                <input type="text" class="form-input" value="${
                  valores.consumoDiario || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Consumo Máximo na Madrugada (0h - 06h) (kWh)</label>
                <input type="text" class="form-input" value="${
                  valores.consumoMadrugada || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Consumo Máximo Horário Comercial (09h - 22h) (kWh)</label>
                <input type="text" class="form-input" value="${
                  valores.consumoComercial || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />
            </div>

            <div style="margin-top: 20px; text-align: right; flex-shrink: 0;">

                <button 
    onclick="$('#dashboard-popup').remove();" 
    class="btn-desfazer" 
    style="background:#ccc; color:black; padding:6px 12px; border:none; border-radius:6px; cursor:pointer;">
    Fechar
</button>
                <button class="btn-salvar" style="background:#4A148C; color:white; padding:6px 14px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; margin-left:10px;">Salvar</button>
            </div>
        </div>
    </div>
</div>
`);

  $("body").append($popup);

  $("#close-dashboard-popup").on("click", () => $("#dashboard-popup").remove());

  $popup.find(".btn-salvar").on("click", async () => {
    const inputs = $popup.find("input.form-input");
    const novoLabel = inputs.eq(0).val(); // campo 0 = etiqueta

    const payloadAtributos = {
      floor: inputs.eq(1).val(),
      NumLoja: inputs.eq(2).val(),
      IDMedidor: inputs.eq(3).val(),
      deviceId: inputs.eq(4).val(),
      guid: inputs.eq(5).val(),
      maxDailyConsumption: inputs.eq(6).val(),
      maxNightConsumption: inputs.eq(7).val(),
      maxBusinessConsumption: inputs.eq(8).val(),
    };

    try {
      // 1. Buscar entidade completa
      const entityResponse = await fetch(`/api/device/${entityId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwtToken}`,
        },
      });

      if (!entityResponse.ok)
        throw new Error("Erro ao buscar entidade para atualizar label");

      const entity = await entityResponse.json();
      entity.label = novoLabel;

      // 2. Atualizar o label via POST (saveDevice)
      const updateLabelResponse = await fetch(`/api/device`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(entity),
      });

      if (!updateLabelResponse.ok)
        throw new Error("Erro ao atualizar etiqueta (label)");

      // 3. Enviar os atributos ao SERVER_SCOPE
      const attrResponse = await fetch(
        `/api/plugins/telemetry/DEVICE/${entityId}/SERVER_SCOPE`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `Bearer ${jwtToken}`,
          },
          body: JSON.stringify(payloadAtributos),
        }
      );

      if (!attrResponse.ok) throw new Error("Erro ao salvar atributos");

      alert("Configurações salvas com sucesso!");

      $("#dashboard-popup").remove();

      location.reload();
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
      alert("Erro ao salvar. Verifique o console.");
    }
  });
}

function updateReportTable() {
  const $reportBody = $("#reportBody");
  $reportBody.empty();

  if (!self.ctx.$scope.reportData || self.ctx.$scope.reportData.length === 0) {
    $reportBody.append(
      '<tr><td colspan="3" class="no-data">Nenhum dado disponível</td></tr>'
    );
    return;
  }

  self.ctx.$scope.reportData.forEach((device) => {
    const deviceId = device.deviceId || "-";
    const hierarchy = hierarchyMap.get(device.entityId);       
    const parentAsset = hierarchy?.parent;
    const grandparentAsset = hierarchy?.grandparent;
    const parentName = parentAsset ? (parentAsset.name) : null;
    const grandparentName = grandparentAsset ? (grandparentAsset.name) : "-";

    let finalDeviceIdentifier = parentName; 

    if (parentName && grandparentName && parentName.startsWith(grandparentName)) {
      finalDeviceIdentifier = parentName.slice(grandparentName.length);
    }       
    let $row;
    if (device.isValid) {
      $row = $(`
                <tr>
                    <td>${device.entityLabel}</td>
                    <td>${finalDeviceIdentifier}</td>
                    <td>${
                      device.consumptionKwh != null
                        ? MyIOLibrary.formatEnergy(device.consumptionKwh)
                        : "-"
                    }</td>
                </tr>
            `);
    } else {
      $row = $(`
                <tr class="invalid-device">
                    <td>${device.entityLabel}</td>
                    <td colspan="2">${device.error || "Inválido"}</td>
                </tr>
            `);
    }
    $reportBody.append($row);
  });
}

function exportToCSVAll(reportData) {
  if (!reportData?.length) {
    alert("Erro: Nenhum dado disponível para exportar.");
    return;
  }
  const rows = [];
  const agora = new Date();

  // Data
  const dia = agora.getDate().toString().padStart(2, "0");
  const mes = (agora.getMonth() + 1).toString().padStart(2, "0");
  const ano = agora.getFullYear();

  // Hora
  const horas = agora.getHours().toString().padStart(2, "0");
  const minutos = agora.getMinutes().toString().padStart(2, "0");

  // Formato final
  const dataHoraFormatada = `DATA EMISSÃO: ${dia}/${mes}/${ano} - ${horas}:${minutos}`;

  let totalconsumption = 0;
  reportData.forEach((data) => {
    totalconsumption = totalconsumption + data.consumptionKwh;
  });
  rows.push(["DATA EMISSÃO", dataHoraFormatada]);
  rows.push(["Total", totalconsumption.toFixed(2)]);
  rows.push(["Loja", "Identificador", "Consumo"]);
  reportData.forEach((data) => {
    rows.push([
      data.entityLabel || data.deviceName || "-",
      data.deviceId || "-",
      data.consumptionKwh != null
        ? formatNumberReadable(data.consumptionKwh)
        : "0,00",
    ]);
  });
  const csvContent =
    "data:text/csv;charset=utf-8," + rows.map((e) => e.join(";")).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute(
    "download",
    `relatorio_consumo_geral_por_loja_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderHeaderStats(reportData) {
  const elCount = document.getElementById("storesCount");
  const elTotal = document.getElementById("totalKwh");
  if (!elCount || !elTotal) return;

  // conta de linhas (se quiser contar só válidas, filtre aqui)
  const totalLojas = Array.isArray(reportData) ? reportData.length : 0;

  // soma consumo
  const totalKwh = (Array.isArray(reportData) ? reportData : []).reduce(
    (acc, row) => acc + (Number(row.consumptionKwh) || 0),
    0
  );

  elCount.textContent = totalLojas.toString();
  // use a mesma formatação do widget
  elTotal.textContent = MyIOLibrary.formatEnergy(totalKwh);
}

/**
 * Uma página do endpoint:
 * /api/v1/telemetry/customers/{customerId}/energy/devices/totals
 * baseUrl já deve conter startTime & endTime (e o que mais você quiser fixo).
 * Aqui só acrescentamos page & limit.
 */
async function fetchCustomerTotalsPage({
  baseUrl,
  token,
  page = 1,
  limit = 200,
}) {
  const url = `${baseUrl}&page=${page}&limit=${limit}`;
  console.info(
    `[fetchCustomerTotalsPage] GET page=${page} limit=${limit} → ${url}`
  );

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[fetchCustomerTotalsPage] ${res.status} ${res.statusText} ${text}`
    );
  }

  const json = await res.json();
  const got = Array.isArray(json?.data) ? json.data.length : 0;
  const pages = Number(json?.pagination?.pages || 1);
  const total = Number(json?.pagination?.total ?? got);

  console.debug(
    `[fetchCustomerTotalsPage] page=${page} got=${got} pages=${pages} total=${total}`
  );
  return json;
}

/**
 * Busca todas as páginas e devolve um ÚNICO array de items (achatado).
 * Usa pagination.pages quando disponível, com fallback por "data.length < limit".
 */
async function fetchAllCustomerTotals({ baseUrl, token, limit = 200 }) {
  console.log(`[fetchAllCustomerTotals] Start limit=${limit}`);
  console.log(`[fetchAllCustomerTotals] Probe first page...`);

  const first = await fetchCustomerTotalsPage({
    baseUrl,
    token,
    page: 1,
    limit,
  });
  const out = Array.isArray(first?.data) ? [...first.data] : [];

  let totalPages = Number(first?.pagination?.pages || 1);

  if (totalPages > 1) {
    for (let p = 2; p <= totalPages; p++) {
      const next = await fetchCustomerTotalsPage({
        baseUrl,
        token,
        page: p,
        limit,
      });
      if (Array.isArray(next?.data)) out.push(...next.data);
    }
  } else {
    // Fallback: se não veio pagination.pages, iterate até vir menos que limit
    const firstCount = Array.isArray(first?.data) ? first.data.length : 0;
    if (firstCount === limit) {
      let p = 2;
      while (true) {
        const next = await fetchCustomerTotalsPage({
          baseUrl,
          token,
          page: p,
          limit,
        });
        const items = Array.isArray(next?.data) ? next.data : [];
        out.push(...items);
        if (items.length < limit) break; // última página
        p++;
        if (p > 200) {
          // guarda
          console.warn(`[fetchAllCustomerTotals] Safety break at page ${p}`);
          break;
        }
      }
    }
  }

  console.log(`[fetchAllCustomerTotals] Done. items=${out.length}`);
  return out;
}

async function openDashboardPopupAllReport(entityId, entityType) {
  $("#dashboard-popup").remove();

  // Conteúdo interno do popup (a tabela do relatório)
  const popupContent = `
<div class="widget-container">
    <div class="widget-header">
        <h3 class="widget-title">Relatório de Consumo de Energia</h3>
        <div class="date-range">
            <input type="date" id="startDate">
            <span>até</span>
            <input type="date" id="endDate">
            <button class="load-button" id="loadDataBtn">
                <i class="material-icons">refresh</i>
                Carregar
            </button>
        </div>
        <div id="report-stats" style="
          display:flex; gap:14px; align-items:center; 
          background:#f5f5f5; border:1px solid #e0e0e0; 
          border-radius:6px; padding:6px 10px; font-size:14px;">
          <span>🛍️ Lojas: <strong id="storesCount">0</strong></span>
          <span>⚡ Total consumo: <strong id="totalKwh">0,00 kWh</strong></span>
        </div>
        <div style="display: flex; gap: 10px;"> 
            <button id="exportCsvBtn" disabled
              style="background-color: #ccc; color: #666; padding: 8px 16px; border: none; border-radius: 4px; cursor: not-allowed;">
             <span class="material-icons" style="font-size: 18px; line-height: 18px;">file_download</span>
            CSV
            </button>
        </div>
    </div>
    <div id="errorMessage" class="error-message" style="display:none;"></div>
    <div class="table-container" style="position: relative;">
        <div id="loadingOverlay" class="loading-overlay" style="display:none;">
            <i class="material-icons" style="font-size: 48px; color: #5c307d;">hourglass_empty</i>
        </div>
        <table id="reportTable">
            <thead>
                <tr>
                    <th class="sortable" data-sort-key="entityLabel">
                        <span class="label">Loja</span><span class="arrow"></span>
                    </th>
                    <th class="sortable" data-sort-key="identifier">
                        <span class="label">Identificador</span><span class="arrow"></span>
                    </th>
                    <th class="sortable" data-sort-key="consumptionKwh">
                        <span class="label">Consumo</span><span class="arrow"></span>
                    </th>
                </tr>
            </thead>
            <tbody id="reportBody">
                <tr><td colspan="3" class="no-data">Nenhum dado disponível</td></tr>
            </tbody>
        </table>
    </div>
</div>
<style id="report-sort-style">
#dashboard-popup th.sortable {
  user-select: none;
  cursor: pointer;
  white-space: nowrap;
}
#dashboard-popup th.sortable .label { margin-right: 8px; font-weight: 600; }
#dashboard-popup th.sortable .arrow {
  display: inline-block;
  width: 0; height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 7px solid currentColor; /* ▲ shape */
  transform: rotate(180deg);             /* default ↓ */
  transition: transform 120ms ease;
  opacity: .85; vertical-align: middle;
}
#dashboard-popup th.sortable.asc  .arrow { transform: rotate(0deg); }     /* ↑ */
#dashboard-popup th.sortable.desc .arrow { transform: rotate(180deg); }   /* ↓ */
#dashboard-popup th.sortable.active { filter: brightness(1.05); }

#container {
    overflow-y: auto;
}

#main.loading {
    height: 100%;
    width: 100%;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
}

#Myio{
    width: 150px;
    background-color: #3e1a7d;
    padding: 10px;
    border-radius: 5px;
}

#ReportHeader{
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 5px;
}

p{
    font-size: 13px;
    margin: 0;
    font-family: Roboto;
}

.button{
    all: unset;
    cursor: pointer;
    position: absolute;
    top: 8px;
    right: 40px;
}

.example-form-field{
    margin: 0;
}
.hide-in-csv.button{
    right: 60px;
}

.widget-container {
    font-family: 'Roboto', sans-serif;
    padding: 20px;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 16px;
}

.widget-title {
    font-size: 10px;
    font-weight: 200;
    color: #333;
    margin: 0;
}

.date-range {
    display: flex;
    align-items: center;
    gap: 8px;
}

.date-range input[type="date"] {
    padding: 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    font-family: 'Roboto', sans-serif;
    font-size: 14px;
    color: #333;
    background-color: white;
}

.date-range input[type="date"]:focus {
    outline: none;
    border-color: #5c307d;
}

.date-range span {
    color: #666;
    font-size: 14px;
}

.export-buttons {
    display: flex;
    gap: 10px;
}

.export-button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background-color: #5c307d;
    color: white;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background-color 0.2s;
}

.export-button:hover {
    background-color: #4a265f;
}

.export-button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
}

.table-container {
    flex: 1;
    overflow: auto;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}

table {
    width: 100%;
    border-collapse: collapse;
    background-color: white;
}

th {
    background-color: #5c307d;
    color: white;
    padding: 12px;
    text-align: left;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
    position: sticky;
    top: 0;
    z-index: 1;
}

th:hover {
    background-color: #4a265f;
}

td {
    padding: 12px;
    border-bottom: 1px solid #e0e0e0;
}

tr:nth-child(even) {
    background-color: #f5f7fa;
}

tr:hover {
    background-color: #f0f2f5;
}

.loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2;
}

.error-message {
    color: #d32f2f;
    padding: 12px;
    background-color: #ffebee;
    border-radius: 4px;
    margin-bottom: 16px;
}

.no-data {
    text-align: center;
    padding: 32px;
    color: #666;
}

.sort-icon {
    margin-left: 4px;
    font-size: 12px;
}

.error-cell {
    color: #d32f2f;
    font-style: italic;
}

.invalid-device {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #d32f2f;
}

.invalid-device .material-icons {
    font-size: 16px;
    color: #d32f2f;
}

.load-button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background-color: #5c307d;
    color: white;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background-color 0.2s;
}

.load-button:hover {
    background-color: #4a265f;
}

.load-button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
}

.load-button .material-icons {
    font-size: 18px;
}
.widget-container { font-family: 'Roboto', sans-serif; padding: 20px; height: 100%; display: flex; flex-direction: column; }
/* ... resto do CSS ... */
</style>
`;

  const $popup = $(`
<div id="dashboard-popup" style="
    position: fixed; top: 5%; left: 5%;
    width: 90%; height: 90%;
    background: white;
    border-radius: 8px;
    box-shadow: 0 0 15px rgba(0,0,0,0.5);
    z-index: 10000;
    overflow: hidden;
    display: flex; flex-direction: column;
">
    <div style="
        background: #4A148C;
        color: white;
        padding: 12px 20px;
        font-weight: bold;
        font-size: 1.1rem;
        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        flex-shrink: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
    ">
        Consumo Geral por Loja
        <button id="close-dashboard-popup" style="
            position: absolute; top: 10px; right: 10px;
            background: #f44336; color: white; border: none;
            border-radius: 50%; width: 30px; height: 30px;
            font-weight: bold; cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 10001;
        ">×</button>
    </div>
    <div style="flex: 1; overflow: auto;">
        ${popupContent}
    </div>
</div>
`);

  $("body").append($popup);

  // === ALL STORES REPORT: FULLY LOCAL STATE + LOCAL BUTTON ===
  const allReportState = {
    start: "",
    end: "",
  };

  function setAllDates({ start, end }) {
    if (start) allReportState.start = start;
    if (end) allReportState.end = end;
    console.log("[ALL] set dates →", allReportState);
    $popup.find("#startDate").val(allReportState.start || "");
    $popup.find("#endDate").val(allReportState.end || "");
  }

  // Initialize with snapshot copy (not bound)
  setAllDates(DatesStore.get());

  // Local inputs (scoped to this popup)
  $popup
    .off("change.allDates", "#startDate,#endDate")
    .on("change.allDates", "#startDate,#endDate", () => {
      setAllDates({
        start: $popup.find("#startDate").val(),
        end: $popup.find("#endDate").val(),
      });
    });

  // Log popup open event
  const customerId = self.ctx.settings && self.ctx.settings.customerId;
  console.log("[ALL] popup open", {
    customerId,
  });
  $popup.on("remove", () => console.log("[ALL] popup closed"));

  const originalDatasources = self.ctx.datasources || [];
  //console.log("datasources", datasources);

  const datasources = originalDatasources.filter((ds) => {
    console.log("ds >>> ", ds);
    const lbl = (
      ds.label ||
      ds.entity?.label ||
      ds.entityLabel ||
      ds.entityName ||
      ""
    ).toLowerCase();

    // regex para detectar padrões indesejados
    return !(
      /bomba.*secund[aá]ria/.test(lbl) ||
      /^administra[cç][aã]o\s*1\b/.test(lbl) ||
      /^administra[cç][aã]o\s*2\b/.test(lbl) ||
      /chiller/.test(lbl) ||
      /sem/.test(lbl) ||
      /elevado/.test(lbl) ||
      /bomba/.test(lbl) ||
      /escada/.test(lbl) ||
      /^entrada\b/.test(lbl) ||
      /^rel[oó]gio\b/.test(lbl)
    );
  });

  // Ordena em ordem alfabética pelo label
  datasources.sort((a, b) => {
    const labelA = (a.entity.label || "").toLowerCase();
    const labelB = (b.entity.label || "").toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return 0;
  });

  console.log(`datasources count: ${datasources.length}`);
  console.log("datasources >>> ", datasources);

  const attributeService = self.ctx.$scope.$injector.get(
    self.ctx.servicesMap.get("attributeService")
  );

  self.ctx.$scope.reportData = datasources.map((ds) => {
    const entityLabel =
      ds.label || `Dispositivo (ID: ${ds.entityId.substring(0, 5)})`;

    return {
      entityId: ds.entityId,
      entityType: ds.entityType,
      deviceName: entityLabel,
      entityLabel: entityLabel,
      centralId: null, // será preenchido ao buscar atributos
      slaveId: null, // será preenchido ao buscar atributos
      consumptionKwh: null,
      error: null,
      isValid: false,
      identifier: ds.entityId,
    };
  });

  const attributeFetchPromises = datasources.map(async (ds) => {
    const entityLabel =
      ds.label ||
      ds.entityLabel ||
      ds.entityName ||
      `Dispositivo (ID: ${ds.entityId.substring(0, 5)})`;

    let deviceReportEntry = {
      entityId: ds.entityId,
      entityAliasId: ds.entityAliasId,
      deviceName: entityLabel,
      entityLabel: entityLabel,
      centralId: null,
      slaveId: null,
      consumptionKwh: null,
      error: null,
      isValid: false,
    };

    try {
      if (!ds.entityId || !ds.entityType) {
        throw new Error("Contexto do dispositivo ausente");
      }

      const deviceAttributes = await attributeService
        .getEntityAttributes(
          {
            id: ds.entityId,
            entityType: ds.entityType,
          },
          "SERVER_SCOPE",
          ["centralId", "slaveId", "deviceId", "ingestionId"]
        )
        .toPromise();

      const attrs = Array.isArray(deviceAttributes)
        ? deviceAttributes
        : deviceAttributes?.data ?? [];

      const centralIdAttr = attrs.find((a) => a.key === "centralId");
      const slaveIdAttr = attrs.find((a) => a.key === "slaveId");
      const deviceIdAttr = attrs.find((a) => a.key === "deviceId");
      const ingestionIdAttr = attrs.find((a) => a.key === "ingestionId");
      const centralIdValue = centralIdAttr ? centralIdAttr.value : null;
      const slaveIdRawValue = slaveIdAttr ? slaveIdAttr.value : null;
      const slaveIdValue =
        typeof slaveIdRawValue === "string"
          ? parseInt(slaveIdRawValue, 10)
          : slaveIdRawValue;
      const deviceIdValue = deviceIdAttr ? deviceIdAttr.value : null;
      const ingestionId = ingestionIdAttr?.value || null;

      if (!centralIdValue || slaveIdValue === null || isNaN(slaveIdValue)) {
        deviceReportEntry.error = "Dispositivo não configurado corretamente";
        deviceReportEntry.isValid = false;
      } else {
        deviceReportEntry.centralId = centralIdValue;
        deviceReportEntry.slaveId = slaveIdValue;
        deviceReportEntry.isValid = true;
        deviceReportEntry.deviceId = deviceIdValue;
        deviceReportEntry.ingestionId = ingestionId;
      }
    } catch (err) {
      console.error(`Erro ao buscar atributos de ${entityLabel}:`, err);
      deviceReportEntry.error = "Erro ao buscar atributos";
      deviceReportEntry.isValid = false;
    }

    return deviceReportEntry;
  });

  self.ctx.$scope.reportData = await Promise.all(attributeFetchPromises);
  updateReportTable(self.ctx.$scope.reportData);
  renderHeaderStats(self.ctx.$scope.reportData);

  // Seleciona o botão
  $("#loadDataBtn").on("click", async () => {
    const startDateStr = $("#startDate").val(); // yyyy-MM-dd
    const endDateStr = $("#endDate").val(); // yyyy-MM-dd

    if (!startDateStr || !endDateStr) {
      alert("Selecione as duas datas antes de carregar.");
      return;
    }

    // Quebra a string em ano, mês, dia
    const [startY, startM, startD] = startDateStr.split("-").map(Number);
    const [endY, endM, endD] = endDateStr.split("-").map(Number);

    // Cria datas no horário local
    const startDate = new Date(startY, startM - 1, startD, 0, 0, 0, 0);
    const endDate = new Date(endY, endM - 1, endD, 23, 59, 59, 999);

    const datasources = self.ctx.datasources || [];
    if (datasources.length === 0) {
      console.warn("Nenhum datasource encontrado");
      return;
    }

    // Get customerId from settings or use default
    const customerId = self.ctx.settings && self.ctx.settings.customerId;
    if (!CUSTOMER_ID) {
      alert(
        "customerId ausente. Configure o widget (settings.customerId) ou CUSTOMER_ID."
      );
      return;
    }

    try {
      // Format timestamps with timezone offset
      const startTime = toISOWithOffset(startDate);
      const endTime = toISOWithOffset(endDate, true);

      // Build Data API URL for customer totals
      const baseUrl = `${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/energy/devices/totals?startTime=${encodeURIComponent(
        startTime
      )}&endTime=${encodeURIComponent(endTime)}`;

      console.log(
        `[loadDataBtn] Calling Data API customer totals: ${
          baseUrl.split("?")[0]
        } with customerId=${customerId}`
      );

      // Fetch all customer totals with pagination
      //const allDeviceData = await fetchAllCustomerTotals(baseUrl);

      const TOKEN_INJESTION = await MyIOAuth.getToken();

      const allDeviceData = await fetchAllCustomerTotals({
        baseUrl,
        token: TOKEN_INJESTION,
        limit: 100, // ajuste fino
      });

      const allDeviceDataFiltered = allDeviceData.filter((ds) => {
        const lbl = (
          ds.label ||
          ds.entity?.label ||
          ds.entityLabel ||
          ds.entityName ||
          ""
        ).toLowerCase();

        // regex para detectar padrões indesejados
        return !(
          /bomba.*secund[aá]ria/.test(lbl) ||
          /^administra[cç][aã]o\s*1\b/.test(lbl) ||
          /^administra[cç][aã]o\s*2\b/.test(lbl) ||
          /chiller/.test(lbl) ||
          /sem/.test(lbl) ||
          /elevado/.test(lbl) ||
          /bomba/.test(lbl) ||
          /escada/.test(lbl) ||          
          /^entrada\b/.test(lbl) ||
          /^rel[oó]gio\b/.test(lbl)
        );
      });

      /*
            const allDeviceDataFiltered = allDeviceData.filter(ds => {
              const lbl = ds.label || ds.entity?.label || ds.entityLabel || ds.entityName || "";
              console.log(" allDeviceDataFiltered >>> full data:", ds);
              return isLojaLabel(lbl);
            });
            */

      // 2) ordena por label
      allDeviceDataFiltered.sort((a, b) => {
        const labelA = (a.entity?.label || a.label || "").toLowerCase();
        const labelB = (b.entity?.label || b.label || "").toLowerCase();
        return labelA.localeCompare(labelB);
      });

      console.log(
        `datasources (filtrados) count: ${allDeviceDataFiltered.length}`
      );

      // Create map by device ID for fast lookup
      const deviceDataMap = new Map();
      let zeroFilledCount = 0;

      allDeviceDataFiltered.forEach((device) => {
        if (device.id) {
          deviceDataMap.set(String(device.id), device);
        }
      });

      // Update report data with consumption values
      self.ctx.$scope.reportData.forEach((device) => {
        if (device.ingestionId && isValidUUID(device.ingestionId)) {
          const apiDevice = deviceDataMap.get(String(device.ingestionId));
          if (apiDevice) {
            device.consumptionKwh = Number(apiDevice.total_value || 0);
          } else {
            device.consumptionKwh = 0;
            zeroFilledCount++;
            //console.log(`[loadDataBtn] Zero-filled '${device.entityLabel}': no readings in range`);
          }
        } else {
          device.consumptionKwh = 0;
          device.error = "Dispositivo sem ingestionId válido";
          device.isValid = false;
          console.warn(
            `[loadDataBtn] Device '${device.entityLabel}' has invalid or missing ingestionId`
          );
        }
      });

      if (zeroFilledCount > 0) {
        //console.log(`[loadDataBtn] Zero-filled ${zeroFilledCount} devices with no readings in the selected time range`);
      }

      // Defaults if not already set
      self.ctx.$scope.sortColumn =
        self.ctx.$scope.sortColumn || "consumptionKwh";
      self.ctx.$scope.sortReverse = self.ctx.$scope.sortReverse ?? true;

      // Initial render with sorting applied
      applySortAndDetectChanges();
      if (
        Array.isArray(self.ctx.$scope.reportDataSorted) &&
        self.ctx.$scope.reportDataSorted.length
      ) {
        self.ctx.$scope.reportData = self.ctx.$scope.reportDataSorted;
      }

      // Atualiza a tabela no popup
      updateReportTable(self.ctx.$scope.reportData);
      habilitarBotaoExport();
      renderHeaderStats(self.ctx.$scope.reportData);

      // Update header arrows to match current state
      updateMainReportSortUI();

      // Attach header click handlers
      attachMainReportSortHeaderHandlers();

      console.log(
        `[loadDataBtn] Successfully updated ${self.ctx.$scope.reportData.length} devices in report table`
      );
    } catch (err) {
      console.error("[loadDataBtn] Error fetching from Data API:", err);
      alert("Erro ao buscar dados da API. Veja console para detalhes.");
    }
  });

  $("#exportCsvBtn").on("click", () => {
    exportToCSVAll(self.ctx.$scope.reportData);
  });

  $("#close-dashboard-popup").on("click", () => $("#dashboard-popup").remove());

  // Aqui você pode adicionar sua lógica de atualização dos cards/tabela
  // Exemplo simples de evitar duplicação:
  function updateCardOrAdd(group, entityId, label, val, $card) {
    const $existingCard = $(
      `#dashboard-popup .device-card-centered[data-entity-id="${entityId}"]`
    );
    if ($existingCard.length) {
      $existingCard.find(".consumption-value").text(val);
    } else {
      $(`#dashboard-popup .card-list[data-group="${group}"]`).append($card);
    }
  }

  // E sua função de carregar dados e preencher a tabela/cards
}

function getSaoPauloISOString(dateStr, endOfDay = false) {
  if (!dateStr) return "";
  if (endOfDay) {
    return `${dateStr}T23:59:59.999-03:00`;
  } else {
    return `${dateStr}T00:00:00.000-03:00`;
  }
}

function applySortAndDetectChanges() {
  if (!self.ctx.$scope.reportData) {
    self.ctx.$scope.reportDataSorted = [];
    self.ctx.detectChanges();
    return;
  }

  let sortedData = [...self.ctx.$scope.reportData];

  sortedData.sort((a, b) => {
    let valA = a[self.ctx.$scope.sortColumn];
    let valB = b[self.ctx.$scope.sortColumn];

    if (self.ctx.$scope.sortColumn === "consumptionKwh") {
      valA = Number(valA);
      valB = Number(valB);
    }

    if (valA < valB) return self.ctx.$scope.sortReverse ? 1 : -1;
    if (valA > valB) return self.ctx.$scope.sortReverse ? -1 : 1;

    return 0;
  });

  self.ctx.$scope.reportDataSorted = sortedData;
  self.ctx.detectChanges();
}

// Function to update header arrow states for main report popup
function updateMainReportSortUI() {
  const currentColumn = self.ctx.$scope.sortColumn || "consumptionKwh";
  const isReverse = !!self.ctx.$scope.sortReverse;

  // Remove all active states and reset arrows
  $("#reportTable th.sortable").removeClass("active asc desc");

  // Set active state and direction for current column
  const $activeHeader = $(
    `#reportTable th.sortable[data-sort-key="${currentColumn}"]`
  );
  if ($activeHeader.length) {
    $activeHeader.addClass("active");
    $activeHeader.addClass(isReverse ? "desc" : "asc");
  }
}

// Function to attach click handlers to sortable headers for main report popup
function attachMainReportSortHeaderHandlers() {
  $(document)
    .off("click.myioHeaderSort", "#reportTable th.sortable")
    .on("click.myioHeaderSort", "#reportTable th.sortable", function () {
      const $header = $(this);
      const sortKey = $header.data("sort-key");

      if (!sortKey) return;

      // Toggle direction if clicking same column, otherwise default to ascending
      if (self.ctx.$scope.sortColumn === sortKey) {
        self.ctx.$scope.sortReverse = !self.ctx.$scope.sortReverse;
      } else {
        self.ctx.$scope.sortColumn = sortKey;
        self.ctx.$scope.sortReverse = false; // Default to ascending for new column
      }

      // Apply sorting
      applySortAndDetectChanges();
      if (
        Array.isArray(self.ctx.$scope.reportDataSorted) &&
        self.ctx.$scope.reportDataSorted.length
      ) {
        self.ctx.$scope.reportData = self.ctx.$scope.reportDataSorted;
      }

      // Update table and UI
      updateReportTable(self.ctx.$scope.reportData);
      updateMainReportSortUI();

      // Sync dropdowns with new state
      $("#reportSortBy").val(self.ctx.$scope.sortColumn);
      $("#reportSortDir").val(self.ctx.$scope.sortReverse ? "desc" : "asc");
    });
}

function getDateRangeArray(start, end) {
  const arr = [];
  let currentDate = new Date(start);
  const endDate = new Date(end);

  while (currentDate <= endDate) {
    // <= para incluir o último dia
    arr.push(currentDate.toISOString().slice(0, 10));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return arr;
}

function exportToCSV(
  reportData,
  entityLabel,
  totalconsumption,
  entityUpdatedIdentifiers,
  insueDate
) {
  if (!reportData?.length) {
    alert("Erro: Nenhum dado disponível para exportar.");
    return;
  }

  const rows = [];

  rows.push(["Dispositivo/Loja", entityLabel, entityUpdatedIdentifiers]);
  rows.push(["DATA EMISSÃO", insueDate]);
  rows.push(["Total", totalconsumption]);
  rows.push(["Data", "Consumo"]);

  reportData.forEach((data) => {
    rows.push([
      data.date || "-",
      data.consumptionKwh != null
        ? formatNumberReadable(data.consumptionKwh)
        : "0,00",
    ]);
  });

  const csvContent =
    "data:text/csv;charset=utf-8," + rows.map((e) => e.join(";")).join("\n");
  const link = document.createElement("a");

  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute(
    "download",
    `relatorio_consumo_${new Date()
      .toISOString()
      .slice(0, 10)}_${entityLabel}.csv`
  );

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);
}

function formatNumberReadable(value) {
  if (value == null || isNaN(value)) return "-";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function habilitarBotaoExport() {
  const btn =
    document.getElementById("btn-export-csv") ||
    document.getElementById("exportCsvBtn");
  btn.disabled = false;
  btn.style.backgroundColor = "#5c307d"; // roxo original
  btn.style.color = "#fff";
  btn.style.cursor = "pointer";
}


async function getParentAssetRelation(entityId) {
  if (!entityId?.id || !entityId?.entityType) {
    return null;
  }
  
  const url = `/api/relations?toId=${entityId.id}&toType=${entityId.entityType}`;
  
  try {
    const relations = await self.ctx.http.get(url).toPromise();
    const assetRel = relations.find(
      (r) => r.from?.entityType === "ASSET" && r.type === "Contains"
    );
    
    return assetRel ? assetRel.from : null;
  } catch (err) {
    console.warn(`Falha ao buscar pai de ${entityId.id}:`, err?.message || err);
    return null;
  }
}

/**
 * Função principal para buscar dados de pai/avô em massa.
 * 
 *
 * @param {Array<Object>} deviceEntityList - Sua lista de entidades de dispositivos.
 * Ex: [{id: "...", entityType: "DEVICE"}, ...]
 *
 * @returns {Map<string, {parent: Object, grandparent: Object}>}
 * Um Mapa onde a chave é o ID do dispositivo e o valor é um objeto
 * com os dados completos do pai e avô.
 */
async function fetchDeviceHierarchyInBulk(deviceEntityList) {
  
  // 1. & 2. Buscar relações de Pais (paralelo) e mapear
  console.log(`[BulkFetch] Buscando ${deviceEntityList.length} relações de pais...`);
  const parentPromises = deviceEntityList.map(getParentAssetRelation);
  const parentResults = await Promise.allSettled(parentPromises);

  const deviceToParentMap = new Map();
  const parentEntities = []; 
  parentResults.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      const parentAssetEntity = result.value; 
      const deviceId = deviceEntityList[index].id;
      deviceToParentMap.set(deviceId, parentAssetEntity.id);
      parentEntities.push(parentAssetEntity);
    }
  });
  const uniqueParentEntities = [...new Map(parentEntities.map(item => [item.id, item])).values()];

  // 3. & 4. Buscar relações de Avós (paralelo) e mapear
  console.log(`[BulkFetch] Buscando ${uniqueParentEntities.length} relações de avós...`);
  const grandparentPromises = uniqueParentEntities.map(getParentAssetRelation);
  const grandparentResults = await Promise.allSettled(grandparentPromises);

  const parentToGrandparentMap = new Map();
  const grandparentAssetIds = []; 
  grandparentResults.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      const grandparentAssetEntity = result.value; 
      const parentId = uniqueParentEntities[index].id;
      parentToGrandparentMap.set(parentId, grandparentAssetEntity.id);
      grandparentAssetIds.push(grandparentAssetEntity.id);
    }
  });

  // 5. Lista final de TODOS os IDs de assets (pais + avós)
  const allUniqueAssetIds = [...new Set([
    ...parentEntities.map(p => p.id), 
    ...grandparentAssetIds
  ])];

  if (allUniqueAssetIds.length === 0) {
    console.log("[BulkFetch] Nenhum asset (pai ou avô) encontrado para buscar.");
    return new Map(); 
  }

  // 6. BUSCA EM LOTE (CHUNKED) PARA PEGAR OS DETALHES (NOME, LABEL, ETC.)
  console.log(`[BulkFetch] Buscando detalhes de ${allUniqueAssetIds.length} assets em lotes...`);
  
  // --- INÍCIO DA CORREÇÃO (Chunking) ---
  // A API /api/assets?assetIds=... falha com 400 (URL longa) se muitos IDs.
  // A solução é "fatiar" (chunk) a lista de IDs e fazer várias chamadas paralelas.
  
  const injector = self.ctx.$scope.$injector;
  const assetServiceName = self.ctx.servicesMap.get('assetService');
  if (!assetServiceName) {
      throw new Error("Não foi possível encontrar o 'assetService' no servicesMap.");
  }
  const assetService = injector.get(assetServiceName);

  const CHUNK_SIZE = 50; // 50 IDs por requisição (um número seguro)
  const chunkPromises = [];
  
  for (let i = 0; i < allUniqueAssetIds.length; i += CHUNK_SIZE) {
      const chunkOfIds = allUniqueAssetIds.slice(i, i + CHUNK_SIZE);
      console.log(`[BulkFetch] Criando promise para o lote ${i / CHUNK_SIZE + 1}/${Math.ceil(allUniqueAssetIds.length / CHUNK_SIZE)} (tamanho ${chunkOfIds.length})`);
      
      // Adiciona a promise ao array
      chunkPromises.push(
          assetService.getAssets(chunkOfIds, {}).toPromise()
      );
  }

  // Executa todas as N requisições (ex: 6 requisições) em paralelo
  const allAssetChunks = await Promise.all(chunkPromises);
  
  // Junta os resultados de todos os lotes em um único array
  // .flat() achata [ [asset1, asset2], [asset3] ] para [asset1, asset2, asset3]
  const allAssets = allAssetChunks.flat(); 
  
  // --- FIM DA CORREÇÃO ---

  // 7. Criar um Mapa de consulta rápida (ID -> Objeto Asset Completo)
  // Agora 'allAssets' contém os objetos completos com 'name', 'label', etc.
  const assetDetailsMap = new Map(allAssets.map(asset => [asset.id.id, asset]));
  console.log(`[BulkFetch] Mapa de detalhes de ${assetDetailsMap.size} assets criado.`);

  // 8. Montar o resultado final: Mapa 'DeviceID' -> { parent, grandparent }
  const finalResultMap = new Map();
  for (const device of deviceEntityList) {
    const deviceId = device.id;
    
    const parentId = deviceToParentMap.get(deviceId);
    const parentAsset = parentId ? assetDetailsMap.get(parentId) : null;
    
    const grandparentId = parentId ? parentToGrandparentMap.get(parentId) : null;
    const grandparentAsset = grandparentId ? assetDetailsMap.get(grandparentId) : null;

    finalResultMap.set(deviceId, {
      parent: parentAsset,
      grandparent: grandparentAsset
    });
  }

  console.log("[BulkFetch] Processamento em massa concluído.");
  return finalResultMap;
}

function openDashboardPopupReport(
  entityId,
  entityType,
  entitySlaveId,
  entityCentralId,
  entityIngestionId,
  entityLabel,
  entityComsuption,
  entityUpdatedIdentifiers
) {
  const insueDate = $("#dashboard-popup").remove();

  const popupContent = `

    <div style="
      font-family: 'Roboto', sans-serif; 
      padding: 20px; 
      height: 100%; 
      box-sizing: border-box; 
      display: flex; 
      flex-direction: column;
      background: white;
    ">
      <div style="
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        margin-bottom: 20px; 
        flex-wrap: wrap; 
        gap: 16px;
      ">
        <div>
            <h2 style="font-size: 18px; font-weight: 500; color: #333; margin: 0 0 -20px 0;">Relatório Consumo de Energia Geral por Loja </h2>
            <h2 style="font-size: 18px; font-weight: 500; color: #333; margin: 0 0 -20px 0;">Dispositivo/Loja: ${entityLabel} - ${entityUpdatedIdentifiers} </h2>
            <div style="display: flex; flex-direction=row">
                <h2 style="font-size: 18px; font-weight: 500; color: #333; margin: 0 5px 0 0;">DATA EMISSÃO: </h2>
                <h2 id ="inssueDate" style="font-size: 18px; font-weight: 500; color: #333; margin: 0;">  </h2>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input id="start-date" type="date" style="
            padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; color: #333; background: white;
          ">
          <span style="color: #666; font-size: 14px;">até</span>
          <input id="end-date" type="date" style="
            padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; color: #333; background: white;
          ">
          <button id="btn-load" style="
            padding: 8px 16px; 
            border: none; border-radius: 4px; 
            background-color: #5c307d; 
            color: white; 
            cursor: pointer; 
            font-size: 14px; 
            display: flex; 
            align-items: center; 
            gap: 8px;
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='#4a265f';" onmouseout="this.style.backgroundColor='#5c307d';">
            <span class="material-icons" style="font-size: 18px; line-height: 18px;">refresh</span>
            Carregar
          </button>
        </div>
  
        <div style="display: flex; gap: 10px;"> 
            <button id="btn-export-csv" disabled
              style="background-color: #ccc; color: #666; padding: 8px 16px; border: none; border-radius: 4px; cursor: not-allowed;">
             <span class="material-icons" style="font-size: 18px; line-height: 18px;">file_download</span>
            CSV
            </button>

        </div>
        

        
      </div>

  
      <div style="
        flex: 1; 
        overflow: auto; 
        border: 1px solid #e0e0e0; 
        border-radius: 4px; 
        position: relative; 
        background: white;
      ">
        <div style="
          position: absolute; 
          top: 0; left: 0; right: 0; bottom: 0; 
          background: rgba(255,255,255,0.8); 
          display: none; 
          justify-content: center; 
          align-items: center; 
          z-index: 2;
        " id="loading-overlay">
          <span class="material-icons" style="font-size: 48px; color: #5c307d;">hourglass_empty</span>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; background: white;">
          <thead>
            <tr id="total-row" style="font-weight: bold; background-color: #c4c4c4;">
              <td style="padding: 12px; color:#696969;">Total:</td>
              <td id="total-consumo" style="padding: 12px;">0</td>
            </tr>
            <tr>
              <th class="sortable" data-sort-key="date" style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">
                <span class="label">Data</span><span class="arrow"></span>
              </th>
              <th class="sortable" data-sort-key="consumptionKwh" style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">
                <span class="label">Consumo</span><span class="arrow"></span>
              </th>
            </tr>
          </thead>
          <tbody id="table-body" style="font-size: 14px; color: #333;">
            <tr>
              <td colspan="2" style="text-align: center; padding: 32px; color: #666;">Nenhum dado disponível</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  
    <!-- Material Icons font link -->
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    
    <style id="detail-sort-style">
    #dashboard-popup th.sortable {
      user-select: none;
      cursor: pointer;
      white-space: nowrap;
    }
    #dashboard-popup th.sortable .label { margin-right: 8px; font-weight: 600; }
    #dashboard-popup th.sortable .arrow {
      display: inline-block;
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 7px solid currentColor; /* ▲ shape */
      transform: rotate(180deg);             /* default ↓ */
      transition: transform 120ms ease;
      opacity: .85; vertical-align: middle;
    }
    #dashboard-popup th.sortable.asc  .arrow { transform: rotate(0deg); }     /* ↑ */
    #dashboard-popup th.sortable.desc .arrow { transform: rotate(180deg); }   /* ↓ */
    #dashboard-popup th.sortable.active { filter: brightness(1.05); }
    </style>
  `;

  const $popup = $(`
  <div id="dashboard-popup" style="
    position: fixed; top: 5%; left: 5%; 
    width: 90%; height: 90%; 
    background: white; 
    border-radius: 8px; 
    box-shadow: 0 0 15px rgba(0,0,0,0.5); 
    z-index: 10000; 
    overflow: hidden;
    display: flex; flex-direction: column;
  ">
    <div style="
      background: #4A148C; 
      color: white; 
      padding: 12px 20px; 
      font-weight: bold; 
      font-size: 1.1rem; 
      border-top-left-radius: 10px; 
      border-top-right-radius: 10px;
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
    ">
      Consumo de Loja
      <button id="close-dashboard-popup" style="
        position: absolute; top: 10px; right: 10px; 
        background: #f44336; color: white; border: none; 
        border-radius: 50%; width: 30px; height: 30px; 
        font-weight: bold; cursor: pointer; 
        box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 10001;
      ">×</button>
    </div>
    <div style="flex: 1; overflow: auto;">
      ${popupContent}
    </div>
  </div>
`);

  $("body").append($popup);

  // === DEVICE REPORT POPUP: FULLY LOCAL STATE + LOCAL BUTTON ===
  const reportState = {
    start: "",
    end: "",
  };

  function setReportDates({ start, end }) {
    if (start) reportState.start = start;
    if (end) reportState.end = end;
    console.log("[REPORT] set dates →", reportState);
    $popup.find("#start-date").val(reportState.start || "");
    $popup.find("#end-date").val(reportState.end || "");
  }

  // Initialize with snapshot copy (not bound)
  setReportDates(DatesStore.get());

  // Local inputs (scoped to this popup)
  $popup
    .off("change.reportDates", "#start-date,#end-date")
    .on("change.reportDates", "#start-date,#end-date", () => {
      setReportDates({
        start: $popup.find("#start-date").val(),
        end: $popup.find("#end-date").val(),
      });
    });

  // Log popup open event
  console.log("[REPORT] popup open", {
    deviceId: entityId,
    ingestionId: entityIngestionId,
  });
  $popup.on("remove", () => console.log("[REPORT] popup closed"));

  $("#close-dashboard-popup").on("click", () => $("#dashboard-popup").remove());

  function applyDetailSort(rows) {
    const col = self.ctx.$scope.detailSortColumn || "date";
    const rev = !!self.ctx.$scope.detailSortReverse;

    return [...rows].sort((a, b) => {
      let x = a[col],
        y = b[col];

      if (col === "consumptionKwh") {
        x = Number(x || 0);
        y = Number(y || 0);
      } else {
        // assume 'date' in dd/mm/yyyy format, convert to Date for comparison
        const parseBR = (dmy) => {
          const [d, m, y] = String(dmy).split("/");
          return new Date(`${y}-${m}-${d}T00:00:00-03:00`);
        };
        x = parseBR(x);
        y = parseBR(y);
      }

      if (x < y) return rev ? 1 : -1;
      if (x > y) return rev ? -1 : 1;
      return 0;
    });
  }

  function updateTable() {
    const tbody = document.getElementById("table-body");
    if (!tbody) return;

    const data = self.ctx.$scope.reportData || [];
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 32px; color: #666;">Nenhum dado disponível</td></tr>`;
      return;
    }

    // Apply sorting before rendering
    let sortedData = data;
    if (data.length > 0) {
      // Use current state (no dropdown reading needed)
      self.ctx.$scope.detailSortColumn =
        self.ctx.$scope.detailSortColumn || "date";
      self.ctx.$scope.detailSortReverse =
        self.ctx.$scope.detailSortReverse || false;

      sortedData = applyDetailSort(data);
    }

    tbody.innerHTML = ""; // limpa

    sortedData.forEach((item, index) => {
      const tr = document.createElement("tr");

      // alterna cores com base no índice
      const isCinza = index % 2 !== 0;
      const corTexto = isCinza ? "white" : "inherit";
      const corFundo = isCinza ? "#CCCCCC" : "inherit";

      tr.innerHTML = `
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo}; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${
        item.date
      }</td>
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo};text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${MyIOLibrary.formatEnergy(
        item.consumptionKwh
      )}</td>
    `;
      tbody.appendChild(tr);
    });
  }

  // Local load button (scoped) - replaces the old global #btn-load handler
  $popup
    .off("click.reportLoad", ".report-load, #btn-load")
    .on("click.reportLoad", ".report-load, #btn-load", async () => {
      const { start, end } = reportState;
      if (!start || !end) return alert("Selecione as datas de início e fim.");
      console.log("[REPORT] Load clicked with", {
        start,
        end,
      });

      if (!entityIngestionId || !isValidUUID(entityIngestionId)) {
        alert(
          "Dispositivo não possui ingestionId válido para consulta na Data API."
        );
        return;
      }

      try {
        // Format timestamps with timezone offset
        const startTime = toISOWithOffset(new Date(start + "T00:00:00-03:00"));
        const endTime = toISOWithOffset(
          new Date(end + "T23:59:59-03:00"),
          true
        );

        console.log(
          `[REPORT] Fetching data for ingestionId=${entityIngestionId} from ${startTime} to ${endTime}`
        );

        // Build Data API URL with required parameters
        const url = `${DATA_API_HOST}/api/v1/telemetry/devices/${entityIngestionId}/energy?startTime=${encodeURIComponent(
          startTime
        )}&endTime=${encodeURIComponent(
          endTime
        )}&granularity=1d&page=1&pageSize=1000&deep=0`;

        console.log(
          `[REPORT] Calling Data API: ${
            url.split("?")[0]
          } with deviceId=${entityIngestionId}`
        );

        const response = await fetchWithAuth(url);
        const data = await response.json();

        // Handle response - expect array even for single device
        if (!Array.isArray(data) || data.length === 0) {
          console.warn("[REPORT] Data API returned empty or invalid response");
          self.ctx.$scope.reportData = [];
          self.ctx.$scope.totalConsumption = 0;
          updateTable();
          return;
        }

        const deviceData = data[0]; // First (and likely only) device
        const consumption = deviceData.consumption || [];

        // Generate date range array
        const dateRange = getDateRangeArray(start, end);

        // Create map from consumption data
        const dailyMap = {};
        let totalconsumption = 0;

        consumption.forEach((item) => {
          if (item.timestamp && item.value != null) {
            const date = item.timestamp.slice(0, 10); // Extract YYYY-MM-DD
            const value = Number(item.value);
            if (!dailyMap[date]) dailyMap[date] = 0;
            dailyMap[date] += value;
            totalconsumption += value;
          }
        });

        // Generate timestamp for report
        const now = new Date();
        const dia = String(now.getDate()).padStart(2, "0");
        const mes = String(now.getMonth() + 1).padStart(2, "0");
        const ano = now.getFullYear();
        const hora = String(now.getHours()).padStart(2, "0");
        const minuto = String(now.getMinutes()).padStart(2, "0");
        const insueDate = ` ${dia}/${mes}/${ano} - ${hora}:${minuto}`;

        // Create final report data with zero-fill for missing dates
        const reportData = dateRange.map((dateStr) => {
          const [ano, mes, dia] = dateStr.split("-");
          return {
            date: `${dia}/${mes}/${ano}`,
            consumptionKwh: dailyMap[dateStr] != null ? dailyMap[dateStr] : 0,
          };
        });

        self.ctx.$scope.reportData = reportData;
        self.ctx.$scope.totalConsumption = totalconsumption;
        self.ctx.$scope.insueDate = insueDate;
        document.getElementById("total-consumo").textContent =
          MyIOLibrary.formatEnergy(totalconsumption);
        document.getElementById("inssueDate").textContent = insueDate;

        updateTable();
        habilitarBotaoExport();
        applySortAndDetectChanges();

        console.log(
          `[REPORT] Successfully processed ${consumption.length} consumption records, total: ${totalconsumption} kWh`
        );
      } catch (error) {
        console.error("[REPORT] Error fetching from Data API:", error);
        alert("Erro ao buscar dados da API. Veja console para detalhes.");
        // Clear data on error
        self.ctx.$scope.reportData = [];
        self.ctx.$scope.totalConsumption = 0;
        updateTable();
      }
    });

  // (Opcional) evento para exportar CSV
  $("#btn-export-csv").on("click", () => {
    if (self.ctx.$scope.reportData) {
      exportToCSV(
        self.ctx.$scope.reportData,
        entityLabel,
        self.ctx.$scope.totalConsumption,
        entityUpdatedIdentifiers,
        self.ctx.$scope.insueDate
      );
    } else {
      alert("Função exportar CSV ainda não implementada.");
    }
  });

  // Function to update header arrow states for detail popup
  function updateDetailSortUI() {
    const currentColumn = self.ctx.$scope.detailSortColumn || "date";
    const isReverse = !!self.ctx.$scope.detailSortReverse;

    // Remove all active states and reset arrows
    $("#table-body")
      .closest("table")
      .find("th.sortable")
      .removeClass("active asc desc");

    // Set active state and direction for current column
    const $activeHeader = $(`#table-body`)
      .closest("table")
      .find(`th.sortable[data-sort-key="${currentColumn}"]`);
    if ($activeHeader.length) {
      $activeHeader.addClass("active");
      $activeHeader.addClass(isReverse ? "desc" : "asc");
    }
  }

  // Function to attach click handlers to sortable headers for detail popup
  function attachDetailSortHeaderHandlers() {
    $(document)
      .off("click.myioDetailHeaderSort", "#dashboard-popup th.sortable")
      .on(
        "click.myioDetailHeaderSort",
        "#dashboard-popup th.sortable",
        function () {
          const $header = $(this);
          const sortKey = $header.data("sort-key");

          if (!sortKey) return;

          // Toggle direction if clicking same column, otherwise default to ascending
          if (self.ctx.$scope.detailSortColumn === sortKey) {
            self.ctx.$scope.detailSortReverse =
              !self.ctx.$scope.detailSortReverse;
          } else {
            self.ctx.$scope.detailSortColumn = sortKey;
            self.ctx.$scope.detailSortReverse = false; // Default to ascending for new column
          }

          // Re-render table with new ordering
          updateTable();
          updateDetailSortUI();
        }
      );
  }

  // Defaults on first load for detail popup sorting
  self.ctx.$scope.detailSortColumn = self.ctx.$scope.detailSortColumn || "date";
  self.ctx.$scope.detailSortReverse =
    self.ctx.$scope.detailSortReverse || false;

  // Update header arrows to match current state
  updateDetailSortUI();

  // Attach header click handlers
  attachDetailSortHeaderHandlers();
}

function openWidgetFullScreen() {
  const url = `/dashboard/2be46870-76db-11f0-8b27-31e42298f79e`;

  $("#dashboard-popup").remove();
  const $popup = $(
    `<div id="dashboard-popup" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 10000; overflow: autp;">
<button 
    id="close-dashboard-popup" 
    style="position: absolute; top: 0; right: 0; 
           background: white; color: black; border: none; 
           width: 60px; height: 60px; font-weight: bold; cursor: pointer; 
           box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 10001; 
           transform: scale(1); transition: transform 0.3s ease;"
    onmouseover="this.style.transform='scale(1.3)'" 
    onmouseout="this.style.transform='scale(1)'">
    ⛶
</button>

<iframe src="${url}" style="width: 100vw; height: 100vh; border: none;"></iframe>
</div>`
  );
  $("body").append($popup);
  $("#close-dashboard-popup").on("click", () => $("#dashboard-popup").remove());
}

function getAdminConsumption(label) {
  try {
    //console.log(`[getAdminConsumption] 🔎 Iniciando busca do consumo para: "${label}"`);

    // seleciona a div com o data-entity-label correto
    const container = document.querySelector(
      `div[data-entity-label="${label}"]`
    );
    if (!container) {
      console.warn(
        `[getAdminConsumption] ⚠️ Div com data-entity-label="${label}" não encontrada.`
      );
      return 0;
    }
    //console.log(`[getAdminConsumption] ✅ Div encontrada para "${label}"`, container);

    // procura dentro dela o span de consumo
    const span = container.querySelector("span.consumption-value");
    if (!span) {
      console.warn(
        `[getAdminConsumption] ⚠️ Span .consumption-value não encontrado dentro da div de "${label}".`
      );
      return 0;
    }
    //console.log(`[getAdminConsumption] ✅ Span encontrado para "${label}"`, span);

    // extrai o texto
    const text = span.textContent.trim();
    //console.log(`[getAdminConsumption] 📝 Texto extraído de "${label}": "${text}"`);

    // normaliza e converte em número
    const normalized = text.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(normalized);
    //console.log(`[getAdminConsumption] 🔢 Valor numérico processado de "${label}":`, num);

    if (isNaN(num)) {
      console.warn(
        `[getAdminConsumption] ⚠️ Valor inválido em "${label}": "${text}" (normalizado: "${normalized}")`
      );
      return 0;
    }

    //console.log(`[getAdminConsumption] ✅ Consumo final retornado para "${label}": ${num}`);
    return num;
  } catch (err) {
    console.error(
      `[getAdminConsumption] ❌ Erro inesperado ao capturar consumo de "${label}":`,
      err
    );
    return 0;
  }
}

function updateInfoCardsAndChart(groupSums, items) {
  // ===== 1) Somatórios de entrada (subestação + relógios) =====
  let entradaSubestacaoVal = 0;
  let entradaRelogioVal = 0;

  items.forEach(({ label = "", val }) => {
    if (/subesta/i.test(label)) entradaSubestacaoVal += val;
    else if (/rel[óo]gio/i.test(label)) entradaRelogioVal += val;
  });

  // ===== 2) Totais por grupo =====
  const ctx = self.ctx;
  const entradaVal = groupSums[Object.keys(GROUPS)[0]];

  // procura valores de Administração 1 e Administração 2 nos itens
  const admin1 = getAdminConsumption("Administração 1");
  const admin2 = getAdminConsumption("Administração 2");

  // subtrai os dois se existirem
  if (!admin1) {
    console.warn(
      "[updateInfoCardsAndChart] ⚠️ Administração 1 não encontrada nos items."
    );
  }

  if (!admin2) {
    console.warn(
      "[updateInfoCardsAndChart] ⚠️ Administração 2 não encontrada nos items."
    );
  }

  const groupAdminValue =
    groupSums[Object.keys(GROUPS)[1]] > 1000
      ? groupSums[Object.keys(GROUPS)[1]] / 1000
      : groupSums[Object.keys(GROUPS)[1]];

  //console.log(`[updateInfoCardsAndChart] ℹ️ Valores Administração: Admin1 = ${admin1}, Admin2 = ${admin2}, groupAdminValue = ${groupAdminValue}`);

  const adminVal = groupAdminValue - (admin1 + admin2);
  const lojasVal = groupSums[Object.keys(GROUPS)[2]];
  const entradaTotal = entradaSubestacaoVal + entradaRelogioVal;

  //console.log(`[updateInfoCardsAndChart] ℹ️ Totais de Entrada: Subestação = ${entradaSubestacaoVal}, Relógio = ${entradaRelogioVal}, Total = ${entradaTotal}`);
  //console.log(`[updateInfoCardsAndChart] ℹ️ Totais de Consumo: Administração = ${adminVal * 1000}, Lojas = ${lojasVal}`);

  const consumoTotal = adminVal * 1000 + lojasVal;

  // delta > 0  => sobra (Área Comum)
  // delta < 0  => déficit (consumo > entrada) => exibimos “Ajuste”
  //console.log(`entradaTotal: ${entradaTotal} | consumoTotal: ${consumoTotal}`);
  const delta = entradaTotal - consumoTotal;

  let values, labels, areaTitle, areaValue;
  const areaIcon = "/api/images/public/oXk6v7hN8TCaBHYD4PQo5oM5fr7xuUAb";

  if (delta >= 0) {
    areaTitle = "Área Comum";
    areaValue = delta;
    values = [adminVal, lojasVal, areaValue];
    labels = ["Chiller e Bombas", Object.keys(GROUPS)[2], "Área Comum"];
    //console.warn(`[delta OK] ✅ delta: "${delta}" | Entrada Total: "${entradaTotal}" | Consumo Total: "${consumoTotal}" (Lojas "${lojasVal}", Admin "${(admin1 + admin2) * 1000}" e Bombas "${adminVal * 1000}")`);
  } else {
    const ajuste = Math.abs(delta);
    areaTitle = "Área Comum";
    areaValue = -ajuste; //1.00;//- ajuste;
    values = [adminVal, lojasVal, areaValue];
    labels = ["Chiller e Bombas", Object.keys(GROUPS)[2], "Área Comum (-)"];
    console.warn(
      `[delta NOK] ⚠️ delta: "${delta}" | Entrada Total: "${entradaTotal}" | Consumo Total: "${consumoTotal}" (Lojas "${lojasVal}", Admin "${
        (admin1 + admin2) * 1000
      }" e Bombas "${adminVal * 1000}")`
    );
  }

  // ===== 3) Percentuais =====
  const $infoList = ctx.groupDivs["Área Comum"].find("#area-comum-list");

  // % relativos à entrada total
  const percEntrada = (v) =>
    entradaVal > 0 ? ((v / entradaVal) * 100).toFixed(1) : "0.0";

  // % relativos ao “interno” (adm + lojas + área)
  //console.log(`>>> adminVal: ${adminVal} | lojasVal: ${lojasVal} | areaValue: ${areaValue}`);
  const totalInterno = adminVal * 1000 + lojasVal + areaValue;

  //console.log(`>>> totalInterno: ${totalInterno}`);
  const percInterno = (v) =>
    totalInterno > 0 ? ((v / totalInterno) * 100).toFixed(1) : "0.0";

  // ===== 4) Monta os cards =====
  $infoList.empty();

  $infoList.append(
    createInfoCard(
      "Total Entrada Subestação",
      entradaSubestacaoVal,
      percEntrada(entradaSubestacaoVal),
      "/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU"
    )
  );

  $infoList.append(
    createInfoCard(
      "Total Entrada Relógios",
      entradaRelogioVal,
      percEntrada(entradaRelogioVal),
      "/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB"
    )
  );

  const adminValueCard = adminVal * 1000;

  $infoList.append(
    createInfoCard(
      "Bombas e Chiller",
      adminValueCard,
      percInterno(adminValueCard),
      "/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT"
    )
  );

  $infoList.append(
    createInfoCard(
      "Lojas",
      lojasVal,
      percInterno(lojasVal),
      "/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k"
    )
  );

  $infoList.append(
    createInfoCard(areaTitle, areaValue, percInterno(areaValue), areaIcon)
  );

  // ===== 5) Gráfico de pizza =====
  if (ctx.areaChart) ctx.areaChart.destroy();

  //console.log("Graph >>> totalPie, ", totalPie);
  //console.log("Graph >>> values, ", values);

  // índice 0 está em MWh → converter para kWh (1 MWh = 1000 kWh)
  const valuesNormalized = values.map((val, idx) => {
    if (idx === 0) {
      return val * 1000; // MWh → kWh
    }
    return val; // já está em kWh
  });

  const totalPie = valuesNormalized.reduce((a, b) => a + b, 0);

  /*
    console.log("Graph >>> totalPie, ", totalPie);
    console.log("Graph >>> values, ", values);  
    console.log("Graph >>> valuesNormalized, ", valuesNormalized);
    console.log("Graph >>> labels, ", labels);
    console.log("Totalpie: ", totalPie);
    */

  const hideCommonArea = self.ctx.settings.existsCommomArea === "false";
  if (!hideCommonArea) {
    ctx.areaChart = new Chart(
      document.getElementById("areaChart").getContext("2d"),
      {
        type: "pie",
        data: {
          labels,
          datasets: [
            {
              label: "Consumo",
              data: valuesNormalized,
              backgroundColor:
                delta >= 0
                  ? ["#2196f3", "#4caf50", "#ff9800"]
                  : ["#2196f3", "#4caf50", "#f44336"], // vermelho para “Ajuste”
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false, // respeita a altura do CSS
          layout: {
            padding: 0,
          },
          plugins: {
            legend: {
              display: false,
            }, // legenda interna OFF
            tooltip: {
              callbacks: {
                label: (tt) => {
                  const i = tt.dataIndex;
                  const lab = labels[i];
                  const v = valuesNormalized[i] ?? 0;
                  let pct =
                    totalPie > 0 ? ((v / totalPie) * 100).toFixed(1) : "0.0";
                  pct = MyIOLibrary.formatNumberReadable(pct);
                  return `${lab} (${pct}%)`;
                },
              },
            },
          },
        },
      }
    );

    // ===== 6) Legenda HTML (abaixo do canvas) =====
    const legendEl = document.getElementById("areaLegend");

    if (legendEl) {
      legendEl.innerHTML = ""; // limpa anterior

      const colors = ctx.areaChart.data.datasets[0].backgroundColor;
      labels.forEach((label, i) => {
        const v = valuesNormalized[i] ?? 0;
        const pct = totalPie > 0 ? ((v / totalPie) * 100).toFixed(1) : "0.0";
        const short = label.length > 7 ? label.slice(0, 7) + "..." : label;

        const li = document.createElement("li");
        li.innerHTML = `
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;background:${
            colors[i]
          };"></span>
          <span>${short} (${MyIOLibrary.formatNumberReadable(pct)}%)</span>
        `;
        legendEl.appendChild(li);
      });
    }
  }
}

self.onInit = async function () {
  const ctx = self.ctx;
  // Note: loadDataForPopup will be defined by individual popup functions
  // Do not override it here to avoid conflicts with popup-specific implementations
  CUSTOMER_ID = self.ctx.settings.customerId || " ";
  CLIENT_ID = self.ctx.settings.clientId || " ";
  CLIENT_SECRET = self.ctx.settings.clientSecret || " ";
  administration = self.ctx.settings.administration || " ";
  entranceClock = self.ctx.settings.entranceClock;
  //console.log("self",ctx)
  // Initialize main board controller with new decoupled system
  initializeMainBoardController();
  //console.log('[MAIN] Controller initialized with decoupled date system');

  // inicializa o set global de seleções
  ctx.$scope.selectedDevices = ctx.$scope.selectedDevices || new Set();

  applyGroupVisibilityAndMap();

  ctx.groups = GROUPS;
  // Remove duplicação de labels e obtém o label do grupo a partir do GROUPS (posição 1)
  const groupLabels = Object.keys(GROUPS);
  ctx.groupDivs = {
    [groupLabels[0]]: $(".group-card.entrada"),
    [groupLabels[1]]: $(".group-card.administracao"),
    [groupLabels[2]]: $(".group-card.lojas"),
    "Área Comum": $(".group-card.area-comum"),
  };

  ctx.$areaChartCanvas = document.getElementById("areaChart");
  ctx.$lockOverlay = $(".widget-lock-overlay");

  // Filtros de busca
  $(".search-bar").on("input", function () {
    const query = $(this).val().toLowerCase();

    $(".device-card-centered").each(function () {
      const label = $(this).find(".device-title").text().toLowerCase();
      $(this).toggle(label.includes(query));
    });
  });

  ctx.$lockOverlay.find("button").on("click", () => {
    const senha = ctx.$lockOverlay.find("input").val();

    if (senha === "myio2025") {
      ctx.$lockOverlay.remove();
    } else {
      alert("Senha incorreta!");
    }
  });

  ctx.$lockOverlay.remove();

  // Ações (dashboard, report, config)
  ctx.$container
    .off("click", ".card-action")
    .on("click", ".card-action", function (e) {
      e.stopPropagation();
      const $card = $(this).closest(".device-card-centered");
      const entityId = $card.data("entity-id");
      const entityType = $card.data("entity-type");
      const entitySlaveId = $card.data("entity-slaveid");
      const entityIngestionId = $card.data("entity-ingestionid");
      //const entityComsuption = $card.data("data-entity-consumption");
      const entityUpdatedIdentifiers = $card.data("entity-updated-identifiers");
      const entityLabel = $card.data("entity-label") || "SEM-LABEL";
      const entityCentralId = $card.data("entity-centralid");
      const action = $(this).data("action");

      const $span = $card.find(".consumption-value");
      const entityComsuption =
        Number($span.data("entity-consumption")) ??
        // lê data-entity-consumption
        Number(
          // fallback: extrai do texto formatado "12.345,67 kWh"
          $span
            .text()
            .replace(/[^\d,.-]/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
        );

      console.log(
        `[Ação] ${action} em ${entityLabel} (ID: ${entityId}, Tipo: ${entityType})`
      );
      console.log(
        `[CLICK] >>> card-action > Detalhes: SlaveID=${entitySlaveId}, IngestionID=${entityIngestionId}, CentralID=${entityCentralId}, Consumption=${entityComsuption}, UpdatedIdentifiers=${entityUpdatedIdentifiers}`
      );
    });

  // Relatórios e menus
  $(".menu-toggle-btn").on("click", function () {
    $(".menu-dropdown").toggle();
  });

  $(".menu-dropdown .menu-item").on("click", function () {
    const tipo = $(this).data("report");
    const selecionados = $(".checkbox-icon[data-checked='true']").closest(
      ".device-card-centered"
    );

    if (tipo === "lojas" && selecionados.length > 0) {
      const confirmar = confirm(
        "Deseja considerar apenas as lojas selecionadas?"
      );

      if (confirmar) {
        selecionados.each(function () {
          const entityId = $(this).data("entity-id");
          const entityType = $(this).data("entity-type");
          openDashboardPopupReport(entityId, entityType);
        });
      } else {
        openDashboardPopupReport("default-shopping-id", "ASSET");
      }
    } else {
      openDashboardPopupReport("default-shopping-id", "ASSET");
    }

    $(".menu-dropdown").hide();
  });

  $(".menu-item").on("click", function () {
    $(".menu-item").removeClass("active");
    $(this).addClass("active");

    const categoria = $(this).text().trim();
    // Alternar cards de energia/água/etc, se necessário
  });

  $(".btn-report").on("click", () => {
    openDashboardPopupAllReport("default-shopping-id", "ASSET", );
  });

  $(".btn-report.shopping").on("click", () => {
    openDashboardPopupReport("default-shopping-id", "ASSET");
  });

  $("#fullScreen").on("click", function () {
    openWidgetFullScreen();
  });

  // Get current dates from the date range picker
  const { start, end } = self.ctx.getDates();
  
  // Convert to timestamps for data fetching
  const startTs = new Date(`${start}T00:00:00-03:00`).getTime();
  const endTs = new Date(`${end}T23:59:59-03:00`).getTime();

  self.ctx.$scope.startTs = startTs;
  self.ctx.$scope.endTs = endTs;

  // Add loadData function to scope for template access
  self.ctx.$scope.loadData = async function () {
    try {
      // Reload the widget data with current date range from picker
      await self.onInit();
    } catch (error) {
      console.error("[scope.loadData] Error reloading data:", error);
    }
  };

  // Reinicializa os grupos
  for (const g in ctx.groups) {
    ctx.groups[g] = [];
    ctx.groupDivs[g].find(".card-list").empty();
  }

  const devices = ctx.datasources || [];
  const entityMap = {};
  const groupSums = {
    [groupLabels[0]]: 0,
    [groupLabels[1]]: 0,
    [groupLabels[2]]: 0,
  };

  let totalGeral = 0;

  // Mapeia os dispositivos
  devices.forEach((device) => {
    const { entityId, entityType } = device;
    const sourceName = device.entityName;
    const label = device.entityLabel;
    const centralId = getValueByDatakey(ctx.data, sourceName, "centralId");
    const slaveId = getValueByDatakey(ctx.data, sourceName, "slaveId");
    const ingestionId = getValueByDatakey(ctx.data, sourceName, "ingestionId");
    const labelOrName = label || sourceName;
    const group = classify(labelOrName);

    if (!centralId || !slaveId) return;

    entityMap[entityId] = {
      entityId,
      entityType,
      label,
      group,
      sourceName,
      slaveId,
      centralId,
      ingestionId,
      val: 0,
    };
  });

  try {
    if (devices.length === 0) {
      console.warn("Nenhum dispositivo válido encontrado.");
      return;
    }

    // 1) get customerId from settings or use default
    const customerId = self.ctx.settings.customerId || "";

    if (!CUSTOMER_ID) {
      alert(
        "customerId ausente. Configure o widget (settings.customerId) ou CUSTOMER_ID."
      );
      return;
    }

    // 2) build URL with start/end time and deep=1
    const url = new URL(
      `${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/energy/devices/totals`
    );
    const startTimeISO = toSpOffsetNoMs(startTs); // startTs é number
    const endTimeISO = toSpOffsetNoMs(endTs, true); // força fim do dia

    url.searchParams.set("startTime", startTimeISO);
    url.searchParams.set("endTime", endTimeISO);
    url.searchParams.set("deep", "1");

    // 3) call API with fixed Bearer
    const DATA_API_TOKEN = await MyIOAuth.getToken();
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${DATA_API_TOKEN}`,
      },
    });

    if (!res.ok) {
      let msg = `API request failed with status ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {}
      throw new Error(msg);
    }

    const payload = await res.json(); // { data: [...], summary: {...} } ou (raramente) [...]
    const dataList = Array.isArray(payload) ? payload : payload.data || [];

    // sanity check
    if (!Array.isArray(dataList)) {
      throw new Error(
        "Resposta inesperada do Data API: não há array em `data`."
      );
    }

    // Create map by device ID (ingestionId) for direct lookup
    const deviceDataMap = new Map();
    let skippedEntitiesCount = 0;

    dataList.forEach((device) => {
      if (device.id) {
        deviceDataMap.set(String(device.id), device);
      }
    });

    console.log(
      `[onInit] Created device map with ${deviceDataMap.size} entries from Data API`
    );

    // Map consumption values using ingestionId as canonical key
    for (const item of Object.values(entityMap)) {
      if (item.ingestionId && isValidUUID(item.ingestionId)) {
        const apiDevice = deviceDataMap.get(String(item.ingestionId));
        if (apiDevice) {
          item.val = Number(apiDevice.total_value || 0);
          item.consumptionKwh = item.val;
          item.isValid = true;
        } else {
          // Device not found in API response - zero fill
          item.val = 0;
          item.consumptionKwh = 0;
          item.isValid = true;
          //console.log(`[onInit] Zero-filled '${item.label || item.sourceName}': no readings in range`);
        }
      } else {
        // Invalid or missing ingestionId
        item.val = 0;
        item.consumptionKwh = 0;
        item.error = "Não mapeado: defina ingestionId válido em SERVER_SCOPE";
        item.isValid = false;
        skippedEntitiesCount++;
      }
    }

    if (skippedEntitiesCount > 0) {
      console.warn(
        `[onInit] Skipped ${skippedEntitiesCount} entities without valid ingestionId`
      );
    }

    console.log(
      `[onInit] Successfully mapped ${
        Object.values(entityMap).filter((item) => item.isValid).length
      } devices using ingestionId`
    );
  } catch (err) {
    console.error("Erro ao buscar dados do ingestion:", err);
  }

  const items = Object.values(entityMap).sort((a, b) => b.val - a.val);

  items.forEach((item) => {
    const group = item.group;
    groupSums[group] += item.val;
    totalGeral += item.val;
  });

  const deviceEntities = Object.values(entityMap).map(item => ({
      id: item.entityId,
      entityType: item.entityType
  }));


  try {
      console.log("[onInit] Iniciando busca em massa da hierarquia...");
      // CHAMA A FUNÇÃO EM MASSA
      hierarchyMap = await fetchDeviceHierarchyInBulk(deviceEntities);
      console.log(`[onInit] Hierarquia carregada. ${hierarchyMap.size} dispositivos mapeados.`);
  } catch (e) {
      console.error("Erro ao buscar hierarquia em massa:", e);
      // O widget continuará, mas sem dados de pai/avô
  }

  items.forEach(
    async ({
      entityId,
      entityType,
      ingestionId,
      label,
      val,
      slaveId,
      centralId,
      sourceName,
    }) => {
      const identifier = sourceName.split(" ")[1].split(","); // caso seja uma lista separada por vírgula
      const updatedIdentifiers = identifier.map((id) => {
        return id.includes("SCP") ? id : "-";
      });
      const labelOrName = label || sourceName || "SEM-LABEL";
      const group = classify(labelOrName);
      const groupTotal = groupSums[group] || 0;
      const perc =
        groupTotal > 0 ? ((val / groupTotal) * 100).toFixed(1) : "0.0";
      const isOn = val > 0;
      const connectionStatus = isOn ? "power_on" : "power_off";

      const hierarchy = hierarchyMap.get(entityId);       
      const parentAsset = hierarchy?.parent;
      const grandparentAsset = hierarchy?.grandparent;

      // Use os dados do pai/avô para preencher o card
      // (Ex: Pega o 'label' ou 'name' do pai como 'deviceIdentifier')
      const parentName = parentAsset ? (parentAsset.name) : null;
      
      // (Ex: Pega o 'label' ou 'name' do avô como 'centralName')
      const grandparentName = grandparentAsset ? (grandparentAsset.name) : "N/A";

      let finalDeviceIdentifier = parentName; 

      if (parentName && grandparentName && parentName.startsWith(grandparentName)) {
        finalDeviceIdentifier = parentName.slice(grandparentName.length);
      }      

      const entityPayload = {
        id: entityId,
        entityType: entityType
      }

      const $card = MyIOLibrary.renderCardComponent({
        entityObject: {
          // --- Propriedades Principais ---
          entityId: entityId,
          labelOrName: labelOrName,
          deviceIdentifier: finalDeviceIdentifier,
          entityType: entityType,
          val: val,
          perc: perc,
          connectionStatus: connectionStatus,
          slaveId: slaveId,
          ingestionId: ingestionId,
          centralId: centralId,
          updatedIdentifiers: updatedIdentifiers,
          //deviceIdentifier: updatedIdentifiers.find((id) => id !== "-") || null,
          deviceType: "3F_MEDIDOR",
          valType: "ENERGY",
          centralName: "N/A",
          connectionStatusTime: new Date().getTime(),
          timaVal: new Date().getTime(),
        },
        handleActionDashboard: () =>
          openDashboardPopupEnergy(
            entityId,
            "DEVICE", // entityType
            slaveId, // entitySlaveId
            centralId, // entityCentralId
            ingestionId, // entityIngestionId
            labelOrName, // entityLabel
            val // entityComsuption
          ),
        handleActionReport: () =>
          openDashboardPopupReport(
            entityId,
            "DEVICE", // entityType
            slaveId, // entitySlaveId
            centralId, // entityCentralId
            ingestionId, // entityIngestionId
            labelOrName, // entityLabel
            val, // entityComsuption
            updatedIdentifiers || {} // Passando os identifiers
          ),
        handleActionSettings: () => openDashboardPopup(entityId, "DEVICE"),
        handleSelect: () => console.log("[CHECKER] Click on checke"),
        handInfo: true, // Habilita o botão (i) e o flip
      });

      //atualiza os dados. n deixa duplicar
      const $groupCol =
        (self.ctx.groupDivs && self.ctx.groupDivs[group]) || $();
      if ($groupCol.length === 0) {
        // coluna desse grupo foi ocultada → não renderiza nada aqui
        return;
      }

      const $existingCard = $groupCol.find(
        `.device-card-centered[data-entity-id="${entityId}"]`
      );

      if ($existingCard.length) {
        // Atualiza apenas os dados do card existente
        $existingCard
          .find(".consumption-value")
          .text(MyIOLibrary.formatEnergy(val));
        $existingCard.find(".device-title-percent").text(`(${perc}%)`);
        $existingCard.find(".device-image").attr("src", img);
        $existingCard.find(".flash-icon").toggleClass("flash", isOn);
        $existingCard.find(".device-image").toggleClass("blink", isOn);
      } else {
        // Adiciona o card novo
        ctx.groupDivs[group].find(".card-list").append($card);
        ctx.groups[group].push({
          label,
          val,
          $card,
        });
        ctx.groupDivs[group]
          .find(`[data-group-count="${group}"]`)
          .text(`${ctx.groups[group].length}`);
      }
    }
  );

  for (const group in groupSums) {
    if (!self.ctx.isGroupVisible(group)) continue;

    ctx.groupDivs[group]
      .find(`[data-group="${group}"]`)
      .text(MyIOLibrary.formatEnergy(groupSums[group]));
  }

  updateInfoCardsAndChart(groupSums, items);
  ctx.$lockOverlay.remove();
};

function classify(label) {
  const l = (label || "").toLowerCase();

  const groupLabels = Object.keys(GROUPS);

  ctx.groupDivs = {
    [groupLabels[0]]: $(".group-card.entrada"),
    [groupLabels[1]]: $(".group-card.administracao"),
    [groupLabels[2]]: $(".group-card.lojas"),
    "Área Comum": $(".group-card.area-comum"),
  };

  let adm = new RegExp(administration);
  let clock = new RegExp(entranceClock);
  // Tudo que é “porta de entrada” de energia
  if (clock.test(l)) return [groupLabels[0]];

  // Infra predial
  if (adm.test(l)) return [groupLabels[1]];

  // Demais: lojas
  return [groupLabels[2]];
}

function getValueByDatakey(dataList, dataSourceNameTarget, dataKeyTarget) {
  for (const item of dataList) {
    if (
      item.datasource.name === dataSourceNameTarget &&
      item.dataKey.name === dataKeyTarget
    ) {
      const itemValue = item.data?.[0]?.[1];

      if (itemValue !== undefined && itemValue !== null) {
        return itemValue;
      } else {
        console.warn(
          `Valor não encontrado para ${dataSourceNameTarget} - ${dataKeyTarget}`
        );
        return null;
      }
    }
  }
}

self.onDataUpdated = async function () {};
