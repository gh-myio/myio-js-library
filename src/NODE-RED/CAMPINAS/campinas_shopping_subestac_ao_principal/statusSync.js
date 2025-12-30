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

msg.payload = deviceStatusMap;

return msg;
