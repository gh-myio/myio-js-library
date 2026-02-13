/**
 * Temperature Report Controller v2
 *
 * Ensures all requested devices appear in the response for all 30-minute
 * intervals, even if no telemetry data exists. Missing values show as "SEM DADOS".
 *
 * Based on Temperature_Report-CO2 implementation.
 */

const devices = flow.get('slave_data') || [];
const queryResults = msg.payload || [];

// Original request data (preserved by Get-slave-ids.v2.js)
const originalPayload = msg.originalPayload || {};
const requestedSlaveIds = originalPayload.slaveIds || [];
const dateStart = new Date(originalPayload.dateStart);
const dateEnd = new Date(originalPayload.dateEnd);

// Timezone offset for America/Sao_Paulo (UTC-3)
const TZ_OFFSET_HOURS = -3;

/**
 * Converts UTC date to Sao Paulo timezone
 */
function toSaoPauloTime(date) {
  const utc = new Date(date);
  return new Date(utc.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Generates all expected 30-minute slots between dateStart and dateEnd
 */
function generateExpectedSlots(slaveIds, startDate, endDate) {
  const slots = [];

  // Normalize to start of day in Sao Paulo time
  const start = toSaoPauloTime(startDate);
  start.setHours(0, 0, 0, 0);

  const end = toSaoPauloTime(endDate);
  end.setHours(0, 0, 0, 0);

  const currentDate = new Date(start);

  while (currentDate < end) {
    const readingDate = new Date(currentDate);
    readingDate.setHours(0, 0, 0, 0);

    // Generate 48 slots per day (every 30 minutes)
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeInterval = new Date(currentDate);
        timeInterval.setHours(hour, minute, 0, 0);

        for (const slaveId of slaveIds) {
          slots.push({
            reading_date: readingDate.toISOString(),
            slave_id: slaveId,
            time_interval: timeInterval.toISOString(),
          });
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

/**
 * Parses device name and extracts adjustment operator
 */
function parseDeviceName(deviceName) {
  const match = deviceName.match(/^(Temp\.\s*)([\wÀ-ÿ\s\d-]+?)(?:\s([+\-x]\d+(\.\d+)?))?$/);
  const cleanName = match ? match[2].trim() : deviceName;
  const adjustment = match && match[3] ? match[3].trim() : '';
  return { cleanName, adjustment };
}

/**
 * Applies adjustment to value based on operator
 */
function applyAdjustment(value, adjustment) {
  if (value === 'SEM DADOS' || value === null || value === undefined || !adjustment) {
    return value === 'SEM DADOS' ? value : Number(value);
  }

  let adjustedValue = Number(value);
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
 * Uses reading_date (day) + slave_id + time_interval (30-min slot)
 */
function createSlotKey(slaveId, timeInterval) {
  const time = new Date(timeInterval);
  // Round to 30-minute interval
  const minutes = Math.floor(time.getMinutes() / 30) * 30;
  time.setMinutes(minutes, 0, 0);
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
    const rawValue = Number(existingReading.avg_value);
    const adjustedValue = applyAdjustment(rawValue, adjustment);

    return {
      reading_date: slot.reading_date,
      slave_id: slot.slave_id,
      time_interval: existingReading.time_interval,
      avg_value: existingReading.avg_value,
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
