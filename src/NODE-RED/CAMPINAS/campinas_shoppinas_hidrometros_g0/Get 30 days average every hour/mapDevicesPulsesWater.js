// Fetch all flow sensor devices:
const devices = flow.get('devices') || {};

// Remove multiplier patterns from device name (e.g., " x100", " x1.5V")
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
}

msg.payload = msg.payload.reduce((acc, reading) => {
  const device = findDevice(reading.slave_id, reading.channel);
  if (!device) {
    return acc;
  }

  // Get clean device name (without multiplier patterns)
  const actualName = getNameWithoutMultipliers(device.name);

  // Extract multiplier from device name (e.g., "x100", "x1.5")
  const multiplierMatch = device.name.match(/ x(\d+\.?\d*)/i);
  const multiplier = multiplierMatch ? parseFloat(multiplierMatch[1]) : 1;

  if (!(actualName in acc)) {
    acc[actualName] = [];
  }

  acc[actualName].push({
    ts: new Date(reading.reference_hour).getTime(),
    values: {
      pulsesHourlyAverage: parseFloat(reading.avg_sum) * multiplier,
      pulsesHourlyAverageMin: parseFloat(reading.avg_min_sum) * multiplier,
      pulsesHourlyAverageMax: parseFloat(reading.avg_max_sum) * multiplier,
    },
  });

  return acc;
}, {});

return msg;
