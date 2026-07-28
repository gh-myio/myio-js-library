// GET /api/mqttSyncStatus
// Roda DEPOIS do nó Postgres (API-GET-SYNC-getMqttSyncStatus-SQL.sql), que lê o
// status persistido em slaves.config do slave virtual "MQTT Sync".
// node-red-contrib-postgresql devolve msg.payload como array de rows.
//
// Precedência: valor do banco → cache global → 'enable' (default legado).
// O valor resolvido é gravado de volta no global (sincroniza o flow).

let fromDb = null;

if (Array.isArray(msg.payload) && msg.payload[0]) {
  fromDb = msg.payload[0].mqtt_sync_status || null;
} else if (msg.payload && msg.payload.rows && msg.payload.rows[0]) {
  fromDb = msg.payload.rows[0].mqtt_sync_status || null;
}

const mqttSyncStatus = fromDb || global.get('mqttSyncStatus') || 'enable';

// seta no flow (cache em memória)
global.set('mqttSyncStatus', mqttSyncStatus);

msg.payload = mqttSyncStatus;
msg.statusCode = 200;

return msg;
