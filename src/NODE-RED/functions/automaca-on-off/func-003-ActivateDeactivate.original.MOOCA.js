const payload = msg.payload;
const shouldShutdown = payload.shouldShutdown;
const shouldActivate = payload.shouldActivate;
const device = payload.device;
const slaveId = device.slaveId;
const channelId = device.channelId;


let value = -1;
if (shouldActivate) {
    value = 100;
} else if (!shouldActivate && shouldShutdown) {
    value = 0;
}

if (value > -1) {
    return {
        payload: {
            generic: true,
            id: slaveId,
            channel: channelId,
            value,
        }
    }
}

return null;