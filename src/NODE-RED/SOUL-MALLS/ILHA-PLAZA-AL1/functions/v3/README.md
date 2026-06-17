# mqttSyncStatus v3 — persistência no banco

Central: **Ilha Plaza AL1** (Soul Malls) · Gateway `81a60176-222c-4bb9-88f5-bc2b47802d82`

Diferença para o **v2** (`../v2/`): o v2 mantém holds/TTL em `global` (memória, perde no
restart). O **v3** persiste o estado em `slaves.config.mqttSyncStatus` + auditoria em `logs`,
via as funções plpgsql — sobrevive a restart do Node-RED.

## Flow (`mqttSyncStatus-v3.flows.json`)

```
POST /api/setMqttSyncStatus
   → [function] validate payload        (saída única; marca msg.payload.status)
   → [switch]  payload.status
        ├─ "valid"   → [postgresql] SELECT set_mqtt_sync_status($1::jsonb)
        │              → [function] format return response → [http response]
        └─ (else)    → [http response]   (400, já montado pelo validate)

GET /api/mqttSyncStatus
   → [postgresql] SELECT get_mqtt_sync_status()   (grava 'enable' na 1ª vez)
   → [function] unwrap + set global → [http response]
```

O código dos nós `function` é embutido a partir de (fonte de verdade):
- `../API-POST-setMqttSyncStatus-persist-validate-payload.js`
- `../API-POST-setMqttSyncStatus-persist-format-return-response.js`
- `../API-GET-SYNC-getMqttSyncStatys.js`

## Instalação

1. Criar as funções no banco da central:
   ```bash
   psql -U hubot -f ../set_mqtt_sync_status.sql
   psql -U hubot -f ../get_mqtt_sync_status.sql
   ```
2. (Pré-requisito) o slave virtual `MQTT Sync` deve existir — `../../create-virtual-mqtt-sync.sql`.
3. Importar `mqttSyncStatus-v3.flows.json` no Node-RED (`/red` → Import).
4. Abrir o config node **`hubot (local)`** e apontar host/porta/credenciais do Postgres da central
   (o `password` não vai no JSON — preencher no editor).

## Payloads de teste

`../../setMqttSyncStatus-payload.tests.json` (envelope v2 + forma simples + casos 400).
