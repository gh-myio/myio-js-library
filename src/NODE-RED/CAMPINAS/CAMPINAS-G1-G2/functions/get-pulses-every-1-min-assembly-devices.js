function formatForPostgresInQuery(arrayOfArrays) {
  // Map each sub-array to a string in the format "(x, y)"
  const formattedItems = arrayOfArrays.map((subArray) => `(${subArray.join(', ')})`);

  // Join all the formatted items into one string with proper enclosing
  return `(${formattedItems.join(', ')})`;
}

// Fetch all flow sensor devices:

const devices = flow.get('devices') || {};
const now = new Date();

now.setMinutes(now.getMinutes() - 1);

const flowDevices = [];

for (const devKey in devices) {
  const device = devices[devKey];
  if (device.type === 'flow_sensor') {
    flowDevices.push([device.slaveId, device.channelId]);
  }
}

if (flowDevices.length === 0) {
  return null;
}

msg.payload = {
  devices: formatForPostgresInQuery(flowDevices),
  dateStart: now.toISOString(),
};

return msg;
