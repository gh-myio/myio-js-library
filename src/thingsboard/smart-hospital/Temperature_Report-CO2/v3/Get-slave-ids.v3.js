/**
 * Get Slave IDs v3
 *
 * Changes from v2:
 * - Added null check for slave_data
 * - Better error messages
 * - Validates required payload fields
 *
 * Maps device names from request to their slave IDs.
 * Preserves original payload for controller v3.
 */

const devices = msg.payload?.devices;
const storeDevices = flow.get('slave_data');

// Validate input
if (!devices || !Array.isArray(devices) || devices.length === 0) {
  node.warn({
    msg: 'Invalid or empty devices array in payload',
    payload: msg.payload,
  });
  return null;
}

if (!storeDevices || !Array.isArray(storeDevices) || storeDevices.length === 0) {
  node.warn({
    msg: 'slave_data not found or empty in flow context',
    hint: 'Ensure the initialization flow has populated slave_data',
  });
  return null;
}

// Validate date fields
if (!msg.payload.dateStart || !msg.payload.dateEnd) {
  node.warn({
    msg: 'Missing dateStart or dateEnd in payload',
    payload: msg.payload,
  });
  return null;
}

const slaveIds = [];
const deviceMapping = [];
const notFoundDevices = [];

for (const device of devices) {
  // Generic regex: removes any text in parentheses, e.g., " (Souza Aguiar CO2)"
  const modifiedDeviceName = `Temp. ${device.replace(/ \([^)]+\)/g, '')}`;

  const slave = storeDevices.find((storeDevice) => {
    return storeDevice.name.indexOf(modifiedDeviceName) > -1;
  });

  if (!slave) {
    notFoundDevices.push({ original: device, searched: modifiedDeviceName });
    continue;
  }

  slaveIds.push(slave.id);
  deviceMapping.push({
    originalName: device,
    slaveId: slave.id,
    slaveName: slave.name,
  });
}

// Log not found devices (if any)
if (notFoundDevices.length > 0) {
  node.warn({
    msg: `${notFoundDevices.length} device(s) not found in slave_data`,
    notFoundDevices,
  });
}

if (slaveIds.length === 0) {
  node.warn({
    msg: 'No slave IDs could be mapped from requested devices',
    requestedDevices: devices,
    availableSlaveCount: storeDevices.length,
  });
  return null;
}

// Preserve original payload for controller v3
msg.originalPayload = {
  ...msg.payload,
  slaveIds,
  deviceMapping,
};

msg.payload = {
  ...msg.payload,
  slaveIds,
};

return msg;
