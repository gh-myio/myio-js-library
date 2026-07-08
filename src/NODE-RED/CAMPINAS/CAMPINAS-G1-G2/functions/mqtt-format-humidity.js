const slave = msg.slave;
const lastReading = msg.payload;

msg.payload = {
  [slave.name]: [
    {
      humidity: lastReading.humidity,
    },
  ],
};

return msg;
