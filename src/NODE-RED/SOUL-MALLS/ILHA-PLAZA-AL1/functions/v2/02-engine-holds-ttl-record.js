/**
 * STEP 2/3 — ENGINE · holds + TTL + record append-only + global derivado
 * Pipeline: [http in] → (1) validate-gate → (2) engine → [http response / persist]
 *
 * Consome o envelope do step 1 (msg.envelope). Se rodar SOZINHO (sem o gate),
 * cai no fallback que normaliza msg.payload (v2 ou v1 legado).
 *
 * Modelo: MQTT habilitado ⟺ nenhum hold ativo. Cada sistema (GCDR/ALARMS/
 * THINGSBOARD/MOBILE_APP/PRE_SETUP/MANUAL) adquire/libera um hold nomeado.
 * Holds expiram por TTL (dead-man switch). effectiveStatus é DERIVADO.
 *
 * SAÍDAS (2):
 *   saída 1 → http response        (msg.payload = RESPONSE, msg.statusCode)
 *   saída 2 → persistência/forward (msg.payload = RECORD; null quando não há record)
 *             ex.: Postgres (coluna state JSON) / arquivo / HTTP request p/ GCDR
 *
 * ESTADO (global context — troque por contextStore em disco p/ sobreviver a restart):
 *   global 'mqttHolds'      : { [holdId]: { holdId, system, reasonCode, reason,
 *                                           acquiredAt, acquiredAtMs, expiresAtMs } }
 *   global 'mqttSyncStatus' : "enable" | "disable"   (cache derivado — leitores legados)
 *   global 'mqttLastChange' : { at, by, intent, requestId }
 *   global 'mqttAuditLog'   : RECORD[]  (ring buffer capado — auditoria rápida no GET)
 *   global 'mqttSeenReqs'   : { [requestId|idempotencyKey]: epochMs }  (idempotência)
 */

// ── config ──────────────────────────────────────────────────────────────────
var AUDIT_RING_MAX = 200;       // máximo de records mantidos em memória
var SEEN_TTL_MS = 6 * 60 * 60 * 1000; // idempotência lembrada por 6h
var DEFAULT_TTL_SECONDS = 900;  // fallback quando DISABLE não manda ttl
var MAX_TTL_SECONDS = 6 * 60 * 60; // teto de segurança (6h)
var CENTRAL = { id: 'ilha-plaza-al1', name: 'Ilha Plaza AL1', gatewayId: '81a60176-222c-4bb9-88f5-bc2b47802d82' };
var VALID_INTENTS = ['DISABLE', 'ENABLE', 'FORCE_DISABLE', 'FORCE_ENABLE', 'QUERY'];
var VALID_SYSTEMS = ['GCDR', 'ALARMS', 'THINGSBOARD', 'MOBILE_APP', 'PRE_SETUP', 'MANUAL', 'LEGACY', 'UNKNOWN'];

// ── helpers ─────────────────────────────────────────────────────────────────
function uuid() {
  // RFC4122 v4 sem dependência de crypto (centrais OrangePi, Node antigo)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function iso(ms) { return new Date(ms).toISOString(); }
function clampTtl(s) {
  var n = Number(s);
  if (!isFinite(n) || n < 0) return DEFAULT_TTL_SECONDS;
  if (n === 0) return 0;                 // 0 = sem expiração (desencorajado, mas permitido)
  return Math.min(n, MAX_TTL_SECONDS);
}
function fail(code, message, httpStatus) {
  return { _error: true, errorCode: code, message: message, httpStatus: httpStatus || 400 };
}

// Fallback standalone: aceita v2 (objeto rico) e v1 legado ({ mqttSyncStatus: "enable" })
function normalizeRequest(body, nowMs) {
  if (body && typeof body === 'object' && body.intent) {
    return body; // v2
  }
  var legacy = body && typeof body === 'object' ? body.mqttSyncStatus : body;
  if (legacy === 'enable' || legacy === 'disable') {
    return {
      schemaVersion: 'legacy',
      intent: legacy === 'enable' ? 'FORCE_ENABLE' : 'FORCE_DISABLE',
      hold: { reasonCode: 'MANUAL_OPS', reason: 'Compat v1 (mqttSyncStatus string)' },
      actor: { system: 'LEGACY' },
      request: { requestId: uuid(), requestedAtMs: nowMs, requestedAt: iso(nowMs) }
    };
  }
  return null;
}

function sweepExpired(holds, nowMs) {
  var removed = [];
  Object.keys(holds).forEach(function (id) {
    var h = holds[id];
    if (h.expiresAtMs && h.expiresAtMs <= nowMs) {
      removed.push(h);
      delete holds[id];
    }
  });
  return removed;
}

function activeHoldsView(holds) {
  return Object.keys(holds).map(function (id) {
    var h = holds[id];
    return {
      holdId: h.holdId, system: h.system, reasonCode: h.reasonCode,
      acquiredAt: h.acquiredAt, expiresAt: h.expiresAtMs ? iso(h.expiresAtMs) : null
    };
  });
}

// ── pipeline ────────────────────────────────────────────────────────────────
var nowMs = Date.now();
var holds = global.get('mqttHolds') || {};
var seen = global.get('mqttSeenReqs') || {};

// STEP 1 entrega em msg.envelope; standalone cai no normalize de msg.payload
var req = msg.envelope || normalizeRequest(msg.payload, nowMs);
if (!req) {
  msg.statusCode = 400;
  msg.payload = { ok: false, errorCode: 'INVALID_PAYLOAD', message: 'Esperado v2 { intent, ... } ou v1 { mqttSyncStatus }' };
  return [msg, null];
}

var intent = String(req.intent || '').toUpperCase();
var actor = req.actor || {};
var rq = req.request || {};
var hold = req.hold || {};
var requestId = rq.requestId || uuid();
var idemKey = rq.idempotencyKey || requestId;
var requestedAtMs = Number(rq.requestedAtMs) || nowMs;

// validação (defensiva — o gate já validou, mas o engine pode rodar sozinho)
var prevStatus = (global.get('mqttSyncStatus') === 'disable') ? 'disable' : 'enable';
var err = null;
if (VALID_INTENTS.indexOf(intent) === -1) err = fail('INVALID_INTENT', 'intent inválido: ' + intent);
else if (actor.system && VALID_SYSTEMS.indexOf(actor.system) === -1) err = fail('INVALID_SYSTEM', 'actor.system inválido: ' + actor.system);
else if ((intent === 'DISABLE' || intent === 'ENABLE') && !hold.holdId) err = fail('MISSING_HOLD_ID', intent + ' requer hold.holdId');

if (err) {
  msg.statusCode = err.httpStatus;
  msg.payload = { ok: false, errorCode: err.errorCode, message: err.message, requestId: requestId };
  return [msg, null];
}

// limpeza preventiva de chaves de idempotência velhas
Object.keys(seen).forEach(function (k) { if (nowMs - seen[k] > SEEN_TTL_MS) delete seen[k]; });

// TTL sweep ANTES de decidir (dead-man switch)
var expired = sweepExpired(holds, nowMs);

var decidedBy = 'HOLD_COUNT';
var changedByThisReq = true;

// idempotência: já vimos este request? → NOOP com estado atual
if (intent !== 'QUERY' && seen[idemKey]) {
  decidedBy = 'NOOP';
  changedByThisReq = false;
} else {
  switch (intent) {
    case 'QUERY':
      decidedBy = 'NOOP';
      changedByThisReq = false;
      break;

    case 'DISABLE': {
      var ttl = clampTtl(hold.ttlSeconds != null ? hold.ttlSeconds : DEFAULT_TTL_SECONDS);
      var existed = !!holds[hold.holdId];
      holds[hold.holdId] = {
        holdId: hold.holdId,
        system: actor.system || 'UNKNOWN',
        reasonCode: hold.reasonCode || 'OTHER',
        reason: hold.reason || null,
        acquiredAt: existed ? holds[hold.holdId].acquiredAt : iso(nowMs),
        acquiredAtMs: existed ? holds[hold.holdId].acquiredAtMs : nowMs,
        expiresAtMs: ttl === 0 ? null : nowMs + ttl * 1000
      };
      seen[idemKey] = nowMs;
      changedByThisReq = !existed; // renovar TTL de um hold já existente não muda effectiveStatus
      break;
    }

    case 'ENABLE': {
      if (holds[hold.holdId]) {
        delete holds[hold.holdId];
        seen[idemKey] = nowMs;
      } else {
        // hold já liberado/expirado → idempotente, não é erro fatal
        decidedBy = 'NOOP';
        changedByThisReq = false;
      }
      break;
    }

    case 'FORCE_DISABLE': {
      holds['manual:force:' + requestId] = {
        holdId: 'manual:force:' + requestId,
        system: actor.system || 'MANUAL',
        reasonCode: hold.reasonCode || 'MANUAL_OPS',
        reason: hold.reason || 'FORCE_DISABLE',
        acquiredAt: iso(nowMs), acquiredAtMs: nowMs,
        expiresAtMs: hold.ttlSeconds != null ? nowMs + clampTtl(hold.ttlSeconds) * 1000 : null
      };
      seen[idemKey] = nowMs;
      decidedBy = 'FORCE';
      break;
    }

    case 'FORCE_ENABLE': {
      holds = {}; // limpa todos os holds
      seen[idemKey] = nowMs;
      decidedBy = 'FORCE';
      break;
    }
  }
}

// effectiveStatus DERIVADO
var holdCount = Object.keys(holds).length;
var effectiveStatus = holdCount > 0 ? 'disable' : 'enable';
if (expired.length && decidedBy === 'HOLD_COUNT' && !changedByThisReq) decidedBy = 'TTL_EXPIRED';
var changed = effectiveStatus !== prevStatus;

// persiste estado
global.set('mqttHolds', holds);
global.set('mqttSeenReqs', seen);
global.set('mqttSyncStatus', effectiveStatus); // cache derivado p/ leitores legados

var lastChange = {
  at: iso(nowMs), by: actor.system || 'UNKNOWN', intent: intent, requestId: requestId
};
if (intent !== 'QUERY') global.set('mqttLastChange', lastChange);

// ── RECORD (append-only) ──────────────────────────────────────────────────────
var record = {
  schemaVersion: req.schemaVersion || '2.0',
  intent: intent,
  hold: req.hold || null,
  scope: req.scope || { level: 'CENTRAL', targets: [] },
  actor: actor,
  request: {
    requestId: requestId,
    correlationId: rq.correlationId || null,
    idempotencyKey: rq.idempotencyKey || null,
    requestedAt: rq.requestedAt || iso(requestedAtMs),
    requestedAtMs: requestedAtMs
  },
  outcome: {
    effectiveStatus: effectiveStatus,
    previousStatus: prevStatus,
    changed: changed,
    decidedBy: decidedBy,
    activeHolds: activeHoldsView(holds),
    holdCount: holdCount,
    expiredHolds: expired.map(function (h) { return h.holdId; }),
    receivedAt: iso(nowMs),
    receivedAtMs: nowMs,
    clockSkewMs: nowMs - requestedAtMs,
    node: { central: CENTRAL, nodeRedVersion: (global.get('nodeRedVersion') || null) }
  },
  logKey: 'mqttSync:' + CENTRAL.id + ':' + requestId
};

// ring buffer de auditoria (consumido pelo GET)
var ring = global.get('mqttAuditLog') || [];
if (intent !== 'QUERY') {
  ring.push(record);
  if (ring.length > AUDIT_RING_MAX) ring = ring.slice(ring.length - AUDIT_RING_MAX);
  global.set('mqttAuditLog', ring);
}

node.warn('[setMqttSyncStatus] ' + intent + ' por ' + (actor.system || '?') +
  ' → ' + effectiveStatus + ' (holds=' + holdCount + ', decidedBy=' + decidedBy +
  (expired.length ? ', expirados=' + expired.length : '') + ')');

node.status({
  fill: effectiveStatus === 'enable' ? 'green' : 'yellow',
  shape: 'dot',
  text: effectiveStatus + ' · holds ' + holdCount
});

// ── RESPONSE (saída 1) ────────────────────────────────────────────────────────
msg.statusCode = 200;
msg.payload = {
  ok: true,
  effectiveStatus: effectiveStatus,
  changed: changed,
  decidedBy: decidedBy,
  holdCount: holdCount,
  expiresAt: (function () {
    // expiração mais próxima entre os holds ativos (p/ o chamador saber quando volta sozinho)
    var next = null;
    Object.keys(holds).forEach(function (id) {
      var e = holds[id].expiresAtMs;
      if (e && (next === null || e < next)) next = e;
    });
    return next ? iso(next) : null;
  })(),
  requestId: requestId,
  correlationId: rq.correlationId || null
};

// saída 1 = response · saída 2 = record p/ persistir/forward (null em QUERY)
var recordMsg = (intent === 'QUERY') ? null : { payload: record, logKey: record.logKey };
return [msg, recordMsg];
