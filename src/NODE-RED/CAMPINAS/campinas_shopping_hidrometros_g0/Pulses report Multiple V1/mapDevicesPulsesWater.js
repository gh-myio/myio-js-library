const devices = msg.payload;

// Remove multiplier patterns from device name (e.g., " x100", " x1.5V")
function getNameWithoutMultipliers(deviceName) {
  return deviceName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

const processedDevices = devices.map((device) => {
  // Extract multiplier from device name (e.g., "x100", "x1.5")
  const multiplierMatch = device.device_name.match(/ x(\d+\.?\d*)/i);
  const multiplier = multiplierMatch ? parseFloat(multiplierMatch[1]) : 1;

  // Get clean device name (without multiplier patterns)
  const cleanedName = getNameWithoutMultipliers(device.device_name);

  const totalConsumptionL = parseFloat(device.total_consumption_l) * multiplier;
  const maxHourlyConsumptionL = parseFloat(device.max_hourly_consumption_l) * multiplier;
  const minHourlyConsumptionL = parseFloat(device.min_hourly_consumption_l) * multiplier;
  const avgLPerHour = parseFloat(device.avg_l_per_hour) * multiplier;

  return {
    ...device,
    device_name: cleanedName,
    total_consumption_l: totalConsumptionL.toString(),
    max_hourly_consumption_l: maxHourlyConsumptionL.toString(),
    min_hourly_consumption_l: minHourlyConsumptionL.toString(),
    avg_l_per_hour: avgLPerHour.toString(),
  };
});

msg.payload = processedDevices;
return msg;
