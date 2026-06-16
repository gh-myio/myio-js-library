/**
 * STEP 3/3 — GET STATUS · GET /api/mqttSyncStatus (TTL sweep on read)
 * Endpoint de leitura (paralelo ao POST): [http in GET] → (3) get-status → [http response]
 *
 * Por que varrer TTL aqui também: holds expiram pelo relógio, não por evento.
 * Se ninguém chama o POST, um hold vencido só seria removido no próximo SET —
 * o GET varrendo garante que o MQTT "volta sozinho" e é observável.
 *
 * Compatibilidade: o corpo retorna `mqttSyncStatus` (string) no topo para
 * leitores legados; os campos ricos (activeHolds, holdCount, ...) são aditivos.
 *
 * 1 saída → http response.
 */

var CENTRAL = { id: 'ilha-plaza-al1', name: 'Ilha Plaza AL1', gatewayId: '81a60176-222c-4bb9-88f5-bc2b47802d82' };

function iso(ms) { return new Date(ms).toISOString(); }

var nowMs = Date.now();
var holds = global.get('mqttHolds') || {};

// TTL sweep (dead-man switch observável no read)
var expired = [];
Object.keys(holds).forEach(function (id) {
  var h = holds[id];
  if (h.expiresAtMs && h.expiresAtMs <= nowMs) {
    expired.push(id);
    delete holds[id];
  }
});

var holdCount = Object.keys(holds).length;
var effectiveStatus = holdCount > 0 ? 'disable' : 'enable';

if (expired.length) {
  global.set('mqttHolds', holds);
  node.warn('[mqttSyncStatus] TTL sweep removeu ' + expired.length + ' hold(s) → ' + effectiveStatus);
}
// mantém o cache derivado em sincronia
global.set('mqttSyncStatus', effectiveStatus);

node.status({
  fill: effectiveStatus === 'enable' ? 'green' : 'yellow',
  shape: 'dot',
  text: effectiveStatus + ' · holds ' + holdCount
});

var activeHolds = Object.keys(holds).map(function (id) {
  var h = holds[id];
  return {
    holdId: h.holdId, system: h.system, reasonCode: h.reasonCode, reason: h.reason || null,
    acquiredAt: h.acquiredAt, expiresAt: h.expiresAtMs ? iso(h.expiresAtMs) : null
  };
});

msg.statusCode = 200;
msg.payload = {
  // legado: clientes antigos leem body.mqttSyncStatus (string)
  mqttSyncStatus: effectiveStatus,
  // rico
  effectiveStatus: effectiveStatus,
  holdCount: holdCount,
  activeHolds: activeHolds,
  expiredNow: expired,
  lastChange: global.get('mqttLastChange') || null,
  central: { id: CENTRAL.id, gatewayId: CENTRAL.gatewayId },
  serverTime: iso(nowMs)
};
return msg;
