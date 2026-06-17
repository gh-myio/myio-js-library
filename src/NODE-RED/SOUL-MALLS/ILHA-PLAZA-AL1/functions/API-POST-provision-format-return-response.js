var row = null;

if (msg.payload && msg.payload[0] && msg.payload[0].result) {
  row = msg.payload[0].result;
} else if (msg.payload && msg.payload.rows && msg.payload.rows[0]) {
  row = msg.payload.rows[0].result;
}

if (!row) {
  msg.payload = { error: 'no result' };
  msg.statusCode = 500;
} else {
  msg.payload = row;
  msg.statusCode = row.errors && row.errors.length ? 207 : 200;
}

return msg;
