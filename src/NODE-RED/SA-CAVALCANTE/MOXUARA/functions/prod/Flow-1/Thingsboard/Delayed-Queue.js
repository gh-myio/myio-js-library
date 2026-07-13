const bufferKey = 'latestMessages';
const lastSentKey = 'lastSentTimes';

const latestMessages = context.get(bufferKey) || {};
const lastSentTimes = context.get(lastSentKey) || {};

// Get the TTL from flow context or default to 5000ms
const deviceTTL = flow.get('deviceTTL') || 5000;
const now = Date.now();

// Handle "FLUSH" payload
if (typeof msg.payload === 'string' && msg.payload === 'FLUSH') {
  const newPayload = {};

  // Flush messages for devices whose TTL has expired
  for (const [deviceName, telemetry] of Object.entries(latestMessages)) {
    const lastSentTime = lastSentTimes[deviceName] || 0;
    if (now - lastSentTime >= deviceTTL) {
      newPayload[deviceName] = [telemetry];
      lastSentTimes[deviceName] = now;
      // Clear the flushed message
      delete latestMessages[deviceName];
    }
  }

  // Save the cleaned states to context
  context.set(bufferKey, latestMessages);
  context.set(lastSentKey, lastSentTimes);

  return Object.keys(newPayload).length > 0 ? { payload: newPayload } : null;
}

// Process normal payloads
if (typeof msg.payload === 'object') {
  // Update the latest message for each device
  for (const [deviceName, telemetryArray] of Object.entries(msg.payload)) {
    if (telemetryArray.length > 0) {
      latestMessages[deviceName] = {
        ...latestMessages[deviceName],
        ...telemetryArray[telemetryArray.length - 1],
      };
    }
  }

  context.set(bufferKey, latestMessages);
}

return null;
