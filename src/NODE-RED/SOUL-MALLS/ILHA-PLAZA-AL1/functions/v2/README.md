# `v2/` — functions Node-RED do `mqttSyncStatus` (numeradas por step)

Modelo: holds + TTL (dead-man switch) + record append-only + `global` derivado.
Spec: [`../../setMqttSyncStatus-payload-spec.md`](../../setMqttSyncStatus-payload-spec.md) ·
Diagramas: [`../mqttSyncStatus-flow-diagram.md`](../mqttSyncStatus-flow-diagram.md) ·
[`.html`](../mqttSyncStatus-flow-diagram.html)

## Pipeline

```
POST /api/setMqttSyncStatus
  [http in] → 01-validate-gate → 02-engine-holds-ttl-record → [http response]
                    │ (inválido)              └→ saída 2 → [persistência / forward GCDR]
                    └→ [http response 4xx]

GET /api/mqttSyncStatus
  [http in] → 03-get-status-ttl-sweep → [http response]
```

## Steps

| Step | Arquivo | Saídas | Papel |
|------|---------|:------:|-------|
| 1 | `01-validate-gate.js` | 2 | Valida e normaliza. Válido → `msg.envelope` p/ step 2 (saída 1). Inválido → `400` (saída 2). |
| 2 | `02-engine-holds-ttl-record.js` | 2 | Aplica holds/TTL, deriva `effectiveStatus`, persiste no `global`, monta RECORD. Saída 1 = RESPONSE, saída 2 = RECORD. Consome `msg.envelope`; roda sozinho via fallback `msg.payload`. |
| 3 | `03-get-status-ttl-sweep.js` | 1 | Leitura: varre TTL e devolve estado rico (+ string legada `mqttSyncStatus`). |

## Notas de fiação

- **01 → 02**: o gate passa `msg.envelope` (e `msg.params=[envelope]` caso o step 2 seja um Postgres `set_mqtt_sync_status($1)` em vez da function JS).
- **02 saída 2 → persistência**: ligue num Postgres (coluna `state` JSON) / arquivo / `http request` p/ GCDR. `null` quando `intent=QUERY`.
- **Estado em `global`** é em memória — para sobreviver a restart do Node-RED, configure *contextStore* em disco ou trate o RECORD da saída 2 como fonte de verdade no Postgres.
- Opcional: um `inject` periódico (30–60s) chamando a varredura de TTL garante auto-recuperação mesmo sem tráfego.
