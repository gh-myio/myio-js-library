function getData(dataKeyName) {
    for (const device of self.ctx.data) {
        if (device.dataKey.name === dataKeyName) {
            return device.data[0][1]; // retorna o valor
        }
    }
    return null; // caso não encontre
}
let img; // deixar global pro widget

async function openDashboardPopup(entityId, entityType,
    insueDate) {
    $("#dashboard-popup").remove();

    const jwtToken = localStorage.getItem("jwt_token");

    async function getEntityInfoAndAttributes(deviceId,
        jwtToken) {
        try {
            // 1. Buscar info da entidade (label verdadeiro)
            const entityResponse = await fetch(
                `/api/device/${deviceId}`, {
                    headers: {
                        "Content-Type": "application/json",
                        "X-Authorization": `Bearer ${jwtToken}`,
                    },
                });
            if (!entityResponse.ok) throw new Error(
                "Erro ao buscar entidade");

            const entity = await entityResponse
                .json();
            const label = entity.label || entity
                .name || "Sem etiqueta";

            // 2. Buscar atributos SERVER_SCOPE
            const attrResponse = await fetch(
                `/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes?scope=SERVER_SCOPE`, {
                    headers: {
                        "Content-Type": "application/json",
                        "X-Authorization": `Bearer ${jwtToken}`,
                    },
                }
            );
            if (!attrResponse.ok) throw new Error(
                "Erro ao buscar atributos");

            const attributes = await attrResponse
                .json();
            const get = (key) => {
                const found = attributes.find((
                        attr) => attr
                    .key === key);
                return found ? found.value : "";
            };

            return {
                etiqueta: label,
                andar: get("floor"),
                numeroLoja: get("NumLoja"),
                identificadorMedidor: get(
                    "IDMedidor"),
                identificadorDispositivo: get(
                    "deviceId"),
                guid: get("guid"),
                consumoDiario: Number(get(
                        "maxDailyConsumption")) ||
                    0,
                consumoMadrugada: Number(get(
                        "maxNightConsumption")) ||
                    0,
                consumoComercial: Number(get(
                    "maxBusinessConsumption"
                    )) || 0,
            };
        } catch (error) {
            console.error(
                "Erro ao buscar dados da entidade/atributos:",
                error);
            return {};
        }
    }

    const valores = await getEntityInfoAndAttributes(
        entityId, jwtToken);

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
<input type="text" class="form-input" data-key="etiqueta" value="${valores.etiqueta || ""}" 
       style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

<label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Andar</label>
<input type="text" class="form-input" data-key="floor" value="${valores.andar || ""}" 
       style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

<label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Identificador do Medidor</label>
<input type="text" class="form-input" data-key="IDMedidor" value="${valores.identificadorMedidor || ""}" 
       style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

<label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">Identificador do Dispositivo</label>
<input type="text" class="form-input" data-key="deviceId" value="${valores.identificadorDispositivo || ""}" 
       style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

<label style="display:block; margin-bottom:4px; font-weight:500; color:#333;">GUID</label>
<input type="text" class="form-input" data-key="guid" value="${valores.guid || ""}" 
       style="width:100%; margin-bottom:16px; padding:8px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;" />

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

    // Botão fechar
    $(document).on("click", "#close-dashboard-popup",
    () => {
            $("#dashboard-popup").remove();
        });
    $(document).on("click", ".btn-desfazer", () => {
        $("#dashboard-popup").remove();
    });

    // Botão salvar
    $(document).on("click",
        "#dashboard-popup .btn-salvar",
        async function() {
                const $popup = $(this).closest(
                    "#dashboard-popup"
                    ); // pega o popup correto
                const inputs = $popup.find(
                    ".form-input");
                const getInputVal = (index) => {
                    const input = inputs.eq(
                        index);
                    return input.length ? input
                        .val().trim() :
                        ""; // retorna string vazia se não existir
                };

                const novoLabel = getInputVal(0);
                const payloadAtributos = {
                    floor: getInputVal(1),
                    IDMedidor: getInputVal(3),
                    deviceId: getInputVal(4),
                    guid: getInputVal(5),
                    maxDailyConsumption: getInputVal(
                        6),
                    maxNightConsumption: getInputVal(
                        7),
                    maxBusinessConsumption: getInputVal(
                        8),
                };
                console.log("novoLabel:",
                novoLabel);
                console.log("payload:",
                    payloadAtributos);
                try {
                    // Atualiza a entidade
                    const entityResponse =
                        await fetch(
                            `/api/device/${entityId}`, {
                                method: "GET",
                                headers: {
                                    "Content-Type": "application/json",
                                    "X-Authorization": `Bearer ${jwtToken}`,
                                },
                            });
                    if (!entityResponse.ok)
                    throw new Error(
                            "Erro ao buscar entidade para atualizar label"
                            );

                    const entity =
                        await entityResponse.json();
                    entity.label = novoLabel;

                    const updateLabelResponse =
                        await fetch(`/api/device`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-Authorization": `Bearer ${jwtToken}`,
                            },
                            body: JSON
                                .stringify(
                                    entity),
                        });
                    if (!updateLabelResponse.ok)
                        throw new Error(
                            "Erro ao atualizar etiqueta (label)"
                            );

                    // Atualiza atributos
                    const attrResponse =
                        await fetch(
                            `/api/plugins/telemetry/DEVICE/${entityId}/SERVER_SCOPE`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "X-Authorization": `Bearer ${jwtToken}`,
                                },
                                body: JSON
                                    .stringify(
                                        payloadAtributos
                                        ),
                            }
                        );
                    if (!attrResponse.ok)
                    throw new Error(
                            "Erro ao salvar atributos"
                            );

                    alert(
                        "Configurações salvas com sucesso!");
                    window.location.reload();
                    $("#dashboard-popup").remove();
                } catch (err) {
                    console.error(
                        "Erro ao salvar configurações:",
                        err);
                    alert(
                        "Erro ao salvar. Verifique o console.");
                }
            });

}

self.onInit = function() {
    const type = getData("deviceType");
    const container = document.getElementById(
        'image-container');
    const entityId = self.ctx.datasources[0].entityId;
    const entityType = self.ctx.datasources[0]
        .entityType;

    img = document.createElement('img');
    img.alt = "Imagem Fullscreen";
    img.classList.add('fullscreen-image');

    if (type === "ELEVADOR") {
        img.src =
            "/api/images/public/kdHhhlf0EUJz5j0Zz5mXNQs7jiuoZ7LZ";
    } else if (type === "3F_MEDIDOR") {
        img.src =
            "/api/images/public/8Ezn8qVBJ3jXD0iDfnEAZ0MZhAP1b5Ts";
    }
    else if(type === "TERMOSTATO"){
        img.src = "/api/images/public/Q4bE6zWz4pL3u5M3rjmMt2uSis6Xe52F"    
    }
    else {
        img.src =
            "/api/images/public/rHndQ3zHIaJHYBmHFhquFmSQtjg6at4o";
    }

    container.appendChild(img);

    $("#svg-right").on("click", function() {

        openDashboardPopup(entityId,
        entityType);
    });



};

// sempre que o dado atualizar
self.onDataUpdated = function() {
    const consumo = getData("consumption");

    if (consumo > 500) {

        img.classList.add("blinking");
    } else {

        img.classList.remove("blinking");
    }
};