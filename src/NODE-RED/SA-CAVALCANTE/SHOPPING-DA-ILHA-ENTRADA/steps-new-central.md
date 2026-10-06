# Setup MQTT Sync — Shopping da Ilha ENTRADA (Sá Cavalcante)

> Runbook especializado a partir de
> [`SOUL-MALLS/CAPIM-DOURADO/steps-new-central.md`](../../SOUL-MALLS/CAPIM-DOURADO/steps-new-central.md)
> e do template canônico [`CENTRAL_PRE_SETUP/mqtt-sync/`](../../CENTRAL_PRE_SETUP/mqtt-sync/).
> Aqui os comandos já vêm com o IPv6/UUID desta central.
>
> | Campo | Valor |
> |---|---|
> | Central | Central Shopping da Ilha - ENTRADA - 2026-10-06 (medição de entrada de energia do SDI) |
> | Central ID / Frequência | `54.17.161.225` / `83` |
> | Holding | Sá Cavalcante |
> | IPv6 (mesh Yggdrasil) | `200:f095:bb4:4e43:62ca:fbae:b36e:a2aa` |
> | CENTRAL_UUID / Gateway ID | `e89e15f2-4dac-4fdb-b62f-a7e49a7a8127` |
> | Banco | `hubot` (PostgreSQL local na central) |
> | Node-RED | embarcado no `myio-api.service` — editor `/red`, porta `8080` |
>
> Fonte da identificação: [`GLOBAL_INFO/manual-centrais-linix-orangepi.md`](../../GLOBAL_INFO/manual-centrais-linix-orangepi.md).

> 🟠 **Central NOVA** (instalada em 2026-10-06 para a medição de entrada de energia
> do SDI — ver ED-1320). Mesmo assim, trate o banco como vivo: os passos abaixo só
> **instalam functions**, gravam o `environment` e criam o device virtual — o
> `02-clear-all-data-central.sql` é apenas o **instalador** da function
> (`CREATE OR REPLACE FUNCTION`), seguro; **não** execute
> `SELECT clear_all_data_central()` sem confirmar antes que o banco está vazio.

> 🔒 Execução via SSH nas centrais é **estritamente do Líder Técnico**.

Pré-requisitos: chave `id_rsa`; kit `mqtt-sync/` desta pasta (arquivos numerados
`00`–`04` na ordem de uso — `00` é o único que grava dados);
`node-red-contrib-myio-data-fetcher-1.7.2.tgz` no workstation (passo 5).

---

## 1. Acesso

```bash
ssh -i id_rsa root@200:f095:bb4:4e43:62ca:fbae:b36e:a2aa
```

## 2. Levar os SQLs para a central

Do workstation (repare nos colchetes do IPv6 no `scp`):

```bash
scp -i id_rsa -r src/NODE-RED/SA-CAVALCANTE/SHOPPING-DA-ILHA-ENTRADA/mqtt-sync \
  "root@[200:f095:bb4:4e43:62ca:fbae:b36e:a2aa]:/tmp/mqtt-sync"
```

> ⚠️ Arquivos vindos de checkout Windows podem ter CRLF — já na central:
> `sed -i 's/\r$//' /tmp/mqtt-sync/*.sql`

## 3. Banco — instalar FUNCTIONS primeiro (01–04), DADOS por último (00)

```bash
psql -U hubot   # db default = hubot
```

> ⚠️ **NUNCA rode no psql os .sql de `functions/prod/API/...`** de outras pastas —
> aqueles são as queries dos NÓS do Node-RED (`SELECT clear_all_data_central()`
> etc.). Os arquivos deste kit são INSTALADORES (`CREATE OR REPLACE FUNCTION` —
> seguros e idempotentes), exceto o `00`, que grava dados.

```sql
-- 3.1 Functions do state-api (instaladores)
\i /tmp/mqtt-sync/01-provision-central-v5.sql
\i /tmp/mqtt-sync/02-clear-all-data-central.sql

-- 3.2 Functions do MQTT Sync (instaladores; LIKE 'MQTT Sync%' — funcionam com
--     nome legado E especializado)
\i /tmp/mqtt-sync/03-get_mqtt_sync_status.sql
\i /tmp/mqtt-sync/04-set_mqtt_sync_status.sql

-- 3.2.1 ENVIRONMENT — Central ID e frequência desta central.
--     Confira primeiro o que já existe (pode ter vindo da imagem):
SELECT key, value FROM environment WHERE key IN ('CENTRAL_ID', 'FREQUENCY');
--     Se faltar ou divergir de 54.17.161.225 / 83, grave pelo provision_central
--     (v5.4: payload.environment[] faz upsert por chave; sem devices[] não mexe
--     em slaves/channels):
SELECT provision_central('{
  "environment": [
    { "key": "CENTRAL_ID", "value": "54.17.161.225" },
    { "key": "FREQUENCY",  "value": "83" }
  ]
}'::jsonb);
SELECT key, value FROM environment WHERE key IN ('CENTRAL_ID', 'FREQUENCY');

-- 3.3 VERIFICAÇÃO antes do create (banco vivo — o MQTT Sync pode já existir;
--     nesse caso é RENAME, não create — ver cabeçalho do 00):
SELECT 'slave' AS obj, id, name FROM slaves   WHERE name ILIKE '%mqtt%sync%'
UNION ALL
SELECT 'channel', id, name      FROM channels WHERE name ILIKE '%mqtt%sync%'
UNION ALL
SELECT 'ambient', id, name      FROM ambients WHERE name ILIKE '%mqtt%sync%';

-- 3.4 ÚNICO script que grava DADOS (slave/channel/ambient virtuais; guarda
--     anti-duplicata aborta se já existir). Já vem com o nome especializado
--     'MQTT Sync - e89e15f2-4dac-4fdb-b62f-a7e49a7a8127' e addr_low dinâmico.
\i /tmp/mqtt-sync/00-create-virtual-mqtt-sync.sql

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

No editor (`http://[200:f095:bb4:4e43:62ca:fbae:b36e:a2aa]:8080/red`) → menu →
**Manage Palette → Install → upload** do
`node-red-contrib-myio-data-fetcher-1.7.2.tgz` (upload é feito do browser do
workstation). Não precisa restart — só Deploy quando mexer no flow.

## 6. Flow — conferências obrigatórias

1. **env `CENTRAL_UUID` = `e89e15f2-4dac-4fdb-b62f-a7e49a7a8127`** definida no
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
`MQTT Sync - e89e15f2-4dac-4fdb-b62f-a7e49a7a8127` criado pelo gateway após o
attributes/status-sync rodar.

---

### Referências

- Kit desta central: [`mqtt-sync/`](mqtt-sync/) — `00-create-virtual-mqtt-sync.sql`
  (especializado; único que grava dados), `01-provision-central-v5.sql`,
  `02-clear-all-data-central.sql`, `03-get_mqtt_sync_status.sql`,
  `04-set_mqtt_sync_status.sql`
- Template canônico: [`CENTRAL_PRE_SETUP/mqtt-sync/`](../../CENTRAL_PRE_SETUP/mqtt-sync/) + [`CENTRAL_PRE_SETUP/README.md`](../../CENTRAL_PRE_SETUP/README.md)
- Manual das centrais (SSH, Node-RED, Postgres, backup): [`GLOBAL_INFO/manual-centrais-linix-orangepi.md`](../../GLOBAL_INFO/manual-centrais-linix-orangepi.md)
