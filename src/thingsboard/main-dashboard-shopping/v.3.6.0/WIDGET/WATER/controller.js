// ✨ NEW - temporary Customer Data API token & switch
const DATA_API_HOST = "https://api.data.apps.myio-bas.com";
const MEX_LEN_LABEL_DEVICE = 20;

// ✨ NEW - optional: hardcode customerId here OR read from widget settings (preferred)
let CUSTOMER_ID = ""; // e.g., "73d4c75d-c311-4e98-a852-10a2231007c4"
let CLIENT_ID = "";
let CLIENT_SECRET = "";

// RFC: Feature flags for quick rollback and controlled deployment
const FLAGS = {
  USE_API_SUMMARY_HEADER: true,
  INJECT_API_ONLY_DEVICES: false,
  STRICT_MATCH_BY_INGESTION_ID: true, // if false, fallback to gatewayId+slaveId
  VERBOSE_LOGS: false,
};

// RFC: API cache to avoid hammering the API when onDataUpdated runs multiple times
//const _apiCache = new Map(); // key: `${customerId}|${start}|${end}`

// RFC: Global refresh counter to limit data updates to 3 times maximum
let _dataRefreshCount = 0;
const MAX_DATA_REFRESHES = 3;

// Aceita Date | "YYYY-MM-DD" | "DD/MM/YYYY" | string ISO. Retorna Date válido ou null.
function parseDateFlexible(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;

  const s = String(v).trim();

  // ISO ou "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  // "DD/MM/YYYY"
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d) ? null : d;
  }

  // Último recurso: deixar o motor tentar
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// RFC: Helper functions for logging
function logInfo(msg, extra) {
  if (FLAGS.VERBOSE_LOGS) console.info(msg, extra || "");
}

function logWarn(msg, extra) {
  console.warn(msg, extra || "");
}


// RFC: Single source of truth for time window
function getTimeWindow() {
  const { startISO, endISO } = self.ctx.$scope?.state?.dateRange || {};
  return {
    startTime: startISO || toISOAt00(),
    endTime: endISO || toISOAt23(),
  };
}

function toISOAt00() {
  const { startTs } = getTimeWindowRange();
  return toSpOffsetNoMs(startTs);
}

function toISOAt23() {
  const { endTs } = getTimeWindowRange();
  return toSpOffsetNoMs(endTs, true);
}

// RFC: Helper functions for deterministic two-group rendering
function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function looksLikeTankLabel(text) {
  const t = norm(text);
  return /(caixa|reservatorio|cisterna|superior|inferior|nivel[_ ]?terraco|torre)/.test(
    t
  );
}

function groupFromDatasource(ds) {
  const a = norm(ds?.aliasName || ds?.name || "");
  if (/caixas?.*agua/.test(a)) return "Caixas D'Água";
  return "Ambientes";
}

function inferGroup({ ds, labelOrName }) {
  if (looksLikeTankLabel(labelOrName)) return "Caixas D'Água"; // override
  return groupFromDatasource(ds); // primary
}

// RFC: API data processing functions
function normalizeApiList(raw) {
  return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
}

// RFC: Generate every possible key for lookups based on device attributes
function keysFromDeviceAttrs(attrs = {}) {
  const central =
    attrs.centralId ||
    attrs.gatewayId ||
    attrs.ingestionId ||
    attrs.deviceCentralId;
  const slave = attrs.slaveId != null ? String(attrs.slaveId) : undefined;
  const deviceId = attrs.deviceId || attrs.guid || attrs.id;

  const keys = [
    deviceId,
    central,
    slave && central ? `${central}:${slave}` : undefined,
    slave,
  ].filter(Boolean);

  return keys;
}


// RFC: Build separate maps for different device types
function buildTotalsMapFromApi(apiList, flags = FLAGS) {
  const totalsMap = new Map();
  const deviceMap = new Map(); // Track which devices we've seen

  if (!Array.isArray(apiList)) {
    logWarn("[buildTotalsMapFromApi] Invalid API list provided");
    return totalsMap;
  }

  logInfo(`[buildTotalsMapFromApi] Processing ${apiList.length} API items`);

  for (const item of apiList) {
    const central = item.gatewayId || item.centralId;
    const slave = item.slaveId != null ? String(item.slaveId) : undefined;
    const deviceId = item.deviceId || item.id;

    // Generate all possible keys for this API item
    const keys = [
      deviceId,
      central,
      slave && central ? `${central}:${slave}` : undefined,
      slave,
    ].filter(Boolean);

    const total = Number(item.totalConsumption ?? item.total_value ?? 0);

    // Store the device info for debugging
    const deviceInfo = {
      id: deviceId,
      central,
      slave,
      total,
      name: item.name || `Device ${slave || deviceId}`,
    };

    // Add to all possible keys
    for (const key of keys) {
      if (key) {
        totalsMap.set(key, (totalsMap.get(key) || 0) + total);
        deviceMap.set(key, deviceInfo);

        if (flags.VERBOSE_LOGS) {
          logInfo(
            `[buildTotalsMapFromApi] Mapped key "${key}" -> ${total} (${deviceInfo.name})`
          );
        }
      }
    }
  }

  logInfo(
    `[buildTotalsMapFromApi] Created ${totalsMap.size} key mappings from ${apiList.length} API items`
  );
  return totalsMap;
}

const DAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

// MyIOAuth instance - initialized in onInit
let myIOAuth = null;

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

  return { startTs, endTs };
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

// Simple rule: > 48h => 1d; else 1h (mirrors the template behavior)
function determineGranularity(startTs, endTs) {
  const hours = (endTs - startTs) / 3600000;
  return hours > 48 ? "1d" : "1h";
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

// RFC: Enhanced function to fetch water totals from Data API with caching
async function fetchCustomerWaterTotals(
  customerId,
  { startTime, endTime } = {}
) {
  // Use provided time window or fallback to getTimeWindow()
  if (!startTime || !endTime) {
    const timeWindow = getTimeWindow();
    startTime = timeWindow.startTime;
    endTime = timeWindow.endTime;
  }

  const key = `${customerId}|${startTime}|${endTime}`;
  // if (_apiCache.has(key)) {
  //     logInfo(`[water] Using cached API data for ${key}`);
  //     return _apiCache.get(key);
  // }

  // if (!customerId) {
  //     logWarn(`[water] Missing customerId`);
  //     const fallback = { data: [], summary: { totalDevices: 0, totalValue: 0 } };
  //     _apiCache.set(key, fallback);
  //     return fallback;
  // }

  // if (!DATA_API_HOST) {
  //     logWarn(`[water] DATA_API_HOST is not configured`);
  //     const fallback = { data: [], summary: { totalDevices: 0, totalValue: 0 } };
  //     _apiCache.set(key, fallback);
  //     return fallback;
  // }

  try {
    const DATA_API_TOKEN = await myIOAuth.getToken();
    if (!DATA_API_TOKEN) {
      throw new Error("Failed to obtain authentication token");
    }

    const url = new URL(
      `${DATA_API_HOST}/api/v1/telemetry/customers/${customerId}/water/devices/totals`
    );
    url.searchParams.set("startTime", startTime);
    url.searchParams.set("endTime", endTime);
    url.searchParams.set("deep", "1");

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${DATA_API_TOKEN}` },
    });

    if (!response.ok) {
      logWarn(`[water] API ${response.status} ${response.statusText}`);
      const fallback = {
        data: [],
        summary: { totalDevices: 0, totalValue: 0 },
      };
      //_apiCache.set(key, fallback);
      return fallback;
    }

    const json = await response.json();

    // Normalize response format
    const normalizedResponse = {
      data: Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : [],
      summary: json?.summary || {
        totalDevices: Array.isArray(json)
          ? json.length
          : json?.data?.length || 0,
        totalValue: 0,
      },
    };

    // Calculate summary totals if not provided
    if (!json?.summary?.totalValue && normalizedResponse.data.length > 0) {
      normalizedResponse.summary.totalValue = normalizedResponse.data.reduce(
        (sum, item) => {
          return sum + Number(item.totalConsumption ?? item.total_value ?? 0);
        },
        0
      );
    }

    // Cache for 60 seconds
    // _apiCache.set(key, normalizedResponse);
    // setTimeout(() => _apiCache.delete(key), 60000);

    logInfo(`[water] API fetch successful`, {
      devices: normalizedResponse.data.length,
      total: normalizedResponse.summary.totalValue,
    });
    return normalizedResponse;
  } catch (error) {
    logWarn(`[water] API fetch failed: ${error.message}`);
    const fallback = { data: [], summary: { totalDevices: 0, totalValue: 0 } };
    //_apiCache.set(key, fallback);
    return fallback;
  }
}

async function openDashboardPopupHidro(
  entityId,
  entityType,
  entitySlaveId,
  entityCentralId,
  entityLabel,
  entityComsuption,
  startDate,
  endDate
) {
  $("#dashboard-popup").remove();

  console.log("stardate: ", startDate);
  console.log("enddate: ", endDate);

  const settings = self.ctx.settings || {};
  const startTs = startDate;
  const endTs = endDate;
  const labelDefault = entityLabel || "SEM-LABEL";
  const gatewayId = entityCentralId;
  const apiBaseUrl = settings.apiBaseUrl || "https://ingestion.myio-bas.com";

  // Estado/variáveis globais para o widget
  window.consumption = entityComsuption || -1;
  let percentageValue = 0; // percentual com sinal, número
  let percentageType = "neutral"; // "increase", "decrease", "neutral"
  let isLoading = false;
  let errorMessage = "";
  let lastConsumption = 0;
  const measurement = "M³";
  let img = "api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4";
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
                flex: 1; display: flex; flex-direction: column; justify-content: flex-start;
                padding: 12px; box-sizing: border-box; background-color: var(--tb-service-background,#fff);
                border-radius: var(--tb-border-radius,4px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.05); min-height: 0;">
                
                <!-- Título -->
                <div style="text-align:center; font-size:1.2rem; font-weight:600; margin-bottom:4px;
                            display:flex; align-items:center; justify-content:center; gap:8px;">
                    <div class="myio-lightning-icon-container">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32px" height="32px" 
                             viewBox="0 -880 960 960" style="display:block;">
                            <circle cx="480" cy="-480" r="320" fill="none" stroke="#00BCD4" stroke-width="50"/>
                            <path d="M480 -720 C410 -620 340 -540 340 -440 C340 -340 410 -280 480 -260 
                                     C550 -280 620 -340 620 -440 C620 -540 550 -620 480 -720 Z" fill="#00BCD4"/>
                            <ellipse cx="420" cy="-500" rx="38" ry="62" fill="rgba(255,255,255,0.4)" 
                                     transform="rotate(-25 420 -500)"/>
                        </svg>
                    </div>
                    ${displayLabel}
                </div>

                <!-- Ícone -->
                <div style="text-align:center; margin-bottom:8px;">
                    <img src="${img}" alt="ícone" width="92" height="92" style="object-fit: contain;" />
                </div>

                <!-- Valor + Percentual -->
                <div style="display:flex; justify-content:center; align-items:center; margin-bottom:4px;">
                    <div style="font-size:1.4rem; font-weight:600; color:#212121;">
                         ${window.consumption} m³
                    </div>
                    <div style="margin-left:8px; font-size:1rem; font-weight:600; color:${color}; display:none">
                        ${sign} ${percentageValue}% ${arrow}
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
                <div style="text-align:center; font-size:0.85rem; color:#757575; margin-bottom:12px; display:none">
                    Último período: 
                    <strong> ${MyIOLibrary.formatWaterVolumeM3(lastConsumption)}</strong>
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
                <input type="text" value="${
                  attrs.identificadorMedidor
                }" readonly>
              </div>
              
              <div class="info-item">
                <label>Identificador do Dispositivo</label>
                <input type="text" value="${
                  attrs.identificadorDispositivo
                }" readonly>
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

      //window.consumption = consumoAtual;
      window.consumption = entityComsuption;
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

  // Popup HTML
  const $popup = $(`
  <div id="dashboard-overlay" style="position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 10000; background: rgba(0,0,0,0.25);">
    <div id="dashboard-modal" style="width: 80vw; border-radius: 10px; background: #f7f7f7; box-shadow: 0 0 20px rgba(0,0,0,0.35); overflow: auto; display: flex; flex-direction: column;">
      <div id="dashboard-header" style="height: 56px; background: #4A148C; color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; font-weight: 700; font-size: 1.05rem;">
        <div>Consumo de Água</div>
        <button id="close-dashboard-popup" style="background: #f44336; color: #fff; border: none; border-radius: 50%; width: 34px; height: 34px; cursor: pointer; font-size: 18px;">×</button>
      </div>
      <div id="dashboard-cards-wrap" style="display: flex; gap: 20px; padding: 20px; align-items: stretch; min-height: calc(90vh - 56px);">
        <div style="flex: 0 0 33%; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.08); border-radius: 6px; overflow: hidden;">
          <div id="consumo-widget-container" style="padding: 16px; height: 100%;">${renderWidget()}</div>
        </div>
        <div style="flex: 0 0 65%; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.08); border-radius: 6px; overflow: hidden;">
          <div id="chart-container" style="padding: 16px; width: 100%; height: 100%; box-sizing: border-box; display:flex; flex-direction:column;">
            <h2 style="margin:0; font-size:18px; color:#673ab7; font-weight:bold;">Hidrômetro ${labelDefault}</h2>
            <p style="margin:5px 0 12px; font-size:13px; color:#333;">
              <span style="display:inline-block; width:10px; height:10px; background:#2196f3; border-radius:50%; margin-right:6px;"></span> Metros cúbicos
            </p>
            <div style="flex:1; min-height:260px;">
              <canvas id="hidrometroChart" style="width:100%; height:100%;"></canvas>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:40px; margin-top:8px; font-size:13px; color:#333;">
              <div><strong>Avg</strong><br><span id="avgValue">0.00 m³</span></div>
              <div><strong>Total</strong><br><span id="totalValue">0.00 m³</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  $("body").append($popup);
  $(document).on("click", "#close-dashboard-popup", () =>
    $("#dashboard-overlay").remove()
  );

  // Atributos + widget comparativo
  attrs = await getEntityInfoAndAttributes();
  if (attrs.label) entityLabel = attrs.label;

  updateWidgetContent();

  await enviarDados();

  // Buscar dados da API p/ gráfico
  try {
    const response =
      await window.EnergyChartSDK.EnergyChart.getEnergyComparisonSum({
        gatewayId: gatewayId,
        slaveId: entitySlaveId,
        startTs: startDate,
        endTs: endDate,
        apiBaseUrl: apiBaseUrl,
      });

    const labels = Object.keys(response.currentPeriod.daily || {});
    const values = Object.values(response.currentPeriod.daily || {});

    const ctx = document.getElementById("hidrometroChart").getContext("2d");
    if (self.chartInstance) self.chartInstance.destroy();

    self.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Metros cúbicos",
            data: values,
            backgroundColor: "#2196f3",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "m³" } },
        },
        plugins: { legend: { display: false } },
      },
    });

    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? total / values.length : 0;
    document.getElementById("avgValue").innerText = avg.toFixed(2) + " m³";
    document.getElementById("totalValue").innerText = total.toFixed(2) + " m³";
  } catch (err) {
    console.error("Erro ao buscar dados do gráfico:", err);
    document.getElementById("chart-container").innerHTML =
      "<div style='padding:20px; text-align:center; color:red;'>Erro ao carregar gráfico.</div>";
  }
}

async function openDashboardPopupWater(
  entityId,
  entityType,
  entitySlaveId,
  entityCentralId,
  entityLabel,
  entityComsuption,
  percent
) {
  $("#dashboard-popup").remove();
  const settings = self.ctx.settings || {};
  const startTs = new Date(self.ctx.$scope.startTs);
  const endTs = new Date(self.ctx.$scope.endTs);
  const labelDefault = entityLabel || "SEM-LABEL";
  const gatewayId = entityCentralId;
  const apiBaseUrl = settings.apiBaseUrl || "https://ingestion.myio-bas.com";
  const timezone =
    self.ctx.timeWindow.timezone ||
    self.ctx.settings.timezone ||
    "America/Sao_Paulo";
  const startDate = MyIOLibrary.formatDateToYMD(startTs);
  const endDate = MyIOLibrary.formatDateToYMD(endTs);
  const interval = determineInterval(startTs, endTs);
  const jwtToken = localStorage.getItem("jwt_token");
  const measurement = "m.c.a.";

  // Variáveis globais do widget
  window.consumption = 0;
  let percentageValue = 0;
  let percentages = 0;
  let percentageType = "neutral";
  let isLoading = false;
  let lastConsumption = 0;

  // Atributos do dispositivo
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

  // Função para buscar atributos
  async function getEntityInfoAndAttributes() {
    try {
      const entityResponse = await fetch(`/api/device/${entityId}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${jwtToken}`,
        },
      });
      if (!entityResponse.ok) throw new Error("Erro ao buscar entidade");
      const entity = await entityResponse.json();
      const label = entity.label || entity.name || "Sem etiqueta";

      const attrResponse = await fetch(
        `/api/plugins/telemetry/DEVICE/${entityId}/values/attributes?scope=SERVER_SCOPE`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `Bearer ${jwtToken}`,
          },
        }
      );
      if (!attrResponse.ok) throw new Error("Erro ao buscar atributos");

      const attributes = await attrResponse.json();
      const get = (key) =>
        attributes.find((attr) => attr.key === key)?.value || "";

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

  // Função para renderizar widget de consumo
  function renderWidget() {
    let img = "/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq";

    if (percent >= 70) {
      img = "/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq";
    } else if (percent >= 40) {
      img = "/api/images/public/4UBbShfXCVWR9wcw6IzVMNran4x1EW5n";
    } else if (percent >= 20) {
      img = "/api/images/public/aB9nX28F54fBBQs1Ht8jKUdYAMcq9QSm";
    } else {
      img = "/api/images/public/qLdwhV4qw295poSCa7HinpnmXoN7dAPO";
    }

    const heigtconsumption = MyIOLibrary.formatWaterByGroup(
      entityComsuption * 100,
      "Caixas D'Água"
    );

    console.log("");
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
<svg xmlns="http://www.w3.org/2000/svg" width="32px" height="32px" viewBox="0 -880 960 960" style="display:block;">
  <!-- círculo externo -->
  <circle cx="480" cy="-480" r="320" fill="none" stroke="#00BCD4" stroke-width="50"/>

  <!-- gota interna -->
  <path d="M480 -720
           C410 -620 340 -540 340 -440
           C340 -340 410 -280 480 -260
           C550 -280 620 -340 620 -440
           C620 -540 550 -620 480 -720 Z"
        fill="#00BCD4"/>

  <!-- brilho sutil na gota -->
  <ellipse cx="420" cy="-500" rx="38" ry="62" fill="rgba(255,255,255,0.4)" transform="rotate(-25 420 -500)"/>
</svg>
  </div>
        ${displayLabel}
    </div>

    <!-- Ícone -->
    <div style="text-align:center; margin-bottom:8px;">
        <img src="${img}" alt="ícone" width="92" height="92" style="object-fit: contain;" />
    </div>

    <!-- Valor + Percentual -->
    <div style="display:flex; justify-content:center; align-items:center; margin-bottom:4px;">
        <div style="font-size:1.4rem; font-weight:600; color:#212121;">
            ${heigtconsumption}
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
    <div style="text-align:center; font-size:0.85rem; color:#757575; margin-bottom:12px; display:none">
        Porcentagem da Caixa: <strong>${MyIOLibrary.formatNumberReadable(
          percent
        )}%</strong>
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
    if (container) container.innerHTML = renderWidget();
  }

  async function enviarDados() {
    const consumoAtual = attrs.consumoDiario || 0;
    const consumoAnterior = attrs.consumoMadrugada || 0;
    window.consumption = consumoAtual;
    lastConsumption = consumoAnterior;

    if (consumoAnterior === 0 && consumoAtual === 0)
      (percentageType = "neutral"), (percentageValue = 0);
    else if (consumoAnterior === 0 && consumoAtual > 0)
      (percentageType = "increase"), (percentageValue = 100);
    else {
      const percent =
        ((consumoAtual - consumoAnterior) / consumoAnterior) * 100;
      percentageValue = percent;
      percentageType =
        percent > 0 ? "increase" : percent < 0 ? "decrease" : "neutral";
    }
    updateWidgetContent();
  }

  // Criar popup
  const $popup = $(`
        <div id="dashboard-overlay" style="position: fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:10000; background: rgba(0,0,0,0.25);">
            <div style="width:80vw; border-radius:10px; background:#f7f7f7; overflow:auto; display:flex; flex-direction:column;">
                <div style="height:56px; background:#4A148C; color:#fff; display:flex; align-items:center; justify-content:space-between; padding:0 20px; font-weight:700;">Nivel de Água
                    <button id="close-dashboard-popup" style="background:#f44336; color:#fff; border:none; border-radius:50%; width:34px; height:34px; cursor:pointer;">×</button>
                </div>
                <div style="display:flex; gap:20px; padding:20px; min-height:calc(90vh - 56px);">
                    <div style="flex:0 0 33%; background:#fff; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.08);">
                        <div id="consumo-widget-container" style="padding:16px;">${renderWidget()}</div>
                    </div>
                   <div style="
                        flex:0 0 65%; 
                        background:#fff; 
                        border-radius:6px; 
                        box-shadow:0 2px 6px rgba(0,0,0,0.08); 
                        padding:16px;
                    
                        /* Adicionado para centralizar vertical e horizontalmente */
                        display: flex;
                        flex-direction: column;
                        justify-content: center; /* vertical */
                        align-items: center;     /* horizontal */
                        min-height: 400px;       /* garante altura mínima para centralizar */
                    ">

                     <div id="chart-wrapper" style="position: relative; width: 100%; height: 90%;">
                            <div id="chartTitle" style="
                              display: inline-block; /* faz a caixa “apertar” no texto */
                              padding: 6px 12px;
                              border: 1px solid #ccc;
                              border-radius: 4px;
                              background: #f9f9f9;
                              font-size: 0.85rem;
                              font-weight: 600;
                              margin-bottom: 15px;
                            ">
                            </div>
                             <div id="loading" style="
                              position: absolute;
                              top: 50%;
                              left: 50%;
                              transform: translate(-50%, -50%);
                              display: block; /* começa visível */
                              width: 50px;
                              height: 50px;
                              border: 6px solid #ccc;
                              border-top: 6px solid #2196F3;
                              border-radius: 50%;
                              animation: spin 1s linear infinite;
                          "></div>

                          <canvas id="chart-water" style="width: 100%; height: 100%;"></canvas>
                          
                          <div id="loading" style="
                              position: absolute;
                              top: 50%;
                              left: 50%;
                              transform: translate(-50%, -50%);
                              display: none;
                              width: 50px;
                              height: 50px;
                              border: 6px solid #ccc;
                              border-top: 6px solid #2196F3;
                              border-radius: 50%;
                              animation: spin 1s linear infinite;
                          "></div>
                        </div>


                    </div>
                </div>
            </div>
        </div>
    `);
  $("body").append($popup);
  $("#close-dashboard-popup").on("click", () =>
    $("#dashboard-overlay").remove()
  );

  // Buscar atributos e atualizar widget
  attrs = await getEntityInfoAndAttributes();
  updateWidgetContent();
  await enviarDados();

  // Use canvas chart for water tanks instead of EnergyChartSDK
  // Initialize canvas chart for water level visualization
  const loadingEl = document.getElementById("loading");
  const chartEl = document.getElementById("chart-water");

  // mostra loading e esconde gráfico
  loadingEl.style.display = "block";
  chartEl.style.display = "none";

  try {
    const url = `/api/plugins/telemetry/DEVICE/${entityId}/values/timeseries?keys=water_level&startTs=${startTs.getTime()}&endTs=${endTs.getTime()}&agg=AVG&interval=86400000&limit=1000`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": `Bearer ${jwtToken}`,
      },
    });

    const data = await response.json();
    console.log("Telemetria water_level:", data);

    // garante que existe telemetria
    const waterData = data.water_level || [];

    // 1. agrupar por dia
    const groupedByDay = {};

    waterData.forEach((item) => {
      const date = new Date(item.ts);
      const day = date.toISOString().split("T")[0]; // pega só o dia (YYYY-MM-DD)

      if (!groupedByDay[day]) {
        groupedByDay[day] = [];
      }
      groupedByDay[day].push(Number(item.value));
    });

    // 2. calcular média de cada dia
    const labels = [];
    const values = [];

    for (const [day, vals] of Object.entries(groupedByDay)) {
      const avg = vals.reduce((sum, v) => sum + v, 0) / vals.length / 100;

      // converter a label para DD-MM-YYYY
      const [year, month, date] = day.split("-");
      const formattedDay = `${date}-${month}-${year}`;

      labels.push(formattedDay);
      values.push(avg.toFixed(2));
    }

    const ctx = document.getElementById("chart-water").getContext("2d");
    if (self.chartInstance) self.chartInstance.destroy();

    self.chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Nível de Água (m³)",
            data: values,
            backgroundColor: "rgba(33, 150, 243, 0.2)",
            borderColor: "#2196f3",
            borderWidth: 2,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,

            title: { display: true, text: "Nível de Água (m³)" },
          },
        },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: `Nível de Água - ${labelDefault}`,
          },
        },
      },
    });
    loadingEl.style.display = "none";
    chartEl.style.display = "block";
    document.getElementById(
      "chartTitle"
    ).innerText = `Nível de Água - ${labelDefault}`;
  } catch (err) {
    console.error("Erro ao buscar dados do gráfico de nível:", err);
    document.getElementById("chart-wrapper").innerHTML =
      "<div style='padding:20px; text-align:center; color:red;'>Erro ao carregar gráfico de nível.</div>";
  }
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
    style="position: fixed; top: 5%; left: 5%; width: 90%; height: 90%; background: #F7F7F7; border-radius: 10px; box-shadow: 0 0 15px rgba(0,0,0,0.4); z-index: 10000; display: flex; flex-direction: column; font-family: Arial, sans-serif;">
    <!-- Cabeçalho -->
    <div
        style="background: #4A148C; color: white; padding: 12px 20px; font-weight: bold; font-size: 1.1rem; border-top-left-radius: 10px; border-top-right-radius: 10px; flex-shrink: 0;">
        Configurações
        <button id="close-dashboard-popup"
            style="float: right; background: #F44336; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; font-weight: bold; cursor: pointer;">×</button>
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
                <h3 style="color: #4A148C; margin-bottom: 20px;">Alarmes Água - ${
                  valores.etiqueta
                }</h3>
                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Consumo Máximo Diário (L)</label>
                <input type="text" class="form-input" value="${
                  valores.consumoDiario || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />
                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Consumo Máximo na Madrugada (0h - 06h) (L)</label>
                <input type="text" class="form-input" value="${
                  valores.consumoMadrugada || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />
                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Consumo Máximo Horário Comercial (09h - 22h) (L)</label>
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
    let $row;
    if (device.isValid) {
      $row = $(`
                <tr>
                    <td>${device.entityLabel}</td>
                    <td>${deviceId}</td>
                    <td>${
                      device.consumptionM3 != null
                        ? device.consumptionM3.toFixed(2)
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
    totalconsumption = totalconsumption + data.consumptionM3;
  });
  rows.push(["DATA EMISSÃO", dataHoraFormatada]);
  rows.push(["Total", totalconsumption.toFixed(2)]);
  rows.push(["Loja", "Identificador", "Consumo"]);
  reportData.forEach((data) => {
    rows.push([
      data.entityLabel || data.deviceName || "-",
      data.deviceId || "-",
      data.consumptionM3 != null
        ? formatNumberReadable(data.consumptionM3)
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

async function openDashboardPopupAllReport(entityId, entityType) {
  $("#dashboard-popup").remove();

  // Conteúdo interno do popup (a tabela do relatório)
  const popupContent = `
<div class="widget-container">
    <div class="widget-header">
        <h3 class="widget-title">Relatório de Consumo de Água</h3>
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
          <span>💧 Total consumo: <strong id="totalM3">0,00 m³</strong></span>
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
                    <th class="sortable" data-sort-key="deviceId">
                        <span class="label">Identificador</span><span class="arrow"></span>
                    </th>
                    <th class="sortable" data-sort-key="consumptionM3">
                        <span class="label">Consumo (M³)</span><span class="arrow"></span>
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
        Consumo Geral por Loja - Água
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

  // Get customerId from settings or use default
  const customerId = self.ctx.settings && self.ctx.settings.customerId;
  console.log("[water] popup open", { customerId });

  const originalDatasources = self.ctx.datasources || [];
  const datasources = originalDatasources.filter(
    (ds) => ds.aliasName !== "Caixas de agua"
  );

  // Sort alphabetically by label
  datasources.sort((a, b) => {
    const labelA = (a.entity?.label || a.label || "").toLowerCase();
    const labelB = (b.entity?.label || b.label || "").toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return 0;
  });

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
      centralId: null,
      slaveId: null,
      consumptionM3: null,
      error: null,
      isValid: false,
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
      consumptionM3: null,
      error: null,
      isValid: false,
    };

    try {
      if (!ds.entityId || !ds.entityType) {
        throw new Error("Contexto do dispositivo ausente");
      }

      const deviceAttributes = await attributeService
        .getEntityAttributes(
          { id: ds.entityId, entityType: ds.entityType },
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

  // Load data button click handler
  $("#loadDataBtn").on("click", async () => {
    const startDateStr = $("#startDate").val();
    const endDateStr = $("#endDate").val();

    if (!startDateStr || !endDateStr) {
      alert("Selecione as duas datas antes de carregar.");
      return;
    }

    try {
      // Format timestamps with timezone offset
      const startTime = toSpOffsetNoMs(new Date(startDateStr + "T00:00:00"));
      const endTime = toSpOffsetNoMs(new Date(endDateStr + "T23:59:59"), true);

      console.log("start time =========>", startTime);
      console.log("end time =========>", endTime);

      // Use the water totals API
      const apiData = await fetchCustomerWaterTotals(customerId, {
        startTime,
        endTime,
      });
      console.log("api data ==========>   ", apiData);

      const apiList = normalizeApiList(apiData);

      console.log(`[loadDataBtn] Water API returned ${apiList.length} devices`);

      // Create map by device ID for fast lookup
      const deviceDataMap = new Map();
      apiList.forEach((device) => {
        if (device.id) {
          deviceDataMap.set(String(device.id), device);
        }
      });

      // Update report data with consumption values
      self.ctx.$scope.reportData.forEach((device) => {
        if (device.ingestionId) {
          const apiDevice = deviceDataMap.get(String(device.ingestionId));
          if (apiDevice) {
            device.consumptionM3 = Number(
              apiDevice.totalConsumption || apiDevice.total_value || 0
            );
          } else {
            device.consumptionM3 = 0;
          }
        } else {
          device.consumptionM3 = 0;
          device.error = "Dispositivo sem ingestionId válido";
          device.isValid = false;
        }
      });

      // Set default sorting
      self.ctx.$scope.sortColumn =
        self.ctx.$scope.sortColumn || "consumptionM3";
      self.ctx.$scope.sortReverse = self.ctx.$scope.sortReverse ?? true;

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
      habilitarBotaoExport();
      renderHeaderStats(self.ctx.$scope.reportData);
      updateMainReportSortUI();
      attachMainReportSortHeaderHandlers();

      console.log(
        `[loadDataBtn] Successfully updated ${self.ctx.$scope.reportData.length} devices in report table`
      );
    } catch (err) {
      console.error("[loadDataBtn] Error fetching from Water API:", err);
      alert("Erro ao buscar dados da API. Veja console para detalhes.");
    }
  });

  $("#exportCsvBtn").on("click", () => {
    exportToCSVAll(self.ctx.$scope.reportData);
  });

  $("#close-dashboard-popup").on("click", () => $("#dashboard-popup").remove());

  // Helper function to render header stats
  function renderHeaderStats(reportData) {
    const validDevices = reportData.filter((d) => d.isValid);
    const totalConsumption = validDevices.reduce(
      (sum, d) => sum + (d.consumptionM3 || 0),
      0
    );

    $("#storesCount").text(validDevices.length);
    $("#totalM3").text(formatNumberReadable(totalConsumption) + " m³");
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
    if (self.ctx.$scope.sortColumn === "consumptionM3") {
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
  const currentColumn = self.ctx.$scope.sortColumn || "consumptionM3";
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

      // Sync dropdowns with new state (if they exist)
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

function exportToCSV(reportData, insueDate, name, identify) {
  if (!reportData?.length) {
    alert("Erro: Nenhum dado disponível para exportar.");
    return;
  }

  const rows = [];
  let totalconsumption = 0;
  reportData.forEach((data) => {
    totalconsumption = totalconsumption + Number(data.totalConsumption);
  });
  rows.push(["DATA EMISSÃO", insueDate]);
  rows.push(["Total", totalconsumption.toFixed(2)]);
  rows.push(["Loja:", name, identify]);
  rows.push([
    "Data",
    "Dia da Semana",
    "Consumo Médio (m³)",
    "Consumo Mínimo (m³)",
    "Consumo Máximo (m³)",
    "Consumo (m³)",
  ]);
  reportData.forEach((data) => {
    rows.push([
      data.formattedDate,
      data.day,
      data.avgConsumption,
      data.minDemand,
      data.maxDemand,
      data.totalConsumption,
    ]);
  });

  const csvContent =
    "data:text/csv;charset=utf-8," + rows.map((e) => e.join(";")).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute(
    "download",
    `registro_consumo_loja${reportData[0].name}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ✨ NEW - SDK-style chart/iFrame open function (v3.4.0)
function openWaterChartIframe(deviceId, startDate, endDate) {
  // Container - try both possible container IDs
  let container = document.getElementById("chart-wrapper");
  if (!container) {
    container = document.getElementById("chart-container");
  }
  if (!container) {
    console.error(
      "openWaterChartIframe(): Neither #chart-wrapper nor #chart-container found"
    );
    return;
  }

  // Destroy previous
  if (self.chartInstance && typeof self.chartInstance.destroy === "function") {
    self.chartInstance.destroy();
    self.chartInstance = null;
  }
  container.innerHTML = "";

  // SDK check (as in template)
  if (
    !window.EnergyChartSDK ||
    typeof window.EnergyChartSDK.renderTelemetryChart !== "function"
  ) {
    console.error("EnergyChartSDK v2 (renderTelemetryChart) not loaded!");
    container.innerHTML =
      '<div style="padding: 20px; text-align: center; color: red;">EnergyChartSDK v2 (renderTelemetryChart) not loaded. Check widget configuration and browser console.</div>';
    return;
  }

  const settings = self.ctx.settings || {};
  const tw = self.ctx.timeWindow;
  const timezone = "America/Sao_Paulo";
  /*
    const startISO  = formatDateTimeToISO(tw.minTime, timezone);
    const endISO    = formatDateTimeToISO(tw.maxTime, timezone);
    */

  const gran = "1d"; //determineGranularity(tw.minTime, tw.maxTime);
  const clientId = settings.clientId || "ADMIN_DASHBOARD_CLIENT";
  const clientSecret = settings.clientSecret || "admin_dashboard_secret_2025";
  const apiBaseUrl = settings.apiBaseUrl || DATA_API_HOST;
  const iframeBase =
    settings.iframeBaseUrl || "https://graphs.apps.myio-bas.com";
  const theme = settings.theme || "light";

  console.log(
    `Initializing v2 water chart: deviceId=${deviceId}, start=${startDate}, end=${endDate}, granularity=${gran}, tz=${timezone}`
  );
  self.chartInstance = window.EnergyChartSDK.renderTelemetryChart(container, {
    version: "v2",
    clientId,
    clientSecret,
    deviceId,
    readingType: "water",
    startDate: startDate,
    endDate: endDate,
    granularity: gran,
    theme,
    timezone,
    iframeBaseUrl: iframeBase,
    apiBaseUrl,
  });

  // Optional listeners (template does this)
  if (self.chartInstance && typeof self.chartInstance.on === "function") {
    self.chartInstance.on("drilldown", (evt) =>
      console.log("v2 Water SDK Drilldown:", evt)
    );
    self.chartInstance.on("error", (err) => {
      console.error("v2 Water SDK Error:", err);
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">v2 Water Chart Error: ${
        err.message || "Unknown error"
      }</div>`;
    });
  }
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

function openDashboardPopupReport(
  entityId,
  entityType,
  entityIngestionId,
  entityLabel,
  entityComsuption,
  entityUpdatedIdentifiers,
  sourceName
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
            <h2 style="font-size: 18px; font-weight: 500; color: #333; margin: 0 0 -20px 0;">Relatório Consumo de Água Geral por Loja </h2>
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
              <th class="sortable" data-sort-key="consumptionM3" style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">
                <span class="label">Consumo (m³)</span><span class="arrow"></span>
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
      Consumo de Água
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
  const reportState = { start: "", end: "" };

  function setReportDates({ start, end }) {
    if (start) reportState.start = start;
    if (end) reportState.end = end;
    console.log("[WATER REPORT] set dates →", reportState);
    $popup.find("#start-date").val(reportState.start || "");
    $popup.find("#end-date").val(reportState.end || "");
  }

  // Initialize with current widget dates
  setReportDates({
    start: self.ctx?.$scope?.startDate || "",
    end: self.ctx?.$scope?.endDate || "",
  });

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
  console.log("[WATER REPORT] popup open", {
    deviceId: entityId,
    ingestionId: entityIngestionId,
  });
  $popup.on("remove", () => console.log("[WATER REPORT] popup closed"));

  $("#close-dashboard-popup").on("click", () => $("#dashboard-popup").remove());

  function applyDetailSort(rows) {
    const col = self.ctx.$scope.detailSortColumn || "date";
    const rev = !!self.ctx.$scope.detailSortReverse;

    return [...rows].sort((a, b) => {
      let x = a[col],
        y = b[col];

      if (col === "consumptionM3") {
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
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo};text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${MyIOLibrary.formatWaterVolumeM3(
        item.consumptionM3
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
      console.log("[WATER REPORT] Load clicked with", { start, end });

      if (!entityIngestionId) {
        alert(
          "Dispositivo não possui ingestionId válido para consulta na Data API."
        );
        return;
      }

      try {
        // Format timestamps with timezone offset
        const startTime = toSpOffsetNoMs(new Date(start + "T00:00:00"));
        const endTime = toSpOffsetNoMs(new Date(end + "T23:59:59"), true);

        console.log(
          `[WATER REPORT] Fetching data for ingestionId=${entityIngestionId} from ${startTime} to ${endTime}`
        );

        // Build Data API URL with required parameters for water
        const url = `${DATA_API_HOST}/api/v1/telemetry/devices/${entityIngestionId}/water?startTime=${encodeURIComponent(
          startTime
        )}&endTime=${encodeURIComponent(
          endTime
        )}&granularity=1d&page=1&pageSize=1000&deep=0`;

        console.log(
          `[WATER REPORT] Calling Data API: ${
            url.split("?")[0]
          } with deviceId=${entityIngestionId}`
        );

        const response = await fetchWithAuth(url);
        const data = await response.json();

        // Handle response - expect array even for single device
        if (!Array.isArray(data) || data.length === 0) {
          console.warn(
            "[WATER REPORT] Data API returned empty or invalid response"
          );
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
            consumptionM3: dailyMap[dateStr] != null ? dailyMap[dateStr] : 0,
          };
        });

        self.ctx.$scope.reportData = reportData;
        self.ctx.$scope.totalConsumption = totalconsumption;
        self.ctx.$scope.insueDate = insueDate;
        document.getElementById("total-consumo").textContent = MyIOLibrary.formatWaterVolumeM3(totalconsumption);
        document.getElementById("inssueDate").textContent = insueDate;

        updateTable();
        habilitarBotaoExport();

        console.log(
          `[WATER REPORT] Successfully processed ${consumption.length} consumption records, total: ${totalconsumption} m³`
        );
      } catch (error) {
        console.error("[WATER REPORT] Error fetching from Data API:", error);
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
        self.ctx.$scope.insueDate,
        entityLabel,
        entityUpdatedIdentifiers
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

  // Set current date
  const todayDate = document.getElementById("inssueDate");
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;
  todayDate.textContent = formattedDate;
}

// Helper function to fetch with authentication
async function fetchWithAuth(url, opts = {}, retry = true) {
  const token = await myIOAuth.getToken();
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
    const token2 = await myIOAuth.getToken();
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

async function openConfigCaixa(entityId, entityType) {
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
        alarmepercentualativo: get("waterPercentageAlarmEnabled"),
        alarmaracimade: get("waterLevelPercentageHigh"),
        alarmenivelcriticoativo: get("criticalLevelEnabled"),
        nivelcritico: get("criticalLevelLow"),
        alarmedeconsumomaximodiario: get("maxDailyCubicMetersEnabled"),
        consumomaximodiario: get("maxDailyCubicMeters"),
        alarmedeconsumomaximonoturnoativo: get("maxNightConsumptionEnabled"),
        consumomaximonoturno: get("maxNightConsumption"),
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
                <h3 style="color: #4A148C; margin-bottom: 20px;">Alarmes Caixa D'água - ${
                  valores.etiqueta
                }</h3>

                <input type="checkbox" ${
                  valores.alarmepercentualativo ? "checked" : ""
                } style="margin-right:8px;" />
                <label style="font-weight:500; color:#333; margin-bottom:12px; display:inline-block;">Alarme de Percentual de Água</label>
                <br/>
                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Alarme acima de (%)</label>
                <input type="text" class="form-input" value="${
                  valores.alarmaracimade || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />
                <input type="checkbox" ${
                  valores.alarmenivelcriticoativo ? "checked" : ""
                } style="margin-right:8px;" />
                <label style="font-weight:500; color:#333; margin-bottom:12px; display:inline-block;">Alarme de Nível Crítico</label>
                <br/>
                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Nível Crítico (L)</label>
                <input type="text" class="form-input" value="${
                  valores.nivelcritico || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />
                <input type="checkbox" ${
                  valores.alarmedeconsumomaximodiario ? "checked" : ""
                } style="margin-right:8px;" />
                <label style="font-weight:500; color:#333; margin-bottom:12px
; display:inline-block;">Alarme de Consumo Máximo Diário</label>
                <br/>
                <input type="checkbox" ${
                  valores.alarmedeconsumomaximonoturnoativo ? "checked" : ""
                } style="margin-right:8px;" />
                <label style="font-weight:500; color:#333; margin-bottom:12px; display:inline-block;">Alarme de Consumo Máximo na Madrugada (0h - 06h)</label>
                <br/>
                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Consumo Máximo Diário (m³)</label>
                <input type="text" class="form-input" value="${
                  valores.consumomaximodiario || ""
                }" style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />
                <label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Consumo Máximo na Madrugada (m³)</label>
                <input type="text" class="form-input" value="${
                  valores.consumomaximonoturno || ""
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
      waterPercentageAlarmEnabled: $popup
        .find("input[type='checkbox']")
        .eq(0)
        .is(":checked"),
      waterLevelPercentageHigh: inputs.eq(6).val(),
      criticalLevelEnabled: $popup
        .find("input[type='checkbox']")
        .eq(1)
        .is(":checked"),
      criticalLevelLow: inputs.eq(7).val(),
      maxDailyCubicMetersEnabled: $popup
        .find("input[type='checkbox']")
        .eq(2)
        .is(":checked"),
      maxDailyCubicMeters: inputs.eq(8).val(),
      maxNightConsumptionEnabled: $popup
        .find("input[type='checkbox']")
        .eq(3)
        .is(":checked"),
      maxNightConsumption: inputs.eq(9).val(),
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

// Função principal de reload da board
async function loadMainBoardData(strt, end) {
  try {
    // Chama onInit com as datas atuais do usuário
    await self.onInit({ strt, end });

    // Atualiza UI
    self.ctx.detectChanges();
  } catch (err) {
    console.error("[MAIN] Error loading board data:", err);
  }
}

// RFC-0014: styleOnPicker removed - no longer needed with MyIOLibrary DateRangePicker

// --- DATES STORE MODULE (shared with ENERGY via localStorage) ---
const DatesStore = (() => {
  const STORAGE_KEY = 'myio_dashboard_dates';

  // Initialize state from localStorage or use defaults
  let state = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log('[WATER][DATES] Loaded from localStorage:', parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('[WATER][DATES] Failed to load from localStorage:', e);
    }
    return { start: '', end: '' };
  })();

  function normalize(d) {
    if (!d) return d;
    // Handle ISO date with timezone (from daterangepicker)
    if (d.includes('T')) {
      return d.slice(0, 10);
    }
    // Handle date already in YYYY-MM-DD format
    return d;
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[WATER][DATES] Failed to save to localStorage:', e);
    }
  }

  return {
    get() { return { ...state }; },
    set({ start, end } = {}) {
      if (start) state.start = normalize(start);
      if (end) state.end = normalize(end);
      console.log('[WATER][DATES] set →', JSON.stringify(state));

      // Save to localStorage for persistence across widget navigation
      saveToStorage();
    }
  };
})();

self.onInit = async function ({ strt: presetStart, end: presetEnd } = {}) {

  // Initialize MyIOLibrary DateRangePicker (aligned with ENERGY widget)
  var $inputStart = $('input[name="startDatetimes"]');
  var dateRangePicker;

  // Get dates from DatesStore (which loads from localStorage) if presets not provided
  const storedDates = DatesStore.get();
  const effectivePresetStart = presetStart || storedDates.start;
  const effectivePresetEnd = presetEnd || storedDates.end;

  console.log('[WATER] Using MyIOLibrary.createDateRangePicker');
  console.log('[WATER] Preset dates:', { effectivePresetStart, effectivePresetEnd });

  // Initialize the createDateRangePicker component
  MyIOLibrary.createDateRangePicker($inputStart[0], {
    presetStart: effectivePresetStart,
    presetEnd: effectivePresetEnd,
    onApply: function(result) {
      console.log('[WATER] DateRangePicker Applied:', result);

      // Update internal dates for compatibility
      self.ctx.$scope.startTs = result.startISO;
      self.ctx.$scope.endTs = result.endISO;
      self.startDate = result.startISO;
      self.endDate = result.endISO;

      // Update DatesStore for persistence across widget navigation
      DatesStore.set({
        start: result.startISO,
        end: result.endISO
      });
    }
  }).then(function(picker) {
    dateRangePicker = picker;
    console.log('[WATER] DateRangePicker Successfully initialized');
  }).catch(function(error) {
    console.error('[WATER] DateRangePicker Failed to initialize:', error);
  });

  // Função para pegar datas do picker
  function getDates() {
    if (dateRangePicker && dateRangePicker.getDates) {
      const result = dateRangePicker.getDates();
      return {
        startDate: result.startISO,
        endDate: result.endISO
      };
    }
    // Fallback to current scope values
    return {
      startDate: self.ctx.$scope.startTs || new Date().toISOString(),
      endDate: self.ctx.$scope.endTs || new Date().toISOString()
    };
  }

  // Evento do botão de load
  $(".load-button")
    .off("click")
    .on("click", async () => {
      // Get dates from the date picker if available
      var startDate, endDate;
      if (dateRangePicker && typeof dateRangePicker.getDates === 'function') {
        const dates = dateRangePicker.getDates();
        startDate = dates.startISO;
        endDate = dates.endISO;
      } else {
        // Fallback to scope values if picker not ready
        startDate = self.ctx.$scope.startTs;
        endDate = self.ctx.$scope.endTs;
      }

      self.ctx.$scope.startTs = startDate;
      self.ctx.$scope.endTs = endDate;

      // Update DatesStore for persistence
      DatesStore.set({
        start: startDate,
        end: endDate
      });

      updateMainReportSortUI();

      await loadMainBoardData(startDate, endDate);
    });

  const ctx = self.ctx;

  CUSTOMER_ID = self.ctx.settings.customerId || " ";
  CLIENT_ID = self.ctx.settings.clientId || " ";
  CLIENT_SECRET = self.ctx.settings.clientSecret || " ";

  // Initialize MyIOAuth using MyIOLibrary
  function initMyIOAuth(retryCount = 0) {
    if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.buildMyioIngestionAuth) {
      if (retryCount < 5) {
        console.warn(`[WATER] MyIOLibrary.buildMyioIngestionAuth not ready yet, retrying... (${retryCount + 1}/5)`);
        setTimeout(() => initMyIOAuth(retryCount + 1), 200);
        return;
      }
      console.error('[WATER] MyIOLibrary.buildMyioIngestionAuth not available after retries.');
      return;
    }

    myIOAuth = MyIOLibrary.buildMyioIngestionAuth({
      dataApiHost: DATA_API_HOST,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET
    });
    console.log("[WATER] MyIOAuth initialized successfully");
  }

  initMyIOAuth();

  console.log("[water/controller] onInit() | self.ctx >>> ", self.ctx);

  // Grupos de cards
  ctx.groups = {
    "Caixas D'Água": [],
    Ambientes: [],
  };

  // Wait for DOM to be ready and find group divs with fallback
  ctx.groupDivs = {};

  // Use a more robust approach to find group divs
  const findGroupDivs = () => {
    ctx.groupDivs["Caixas D'Água"] = $(".group-card.caixa");
    ctx.groupDivs["Ambientes"] = $(".group-card.ambientes");

    // Log for debugging
    // console.log("[water/controller] onInit() group divs found:", {
    //    "Caixas D'Água": ctx.groupDivs["Caixas D'Água"].length,
    //     "Ambientes": ctx.groupDivs["Ambientes"].length
    //   });

    // If not found, try alternative selectors
    if (ctx.groupDivs["Caixas D'Água"].length === 0) {
      ctx.groupDivs["Caixas D'Água"] = $(".group-card").filter(function () {
        return $(this).find(".group-title").text().includes("Caixas D'Água");
      });
    }

    if (ctx.groupDivs["Ambientes"].length === 0) {
      ctx.groupDivs["Ambientes"] = $(".group-card").filter(function () {
        return $(this).find(".group-title").text().includes("Ambientes");
      });
    }
  };

  // Try to find group divs immediately
  findGroupDivs();

  // If still not found, wait a bit and try again
  if (
    ctx.groupDivs["Caixas D'Água"].length === 0 ||
    ctx.groupDivs["Ambientes"].length === 0
  ) {
    setTimeout(() => {
      //    console.log("[water/controller] onInit() retrying group div search after timeout");
      findGroupDivs();
    }, 100);
  }

  ctx.$areaChartCanvas = document.getElementById("areaChart");
  ctx.$lockOverlay = $(".widget-lock-overlay");

  // Filtro de busca
  $(".search-bar").on("input", function () {
    const query = $(this)
      .val()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    $(".device-card-centered").each(function () {
      const label = $(this)
        .find(".device-title")
        .text()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // remove acentos

      $(this).toggle(label.includes(query));
    });
  });

  // Ações dos cards
  ctx.$container
    .off("click", ".card-action")
    .on("click", ".card-action", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      _dataRefreshCount = 0;

      const $card = $(this).closest(".device-card-centered");
      const action = $(this).data("action");

      // Common entity data
      const entityId = $card.data("entity-id");
      const entityType = $card.data("entity-type");
      const entitySlaveId = $card.data("entity-slaveid");
      const entityCentralId = $card.data("entity-centralid");
      const entityIngestionId = $card.data("entity-ingestionid");
      const entityUpdatedIdentifiers = $card.data("entity-updated-identifiers");
      const sourceName = $card.data("entity-sourcename");
      const percent = $card.data("entity-percent");
      const entityLabel = $card.data("entity-label") || "SEM-LABEL";

      // Robust consumption parsing
      const $span = $card.find(".consumption-value");
      const consumptionAttr = $span.data("entity-consumption");
      const entityConsumption =
        consumptionAttr !== undefined &&
        consumptionAttr !== null &&
        !Number.isNaN(Number(consumptionAttr))
          ? Number(consumptionAttr)
          : (function parseLocalizedNumber(txt) {
              // ex: "12.345,67 kWh" -> 12345.67
              const onlyNums = String(txt)
                .replace(/[^\d,.-]/g, "")
                .replace(/\./g, "") // remove thousand dots
                .replace(",", "."); // decimal comma -> dot
              const n = Number(onlyNums);
              return Number.isFinite(n) ? n : 0;
            })($span.text());

      console.log(
        `[card action] action=${action} entityId=${entityId} label=${entityLabel} consumption=${entityConsumption} (${$span.text()})`
      );

      // Context: is this a water-tank card?
      const isWaterCard = $card.closest(".group-card").hasClass("caixa");

      if (action === "dashboard") {
        // Caixa d'água
        if (isWaterCard) {
          // Tanks use the canvas-based water popup
          return openDashboardPopupWater(
            entityId,
            entityType,
            entitySlaveId,
            entityCentralId,
            entityLabel,
            entityConsumption,
            percent
          );
        }

        var newDates = getDates();

        // Ambientes: open the “hidro” popup; if we have ingestionId, render the SDK/iframe
        await openDashboardPopupHidro(
          entityId,
          entityType,
          entitySlaveId,
          entityCentralId,
          entityLabel,
          entityConsumption,
          newDates.startDate,
          newDates.endDate
        );

        if (entityIngestionId) {
          setTimeout(
            () =>
              openWaterChartIframe(
                entityIngestionId,
                newDates.startDate,
                newDates.endDate
              ),
            100
          );
        }
        return;
      }

      if (action === "dashboard_water") {
        // Hidrometro / Ambientes
        return openDashboardPopupWater(
          entityId,
          entityType,
          entitySlaveId,
          entityCentralId,
          entityLabel,
          entityConsumption,
          percent
        );
      }

      if (action === "report") {
        return openDashboardPopupReport(
          entityId,
          entityType,
          entityIngestionId,
          entityLabel,
          entityConsumption,
          entityUpdatedIdentifiers,
          sourceName
        );
      }

      if (action === "settings") {
        return openDashboardPopup(entityId, entityType);
      }

      if (action === "setting_water") {
        return openConfigCaixa(entityId, entityType);
      }
    });

  // Checkbox de seleção
  ctx.$container.on("click", ".checkbox-icon", function (e) {
    e.stopPropagation();
    const $img = $(this);
    const checked = $img.attr("data-checked") === "true";

    $img.attr("data-checked", !checked);
    $img.attr(
      "src",
      checked
        ? "/api/images/public/CDKhFbw8zLJOPPkQvQrbceQ5uO8ZZvxE"
        : "/api/images/public/1CNdGBAdq10lMHZDiHkml7HwQs370L6v"
    );
  });

  // Menu de relatórios
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
  });

  $(".btn-report.lojas").on("click", () => {
    openDashboardPopupAllReport("default-shopping-id", "ASSET");
  });

  $(".btn-report.shopping").on("click", () => {
    openDashboardPopupReport("default-shopping-id", "ASSET");
  });

  $("#fullScreen").on("click", function () {
    openWidgetFullScreen();
  });

  (function fixTopbarOffset() {
    try {
      const tb = document.querySelector(".top-bar");
      if (!tb) return;
      const r = tb.getBoundingClientRect();
      const cs = getComputedStyle(tb);
      const extra =
        parseFloat(cs.marginTop || 0) + parseFloat(cs.marginBottom || 0);
      // 24px de respiro adicional abaixo
      const offset = Math.round(r.height + extra + 24);
      document.documentElement.style.setProperty(
        "--topbar-offset",
        offset + "px"
      );
      // log opcional:
      console.log("[layout] --topbar-offset set to", offset);
    } catch (e) {
      console.warn("[layout] cannot set --topbar-offset", e);
    }
  })();

  // Função para formatar data completa com horário e timezone -03:00
  function formatDateWithTimezoneOffset(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

    // Fixo timezone -03:00
    const timezone = "-03:00";

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${timezone}`;
  }

  // Formata data só para yyyy-MM-dd para o input date
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Converte string yyyy-MM-dd para Date no horário 00:00:00
  function parseInputDateToDate(inputDateStr) {
    const parts = inputDateStr.split("-");
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  // Pega data atual
  const now = new Date();

  // Primeiro dia do mês com horário final do dia
  const firstDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    23,
    59,
    59,
    999
  );

  // Inicializa datas internas completas (com horário e timezone) se undefined
  if (self.startDate === undefined)
    self.startDate = formatDateWithTimezoneOffset(firstDay);
  if (self.endDate === undefined)
    self.endDate = formatDateWithTimezoneOffset(now);

  // Inicializa datas para exibição no input date (yyyy-MM-dd)
  if (!self.startDateFormatted)
    self.startDateFormatted = formatDateForInput(new Date(self.startDate));
  if (!self.endDateFormatted)
    self.endDateFormatted = formatDateForInput(new Date(self.endDate));

  // Atualiza o $scope para mostrar no calendário
  self.ctx.$scope.startDate = self.startDateFormatted;
  self.ctx.$scope.endDate = self.endDateFormatted;

  // Atualiza datas internas completas ao alterar no calendário
  self.ctx.$scope.handleStartDateChange = function (newDate) {
    self.startDateFormatted = newDate;
    self.ctx.$scope.startDate = newDate;

    const dateObj = parseInputDateToDate(newDate);
    self.startDate = formatDateWithTimezoneOffset(dateObj);
  };

  self.ctx.$scope.handleEndDateChange = function (newDate) {
    _dataRefreshCount = 1;
    self.endDateFormatted = newDate;
    self.ctx.$scope.endDate = newDate;

    const dateObj = parseInputDateToDate(newDate);
    // Ajusta para fim do dia 23:59:59.999
    dateObj.setHours(23, 59, 59, 999);
    self.endDate = formatDateWithTimezoneOffset(dateObj);
  };

  // const { startTs, endTs } = getTimeWindowRange();

  // self.ctx.$scope.startTs = dates.startDate;
  // self.ctx.$scope.endTs = dates.endDate;

  // Seu código que usa startTs e endTs para buscar dados deve continuar aqui.

  // Reinicializa os grupos - with safety check for group divs
  for (const g in ctx.groups) {
    ctx.groups[g] = [];

    // Safety check: re-initialize group divs if they're not found
    if (!ctx.groupDivs[g] || ctx.groupDivs[g].length === 0) {
      //console.log(`[water/controller] onDataUpdated() re-initializing group div for "${g}"`);
      if (g === "Caixas D'Água") {
        ctx.groupDivs[g] = $(".group-card.caixa");
        if (ctx.groupDivs[g].length === 0) {
          ctx.groupDivs[g] = $(".group-card").filter(function () {
            return $(this)
              .find(".group-title")
              .text()
              .includes("Caixas D'Água");
          });
        }
      } else if (g === "Ambientes") {
        ctx.groupDivs[g] = $(".group-card.ambientes");
        if (ctx.groupDivs[g].length === 0) {
          ctx.groupDivs[g] = $(".group-card").filter(function () {
            return $(this).find(".group-title").text().includes("Ambientes");
          });
        }
      }
    }

    if (ctx.groupDivs[g] && ctx.groupDivs[g].length > 0) {
      ctx.groupDivs[g].find(".card-list").empty();
    } else {
      console.error(
        `[water/controller] onDataUpdated() ERROR: Could not find or initialize group div for "${g}"`
      );
    }
  }

  const devices = ctx.datasources || [];
  let entityMap = {};

  const groupSums = {
    "Caixas D'Água": 0,
    Ambientes: 0,
  };

  let totalGeral = 0;

  // RFC: Step 1 - Build datasource device list with comprehensive logging
  logInfo(
    `[water/controller] onDataUpdated() mapping datasource devices, total devices: ${devices.length}`
  );
  const dsDevices = devices.map((device) => {
    const { entityId, entityType } = device;
    const sourceName = device.entityName;
    const label = device.entityLabel;
    const labelOrName = label || sourceName || "SEM-LABEL";

    // RFC: Use new inferGroup function with datasource-first approach
    const group = inferGroup({ ds: device, labelOrName });

    const deviceIdAttr = getValueByDatakey(ctx.data, sourceName, "deviceId");
    const gatewayId = getValueByDatakey(ctx.data, sourceName, "gatewayId");
    const slaveId = getValueByDatakey(ctx.data, sourceName, "slaveId");
    const ingestionId = getValueByDatakey(ctx.data, sourceName, "ingestionId");
    const percent =
      getValueByDatakey(ctx.data, sourceName, "water_percentage") || 0;
    const level = getValueByDatakey(ctx.data, sourceName, "water_level") || 0;

    logInfo(
      `[water/controller] Datasource device: ${labelOrName} -> Group: ${group} (datasource: ${
        device.aliasName || device.name
      })`
    );

    // RFC: Build attributes object for key generation
    const attrs = {
      deviceId: deviceIdAttr,
      centralId: gatewayId,
      gatewayId: gatewayId,
      ingestionId: ingestionId,
      slaveId: slaveId != null ? Number(slaveId) : undefined,
    };

    return {
      source: "datasource",
      entityId,
      entityType,
      label: labelOrName,
      group,
      sourceName,
      attrs,
      val2: { percent, level },
    };
  });

  let apiData;
  let injectedDevices = [];

  try {
    // RFC: Step 2 - Fetch API data
    //console.log("[water/controller] onDataUpdated() fetching water totals using new API");
    const customerId = CUSTOMER_ID || "73d4c75d-c311-4e98-a852-10a2231007c4";
    const startTime = self.ctx.$scope.startTs;
    const endTime = self.ctx.$scope.endTs;
    apiData = await fetchCustomerWaterTotals(customerId, {
      startTime,
      endTime,
    });

    // RFC: Step 3 - Normalize API data and build totals map
    const apiList = normalizeApiList(apiData);
    const totalsByKey = buildTotalsMapFromApi(apiList);

    //console.log("[water/controller] onDataUpdated() processing API data, total API devices:", apiList.length);
    // console.log("[water/controller] onDataUpdated() totalsByKey map size:", totalsByKey.size);

    // RFC: Step 4 - Build a Set of composite keys for existing datasource devices
    const dsSeen = new Set();
    for (const d of dsDevices) {
      for (const k of keysFromDeviceAttrs(d.attrs)) {
        dsSeen.add(k);
      }
    }
    //console.log("[water/controller] onDataUpdated() datasource keys tracked:", dsSeen.size);

    // RFC: Step 5 - Inject API-only devices (Ambientes) with comprehensive logging
    if (FLAGS.INJECT_API_ONLY_DEVICES) {
      logInfo(
        `[water/controller] onDataUpdated() injecting API-only devices, checking ${apiList.length} API items`
      );

      for (const item of apiList) {
        const central = item.gatewayId || item.centralId;
        const slave = item.slaveId != null ? String(item.slaveId) : undefined;

        // Prefer composite key; fall back to id/central/slave
        const probeKeys = [
          item.id,
          central && slave ? `${central}:${slave}` : undefined,
          central,
          slave,
        ].filter(Boolean);

        const alreadyInDatasource = probeKeys.some((k) => dsSeen.has(k));
        if (alreadyInDatasource) {
          logInfo(
            `[water/controller] API device already in datasources: ${
              item.name || item.id
            } (keys: ${probeKeys.join(", ")})`
          );
          continue;
        }

        // Create synthetic device entry for API-only device
        const syntheticEntityId = `api-${item.id || central + ":" + slave}`;
        const deviceLabel = item.name || `Loja ${slave ?? ""}`.trim();

        logInfo(
          `[water/controller] INJECTING API-only device: ${deviceLabel} (${syntheticEntityId})`
        );

        injectedDevices.push({
          source: "api",
          entityId: syntheticEntityId,
          entityType: "DEVICE",
          label: deviceLabel,
          group: "Ambientes",
          sourceName: deviceLabel,
          attrs: {
            deviceId: item.id,
            centralId: central,
            gatewayId: item.gatewayId,
            slaveId: item.slaveId,
          },
          val2: { percent: 0, level: 0 },
        });

        // Keep the set updated to avoid duplicates between API items
        probeKeys.forEach((k) => dsSeen.add(k));
      }
    }

    logInfo(
      `[water/controller] devices summary: datasource=${
        dsDevices.length
      }, injected=${injectedDevices.length}, total=${
        dsDevices.length + injectedDevices.length
      }`
    );

    // RFC: Step 6 - Combine all devices and build entityMap
    const allDevices = [...dsDevices, ...injectedDevices];

    for (const device of allDevices) {
      entityMap[device.entityId] = {
        entityId: device.entityId,
        entityType: device.entityType,
        label: device.label,
        group: device.group,
        sourceName: device.sourceName,
        slaveId: device.attrs.slaveId,
        centralId: device.attrs.centralId,
        ingestionId: device.attrs.ingestionId,
        val: 0,
        val2: device.val2,
        source: device.source,
      };
    }

    // RFC: Step 7 - Enhanced matching using unified keys
    let matchedDevices = 0;
    for (const dev of Object.values(entityMap)) {
      const keys = keysFromDeviceAttrs(dev);
      let matched = false;

      for (const k of keys) {
        if (totalsByKey.has(k)) {
          dev.val = Number(totalsByKey.get(k)) || 0;
          matched = true;
          //  console.log(`[water/controller] MATCH FOUND! Device "${dev.label}" (${dev.source}) matched with key "${k}" = ${dev.val}`);
          matchedDevices++;
          break;
        }
      }

      if (!matched) {
        dev.val = 0;
        if (dev.source === "api") {
          console.warn(
            `[water/controller] No total found for injected API device "${
              dev.label
            }" with keys: [${keys.join(", ")}]`
          );
        }
      }
    }

    //console.log(`[water/controller] matched devices: ${matchedDevices}/${Object.keys(entityMap).length}`);
  } catch (err) {
    console.error("[water/controller] onDataUpdated() error fetching water totals:", err);
    // Fallback: set all values to 0 if API fails
    for (const device of dsDevices) {
      entityMap[device.entityId] = {
        entityId: device.entityId,
        entityType: device.entityType,
        label: device.label,
        group: device.group,
        sourceName: device.sourceName,
        slaveId: device.attrs.slaveId,
        centralId: device.attrs.centralId,
        val: 0,
        val2: device.val2,
        ingestionId: device.attrs.ingestionId,
        source: device.source,
      };
    }
  }

  const items = Object.values(entityMap).sort((a, b) => b.val - a.val);

  // Calculate group sums AFTER all devices have been processed and matched
  console.log(
    "[water/controller] onDataUpdated() calculating group sums from matched devices, total items:",
    items.length
  );

  // Reset group sums before calculating
  groupSums["Caixas D'Água"] = 0;
  groupSums["Ambientes"] = 0;
  totalGeral = 0;

  // Calculate sums from the final entityMap values
  for (const item of items) {
    // For Caixas D'Água, use level if available, otherwise use val
    let valueToSum = item.val;
    if (item.group === "Caixas D'Água" && item.val2?.level !== undefined) {
      valueToSum = item.val2.level;
    }

    // console.log(`[water/controller] Adding to group "${item.group}": ${item.label || item.sourceName} = ${valueToSum} (source: ${item.source}, original val: ${item.val})`);
    groupSums[item.group] += valueToSum;
    totalGeral += valueToSum;
  }

  items.forEach(
    ({
      entityId,
      entityType,
      label,
      val,
      slaveId,
      centralId,
      ingestionId,
      sourceName,
      val2,
      group,
    }) => {
      const identifier = (sourceName || "").split(" ")[1]?.split(",") || [];
      const updatedIdentifiers = identifier.map((id) =>
        id.includes("SCP") ? id : "-"
      );

      const labelOrName = label || sourceName || "SEM-LABEL";
      // Use the group that was already determined in entityMap, don't re-classify
      // const group = classify(labelOrName); // REMOVED - this was causing the bug

      // Ajuste para caixas d’água
      let adjustedVal = val;
      if (group === "Caixas D'Água" && val2?.level !== undefined) {
        adjustedVal = val2.level;
      }

      //console.log(`[water/controller] Processing device: ${labelOrName} | Group: ${group} | Raw Val: ${val} | Adjusted Val: ${adjustedVal} | Source: ${val2 ? JSON.stringify(val2) : 'N/A'}`);
      const percent = (val2?.percent || 0) * 100;
      const groupTotal = groupSums[group] || 0;
      //console.log(`[water/controller] Device: ${labelOrName} | Group: ${group} | Val: ${val} | AdjustedVal: ${adjustedVal} | Percent: ${percent.toFixed(1)}% | GroupTotal: ${groupTotal}`);
      const perc = groupTotal > 0 ? ((adjustedVal / groupTotal) * 100).toFixed(1) : "0.0";
      //console.log(`[water/controller] Device: ${labelOrName} | Contribution to Group "${group}": ${perc}%`);
      const isOn = adjustedVal > 0;

      let $card;
      let img = isOn
        ? "/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4"
        : "/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4";

      // 🔹 Ícone de caixas d’água
      if (
        /superior|isterna|inferior|nível_terraço|eservat|caixa/i.test(
          labelOrName
        )
      ) {

        if (percent >= 70) img = "/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq";
        else if (percent >= 40) img = "/api/images/public/4UBbShfXCVWR9wcw6IzVMNran4x1EW5n";
        else if (percent >= 20) img = "/api/images/public/aB9nX28F54fBBQs1Ht8jKUdYAMcq9QSm";
        else img = "/api/images/public/qLdwhV4qw295poSCa7HinpnmXoN7dAPO";

        $card = $(`
          <div class="device-card-centered clickable" 
               data-entity-id="${entityId}" 
               data-entity-label="${labelOrName}" 
               data-entity-type="${entityType}" 
               data-entity-slaveid="${slaveId}" 
               data-entity-ingestionid="${ingestionId}"
               data-entity-centralid="${centralId}"
               data-entity-sourcename="${sourceName}"
               data-entity-updated-identifiers='${JSON.stringify(
                 updatedIdentifiers
               )}'
               data-entity-consumption="${adjustedVal.toFixed(2)}"
               data-entity-percent="${percent}">
            
            <div class="card-actions" style="width: 15%">
              <div class="card-action" data-action="dashboard_water" title="Dashboard">
                <img src="/api/images/public/TAVXE0sTbCZylwGsMF9lIWdllBB3iFtS"/>
              </div>
              <div class="card-action" data-action="setting_water" title="Configurações">
                <img src="/api/images/public/5n9tze6vED2uwIs5VvJxGzNNZ9eV4yoz"/>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; width: 85%">
              <div class="device-title-row">
                <span class="device-title" title="${labelOrName}">
                  ${
                    labelOrName.length > MEX_LEN_LABEL_DEVICE
                      ? labelOrName.slice(0, MEX_LEN_LABEL_DEVICE) + "…"
                      : labelOrName
                  }
                </span>
              </div>
              
              <img class="device-image ${isOn ? "blink" : ""}" src="${img}" />
              
              <div class="device-data-row">
                <div class="consumption-main">
                  <span data-entity-consumption="${MyIOLibrary.formatWaterByGroup(
                    adjustedVal,
                    group
                  )}" class="consumption-value">
                    ${MyIOLibrary.formatWaterByGroup(adjustedVal, group)}
                  </span>
                  <span class="device-title-percent">(${MyIOLibrary.formatNumberReadable(
                    percent
                  )}%)</span>
                </div>
              </div>
            </div>
          </div>
        `);
      } else {
        // 🔹 Card padrão
        $card = $(`
          <div class="device-card-centered clickable" 
               data-entity-id="${entityId}" 
               data-entity-label="${labelOrName}" 
               data-entity-type="${entityType}" 
               data-entity-slaveid="${slaveId}" 
               data-entity-centralid="${centralId}" 
               data-entity-ingestionid="${ingestionId}"
               data-entity-sourcename="${sourceName}"
               data-entity-updated-identifiers='${JSON.stringify(
                 updatedIdentifiers
               )}'
                >
            
            <div class="card-actions" style="width: 15%">
              <div class="card-action" data-action="dashboard" title="Dashboard">
                <img src="/api/images/public/TAVXE0sTbCZylwGsMF9lIWdllBB3iFtS"/>
              </div>
              <div class="card-action" data-action="report" title="Relatório">
                <img src="/api/images/public/d9XuQwMYQCG2otvtNSlqUHGavGaSSpz4"/>
              </div>
              <div class="card-action" data-action="settings" title="Configurações">
                <img src="/api/images/public/5n9tze6vED2uwIs5VvJxGzNNZ9eV4yoz"/>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; width: 85%">
              <div class="device-title-row">
                <span class="device-title" title="${labelOrName}">
                  ${
                    labelOrName.length > MEX_LEN_LABEL_DEVICE
                      ? labelOrName.slice(0, MEX_LEN_LABEL_DEVICE) + "…"
                      : labelOrName
                  }
                </span>
              </div>
              
              <img class="device-image ${isOn ? "blink" : ""}" src="${img}" />
              
              <div class="device-data-row">
                <div class="consumption-main">
                  <span class="flash-icon ${isOn ? "flash" : ""}"></span>
                  <span data-entity-consumption="${MyIOLibrary.formatWaterVolumeM3(adjustedVal)}" class="consumption-value">
                    ${MyIOLibrary.formatWaterVolumeM3(adjustedVal)}
                  </span>
                  <span class="device-title-percent">(${MyIOLibrary.formatNumberReadable(perc)}%)</span>
                </div>
              </div>
            </div>
          </div>
        `);
      }

      // console.log(`[water/controller] Creating/updating card for device "${labelOrName}" in group "${group}" with value ${adjustedVal}`);

      // Atualiza ou insere
      const $existingCard = ctx.groupDivs[group].find(`.device-card-centered[data-entity-id="${entityId}"]`);

      if ($existingCard.length) {
        //  console.log(`[water/controller] Updating existing card for "${labelOrName}" in group "${group}"`);
        $existingCard.find(".consumption-value").text(MyIOLibrary.formatWaterByGroup(adjustedVal, group));
        $existingCard.find(".device-title-percent").text(`(${MyIOLibrary.formatNumberReadable(percent)}%)`);
        $existingCard.find(".device-image").attr("src", img);
        $existingCard.find(".flash-icon").toggleClass("flash", isOn);
        $existingCard.find(".device-image").toggleClass("blink", isOn);
      } else {
        //console.log(`[water/controller] Creating new card for "${labelOrName}" in group "${group}"`);
        // console.log(`[water/controller] Group div exists for "${group}":`, ctx.groupDivs[group] && ctx.groupDivs[group].length > 0);

        if (ctx.groupDivs[group] && ctx.groupDivs[group].length > 0) {
          ctx.groupDivs[group].find(".card-list").append($card);
          ctx.groups[group].push({
            label: labelOrName,
            val: adjustedVal,
            $card,
          });

          ctx.groupDivs[group].find(`[data-group-count="${group}"]`).text(`${ctx.groups[group].length}`);
          //  console.log(`[water/controller] Successfully added card to "${group}" group. New count: ${ctx.groups[group].length}`);
        } else {
          console.error(
            `[water/controller] ERROR: Group div not found for "${group}". Available groups:`,
            Object.keys(ctx.groupDivs)
          );
        }
      }
    }
  );

  // RFC: Step 8 - Update group totals and device counts in the UI
  for (const group in groupSums) {
    const deviceCount = items.filter((item) => item.group === group).length;
    logInfo(`[water/controller] Updating group "${group}": ${deviceCount} devices, total: ${groupSums[group]}`);

    if (ctx.groupDivs[group] && ctx.groupDivs[group].length > 0) {
      // Update group total value
      ctx.groupDivs[group].find(`[data-group="${group}"]`).text(MyIOLibrary.formatWaterByGroup(groupSums[group], group));

      // Update device count
      ctx.groupDivs[group].find(`[data-group-count="${group}"]`).text(`${deviceCount}`);

      logInfo(`[water/controller] Successfully updated group "${group}" UI: ${deviceCount} devices, ${groupSums[group]} total`);
    } else {
      logWarn(`[water/controller] ERROR: Cannot update group total for "${group}" - group div not found`);
    }
  }

  // RFC: Final summary logging
  const totalDevices = items.length;
  const ambientesCount = items.filter((i) => i.group === "Ambientes").length;
  const caixasCount = items.filter((i) => i.group === "Caixas D'Água").length;

  logInfo(`[water/controller] ✅ HYBRID RENDERING COMPLETE!`);
  logInfo(
    `[water/controller] Total devices rendered: ${totalDevices} (was 27, target was 93)`
  );
  logInfo(
    `[water/controller] Ambientes: ${ambientesCount} devices, ${groupSums["Ambientes"]} m³`
  );
  logInfo(
    `[water/controller] Caixas D'Água: ${caixasCount} devices, ${groupSums["Caixas D'Água"]} m³`
  );
  logInfo(`[water/controller] API-injected devices: ${injectedDevices.length}`);

  ctx.$lockOverlay.remove();
};
