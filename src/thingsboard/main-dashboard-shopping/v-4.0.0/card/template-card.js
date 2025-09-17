      const $card = $(`
      <div class="device-card-centered clickable" 
          data-entity-id="${entityId}" 
          data-entity-label="${labelOrName}" 
          data-entity-type="${entityType}" 
          data-entity-slaveid="${slaveId}" 
          data-entity-ingestionid="${ingestionId}"
          data-entity-consumption="${val}"
          data-entity-centralid="${centralId}" 
          data-entity-updated-identifiers='${JSON.stringify(updatedIdentifiers)}'>
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
              <span class="consumption-value" data-entity-consumption="${val}">${MyIOLibrary.formatEnergy(val)}</span>
              <span class="device-title-percent">(${MyIOLibrary.formatNumberReadable(perc)}%)</span>
            </div>
          </div>
        </div>
      </div>
    `);