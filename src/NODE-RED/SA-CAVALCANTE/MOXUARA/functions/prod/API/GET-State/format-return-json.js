// node-red-contrib-postgresql returns msg.payload as an array of rows.
// The aggregate query yields exactly one row with a `state` JSON column.
// Unwrap it so the HTTP response body IS the state object directly
// (not [{state: {...}}]).
if (Array.isArray(msg.payload) && msg.payload.length > 0 && msg.payload[0].state) {
  msg.payload = msg.payload[0].state;
} else {
  // Defensive default — return empty shape rather than 500 if tables
  // somehow yielded no row.
  msg.payload = {
    ambients: [],
    slaves: [],
    channels: [],
    rfir_devices: [],
    ambients_rfir_slaves_rel: [],
    ambients_rfir_devices_rel: [],
  };
}
msg.headers = { 'Content-Type': 'application/json' };
return msg;
