# Setup da central — Shopping Capim Dourado (Soul Malls)

> Runbook especializado a partir de
> [`SA-CAVALCANTE/MOXUARA/steps-new-central.md`](../../SA-CAVALCANTE/MOXUARA/steps-new-central.md)
> (validado na Moxuara 2.0 ENTRADA-TRAFO em 2026-07-13). Aqui os comandos já
> vêm com o IPv6/UUID desta central.
>
> | Campo | Valor |
> |---|---|
> | Central | Shopping Capim Dourado |
> | Holding | Soul Malls |
> | IPv6 (mesh Yggdrasil) | `200:1e47:5d5e:d011:a88c:6f1b:fda2:622d` |
> | CENTRAL_UUID / Gateway ID | `988433ae-88c1-49b1-b43b-e08592ae3005` |
> | Banco | `hubot` (PostgreSQL local na central) |
> | Node-RED | embarcado no `myio-api.service` — editor `/red`, porta `8080` |
>
> Fonte da identificação: [`GLOBAL_INFO/manual-centrais-linix-orangepi.md`](../../GLOBAL_INFO/manual-centrais-linix-orangepi.md).

**Diferença em relação ao runbook da Moxuara:** o kit `mqtt-sync/` desta pasta já
inclui os SQLs do state-api (`provision-central-v5.sql`, `clear-all-data-central.sql`),
então **não** é preciso buscá-los no `data-ingestion-prod.git`.

Pré-requisitos: chave `id_rsa`; kit `mqtt-sync/` desta pasta;
`node-red-contrib-myio-data-fetcher-1.7.2.tgz` no workstation (passo 5).

---

## 1. Acesso

```bash
ssh -i id_rsa root@200:1e47:5d5e:d011:a88c:6f1b:fda2:622d
```

## 2. Levar os SQLs para a central

Do workstation (repare nos colchetes do IPv6 no `scp`):

```bash
scp -i id_rsa -r src/NODE-RED/SOUL-MALLS/CAPIM-DOURADO/mqtt-sync \
  "root@[200:1e47:5d5e:d011:a88c:6f1b:fda2:622d]:/tmp/mqtt-sync"
```

> ⚠️ Arquivos vindos de checkout Windows podem ter CRLF — já na central:
> `sed -i 's/\r$//' /tmp/mqtt-sync/*.sql`

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
\i /tmp/mqtt-sync/provision-central-v5.sql
\i /tmp/mqtt-sync/clear-all-data-central.sql

-- 3.2 Functions do MQTT Sync (instaladores; LIKE 'MQTT Sync%' — funcionam com
--     nome legado E especializado)
\i /tmp/mqtt-sync/get_mqtt_sync_status.sql
\i /tmp/mqtt-sync/set_mqtt_sync_status.sql

-- 3.3 VERIFICAÇÃO antes do create (essencial em banco restaurado de backup —
--     o MQTT Sync pode já existir; nesse caso é RENAME, não create — ver
--     cabeçalho do create-virtual-mqtt-sync.sql):
SELECT 'slave' AS obj, id, name FROM slaves   WHERE name ILIKE '%mqtt%sync%'
UNION ALL
SELECT 'channel', id, name      FROM channels WHERE name ILIKE '%mqtt%sync%'
UNION ALL
SELECT 'ambient', id, name      FROM ambients WHERE name ILIKE '%mqtt%sync%';

-- 3.4 ÚNICO script que grava DADOS (slave/channel/ambient virtuais; tem guarda
--     anti-duplicata que aborta se já existir). Já vem com o nome especializado
--     'MQTT Sync - 988433ae-88c1-49b1-b43b-e08592ae3005' e addr_low dinâmico.
\i /tmp/mqtt-sync/create-virtual-mqtt-sync.sql

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

No editor (`http://[200:1e47:5d5e:d011:a88c:6f1b:fda2:622d]:8080/red`) → menu →
**Manage Palette → Install → upload** do
`node-red-contrib-myio-data-fetcher-1.7.2.tgz` (upload é feito do browser do
workstation). Não precisa restart — só Deploy quando mexer no flow.

## 6. Flow — conferências obrigatórias

1. **env `CENTRAL_UUID` = `988433ae-88c1-49b1-b43b-e08592ae3005`** definida no
   ambiente do serviço (é ela que nomeia o device no ThingsBoard:
   `MQTT Sync - <CENTRAL_UUID>`, via attributes-sync/status-sync):
   ```bash
   grep -rn 'CENTRAL_UUID' /usr/lib/node_modules/API/nodered_data/settings.js /etc/default/ 2>/dev/null
   systemctl show myio-api.service -p Environment
   ```
   ⚠️ Se o valor divergir do UUID acima, o device criado no TB não bate com o
   nome gravado no banco pelo passo 3.4.
2. **Nó `GET MQTT Status Sync`** (tab **APIs**, grupo *API /GET/mqttSyncStatus*):
   se o flow importado for anterior a 2026-07-13, ele tem query inline
   `WHERE name = 'MQTT Sync'` (match EXATO — não acha o nome especializado).
   Trocar por `SELECT get_mqtt_sync_status() AS mqtt_sync_status;` → Deploy.

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

No **ThingsBoard**: conferir o device
`MQTT Sync - 988433ae-88c1-49b1-b43b-e08592ae3005` criado pelo gateway após o
attributes/status-sync rodar.

---

### Referências

- Kit desta central: [`mqtt-sync/`](mqtt-sync/) — `create-virtual-mqtt-sync.sql`
  (especializado), `get_mqtt_sync_status.sql`, `set_mqtt_sync_status.sql`,
  `provision-central-v5.sql`, `clear-all-data-central.sql`
- Runbook de origem: [`SA-CAVALCANTE/MOXUARA/steps-new-central.md`](../../SA-CAVALCANTE/MOXUARA/steps-new-central.md)
- Referência canônica de nomenclatura + functions JS de sync: [`CENTRAL_PRE_SETUP/README.md`](../../CENTRAL_PRE_SETUP/README.md)
- Manual das centrais (SSH, Node-RED, Postgres, backup): [`GLOBAL_INFO/manual-centrais-linix-orangepi.md`](../../GLOBAL_INFO/manual-centrais-linix-orangepi.md)
- Restore de banco de backup S3: [`GLOBAL_INFO/restore-hubot-backup.sh`](../../GLOBAL_INFO/restore-hubot-backup.sh)
