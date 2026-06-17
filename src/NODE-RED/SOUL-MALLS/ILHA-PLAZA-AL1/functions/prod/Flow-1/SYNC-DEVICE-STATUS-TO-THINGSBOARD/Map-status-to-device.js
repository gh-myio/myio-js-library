const slaveStatusMap = {};
const devices = flow.get('devices');

function getNameWithoutMultipliers(deviceName) {
  return deviceName
    .replace(/ x\d+\.?\d*[AV]?/gi, '')
    .replace(/ -\d+$/g, '')
    .trim();
}

for (const slave of msg.payload) {
  slaveStatusMap[slave.id] = slave.status;
}

const deviceStatusMap = {};

for (const device in devices) {
  if (devices[device].slaveId && devices[device].name !== '' && device !== '') {
    const nameWithoutMulitplier = getNameWithoutMultipliers(device);

    deviceStatusMap[nameWithoutMulitplier] = [
      {
        ts: new Date().getTime(),
        values: {
          connectionStatus: slaveStatusMap[devices[device].slaveId],
        },
      },
    ];
  }
}

// Device virtual "MQTT Sync" — não tem slave físico no polling, então é
// adicionado à força: connectionStatus SEMPRE online; o "status" reflete o
// estado do sync lido de global.mqttSyncStatus (enable|disable, undefined se nunca setado).
deviceStatusMap['MQTT Sync'] = [
  {
    ts: new Date().getTime(),
    values: {
      connectionStatus: 'online',
      status: global.get('mqttSyncStatus') || 'undefined',
      statusMQTT: global.get('mqttSyncStatus') || 'undefined',
    },
  },
];

msg.payload = deviceStatusMap;

msg.payload = Object.entries(msg.payload || {}).reduce((acc, [name, value]) => {
  if (name !== 'mqttSyncStatys') {
    acc[name] = value;
  }
  return acc;
}, {});

return msg;
