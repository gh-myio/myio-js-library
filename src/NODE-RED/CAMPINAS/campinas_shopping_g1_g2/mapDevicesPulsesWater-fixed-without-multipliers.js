// Fetch all flow sensor devices:
const devices = flow.get('devices') || {};

function getNameWithoutMultipliers(deviceName) {
  return deviceName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

function findDevice(slaveId, channel) {
  for (const devKey in devices) {
    const device = devices[devKey];
    if (device.slaveId === slaveId && device.channelId === channel) {
      return device;
    }
  }
  return null;
}

// 1) AGRUPA DO JEITO ORIGINAL (chave = device.name)
const originalMap = msg.payload.reduce((acc, reading) => {
  const device = findDevice(reading.slave_id, reading.channel);
  if (!device) return acc;

  if (!(device.name in acc)) {
    acc[device.name] = [];
  }

  acc[device.name].push({
    ts: new Date(reading.timestamp).getTime(),
    values: { pulses: reading.value },
  });

  return acc;
}, {});

// 2) CRIA UMA CÓPIA COM NOMES "LIMPOS" (pode fundir chaves que virem iguais)
const normalizedMap = Object.entries(originalMap).reduce((out, [rawName, arr]) => {
  const cleanName = getNameWithoutMultipliers(rawName);
  if (!out[cleanName]) out[cleanName] = [];
  // mantém as mesmas estruturas de itens
  out[cleanName].push(...arr);
  return out;
}, {});

//msg.payload = originalMap;
msg.payload = normalizedMap;

return msg;
