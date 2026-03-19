const devices = msg.payload.devices;
const storeDevices = flow.get('slave_data');

const slaveIds = [];

for (const device of devices) {
  const modifiedDeviceName = `Temp. ${device.replace(' (Souza Aguiar CO2)', '')}`;

  const slave = storeDevices.find((storeDevice) => {
    return storeDevice.name.indexOf(modifiedDeviceName) > -1;
  });

  if (!slave) continue;

  slaveIds.push(slave.id);
}

if (slaveIds.length <= 0) {
  node.warn('No slave ids detected.');
  return null;
}

// Preserve original payload for controller v2
msg.originalPayload = {
  ...msg.payload,
  slaveIds,
};

msg.payload = {
  ...msg.payload,
  slaveIds,
};

return msg;
