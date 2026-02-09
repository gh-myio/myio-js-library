// Controller for agendamento-ir
/* eslint-disable */
'esversion: 8';

// Constants
const DEFAULT_SCHEDULE = {
    type: 'individual',
    time: '00:00',
    action: false,
    temperature: null,
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
};

// Service Functions
async function getAssetData(assetId) {
    const assetService = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('assetService')
    );
    return await assetService.getAsset(assetId).toPromise();
}

async function sendRPC(centralId, body) {
    const $http = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('http'),
    );
    const response = await $http.post(`https://${centralId}.y.myio.com.br/api/rpc`, body).toPromise();
    console.log('RPC Response:', response);
    return response;
}

// Schedule Management Functions
function addSchedule() {
    self.ctx.$scope.schedules.push({
        ...DEFAULT_SCHEDULE,
        daysWeek: { ...DEFAULT_SCHEDULE.daysWeek }
    });
}

function remove(schedule) {
    const index = self.ctx.$scope.schedules.indexOf(schedule);
    self.ctx.$scope.schedules.splice(index, 1);
}

async function submit() {
    const { centralId } = self.ctx.settings;
    const attributeService = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('attributeService')
    );

    // Map schedules to include only command_id and slave_id for updateSchedulesIR
    const schedules = [...self.ctx.$scope.schedules, ...self.ctx.$scope.groupSchedules].map(schedule => {
        const command = (self.ctx.$scope.availableTemperatures || []).find(cmd => cmd.command_id === schedule.temperature);
        return {
            ...schedule,
            command_id: command ? command.command_id : null,
            slave_id: command ? command.slave_id: null,
        };
    });
    const individualSchedules = self.ctx.$scope.schedules.map(schedule => {
        const command = (self.ctx.$scope.availableTemperatures || []).find(cmd => cmd.command_id === schedule.temperature);
        return {
            ...schedule,
            command_id: command ? command.command_id : null,
            slave_id: command ? command.salve_id: null,
        };
    });
    
    const attributes = [{
        'key': 'schedulesIR',
        'value': individualSchedules,
    }];

    const entityId = {
        id: self.ctx.defaultSubscription.data[0].datasource.entityId,
        entityType: 'DEVICE',
    };
    
    const entityName = self.ctx.defaultSubscription.data[0].datasource.entityName;

    try {
        await sendRPC(centralId, {
            device: entityName,
            method: 'updateSchedulesIR',
            params: schedules,
        });

        await attributeService
            .saveEntityAttributes(entityId, 'SHARED_SCOPE', attributes)
            .toPromise();
            
        alert('Agendamento salvo com sucesso.');
    } catch (error) {
        console.error('Error saving schedule:', error);
        alert('Dispositivo Inativo');
    }
}

// Navigation Functions
async function goToMultipleSchedulesDetail(event, asset) {
    event.preventDefault();
    
    const { groupDashboardId, groupDashboardStateId } = self.ctx.settings;
    const assetData = await getAssetData(asset.entity.id);
    
    const state = [
        {
            "id": `${groupDashboardStateId}Grupo`,
            "params": {}
        },
        {
            "id": "asset_selected",
            "params": {
                "entityId": asset.entity
            }
        }
    ];
    
    const base64State = btoa(JSON.stringify(state));
    location.href = `/dashboards/${groupDashboardId}?state=${base64State}`;
}

// Initialization
self.onInit = async function() {
    self.ctx.$scope.loading = true;
    
    // Initialize services
    const attributeService = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('attributeService')
    );
    const entityRelationService = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('entityRelationService')
    );

    // Get entity information
    const entityName = self.ctx.defaultSubscription.data[0].datasource.entityName;
    const entityId = self.ctx.defaultSubscription.data[0].datasource.entityId;

    // Initialize scope functions
    self.ctx.$scope.addSchedule = addSchedule;
    self.ctx.$scope.submit = submit;
    self.ctx.$scope.remove = remove;
    self.ctx.$scope.entityId = entityId;
    self.ctx.$scope.goToMultipleSchedulesDetail = goToMultipleSchedulesDetail;

    try {
        // Get device commands from attributes
        const attributes = await attributeService.getEntityAttributes({
            id: entityId,
            entityType: 'DEVICE',
        }, 'SERVER_SCOPE').toPromise();
        
        const commandsAttribute = attributes.find(attr => attr.key === 'commands');
        if (commandsAttribute) {
            self.ctx.$scope.availableTemperatures = commandsAttribute.value.map(cmd => ({
                temperature: cmd.name.replace('C', '').trim(),
                command_id: cmd.commandId,
                slave_id: cmd.slaveId,
            }));
        }

        // Find asset relations
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

        // Get group schedules
        const assetSchedules = await Promise.all(assetRelations.map(async (relation) => {
            const attributes = await attributeService.getEntityAttributes(relation, 'SERVER_SCOPE')
                .toPromise();
            
            const scheduleResult = attributes.find((attribute) => attribute.key === 'schedulesIR');
            if (!scheduleResult) return [];
            
            return scheduleResult.value.map((schedule) => ({
                ...schedule,
                entity: relation,
            }));
        }));
        
        const groupSchedules = assetSchedules.flat();

        // Get individual schedules
        const deviceAttributes = await attributeService.getEntityAttributes({
            id: entityId,
            entityType: 'DEVICE',
        }, 'SHARED_SCOPE').toPromise();
        
        const schedules = deviceAttributes.reduce((acc, attribute) => {
            if (attribute.key === 'schedulesIR') {
                return attribute.value;
            }
            return acc;
        }, []);

        // Update scope
        self.ctx.$scope.schedules = schedules;
        self.ctx.$scope.groupSchedules = groupSchedules;
        self.ctx.$scope.entityName = entityName;
    } catch (error) {
        console.error('Error initializing widget:', error);
    } finally {
        self.ctx.$scope.loading = false;
        self.ctx.detectChanges();
    }
}

self.onDataUpdated = function() {}
self.onDestroy = function() {}