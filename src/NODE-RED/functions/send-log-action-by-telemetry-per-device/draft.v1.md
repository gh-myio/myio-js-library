ao final do fluxo do persister-schedule
uma função nova vai receber o payload e vai preparar o payload para envio via mqtt para o thingsboard 

o mais fiel posssível a essa função

---

const slaveStatusMap = {};
const devices = flow.get('devices');

function getNameWithoutMultipliers(deviceName) {
    return deviceName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

for (const slave of msg.payload) {
    slaveStatusMap[slave.id] = slave.status;
}

const deviceStatusMap = {};

for (const device in devices) {
    if (devices[device].slaveId && devices[device].name !== '' && device !== '') {
        const nameWithoutMulitplier = getNameWithoutMultipliers(device);
        
        deviceStatusMap[nameWithoutMulitplier] = [{
            ts: new Date().getTime(),
            values: {
                connectionStatus: slaveStatusMap[
                    devices[device].slaveId
                ]
            }
        }];
    }
}

msg.payload = deviceStatusMap;

return msg;

---

só que aqui envia o connectionStatus, aí vamos enviar um atributo automation_log 

Não precisa o devicename e nem data