const flowDevices = flow.get('devices') || {};
const deviceName = (msg.req.params.deviceName || '').trim();

// 1. Exact match
let foundDevice = flowDevices[deviceName];
let matchedKey = deviceName;

// 2. Stored key starts with query ("3F Trafo CAG 1" → "3F Trafo CAG 1 x400 x400A")
if (!foundDevice) {
  matchedKey = Object.keys(flowDevices).find(key =>
    key.startsWith(deviceName + ' ') || key.startsWith(deviceName + '\t')
  );
  foundDevice = matchedKey ? flowDevices[matchedKey] : undefined;
}

// 3. Query starts with stored key ("3F Trafo CAG 1 -8" → "3F Trafo CAG 1")
if (!foundDevice) {
  matchedKey = Object.keys(flowDevices).find(key =>
    deviceName.startsWith(key + ' ') || deviceName.startsWith(key + '\t')
  );
  foundDevice = matchedKey ? flowDevices[matchedKey] : undefined;
}

if (!foundDevice) {
  node.warn('DEVICE NOT FOUND: ' + deviceName);
  return null;
}

node.debug('Device lookup: "' + deviceName + '" → "' + matchedKey + '"');

msg.payload = {
  slave: {
    id: foundDevice.slaveId,
  },
};

return msg;
