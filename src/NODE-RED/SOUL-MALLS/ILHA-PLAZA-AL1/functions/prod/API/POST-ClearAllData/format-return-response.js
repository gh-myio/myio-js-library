// clear_all_data_central() returns one row: { result: { removed: {...}, status: 'ok' } }
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
  msg.statusCode = 200;
}
msg.headers = { 'Content-Type': 'application/json' };
return msg;
