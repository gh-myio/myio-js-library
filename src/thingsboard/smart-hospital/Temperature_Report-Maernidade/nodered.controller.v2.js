/**
 * Temperature Report Controller v2
 *
 * Ensures all requested devices appear in the response,
 * even if no telemetry data exists for certain intervals.
 * Missing values are represented as "-".
 */

const devices = flow.get('slave_data') || [];
const queryResults = msg.payload;

// Original request data (passed through the flow)
const requestedSlaveIds = msg.originalPayload?.slaveIds || [];
const dateStart = new Date(msg.originalPayload?.dateStart);
const dateEnd = new Date(msg.originalPayload?.dateEnd);

// Hour groups that the query looks for
const HOUR_GROUPS = ['11:00', '17:00', '23:00'];

/**
 * Generates all expected time slots between dateStart and dateEnd
 */
function generateExpectedSlots(slaveIds, startDate, endDate) {
  const slots = [];
  const currentDate = new Date(startDate);
  currentDate.setUTCHours(0, 0, 0, 0);

  const endDateNormalized = new Date(endDate);
  endDateNormalized.setUTCHours(0, 0, 0, 0);

  while (currentDate < endDateNormalized) {
    for (const slaveId of slaveIds) {
      for (const hourGroup of HOUR_GROUPS) {
        const [hour, minute] = hourGroup.split(':').map(Number);
        const timeInterval = new Date(currentDate);
        timeInterval.setUTCHours(hour, minute, 0, 0);

        slots.push({
          reading_date: currentDate.toISOString(),
          slave_id: slaveId,
          hour_group: hourGroup,
          time_interval: timeInterval.toISOString(),
        });
      }
    }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return slots;
}

/**
 * Parses device name and extracts adjustment operator
 */
function parseDeviceName(deviceName) {
  const match = deviceName.match(/^(Temp\.\s*)([\w\s\d-]+?)(?:\s([+\-x]\d+(\.\d+)?))?$/);
  const cleanName = match ? match[2].trim() : deviceName;
  const adjustment = match && match[3] ? match[3].trim() : '';
  return { cleanName, adjustment };
}

/**
 * Applies adjustment to value based on operator
 */
function applyAdjustment(value, adjustment) {
  if (value === '-' || !adjustment) return value;

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
 */
function createSlotKey(slaveId, readingDate, hourGroup) {
  const dateStr = new Date(readingDate).toISOString().split('T')[0];
  return `${slaveId}_${dateStr}_${hourGroup}`;
}

// Build a map of existing results for quick lookup
const resultsMap = new Map();
for (const reading of queryResults) {
  // Determine hour group from timestamp
  const timestamp = new Date(reading.timestamp || reading.time_interval);
  const hour = timestamp.getUTCHours();

  let hourGroup;
  if (hour >= 11 && hour < 12) hourGroup = '11:00';
  else if (hour >= 17 && hour < 18) hourGroup = '17:00';
  else if (hour >= 23) hourGroup = '23:00';

  if (!hourGroup) continue;

  const key = createSlotKey(reading.slave_id, reading.reading_date || reading.timestamp, hourGroup);
  resultsMap.set(key, reading);
}

// Build device lookup map
const deviceMap = new Map();
for (const device of devices) {
  deviceMap.set(device.id, device);
}

// Generate all expected slots
const expectedSlots = generateExpectedSlots(requestedSlaveIds, dateStart, dateEnd);

// Build final response with all slots filled
const finalPayload = expectedSlots.map((slot) => {
  const key = createSlotKey(slot.slave_id, slot.reading_date, slot.hour_group);
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
    const rawValue = Number(existingReading.value);
    const adjustedValue = applyAdjustment(rawValue, adjustment);

    return {
      reading_date: slot.reading_date,
      slave_id: slot.slave_id,
      hour_group: slot.hour_group,
      time_interval: existingReading.timestamp || slot.time_interval,
      avg_value: existingReading.avg_value || String(rawValue),
      deviceName: deviceName,
      value: adjustedValue,
    };
  } else {
    // No telemetry data - return placeholder
    return {
      reading_date: slot.reading_date,
      slave_id: slot.slave_id,
      hour_group: slot.hour_group,
      time_interval: slot.time_interval,
      avg_value: '-',
      deviceName: deviceName,
      value: '-',
    };
  }
});

// Sort by date, then by device, then by hour group
finalPayload.sort((a, b) => {
  const dateCompare = new Date(a.reading_date) - new Date(b.reading_date);
  if (dateCompare !== 0) return dateCompare;

  const deviceCompare = a.slave_id - b.slave_id;
  if (deviceCompare !== 0) return deviceCompare;

  return HOUR_GROUPS.indexOf(a.hour_group) - HOUR_GROUPS.indexOf(b.hour_group);
});

msg.payload = finalPayload;
return msg;
