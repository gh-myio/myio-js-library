/**
 * Get Slave IDs v3.1
 *
 * Changes from v3:
 * - Reads optional `adjustmentSince` from the URL query string
 *   (?adjustmentSince=2026-09-01T00:00:00Z) and forwards it in
 *   msg.originalPayload. Controller v3.2 only applies the name-based
 *   adjustment (+/-/x) to telemetry from that date forward.
 *   When the parameter is absent (or invalid), the HARD-CODED default
 *   below is used: 2026-09-01 00:00 UTC.
 *
 * Changes from v2:
 * - Added null check for slave_data
 * - Better error messages
 * - Validates required payload fields
 *
 * Maps device names from request to their slave IDs.
 * Preserves original payload for controller v3.
 */

const devices = msg.payload && msg.payload.devices;
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
  // Generic regex: removes any text in parentheses, e.g., " (Souza Aguiar TD)"
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

// Adjustment reference date, from the URL query string
// (?adjustmentSince=...) with the request body as fallback.
// HARD-CODED default when absent or invalid: 2026-09-01 00:00 UTC —
// adjustments (+/-/x from the device name) only apply to telemetry
// from this date forward.
const ADJUSTMENT_SINCE_DEFAULT = '2026-09-01T00:00:00.000Z';
const adjustmentSinceRaw =
  (msg.req && msg.req.query && msg.req.query.adjustmentSince) ||
  msg.payload.adjustmentSince ||
  null;
let adjustmentSince = ADJUSTMENT_SINCE_DEFAULT;
if (adjustmentSinceRaw) {
  const parsed = new Date(adjustmentSinceRaw);
  if (isNaN(parsed.getTime())) {
    node.warn({
      msg: 'Invalid adjustmentSince, falling back to default',
      adjustmentSince: adjustmentSinceRaw,
      default: ADJUSTMENT_SINCE_DEFAULT,
    });
  } else {
    adjustmentSince = parsed.toISOString();
  }
}

// Preserve original payload for controller v3
msg.originalPayload = {
  ...msg.payload,
  slaveIds,
  deviceMapping,
  adjustmentSince,
};

msg.payload = {
  ...msg.payload,
  slaveIds,
};

return msg;
