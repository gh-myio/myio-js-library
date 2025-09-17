export function renderCardComponent({
  entityObject,
  handleActionDashboard,
  handleActionReport,
  handleActionSettings,
  handleSelect
}) {
  const {
    entityId,
    labelOrName,
    entityType,
    slaveId,
    ingestionId,
    val,
    centralId,
    updatedIdentifiers = {},
    img,
    isOn = false,
    perc = 0,
    group,
    connectionStatus = "online"
  } = entityObject;

  // Fallback seguro: não use "MyIOLibrary" direto
  const MyIO =
    (typeof MyIOLibrary !== "undefined" && MyIOLibrary) ||
    (typeof window !== "undefined" && window.MyIOLibrary) || {
      formatEnergyByGroup: (v, g) => `${v} kWh${g ? " · " + g : ""}`,
      formatNumberReadable: (n) => Number(n ?? 0).toFixed(1)
    };

  const valFormatted  = MyIO.formatEnergyByGroup(val, group);
  const percFormatted = MyIO.formatNumberReadable(perc);

  // Injeta CSS uma única vez
  if (!document.getElementById("myio-card-styles")) {
    const style = document.createElement("style");
    style.id = "myio-card-styles";
    style.textContent = `
     .device-card-centered,.clickable{width:98%;border-radius:10px;padding:8px 12px;background:#fff;
       box-shadow:0 4px 10px rgba(0,0,0,.05);display:flex;align-items:center;justify-content:flex-start;
       cursor:pointer;transition:transform .2s;position:relative;min-height:140px;box-sizing:border-box;gap:25px;
       overflow:hidden;margin-bottom:15px}
     .device-card-centered:hover,.clickable:hover{transform:scale(1.05)}
     .device-title-row{width:100%;display:flex;justify-content:center;align-items:center;margin-bottom:4px;padding:0 4px;min-height:22px}
     .device-title{font-weight:700;font-size:.85rem;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90%;line-height:1.1}
     .device-image{max-height:44px;width:auto;margin:4px 0;display:block}
     .device-data-row{display:flex;justify-content:center;align-items:center;margin-top:auto;margin-bottom:6px;gap:6px;width:100%}
     .consumption-main{font-size:.9rem;font-weight:700;color:#28a745;display:flex;align-items:center;gap:6px;justify-content:center;white-space:nowrap}
     .device-title-percent{font-size:.75rem;color:rgba(0,0,0,.45);font-weight:500}
     .flash{animation:flash 1s infinite;color:#ff9800}
     @keyframes flash{0%{opacity:1}50%{opacity:.2}100%{opacity:1}}
     .card-actions{gap:13px;width:36px;padding:5px;height:100%;box-shadow:1px 0 2px rgba(0,0,0,.1);
       display:flex;flex-direction:column;justify-content:center;align-items:center}
     .card-action img{width:24px;height:24px;transition:transform .2s ease;cursor:pointer}
     .card-action img:hover{transform:scale(1.15)}
.device-card-centered.offline {
  border: 2px solid #ff4d4f;
  animation: border-blink 1s infinite;
}

@keyframes border-blink {
  0%, 100% { box-shadow: 0 0 8px rgba(255, 77, 79, 0.9); }
  50% { box-shadow: 0 0 16px rgba(255, 0, 0, 0.6); }
}

.device-card-centered.offline .flash-icon {
  color: #ff4d4f !important;
  font-size: 1.2rem;
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
  color: #28a745 !important; /* verde premium para online */
}
    `;
    document.head.appendChild(style);
  }

  // Template HTML do card
  const html = `
    <div class="device-card-centered clickable ${connectionStatus === "offline" ? "offline" : ""}"
      data-entity-id="${entityId}"
      data-entity-label="${labelOrName}"
      data-entity-type="${entityType}"
      data-entity-slaveid="${slaveId}"
      data-entity-ingestionid="${ingestionId}"
      data-entity-consumption="${val}"
      data-entity-centralid="${centralId}"
      data-entity-updated-identifiers='${JSON.stringify(updatedIdentifiers)}'>

      <div class="card-actions">
        <div class="card-action action-dashboard" data-action="dashboard" title="Dashboard">
          <img src="https://dashboard.myio-bas.com/api/images/public/TAVXE0sTbCZylwGsMF9lIWdllBB3iFtS"/>
        </div>
        <div class="card-action action-report" data-action="report" title="Relatório">
          <img src="https://dashboard.myio-bas.com/api/images/public/d9XuQwMYQCG2otvtNSlqUHGavGaSSpz4"/>
        </div>
        <div class="card-action action-settings" data-action="settings" title="Configurações">
          <img src="https://dashboard.myio-bas.com/api/images/public/5n9tze6vED2uwIs5VvJxGzNNZ9eV4yoz"/>
        </div>
        <input class="card-action action-checker" data-action="checker" title="Selecionar" type="checkbox">
      </div>

      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;width:85%">
        <div class="device-title-row">
          <span class="device-title" title="${labelOrName}">
            ${String(labelOrName ?? "").length > 15 ? String(labelOrName).slice(0, 15) + "…" : String(labelOrName ?? "")}
          </span>
        </div>
        <img class="device-image ${isOn ? "flash" : ""}" src="${img || ""}" />
        <div class="device-data-row">
          <div class="consumption-main">
  <span class="flash-icon ${connectionStatus === "offline" ? "flash" : (isOn ? "flash" : "")}">
    ${connectionStatus === "offline" ? "🚨" : "⚡"}
  </span>
            <span class="consumption-value" data-entity-consumption="${val}">${valFormatted}</span>
            <span class="device-title-percent">(${percFormatted}%)</span>
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
    // clique no card inteiro, menos nos botões
    $card.on("click", (e) => {
      if (!$(e.target).closest(".card-action").length) {
        handleSelect(entityObject);
      }
    });
    // checker
    $card.find(".action-checker").on("click", (e) => {
      e.stopPropagation();
      handleSelect(entityObject);
    });
  }

  return $card; // jQuery element
}
