const mqttSyncStatys = global.get('mqttSyncStatus');

//node.warn('VERIFICANDO mqttSyncStatys: ' + mqttSyncStatys);

// mantém o que já existe no payload e só acrescenta o atributo
if (msg.payload === null || typeof msg.payload !== 'object' || Array.isArray(msg.payload)) {
  msg.payload = {};
}

msg.payload.mqttSyncStatys = mqttSyncStatys;

/*
msg.payload = Object.entries(msg.payload || {}).reduce((acc, [name, value]) => {
  if (name !== 'mqttSyncStatys') {
    acc[name] = value;
  }
  return acc;
}, {});
*/

return msg;
