const devices = flow.get('slave_data') || {};
const newPayload = msg.payload.map((reading) => {
  const device = devices.find((_dev) => _dev.id === reading.slave_id);
  if (!device) {
    node.warn({
      msg: 'Device not found',
      reading,
    });
    return reading;
  }

  // Updated regex to ensure 'x' is not treated as a multiplier without a space
  const match = device.name.match(/^(Temp\.\s*)([\w\s\d-]+?)(?:\s([+\-x]\d+(\.\d+)?))?$/);
  const deviceName = match ? match[2].trim() : device.name;
  const adjustment = match && match[3] ? match[3].trim() : '';

  let adjustedValue = Number(reading.value);
  if (/^[+\-x]\d+(\.\d+)?$/.test(adjustment)) {
    const operator = adjustment.charAt(0);
    const value = parseFloat(adjustment.substring(1));

    if (operator === '+') {
      adjustedValue += value;
    } else if (operator === '-') {
      adjustedValue -= value;
    } else if (operator === 'x') {
      adjustedValue *= value;
    }

    node.warn({
      device: deviceName,
      originalValue: reading.value,
      adjustedValue,
    });
  }

  return {
    ...reading,
    deviceName,
    value: adjustedValue,
  };
});

msg.payload = newPayload;
return msg;
