// Fetch all flow sensor devices:
const devices = flow.get('devices') || {};

// Remove multiplier patterns from device name (e.g., " x100", " x1.5V")
function getNameWithoutMultipliers(deviceName) {
  var safeName = deviceName ? deviceName : '';
  return safeName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

function findDevice(slaveId) {
  for (const devKey in devices) {
    const device = devices[devKey];

    if (device.slaveId === slaveId) {
      return device;
    }
  }
}

msg.payload = msg.payload.reduce((acc, reading) => {
  const device = findDevice(reading.slave_id);

  if (!device) {
    return acc;
  }

  // Get clean device name (without multiplier patterns)
  const actualName = getNameWithoutMultipliers(device.name);

  if (!(actualName in acc)) {
    acc[actualName] = [];
  }

  acc[actualName].push({
    ts: new Date(reading.quinze_min).getTime(),
    values: {
      Wh4: reading.value_wh,
    },
  });

  return acc;
}, {});

return msg;
