/* eslint-disable */
export function renderCardComponent({
  entityObject,
  handleActionDashboard,
  handleActionReport,
  handleActionSettings,
  handleSelect,
  handInfo,
  handleClickCard,
}) {
  const {
    entityId,
    labelOrName,
    deviceIdentifier,
    entityType,
    deviceType,
    slaveId,
    ingestionId,
    val,
    centralId,
    updatedIdentifiers = {},
    perc = 0,
    connectionStatus,
    centralName,
    connectionStatusTime,
    timaVal,
    valType,
  } = entityObject;

  // 1. LÓGICA DE STATUS
  const DeviceStatus = {
    CONNECTED: "connected",
    OFFLINE: "offline",
    POWER_ON: "power_on",
    STANDBY: "standby",
    POWER_OFF: "power_off",
    WARNING: "warning",
    DANGER: "danger",
    MAINTENANCE: "maintenance",
  };

  const statusIcons = {
    [DeviceStatus.CONNECTED]: "✅",
    [DeviceStatus.OFFLINE]: "🔌",
    [DeviceStatus.POWER_ON]: "⚡",
    [DeviceStatus.STANDBY]: "⏸️",
    [DeviceStatus.POWER_OFF]: "⏹️",
    [DeviceStatus.WARNING]: "⚠️",
    [DeviceStatus.DANGER]: "🚨",
    [DeviceStatus.MAINTENANCE]: "🛠️",
  };

  // 2. NOVA LÓGICA DE CLASSES E ÍCONES
  const isOfflineOrDanger =
    connectionStatus === DeviceStatus.OFFLINE ||
    connectionStatus === DeviceStatus.DANGER;

  const shouldFlashIcon =
    connectionStatus === DeviceStatus.OFFLINE ||
    connectionStatus === DeviceStatus.WARNING ||
    connectionStatus === DeviceStatus.DANGER ||
    connectionStatus === DeviceStatus.MAINTENANCE;

  const icon =
    statusIcons[connectionStatus] || statusIcons[DeviceStatus.POWER_ON];

  // Fallback seguro: não use "MyIOLibrary" direto
  const MyIO = (typeof MyIOLibrary !== "undefined" && MyIOLibrary) ||
    (typeof window !== "undefined" && window.MyIOLibrary) || {
      formatEnergy: (v, g) => `${v} kWh`,
      formatNumberReadable: (n) => Number(n ?? 0).toFixed(1),
    };

  let valFormatted = MyIO.formatEnergy(val);

  if (valType === "ENERGY") {
    valFormatted = MyIO.formatEnergy(val);
  } else if (valType === "WATER") {
    valFormatted = `${val} m³`;
  } else if (valType === "TANK") {
    valFormatted = `${val} m.c.a`;
  } else {
    valFormatted = val;
  }
  const percFormatted = MyIO.formatNumberReadable(perc);

  // Injeta CSS uma única vez
  if (!document.getElementById("myio-card-styles")) {
    const style = document.createElement("style");
    style.id = "myio-card-styles";
    // --- CSS ATUALIZADO ---
    style.textContent = ` 
.device-card-centered,
.clickable {
  width: 100%;
  border-radius: 10px;
  padding: 8px 12px;
  background: #fff;
  box-shadow: 0 4px 10px rgba(0, 0, 0, .05);
  /* display: flex; REMOVIDO */
  /* align-items: center; REMOVIDO */
  /* justify-content: center; REMOVIDO */
  cursor: pointer;
  transition: transform .2s;
  /* min-height: 140px; REMOVIDO (movido para .device-card-inner) */
  box-sizing: border-box;
  overflow: hidden;
}

.device-card-centered:hover,
.clickable:hover {
  transform: scale(1.05);
}

.device-title-row {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 4px;
  padding: 0 4px;
  min-height: 22px;
}

.device-title {
  font-weight: 700;
  font-size: .85rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90%;
  line-height: 1.1;
}

.device-subtitle {
  font-size: 0.7rem; 
  font-weight: 500;
  color: #888; /* Cinza */
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90%;
  line-height: 1.1;
  margin-top: 2px;
}

.device-image {
  max-height: 44px;
  width: auto;
  margin: 4px 0;
  display: block;
}

.device-data-row {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: auto;
  margin-bottom: 6px;
  gap: 6px;
  width: 100%;
}

.consumption-main {
  font-size: .9rem;
  font-weight: 700;
  color: #28a745;
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
  white-space: nowrap;
}

.device-title-percent {
  font-size: .75rem;
  color: rgba(0, 0, 0, .45);
  font-weight: 500;
}

.flash {
  animation: flash 1s infinite;
  color: #ff9800;
}

@keyframes flash {
  0% { opacity: 1; }
  50% { opacity: .2; }
  100% { opacity: 1; }
}

.card-actions {
  flex-shrink: 0;
  height: 100%;
  box-shadow: 1px 0 2px rgba(0, 0, 0, .1);
  display: flex;
  flex-direction: column;
  padding: 0 4px;
  justify-content: space-around;
  align-items: center;
}

.card-action img {
  width: 24px;
  height: 24px;
  transition: transform .2s ease;
  cursor: pointer;
}

.card-action img:hover {
  transform: scale(1.15);
}

.device-card-centered.offline {
  border: 2px solid #ff4d4f;
  animation: border-blink 1s infinite;
}

.device-card-centered.flipped .device-card-inner {
  transform: rotateY(180deg);
}

@keyframes border-blink {
  0%, 100% { box-shadow: 0 0 8px rgba(255, 77, 79, 0.9); }
  50% { box-shadow: 0 0 16px rgba(255, 0, 0, 0.6); }
}

.device-card-centered.offline .flash-icon {
  color: #ff4d4f !important;
  font-size: 1.2rem;
}     
.device-card-centered {
  perspective: 1000px;
}

.device-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  min-height: 140px; /* ATUALIZADO: A altura mínima agora é controlada aqui */
}

.device-card-front {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: flex-start; /* Agora isso vai funcionar */
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  backface-visibility: hidden;
  gap: 4px;
}

.device-card-back {
  transform: rotateY(180deg);
}

.device-card-front .device-info,
.device-card-back .device-info {
  position: absolute;
  top: 8px;
  right: 12px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  background: none;
  border: none;
  transition: background 0.2s;
}
.device-card-front .device-info:hover,
.device-card-back .device-info:hover {
  background: rgba(0, 0, 0, 0.05);
}


.device-card-back {
  display: flex;
  flex-direction: column;
  justify-content: space-around; /* Mantido para preencher o verso */
  align-items: stretch;
  padding: 10px;
  gap: 5px;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  
  /* Posições para o flip */
  position: absolute;
  top: 0;
  left: 0;
  backface-visibility: hidden;
  transform: rotateY(180deg);
}

.device-card-back #status-bar {
  position: relative;
  width: 100%;
  padding-top: 10px;
}

.device-card-back .value-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 5px;
  color: #c19efc;
  align-self: center;
}

.device-card-back #lastconsumptionTime {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  font-size: 11px;
  font-weight: bold;
  color: black;
  width: 100%;
  padding-bottom: 10px;
}


.device-card-centered.flipped .device-card-inner {
  transform: rotateY(180deg);
}

.flash-icon.flash {
  animation: icon-blink 1s infinite;
}

@keyframes icon-blink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.2; transform: scale(1.2); }
}

.device-card-centered.offline .flash-icon {
  color: #ff4d4f !important;
}

.device-card-centered.online .flash-icon {
  color: #28a745 !important;
}
    `;
    // --- FIM DO CSS ---
    document.head.appendChild(style);
  }
  let formattedDateVal;
  let formattedDate;
  let Infcolor = "#5cb85c";
  if (connectionStatusTime) {
    const date = new Date(connectionStatusTime);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // mês começa do 0
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    formattedDate = `Online: (${day}/${month}/${year} - ${hours}:${minutes})`;

    const datVal = new Date(timaVal);
    const dayVal = String(datVal.getDate()).padStart(2, "0");
    const monthVal = String(datVal.getMonth() + 1).padStart(2, "0"); // mês começa do 0
    const yearVal = date.getFullYear();
    const hoursVal = String(date.getHours()).padStart(2, "0");
    const minutesVal = String(date.getMinutes()).padStart(2, "0");

    const now = new Date();
    const diffMs = now - datVal;

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let diffText = "";
    if (diffMinutes < 60) {
      diffText = `${diffMinutes} minuto${diffMinutes !== 1 ? "s" : ""}`;
    } else if (diffHours < 24) {
      diffText = `${diffHours} hora${diffHours !== 1 ? "s" : ""}`;
    } else {
      diffText = `${diffDays} dia${diffDays !== 1 ? "s" : ""} `;
    }
    formattedDateVal = `${dayVal}/${monthVal}/${yearVal} - ${hoursVal}:${minutesVal} (${diffText})`;

    
    if (diffHours >= 24) {
      Infcolor = "#cc2900"; // Mais de 24h: vermelho
    } else if (diffMinutes >= 30) {
      Infcolor = "#e89105"; // Entre 30min e 24h: laranja
    }
  } else {
    Infcolor = "#d6dcdd"; // Sem dados: cinza
  }

  //

  // Função utilitária para normalizar strings
  function normalizeString(str) {
    // Adicionado fallback para caso str seja undefined
    if (typeof str !== 'string') {
      str = '';
    }
    return str
      .normalize("NFD") // separa letras dos acentos
      .replace(/[\u0300-\u036f]/g, "") // remove os acentos
      .toUpperCase(); // deixa em maiúsculo
  }

  // Mapeamento de imagens por tipo de dispositivo
  const deviceImages = {
    MOTOR:
      "https://dashboard.myio-bas.com/api/images/public/8Ezn8qVBJ3jXD0iDfnEAZ0MZhAP1b5Ts",
    "3F_MEDIDOR":
      "https://dashboard.myio-bas.com/api/images/public/f9Ce4meybsdaAhAkUlAfy5ei3I4kcN4k",
    RELOGIO:
      "https://dashboard.myio-bas.com/api/images/public/ljHZostWg0G5AfKiyM8oZixWRIIGRASB",
    HIDROMETRO:
      "https://dashboard.myio-bas.com/api/images/public/aMQYFJbGHs9gQbQkMn6XseAlUZHanBR4",
    ENTRADA:
      "https://dashboard.myio-bas.com/api/images/public/TQHPFqiejMW6lOSVsb8Pi85WtC0QKOLU",
    CAIXA_DAGUA:
      "https://dashboard.myio-bas.com/api/images/public/3t6WVhMQJFsrKA8bSZmrngDsNPkZV7fq",
  };

  // URL padrão caso o tipo não seja encontrado
  const defaultImage =
    "https://cdn-icons-png.flaticon.com/512/1178/1178428.png";

  // Normaliza e busca a imagem correspondente
  const nameType = normalizeString(deviceType);
  const img = deviceImages[nameType] || defaultImage;

  // Template HTML do card
  const html = `
    <div class="device-card-centered clickable ${
      isOfflineOrDanger ? "offline" : "" 
    }"
      data-entity-id="${entityId}"
      data-entity-label="${labelOrName}"
      data-entity-type="${entityType}"
      data-entity-slaveid="${slaveId}"
      data-entity-ingestionid="${ingestionId}"
      data-entity-consumption="${val}"
      data-entity-centralid="${centralId}"
      data-entity-updated-identifiers='${JSON.stringify(updatedIdentifiers)}'>
      <div class="device-card-inner" style="width:100%; height:100%; transform-style: preserve-3d; transition: transform 0.6s;">
       <div class="device-card-front">

          <div class="card-actions" >
            ${
              typeof handleActionDashboard === "function"
                ? `
              <div class="card-action action-dashboard" data-action="dashboard" title="Dashboard">
                <img src="https://dashboard.myio-bas.com/api/images/public/TAVXE0sTbCZylwGsMF9lIWdllBB3iFtS"/>
              </div>`
                : ``
            }
            ${
              typeof handleActionReport === "function"
                ? `
              <div class="card-action action-report" data-action="report" title="Relatório">
                <img src="https://dashboard.myio-bas.com/api/images/public/d9XuQwMYQCG2otvtNSlqUHGavGaSSpz4"/>
              </div>`
                : ``
            }
            ${
              typeof handleActionSettings === "function"
                ? `
              <div class="card-action action-settings" data-action="settings" title="Configurações">
                <img src="https://dashboard.myio-bas.com/api/images/public/5n9tze6vED2uwIs5VvJxGzNNZ9eV4yoz"/>
              </div>`
                : ``
            }
            ${
              typeof handleSelect === "function"
                ? `
              <input class="card-action action-checker" data-action="checker" title="Selecionar" type="checkbox">`
                : ``
            }
          </div>

          <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%; flex-grow: 1; min-width: 0; padding: 0 12px;">
            
            <div class="device-title-row" style="flex-direction: column; min-height: 38px;">
              <span class="device-title" title="${labelOrName}">
                ${
                  String(labelOrName ?? "").length > 15
                    ? String(labelOrName).slice(0, 15) + "…"
                    : String(labelOrName ?? "")
                }
              </span>
              ${deviceIdentifier ? `
                <span class="device-subtitle" title="${deviceIdentifier}">
                  ${deviceIdentifier}
                </span>
              ` : ''}
            </div>

            <img class="device-image" src="${img || ""}" />
            <div class="device-data-row">
              <div class="consumption-main">
                
                <span class="flash-icon ${shouldFlashIcon ? "flash" : ""}">
                  ${icon}
                </span>

                <span class="consumption-value" data-entity-consumption="${val}">${valFormatted}</span>
                <span class="device-title-percent">(${percFormatted}%)</span>
              </div>
            </div>
        </div>
        
        ${
          handInfo
            ? `
          <button id="infoButtom-front" class="device-info info-button">
            <svg xmlns="http://www.w3.org/2000/svg" height="17px" viewBox="0 -960 960 960" width="17px" fill=${Infcolor}>
              <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
            </svg>
          </button>`
            : ``
        }
        </div>
        <div class="device-card-back" >
        <div id="status-bar"> 
          <div id="status-information">
            <div style="font-size: 0.85rem; font-weight: bold;  line-height: 1;"><span>Central: ${centralName}</span></div>
            <div style="display: flex; flex-direction: row; gap: 4px;  font-weight: bold; align-items: center;">
              <div style="font-size: 12px; font-weight: bold;  line-height: 1;"><span> ${formattedDate}</span></div>
              <div style="font-size: 10px; line-height: 1;"><span></span></div> 
            </div>
          </div>
          <button id="infoButtom-back" class="device-info" style="background:none; border:none; cursor:pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" height="17px" viewBox="0 -960 960 960" width="17px" fill=${Infcolor}>
              <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
            </svg>
          </button>
        </div>

        <div class="value-container">
          <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px" fill="#dea404">
            <path d="m456-200 174-340H510v-220L330-420h126v220Zm24 120q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
          </svg>
          <div><span>${MyIO.formatEnergy(val / 1000) || "-"}</span></div>
        </div>

        <div id="lastconsumptionTime">
          <div style="font-size: 12px; font-weight: bold; color: black; line-height: 1;">Ultima Telemetria:</div>
          <div style="font-size: 11px; font-weight: bold; color: black; line-height: 1;">${formattedDateVal}</div>
        </div>
      </div>
    </div>
   </div> 
    </div>
    
  `;

  // Agora sim criamos o $card e só então anexamos handlers
  const $card = $(html);

  if (typeof handleActionDashboard === "function") {
    $card.find(".action-dashboard").on("click", (e) => {
      e.stopPropagation();
      handleActionDashboard(entityObject);
    });
  }
  if (typeof handleActionReport === "function") {
    $card.find(".action-report").on("click", (e) => {
      e.stopPropagation();
      handleActionReport(entityObject);
    });
  }
  if (typeof handleActionSettings === "function") {
    $card.find(".action-settings").on("click", (e) => {
      e.stopPropagation();
      handleActionSettings(entityObject);
    });
  }
  if (typeof handleSelect === "function") {
    // checker
    $card.find(".action-checker").on("click", (e) => {
      e.stopPropagation();
      handleSelect(entityObject);
    });
  }

  if (typeof handleClickCard === "function") {
    $card.find(".action-checker").on("click", (e) => {
      e.stopPropagation();
      handleClickCard(entityObject);
    });
  }

  $card.on("click", (e) => {
    if (!$(e.target).closest(".card-action").length) {
      if (typeof handleClickCard === "function") {
        handleClickCard(entityObject);
      } else if (typeof handleActionDashboard === "function") {
        handleActionDashboard(entityObject);
      }
    }
  });

  $card.find("#infoButtom-front").on("click", function (e) {
    e.stopPropagation();
    $(this).closest(".device-card-centered").addClass("flipped");
  });

  $card.find("#infoButtom-back").on("click", function (e) {
    e.stopPropagation();
    $(this).closest(".device-card-centered").removeClass("flipped");
  });

  return $card;
}