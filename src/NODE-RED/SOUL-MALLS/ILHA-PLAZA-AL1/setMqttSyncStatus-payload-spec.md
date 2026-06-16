# `setMqttSyncStatus` — Payload de Autoria/Auditoria (proposta robusta)

Central: **Ilha Plaza AL1** (Soul Malls) · Gateway `81a60176-222c-4bb9-88f5-bc2b47802d82`
Endpoint: `POST /api/setMqttSyncStatus` · GET `/api/mqttSyncStatus`

> Estado da arte hoje (`functions/API-POST-setMqttSyncStatus.js`):
> `global.set('mqttSyncStatus', msg.payload.mqttSyncStatus)` — string `enable|disable`,
> em memória, **last-writer-wins**, sem auditoria, sem persistência, sem TTL.

---

## 1. Crítica do payload proposto (o que melhorar)

O payload que você esboçou já acerta o essencial (action, user, source, timestamps), mas:

| # | Ponto | Problema | Correção |
|---|-------|----------|----------|
| 1 | **Redundância** | `status` (top) = `audit.logData.status`; `previousStatus`/`newStatus` aparecem em `logData` **e** em `context`; `changed` é derivável | Separar 3 documentos distintos: **request** (intenção do cliente), **record** (o que o NR persiste, com o resultado computado) e **response** (eco para o chamador). `previousStatus`/`changed`/`effectiveStatus` são **resultado do servidor**, não pertencem ao request. |
| 2 | **`logKey` só com timestamp** | Dois sistemas disparando no mesmo ms → colisão de chave; sem rastreabilidade | `requestId` (UUID por operação) + `correlationId` (UUID compartilhado entre o par disable→enable). `logKey = mqttSync:<centralId>:<requestId>`. |
| 3 | **Sem motivo** | Auditoria sem o "porquê" é metade de uma auditoria | `reasonCode` (enum) + `reason` (texto livre). Ex.: `DEVICE_PROVISIONING`, `FIRMWARE_UPDATE`, `MAINTENANCE_WINDOW`, `ALARM_STORM_MITIGATION`, `MANUAL_OPS`. |
| 4 | **Sem dead-man switch** ⚠️ | Sistema desabilita o MQTT e **morre/trava** → MQTT fica desligado para sempre | `ttlSeconds` + `expiresAt`: o hold expira sozinho e o MQTT volta. **O item mais importante para confiabilidade.** |
| 5 | **Concorrência (o killer)** ⚠️⚠️ | GCDR pausa p/ provisionar **e** Alarmes pausa por outra razão. GCDR reabilita → MQTT volta enquanto Alarmes ainda precisava pausado. Boolean global = corrupção silenciosa | **Reference counting / holds nomeados.** Cada sistema *adquire* um hold; MQTT só fica `enable` quando **zero holds** ativos. Resume libera **apenas o hold daquele dono**. |
| 6 | **Sem escopo** | É a central toda? um gateway? um device? | `scope: { level: CENTRAL\|GATEWAY\|DEVICE, targets: [...] }`. |
| 7 | **Sem versão de schema** | Evolução quebra consumidores | `schemaVersion`. |
| 8 | **Ator pobre p/ multi-sistema** | `user` sem papel; sistema agindo por um usuário não é representável | `actor.system` (enum) + `instanceId` + `version` + `user` + `onBehalfOf` + `requestIp`. |
| 9 | **Clock skew** | Só o relógio do cliente; centrais OrangePi têm relógio sujeito a drift | `requestedAt` (cliente) **e** `receivedAt` (servidor) → `clockSkewMs` calculável. |
| 10 | **Persistência** | `global.set` morre no restart do Node-RED | Persistir o record (contextStore em disco, Postgres `state` JSON, ou forward p/ GCDR). |

**Veredito:** o formato está "ok" para um log simples, mas para **múltiplos sistemas (GCDR/Alarmes/ThingsBoard/App) ligando e desligando o MQTT** ele tem dois furos graves: **last-writer-wins** (item 5) e **sem auto-recuperação** (item 4). A proposta abaixo resolve ambos com o modelo de **holds com TTL**.

---

## 2. Modelo conceitual: holds com reference counting + TTL

```
MQTT habilitado  ⟺  nenhum hold ativo
MQTT pausado     ⟺  ≥ 1 hold ativo

DISABLE = ACQUIRE_HOLD(holdId, ttl)   → adiciona hold ao conjunto
ENABLE  = RELEASE_HOLD(holdId)        → remove aquele hold; MQTT só volta se o conjunto esvaziar
expiração de TTL                      → hold removido automaticamente (dead-man switch)
FORCE_* = override manual (ops)       → ignora/limpa holds, sempre auditado
```

`effectiveStatus` é **derivado**, nunca enviado pelo cliente. O servidor decide e ecoa o motivo em `decidedBy`.

---

## 3. Schema — REQUEST (o que cada sistema envia)

```json
{
  "schemaVersion": "2.0",
  "intent": "DISABLE",
  "hold": {
    "holdId": "gcdr:provisioning:6f1c2b9a-3d44-4f0e-9a17-2b8e5c0d9f21",
    "ttlSeconds": 900,
    "reasonCode": "DEVICE_PROVISIONING",
    "reason": "Sincronizando 12 novos hidrômetros via PRE_SETUP"
  },
  "scope": {
    "level": "CENTRAL",
    "targets": []
  },
  "actor": {
    "system": "PRE_SETUP",
    "instanceId": "presetup-prod-7c9",
    "version": "2.4.1",
    "user": {
      "userId": "784f394c-42b6-435a-983c-b7beff2784f9",
      "userName": "victor@exemplo.com",
      "role": "ops"
    },
    "onBehalfOf": null,
    "requestIp": "10.0.0.5"
  },
  "request": {
    "requestId": "a1d3e7f0-9c22-4b58-bf0e-1e2d3c4b5a69",
    "correlationId": "c0rr3l4t-1on0-uuid-shared-disable-enable",
    "idempotencyKey": "gcdr:provisioning:batch-2026-06-16T19:00",
    "requestedAt": "2026-06-16T19:00:00.000Z",
    "requestedAtMs": 1750100400000
  }
}
```

### Campos

| Campo | Tipo | Obrigatório | Notas |
|-------|------|:----:|------|
| `schemaVersion` | string | ✓ | `"2.0"` |
| `intent` | enum | ✓ | `DISABLE` (=acquire hold) · `ENABLE` (=release hold) · `FORCE_DISABLE` · `FORCE_ENABLE` · `QUERY` |
| `hold.holdId` | string | ✓ p/ DISABLE/ENABLE | Convenção `<system>:<reasonCode>:<uuid>`. **O ENABLE deve usar o mesmo `holdId` do DISABLE** para liberar o hold certo. |
| `hold.ttlSeconds` | int | ✓ p/ DISABLE | Dead-man switch. Sugestão: 300–1800. `0` = sem expiração (desencorajado). |
| `hold.reasonCode` | enum | ✓ | `DEVICE_PROVISIONING` · `FIRMWARE_UPDATE` · `MAINTENANCE_WINDOW` · `ALARM_STORM_MITIGATION` · `CONFIG_SYNC` · `MANUAL_OPS` · `OTHER` |
| `hold.reason` | string | ○ | Texto livre p/ humanos. |
| `scope.level` | enum | ✓ | `CENTRAL` · `GATEWAY` · `DEVICE` |
| `scope.targets` | string[] | ○ | IDs quando level≠CENTRAL. |
| `actor.system` | enum | ✓ | `GCDR` · `ALARMS` · `THINGSBOARD` · `MOBILE_APP` · `PRE_SETUP` · `MANUAL` |
| `actor.instanceId` | string | ○ | Qual instância/réplica disparou. |
| `actor.version` | string | ○ | Versão do sistema chamador. |
| `actor.user` | object | ○ | `userId`, `userName`, `role`. Ausente em disparo 100% automático. |
| `actor.onBehalfOf` | object\|null | ○ | Sistema agindo por um usuário (ex.: App → GCDR). |
| `actor.requestIp` | string | ○ | Origem. |
| `request.requestId` | uuid | ✓ | Único por operação. Idempotência + chave de log. |
| `request.correlationId` | uuid | ○ | Mesmo nos dois lados do par DISABLE→ENABLE. |
| `request.idempotencyKey` | string | ○ | Retentativa não duplica hold nem log. |
| `request.requestedAt(Ms)` | string/int | ✓ | Relógio do **cliente** (UTC ISO + epoch ms). |

---

## 4. Schema — RECORD (o que o Node-RED persiste/encaminha)

= REQUEST + bloco `outcome` computado no servidor. É **este** documento que vira o log de auditoria (não o request cru).

```json
{
  "schemaVersion": "2.0",
  "intent": "DISABLE",
  "hold": {
    "holdId": "gcdr:provisioning:6f1c2b9a-3d44-4f0e-9a17-2b8e5c0d9f21",
    "ttlSeconds": 900,
    "reasonCode": "DEVICE_PROVISIONING",
    "reason": "Sincronizando 12 novos hidrômetros via PRE_SETUP"
  },
  "actor": { "system": "PRE_SETUP", "instanceId": "presetup-prod-7c9", "version": "2.4.1",
             "user": { "userId": "784f394c-42b6-435a-983c-b7beff2784f9", "userName": "victor@exemplo.com", "role": "ops" } },
  "request": { "requestId": "a1d3e7f0-9c22-4b58-bf0e-1e2d3c4b5a69",
               "correlationId": "c0rr3l4t-1on0-uuid-shared-disable-enable",
               "requestedAt": "2026-06-16T19:00:00.000Z", "requestedAtMs": 1750100400000 },

  "outcome": {
    "effectiveStatus": "disable",
    "previousStatus": "enable",
    "changed": true,
    "decidedBy": "HOLD_COUNT",
    "activeHolds": [
      { "holdId": "gcdr:provisioning:6f1c2b9a-3d44-4f0e-9a17-2b8e5c0d9f21",
        "system": "PRE_SETUP", "reasonCode": "DEVICE_PROVISIONING",
        "acquiredAt": "2026-06-16T19:00:00.020Z", "expiresAt": "2026-06-16T19:15:00.020Z" }
    ],
    "holdCount": 1,
    "receivedAt": "2026-06-16T19:00:00.020Z",
    "receivedAtMs": 1750100400020,
    "clockSkewMs": 20,
    "node": {
      "central": { "id": "ilha-plaza-al1", "name": "Ilha Plaza AL1", "gatewayId": "81a60176-222c-4bb9-88f5-bc2b47802d82" },
      "nodeRedVersion": "1.2.0-beta.1",
      "host": "200:dc42:651b:5ae5:338d:2b26:670d:34e6"
    }
  },

  "logKey": "mqttSync:ilha-plaza-al1:a1d3e7f0-9c22-4b58-bf0e-1e2d3c4b5a69"
}
```

`decidedBy` ∈ `HOLD_COUNT` (modelo normal) · `FORCE` (override manual) · `TTL_EXPIRED` (auto-recuperação) · `NOOP` (idempotente, nada mudou).

---

## 5. Schema — RESPONSE (eco HTTP enxuto)

```json
{
  "ok": true,
  "effectiveStatus": "disable",
  "changed": true,
  "decidedBy": "HOLD_COUNT",
  "holdCount": 1,
  "expiresAt": "2026-06-16T19:15:00.020Z",
  "requestId": "a1d3e7f0-9c22-4b58-bf0e-1e2d3c4b5a69",
  "correlationId": "c0rr3l4t-1on0-uuid-shared-disable-enable"
}
```

Erros: `{ "ok": false, "errorCode": "INVALID_INTENT|MISSING_HOLD_ID|UNKNOWN_HOLD|...", "message": "..." }` com HTTP 4xx.

---

## 6. GET `/api/mqttSyncStatus` — estado rico (compatível)

Mantém compatibilidade retornando a string no topo, mas expõe os holds:

```json
{
  "mqttSyncStatus": "disable",
  "effectiveStatus": "disable",
  "holdCount": 2,
  "activeHolds": [
    { "holdId": "gcdr:provisioning:6f1c...", "system": "PRE_SETUP", "reasonCode": "DEVICE_PROVISIONING", "expiresAt": "2026-06-16T19:15:00Z" },
    { "holdId": "alarms:storm:9a2f...",      "system": "ALARMS",    "reasonCode": "ALARM_STORM_MITIGATION", "expiresAt": "2026-06-16T19:05:00Z" }
  ],
  "lastChange": { "at": "2026-06-16T19:00:00.020Z", "by": "PRE_SETUP", "intent": "DISABLE", "requestId": "a1d3e7f0..." },
  "central": { "id": "ilha-plaza-al1", "gatewayId": "81a60176-222c-4bb9-88f5-bc2b47802d82" }
}
```

> Clientes legados continuam lendo `body.mqttSyncStatus` (string). Novos clientes leem `activeHolds`.

---

## 7. Exemplos por cenário (multi-sistema)

**(a) Alarmes pausa por tempestade de alarmes (TTL curto, automático, sem usuário):**
```json
{ "schemaVersion": "2.0", "intent": "DISABLE",
  "hold": { "holdId": "alarms:storm:9a2f7c10-...", "ttlSeconds": 300, "reasonCode": "ALARM_STORM_MITIGATION",
            "reason": "Suprimindo publish durante reprocesso de fila" },
  "scope": { "level": "CENTRAL", "targets": [] },
  "actor": { "system": "ALARMS", "instanceId": "alarms-api-2", "version": "1.9.0" },
  "request": { "requestId": "...", "correlationId": "...", "requestedAt": "2026-06-16T19:00:00Z", "requestedAtMs": 1750100400000 } }
```

**(b) GCDR reabilita ao terminar o provisionamento (libera só o hold dele):**
```json
{ "schemaVersion": "2.0", "intent": "ENABLE",
  "hold": { "holdId": "gcdr:provisioning:6f1c2b9a-..." },
  "actor": { "system": "GCDR", "instanceId": "gcdr-worker-1" },
  "request": { "requestId": "...", "correlationId": "c0rr3l4t-...(mesmo do disable)", "requestedAt": "2026-06-16T19:12:00Z", "requestedAtMs": 1750101120000 } }
```
→ se o hold do Alarmes ainda estiver ativo, `effectiveStatus` continua `disable`, `decidedBy: HOLD_COUNT`.

**(c) Override manual de operação (App mobile, ops força ENABLE limpando tudo):**
```json
{ "schemaVersion": "2.0", "intent": "FORCE_ENABLE",
  "hold": { "reasonCode": "MANUAL_OPS", "reason": "Liberação manual após validação no local" },
  "actor": { "system": "MOBILE_APP", "version": "5.2.0",
             "user": { "userId": "784f394c-...", "userName": "victor@exemplo.com", "role": "field_ops" },
             "onBehalfOf": null, "requestIp": "10.20.3.8" },
  "request": { "requestId": "...", "requestedAt": "2026-06-16T19:20:00Z", "requestedAtMs": 1750101600000 } }
```
→ `decidedBy: FORCE`, limpa `activeHolds`, registra quem forçou.

---

## 8. Regras de processamento (servidor)

1. Validar `schemaVersion`, `intent`, e (p/ DISABLE/ENABLE) `hold.holdId`.
2. Idempotência: se `requestId`/`idempotencyKey` já processado → responder `NOOP` com o estado atual.
3. `DISABLE` → upsert hold `{holdId, system, reasonCode, acquiredAt, expiresAt = now + ttlSeconds}`.
4. `ENABLE` → remover hold por `holdId`; se inexistente → `UNKNOWN_HOLD` (4xx, mas idempotente-friendly: pode tratar como NOOP).
5. `FORCE_ENABLE` → limpar todos os holds; `FORCE_DISABLE` → marcar hold sentinela `manual:*`.
6. Varredura de TTL: a cada GET/SET (ou timer) remover holds com `expiresAt < now` (`decidedBy: TTL_EXPIRED`).
7. `effectiveStatus = holdCount > 0 ? "disable" : "enable"`.
8. Persistir o **RECORD** (append-only) e atualizar o estado (`global` + contextStore em disco, e/ou Postgres `state` JSON já existente no flow).
9. Encaminhar o RECORD para o coletor central (GCDR) quando houver rede — buffer local quando offline.

---

## 9. Migração a partir do código atual (não-destrutiva)

- O `global.set('mqttSyncStatus', ...)` continua existindo como **cache derivado** de `effectiveStatus` — nada que lê o boolean hoje quebra.
- A function passa a: derivar `effectiveStatus` dos holds, gravar o RECORD, e setar `global.mqttSyncStatus = effectiveStatus`.
- GET legado segue retornando a string; o objeto rico é aditivo.
- Sugestão: aceitar **os dois formatos** no POST por um período — se vier só `{ "mqttSyncStatus": "enable" }` (v1), tratar como `FORCE_ENABLE`/`FORCE_DISABLE` de `actor.system=LEGACY`.

---

### Resumo do "por que mais robusto"
1. **Holds + reference counting** → fim do last-writer-wins entre GCDR/Alarmes/TB/App.
2. **TTL / dead-man switch** → MQTT nunca fica preso desabilitado se um sistema cair.
3. **Request × Record × Response separados** → sem redundância; o resultado é do servidor.
4. **requestId/correlationId/idempotencyKey** → rastreabilidade e retry seguro.
5. **reasonCode + actor rico + clockSkew** → auditoria de verdade, multi-sistema.
6. **Aditivo e retrocompatível** → migra sem quebrar os leitores atuais do boolean.
