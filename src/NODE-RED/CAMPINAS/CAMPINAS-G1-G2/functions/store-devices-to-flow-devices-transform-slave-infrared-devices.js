const slave = msg.payload;
const channels = slave.channels_list;
const config = slave.config; // This might be null

const slaveName = slave.name.trimStart().trim();
const centralId = env.get('CENTRAL_UUID');

const devices = {
  [slaveName]: {
    version: slave.version,
    temperature_correction: slave.temperature_correction,
    deviceKind: 'temperature_sensor',
    deviceName: slaveName,
  },
};

for (let i = 0; i < channels.length; i++) {
  const channel = channels[i];
  let channelConfig;

  if (config && config.channelConfig) {
    const channelConfigKey = `channel${channel.channel}`;

    if (config.channelConfig.hasOwnProperty(channelConfigKey)) {
      channelConfig = config.channelConfig[channelConfigKey];
    }
  }

  devices[channel.name] = {
    type: channel.type,
    name: channel.name,
    channelType: channelConfig ? channelConfig.channel_type : null,
    outputType: channelConfig ? channelConfig.output : null,
    slaveId: channel.slaveId,
    channelId: channel.channel,
    uniqueId: `${centralId}_${channel.slaveId}_${channel.id}`,
  };
}

msg.payload = devices;

return msg;
