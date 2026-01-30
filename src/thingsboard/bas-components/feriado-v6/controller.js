// Controller for feriado-v6
/* eslint-disable */
function addHolidays() {
    self.ctx.$scope.holidays.push({
        holidayDates: [],
    });
}

async function sendRPC(centralId, body) {
    const $http = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('http'),
    );
    const response = await $http.post(`https://${centralId}.y.myio.com.br/api/rpc`, body).toPromise();
    
    return response;
}

async function submit() {
    const { centralId } = self.ctx.settings;
    const entityName = self.ctx.defaultSubscription
        .data[0].datasource.entityName;

    const attributeService = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('attributeService'));

    console.log('holidays:', self.ctx.$scope.holidays);
    const holidays = self.ctx.$scope.holidays;
    const attributes = [{
        'key': 'holidays',
        'value': holidays
    }];
    let entityId = {
        id: self.ctx.defaultSubscription.data[0]
            .datasource.entityId,
        entityType: 'DEVICE',
    };

    try {
         await sendRPC(centralId, {
           device: entityName,
            method: 'updateHolidays',
            params: holidays,
        });
        
        await attributeService
            .saveEntityAttributes(entityId, 'SHARED_SCOPE',
                attributes)
            .toPromise();
        alert('Feriado salvo com sucesso.');
    } catch (e) {
       console.log('E:', e);
       alert('Dispositivo Inativo')
    }
}

function remove(holidays) {
    const index = self.ctx.$scope.holidays.indexOf(holidays);
    
    self.ctx.$scope.holidays.splice(index, 1);
    
}

self.onInit = async function() {
    const entityName = self.ctx.defaultSubscription
        .data[0].datasource.entityName
    const entityId = self.ctx.defaultSubscription.data[0]
            .datasource.entityId;

    let holidays = [];

    self.ctx.$scope.addHolidays = addHolidays;
    self.ctx.$scope.submit = submit;
    self.ctx.$scope.remove = remove;

    self.ctx.$scope.entityId = entityId;

    const attributeService = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('attributeService'));
    
    let attributes = [];
    try {
        attributes = await attributeService.getEntityAttributes({
            id: self.ctx.$scope.entityId,
            entityType: 'DEVICE',
        }, 'SHARED_SCOPE')
        .toPromise();
    } catch(e) {
        console.log('E:', e);
    }
    
    holidays = attributes.reduce((acc, attribute) => {
        if (attribute.key === 'holidays') {
            return attribute.value;
        }

        return acc;
    }, []);
    
    self.ctx.$scope.holidays = holidays;
    
    console.log('Attributes:', attributes, self.ctx.$scope.holidays);

    self.ctx.$scope.entityName = entityName;
    
    self.ctx.detectChanges();
}

self.onDataUpdated = function() {

}

self.onDestroy = function() {}