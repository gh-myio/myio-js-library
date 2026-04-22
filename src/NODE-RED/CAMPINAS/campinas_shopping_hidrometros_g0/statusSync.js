const slaveStatusMap = {};
const devices = flow.get('devices');

// Limpa o nome: remove multiplicador e leitura inicial
// Ex: "Hidr. Colonial x1 0m3" -> "Hidr. Colonial"
function getCleanName(deviceName) {
  return deviceName
    .replace(/ x\d+\.?\d*[AV]?/gi, '')  // Remove multiplicador (x1, x100, etc.)
    .replace(/\s*\d+m[³3]?\s*$/i, '')   // Remove leitura inicial (0m3, 2810m3, etc.)
    .trim();
}

for (const slave of msg.payload) {
  slaveStatusMap[slave.id] = slave.status;
}

const deviceStatusMap = {};

for (const device in devices) {
  if (devices[device].slaveId && devices[device].name !== '' && device !== '') {
    const cleanName = getCleanName(device);

    deviceStatusMap[cleanName] = [
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
