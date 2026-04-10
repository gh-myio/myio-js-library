const slave = msg.slave;
const lastReading = msg.payload;

let [_ignore, deviceName, offset, height, multiplier] = slave.name.split(' ');

offset = parseInt(offset, 10);
multiplier = parseFloat(multiplier.replace(/x/i, ''));
height = parseInt(height);

const waterLevel = (msg.payload.value - offset) * multiplier;
const percentage = parseFloat((waterLevel / height).toFixed(2));

msg.payload = {
  [deviceName]: [
    {
      water_level: waterLevel,
      water_percentage: percentage,
    },
  ],
};

return msg;
