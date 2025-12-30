const slave = msg.slave;
const lastReading = msg.payload;

const deviceMap = {
  0: 'a',
  1: 'b',
  2: 'c',
};

// Remove multiplier patterns from device name (e.g., " x100", " x1.5V")
function getNameWithoutMultipliers(deviceName) {
  return deviceName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

function getMultiplier(deviceName) {
  const match = deviceName.match(/ x(\d+\.?\d*)A/i);
  return match ? parseFloat(match[1]) : 1;
}

const name = getNameWithoutMultipliers(slave.name);
const multiplier = getMultiplier(slave.name);

msg.payload = {
  [name]: [
    {
      total_current: lastReading.total_current * multiplier,
      current_a: lastReading.a * multiplier,
      current_b: lastReading.b * multiplier,
      current_c: lastReading.c * multiplier,
    },
  ],
};

return msg;
