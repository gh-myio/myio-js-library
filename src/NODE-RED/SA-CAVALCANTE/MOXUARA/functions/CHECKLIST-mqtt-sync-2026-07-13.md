# Moxuara — Checklist MQTT Sync (2026-07-13)

Central: **Moxuara 2.0 - ENTRADA - TRAFO** · CENTRAL_UUID `6d7cd66a-c6dd-40df-b40b-e1bad295e424` ·
IPv6 `200:b2d6:a485:7a30:364b:424c:cafa:141c` · banco `hubot`

Estado: slave virtual **criado** (id 3, addr 83/249, nome especializado) via
`../mqtt-sync/create-virtual-mqtt-sync.sql`. Diagnóstico do flow feito sobre o
backup `bkp-bruno-2026-07-13-11-10-Moxuara.json` (tab **Watchdog MQTT Sync** já
existe, com APIs GET/POST completas).

## O que NÃO precisa mudar

- **Functions JS** ("GET From DB MQTT Sync Status", "SET First Time…",
  validates payload, Reconcile Cache, Watchdog Enable): nenhuma tem o nome do
  slave em lógica (só em comentário) — tolerantes ao nome especializado. ✔
- **attributes-sync / status-sync** (nome do device no ThingsBoard): já montam
  `"MQTT Sync - " + env.get('CENTRAL_UUID')` — genéricos. ✔
- Nós `Persist MQTT Status Sync` (2×): usam `SELECT set_mqtt_sync_status($1::jsonb)`
  — a função resolve o slave por `LIKE 'MQTT Sync%'`. ✔

## O que PRECISA ser feito

1. **Aplicar as functions PG no banco** (o restore de hoje pode não tê-las
   trazido). Verificar e aplicar:
   ```bash
   psql -X -U hubot -d hubot -c '\df *mqtt*'
   # se vazio:
   psql -X -U hubot -d hubot -f get_mqtt_sync_status.sql
   psql -X -U hubot -d hubot -f set_mqtt_sync_status.sql   # (../mqtt-sync/)
   ```

2. **Corrigir 1 nó postgresql no flow** — o nó **"GET MQTT Status Sync"**
   (node id `a88cbd58.3da718`, tab **APIs**, grupo *API /GET/mqttSyncStatus*)
   tem query inline com **`WHERE name = 'MQTT Sync'` (match exato)** ✗ que não
   encontra o slave especializado → 0 rows → JS cai no default `enable`
   silenciosamente. (A variante da tab Watchdog já usa a função ✔.)
   Colar no nó a query de `prod/API/GET-MqttSyncStatus/GET-MQTT-Status-Sync.sql`
   (já ajustada, 2026-07-13): `SELECT get_mqtt_sync_status() AS mqtt_sync_status;`

3. **Confirmar a env `CENTRAL_UUID`** no Node-RED da central (é ela que nomeia
   o device no ThingsBoard):
   ```bash
   grep -r 'CENTRAL_UUID' /usr/lib/node_modules/API/nodered_data/settings.js /etc/default/ 2>/dev/null
   # esperado: 6d7cd66a-c6dd-40df-b40b-e1bad295e424
   ```

## Testes de aceite (na central)

```bash
# GET — deve devolver enable (default gravado on-miss pela função)
curl -s http://127.0.0.1:8080/api/mqttSyncStatus

# SET disable → GET confirma → SET enable de volta
curl -s -X POST http://127.0.0.1:8080/api/setMqttSyncStatus \
  -H 'Content-Type: application/json' -d '{"mqttSyncStatus":"disable"}'
curl -s http://127.0.0.1:8080/api/mqttSyncStatus

# Auditoria + persistência no banco
psql -X -U hubot -d hubot -c "SELECT config::jsonb->>'mqttSyncStatus' FROM slaves WHERE id=3;"
psql -X -U hubot -d hubot -c "SELECT * FROM logs WHERE type='mqtt_sync' ORDER BY timestamp DESC LIMIT 3;"
```

No ThingsBoard: conferir device **`MQTT Sync - 6d7cd66a-c6dd-40df-b40b-e1bad295e424`**
criado pelo gateway após o attributes/status-sync rodar.
