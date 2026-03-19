// Controller for remote-version-fancoil-widget-v1.0.0
/* eslint-disable */
const MAX_TEMP = 28;
const MIN_TEMP = 16;
const showDebug = false;
 
function getDeviceIdByDeviceType(deviceTypeWanted) {
    if (!showDebug) 
        console.log("getDeviceIdByDeviceType >>> ", {deviceTypeWanted});
    
    for (const item of self.ctx.data) {
        const deviceTypeEntry = self.ctx.data.find(d =>
            d.datasource.entityId === item.datasource.entityId &&
            d.dataKey.name === 'deviceType'
        );

        const deviceType = deviceTypeEntry?.data?.[0]?.[1];

        if (deviceType === deviceTypeWanted) {
            if (!showDebug) {
                console.log("getDeviceIdByDeviceType | deviceType >>> ", deviceType);
            }
            
            const deviceEntityId = item.datasource.entityId;
            
            if (!showDebug) {
                console.log("getDeviceIdByDeviceType | deviceEntityId >>> ", deviceEntityId);
            }            

            return deviceEntityId;
        }
    }

    return null;
}    

function getDataByDeviceTypeAndKey(deviceTypeWanted, dataKeyWanted) {
    if (showDebug) 
        console.log("getDataByDeviceTypeAndKey >>> ", {deviceTypeWanted, dataKeyWanted});
    
    for (const item of self.ctx.data) {
        const deviceTypeEntry = self.ctx.data.find(d =>
            d.datasource.entityId === item.datasource.entityId &&
            d.dataKey.name === 'deviceType'
        );

        const deviceType = deviceTypeEntry?.data?.[0]?.[1];

        if (deviceType === deviceTypeWanted && item.dataKey.name === dataKeyWanted) {
            if (showDebug) {
                console.log("getDataByDeviceTypeAndKey | deviceTypeEntry >>> ", {deviceTypeWanted, dataKeyWanted});
                console.log("getDataByDeviceTypeAndKey | deviceType >>> ", deviceType);
            }
            
            const valueToReturn = item.data?.[0]?.[1] ?? null;
            
            if (showDebug)
                console.log("getDataByDeviceTypeAndKey | valueToReturn >>> ", valueToReturn);
            
            return valueToReturn;
        }
    }

    return null;
}

function fetchStatus() {
    if (showDebug) console.log('[fetchStatus] Iniciando verificação do VENTILADOR');

    // Verifica status de conexão
    let result = getDataByDeviceTypeAndKey('VENTILADOR', 'connectionStatus');
    
    if (showDebug) console.log('[fetchStatus] connectionStatus do VENTILADOR:', result);

    if (result !== 'online') {
        if (showDebug) console.log('[fetchStatus] VENTILADOR está offline');
        result = 'offline';
    } else {
        result = getDataByDeviceTypeAndKey('VENTILADOR', 'status');
        if (showDebug) console.log('[fetchStatus] status do VENTILADOR:', result);
    }

    self.ctx.$scope.status = result;
    
    if (showDebug) console.log('[fetchStatus] Status final atribuído ao scope:', result);
    
    self.ctx.detectChanges();
}

function fetchAutoManual() {
    const data = getDataByDeviceTypeAndKey('SELETOR_AUTO_MANUAL', 'status') ?? null;
    self.ctx.$scope.modo = (data === 'not_detected') ? 'man' : 'auto';
}

function fetchConsumo() {
    const data = getDataByDeviceTypeAndKey('3F_MEDIDOR', 'consumption') ?? 0;
    const consumo = parseFloat(data);
    const images = self.ctx.$scope.images;
    
    self.ctx.$scope.consumo = consumo;
    self.ctx.$scope.imgAtual = getImageByConsumo(consumo, images);
}

function fetchAmbientTemperature() {
    // exibição de temperatura
    const data = getDataByDeviceTypeAndKey('TERMOSTATO', 'temperature') ?? " - ";
    self.ctx.$scope.tempAtual = data;
}

function fetchDisableOrNotButtons() {
    const seletorAutoManualStatus = getDataByDeviceTypeAndKey('SELETOR_AUTO_MANUAL', 'status') ?? null;
    const compressorStatus = getDataByDeviceTypeAndKey('COMPRESSOR', 'status');
    
    let temperatureSetpoint = "23";
    
    if (seletorAutoManualStatus === 'man' || compressorStatus === null) {
        self.ctx.$scope.temperature = null;
        return;
    } else {
        temperatureSetpoint = getDataByDeviceTypeAndKey('COMPRESSOR', 'temperature') ?? "23";
    }
    
    let temperatureSetpointNumber = parseInt(temperatureSetpoint);
    
    if (isNaN(temperatureSetpointNumber)) temperatureSetpointNumber = 23;
    
    self.ctx.$scope.temperature = temperatureSetpointNumber;
}

function getImageByConsumo(consumo, images) {
    if (consumo === 0) return images.off;
    if (consumo > 0 && consumo <= 0.150) return images.fan;
    if (consumo > 0.150) return images.on;
    
    return images.offline;
}

async function sendOnOffRPC(centralId, body) {
    const $http = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('http'),
    );
    
    const response = await $http.post(`https://${centralId}.y.myio.com.br/api/OnOff`, body).toPromise();
    return response;
}

async function turnOnOff() {
    const oldStatus = self.ctx.$scope.status;
    const newStatus = oldStatus === 'on' ? 'off' : 'on';
    const textoAcao = newStatus === 'on' ? 'ligar' : 'desligar';

    showConfirmModal(
        'Confirmar ação',
        `Tem certeza que deseja <b>${textoAcao.toUpperCase()}</b> o dispositivo?`,
        async () => {
            const { centralId } = self.ctx.settings;
            //const entityName = self.ctx.defaultSubscription.data[1].datasource.entityName;
            
            const entityName = getDataByDeviceTypeAndKey('VENTILADOR', 'name').replace(/\s*\([^)]*\)/g, '').trim();
            
            //console.log(" CHECK >>> ", entityName.replace(/\s*\([^)]*\)/g, '').trim());

            try {
                await sendOnOffRPC(centralId, {
                    device: entityName,
                    status: newStatus, 
                });

                fetchStatus(); // Atualiza novo status
                self.ctx.detectChanges();

                showModal('success', `Sistema ${newStatus === 'on' ? 'ligado' : 'desligado'} com sucesso!`);
            } catch (e) {
                console.error('[Erro ao enviar status ON/OFF]', e);
                showModal('error', 'Falha ao enviar comando para o ON/OFF equipamento.');
            }
        }
    );
}

async function saveTemperature(temperature) {
    const { centralId } = self.ctx.settings;

    const attributeService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('attributeService'));
    const entityId = {
        id: self.ctx.defaultSubscription.data[0].datasource.entityId,
        entityType: 'DEVICE'
    };

    const entityName = self.ctx.defaultSubscription.data[0].datasource.entityName;
    //const temperatureDevice = self.ctx.defaultSubscription.data[2].datasource.entityName;
    
    //console.log(" check >>>> ", getDataByDeviceTypeAndKey('TERMOSTATO', 'name'));
    
    const temperatureDevice = getDataByDeviceTypeAndKey('TERMOSTATO', 'name').replace(/\s*\([^)]*\)/g, '').trim();
    const valveDevice = self.ctx.defaultSubscription.data[0].datasource.entityName;

    const attributes = [{
        key: 'temperature',
        value: temperature,
        temperatureDevice,
        valveDevice
    }];

    try {
        const $http = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));

        await $http.post(`https://${centralId}.y.myio.com.br/api/thermostat`, {
            device: entityName,
            temperature,
            temperatureDevice,
            valveDevice
        }).toPromise();

        await attributeService.saveEntityAttributes(entityId, 'SHARED_SCOPE', attributes).toPromise();
        
        showModal('success', 'Ajuste em temperatura feito com sucesso!');
    } catch (e) {
        console.error('[ERRO AO SALVAR TEMP]', e);
        showErroModal('Erro ao definir temperatura');
        //alert('Erro ao definir temperatura');
    }
}

function showConfirmModal(title, message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'custom-modal-overlay';

    modal.innerHTML = `
        <div class="custom-modal-backdrop"></div>
        <div class="custom-modal-content">
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="custom-modal-actions">
                <button class="btn-cancel">Cancelar</button>
                <button class="btn-confirm">Confirmar</button>
            </div>
        </div>
    `;

    const container = self.ctx.$container?.[0] || document.body;
    //const container = document.body;
    container.appendChild(modal);

    modal.querySelector('.btn-cancel').onclick = () => modal.remove();
    modal.querySelector('.btn-confirm').onclick = () => {
        modal.remove();
        onConfirm();
    };
}

function showModal(type, mensagem) {
    const icons = {
        success: '✅ Sucesso',
        warning: '⚠️ Atenção',
        error: '❌ Erro'
    };

    const title = icons[type] || 'ℹ️ Info';

    const modal = document.createElement('div');
    modal.className = 'custom-modal-overlay';

    modal.innerHTML = `
        <div class="custom-modal-backdrop"></div>
        <div class="custom-modal-content ${type}">
            <h3>${title}</h3>
            <p>${mensagem}</p>
            <div class="custom-modal-actions">
                <button class="btn-close">Fechar</button>
            </div>
        </div>
    `;

    const container = self?.ctx?.$container?.[0] || document.body;
    container.appendChild(modal);

    const fechar = () => modal.remove();
    modal.querySelector('.btn-close').onclick = fechar;

    // Fecha automaticamente em 6 segundos
    setTimeout(fechar, 2000);
}

self.onInit = async function () {
    //console.log("ON INIT Remote >>> self.ctx: ", self.ctx);
    
    self.ctx.$scope.isOkToSetTheSetpoint = false;
    
    // Define imagens para uso posterior
    self.ctx.$scope.images = {
        off: '/api/images/public/G5ldxE6QEljmGxLyUGkjHQt3ddUtbPax',
        fan: '/api/images/public/4A8Sk4WP8QuPqyxwZXCF9I08HxQsbKBy',
        on: '/api/images/public/Huwu3DqdnwB1N9mqlcSRsWzKUD3dPwtJ',
        offline: '/api/images/public/j8gvUT86qM2e3k32WlzXyhA88Fnctloy'
    };
    
    // Busca valores iniciais
    fetchStatus();
    fetchAmbientTemperature();
    fetchConsumo();
    fetchAutoManual();
    fetchDisableOrNotButtons();

    // Nome da válvula (device principal)
    //const name = self.ctx.defaultSubscription.data[0].datasource.entityName;
    const name = getDataByDeviceTypeAndKey('Compressor', 'name') ?? null;
    self.ctx.$scope.valvulaName = name;

    // Buscar atributo compartilhado do setpoint
    const attributeService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('attributeService'));
    const entityId = {
        id: self.ctx.defaultSubscription.data[0].datasource.entityId,
        entityType: 'DEVICE'
    };
    const attributes = await attributeService.getEntityAttributes(entityId, 'SHARED_SCOPE').toPromise();
    const temperatureAttr = attributes.find(attr => attr.key === 'temperature');
    
    self.ctx.$scope.temperature = temperatureAttr ? 
        ( isNaN(parseInt(temperatureAttr.value)) ? 23 : parseInt(temperatureAttr.value) ) : 23;
    
    self.ctx.detectChanges(); // Forçar o Angular a reconhecer a nova função

    const debouncedSave = _.debounce(saveTemperature, 500);

    // Aumentar temperatura
    self.ctx.$scope.increaseTemperature = () => {
        showModal('success', 'Enviando novo setpoint de aumento de temperatura! Aguarde!');
        
        let temp = parseInt(self.ctx.$scope.temperature);
        if (isNaN(temp)) temp = 23;
    
        if (temp >= MAX_TEMP) return;
        
        temp += 1;
        self.ctx.$scope.temperature = temp;
    
        debouncedSave(temp);
    };
    
    // Reduzir temperatura
    self.ctx.$scope.decreaseTemperature = () => {
        showModal('success', 'Enviando novo setpoint de diminuição de temperatura! Aguarde!');
        
        let temp = parseInt(self.ctx.$scope.temperature);
        
        if (isNaN(temp)) temp = 20;
    
        if (temp <= MIN_TEMP) return;
    
        temp -= 1;
        
        self.ctx.$scope.temperature = temp;
    
        debouncedSave(temp);
    };

    setTimeout(() => {
        let asset = null;

        //const alias = self.ctx.aliasesInfo?.current_entity?.currentEntity;
        const alias = self.ctx.datasources[0].entityFilter.rootEntity;
        
        //console.log('[DEBUG] Alias current_entity:', alias);

        if (alias?.id && alias?.entityType === 'ASSET') {
            asset = {
                id: { id: alias.id, entityType: alias.entityType },
                name: alias.name || 'Ativo'
            };
        } else {
            // fallback via datasource
            const dsEntity = self.ctx.defaultSubscription?.data?.[0]?.datasource?.entity;
            if (dsEntity?.id?.id && dsEntity?.id?.entityType === 'ASSET') {
                asset = {
                    id: dsEntity.id,
                    name: dsEntity.name || 'Ativo'
                };
            }
        }
        
        self.ctx.$scope.setupAction = () => {
            if (!asset?.id?.id || !asset?.id?.entityType) {
                console.warn('[WARN] Asset inválido para navegação:', asset);
                return;
            }
        
            const hasCompressor = getDataByDeviceTypeAndKey('COMPRESSOR', 'status') !== null;
        
            const dashboardId = hasCompressor 
                ? 'b1b58280-4aa4-11f0-9291-41f94c09a8a6'
                : 'c26d3db0-52b6-11f0-9291-41f94c09a8a6';
        
            const entityTargetId = hasCompressor
                ? {
                    id: asset.id.id,
                    entityType: asset.id.entityType
                }
                : {
                    id: getDeviceIdByDeviceType('VENTILADOR'),
                    entityType: 'DEVICE'
                };
        
            const entityTargetName = hasCompressor
                ? asset.name
                : getDataByDeviceTypeAndKey('VENTILADOR', 'name')
                    ?.replace(/\s*\([^)]*\)/g, '')
                    ?.trim();
        
            const state = [{
                id: 'default',
                params: {
                    entityDashboard: {
                        entityId: entityTargetId,
                        entityName: entityTargetName
                    },
                    targetEntityParamName: 'entityDashboard'
                }
            }];
        
            const stateBase64 = encodeURIComponent(btoa(JSON.stringify(state)));
            const url = `/dashboards/${dashboardId}?state=${stateBase64}`;
        
            console.log('[DEBUG] Navegando para:', {
                hasCompressor,
                dashboardId,
                entityTargetId,
                entityTargetName,
                url
            });
        
            self.ctx.router.navigateByUrl(url);
        };

        
        if (self.ctx.datasources.length < 5) {
            self.ctx.$scope.isOkToSetTheSetpoint = false;
            showModal('warning', 'Esse ambiente não é possível configurar o set point de temperatura!');
            //console.log('[DEBUG] Setado isOkToSetTheSetpoint = false');
        } else {
            self.ctx.$scope.isOkToSetTheSetpoint = true;
            //console.log('[DEBUG] Setado isOkToSetTheSetpoint = true');
        }
        
        self.ctx.$scope.showSetpoint = self.ctx.$scope.isOkToSetTheSetpoint;
            //self.ctx.$scope.modo !== 'man' && self.ctx.$scope.isOkToSetTheSetpoint;
        
        Object.assign(self.ctx.$scope, {
          turnOnOff
        });
        
        self.ctx.detectChanges();
    }, 300); // tempo suficiente para aliases carregarem
    
    self.ctx.detectChanges();
};

self.onDataUpdated = function () {
    fetchStatus();
    fetchAmbientTemperature();
    fetchConsumo();
    fetchAutoManual();
    fetchDisableOrNotButtons();

    //console.log("self.ctx.data >>> ", self.ctx.data);
    
    self.ctx.detectChanges();
};

self.onDestroy = function () {
    // Nenhum cleanup necessário
};
