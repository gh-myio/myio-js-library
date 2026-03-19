/**
 * Get Slave IDs v2
 *
 * Maps device names from request to their slave IDs.
 * Preserves original payload for controller v2.
 */

const devices = msg.payload.devices;
const storeDevices = flow.get('slave_data');

const slaveIds = [];
const deviceMapping = []; // Track device name to slaveId mapping

for (const device of devices) {
  const modifiedDeviceName = `Temp. ${device.replace(/ \([^)]+\)/g, '')}`;

  const slave = storeDevices.find((storeDevice) => {
    return storeDevice.name.indexOf(modifiedDeviceName) > -1;
  });

  if (!slave) {
    node.warn(`Device not found: ${device} -> ${modifiedDeviceName}`);
    continue;
  }

  slaveIds.push(slave.id);
  deviceMapping.push({
    originalName: device,
    slaveId: slave.id,
    slaveName: slave.name,
  });
}

if (slaveIds.length <= 0) {
  node.warn('No slave ids detected.');
  return null;
}

// Preserve original payload for controller v2
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
