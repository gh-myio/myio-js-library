'esversion: 8';
let relatedDevicesNames = [];

function stripSuffix(name) {
  return name.replace(/\s*\([^)]*\)\s*$/, '');
}

async function onOffSolenoide(centralId, body) {
  const $http = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('http'));
  const response = await $http
    .post(`https://${centralId}.y.myio.com.br/api/onOffSolenoide`, body)
    .toPromise();

  return response;
}

async function turnOnOff(status) {
  const { centralId } = self.ctx.settings;

  const entityName = self.ctx.defaultSubscription.data[0].datasource.entityName;

  try {
    await onOffSolenoide(centralId, {
      device: stripSuffix(entityName),
      status: status,
      relatedDevices: relatedDevicesNames,
    });
  } catch (e) {
    console.log(e);
    alert('Erro ao enviar status');
  }
}

function fetchData() {
  const subscriptionData = self.ctx.data[0].data;
  const data = !subscriptionData.length || !subscriptionData[0][1] ? null : subscriptionData[0][1];
  self.ctx.$scope.data = data;

  var entityName = self.ctx.defaultSubscription.data[0].datasource.entityLabel;
  self.ctx.$scope.entityName = entityName;
}

async function getDeviceName(deviceId) {
  const deviceService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('deviceService'));
  const deviceData = await deviceService.getDevice(deviceId).toPromise();
  return deviceData.name;
}

async function getRelatedDevicesNames() {
  const entityRelationService = self.ctx.$scope.$injector.get(
    self.ctx.servicesMap.get('entityRelationService')
  );
  const attributeService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('attributeService'));
  const deviceService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('deviceService')); // Adicionado

  relatedDevicesNames = [];

  for (const entity of self.ctx.datasources) {
    if (entity.entityType === 'DEVICE') {
      const relations = await entityRelationService.findByFrom(entity.entity.id).toPromise();
      console.log('relations', relations);

      for (const relation of relations) {
        console.log('relation', relation);
        const deviceId = relation.to.id;
        try {
          const deviceName = await getDeviceName(deviceId);
          relatedDevicesNames.push(stripSuffix(deviceName));
        } catch (error) {
          console.error('Erro ao buscar o nome do dispositivo:', deviceId, error);
        }
      }
      console.log('relationsDevices (nomes):', relatedDevicesNames);
    }
  }
}

self.onInit = function () {
  getRelatedDevicesNames();
  fetchData();
  self.ctx.$scope.turnOnOff = turnOnOff;

  self.ctx.detectChanges();
};

self.onDataUpdated = function () {
  fetchData();
  self.ctx.detectChanges();
};
