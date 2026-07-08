# CENTRAL PRE-SETUP — OrangePi (referência canônica)

> Central de **pré-setup** — saída "limpa" do Pre-Setup Constructor
> (`src/thingsboard/Pre-Setup-Constructor`). **Não é uma loja em produção**;
> serve de referência canônica de nomenclatura (RFC-0202) e de bancada para
> validar provisionamento/flows antes de ir a campo.

## Identificação

| Campo | Valor |
| --- | --- |
| CENTRAL_UUID (env Node-RED / Gateway ID) | `a77ac87c-addd-4172-a65f-0f6f6038e98e` |
| IPv6 (mesh Yggdrasil) | `204:12fb:5518:d04:d9e1:360d:4ab0:125b` |
| Central ID | `161.158.107.69` |
| Frequência | 121 |
| Banco | `hubot` (PostgreSQL local na central) |
| Node-RED | embarcado no `myio-api.service` — editor em `/red` (porta 8080) |

```bash
# Conexão (sempre com a chave):
ssh -i id_rsa root@204:12fb:5518:d04:d9e1:360d:4ab0:125b
```

## Conteúdo desta pasta

| Arquivo | O quê |
| --- | --- |
| `slaves-map.md` | Mapa canônico dos 45 slaves / 161 channels (nomenclatura RFC-0202) |
| `logDatabase.log` | Dump do banco que originou o slaves-map |
| `attributes-sync.js` | Function ATTRIBUTES-SYNC (devices → TB) — inclui o device virtual **MQTT Sync** com nome `MQTT Sync - <CENTRAL_UUID>` via `env.get('CENTRAL_UUID')` |
| `status-sync.js` | Function Map-status-to-device (status → TB) — idem, nome especializado |
| `transform-slave-outlet-devices.js` | Transform auxiliar de slaves outlet |
| `mqtt-sync/create-virtual-mqtt-sync.sql` | Cria slave/channel/ambient virtuais `MQTT Sync` no Postgres da central (⚠️ conferir addr 200/249 livre antes — ver header) |
| `mqtt-sync/get_mqtt_sync_status.sql` | Function PG `get_mqtt_sync_status()` (write-on-miss, default `enable`) |
| `mqtt-sync/set_mqtt_sync_status.sql` | Function PG `set_mqtt_sync_status(payload)` (persistência + auditoria em `logs`) |
| `state-api-bkp/` | **Cópia de segurança** (2026-07-06) dos SQLs do state-api de `data-ingestion-prod.git/src/NODE-RED/state-api`: `clear-all-data-central.sql`, `get-state.sql`, `provision-central-v5.sql` |

## MQTT Sync — estratégia de nome (importante)

- **Nesta central o nome é especializado NOS DOIS lados**: banco **e**
  ThingsBoard usam **`MQTT Sync - a77ac87c-addd-4172-a65f-0f6f6038e98e`**.
  - No banco: o uuid vai **na mão** no `mqtt-sync/create-virtual-mqtt-sync.sql`
    (slave/channel/ambient já criados com o nome completo).
  - No TB: o gateway monta o mesmo nome via `env.get('CENTRAL_UUID')` nas
    functions `attributes-sync.js` / `status-sync.js`. Evita colisão de
    devices homônimos entre centrais no mesmo tenant.
- **As functions PG** (`get/set_mqtt_sync_status`) buscam com
  **`LIKE 'MQTT Sync%'`** — funcionam com o nome especializado E com o legado
  (`MQTT Sync` das centrais antigas, ex. Ilha Plaza AL1). ⚠️ Pressupõe **um
  único** slave `MQTT Sync%` por central.
- O lookup de `slaveId` no `attributes-sync.js` tenta o nome especializado e
  cai para o legado.
- Origem do padrão: `src/NODE-RED/SOUL-MALLS/ILHA-PLAZA-AL1` (primeira central
  com o kit, ainda com nome legado no banco). Os mesmos SQLs vivem também em
  `data-ingestion-prod.git/src/NODE-RED/state-api/`.

## Checklist de deploy do MQTT Sync nesta central

1. Conferir a env `CENTRAL_UUID` no Node-RED (inject `env.get('CENTRAL_UUID')` → debug deve mostrar `a77ac87c-addd-4172-a65f-0f6f6038e98e`).
2. Rodar `mqtt-sync/create-virtual-mqtt-sync.sql` no `hubot` (validar addr livre antes; conferir os SELECTs do header antes do COMMIT).
3. Rodar `mqtt-sync/get_mqtt_sync_status.sql` e `mqtt-sync/set_mqtt_sync_status.sql` (CREATE OR REPLACE FUNCTION).
4. Colar `attributes-sync.js` e `status-sync.js` nos nós correspondentes do flow e Deploy.
5. Validar no TB: device novo **`MQTT Sync - a77ac87c-addd-4172-a65f-0f6f6038e98e`** com `connectionStatus: online` e `status` refletindo `global.mqttSyncStatus`.
