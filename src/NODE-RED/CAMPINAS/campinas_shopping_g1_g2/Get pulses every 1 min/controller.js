// Fetch all flow sensor devices:
const devices = flow.get('devices') || {};

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

  // Parse the device.name which is in the format:
  // "Hidr. <DeviceName> x<multiplier> <initial reading>"
  // e.g., "Hidr. Teta_tetinha x100 2810m3"
  const match = device.name.match(/^Hidr\.\s*(.*?)(?:\s*x(\d+).*)?$/);
  let actualName, multiplier;
  if (match) {
    actualName = match[1];
    multiplier = match[2] ? parseFloat(match[2]) : 1;
  } else {
    actualName = device.name;
    multiplier = 1;
  }

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
