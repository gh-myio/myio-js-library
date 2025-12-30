// Fetch all flow sensor devices:
const devices = flow.get('devices') || {};

// Remove multiplier patterns from device name (e.g., " x100", " x1.5V")
function getNameWithoutMultipliers(deviceName) {
  return deviceName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

// Helper function to find the corresponding device by slaveId and channel
function findDevice(slaveId, channel) {
  for (const devKey in devices) {
    const device = devices[devKey];
    if (device.slaveId === slaveId && device.channelId === channel) {
      return device;
    }
  }
}

// Process the incoming payload and sum pulses (keeping the last timestamp)
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

  // Multiply the reading value by the multiplier
  const valueToAdd = reading.value * multiplier;
  // Get the timestamp (in milliseconds)
  const ts = new Date(reading.timestamp).getTime();

  // If this is the first reading for the device, initialize the object;
  // otherwise, add the pulses and update the timestamp to the current one.
  if (!(actualName in acc)) {
    acc[actualName] = [
      {
        ts: ts,
        values: {
          pulses: valueToAdd,
        },
      },
    ];
  } else {
    acc[actualName][0].values.pulses += valueToAdd;
    acc[actualName][0].ts = ts;
  }

  return acc;
}, {});

return msg;
