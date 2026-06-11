const slave = msg.slave;
const lastReading = msg.payload;

const name = slave.name.trimStart().trim();
let key = 'temperature';

if (!lastReading.hasOwnProperty('temperature')) {
  key = 'value';
}

msg.payload = {
  [name]: [
    {
      temperature: lastReading[key],
    },
  ],
};

return msg;
