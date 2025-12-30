const slave = msg.payload;
const channels = slave.channels_list;
const config = slave.config; // This might be null

const devices = {};
const centralId = env.get('CENTRAL_UUID');

// Remove multiplier patterns from device name (e.g., " x100", " x1.5V")
function getNameWithoutMultipliers(deviceName) {
  var safeName = deviceName ? deviceName : '';
  return safeName.replace(/ x\d+\.?\d*[AV]?/gi, '').trim();
}

for (let i = 0; i < channels.length; i++) {
  const channel = channels[i];
  let channelConfig;

  if (config && config.channelConfig) {
    const channelConfigKey = `channel${channel.channel}`;

    if (config.channelConfig.hasOwnProperty(channelConfigKey)) {
      channelConfig = config.channelConfig[channelConfigKey];
    }
  }
  const name = getNameWithoutMultipliers(channel.name);
  devices[name] = {
    type: channel.type,
    name: channel.name,
    channelType: channelConfig ? channelConfig.channel_type : null,
    outputType: channelConfig ? channelConfig.output : null,
    slaveId: channel.slaveId,
    channelId: channel.channel,
    deviceKind: channel.type,
    deviceName: channel.name,
    uniqueId: `${centralId}_${channel.slaveId}_${channel.id}`,
  };
}
msg.payload = devices;

return msg;
