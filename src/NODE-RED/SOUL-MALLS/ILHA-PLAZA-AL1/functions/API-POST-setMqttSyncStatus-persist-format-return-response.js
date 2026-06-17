// Desempacota o resultado do set_mqtt_sync_status() (node-red-contrib-postgresql
// devolve msg.payload como array de rows) e monta a resposta HTTP.
// Mesmo formato do API-POST-provision-format-return-response.js.

var row = null;

if (msg.payload && msg.payload[0] && msg.payload[0].result) {
  row = msg.payload[0].result;
} else if (msg.payload && msg.payload.rows && msg.payload.rows[0]) {
  row = msg.payload.rows[0].result;
}

if (!row) {
  msg.payload = { ok: false, error: 'no result' };
  msg.statusCode = 500;
} else {
  msg.payload = row;
  msg.statusCode = (row.ok === false) ? 400 : 200;
  // mantém o cache em memória coerente com o que foi persistido
  if (row.ok && row.mqttSyncStatus) {
    global.set('mqttSyncStatus', row.mqttSyncStatus);
  }
}

return msg;
