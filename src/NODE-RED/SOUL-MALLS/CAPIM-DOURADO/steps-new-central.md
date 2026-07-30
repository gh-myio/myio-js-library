# Setup da central — Central Capim Dourado Reserva (Soul Malls)

> Runbook especializado a partir de
> [`SA-CAVALCANTE/MOXUARA/steps-new-central.md`](../../SA-CAVALCANTE/MOXUARA/steps-new-central.md)
> (validado na Moxuara 2.0 ENTRADA-TRAFO em 2026-07-13). Aqui os comandos já
> vêm com o IPv6/UUID desta central.
>
> | Campo | Valor |
> |---|---|
> | Central | Central Capim Dourado Reserva |
> | Holding | Soul Malls |
> | IPv6 (mesh Yggdrasil) | `200:9738:d165:f821:68d3:2852:d822:a748` |
> | CENTRAL_UUID / Gateway ID | `84638207-ac49-4adf-a033-4731dbb920c2` |
> | Banco | `hubot` (PostgreSQL local na central) |
> | Node-RED | embarcado no `myio-api.service` — editor `/red`, porta `8080` |
>
> Fonte da identificação: [`GLOBAL_INFO/manual-centrais-linix-orangepi.md`](../../GLOBAL_INFO/manual-centrais-linix-orangepi.md).
>
> ℹ️ Esta central (**Central Capim Dourado Reserva**) **substitui** a central
> anterior do Capim Dourado (IPv6 `200:1e47:…:622d`, UUID `988433ae-…`),
> **inativada em 2026-07-30**. É uma **central nova de fábrica** — sem
> restauração de banco e sem pré-setup prévio (por isso a seção 0 é
> obrigatória aqui). Ver o par inativada/nova no manual global.

**Diferença em relação ao runbook da Moxuara:** o kit `mqtt-sync/` desta pasta já
inclui os SQLs do state-api (`01-provision-central-v5.sql`, `02-clear-all-data-central.sql`),
então **não** é preciso buscá-los no `data-ingestion-prod.git`.

Pré-requisitos: chave `id_rsa`; kit `mqtt-sync/` desta pasta;
`node-red-contrib-myio-data-fetcher-1.7.2.tgz` no workstation (passo 5).

> 🔒 **Execução restrita ao Líder Técnico.** Atualmente, os passos deste runbook
> executados **diretamente na central via SSH** — rodar os SQLs no `psql`
> (passo 3), instalar os contribs / `systemctl restart` / `reboot` (passo 4) e
> qualquer outra ação no shell da central — são de responsabilidade **estrita
> do Líder Técnico**. Não executar sem essa autorização.

> ⚠️ **Escopo deste runbook**: os passos 1–8 abaixo cobrem só a parte
> "state-api + MQTT Sync + contribs" (espelhando o runbook da Moxuara). O
> bootstrap completo de uma central nova também envolve provisionamento em
> ThingsBoard/GCDR/Ingestion e trabalho físico de fiação — isso está coberto
> na nova **seção 0**, escrita a partir de notas de campo porque **não há,
> em nenhum outro lugar do repo, um runbook prévio para essa parte** (só
> referências parciais/soltas, linkadas abaixo). Os subitens marcados
> "⏳ a confirmar" dependem de UI externa (ThingsBoard/GCDR/Ingestion) ainda
> não documentada — ao contrário do restante deste doc (que segue o runbook
> validado na Moxuara em 2026-07-13), eles não foram validados em campo.

---

## 0. Provisionamento prévio (ThingsBoard, GCDR, Ingestion)

> Fazer **antes** de mexer fisicamente na central. Ordem sugerida com base em
> notas de campo do setup da Capim Dourado.

### 0.1 Baseline do flow — exportar de uma central boa e preparar import

Exportar o flow do Node-RED de uma central de referência já validada (ex.:
"G0") para usar como ponto de partida na central nova, em vez de montar o
flow do zero.

Convenção de export/import (3 abas: Flow, Config nodes, Credentials) e
rollback via reimport: ver
[`OBRAMAX/README.md`](../../OBRAMAX/README.md) §2 e
[`SA-CAVALCANTE/MESTRE-ALVARO-L2AC/PLAN-replicate-nodes-to-centrals.md`](../../SA-CAVALCANTE/MESTRE-ALVARO-L2AC/PLAN-replicate-nodes-to-centrals.md) §4.

### 0.2 ThingsBoard — criar Gateway + Customer

Criar o **Gateway** e o **Customer** no ThingsBoard **antes de finalizar a
configuração no Node-RED** — é desse cadastro que saem `clientId`,
`username` e `password` MQTT usados no passo 6.3.

> ⏳ A confirmar: o passo a passo de UI (telas exatas de criação de
> gateway/customer) não está documentado em nenhum runbook do repo hoje;
> `docs/rfcs/RFC-0185-PresetupGateway.md` trata a criação de gateway como
> **não-objetivo** (assume que ele já existe). Preencher aqui após a primeira
> execução bem-sucedida na Capim Dourado.

### 0.3 GCDR — criar Cliente + API Key

Criar o Cliente no GCDR correspondente à Capim Dourado e gerar a API Key que
será usada no passo 6.4 (nó `get Bundle`).

Contexto da arquitetura de clientes/hierarquia do GCDR:
[`docs/ONBOARDING-ECOSYSTEM-GCDR-ALARMS.md`](../../../../docs/ONBOARDING-ECOSYSTEM-GCDR-ALARMS.md).

> ⏳ A confirmar: o passo a passo de criação de cliente + emissão de API Key
> ainda não está documentado — mesma lacuna já registrada como pergunta em
> aberto em
> [`MESTRE-ALVARO-L2AC/PLAN-replicate-nodes-to-centrals.md`](../../SA-CAVALCANTE/MESTRE-ALVARO-L2AC/PLAN-replicate-nodes-to-centrals.md) §8
> ("onde buscar gcdrCustomerId e apiKey?").

### 0.4 Ingestion — criar Gateway + API Key

Criar o Gateway no ingestion (`data-ingestion-prod`) correspondente à Capim
Dourado e gerar a API Key associada.

> ⏳ A confirmar: sem runbook prévio no repo para esta etapa.

### ⚠️ 0.5 Fiação — desconectar os fios de telemetria

**Antes de iniciar qualquer trabalho físico/Modbus na central**, desconectar
os fios de telemetria. Só reconectar no passo 8.1, depois de todo o setup
de software concluído.

---

## 1. Acesso

```bash
ssh -i id_rsa root@200:9738:d165:f821:68d3:2852:d822:a748
```

## 2. Levar os SQLs para a central

Do workstation (repare nos colchetes do IPv6 no `scp`):

```bash
scp -i id_rsa -r src/NODE-RED/SOUL-MALLS/CAPIM-DOURADO/mqtt-sync \
  "root@[200:9738:d165:f821:68d3:2852:d822:a748]:/tmp/mqtt-sync"
```

> ⚠️ Arquivos vindos de checkout Windows podem ter CRLF — já na central:
> `sed -i 's/\r$//' /tmp/mqtt-sync/*.sql`

## 3. Banco — rodar os SQLs na ordem numérica do kit (00 → 04)

```bash
psql -U hubot   # db default = hubot
```

> Os arquivos do kit `mqtt-sync/` já vêm **prefixados com a ordem de execução**
> (`00-` a `04-`) — rode-os nessa ordem. O `00` é o **único que grava DADOS**
> (slave/channel/ambient virtuais) e tem **guarda anti-duplicata** (aborta se o
> MQTT Sync já existir), por isso roda seguro mesmo primeiro; `01`–`04` são
> INSTALADORES (`CREATE OR REPLACE FUNCTION` — idempotentes).
>
> ⚠️ **NUNCA rode no psql os .sql de `functions/prod/API/...`** — aqueles são as
> queries dos NÓS do Node-RED (`SELECT clear_all_data_central()` etc.); o do
> POST-ClearAllData **APAGA os dados da central**.

```bash
# 3.0 Backup ANTES de qualquer DDL/DML (manual §9.4) — mesmo os instaladores
#     sendo idempotentes, o 00 grava DADOS (slave/channel/ambient virtuais)
pg_dump -U hubot --clean --if-exists \
  -t slaves -t channels -t ambients -t ambients_rfir_slaves_rel \
  > /tmp/backup-cadastro-$(date +%Y%m%d-%H%M%S).sql
ls -lh /tmp/backup-*.sql
```

> ⚠️ `/tmp` não sobrevive a reboot — copiar o backup para o workstation
> (`scp root@\[IPV6\]:/tmp/backup-cadastro-*.sql .`) antes de qualquer
> `reboot` (inclusive o do passo 4).

```sql
-- 3.1 VERIFICAÇÃO antes do 00 (essencial em banco restaurado de backup — o MQTT
--     Sync pode já existir; nesse caso é RENAME, não create — ver cabeçalho do
--     00-create-virtual-mqtt-sync.sql). Numa central nova de fábrica: 0 linhas.
SELECT 'slave' AS obj, id, name FROM slaves   WHERE name ILIKE '%mqtt%sync%'
UNION ALL
SELECT 'channel', id, name      FROM channels WHERE name ILIKE '%mqtt%sync%'
UNION ALL
SELECT 'ambient', id, name      FROM ambients WHERE name ILIKE '%mqtt%sync%';

-- 3.2 (00) DADOS — device virtual MQTT Sync. ÚNICO que grava dados; guarda
--     anti-duplicata (aborta se já existir). Nome já especializado
--     'MQTT Sync - 84638207-ac49-4adf-a033-4731dbb920c2' e addr_low dinâmico.
\i /tmp/mqtt-sync/00-create-virtual-mqtt-sync.sql

-- 3.3 (01-02) Functions do state-api (instaladores)
\i /tmp/mqtt-sync/01-provision-central-v5.sql
\i /tmp/mqtt-sync/02-clear-all-data-central.sql

-- 3.4 (03-04) Functions do MQTT Sync (instaladores; LIKE 'MQTT Sync%' —
--     funcionam com nome legado E especializado)
\i /tmp/mqtt-sync/03-get_mqtt_sync_status.sql
\i /tmp/mqtt-sync/04-set_mqtt_sync_status.sql

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

> 💡 Nota de campo: em alguns casos, `systemctl restart myio-api.service`
> não foi suficiente para o Node-RED reconhecer os contribs recém-instalados
> — um `reboot` completo da central (§9.3 do manual) resolveu. Se o Postgres
> node não aparecer/funcionar após o restart, tentar reboot completo antes de
> investigar mais a fundo (⚠️ copiar antes qualquer backup em `/tmp` — ver
> aviso no passo 3.0).

## 5. Palette — data-fetcher

No editor (`http://[200:9738:d165:f821:68d3:2852:d822:a748]:8080/red`) → menu →
**Manage Palette → Install → upload** do
`node-red-contrib-myio-data-fetcher-1.7.2.tgz` (upload é feito do browser do
workstation). Não precisa restart — só Deploy quando mexer no flow.

## 6. Flow — conferências obrigatórias

1. **env `CENTRAL_UUID` = `84638207-ac49-4adf-a033-4731dbb920c2`** definida no
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
3. **Nó `mqtt-broker`**: preencher `clientId`, `username` e `password`
   obtidos no passo 0.2 (Gateway + Customer criados no ThingsBoard) → Deploy.
4. **Nó `get Bundle`** (aba **notifics**): preencher a API Key do GCDR e o
   `customerId` obtidos no passo 0.3 → Deploy.

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
`MQTT Sync - 84638207-ac49-4adf-a033-4731dbb920c2` criado pelo gateway após o
attributes/status-sync rodar.

---

## 8. Fechamento

### 8.1 Reconectar fiação + Deploy

Reconectar os fios de telemetria desconectados no passo 0.5. Fazer o Deploy
final no editor Node-RED (`/red`) com todos os nós do passo 6 configurados.

### 8.2 Verificação dupla — ThingsBoard **e** Ingestion

Não basta conferir o device no ThingsBoard (já feito no passo 7) — checar
também o status/telemetria do lado **Ingestion/GCDR** (API Key/Gateway
criados no passo 0.4), já que os dois sistemas consomem a mesma central de
formas independentes.

> validação bem-sucedida na Capim Dourado.

---

### Referências

- Kit desta central: [`mqtt-sync/`](mqtt-sync/) — arquivos prefixados na ordem de
  execução: `00-create-virtual-mqtt-sync.sql` (especializado, grava dados),
  `01-provision-central-v5.sql`, `02-clear-all-data-central.sql`,
  `03-get_mqtt_sync_status.sql`, `04-set_mqtt_sync_status.sql`
- Runbook de origem: [`SA-CAVALCANTE/MOXUARA/steps-new-central.md`](../../SA-CAVALCANTE/MOXUARA/steps-new-central.md)
- Referência canônica de nomenclatura + functions JS de sync: [`CENTRAL_PRE_SETUP/README.md`](../../CENTRAL_PRE_SETUP/README.md)
- Manual das centrais (SSH, Node-RED, Postgres, backup): [`GLOBAL_INFO/manual-centrais-linix-orangepi.md`](../../GLOBAL_INFO/manual-centrais-linix-orangepi.md)
- Restore de banco de backup S3: [`GLOBAL_INFO/restore-hubot-backup.sh`](../../GLOBAL_INFO/restore-hubot-backup.sh)
- Convenção de export/import de flow entre centrais: [`OBRAMAX/README.md`](../../OBRAMAX/README.md) §2,
  [`SA-CAVALCANTE/MESTRE-ALVARO-L2AC/PLAN-replicate-nodes-to-centrals.md`](../../SA-CAVALCANTE/MESTRE-ALVARO-L2AC/PLAN-replicate-nodes-to-centrals.md) §4
- Arquitetura de clientes/hierarquia GCDR: [`docs/ONBOARDING-ECOSYSTEM-GCDR-ALARMS.md`](../../../../docs/ONBOARDING-ECOSYSTEM-GCDR-ALARMS.md)
- Escopo/não-objetivos de criação de gateway pré-setup: [`docs/rfcs/RFC-0185-PresetupGateway.md`](../../../../docs/rfcs/RFC-0185-PresetupGateway.md)
