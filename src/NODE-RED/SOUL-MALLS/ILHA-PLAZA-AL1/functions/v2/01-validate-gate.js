/**
 * STEP 1/3 — VALIDATE GATE · POST /api/setMqttSyncStatus
 * Pipeline: [http in] → (1) validate-gate → (2) engine → [http response / persist]
 *
 * Valida o payload e roteia. NÃO aplica regra de negócio (isso é o step 2:
 * 02-engine-holds-ttl-record.js, ou um Postgres set_mqtt_sync_status($1)).
 *
 * SAÍDAS (2):
 *   saída 1 → step 2 (válido).  msg.envelope = {...} · msg.params = [envelope] ($1 Postgres)
 *   saída 2 → http response (inválido). msg.payload = { error }, msg.statusCode = 4xx
 *
 *   válido   → return [msg, null]
 *   inválido → return [null, msg]
 */

var INTENTS = ['DISABLE', 'ENABLE', 'FORCE_DISABLE', 'FORCE_ENABLE', 'QUERY'];
var SYSTEMS = ['GCDR', 'ALARMS', 'THINGSBOARD', 'MOBILE_APP', 'PRE_SETUP', 'MANUAL'];

function reject(msg, code, message) {
  msg.statusCode = 400;
  msg.headers = { 'Content-Type': 'application/json' };
  msg.payload = { ok: false, error: code, message: message };
  return [null, msg]; // direto pro http response
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

var body = msg.payload;
var nowMs = Date.now();

// 0) corpo precisa ser objeto
if (!body || typeof body !== 'object') {
  return reject(msg, 'INVALID_PAYLOAD', 'corpo ausente ou não é JSON');
}

// 1) compat v1: { mqttSyncStatus: "enable"|"disable" } → vira FORCE_*
if (!body.intent && (body.mqttSyncStatus === 'enable' || body.mqttSyncStatus === 'disable')) {
  body = {
    schemaVersion: 'legacy',
    intent: body.mqttSyncStatus === 'enable' ? 'FORCE_ENABLE' : 'FORCE_DISABLE',
    hold: { reasonCode: 'MANUAL_OPS', reason: 'compat v1' },
    actor: { system: 'MANUAL' },
    request: {}
  };
}

// 2) intent
var intent = String(body.intent || '').toUpperCase();
if (INTENTS.indexOf(intent) === -1) {
  return reject(msg, 'INVALID_INTENT', 'intent deve ser um de: ' + INTENTS.join(', '));
}

// 3) actor.system (quando enviado)
var actor = body.actor || {};
if (actor.system && SYSTEMS.indexOf(actor.system) === -1) {
  return reject(msg, 'INVALID_SYSTEM', 'actor.system inválido: ' + actor.system);
}

// 4) hold.holdId obrigatório em DISABLE/ENABLE
var hold = body.hold || {};
if ((intent === 'DISABLE' || intent === 'ENABLE') && !hold.holdId) {
  return reject(msg, 'MISSING_HOLD_ID', intent + ' requer hold.holdId');
}

// 5) ttlSeconds, quando presente, precisa ser número >= 0
if (hold.ttlSeconds != null && (typeof hold.ttlSeconds !== 'number' || hold.ttlSeconds < 0)) {
  return reject(msg, 'INVALID_TTL', 'hold.ttlSeconds deve ser número >= 0');
}

// ── válido: monta envelope normalizado e entrega pro step 2 ────────────────────
var rq = body.request || {};
var envelope = {
  schemaVersion: body.schemaVersion || '2.0',
  intent: intent,
  hold: {
    holdId: hold.holdId || null,
    ttlSeconds: hold.ttlSeconds != null ? hold.ttlSeconds : null,
    reasonCode: hold.reasonCode || 'OTHER',
    reason: hold.reason || null
  },
  scope: body.scope || { level: 'CENTRAL', targets: [] },
  actor: {
    system: actor.system || 'UNKNOWN',
    instanceId: actor.instanceId || null,
    version: actor.version || null,
    user: actor.user || null,
    requestIp: actor.requestIp || (msg.req && msg.req.ip) || null
  },
  request: {
    requestId: rq.requestId || uuid(),
    correlationId: rq.correlationId || null,
    idempotencyKey: rq.idempotencyKey || rq.requestId || null,
    requestedAt: rq.requestedAt || new Date(rq.requestedAtMs || nowMs).toISOString(),
    requestedAtMs: rq.requestedAtMs || nowMs,
    receivedAtMs: nowMs
  }
};

msg.envelope = envelope;     // step 2 (engine) consome daqui
msg.params = [envelope];     // $1 = JSON inteiro, se o step 2 for um Postgres
return [msg, null];
