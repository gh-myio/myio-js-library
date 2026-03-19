// Controller for agendamento-individual-on-off-v1.0.0
/* eslint-disable */
'esversion: 8';

// Injeta o CSS do modal apenas uma vez
(function injectModalStyles() {
  if (!document.getElementById('custom-modal-style')) {
    const style = document.createElement('style');
    style.id = 'custom-modal-style';
    style.innerHTML = `
    .custom-modal-overlay {
      position: fixed;
      inset: 0;
      width: 100vw; 
      height: 100vh;
      display: flex;
      align-items: flex-start;
      padding-top: 20vh;
      justify-content: center;
      z-index: 2147483647;
    }
    .custom-modal-backdrop {
        position: fixed;
        z-index: 2147483646;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        top: 0; left: 0;
    }
    .custom-modal-content {
        position: relative;
        background: #ffffff;
        border-radius: 16px;
        padding: 24px 32px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 2147483647;
        text-align: center;
        max-width: 360px;
        width: 100%;
        font-family: sans-serif;
        color: #222 !important;
    }
    .custom-modal-content h3 {
        margin: 0 0 12px;
        font-size: 1.5em;
        color: inherit;
    }
    .custom-modal-content p {
        font-size: 1.1em;
        margin-bottom: 24px;
        color: inherit;
    }
    .custom-modal-actions {
        display: flex;
        justify-content: center;
        gap: 16px;
    }
    .custom-modal-actions button {
        padding: 8px 16px;
        border: none;
        font-weight: bold;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1em;
        background: #1976d2;
        color: #fff;
        transition: background 0.2s ease;
    }
    .custom-modal-actions button:hover {
        background: #1565c0;
    }
    `;
    document.head.appendChild(style);
  }
})();

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

  //const container = widgetContext?.$container?.[0] || document.body;
  //container.appendChild(modal);
  
  document.body.appendChild(modal);

  const fechar = () => modal.remove();
  modal.querySelector('.btn-close').onclick = fechar;

  setTimeout(fechar, 6000);
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

function addSchedule() {
    self.ctx.$scope.schedules.push({
        type: 'individual',
        startHour: '00:00',
        endHour: '03:00',
        daysWeek: {
            mon: false,
            tue: false,
            wed: false,
            thu: false,
            fri: false,
            sat: false,
            sun: false,
        },
        holiday: false,
        retain: false,
    });
}

async function getAssetData(assetId) {
    self.ctx.deviceService.getDevice
    
    const assetService = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('assetService')
    );
    
    const assetData = await assetService.getAsset(assetId).toPromise();
    
    return assetData;
}

async function sendRPC(centralId, body) {
    const $http = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('http'),
    );
    
    centralId = self.ctx.data[1].data[0][1];
    
    const response = await $http.post(`https://${centralId}.y.myio.com.br/api/rpc`, body).toPromise();
    console.log("response: ", response);
    
    return response;
}


async function goToMultipleSchedulesDetail(event, asset) {
    event.preventDefault();

    const { groupDashboardId } = self.ctx.settings;

    const entityId = asset.entity?.id;

    // Você pode passar apenas os parâmetros necessários como query string
    location.href = `/dashboards/${groupDashboardId}?entityId=${entityId}&grupo=Grupo`;
}

async function submit() {
    showConfirmModal(
        'Confirmar agendamento',
        `Tem certeza que deseja confirmar esse novo intervalo de agendamento?`,
        async () => {
            const { centralId } = self.ctx.settings;
        
            const attributeService = self.ctx.$scope.$injector.get(
                self.ctx.servicesMap.get('attributeService'));
        
            const schedules = [...self.ctx.$scope.schedules, ...self.ctx.$scope.groupSchedules];
            const individualSchedules = self.ctx.$scope.schedules;
            
            // We should only save the individual schedules, not the group ones
            const attributes = [{
                'key': 'schedules',
                'value': individualSchedules,
            }];
            
            let entityId = {
                id: self.ctx.defaultSubscription.data[0]
                    .datasource.entityId,
                entityType: 'DEVICE',
            };
            
            const entityName = self.ctx.defaultSubscription.data[0].datasource.entityName
        
            try {
                await sendRPC(centralId, {
                    device: entityName,
                    method: 'updateSchedules',
                    params: schedules,
                });
        
                await attributeService
                    .saveEntityAttributes(entityId, 'SHARED_SCOPE',
                        attributes)
                    .toPromise();
                showModal('success', `Agendamento efetuado com sucesso!`);
            } catch (e) {
                console.log('E:', e);
                showModal('error', 'Falha ao salvar novo agendamento.');
            }            
        }
    );
}

function remove(schedule) {
    const index = self.ctx.$scope.schedules.indexOf(schedule);
    
    self.ctx.$scope.schedules.splice(index, 1);
    console.log('index:', index);
}

self.onInit = async function() {
    const centralId = self.ctx.data[1].data[0][1];
    console.log('centralId: ', centralId); 
    
    self.ctx.$scope.loading = true;
    
    const attributeService = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('attributeService')
    );
    
    const entityName = self.ctx.defaultSubscription.data[0].datasource.entityName
    const entityId = self.ctx.defaultSubscription.data[0].datasource.entityId;

    let schedules = [];

    self.ctx.$scope.addSchedule = addSchedule;
    self.ctx.$scope.submit = submit;
    self.ctx.$scope.remove = remove;
    self.ctx.$scope.entityId = entityId;

    // Find all assets that contain this current device
    const entityRelationService = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('entityRelationService'));

    const relations = await entityRelationService.findByTo({
        entityType: 'DEVICE',
        id: entityId,
    }).toPromise();
    
    const assetRelations = relations.reduce((acc, relation) => {
        if (relation.from.entityType === 'ASSET') {
            return [...acc, relation.from];
        }
        
        return acc;
    }, []);

    // Download the attributes from these assets, to find group schedules
    const assetSchedules = await Promise.all(assetRelations.map(async (relation) => {
        const attributes = await attributeService.getEntityAttributes(relation, 'SERVER_SCOPE')
        .toPromise();
        
        console.log('Downloaded attributes', attributes);
        
        const scheduleResult = attributes.find((attribute) => attribute.key === 'schedules');
        console.log('scheduleResult: ', scheduleResult);
        
        if(scheduleResult === undefined){
            return []; 
        }
        
        return scheduleResult.value.map((schedule) => ({
            ...schedule,
            entity: relation,
        }));
    }));
    
    const groupSchedules = assetSchedules.reduce((acc, schedule) => {
        return [...acc, ...schedule];
    }, []);
    
    const attributes = await attributeService.getEntityAttributes({
        id: self.ctx.$scope.entityId,
        entityType: 'DEVICE',
    }, 'SHARED_SCOPE')
    .toPromise();
    
    schedules = attributes.reduce((acc, attribute) => {
        if (attribute.key === 'schedules') {
            return attribute.value;
        }

        return acc;
    }, []);
    
    self.ctx.$scope.schedules = schedules;
    self.ctx.$scope.groupSchedules = groupSchedules;
    self.ctx.$scope.entityName = entityName;
    self.ctx.$scope.goToMultipleSchedulesDetail = goToMultipleSchedulesDetail;
    self.ctx.$scope.loading = false;
    self.ctx.detectChanges();
}

self.onDataUpdated = function() {}

self.onDestroy = function() {}