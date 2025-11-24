const payload = msg.payload;
const shouldShutdown = payload.shouldShutdown;
const shouldActivate = payload.shouldActivate;
const device = payload.device;
const slaveId = device.slaveId;
const channelId = device.channelId;

let value = -1;
if (shouldActivate) {
    if (device.type && device.type === 'inverted_actionable') {
        value = 0;
    } else {
        value = 100;
    }
} else if (!shouldActivate && shouldShutdown) {
    if (device.type && device.type === 'inverted_actionable') {
        value = 100;
    } else {
        value = 0;
    }
}

if (value > -1) {
    return {
        ...msg,
        payload: {
            generic: true,
            id: slaveId,
            channel: channelId,
            value,
        }
    }
}

return null;