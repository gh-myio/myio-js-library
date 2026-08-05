# Setup de central nova — state-api + MQTT Sync + contribs

> Runbook validado na **Moxuara 2.0 ENTRADA-TRAFO (Sá Cavalcante)** em
> 2026-07-13. Exemplos usam os dados dela; troque IPv6/UUID pela central alvo
> (fonte: `GLOBAL_INFO/manual-centrais-linix-orangepi.md`).
>
> | Central | IPv6 (Yggdrasil) | CENTRAL_UUID |
> |---|---|---|
> | Moxuara 2.0 ENTRADA-TRAFO (2026-07-13) — **validada** | `200:b2d6:a485:7a30:364b:424c:cafa:141c` | `6d7cd66a-c6dd-40df-b40b-e1bad295e424` |
> | Moxuara 2.0 (2026-07-13) | `201:bc00:2a0e:6e36:a50f:9ef6:9b23:d097` | `6e88d9be-e351-4a8a-aa02-2a2222fcb22b` |

Pré-requisitos: central disponível com IPv6 + UUID; chave `id_rsa`; arquivos dos
repositórios `myio-js-library-PROD.git` (kit `mqtt-sync/`) e
`data-ingestion-prod.git` (`src/NODE-RED/state-api/`).

---

## 1. Acesso

```bash
ssh -i id_rsa root@200:b2d6:a485:7a30:364b:424c:cafa:141c
```

## 2. Levar os SQLs para a central

Do workstation (repare nos colchetes do IPv6 no scp):

```bash
scp -i id_rsa -r src/NODE-RED/SA-CAVALCANTE/MOXUARA/mqtt-sync \
  "root@[200:b2d6:a485:7a30:364b:424c:cafa:141c]:/tmp/mqtt-sync"
scp -i id_rsa \
  ../data-ingestion-prod.git/src/NODE-RED/state-api/provision-central-v5.sql \
  ../data-ingestion-prod.git/src/NODE-RED/state-api/clear-all-data-central.sql \
  "root@[200:b2d6:a485:7a30:364b:424c:cafa:141c]:/tmp/"
```

> ⚠️ Arquivos vindos de checkout Windows podem ter CRLF:
> `sed -i 's/\r$//' /tmp/*.sql /tmp/mqtt-sync/*.sql`

## 3. Banco — instalar FUNCTIONS primeiro, DADOS por último

```bash
psql -U hubot   # db default = hubot
```

> ⚠️ **NUNCA rode no psql os .sql de `functions/prod/API/...`** — aqueles são as
> queries dos NÓS do Node-RED (`SELECT clear_all_data_central()` etc.); o do
> POST-ClearAllData **APAGA os dados da central**. Os arquivos abaixo são os
> INSTALADORES (`CREATE OR REPLACE FUNCTION` — seguros e idempotentes).

```sql
-- 3.1 Functions do state-api (instaladores)
\i /tmp/provision-central-v5.sql
\i /tmp/clear-all-data-central.sql

-- 3.2 Functions do MQTT Sync (instaladores; LIKE 'MQTT Sync%' — funcionam com
--     nome legado E especializado)
\i /tmp/mqtt-sync/get_mqtt_sync_status.sql
\i /tmp/mqtt-sync/set_mqtt_sync_status.sql

-- 3.3 VERIFICAÇÃO antes do create (essencial em banco restaurado de backup —
--     o MQTT Sync pode já existir; nesse caso é RENAME, não create — ver
--     cabeçalho do create-virtual-mqtt-sync-<central>.sql):
SELECT 'slave' AS obj, id, name FROM slaves   WHERE name ILIKE '%mqtt%sync%'
UNION ALL
SELECT 'channel', id, name      FROM channels WHERE name ILIKE '%mqtt%sync%'
UNION ALL
SELECT 'ambient', id, name      FROM ambients WHERE name ILIKE '%mqtt%sync%';

-- 3.4 ÚNICO script que grava DADOS (slave/channel/ambient virtuais; tem guarda
--     anti-duplicata que aborta se já existir). Use a versão ESPECIALIZADA da
--     central (nome 'MQTT Sync - <CENTRAL_UUID>', addr_low dinâmico). A Moxuara
--     2.0 tem uma por central: -geral (6e88d9be…) e -entrada-trafo (6d7cd66a…):
\i /tmp/mqtt-sync/create-virtual-mqtt-sync-entrada-trafo.sql   -- ou -geral, conforme a central

-- 3.5 Conferências
\df *mqtt*
\df provision_central
\df clear_all_data_central
SELECT id, name, addr_low FROM slaves WHERE name LIKE 'MQTT Sync%';
```

## 4. Contribs do Node-RED (pins VALIDADOS — não subir versão sem testar; Node antigo)

**Antes**: confirme o userDir ativo — varia por central
(`/data/node-red` × `/usr/lib/node_modules/API/nodered_data/`):

```bash
ps aux | grep -i node-red | grep -o -- '--userDir[= ][^ ]*' || \
  grep -n 'userDir' /usr/lib/node_modules/API/nodered_data/settings.js 2>/dev/null
```

Instale NO userDir ativo (exemplo com `/data/node-red`; cache fora do rootfs):

```bash
mkdir -p /data/nodecache/.npm
cd /data/node-red && HOME=/data/nodecache NPM_CONFIG_CACHE=/data/nodecache/.npm \
  npm install --no-audit --no-update-notifier --no-fund --production --save-exact pg@8.13.3
cd /data/node-red && HOME=/data/nodecache NPM_CONFIG_CACHE=/data/nodecache/.npm \
  npm install --no-audit --no-update-notifier --no-fund --production node-red-contrib-postgresql@0.14.2

systemctl restart myio-api.service
```

## 5. Palette — data-fetcher

No editor (`http://[IPV6]:8080/red`) → menu → **Manage Palette → Install →
upload** do `node-red-contrib-myio-data-fetcher-1.7.2.tgz` (upload é feito do
browser do workstation). Não precisa restart — só Deploy quando mexer no flow.

## 6. Flow — conferências obrigatórias

1. **env `CENTRAL_UUID`** definida no ambiente do serviço (é ela que nomeia o
   device no ThingsBoard: `MQTT Sync - <CENTRAL_UUID>`, via
   attributes-sync/status-sync):
   ```bash
   grep -rn 'CENTRAL_UUID' /usr/lib/node_modules/API/nodered_data/settings.js /etc/default/ 2>/dev/null
   systemctl show myio-api.service -p Environment
   ```
2. **Nó `GET MQTT Status Sync`** (tab **APIs**, grupo *API /GET/mqttSyncStatus*):
   se o flow importado for anterior a 2026-07-13, ele tem query inline
   `WHERE name = 'MQTT Sync'` (match EXATO — não acha o nome especializado).
   Trocar pela query de `functions/prod/API/GET-MqttSyncStatus/GET-MQTT-Status-Sync.sql`:
   `SELECT get_mqtt_sync_status() AS mqtt_sync_status;` → Deploy.

## 7. Testes de aceite

```bash
# GET — 'enable' (a função grava o default no slave na 1ª chamada)
curl -s http://127.0.0.1:8080/api/mqttSyncStatus

# SET disable → GET confirma → volta para enable
curl -s -X POST http://127.0.0.1:8080/api/setMqttSyncStatus \
  -H 'Content-Type: application/json' -d '{"mqttSyncStatus":"disable"}'
curl -s http://127.0.0.1:8080/api/mqttSyncStatus
curl -s -X POST http://127.0.0.1:8080/api/setMqttSyncStatus \
  -H 'Content-Type: application/json' -d '{"mqttSyncStatus":"enable"}'

# Persistência + auditoria
psql -X -U hubot -c "SELECT config::jsonb->>'mqttSyncStatus' FROM slaves WHERE name LIKE 'MQTT Sync%';"
psql -X -U hubot -c "SELECT * FROM logs WHERE type='mqtt_sync' ORDER BY timestamp DESC LIMIT 3;"

# Logs ao vivo dos serviços
journalctl -u 'myio*' -n 50 -f
```

No **ThingsBoard**: conferir o device `MQTT Sync - <CENTRAL_UUID>` criado pelo
gateway após o attributes/status-sync rodar.

---

### Referências
- Kit MQTT Sync (create especializado + get/set): `SA-CAVALCANTE/MOXUARA/mqtt-sync/`
  (padrão novo — origem `CENTRAL_PRE_SETUP/mqtt-sync/`, 2026-07-08)
- state-api (provision/clear + flow): `data-ingestion-prod.git/src/NODE-RED/state-api/`
- Checklist da aplicação na Moxuara: `functions/CHECKLIST-mqtt-sync-2026-07-13.md`
- Restore de banco de backup S3: `GLOBAL_INFO/restore-hubot-backup.sh`
