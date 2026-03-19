// Fetch all flow sensor devices:
const devices = flow.get('devices') || {};

// Extrai o multiplicador do nome do device (ex: "Hidr. Name x100 2810m3" -> 100)
function getMultiplier(deviceName) {
  const match = deviceName.match(/ x(\d+\.?\d*)/i);
  return match ? parseFloat(match[1]) : 1;
}

// Limpa o nome: remove multiplicador e leitura inicial
// Ex: "Hidr. Teta x100 2810m3" -> "Hidr. Teta"
function getCleanName(deviceName) {
  return deviceName
    .replace(/ x\d+\.?\d*[AV]?/gi, '')  // Remove multiplicador (x100, x1.5A, etc.)
    .replace(/\s*\d+m[³3]?\s*$/i, '')   // Remove leitura inicial (2810m3, 100m³, etc.)
    .trim();
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

// Agrupa por nome limpo, aplicando o multiplicador nos pulsos
msg.payload = msg.payload.reduce((acc, reading) => {
  const device = findDevice(reading.slave_id, reading.channel);
  if (!device) return acc;

  const cleanName = getCleanName(device.name);
  const multiplier = getMultiplier(device.name);
  const multipliedPulses = reading.value * multiplier;
  const ts = new Date(reading.timestamp).getTime();

  if (!(cleanName in acc)) {
    acc[cleanName] = [];
  }

  acc[cleanName].push({
    ts: ts,
    values: { pulses: multipliedPulses },
  });

  return acc;
}, {});

return msg;
