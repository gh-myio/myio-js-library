const slave = msg.slave;
const lastReading = msg.payload;
const deviceMap = {
  0: 'a',
  1: 'b',
  2: 'c',
};

function getMultiplier(deviceName) {
  const match = deviceName.match(/x(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
}

function getNameWithoutMultipliers(deviceName) {
  return deviceName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

const name = slave.name;
const cleanName = getNameWithoutMultipliers(name);

msg.payload = {
  [cleanName]: [
    {
      consumption: lastReading.value * getMultiplier(name),
      a: lastReading.phases ? lastReading.phases.a * getMultiplier(name) : null,
      b: lastReading.phases ? lastReading.phases.b * getMultiplier(name) : null,
      c: lastReading.phases ? lastReading.phases.c * getMultiplier(name) : null,
    },
  ],
};

return msg;
