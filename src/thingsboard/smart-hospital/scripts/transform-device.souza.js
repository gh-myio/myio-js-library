function transformDevice(slave, lastReading) {
  let [_ignore, deviceName, offset, multiplier] = slave.name.split(' ');

  offset = parseInt(offset, 10);
  multiplier = parseFloat(multiplier.replace(/x/i, ''));

  const newValue = (lastReading - offset) * multiplier;

  if (slave.name.indexOf('Vacuo') > -1) {
    return (newValue / 100 - 1) * 750;
  }

  return newValue;
}

const devices = flow.get('slave_data') || {};
const newPayload = msg.payload.map((reading) => {
  const device = devices.find((_dev) => _dev.id === reading.slave_id);
  if (!device) {
    node.warn({ msg: 'Device not found', reading });
    return reading;
  }

  const deviceName = device.name.split(' ')[1];

  return {
    ...reading,
    value: transformDevice(device, reading.value),
    deviceName,
  };
});

msg.payload = newPayload;
return msg;
