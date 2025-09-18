/* eslint-disable */
// ===== MYIO SDK (UMD) ========================================================
if (!window.MyIOLibrary) {
  throw new Error('MyIOLibrary UMD not available. Check the <script> tag + version.');
}
const SDK = window.MyIOLibrary;

// Pegue só o que você usa neste controller:
const {
  // energia
  formatEnergy, formatAllInSameUnit, fmtPerc,
  // numbers
  formatNumberReadable,
  // datas
  formatDateToYMD, determineInterval, getSaoPauloISOString,
  getDateRangeArray, formatDateForInput, parseInputDateToDate,
  // dados util
  getValueByDatakey,
  // (opcional) rede e codec caso queira usar depois
  // fetchWithRetry,
} = SDK;

// ===== ADAPTERS PEQUENOS (se precisar de nomes legados) ======================
const formatEnergySDK = formatEnergy;

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
          <span class="consumption-value">${formatEnergy(value)}</span>
          ${
            percentage != null
              ? `<span class="device-title-percent" style="color: rgba(0,0,0,0.5); font-weight: 500;">(${fmtPerc(
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

async function openDashboardPopupEnergi(
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
  let percentageType = "neutral"; // "increase", "decrease", "neutral"
  let lastConsumption = 0;
  const measurement = "kWh";

  let img = "/api/images/public/g7phsMSdCo51gWcoJgi3QrKUSwj9njtC";

  if (/rel[óo]gio/i.test(labelDefault)) {
    img = "/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB";
  } else if (/subesta/i.test(labelDefault)) {
    img = "/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU";
  } else if (/bomba|chiller/i.test(labelDefault)) {
    img = "/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT";
  } else {
    img = "/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k";
  }

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
    <div style="display:flex; justify-content:center; align-items:center; margin-bottom:4px;">
        <div style="font-size:1.4rem; font-weight:600; color:#212121;">
            ${window.consumption.toFixed(2)} ${measurement}
        </div>
        <div style="margin-left:8px; font-size:1rem; font-weight:600; color: ${color};">
            ${sign}${Math.abs(percentageValue).toFixed(1)}%
            ${arrow}
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

  // Se existir SDK para gráfico, renderiza
  let renderGraph;
  if (
    window.EnergyChartSDK &&
    typeof window.EnergyChartSDK.renderGraph === "function"
  ) {
    renderGraph = window.EnergyChartSDK.renderGraph;
  } else {
    console.error("EnergyChartSDK not loaded!");
    if (self.chartContainerElement) {
      self.chartContainerElement.innerHTML =
        '<div style="padding: 20px; text-align: center; color: red;">EnergyChartSDK not loaded. Check widget configuration and browser console.</div>';
    }
    return;
  }

  const chartContainer = document.getElementById("chart-container");
  if (!chartContainer) {
    console.error("chart-container não encontrado no DOM!");
    return;
  }

  if (self.chartInstance && typeof self.chartInstance.destroy === "function") {
    self.chartInstance.destroy();
  }

  // Renderiza o gráfico de consumo de energia
  self.chartInstance = EnergyChartSDK.renderGraph(chartContainer, {
    gatewayId: gatewayId,
    slaveId: entitySlaveId,
    startDate: startDate,
    endDate: endDate,
    interval: interval,
    theme: settings.theme || "light",
    timezone: timezone,
    iframeBaseUrl: settings.iframeBaseUrl || "https://graphs.ingestion.myio-bas.com",
    apiBaseUrl: apiBaseUrl,
    chartPath: settings.chartPath || "/embed/energy-bar",
  });

  // Atualiza dados comparativos do consumo
  const params = {
    gatewayId: gatewayId,
    slaveId: entitySlaveId,
    startTs: new Date(startTs),
    endTs: new Date(endTs),
    apiBaseUrl: apiBaseUrl,
  };

  try {
    const comparisonData = await window.EnergyChartSDK.EnergyChart.getEnergyComparisonSum(params);
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

  const valores = await getEntityInfoAndAttributes(entityId, { 
    jwt: jwtToken 
  });

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
                    <th>Consumo (kWh)</th>
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
  console.log("datasources", datasources);
  // Ordena em ordem alfabética pelo label
  datasources.sort((a, b) => {
    const labelA = (a.entity.label || "").toLowerCase();
    const labelB = (b.entity.label || "").toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return 0;
  });

  console.log(datasources);

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

    
    let startTs = formatDateToYMD(startDate);
    let endTs = formatDateToYMD(endDate);
    startTs = getSaoPauloISOString(startTs, false);
    endTs = getSaoPauloISOString(endTs, true);
    console.log("startDate", startTs);
    const params = {
      devices: devicesToFetch,
      startTs,
      endTs,
      timezone: "America/Sao_Paulo",
    };

    console.log("Request params:", params);

    try {
      const response = await fetch(
        `https://ingestion.myio-bas.com/api/v1/energy-readings/batch-period-sum`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({
            error: `API request failed with status ${response.status}`,
          }));
        throw new Error(
          errorData.error || `API request failed with status ${response.status}`
        );
      }

      const data = await response.json();
      console.log("API Response (raw):", data);
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
  entityUpdatedIdentifiers
) {
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
              <th style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">Data</th>
              <th style="
                background-color: #5c307d; color: white; padding: 12px; text-align: left; font-weight: 500;
                user-select: none; position: sticky; top: 0; z-index: 1; cursor: pointer;
              ">Consumo (kWh)</th>
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
  $("#start-date").val(self.ctx?.$scope?.startDate || "");
  $("#end-date").val(self.ctx?.$scope?.endDate || "");

  // Função para formatar data em ISO (exemplo, adapte conforme seu código)

  function updateTable() {
    const tbody = document.getElementById("table-body");
    if (!tbody) return;

    const data = self.ctx.$scope.reportData || [];
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 32px; color: #666;">Nenhum dado disponível</td></tr>`;
      return;
    }

    tbody.innerHTML = ""; // limpa

    data.forEach((item, index) => {
      const tr = document.createElement("tr");

      // alterna cores com base no índice
      const isCinza = index % 2 !== 0;
      const corTexto = isCinza ? "white" : "inherit";
      const corFundo = isCinza ? "#CCCCCC" : "inherit";

      tr.innerHTML = `
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo}; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${
        item.date
      }</td>
        <td style="padding: 8px 12px; color: ${corTexto}; background-color: ${corFundo};text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5)">${item.consumptionKwh.toFixed(
        2
      )}</td>
    `;
      tbody.appendChild(tr);
    });
  }

  // Define a função loadData no escopo
  self.ctx.$scope.loadData = async function () {
    const startDate = $("#start-date").val();
    const endDate = $("#end-date").val();

    if (!startDate || !endDate) {
      alert("Selecione as datas de início e fim.");
      return;
    }

    self.ctx.$scope.isLoading = true;
    self.ctx.detectChanges();

    const startTs = getSaoPauloISOString(startDate, false);
    const endTs = getSaoPauloISOString(endDate, true);

    const params = new URLSearchParams({
      gatewayId: entityCentralId,
      slaveId: String(entitySlaveId),
      startTs,
      endTs,
      interval: "1 day",
      timezone: "America/Sao_Paulo",
    });
    const url = `https://ingestion.myio-bas.com/api/v1/energy-readings/aggregate?${params.toString()}`;

    try {
      const response = await fetch(url, { method: "GET" });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `API request failed with status ${response.status}`
        );
      }
      let totalconsumption = 0;
      const data = await response.json();

      // Gera array de datas no intervalo selecionado
      const dateRange = getDateRangeArray(startDate, endDate);

      // Mapeia os dados da API em um objeto com chave = data e valor = soma consumo
      const buckets = Array.isArray(data) ? data : [];
      const dailyMap = {};
      buckets.forEach((b) => {
        const dateTime =
          b.bucket || b.date || (b.bucket_ts_local ? b.bucket_ts_local : null);
        if (dateTime) {
          const date = dateTime.slice(0, 10);
          if (!dailyMap[date]) dailyMap[date] = 0;
          dailyMap[date] += b.total_kwh != null ? Number(b.total_kwh) : 0;
          totalconsumption = totalconsumption + Number(b.total_kwh);
        }
      });
      const now = new Date();

      const dia = String(now.getDate()).padStart(2, "0");
      const mes = String(now.getMonth() + 1).padStart(2, "0"); // mês começa em 0
      const ano = now.getFullYear();

      const hora = String(now.getHours()).padStart(2, "0");
      const minuto = String(now.getMinutes()).padStart(2, "0");

      const insueDate = ` ${dia}/${mes}/${ano} - ${hora}:${minuto}`;

      // Cria o array final preenchendo dias sem dados com 0 consumo
      const reportData = dateRange.map((dateStr) => {
        const [ano, mes, dia] = dateStr.split("-"); // divide a string
        return {
          date: `${dia}/${mes}/${ano}`, // agora no formato correto sem mexer no dia
          consumptionKwh: dailyMap[dateStr] != null ? dailyMap[dateStr] : 0,
        };
      });

      self.ctx.$scope.reportData = reportData;
      self.ctx.$scope.totalConsumption = totalconsumption.toFixed(2) + " kWh";
      self.ctx.$scope.insueDate = insueDate;
      document.getElementById("total-consumo").textContent =
        totalconsumption.toFixed(2) + " kWh";
      document.getElementById("inssueDate").textContent = insueDate;

      updateTable();
      habilitarBotaoExport();
      applySortAndDetectChanges();
    } catch (error) {
      self.ctx.$scope.errorMessage =
        error.message || "Erro ao buscar dados de consumo.";
      self.ctx.$scope.reportData = [];

      applySortAndDetectChanges();
    } finally {
      self.ctx.$scope.isLoading = false;
      self.ctx.detectChanges();
    }
  };

  // Ativa evento no botão carregar
  $("#btn-load").on("click", () => {
    self.ctx.$scope.loadData();
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

function updateInfoCardsAndChart(groupSums, items) {
  let entradaSubestacaoVal = 0;
  let entradaRelogioVal = 0;

  items.forEach(({ label = "", val }) => {
    if (/subesta/i.test(label)) entradaSubestacaoVal += val;
    else if (/rel[óo]gio/i.test(label)) entradaRelogioVal += val;
  });

  const ctx = self.ctx;
  const entradaVal = groupSums["Entrada e Relógios"];
  const adminVal = groupSums["Administração e Bombas"];
  const lojasVal = groupSums["Lojas"];

  const entradaTotal = entradaSubestacaoVal + entradaRelogioVal;
  const consumoTotal = adminVal + lojasVal;

  const consumoLimitado = Math.min(consumoTotal, entradaTotal);
  const areaComumVal = Math.max(entradaTotal - consumoLimitado, 0);

  const values = [adminVal, lojasVal, areaComumVal];
  const labels = ["Administração e Bombas", "Lojas", "Área Comum"];
  const formatter = formatAllInSameUnit(values);
  const $infoList = ctx.groupDivs["Área Comum"].find("#area-comum-list");

  /*
  
      const perc = (val) =>
          entradaVal > 0 ? ((val / entradaVal) * 100).toFixed(1) : "0.0";
          
          */

  // Calcular total do consumo interno
  const totalInterno = adminVal + lojasVal + areaComumVal;

  const percEntrada = (val) =>
    entradaVal > 0 ? ((val / entradaVal) * 100).toFixed(1) : "0.0";

  const percInterno = (val) =>
    totalInterno > 0 ? ((val / totalInterno) * 100).toFixed(1) : "0.0";

  $infoList.empty();

  /*
      $infoList.append(
          createInfoCard(
              "Total Entrada Subestação",
              entradaSubestacaoVal,
              perc(entradaSubestacaoVal),
              "/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU"
          )
      );
      $infoList.append(
          createInfoCard(
              "Total Entrada Relógios",
              entradaRelogioVal,
              perc(entradaRelogioVal),
              "/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB"
          )
      );
      $infoList.append(
          createInfoCard(
              "Adm. ...",
              adminVal,
              perc(adminVal),
              "/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT"
          )
      );
      $infoList.append(
          createInfoCard(
              "Lojas",
              lojasVal,
              perc(lojasVal),
              "/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k"
          )
      );
      $infoList.append(
          createInfoCard(
              "Área Comum",
              areaComumVal,
              perc(areaComumVal),
              "/api/images/public/oXk6v7hN8TCaBHYD4PQo5oM5fr7xuUAb"
          )
      );
      */

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

  // Esses 3 devem usar percInterno()
  $infoList.append(
    createInfoCard(
      "Adm. ...",
      adminVal,
      percInterno(adminVal),
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
    createInfoCard(
      "Área Comum",
      areaComumVal,
      percInterno(areaComumVal),
      "/api/images/public/oXk6v7hN8TCaBHYD4PQo5oM5fr7xuUAb"
    )
  );

  // Atualiza gráfico
  if (ctx.areaChart) ctx.areaChart.destroy();

  ctx.areaChart = new Chart(ctx.$areaChartCanvas.getContext("2d"), {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          label: "Consumo",
          data: values,
          backgroundColor: ["#2196f3", "#4caf50", "#ff9800"],
        },
      ],
    },
    options: {
      responsive: true,
      layout: {
        padding: {
          top: 0, // tira espaço acima
          bottom: 0, // tira espaço extra antes da legenda
        },
      },
      maintainAspectRatio: false, // <<< importante p/ respeitar a altura CSS
      plugins: {
        legend: {
          position: "bottom",
          fullSize: false,
          labels: {
            generateLabels(chart) {
              const total = chart.data.datasets[0].data.reduce(
                (a, b) => a + b,
                0
              );
              return chart.data.labels.map((label, i) => {
                const value = chart.data.datasets[0].data[i];
                const perc =
                  total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
                const fullLabel = `${label} (${perc}%) - ${formatter.format(
                  value
                )}`;
                const shortLabel = `${label.slice(
                  0,
                  14
                )}… (${perc}%) - ${formatter.format(value)}`;
                return {
                  text: shortLabel,
                  fullText: fullLabel,
                  fillStyle: chart.data.datasets[0].backgroundColor[i],
                  strokeStyle: "#fff",
                  lineWidth: 1,
                  hidden: chart.getDatasetMeta(0).data[i]?.hidden,
                  index: i,
                };
              });
            },
            boxWidth: 12,
            padding: 12,
            usePointStyle: true,
            font: { size: 11 },
            maxWidth: 90,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label =
                ctx.chart.options.plugins.legend.labels.generateLabels(
                  ctx.chart
                )[ctx.dataIndex]?.fullText;
              return label || `${ctx.label}: ${formatter.format(ctx.raw)}`;
            },
          },
        },
      },
    },
  });
}

function classify(label) {
  const l = (label || "").toLowerCase();

  // Tudo que é “porta de entrada” de energia
  if (/subesta|rel[óo]gio|entrada/.test(l)) return "Entrada e Relógios";

  // Infra predial
  if (/administra|adm\.?|bomba|chiller/.test(l))
    return "Administração e Bombas";

  // Demais: lojas
  return "Lojas";
}

self.onInit = async function () {
  const ctx = self.ctx;

  ctx.groups = {
    "Entrada e Relógios": [],
    "Administração e Bombas": [],
    Lojas: [],
  };

  ctx.groupDivs = {
    "Entrada e Relógios": $(".group-card.entrada"),
    "Administração e Bombas": $(".group-card.administracao"),
    Lojas: $(".group-card.lojas"),
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

  // Abertura de popups
  ctx.$container.on("click", ".device-card-centered", function () {
    const entityId = $(this).data("entity-id");
    const entityType = $(this).data("entity-type");
    ctx.stateController.openState(
      "default",
      { entityId: { id: entityId, entityType } },
      false
    );
  });

  // Ações (dashboard, report, config)
  ctx.$container.on("click", ".card-action", function (e) {
    e.stopPropagation();
    const $card = $(this).closest(".device-card-centered");
    const entityId = $card.data("entity-id");
    const entityType = $card.data("entity-type");
    const entitySlaveId = $card.data("entity-slaveid");
    const entityComsuption = $card.data("data-entity-consumption");
    const entityUpdatedIdentifiers = $card.data("entity-updated-identifiers");
    const entityLabel = $card.data("entity-label") || "SEM-LABEL";
    const entityCentralId = $card.data("entity-centralid");
    const action = $(this).data("action");

    if (action === "dashboard")
      openDashboardPopupEnergi(
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
        entityUpdatedIdentifiers
      );
    else if (action === "settings") openDashboardPopup(entityId, entityType);
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

    // Alternar cards de energia/água/etc, se necessário
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
    "Entrada e Relógios": 0,
    "Administração e Bombas": 0,
    Lojas: 0,
  };

  // Mapeia os dispositivos
  devices.forEach((device) => {
    const { entityId, entityType } = device;
    const sourceName = device.entityName;
    const label = device.entityLabel;
    const centralId = getValueByDatakey(ctx.data, sourceName, "centralId");
    const slaveId = getValueByDatakey(ctx.data, sourceName, "slaveId");

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

    const response = await fetch(
      "https://ingestion.myio-bas.com/api/v1/energy-readings/batch-period-sum",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  items.forEach((item) => {
    const group = item.group;
    groupSums[group] += item.val;
    totalGeral += item.val;
  });

  items.forEach(
    ({ entityId, entityType, label, val, slaveId, centralId, sourceName }) => {
      const identifier = sourceName.split(" ")[1].split(","); // caso seja uma lista separada por vírgula
      const updatedIdentifiers = identifier.map((id) => {
        return id.includes("SCP") ? id : "-";
      });

      const labelOrName = label || sourceName;
      const group = classify(labelOrName);
      console.log("group", labelOrName);
      const groupTotal = groupSums[group] || 0;
      const perc =
        groupTotal > 0 ? ((val / groupTotal) * 100).toFixed(1) : "0.0";
      const isOn = val > 0;

      let img = "/api/images/public/g7phsMSdCo51gWcoJgi3QrKUSwj9njtC";

      if (/rel[óo]gio/i.test(labelOrName)) {
        img = isOn
          ? "/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB"
          : "/api/images/public/rYrcTQlf90m7zH9ZIbldz6KIZ7jdb5DU";
      } else if (/subesta/i.test(labelOrName)) {
        img = isOn
          ? "/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU"
          : "/api/images/public/HnlvjodeBRFBc90xVglYI9mIpF6UgUmi";
      } else if (/bomba|chiller/i.test(labelOrName)) {
        img = isOn
          ? "/api/images/public/Rge8Q3t0CP5PW8XyTn9bBK9aVP6uzSTT"
          : "/api/images/public/8Ezn8qVBJ3jXD0iDfnEAZ0MZhAP1b5Ts";
      } else {
        img = isOn
          ? "/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k"
          : "/api/images/public/sdTe2CPTbLPkbEXBHwaxjSAGVbp4wtIa";
      }

      const $card = $(`
      <div class="device-card-centered clickable" data-entity-id="${entityId}" data-entity-label="${labelOrName}" data-entity-type="${entityType}" data-entity-slaveid="${slaveId}" data-entity-centralid="${centralId}" data-entity-updated-identifiers='${JSON.stringify(
        updatedIdentifiers
      )}'>
        <div class="card-actions" style="width: 15%">
          <div class="card-action" data-action="dashboard" title="Dashboard"><img src="/api/images/public/TAVXE0sTbCZylwGsMF9lIWdllBB3iFtS"/></div>
          <div class="card-action" data-action="report" title="Relatório"><img src="/api/images/public/d9XuQwMYQCG2otvtNSlqUHGavGaSSpz4"/></div>
          <div class="card-action" data-action="settings" title="Configurações"><img src="/api/images/public/5n9tze6vED2uwIs5VvJxGzNNZ9eV4yoz"/></div>
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
              <span class="flash-icon ${isOn ? "flash" : ""}">⚡</span>
              <span class="consumption-value" data-entity-consumption="${formatEnergy(
                val
              )}">${formatEnergy(val)}</span>
              <span class="device-title-percent">(${perc}%)</span>
            </div>
          </div>
        </div>
      </div>
    `);
      //atualiza os dados. n deixa duplicar
      const $existingCard = ctx.groupDivs[group].find(
        `.device-card-centered[data-entity-id="${entityId}"]`
      );

      if ($existingCard.length) {
        // Atualiza apenas os dados do card existente
        $existingCard.find(".consumption-value").text(formatEnergy(val));
        $existingCard.find(".device-title-percent").text(`(${perc}%)`);
        $existingCard.find(".device-image").attr("src", img);
        $existingCard.find(".flash-icon").toggleClass("flash", isOn);
        $existingCard.find(".device-image").toggleClass("blink", isOn);
      } else {
        // Adiciona o card novo
        ctx.groupDivs[group].find(".card-list").append($card);
        ctx.groups[group].push({ label, val, $card });
        ctx.groupDivs[group]
          .find(`[data-group-count="${group}"]`)
          .text(`${ctx.groups[group].length}`);
      }
    }
  );
  console.log("group", groupSums);
  for (const group in groupSums) {
    ctx.groupDivs[group]
      .find(`[data-group="${group}"]`)
      .text(formatEnergy(groupSums[group]));
  }

  updateInfoCardsAndChart(groupSums, items);
  ctx.$lockOverlay.remove();
};
