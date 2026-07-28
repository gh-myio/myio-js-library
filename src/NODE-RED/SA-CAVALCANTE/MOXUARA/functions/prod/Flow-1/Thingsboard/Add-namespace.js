const keys = Object.keys(msg.payload);

const newPayload = keys.reduce((acc, key) => {
  acc[`${key} (Ilha Plaza)`] = msg.payload[key];
  return acc;
}, {});

msg.payload = newPayload;
return msg;
