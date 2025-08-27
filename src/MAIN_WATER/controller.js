// UMD assertions and shorthands
if (!window.MyIOJSLibrary) {
  throw new Error('MyIOJSLibrary UMD not available. Please ensure the library is loaded.');
}

const MyIO = window.MyIOJSLibrary;
const { formatWater, formatEnergy: formatEnergySDK, formatPercentage, ymd, saoPauloIso, getValueByDatakey } = MyIO;

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

/************************************************************
 * MyIOAuth - Cache e renovação de access_token para ThingsBoard
 * Autor: você :)
 * Dependências: nenhuma (usa fetch nativo)
 ************************************************************/

const MyIOAuth = (() => {
  // ==== CONFIG ====
  const AUTH_URL = "https://data.myio-bas.com/api/v1/auth";

  // ⚠️ Substitua pelos seus valores:
  const CLIENT_ID = "ADMIN_DASHBOARD_CLIENT";
  const CLIENT_SECRET = "admin_dashboard_secret_2025";

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
          headers: { "Content-Type": "application/json" },
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

  return { getToken, getExpiryInfo, clearCache };
})();

// Helper function to format a millisecond timestamp to YYYY-MM-DD
function formatDateToYMD(timestampMs, tzIdentifier) {
  const date = new Date(timestampMs);
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

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
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

function formatAllInSameUnit(values) {
  const max = Math.max(...values);
  let divisor = 1;
  let unit = "M³";

  if (max >= 1000000) {
    divisor = 1000000;
    unit = "M³";
  } else if (max >= 1000) {
    divisor = 1000;
    unit = "M³";
  }

  return {
    format: (val) => (val / divisor).toFixed(2) + " " + unit,
    unit,
  };
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
          <span class="consumption-value">${formatWater(value)}</span>
          ${
            percentage != null
              ? `<span class="device-title-percent" style="color: rgba(0,0,0,0.5); font-weight: 500;">(${percentage}%)</span>`
              : ""
          }
        </div>
    </div>

  </div>
</div>
`);
}

function dashboardGraph(entityId, entityType) {
  const state = [
    { id: "default", params: { entityId: { id: entityId, entityType } } },
  ];
  const dashboardId = "14591240-58d7-11f0-9291-41f94c09a8a6";
  const stateBase64 = encodeURIComponent(btoa(JSON.stringify(state)));
  const url = `/dashboards/${dashboardId}?state=${stateBase64}`;
  self.ctx.router.navigateByUrl(url);
}

async function openDashboardPopupHidro(
  entityId,
  entityType,
  entitySlaveId,
  entityCentralId,
  entityLabel,
  entityComsuption
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
  const startDate = formatDateToYMD(startTs);
  const endDate = formatDateToYMD(endTs);
  const interval = determineInterval(startTs, endTs);

  const payload = {
    devices: [{ centralId: gatewayId, slaveId: entitySlaveId }],
    endTs: endDate,
    startTs: startDate,
    timezone: "America/Sao_Paulo",
  };

  // Estado/variáveis globais para o widget
  window.consumption = 0;
  let percentageValue = 0; // percentual com sinal, número
  let percentages = 0; // percentual sem sinal, string formatada (ex: "12.3")
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
                        ${window.consumption.toFixed(2)} ${measurement}
                    </div>
                    <div style="margin-left:8px; font-size:1rem; font-weight:600; color:${color};">
                        ${sign}${Math.abs(percentageValue).toFixed(1)}% ${arrow}
                    </div>
                </div>

                <!-- Último período -->
                <div style="text-align:center; font-size:0.85rem; color:#757575; margin-bottom:12px;">
                    Último período: <strong>${lastConsumption.toFixed(
                      2
                    )}</strong> ${measurement}
                </div>

                <!-- Campos extras -->
                <div style="display:flex; flex-direction:column; gap:6px; font-size:0.85rem;">
                    <label>Etiqueta</label>
                    <input type="text" value="${displayLabel}" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">

                    <label>Andar</label>
                    <input type="text" value="${
                      attrs.andar
                    }" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">

                    <label>Número da Loja</label>
                    <input type="text" value="${
                      attrs.numeroLoja
                    }" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">

                    <label>Identificador do Medidor</label>
                    <input type="text" value="${
                      attrs.identificadorMedidor
                    }" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">

                    <label>Identificador do Dispositivo</label>
                    <input type="text" value="${
                      attrs.identificadorDispositivo
                    }" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">

                    <label>GUID</label>
                    <input type="text" value="${
                      attrs.guid
                    }" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">
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
        startTs: startTs,
        endTs: endTs,
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
  const startDate = formatDateToYMD(startTs);
  const endDate = formatDateToYMD(endTs);
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

    const heigtconsumption = (entityComsuption / 100).toFixed(2);
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
            ${heigtconsumption} ${measurement}
        </div>
    </div>

    <!-- Último período -->
    <div style="text-align:center; font-size:0.85rem; color:#757575; margin-bottom:12px;">
        Porcentagem da Caixa: <strong>${percent}%</strong>
    </div>

    <!-- Campos extras -->
    <div style="display:flex; flex-direction:column; gap:6px; font-size:0.85rem;">
        <label>Etiqueta</label>
        <input type="text" value="${displayLabel}" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">

        <label>Andar</label>
        <input type="text" value="${attrs.andar}" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">

        <label>Número da Loja</label>
        <input type="text" value="${attrs.numeroLoja}" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">

        <label>Identificador do Medidor</label>
        <input type="text" value="${attrs.identificadorMedidor}" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">

        <label>Identificador do Dispositivo</label>
        <input type="text" value="${attrs.identificadorDispositivo}" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">

        <label>GUID</label>
        <input type="text" value="${attrs.guid}" readonly style="padding:4px; border:none; outline:none; border-radius:4px;">
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
  // --- GRÁFICO DE NÍVEL DE ÁGUA (apenas hoje) ---
  async function fetchWaterLevel() {
    const startTsMs = new Date(
      self.ctx.$scope.startDate + "T00:00:00"
    ).getTime();
    const endTsMs = new Date(
      self.ctx.$scope.endDate + "T23:59:59.999"
    ).getTime();

    try {
      const response = await fetch(
        `/api/plugins/telemetry/${entityType}/${entityId}/values/timeseries?keys=water_level&startTs=${startTsMs}&endTs=${endTsMs}&useStrictDataTypes=false&limit=100000`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Authorization": `Bearer ${jwtToken}`,
          },
        }
      );

      const data = await response.json();
      const waterData = data.water_level || [];

      // Ajusta timestamps para horário local
      const localData = waterData.map((item) => ({
        ts: new Date(item.ts), // Date já ajusta para fuso local
        value: Number(item.value),
      }));
      return localData;
    } catch (err) {
      console.error("Erro ao buscar water_level:", err);
      return [];
    }
  }

  function averageByDay(data) {
    const grouped = {};

    data.forEach((item) => {
      // Converte timestamp para dia no formato YYYY-MM-DD
      const date = new Date(item.ts);
      const day = date.toISOString().split("T")[0]; // "2025-08-26"

      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(Number(item.value));
    });

    // Calcula a média de cada dia
    const result = Object.entries(grouped).map(([day, values]) => {
      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / values.length;
      return { day, average: avg };
    });

    return result;
  }
  const loading = document.getElementById("loading");
  const chartContainer = document.getElementById("chart-water");

  // Antes de buscar os dados
  loading.style.display = "block"; // mostra "Carregando..."
  chartContainer.style.display = "none"; // esconde o gráfico

  // Buscar dados e processar
  const waterData = await fetchWaterLevel();
  const dailyAverage = averageByDay(waterData);

  // Depois que os dados chegaram
  loading.style.display = "none"; // esconde "Carregando..."
  chartContainer.style.display = "block"; // mostra gráfico

  if (window.waterChart) window.waterChart.destroy();
  // Limite de pontos no gráfico

  const labels = dailyAverage.map((item) => {
    const day = item.day.split("-")[2];
    const month = item.day.split("-")[1];

    return `${day}/${month}`;
  });
  const values = dailyAverage.map((item) => item.average / 100); // [706, 685]
  labels.reverse();
  values.reverse();

  window.waterChart = new Chart(chartContainer.getContext("2d"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Nível da Água",
          data: values,
          borderColor: "#2196F3",
          backgroundColor: "rgba(33, 150, 243, 0.2)",
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Horário" },
          ticks: {
            autoSkip: true,
            font: { weight: "bold" },
          }, // só para ticks
        },
        y: {
          title: { display: true, text: "Altura" },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: { mode: "index", intersect: false },
      },
    },
  });
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
                      device.consumptionKwh != null
                        ? device.consumptionKwh.toFixed(2)
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
                    <th>Loja</th>
                    <th>Identificador</th>
                    <th>Consumo (M³)</th>
                </tr>
            </thead>
            <tbody id="reportBody">
                <tr><td colspan="3" class="no-data">Nenhum dado disponível</td></tr>
            </tbody>
        </table>
    </div>
</div>
<style>
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
  const datasources = self.ctx.datasources || [];

  // Ordena em ordem alfabética pelo label
  datasources.sort((a, b) => {
    const labelA = (a.entity.label || "").toLowerCase();
    const labelB = (b.entity.label || "").toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return 0;
  });

  const attributeService = self.ctx.$scope.$injector.get(
    self.ctx.servicesMap.get("attributeService")
  );
  self.ctx.$scope.reportData = datasources
    .filter((ds) => ds.aliasName !== "Caixas de agua") // remove antes
    .map((ds) => {
      const entityLabel =
        ds.label || `Dispositivo (ID: ${ds.entityId.substring(0, 5)})`;

      return {
        entityId: ds.entityId,
        entityType: ds.entityType,
        deviceName: entityLabel,
        entityLabel: entityLabel,
        centralId: null,
        slaveId: null,
        consumptionKwh: null,
        error: null,
        isValid: false,
      };
    });

  const attributeFetchPromises = datasources
    .filter((ds) => ds.aliasName !== "Caixas de agua")
    .map(async (ds) => {
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
            { id: ds.entityId, entityType: ds.entityType },
            "SERVER_SCOPE",
            ["centralId", "slaveId", "deviceId"]
          )
          .toPromise();

        const centralIdAttr = deviceAttributes.find(
          (attr) => attr.key === "centralId"
        );
        const slaveIdAttr = deviceAttributes.find(
          (attr) => attr.key === "slaveId"
        );
        const deviceIdAttr = deviceAttributes.find(
          (attr) => attr.key === "deviceId"
        );

        const centralIdValue = centralIdAttr ? centralIdAttr.value : null;
        const slaveIdRawValue = slaveIdAttr ? slaveIdAttr.value : null;
        const slaveIdValue =
          typeof slaveIdRawValue === "string"
            ? parseInt(slaveIdRawValue, 10)
            : slaveIdRawValue;
        const deviceIdValue = deviceIdAttr ? deviceIdAttr.value : null;

        if (!centralIdValue || slaveIdValue === null || isNaN(slaveIdValue)) {
          deviceReportEntry.error = "Dispositivo não configurado corretamente";
          deviceReportEntry.isValid = false;
        } else {
          deviceReportEntry.centralId = centralIdValue;
          deviceReportEntry.slaveId = slaveIdValue;
          deviceReportEntry.isValid = true;
          deviceReportEntry.deviceId = deviceIdValue;
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

    // Filtra apenas dispositivos válidos
    const devicesToFetch = self.ctx.$scope.reportData
      .filter((d) => d.isValid)
      .map((d) => ({ centralId: d.centralId, slaveId: d.slaveId }));

    if (devicesToFetch.length === 0) {
      alert("Nenhum dispositivo válido encontrado");
      return;
    }
    function getSaoPauloISOString(dateStr, endOfDay = false) {
      if (!dateStr) return "";
      if (endOfDay) {
        return `${dateStr}T23:59:59.999-03:00`;
      } else {
        return `${dateStr}T00:00:00.000-03:00`;
      }
    }
    let startTs = formatDateToYMD(startDate);
    let endTs = formatDateToYMD(endDate);
    startTs = getSaoPauloISOString(startTs, false);
    endTs = getSaoPauloISOString(endTs, true);

    const params = {
      devices: devicesToFetch,
      startTs,
      endTs,
      timezone: "America/Sao_Paulo",
    };

    try {
      const response = await fetch(
        `https://ingestion.myio-bas.com/api/v1/water-readings/batch-period-sum`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `API request failed with status ${response.status}`,
        }));
        throw new Error(
          errorData.error || `API request failed with status ${response.status}`
        );
      }

      const data = await response.json();

      self.ctx.$scope.reportData.forEach((device) => {
        const match = data.find(
          (d) =>
            d.centralId === device.centralId && d.slaveId === device.slaveId
        );
        device.consumptionKwh = match ? match.consumptionKwh : null;
      });

      // Atualiza a tabela no popup
      updateReportTable(self.ctx.$scope.reportData);
      habilitarBotaoExport();
      // Aqui você pode atualizar seu popup ou tabela com os dados
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
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
  entitySlaveId,
  entityCentralId,
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
              <td colspan="6" style="padding: 12px; color:#696969;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="text-align: left;">Total:</span>
                  <span id="total-consumo" style="flex: 1; text-align: center;">0</span>
                </div>
              </td>
            </tr>


            <tr>
              <th style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">Data</th>
              <th style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">Dia da semana</th>
              <th style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">Consumo Médio Horário(m³)</th>
              <th style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">Consumo Mínimo Horário(m³)</th>
              <th style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">Consumo Máximo Horário(m³)</th>
              <th style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">Consumo do dia(m³)</th>
            </tr>
          </thead>
          <tbody id="table-body" style="font-size: 14px; color: #333;">
            <tr>
              <td colspan="6" style="text-align: center; padding: 32px; color: #666;">Nenhum dado disponível</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  
    <!-- Material Icons font link -->
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
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

  $("#close-dashboard-popup").on("click", () => $("#dashboard-popup").remove());

  // Inicializa datas (exemplo)
  const startDate = $("#start-date").val(self.ctx?.$scope?.startDate || "");
  const endDate = $("#end-date").val(self.ctx?.$scope?.endDate || "");

  // Função para formatar data em ISO (exemplo, adapte conforme seu código)

  function updateTable(processedData) {
    const tbody = document.getElementById("table-body");
    if (!tbody) return;

    if (processedData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 32px; color: #666;">Nenhum dado disponível</td></tr>`;
      return;
    }

    tbody.innerHTML = ""; // limpa

    const tC = document.getElementById("total-consumo");
    let totalConsumption = 0;
    processedData.forEach((item) => {
      totalConsumption += Number(item.totalConsumption);
    });
    // Exibe no elemento
    tC.textContent = totalConsumption.toFixed(2);

    processedData.forEach((item, index) => {
      const tr = document.createElement("tr");

      // alterna cores com base no índice
      const isCinza = index % 2 !== 0;
      const corTexto = isCinza ? "white" : "inherit";
      const corFundo = isCinza ? "#CCCCCC" : "inherit";

      tr.innerHTML = `
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo}; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${item.formattedDate}</td>
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo};text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${item.day}</td>
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo};text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${item.avgConsumption}</td>
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo};text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${item.minDemand}</td>
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo};text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${item.maxDemand}</td>
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo};text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${item.totalConsumption}</td>
    `;
      tbody.appendChild(tr);
    });
  }

  // Define a função loadData no escopo
  async function getData() {
    const startDate = $("#start-date").val();
    const endDate = $("#end-date").val();

    if (!startDate || !endDate) {
      alert("Selecione as datas de início e fim.");
      return;
    }

    self.ctx.$scope.isLoading = true;
    self.ctx.detectChanges();

    const startTs = new Date(getSaoPauloISOString(startDate, false));
    const endTs = new Date(getSaoPauloISOString(endDate, true));

    const deviceName = entityLabel;
    const centralId = entityCentralId;

    const $http = self.ctx.$scope.$injector.get(
      self.ctx.servicesMap.get("http")
    );

    const sourceNames = sourceName.replace(/\s*\([^)]*\)\s*$/, "");

    const name = encodeURIComponent(sourceNames);

    const currentRequest = $http.get(
      `https://${centralId}.y.myio.com.br/api/dash_api/demand_pulses/${name}/${startTs.getTime()}/${endTs.getTime()}`,
      { timeout: 30000 }
    );

    const consumptionData = await currentRequest.toPromise();

    const reportWaterData = consumptionData.map((dayData) => {
      const date = new Date(dayData.consumption_date);
      const day = date.getDate();
      const dayOfWeek = date.getDay();
      const month = MONTHS[date.getMonth()];
      const year = date.getFullYear();
      const formattedDate = date.toLocaleDateString("pt-BR");

      return {
        day: DAYS[dayOfWeek],
        totalConsumption: dayData.total_consumption_m3,
        avgConsumption: dayData.avg_m3_per_hour,
        formattedDate: formattedDate,
        minDemand: dayData.min_hourly_consumption_m3,
        hourMin: dayData.hour_of_min_consumption,
        hourMax: dayData.hour_of_max_consumption,
        maxDemand: dayData.max_hourly_consumption_m3,
        name: deviceName,
      };
    });

    self.ctx.$scope.reportWaterData = reportWaterData;
    updateTable(reportWaterData);
  }

  const todayDate = document.getElementById("inssueDate");

  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0"); // dia com 2 dígitos
  const month = String(today.getMonth() + 1).padStart(2, "0"); // mês (0-11) +1
  const year = today.getFullYear(); // ano completo
  const formattedDate = `${day}/${month}/${year}`;

  todayDate.textContent = formattedDate;
  // Ativa evento no botão carregar
  $("#btn-load")
    .off("click")
    .on("click", () => {
      getData();
      habilitarBotaoExport();
    });

  // (Opcional) evento para exportar CSV
  $("#btn-export-csv").on("click", () => {
    if (self.ctx.$scope.processedData) {
      exportToCSV(
        self.ctx.$scope.processedData,
        formattedDate,
        entityLabel,
        entityUpdatedIdentifiers
      );
    } else {
      alert("Função exportar CSV ainda não implementada.");
    }
  });
}

async function fetchTotalTelemetryByCustomer(customerId) {
  try {
    const jwtToken = localStorage.getItem("jwt_token");
    if (!jwtToken) {
      console.error("JWT token not found");
      return;
    }

    // Format dates for the API call
    const startTs = new Date(self.ctx.$scope.startTs);
    const endTs = new Date(self.ctx.$scope.endTs);

    // Format dates to ISO string with timezone offset
    const startTime = startTs.toISOString().replace("Z", "-03:00");
    const endTime = endTs.toISOString().replace("Z", "-03:00");

    // Construct the API URL
    const apiUrl = `https://data.myio-bas.com/api/v1/telemetry/customers/${customerId}/water?startTime=${encodeURIComponent(
      startTime
    )}&endTime=${encodeURIComponent(
      endTime
    )}&granularity=1h&page=1&pageSize=100&deep=1`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Authorization": `Bearer ${jwtToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();

    // Extract total_value from the response
    const totalValue = data.total_value || 0;

    // Update the "Caixas D'Água" group total with the new value
    const ctx = self.ctx;
    if (ctx.groupDivs && ctx.groupDivs["Caixas D'Água"]) {
      ctx.groupDivs["Caixas D'Água"]
        .find(`[data-group="Caixas D'Água"]`)
        .text(formatWater(totalValue));
    }
  } catch (error) {
    console.error("Error fetching total telemetry by customer:", error);
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

self.onInit = async function () {
  const ctx = self.ctx;

  // Grupos de cards
  ctx.groups = {
    "Caixas D'Água": [],
    Lojas: [],
    "Área Comum": [],
  };

  ctx.groupDivs = {
    "Caixas D'Água": $(".group-card.caixa"),
    Lojas: $(".group-card.lojas"),
    "Área Comum": $(".group-card.area-comum"),
  };

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
  ctx.$container.on("click", ".card-action", function (e) {
    e.stopPropagation();
    const $card = $(this).closest(".device-card-centered");
    const entityId = $card.data("entity-id");
    const entityType = $card.data("entity-type");
    const entitySlaveId = $card.data("entity-slaveid");
    const entityComsuption = $card.data("entity-consumption");
    const entityUpdatedIdentifiers = $card.data("entity-updated-identifiers");
    const entityLabel = $card.data("entity-label") || "SEM-LABEL";
    const entityCentralId = $card.data("entity-centralid");
    const action = $(this).data("action");
    const sourceName = $card.data("entity-sourcename");

    if (action === "dashboard")
      openDashboardPopupHidro(
        entityId,
        entityType,
        entitySlaveId,
        entityCentralId,
        entityLabel,
        entityComsuption
      );
    else if (action === "report")
      openDashboardPopupReport(
        entityId,
        entityType,
        entitySlaveId,
        entityCentralId,
        entityLabel,
        entityComsuption,
        entityUpdatedIdentifiers,
        sourceName
      );
    else if (action === "settings") openDashboardPopup(entityId, entityType);
    else if (action === "dashboard_water")
      openDashboardPopupWater(
        entityId,
        entityType,
        entitySlaveId,
        entityCentralId,
        entityLabel,
        entityComsuption,
        $card.data("entity-percent")
      );
    else if (action === "setting_water") openConfigCaixa(entityId, entityType);
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
};

function classify(label) {
  const l = (label || "").toLowerCase().trim();

  if (/rel[óo]gio|caixa|superior|inferior|nível_terraço/.test(l))
    return "Caixas D'Água";
  if (/administra|bomba|chiller|adm/.test(l)) return "Lojas";
  if (l === "") console.warn("classify: label vazio, agrupando como 'Lojas'");
  return "Lojas";
}

self.onDataUpdated = async function () {
  const ctx = self.ctx;

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
    self.endDateFormatted = newDate;
    self.ctx.$scope.endDate = newDate;

    const dateObj = parseInputDateToDate(newDate);
    // Ajusta para fim do dia 23:59:59.999
    dateObj.setHours(23, 59, 59, 999);
    self.endDate = formatDateWithTimezoneOffset(dateObj);
  };

  // Função chamada ao clicar no botão carregar
  self.ctx.$scope.loadData = function () {
    if (!self.startDate || !self.endDate) {
      alert(
        "Por favor, selecione a data inicial e a data final antes de carregar os dados."
      );
      return;
    }
    // Chama novamente onDataUpdated para processar dados atualizados
    self.onDataUpdated();
  };

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

  const { startTs, endTs } = getTimeWindowRange();

  self.ctx.$scope.startTs = startTs;
  self.ctx.$scope.endTs = endTs;
  // Seu código que usa startTs e endTs para buscar dados deve continuar aqui.

  // Reinicializa os grupos
  for (const g in ctx.groups) {
    ctx.groups[g] = [];
    ctx.groupDivs[g].find(".card-list").empty();
  }

  const devices = ctx.datasources || [];
  const entityMap = {};

  const groupSums = {
    "Caixas D'Água": 0,
    "Administração e Bombas": 0,
    Lojas: 0,
  };

  let totalGeral = 0;

  // Mapeia os dispositivos
  devices.forEach((device) => {
    const { entityId, entityType } = device;
    const sourceName = device.entityName;
    const label = device.entityLabel;
    const centralId = getValueByDatakey(ctx.data, sourceName, "centralId");
    const slaveId = getValueByDatakey(ctx.data, sourceName, "slaveId");
    const percent =
      getValueByDatakey(ctx.data, sourceName, "water_percentage") || 0;
    const level = getValueByDatakey(ctx.data, sourceName, "water_level") || 0;
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
      val: 0,
      val2: { percent, level },
    };
  });

  try {
    if (devices.length === 0) {
      console.warn("Nenhum dispositivo válido encontrado.");
      return;
    }

    const payloadList = Object.values(entityMap).map(
      ({ centralId, slaveId }) => ({ centralId, slaveId })
    );

    /* TODO VERIFICAR A NOVA API COM AUTENTICAÇÃO
        
        let ingestionToken = "";
        
        try {
            ingestionToken = await MyIOAuth.getToken();
       
         
        } catch (e) {
            console.error("[Widget] Falhou ao obter token:", e?.message || e);
        }        
     
       
        const response = await fetch(
            `https://data.myio-bas.com/api/v1/telemetry/devices/0f079800-b68b-11ef-9d80-0f53bf3519bb/water`,
            {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-Authorization": `Bearer ${ingestionToken}` 
                    
                },
                body: JSON.stringify({
                    devices: payloadList,
                    startTs,
                    endTs,
                    timezone: "America/Sao_Paulo",
                }),
            }
        );
        */

    const response = await fetch(
      `https://ingestion.myio-bas.com/api/v1/water-readings/batch-period-sum`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          devices: payloadList,
          startTs,
          endTs,
          timezone: "America/Sao_Paulo",
        }),
      }
    );

    if (!response.ok) throw new Error(`Erro ${response.status}`);

    const apiData = await response.json();

    const consumptionMap = new Map();

    apiData.forEach(({ centralId, slaveId, consumptionKwh }) => {
      const kwh = consumptionKwh != null ? consumptionKwh : null;
      consumptionMap.set(`${centralId}_${slaveId}`, kwh);
    });

    for (const item of Object.values(entityMap)) {
      const key = `${item.centralId}_${item.slaveId}`;
      const apiVal = consumptionMap.get(key);
      item.val = apiVal != null ? apiVal : 0;
    }
  } catch (err) {
    console.error("Erro ao buscar dados do ingestion:", err);
  }

  const items = Object.values(entityMap).sort((a, b) => b.val - a.val);

  // Supondo que groupSums e totalGeral já foram inicializados
  items.forEach((item) => {
    const group = classify(item.group || item.label || item.sourceName);
    groupSums[group] += item.val;
    totalGeral += item.val;
  });

  items.forEach(
    ({
      entityId,
      entityType,
      label,
      val,
      slaveId,
      centralId,
      sourceName,
      val2,
    }) => {
      const identifier = (sourceName || "").split(" ")[1]?.split(",") || [];
      const updatedIdentifiers = identifier.map((id) =>
        id.includes("SCP") ? id : "-"
      );

      const labelOrName = label || sourceName || "SEM-LABEL";
      const group = classify(labelOrName);

      // Ajuste para caixas d’água
      let adjustedVal = val;
      if (group === "Caixas D'Água" && val2?.level !== undefined) {
        adjustedVal = val2.level;
      }

      const percent = (val2?.percent || 0) * 100;
      const groupTotal = groupSums[group] || 0;
      const perc =
        groupTotal > 0 ? ((adjustedVal / groupTotal) * 100).toFixed(1) : "0.0";
      const isOn = adjustedVal > 0;

      let $card;
      let img = isOn
        ? "/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4"
        : "/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4";

      // 🔹 Ícone de caixas d’água
      if (/superior|inferior|nível_terraço|caixa/i.test(labelOrName)) {
        if (percent >= 70)
          img = "/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq";
        else if (percent >= 40)
          img = "/api/images/public/4UBbShfXCVWR9wcw6IzVMNran4x1EW5n";
        else if (percent >= 20)
          img = "/api/images/public/aB9nX28F54fBBQs1Ht8jKUdYAMcq9QSm";
        else img = "/api/images/public/qLdwhV4qw295poSCa7HinpnmXoN7dAPO";

        $card = $(`
          <div class="device-card-centered clickable" 
               data-entity-id="${entityId}" 
               data-entity-label="${labelOrName}" 
               data-entity-type="${entityType}" 
               data-entity-slaveid="${slaveId}" 
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
                    labelOrName.length > 15
                      ? labelOrName.slice(0, 15) + "…"
                      : labelOrName
                  }
                </span>
              </div>
              
              <img class="device-image ${isOn ? "blink" : ""}" src="${img}" />
              
              <div class="device-data-row">
                <div class="consumption-main">
                  <span data-entity-consumption="${formatWater(
                    adjustedVal
                  )}" class="consumption-value">
                    ${formatWater(adjustedVal)}
                  </span>
                  <span class="device-title-percent">(${percent}%)</span>
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
                    labelOrName.length > 15
                      ? labelOrName.slice(0, 15) + "…"
                      : labelOrName
                  }
                </span>
              </div>
              
              <img class="device-image ${isOn ? "blink" : ""}" src="${img}" />
              
              <div class="device-data-row">
                <div class="consumption-main">
                  <span class="flash-icon ${isOn ? "flash" : ""}"></span>
                  <span data-entity-consumption="${formatWater(
                    adjustedVal
                  )}" class="consumption-value">
                    ${formatWater(adjustedVal)}
                  </span>
                  <span class="device-title-percent">(${perc}%)</span>
                </div>
              </div>
            </div>
          </div>
        `);
      }

      // Atualiza ou insere
      const $existingCard = ctx.groupDivs[group].find(
        `.device-card-centered[data-entity-id="${entityId}"]`
      );
      if ($existingCard.length) {
        $existingCard
          .find(".consumption-value")
          .text(formatWater(adjustedVal));
        $existingCard.find(".device-title-percent").text(`(${percent}%)`);
        $existingCard.find(".device-image").attr("src", img);
        $existingCard.find(".flash-icon").toggleClass("flash", isOn);
        $existingCard.find(".device-image").toggleClass("blink", isOn);
      } else {
        ctx.groupDivs[group].find(".card-list").append($card);
        ctx.groups[group].push({ label: labelOrName, val: adjustedVal, $card });
        ctx.groupDivs[group]
          .find(`[data-group-count="${group}"]`)
          .text(`${ctx.groups[group].length}`);
      }
    }
  );

  for (const group in groupSums) {
    ctx.groupDivs[group]
      .find(`[data-group="${group}"]`)
      .text(formatEnergy(groupSums[group]));
  }

  // TODO ALTERAR AQUI, ESTÁ FIXADO PARA CUSTOMER ID DO CAMPINAS SHOPPING NO INGESTION NOVO
  const customerId = "73d4c75d-c311-4e98-a852-10a2231007c4";
  fetchTotalTelemetryByCustomer(customerId);

  //updateInfoCardsAndChart(groupSums, items);
  ctx.$lockOverlay.remove();
};
