node.warn('VERIFICANDO mqttSyncStatus: ' + msg.payload.mqttSyncStatus);
const novoStatus = msg.payload.mqttSyncStatus;

global.set('mqttSyncStatus', novoStatus);

node.warn('CONFIRMANDO global.get: ' + global.get('mqttSyncStatus'));
msg.payload = novoStatus;
msg.statusCode = 200;
return msg;
