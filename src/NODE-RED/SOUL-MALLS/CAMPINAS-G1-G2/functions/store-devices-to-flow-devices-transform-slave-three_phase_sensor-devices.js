const slave = msg.payload;
const channels = slave.channels_list;
const config = slave.config; // This might be null

const devices = {
  [slave.name]: {
    slaveId: slave.id,
  },
};

const centralId = env.get('CENTRAL_UUID');

devices[slave.name] = {
  version: slave.version,
  temperature_correction: slave.temperature_correction,
  deviceKind: 'energy',
  slaveId: slave.id,
  name: slave.name,
  centralId,
};

msg.payload = devices;

return msg;
