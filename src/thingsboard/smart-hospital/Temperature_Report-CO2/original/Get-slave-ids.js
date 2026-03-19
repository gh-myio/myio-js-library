const devices = msg.payload.devices;
const storeDevices = flow.get('slave_data');

const slaveIds = [];

for (const device of devices) {
  node.warn(`Antes: ${device}`);
  const modifiedDeviceName = `Temp. ${device.replace(/ \([^)]+\)/g, '')}`;
  node.warn(`depois: ${modifiedDeviceName}`);

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

msg.payload = {
  ...msg.payload,
  slaveIds,
};

return msg;
