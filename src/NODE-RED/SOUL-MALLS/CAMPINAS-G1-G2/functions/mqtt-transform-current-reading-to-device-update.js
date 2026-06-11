const slave = msg.slave;
const lastReading = msg.payload;
const deviceMap = {
  0: 'a',
  1: 'b',
  2: 'c',
};

function getMultiplier(deviceName) {
  const match = deviceName.match(/ x(\d+\.?\d*)A/i);
  return match ? parseFloat(match[1]) : 1;
}

function getNameWithoutMultipliers(deviceName) {
  return deviceName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

const name = slave.name;
const cleanName = getNameWithoutMultipliers(name);

msg.payload = {
  [cleanName]: [
    {
      total_current: lastReading.total_current * getMultiplier(name),
      current_a: lastReading.a * getMultiplier(name),
      current_b: lastReading.b * getMultiplier(name),
      current_c: lastReading.c * getMultiplier(name),
    },
  ],
};

return msg;
