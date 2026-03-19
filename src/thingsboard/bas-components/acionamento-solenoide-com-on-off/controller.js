// Controller for acionamento-solenoide-com-on-off
/* eslint-disable */
'esversion: 8'
let relatedDevicesNames = [];

async function onOffSolenoide(centralId, body) {
    const $http = self.ctx.$scope.$injector.get(
        self.ctx.servicesMap.get('http'),
    );
    
    let responseStatus = "";
    
    const response = await $http.post(`https://${centralId}.y.myio.com.br/api/OnOff`, body, { observe: 'response' }).toPromise().then(resp => {
        console.log("Verificando resp: ", resp)
        responseStatus = resp.statusText;
    })
    .catch(error => {
        responseStatus = error.status;
        console.error('Erro:', error.status, error.message);
    });

    return responseStatus;
}

async function turnOnOff(status) {
    const { centralId } = self.ctx.settings;
    const entityName = self.ctx.defaultSubscription.data[0].datasource.entityName;
    const statusTarget = (status === 'on') ? 'off' : 'on'; 
    
    try {
       const result = await onOffSolenoide(
            centralId, {
            device: entityName,
            status: statusTarget,
            relatedDevices: relatedDevicesNames,
        });
        
        if (result === 'OK') {
            setTimeout(() => {
                closeModal();
            }, 2000);
        } else {
            alert('Erro ao enviar status');
            closeModal();
        }
        
        //console.log("Verificando result: ", result)
    } catch (e) {
        //console.log(e);
        alert('Erro ao enviar status');
    }
}

function fetchData() {
    const subscriptionData = self.ctx.data[0].data;
    const data = !subscriptionData.length || !subscriptionData[0][1]  ? null : subscriptionData[0][1] 
    
    self.ctx.$scope.data = data;
    
    var entityName = self.ctx.defaultSubscription.data[0].datasource.entityLabel
    self.ctx.$scope.entityName = entityName
}

async function getDeviceName(deviceId) {
    const deviceService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('deviceService'));
    const deviceData = await deviceService.getDevice(deviceId).toPromise();
    
    return deviceData.name;
}

async function getRelatedDevicesNames() {
    const entityRelationService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('entityRelationService'));
    const attributeService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('attributeService'));
    const deviceService = self.ctx.$scope.$injector.get(self.ctx.servicesMap.get('deviceService')); // Adicionado

    relatedDevicesNames = [];
    
    for (const entity of self.ctx.datasources) {
        if (entity.entityType === "DEVICE") {
            const relations = await entityRelationService.findByFrom(entity.entity.id).toPromise();
            //console.log("relations", relations);

            for (const relation of relations) {
                console.log("relation", relation);
                const deviceId = relation.to.id;
                
                try {
                    const deviceName = await getDeviceName(deviceId);
                    relatedDevicesNames.push(deviceName); 
                } catch (error) {
                    console.error("Erro ao buscar o nome do dispositivo:", deviceId, error);
                }
                
            }
            
            //console.log("relationsDevices (nomes):", relatedDevicesNames);
        }
    }
}

self.onInit = function() {
    // Procurar por um objeto chamado "colorBackground" dentro de self.ctx.data
    let colorBackgroundObj = null;

    for (const item of self.ctx.data) {
        if (item && item.dataKey && item.dataKey.name === "colorBackground") {
            colorBackgroundObj = item;
            break;
        }
    }

    if (colorBackgroundObj) {
        self.ctx.$scope.colorbackground = colorBackgroundObj.data[0][1];
        
        //console.log("Valores:", colorBackgroundObj.data[0][1]);
        //console.log("Objeto colorBackground encontrado:", colorBackgroundObj);
    } else {
        console.warn("Objeto colorBackground não encontrado em self.ctx.data.");
    }
    
    getRelatedDevicesNames();
    
    fetchData();
    
    self.ctx.$scope.openModal = openModal;
    self.ctx.$scope.closeModal = closeModal;
    self.ctx.$scope.turnOnOff = turnOnOff;
    
    updateValveVisual();
    
    self.ctx.detectChanges();
}

self.onDataUpdated = function() {
    updateValveVisual();
    fetchData();
    self.ctx.detectChanges();
}

function updateValveVisual() {
    const button = document.querySelector("#button");
    const valveImg = document.getElementById('valve-img');
    
    if (!valveImg) return;

    const dataValue = self.ctx.data?.[0]?.data?.[0]?.[1];
    const connectionStatus = self.ctx.data?.[0]?.data?.[0]?.[2];
    
    let src = "";

    // online ou off
    switch (dataValue) {
        case 'on':
            src = "/api/images/public/Tnq47Vd1TxhhqhYoHvzS73WVh1X84fPa";
            button.innerHTML = '<img src="https://img.icons8.com/m_rounded/512/FFFFFF/open-lock.png"> Aberto';
            button.style.backgroundColor = "green";
            break;
        case 'off':
            src = "/api/images/public/dzVDTk3IxrOYkJ1sH92nXQFBaW53kVgs";
            button.innerHTML = '<img src="https://img.icons8.com/m_sharp/200/FFFFFF/lock.png"> Fechado';
            button.style.backgroundColor = "red";
            break;
        default:
            src = "/api/images/public/gkSGqEFP4rgApNArjEoctM0BoLZMiKz6"; // offline
            button.innerHTML = '<img src="https://img.icons8.com/?size=256&id=DPrCQPCnUuiE&format=png"> Indisponível';
            button.style.backgroundColor = "#191B1F";
    }
    

    

    
    valveImg.src = src;
}

function openModal(){
    let overlay = document.querySelector("#modal-overlay")
    overlay.style.display = 'flex';
}

function closeModal(){
    let overlay = document.querySelector("#modal-overlay")
    overlay.style.display = 'none';
}