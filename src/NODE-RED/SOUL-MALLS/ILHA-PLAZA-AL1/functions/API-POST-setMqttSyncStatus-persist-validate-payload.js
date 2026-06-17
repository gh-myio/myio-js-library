// POST /api/setMqttSyncStatus — valida o envelope e prepara o param $1::jsonb
// para set_mqtt_sync_status(). Payload de referência: setMqttSyncStatus-payload.example.json
//
// Saída ÚNICA (return msg). O roteamento é feito por um nó Switch a jusante,
// lendo msg.payload.status:
//   - "valid"   → nó Postgres (SQL.sql)  [usa msg.params]
//   - "invalid" → http response (msg.statusCode = 400)

const body = (msg.payload && typeof msg.payload === 'object') ? msg.payload : {};

const intent = String(body.intent || '').toUpperCase();
let status = String(body.mqttSyncStatus || body.status || '').toLowerCase();
if (!status) {
  status = ({
    DISABLE: 'disable', FORCE_DISABLE: 'disable',
    ENABLE: 'enable',  FORCE_ENABLE: 'enable',
  })[intent] || '';
}

// QUERY é read-only e válido; os demais precisam resolver enable|disable
const isValid = (intent === 'QUERY') || status === 'enable' || status === 'disable';

if (!isValid) {
  msg.statusCode = 400;
  msg.payload = {
    status: 'invalid',
    ok: false,
    error: 'payload inválido: informe intent (DISABLE|ENABLE|FORCE_*|QUERY) ou mqttSyncStatus (enable|disable)',
    intent: intent || null,
  };
  return msg;
}

// cache em memória imediato (mantém o GET/global em sincronia). QUERY não altera.
if (status) global.set('mqttSyncStatus', status);

// param do $1::jsonb (a função deriva status/user/slave do envelope v2)
msg.params = [JSON.stringify(body)];

// marcador de roteamento p/ o Switch (o param real vai em msg.params)
msg.payload = { status: 'valid', mqttSyncStatus: status || null, intent: intent || null };

return msg;
