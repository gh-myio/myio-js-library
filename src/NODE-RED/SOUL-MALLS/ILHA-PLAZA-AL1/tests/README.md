# Payloads de teste — `POST /api/setMqttSyncStatus`

Central: **Ilha Plaza AL1** (Soul Malls). Todos os arquivos seguem o **envelope v2** da
spec (`../setMqttSyncStatus-payload-spec.md`). Os dois fluxos aceitam o MESMO envelope —
o que muda é COMO cada um interpreta.

```bash
BASE='http://[200:dc42:651b:5ae5:338d:2b26:670d:34e6]:8080'
post(){ curl -sS -X POST "$BASE/api/setMqttSyncStatus" -H 'Content-Type: application/json' -d @"$1"; echo; }
get(){  curl -sS "$BASE/api/mqttSyncStatus"; echo; }
```

## `v3/` — persistência (`set_mqtt_sync_status`)

Modelo **último-intent-vence**: grava `slaves.config.mqttSyncStatus` + audita em `logs`.
Ignora `hold`/`ttlSeconds`/`reasonCode`.

| Arquivo | intent | resultado persistido |
| --- | --- | --- |
| `01-disable.json` | DISABLE | `disable` (log value=0) |
| `02-enable.json` | ENABLE | `enable` (log value=1) |
| `03-force-disable.json` | FORCE_DISABLE | `disable` |
| `04-force-enable.json` | FORCE_ENABLE | `enable` |
| `05-query.json` | QUERY | read-only (não grava, não loga) |

```bash
post v3/01-disable.json   # → {"ok":true,"mqttSyncStatus":"disable",...}
get                       # → "disable"
post v3/02-enable.json    # → {"ok":true,"mqttSyncStatus":"enable",...}
```

## `v2/` — holds + TTL em memória (engine `functions/v2/`)

Modelo **reference-counting**: `effectiveStatus = disable` enquanto houver ≥1 hold ativo.
Rode na ordem — repare que liberar UM hold não reabilita se outro segue ativo.

| # | Arquivo | intent / hold | effectiveStatus esperado |
| --- | --- | --- | --- |
| 1 | `01-disable-gcdr.json` | DISABLE `gcdr:provisioning` (ttl 900) | `disable` (holds=1) |
| 2 | `02-disable-alarms.json` | DISABLE `alarms:storm` (ttl 300) | `disable` (holds=2) |
| 3 | `03-enable-gcdr.json` | ENABLE `gcdr:provisioning` | **`disable`** (holds=1 — alarms ainda ativo) |
| 4 | `04-enable-alarms.json` | ENABLE `alarms:storm` | `enable` (holds=0) ✅ |
| 5 | `05-force-enable.json` | FORCE_ENABLE | `enable` (limpa todos os holds) |
| 6 | `06-query.json` | QUERY | só leitura (com TTL sweep) |

```bash
post v2/01-disable-gcdr.json    # disable (holds=1)
post v2/02-disable-alarms.json  # disable (holds=2)
post v2/03-enable-gcdr.json     # AINDA disable (holds=1)  ← o ponto do modelo de holds
post v2/04-enable-alarms.json   # enable  (holds=0)
post v2/06-query.json           # consulta o estado + activeHolds
```

> A diferença-chave: no **v3** o passo 3 já reabilitaria (último intent), enquanto no **v2**
> permanece `disable` porque o hold do Alarmes continua ativo.
