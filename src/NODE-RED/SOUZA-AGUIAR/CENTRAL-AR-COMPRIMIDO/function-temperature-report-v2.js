/**
 * Temperature Report Controller v3.1
 *
 * Changes from v3:
 * - Fixed regex to use Unicode escapes (\u00C0-\u00FF) instead of literal
 *   characters (À-ÿ) to avoid encoding issues
 *
 * Changes from v2:
 * - All timestamps in UTC (no timezone conversion)
 * - Fixed dateEnd handling to include full range
 * - Added validation for invalid dates
 * - Added null checks
 *
 * Missing telemetry shows as "SEM DADOS".
 */

const devices = flow.get('slave_data') || [];
const queryResults = msg.payload || [];

// Original request data (preserved by Get-slave-ids.v3.js)
const originalPayload = msg.originalPayload || {};
const requestedSlaveIds = originalPayload.slaveIds || [];
const dateStartStr = originalPayload.dateStart;
const dateEndStr = originalPayload.dateEnd;

// Validate dates
const dateStart = new Date(dateStartStr);
const dateEnd = new Date(dateEndStr);

if (isNaN(dateStart.getTime()) || isNaN(dateEnd.getTime())) {
  node.warn({
    msg: 'Invalid date range',
    dateStart: dateStartStr,
    dateEnd: dateEndStr,
  });
  msg.payload = [];
  return msg;
}

if (requestedSlaveIds.length === 0) {
  node.warn('No slave IDs in originalPayload');
  msg.payload = [];
  return msg;
}

/**
 * Generates all expected 30-minute slots between dateStart and dateEnd (UTC)
 * Rounds start down and end up to nearest 30-min boundary
 */
function generateExpectedSlots(slaveIds, start, end) {
  const slots = [];

  // Round start DOWN to nearest 30-min
  const slotStart = new Date(start);
  slotStart.setUTCMinutes(Math.floor(slotStart.getUTCMinutes() / 30) * 30, 0, 0);

  // Round end UP to nearest 30-min (to include partial intervals)
  const slotEnd = new Date(end);
  const endMinutes = slotEnd.getUTCMinutes();
  if (endMinutes % 30 !== 0 || slotEnd.getUTCSeconds() > 0 || slotEnd.getUTCMilliseconds() > 0) {
    slotEnd.setUTCMinutes(Math.ceil(endMinutes / 30) * 30, 0, 0);
  }

  const currentSlot = new Date(slotStart);

  while (currentSlot < slotEnd) {
    const readingDate = new Date(currentSlot);
    readingDate.setUTCHours(0, 0, 0, 0);

    for (const slaveId of slaveIds) {
      slots.push({
        reading_date: readingDate.toISOString(),
        slave_id: slaveId,
        time_interval: currentSlot.toISOString(),
      });
    }

    // Next 30-min slot
    currentSlot.setUTCMinutes(currentSlot.getUTCMinutes() + 30);
  }

  return slots;
}

/**
 * Parses device name and extracts adjustment operator
 * Uses Unicode escapes (\u00C0-\u00FF) for Latin-1 Supplement characters
 * to avoid file encoding issues
 */
function parseDeviceName(deviceName) {
  // \u00C0-\u00FF covers: À Á Â Ã Ä Å Æ Ç È É Ê Ë Ì Í Î Ï Ð Ñ Ò Ó Ô Õ Ö Ø Ù Ú Û Ü Ý Þ ß
  //                      à á â ã ä å æ ç è é ê ë ì í î ï ð ñ ò ó ô õ ö ø ù ú û ü ý þ ÿ
  const match = deviceName.match(/^(Temp\.\s*)([\w\u00C0-\u00FF\s\d-]+?)(?:\s([+\-xX]\d+(\.\d+)?))?$/);
  const cleanName = match ? match[2].trim() : deviceName;
  const adjustment = match && match[3] ? match[3].trim().toLowerCase() : '';
  return { cleanName, adjustment };
}

/**
 * Applies adjustment to value based on operator (+, -, x)
 */
function applyAdjustment(value, adjustment) {
  if (value === 'SEM DADOS' || value === null || value === undefined) {
    return 'SEM DADOS';
  }

  let adjustedValue = Number(value);
  if (isNaN(adjustedValue)) {
    return 'SEM DADOS';
  }

  if (!adjustment) {
    return adjustedValue;
  }

  if (/^[+\-x]\d+(\.\d+)?$/.test(adjustment)) {
    const operator = adjustment.charAt(0);
    const operand = parseFloat(adjustment.substring(1));

    if (operator === '+') {
      adjustedValue += operand;
    } else if (operator === '-') {
      adjustedValue -= operand;
    } else if (operator === 'x') {
      adjustedValue *= operand;
    }
  }

  return adjustedValue;
}

/**
 * Creates a lookup key for matching results to slots
 * Rounds to 30-minute boundary for consistent matching
 */
function createSlotKey(slaveId, timeInterval) {
  const time = new Date(timeInterval);
  // Round to 30-minute interval
  time.setUTCMinutes(Math.floor(time.getUTCMinutes() / 30) * 30, 0, 0);
  return `${slaveId}_${time.toISOString()}`;
}

// Build a map of existing results for quick lookup
const resultsMap = new Map();
for (const reading of queryResults) {
  const key = createSlotKey(reading.slave_id, reading.time_interval);
  resultsMap.set(key, reading);
}

// Build device lookup map by slave_id
const deviceMap = new Map();
for (const device of devices) {
  deviceMap.set(device.id, device);
}

// Generate all expected slots
const expectedSlots = generateExpectedSlots(requestedSlaveIds, dateStart, dateEnd);

// Build final response with all slots filled
const finalPayload = expectedSlots.map((slot) => {
  const key = createSlotKey(slot.slave_id, slot.time_interval);
  const existingReading = resultsMap.get(key);
  const device = deviceMap.get(slot.slave_id);

  // Parse device name and adjustment
  let deviceName = `Device ${slot.slave_id}`;
  let adjustment = '';

  if (device) {
    const parsed = parseDeviceName(device.name);
    deviceName = parsed.cleanName;
    adjustment = parsed.adjustment;
  }

  if (existingReading) {
    // We have telemetry data
    const rawValue = existingReading.avg_value;
    const adjustedValue = applyAdjustment(rawValue, adjustment);

    return {
      reading_date: slot.reading_date,
      slave_id: slot.slave_id,
      time_interval: existingReading.time_interval,
      avg_value: String(existingReading.avg_value),
      deviceName: deviceName,
      value: adjustedValue,
    };
  } else {
    // No telemetry data - return placeholder
    return {
      reading_date: slot.reading_date,
      slave_id: slot.slave_id,
      time_interval: slot.time_interval,
      avg_value: 'SEM DADOS',
      deviceName: deviceName,
      value: 'SEM DADOS',
    };
  }
});

// Sort by slave_id first, then by time_interval
finalPayload.sort((a, b) => {
  const deviceCompare = a.slave_id - b.slave_id;
  if (deviceCompare !== 0) return deviceCompare;
  return new Date(a.time_interval) - new Date(b.time_interval);
});

msg.payload = finalPayload;
return msg;
