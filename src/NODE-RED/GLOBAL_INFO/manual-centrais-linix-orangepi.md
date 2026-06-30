# Manual de Acesso e Operação — Centrais Linux Orange Pi

> **Escopo:** Procedimentos para acesso remoto, operação e manutenção das centrais Orange Pi utilizadas nos shoppings MyIO.
> **Audiência:** Técnicos e desenvolvedores MyIO.

---

## 1. Visão Geral

| Campo               | Valor                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| Hardware            | Orange Pi <!-- modelo: ex. Orange Pi 3 LTS -->                                                      |
| SO                  | Imagem custom MyIO (rootfs gerenciado por **Mender**)                                               |
| Shell               | **BusyBox `ash`** — _não_ é bash. `uptime -p`/`-s` **não existem**; o prompt mostra `-sh:` em erros |
| Init                | `systemd` (com `DynamicUser=yes` para `myio-api` e Postgres — afeta paths, ver §4)                  |
| Node-RED            | **`1.2.0-beta.1` — embarcado** no `myio-api.service` (não existe service `nodered`). Ver §4.1       |
| Porta HTTP          | **`8080`** (Express + Node-RED rodam no mesmo processo)                                             |
| Editor Node-RED     | **`http://<ip-da-central>:8080/red`**                                                               |
| Endpoints `http-in` | **`http://<ip-da-central>:8080/api/<rota>`**                                                        |

---

## 2. Acesso SSH

### 2.1 Credenciais Padrão

| Campo     | Valor                    |
| --------- | ------------------------ |
| Usuário   | `root`                   |
| Chave SSH | `id_rsa` (arquivo local) |
| Porta SSH | `22`                     |

### 2.2 Endereços das Centrais por Holding

Os IPs são **IPv6** (rede mesh — Yggdrasil). Conectar sempre com `-i id_rsa`:

```bash
ssh -i id_rsa root@<ipv6-da-central>
```

#### Holding: SÁ CAVALCANTE

| Central              | IPv6                                     | Gateway ID                             | Central ID | Frequência |
| -------------------- | ---------------------------------------- | -------------------------------------- | ---------- | ---------- |
| Mestre Álvaro — L0L1 | `200:ba5f:dacb:b278:8f85:acf4:f33c:f485` | `45250d44-bad0-4071-aaa0-8091cfb12691` | —          | —          |
| Mestre Álvaro — L2AC | `200:8b:483c:9008:1184:caec:41b1:fa28`   | `d3202744-05dd-46d1-af33-495e9a2ecd52` | —          | —          |
| Mestre Álvaro — L3L4 | `200:b0b1:81aa:49a4:c554:4fec:f110:9896` | `fcb3ccd1-4b85-4cef-a1de-0b8a80bec81e` | —          | —          |
| Rio Poty             | `203:bdfb:8fda:634d:c846:1404:f319:718c` | `c0af8288-7b13-4024-bc11-df5017fef656` | —          | —          |
| Shopping da Ilha     | `201:3447:911:5955:4018:3960:6838:ee12`  | `cb318f02-1020-4f99-857f-d44d001d939b` | —          | —          |
| Moxuara              | `202:1567:faee:79ef:486:6d44:d391:fb18`  | `e982edf9-edb1-4aa6-8a14-4782465ae5a3` | —          | —          |
| Montserrat           | `200:abb2:e99:ec3d:eaf8:2d90:7bd9:42cc`  | `186bbdcb-95bc-4290-bf33-1ce89e48ffb4` | —          | —          |
| Shopping Ananindeua  | `201:ca6e:c33b:3a06:f4dd:d148:5d85:6315` | `7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a` | —          | —          |

#### Holding: SOUZA AGUIAR

| Central                         | IPv6                                     | Gateway ID                             | Central ID | Frequência |
| ------------------------------- | ---------------------------------------- | -------------------------------------- | ---------- | ---------- |
| Souza Aguiar — CO2              | `201:3941:4753:9232:901b:19fa:4978:51aa` | —                                      | —          | —          |
| Souza Aguiar — Ar Comprimido    | `200:4dbc:14be:a704:6904:81cd:b62a:ab22` | —                                      | —          | —          |
| Souza Aguiar — Maternidade Nova | `201:ce30:f047:7f02:a27c:cbac:ffb7:2b67` | —                                      | —          | —          |
| Souza Aguiar — T&D              | `202:1d97:2112:f9b9:cfcb:e237:5dc:a3f7`  | —                                      | —          | —          |
| Souza Aguiar — Gerador          | `200:dd4c:53b0:28d5:33dc:fbef:2c98:b23`  | `bb8193d9-a132-44b5-8605-e50c0521ceb9` | —          | —          |

#### Holding: SOUL MALLS

| Central                   | IPv6                                     | Gateway ID                             | Central ID     | Frequência |
| ------------------------- | ---------------------------------------- | -------------------------------------- | -------------- | ---------- |
| Praia da Costa L1         | `200:8e12:1a64:71bc:ff06:5c56:9f09:f4aa` | —                                      | —              | —          |
| Macaé                     | `200:bf4f:c3a0:e697:17ff:28a5:38ae:536b` | `571ff592-8983-43b3-b7f2-96ab688d4f1c` | —              | —          |
| Ilha Plaza AL1            | `200:dc42:651b:5ae5:338d:2b26:670d:34e6` | `81a60176-222c-4bb9-88f5-bc2b47802d82` | —              | —          |
| Ilha Plaza AL2            | `200:24a5:8297:cce7:59d2:8126:6d67:7e4d` | `53052549-cc8c-4ca2-a597-58e0577548a2` | —              | —          |
| Ilha Plaza AL3            | `206:c160:eb69:3ddb:42c7:efce:511e:792a` | `91b719b7-f2d2-4d3f-9fb9-ab3d4edbac0d` | —              | —          |
| Melicidade                | `200:43cb:c66:59be:9966:7330:8b9a:224`   | `05148707-6011-42fb-8b78-46f33a5ca988` | —              | —          |

#### Holding: ARGO PLAN

| Central                     | IPv6                                     | Gateway ID                             | Central ID     | Frequência |
| --------------------------- | ---------------------------------------- | -------------------------------------- | -------------- | ---------- |
| Campinas Shopping — G1 G2   | `203:5e50:3e69:89bd:5846:e41f:23b8:fd28` | `1b5d79c4-5fc6-46c4-bd05-89e8b1499920` | `16.2.170.222` | `107`      |
| Campinas Shopping — G0 Nova | `200:83a1:247a:8c7b:d428:3ed4:21dd:389f` | `401230d1-e7d6-46dd-9bb1-059387683303` | —              | —          |

#### Holding: SUPERVIA ESTAÇÕES

| Central | IPv6                                    | Gateway ID                             | Central ID | Frequência |
| ------- | --------------------------------------- | -------------------------------------- | ---------- | ---------- |
| Deodoro | `200:1e6a:69a5:73f1:b18a:e6e:aa68:9229` | `adb43bf6-6107-44fa-b786-6e88c150d779` | —          | —          |

#### Holding: DIMENSION

| Central           | IPv6                                    | Gateway ID | Central ID | Frequência |
| ----------------- | --------------------------------------- | ---------- | ---------- | ---------- |
| Central Dimension | `203:984:24ef:b578:69a6:7136:b9f2:b5c2` | —          | —          | —          |

#### Holding: RAIZ EDUCAÇÃO

| Central               | IPv6                                  | Gateway ID | Central ID | Frequência |
| --------------------- | ------------------------------------- | ---------- | ---------- | ---------- |
| Central Raiz Educação | `201:3bed:541b:8c61:3e69:9:d453:1bef` | —          | —          | —          |

#### Holding: HCOR

| Central       | IPv6                                    | Gateway ID                             | Central ID | Frequência |
| ------------- | --------------------------------------- | -------------------------------------- | ---------- | ---------- |
| HCor Q521-527 | `200:a420:9834:fc66:dcf9:f46:4a57:9d09` | `e45e0453-9593-4aaa-9347-a1daa9cf27e3` | —          | —          |

#### Holding: OBRAMAX

| Central      | IPv6                                     | Gateway ID                             | Central ID | Frequência |
| ------------ | ---------------------------------------- | -------------------------------------- | ---------- | ---------- |
| Praia Grande | `200:a12e:4703:c680:dfb7:936b:88b9:6f4b` | —                                      | —          | —          |
| Aricanduva   | `200:bc45:34ee:59da:371a:cfe9:98d3:3805` | `1e0c1d77-1d41-4004-8be7-41328e590111` | —          | —          |
| Guadalupe    | `202:f573:1e70:22f1:1dae:95bd:eeb9:1157` | `96a7ca86-c291-4d77-aa66-4706641eaa5a` | —          | —          |
| Benfica      | `200:47f1:8bf6:36da:65fa:4124:bcdb:dbb4` | `1248905a-ed03-414d-bde6-c4410604ae8f` | —          | —          |

**Exemplos de conexão:**

```bash
# Mestre Álvaro L0L1 (Sá Cavalcante)
ssh -i id_rsa root@200:ba5f:dacb:b278:8f85:acf4:f33c:f485

# Mestre Álvaro L2AC (Sá Cavalcante)
ssh -i id_rsa root@200:8b:483c:9008:1184:caec:41b1:fa28

# Mestre Álvaro L3L4 (Sá Cavalcante)
ssh -i id_rsa root@200:b0b1:81aa:49a4:c554:4fec:f110:9896

# Rio Poty (Sá Cavalcante)
ssh -i id_rsa root@203:bdfb:8fda:634d:c846:1404:f319:718c

# Shopping da Ilha (Sá Cavalcante)
ssh -i id_rsa root@201:3447:911:5955:4018:3960:6838:ee12

# Moxuara (Sá Cavalcante)
ssh -i id_rsa root@202:1567:faee:79ef:486:6d44:d391:fb18

# Montserrat (Sá Cavalcante)
ssh -i id_rsa root@200:abb2:e99:ec3d:eaf8:2d90:7bd9:42cc

# Shopping Ananindeua (Sá Cavalcante)
ssh -i id_rsa root@201:ca6e:c33b:3a06:f4dd:d148:5d85:6315

# Souza Aguiar — CO2
ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa

# Souza Aguiar — Ar Comprimido
ssh -i id_rsa root@200:4dbc:14be:a704:6904:81cd:b62a:ab22

# Souza Aguiar — Maternidade Nova
ssh -i id_rsa root@201:ce30:f047:7f02:a27c:cbac:ffb7:2b67

# Souza Aguiar — T&D
ssh -i id_rsa root@202:1d97:2112:f9b9:cfcb:e237:5dc:a3f7

# Souza Aguiar — Gerador
ssh -i id_rsa root@200:dd4c:53b0:28d5:33dc:fbef:2c98:b23

# Praia da Costa L1 (Soul Malls)
ssh -i id_rsa root@200:8e12:1a64:71bc:ff06:5c56:9f09:f4aa

# Macaé (Soul Malls)
ssh -i id_rsa root@200:bf4f:c3a0:e697:17ff:28a5:38ae:536b

# Ilha Plaza AL1 (Soul Malls)
ssh -i id_rsa root@200:dc42:651b:5ae5:338d:2b26:670d:34e6

# Ilha Plaza AL2 (Soul Malls)
ssh -i id_rsa root@200:24a5:8297:cce7:59d2:8126:6d67:7e4d

# Ilha Plaza AL3 (Soul Malls)
ssh -i id_rsa root@206:c160:eb69:3ddb:42c7:efce:511e:792a

# Campinas Shopping — G1 G2 (Argo Plan)
ssh -i id_rsa root@203:5e50:3e69:89bd:5846:e41f:23b8:fd28

# Campinas Shopping — G0 Nova (Argo Plan)
ssh -i id_rsa root@200:83a1:247a:8c7b:d428:3ed4:21dd:389f

# Melicidade (Soul Malls)
ssh -i id_rsa root@200:43cb:c66:59be:9966:7330:8b9a:224

# Deodoro (Supervia Estações)
ssh -i id_rsa root@200:1e6a:69a5:73f1:b18a:e6e:aa68:9229

# Central Dimension (Dimension)
ssh -i id_rsa root@203:984:24ef:b578:69a6:7136:b9f2:b5c2

# Central Raiz Educação (Raiz Educação)
ssh -i id_rsa root@201:3bed:541b:8c61:3e69:9:d453:1bef

# HCor Q521-527 (HCOR)
ssh -i id_rsa root@200:a420:9834:fc66:dcf9:f46:4a57:9d09

# Praia Grande (Obramax)
ssh -i id_rsa root@200:a12e:4703:c680:dfb7:936b:88b9:6f4b

# Aricanduva (Obramax)
ssh -i id_rsa root@200:bc45:34ee:59da:371a:cfe9:98d3:3805

# Guadalupe (Obramax)
ssh -i id_rsa root@202:f573:1e70:22f1:1dae:95bd:eeb9:1157

# Benfica (Obramax)
ssh -i id_rsa root@200:47f1:8bf6:36da:65fa:4124:bcdb:dbb4
```

---

## 3. Node-RED

> ⚠️ **Não existe `nodered.service`** nessas centrais. O Node-RED roda **embarcado** dentro
> do `myio-api.service` — todos os comandos abaixo gerenciam o `myio-api`. Reiniciar ele
> reinicia o Node-RED, a REST API e o WebSocket juntos. Ver §4.1 para a arquitetura.

### 3.1 Verificar status

```bash
systemctl status myio-api.service
```

### 3.2 Iniciar / Parar / Reiniciar

```bash
systemctl start  myio-api.service
systemctl stop   myio-api.service
systemctl restart myio-api.service
```

### 3.3 Ver logs em tempo real

```bash
journalctl -u myio-api.service -f
```

### 3.4 Acessar editor Node-RED (browser)

```
http://<ip-da-central>:8080/red
```

> Note: porta **`8080`** (não `1880`) e prefixo **`/red`** — definidos no `server.js` do
> myio-api (`httpAdminRoot: '/red'`, `httpNodeRoot: '/api'`).

---

## 4. Arquivos e Diretórios

### 4.1 Arquitetura — `myio-api.service` embarca o Node-RED

Diferente do padrão "Node-RED standalone", essas centrais rodam o Node-RED **como
biblioteca** dentro de um Express custom (o `myio-api.service`). Um único processo Node.js
serve a editor UI, os flows, e a REST API ao mesmo tempo.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ myio-api.service     (Node.js + Express + Node-RED embarcado)             │
│                                                                           │
│ WorkingDirectory: /usr/lib/node_modules/API                               │
│ ExecStart:        /usr/bin/node /usr/lib/node_modules/API/server.js       │
│                                                                           │
│   server.js                                                               │
│     ├─ express()  →  server.listen(8080)                                  │
│     ├─ Sequelize ORM  →  DB hubot                                         │
│     ├─ JWT (passport-jwt) auth                                            │
│     └─ require('node-red')  →  bootstrap programático:                    │
│           settings = {                                                    │
│             httpAdminRoot: '/red',      # editor em :8080/red             │
│             httpNodeRoot:  '/api',      # http-in em :8080/api/<rota>     │
│             userDir:  __dirname/'nodered_data/',                          │
│             nodesDir: __dirname/'nodered_nodes/',                         │
│             adminAuth: { users: <do banco>, ... },                        │
│             functionGlobalContext: {},                                    │
│           }                                                               │
│                                                                           │
│ ❗ Não existe `nodered.service`. Não existe `settings.js` no disco — as   │
│    configs são passadas em código pelo `server.js`.                       │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│ myio.service     (Erlang/OTP — camada de rádio + Modbus)                  │
│ ExecStart: /usr/lib/myio/bin/myio start                                   │
│ Pinos SPI: POWER=6, CE=3, CSN=13, IRQ=1, STATUS=7                         │
│ Comunica com slaves nRF24L01 via SPI; expõe via socket local.             │
└───────────────────────────────────────────────────────────────────────────┘
```

`myio-api` ↔ `myio` falam pelo banco `hubot` (Postgres) e por sockets locais. O Node-RED
não toca em hardware diretamente — usa os contribs custom para falar com o `myio`.

### 4.2 Layout no disco

| Caminho                                              | O que é                                                                                                                                                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/usr/lib/node_modules/API/`**                     | **🔑 App principal** — onde o `server.js` e a Node-RED ativa moram                                                                                                                                             |
| `/usr/lib/node_modules/API/nodered_data/`            | **userDir ATIVO** — `flows.json`, `credentials`, etc.                                                                                                                                                          |
| `/usr/lib/node_modules/API/nodered_nodes/`           | **nodesDir** — os 20 contribs custom MyIO (ver §4.4)                                                                                                                                                           |
| `/usr/lib/node_modules/API/node_modules/`            | npm deps (node-red 1.2.0-beta.1, dashboard, sequelize, express…)                                                                                                                                               |
| `/usr/lib/node_modules/API/{lib,models,migrations}/` | REST API + Sequelize ORM + migrations                                                                                                                                                                          |
| `/usr/lib/myio/bin/myio`                             | Binário Erlang/OTP do `myio.service` (camada de rádio)                                                                                                                                                         |
| `/var/lib/private/postgresql/`                       | Dados do Postgres (DB `hubot`) — via `DynamicUser=yes`                                                                                                                                                         |
| `/var/lib/postgresql`                                | _symlink_ → `private/postgresql`                                                                                                                                                                               |
| `/var/cache/node-red/`                               | `HOME=%C/node-red` definido no unit; cache npm/node                                                                                                                                                            |
| `/var/lib/private/node-red/` ⚠️                      | **Provável legado** — tem `package.json`, contrib `myio-modbus` (158 linhas, registra só o type `modbus`), e snapshots `old/node_modules_*/`. **Não é o userDir ativo** do Node-RED. Validar antes de remover. |
| `/var/lib/node-red`                                  | _symlink_ → `private/node-red` (mesmo destino legado)                                                                                                                                                          |
| `/data/...`                                          | Overlay Mender (sobrevive a _rootfs update_) — espelhos persistentes                                                                                                                                           |

### 4.3 Arquivos-chave do app

| Caminho                                                  | Descrição                                          |
| -------------------------------------------------------- | -------------------------------------------------- |
| `/usr/lib/node_modules/API/server.js`                    | Bootstrap — Express + JWT + `require('node-red')`  |
| `/usr/lib/node_modules/API/package.json`                 | Deps do app (Node-RED, dashboard, sequelize, etc.) |
| `/usr/lib/node_modules/API/nodered_data/flows.json`      | **Flow principal** (editado pela UI)               |
| `/usr/lib/node_modules/API/nodered_data/flows_cred.json` | Credenciais cifradas dos nós                       |
| `/usr/lib/node_modules/API/scheduler.js`                 | Cron interno (`node-schedule`)                     |
| `/usr/lib/node_modules/API/lib/routes/`                  | Endpoints REST (não-Node-RED)                      |
| `/usr/lib/node_modules/API/models/`                      | Modelos Sequelize (tabelas do DB `hubot`)          |

> 💡 **Comandos de descoberta** (caso outra central tenha layout diferente):
>
> ```sh
> systemctl cat myio-api.service                # WorkingDirectory + ExecStart
> ps -ef | grep -v grep | grep -E 'node|myio'   # processos rodando
> grep -rln "RED.nodes.registerType" /usr/lib/node_modules/API/ 2>/dev/null
> ```

### 4.4 Node types custom MyIO (em `nodered_nodes/`)

20 contribs, **um diretório por contrib**, cada um registrando 1 ou 2 node types:

| Diretório                                     | Types registrados           | Função                                 |
| --------------------------------------------- | --------------------------- | -------------------------------------- |
| `node-red-contrib-myio-emitter`               | `emitter`                   | 🔑 **Publica telemetria** (cloud / TB) |
| `node-red-contrib-myio-persist`               | `persist-in`, `persist-out` | Persistência (flow/global context)     |
| `node-red-contrib-myio-activate-channel`      | `activate-channel`          | Liga/desliga canal Modbus              |
| `node-red-contrib-myio-activate-scene`        | `activate-scene`            | Executa cena                           |
| `node-red-contrib-myio-time-range`            | `time-range`                | Janela horária (Agendamentos)          |
| `node-red-contrib-myio-get-data`              | `get-data`                  | Lê tabelas (`slaves`/`channels`/…)     |
| `node-red-contrib-myio-slave`                 | `filter-slave`              | Filtra por slave                       |
| `node-red-contrib-myio-channel`               | `filter-channel`            | Filtra por channel                     |
| `node-red-contrib-myio-channel_and`           | `filter-channel_and`        | Combinador AND                         |
| `node-red-contrib-myio-channel_or`            | `filter-channel_or`         | Combinador OR                          |
| `node-red-contrib-myio-temperature`           | `filter-temperature`        | Filtra leitura de temperatura          |
| `node-red-contrib-myio-consumption`           | `filter-consumption`        | Filtra consumo                         |
| `node-red-contrib-myio-three_phase`           | `three-phase`               | Trifásico                              |
| `node-red-contrib-myio-slave-info`            | `slave-info`                | Lookup info do slave                   |
| `node-red-contrib-myio-send-check`            | `send-check`                | Envia checagem                         |
| `node-red-contrib-myio-send-email`            | `send-email`                | Envia e-mail                           |
| `node-red-contrib-myio-send-notification`     | `send-notification`         | Notificação genérica                   |
| `node-red-contrib-myio-register-device`       | `register-device`           | Registro de device                     |
| `node-red-contrib-myio-transmit-rfir-command` | `transmit-rfir-command`     | IR (rfir)                              |
| `node-red-contrib-myio-stress-test`           | `stress-test`               | Bench/teste                            |

➕ Via npm em `API/node_modules/`: `node-red-dashboard` (todos os `ui_*`),
`node-red-node-ui-list`, `node-red-node-tail`, `node-red-node-rbe`,
`node-red-contrib-wait-paths`.

> **Editar um node type custom** = editar o `.js` correspondente em
> `/usr/lib/node_modules/API/nodered_nodes/<contrib>/` + reiniciar (§4.6).

### 4.5 Editar um arquivo JS na central

```bash
# Usando nano (não vem com vim por padrão)
nano <caminho-do-arquivo>

# Salvar: Ctrl+O → Enter
# Sair:   Ctrl+X
```

### 4.6 Fazer deploy após editar manualmente

```bash
# Reiniciar o myio-api = recarregar Node-RED + REST API
systemctl restart myio-api.service

# Acompanhar a subida
journalctl -u myio-api.service -f
```

---

## 5. Banco de Dados PostgreSQL

### 5.1 Conectar

```bash
psql -U hubot
```

162 (CTI Pediátrico\_ sétimo-andar), 164 (TEMP_FARMACIA-CAF).

> **Troubleshooting** — se retornar
> `could not connect to server: No such file or directory / Is the server running locally and accepting connections on Unix domain socket "/tmp/.s.PGSQL.5432"?`,
> o cliente está procurando o socket em `/tmp`, mas no Debian/Ubuntu o Postgres usa `/var/run/postgresql`. Force o host correto:
>
> ```bash
> psql -U hubot -h /var/run/postgresql
> ```

### 5.2 Comandos úteis dentro do psql

```sql
-- Listar tabelas
\dt
--  SELECT id, name FROM slaves WHERE name ~ ' X[0-9]';
--  SELECT id, name FROM channels WHERE name ~ ' X[0-9]';

-- Listar tabelas com detalhes (schema, tipo, owner)
\dt+

-- Detalhes de uma tabela
\d nome_da_tabela

-- Detalhes completos (tamanho, storage, descrições)
\d+ nome_da_tabela

-- Limpar o terminal
\! clear

-- Desconectar
\q
```

### 5.3 Tabela `logs` — histórico de ações da central

Registra ações sobre slaves / canais / cenas (liga/desliga, acionamentos IR, etc.).
É uma **hypertable TimescaleDB** (child tables particionadas + trigger `ts_insert_blocker`)
— **sempre filtre por `timestamp`** nas queries.

```
\d logs
     Column      |            Type             | Nullable | Default
-----------------+-----------------------------+----------+---------
 timestamp       | timestamp(0) with time zone | not null | now()
 type            | varchar(255)                |          |
 action_type     | varchar(255)                |          |
 user            | varchar(255)                |          |   ← reservada: usar "user"
 slave_id        | integer                     |          |   → slaves.id
 ambient_id      | integer                     |          |   → ambients.id
 scene_id        | integer                     |          |   → scenes.id
 channel         | integer                     |          |
 rfir_command_id | integer                     |          |   → rfir_commands.id
 value           | integer                     |          |
Index: logs_timestamp_idx btree ("timestamp" DESC)
```

> ⚠️ `user` é palavra reservada no SQL — referencie sempre como `"user"`.

```sql
-- Últimos registros
SELECT timestamp, type, action_type, "user", slave_id, channel, value
FROM logs ORDER BY timestamp DESC LIMIT 50;

-- Vocabulário da tabela (quais type/action_type existem)
SELECT type, action_type, count(*) FROM logs
GROUP BY type, action_type ORDER BY count(*) DESC;

-- Janela de datas + ações de um slave (sempre filtrar por timestamp — hypertable)
SELECT timestamp, type, action_type, "user", channel, value
FROM logs
WHERE slave_id = <ID>
  AND timestamp >= '2026-05-18 00:00-03' AND timestamp < '2026-05-21 00:00-03'
ORDER BY timestamp DESC;
```

### 5.4 Executar um arquivo SQL

```bash
# 1. Criar arquivo temporário
cat > /tmp/fix-nome.sql << 'EOF'
-- Cole o SQL aqui
EOF

# 2. Executar
psql -U hubot -f /tmp/fix-nome.sql

# 3. Remover após uso
rm /tmp/fix-nome.sql
```

---

## 6. Serviços MyIO

### 6.1 Reiniciar APIs

```bash
systemctl restart myio.service
systemctl restart myio-api.service
```

### 6.2 Verificar status dos serviços

```bash
systemctl status myio.service
systemctl status myio-api.service
```

### 6.3 Verificar se a API está no ar

Checagem em camadas — do serviço, passando pela porta, até a resposta HTTP.

```bash
# 1) O serviço está ativo? ("active" = rodando)
systemctl is-active myio-api.service
systemctl is-active nodered

# 2) Em que porta a API está escutando? (LISTEN)
ss -tlnp | grep -E 'node|myio|1880'
ss -tlnp                  # se nada acima casar, lista TODAS as portas TCP em LISTEN

# 3) A API responde HTTP? (Node-RED expõe os endpoints na porta 1880)
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:1880/
#   HTTP 200  -> no ar
#   "Connection refused" / sem resposta -> fora do ar

# 4) Testar um endpoint REAL da API (substituir pelo caminho do http-in do flow)
curl -i http://localhost:1880/<rota-da-api>

# 5) Processo de fato rodando?
ps aux | grep -E 'node-red|myio' | grep -v grep

# 6) Logs em tempo real (Ctrl+C para sair)
journalctl -u myio-api.service -f
journalctl -u nodered -f
```

**Conectividade com a nuvem MyIO** (a central envia dados para `dashboard.myio.com.br`):

```bash
# A central alcança a API da nuvem?
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://dashboard.myio.com.br
ping -c 3 dashboard.myio.com.br
```

| Resultado                                  | Interpretação                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `is-active` = `active` + `curl` HTTP 200   | API local no ar                                                                  |
| `is-active` = `inactive`/`failed`          | Serviço parado → `systemctl restart myio-api.service` (§6.1) e ver logs          |
| Serviço `active` mas `curl` recusa conexão | App subiu mas não abriu a porta → ver `journalctl` por erro de boot/porta em uso |
| API local OK mas nuvem não responde        | Problema de rede/internet da central, não da API                                 |

---

## 7. Modbus / Slaves

### 7.1 Schema da tabela `slaves`

```
hubot=# \d slaves;
                                             Table "public.slaves"
         Column         |           Type           | Collation | Nullable |              Default
------------------------+--------------------------+-----------+----------+------------------------------------
 id                     | integer                  |           | not null | nextval('slaves_id_seq'::regclass)
 type                   | character varying(255)   |           |          |
 addr_low               | integer                  |           |          |
 addr_high              | integer                  |           |          |
 channels               | integer                  |           |          |
 name                   | character varying(255)   |           |          |
 color                  | character varying(255)   |           |          |
 code                   | character varying(255)   |           |          |
 clamp_type             | integer                  |           |          |
 aggregate              | boolean                  |           |          | true
 version                | character varying(255)   |           |          | '1.0.0'::character varying
 temperature_correction | integer                  |           |          |
 config                 | json                     |           |          |
 created_at             | timestamp with time zone |           | not null | now()
 updated_at             | timestamp with time zone |           | not null | now()
```

**Campo `config` — estrutura relevante:**

```json
{
  "config_clamp": {
    "value": 2
  }
}
```

`clamp_type` deve ser sempre `NOT NULL` e igual a `config->'config_clamp'->>'value'`.

### 7.2 Query: não conformidades `clamp_type` vs `config.config_clamp.value`

```sql
SELECT
  id,
  name,
  clamp_type,
  (config -> 'config_clamp' ->> 'value')::integer AS config_clamp_value,
  CASE
    WHEN clamp_type IS NULL                                          THEN 'clamp_type NULL'
    WHEN config IS NULL                                              THEN 'config NULL'
    WHEN config -> 'config_clamp' IS NULL                           THEN 'config_clamp ausente'
    WHEN (config -> 'config_clamp' ->> 'value') IS NULL             THEN 'config_clamp.value NULL'
    WHEN clamp_type <> (config -> 'config_clamp' ->> 'value')::int  THEN 'divergência'
  END AS problema
FROM slaves
WHERE
  clamp_type IS NULL
  OR config IS NULL
  OR config -> 'config_clamp' IS NULL
  OR (config -> 'config_clamp' ->> 'value') IS NULL
  OR clamp_type <> (config -> 'config_clamp' ->> 'value')::int
ORDER BY id;
```

### 7.3 Update pontual de `clamp_type`

```sql
-- Exemplo: forçar clamp_type = 2 para slave id = 66
UPDATE slaves
SET clamp_type = 2
WHERE id = 66;
```

### 7.4 Update em massa — sincronizar `clamp_type` com `config.config_clamp.value`

```sql
-- Atualiza todos onde há divergência e config_clamp.value é válido
UPDATE slaves
SET clamp_type = (config -> 'config_clamp' ->> 'value')::int
WHERE
  (config -> 'config_clamp' ->> 'value') IS NOT NULL
  AND (
    clamp_type IS NULL
    OR clamp_type <> (config -> 'config_clamp' ->> 'value')::int
  );
```

### 7.5 Verificar dispositivos ativos

<!-- Descrever como verificar slaves conectados:
     ex. via log Node-RED, arquivo de configuração, etc.
-->

### 7.6 Arquivo de mapeamento de devices

<!-- Caminho e formato do arquivo que mapeia slaveId → deviceName -->

---

## 8. RFIR — Controle Remoto Infravermelho (Modelo de Dados)

> **Status: Em análise (parcial).** Schemas de `rfir_devices` e `rfir_remotes`
> capturados em 2026-05-04 na Central Raiz Educação. As outras 4 tabelas RFIR
> (`rfir_buttons`, `rfir_commands`, `ambients_rfir_devices_rel`,
> `ambients_rfir_slaves_rel`) ainda precisam ser inspecionadas. Esta seção
> documenta o que já é fato e o que ainda é hipótese.

### 8.1 Conceito fundamental

Dispositivos `slaves` com `type = 'infrared'` são blasters IR físicos. O ponto
crítico é **onde o sinal IR mora**:

- **O comando IR (o "código" capturado do controle)** fica armazenado **dentro
  do hardware do blaster**, em uma página de memória identificada por um par
  `(page_low, page_high)`.
- O **banco de dados guarda só a referência** ao endereço de memória — não o
  sinal IR em si.
- Consequência prática: para reproduzir um comando é sempre necessário
  comunicar com o hardware; o banco sozinho não consegue "tocar" o IR.
- Consequência operacional: **migrar/clonar configurações de IR entre centrais**
  exige recapturar cada comando no hardware destino — o dump do Postgres
  **não é auto-suficiente**.

### 8.2 Tabelas e schemas

#### 8.2.1 Camadas (entendimento confirmado para `slaves`/`rfir_devices`/`rfir_remotes`)

```
slaves (físico, hardware Modbus)
   │
   │ FK rfir_devices.slave_id → slaves.id   (ON DELETE SET NULL)
   ▼
rfir_devices (lógico, "device" exposto na UI sobre um blaster)
   │
   │ FK rfir_remotes.rfir_device_id → rfir_devices.id   (ON DELETE SET NULL)
   ▼
rfir_remotes (sub-agrupamento de botões dentro de um device)
   │
   │ FK rfir_buttons.rfir_remote_id → rfir_remotes.id   (ON DELETE CASCADE — ⚠️ ver §8.4)
   ▼
rfir_buttons → rfir_commands → (page_low, page_high) na flash do slave
```

Cardinalidade:

- 1 `slave` (IR) → **N** `rfir_devices` (um hardware pode expor vários devices lógicos — ver §8.2.4).
- 1 `rfir_device` → **N** `rfir_remotes`.
- 1 `rfir_remote` → **N** `rfir_buttons`.

#### 8.2.2 `\d rfir_devices` ✅ confirmado

```
        Column     |           Type           | Nullable | Default
   ----------------+--------------------------+----------+-----------
    id             | integer                  | not null | nextval()
    type           | varchar(255)             |          |          ← e.g. 'ir'
    category       | varchar(255)             |          |          ← e.g. 'other'
    name           | varchar(255)             |          |          ← UI label (ex.: 'AC 5')
    output         | varchar(255)             |          |          ← e.g. 'both'
    slave_id       | integer                  |          |          ← FK → slaves.id
    command_on_id  | integer                  |          |          ← FK → rfir_commands.id (nullable)
    command_off_id | integer                  |          |          ← FK → rfir_commands.id (nullable)
    created_at     | timestamptz              | not null | now()
    updated_at     | timestamptz              | not null | now()

   Foreign keys: slave_id → slaves.id  ON UPDATE CASCADE  ON DELETE SET NULL
                 command_on_id  → rfir_commands.id  ON UPDATE CASCADE  ON DELETE SET NULL
                 command_off_id → rfir_commands.id  ON UPDATE CASCADE  ON DELETE SET NULL

   Referenced by: ambients_rfir_devices_rel (rfir_device_id)
                  rfir_remotes              (rfir_device_id)
```

#### 8.2.3 `\d rfir_remotes` ✅ confirmado

```
        Column     |           Type           | Nullable | Default
   ----------------+--------------------------+----------+-----------
    id             | integer                  | not null | nextval()
    name           | varchar(255)             |          |
    rfir_device_id | integer                  |          |          ← FK → rfir_devices.id
    created_at     | timestamptz              | not null | now()
    updated_at     | timestamptz              | not null | now()

   Foreign keys: rfir_device_id → rfir_devices.id  ON UPDATE CASCADE  ON DELETE SET NULL

   Referenced by: raw_energy   (rfir_remote_id)
                  rfir_buttons (rfir_remote_id)  ⚠️ TRÊS FKs duplicadas — ver §8.4
```

#### 8.2.4 Padrão "1 hardware → múltiplos devices lógicos"

Um único slave IR (ex.: blaster `RM 5`, `slaves.id=14`) pode aparecer na UI como
**dois (ou mais) devices distintos**:

| UI                            | Onde mora                                                                                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AC 5` (controle remoto IR)   | Linha em `rfir_devices` com `slave_id=14`                                                                                                                                                                               |
| `RM 5` (`temperature_sensor`) | **Sintetizado direto do `slaves.id=14`** quando `temperature_correction IS NOT NULL` (firmware 7.0.0 do blaster expõe um termômetro embutido) — **NÃO** existe linha correspondente em `rfir_devices` ou `rfir_remotes` |

Caso confirmado em 2026-05-04 na Raiz Educação — ver
[`CENTRAL-RAIZ-EDUCACAO.md`](../RAIZ-EDUCACAO/CENTRAL-RAIZ-EDUCACAO.md) §2.6.

Implicações:

1. Um device da UI **nem sempre** tem linha em `rfir_devices`. O `temperature_sensor` derivado de um slave IR é virtual.
2. A UI precisa decidir se exibe um device pra cada `rfir_devices.id` **e** pra cada `slaves.id` com flags adicionais.
3. Pra inventariar "todos os devices visíveis" não basta listar `rfir_devices` — é preciso união com `slaves` filtrando o subset que produz devices virtuais (temperatura, talvez outros).

#### 8.2.5 Outras tabelas RFIR — schemas a capturar

```sql
\d rfir_buttons
\d rfir_commands
\d ambients_rfir_devices_rel
\d ambients_rfir_slaves_rel
```

### 8.3 Cadeia de referências confirmada (parcial)

```
slaves (IR físico)
   │
   ▼
rfir_devices ──► (rfir_device.command_on_id  → rfir_commands.id)
   │             (rfir_device.command_off_id → rfir_commands.id)
   ▼
rfir_remotes ──► rfir_buttons ──► (rfir_command_id → rfir_commands.id)  ← FKs a confirmar
                                                       │
                                                       ▼
                                                  (page_low, page_high) na flash do slave
```

Pra responder "qual botão aciona qual sinal no hardware X" a query precisa
percorrer **`rfir_buttons` → `rfir_commands` → (firmware do `slaves`)**, com
`rfir_remotes` e `rfir_devices` agindo como agrupadores hierárquicos.

### 8.4 Pontos de fricção / débito técnico

1. **`slaves` ↔ `rfir_devices` NÃO é duplicação** (item original deste tópico
   reescrito) — confirmado em 8.2: são camadas distintas. `slaves` é hardware,
   `rfir_devices` é o device lógico exposto na UI. Um slave IR pode produzir
   N devices lógicos (ex.: o IR + o termômetro embutido — §8.2.4). O termo
   "duplicação" estava errado.
2. **`rfir_remotes` parece sub-utilizada.** Na Raiz Educação, `AC 5` aparece
   em `rfir_devices` mas **não** em `rfir_remotes` (zero rows pro nome). Isso
   sugere que `rfir_remotes` é opcional — alguns devices IR usam direto
   `rfir_devices.command_on_id`/`command_off_id` e não precisam do nível remote.
   Verificar se `rfir_remotes` cresce em devices mais complexos (TV com 30+
   botões), e se tem populações inconsistentes entre centrais.
3. **`rfir_buttons` tem 3 FK constraints duplicadas** apontando pra
   `rfir_remotes.id`, com **ON DELETE divergente**:
   - `rfir_buttons_rfir_remote_id_fkey` → `ON DELETE SET NULL`
   - `rfir_buttons_rfir_remote_id_fkey1` → `ON DELETE CASCADE`
   - `rfir_buttons_rfir_remote_id_fkey2` → `ON DELETE CASCADE`
     Resultado prático: 2 dos 3 dizem CASCADE, então o efetivo é CASCADE — **mas**
     é débito técnico, código defensivo de migration que ficou. Limpar com um
     `ALTER TABLE … DROP CONSTRAINT` da redundante.
4. **Duas junctions com `ambients`** (`ambients_rfir_devices_rel` e
   `ambients_rfir_slaves_rel`) — pelo schema já visto, `rfir_device.slave_id`
   é FK direta pra `slaves`, então a junction `ambients_rfir_slaves_rel`
   provavelmente é vestígio. A confirmar com `count(*)` nas duas e checagem de
   uso pela app.
5. **`page_low`/`page_high` vaza no modelo relacional** — endereço de página
   da flash interna do blaster está exposto no Postgres. Acopla o schema ao
   hardware. (Mesma observação do draft anterior.)
6. **Dump do banco não é portável** — `pg_dump` de uma central não recria o
   ambiente RFIR em outra sem recaptura dos comandos físicos. (Mesma observação.)
7. **Sem integridade referencial entre `rfir_command.(page_low, page_high)` e
   o conteúdo real do firmware** — nada impede o banco apontar pra página
   sobrescrita.

### 8.5 Validação pendente — schemas a capturar

Rodar em uma central ativa e colar a saída no `.md` da central correspondente:

```sql
\d rfir_buttons
\d rfir_commands
\d ambients_rfir_devices_rel
\d ambients_rfir_slaves_rel
```

Contagens por tabela (panorama de volume):

```sql
SELECT 'rfir_devices'              AS tabela, count(*) FROM rfir_devices
UNION ALL SELECT 'rfir_remotes',              count(*) FROM rfir_remotes
UNION ALL SELECT 'rfir_buttons',              count(*) FROM rfir_buttons
UNION ALL SELECT 'rfir_commands',             count(*) FROM rfir_commands
UNION ALL SELECT 'ambients_rfir_devices_rel', count(*) FROM ambients_rfir_devices_rel
UNION ALL SELECT 'ambients_rfir_slaves_rel',  count(*) FROM ambients_rfir_slaves_rel;
```

Amostra "botão → endereço físico" (uma vez que as FKs de `rfir_buttons` /
`rfir_commands` estejam confirmadas):

```sql
-- Esqueleto — ajustar joins aos nomes reais das FKs
SELECT
  b.id              AS button_id,
  b.name            AS button_name,
  r.name            AS remote_name,
  d.name            AS device_name,
  c.page_low,
  c.page_high,
  s.id              AS slave_id,
  s.name            AS slave_name
FROM rfir_buttons b
JOIN rfir_commands c ON c.id = b.command_id        -- confirmar FK
JOIN rfir_remotes  r ON r.id = b.rfir_remote_id    -- ✅ FK confirmada (rfir_buttons → rfir_remotes)
JOIN rfir_devices  d ON d.id = r.rfir_device_id    -- ✅ FK confirmada
JOIN slaves        s ON s.id = d.slave_id          -- ✅ FK confirmada
ORDER BY s.name, d.name, r.name, b.name;
```

### 8.6 Perguntas — status de resolução

| #   | Pergunta                                                                   | Status                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cardinalidade `rfir_device` ↔ `slave`                                      | ✅ **N:1** — múltiplos `rfir_devices` podem apontar pro mesmo `slave_id` (ver §8.2.4)                                                                                              |
| 2   | `rfir_remote` representa controle físico do cliente ou agrupamento lógico? | 🟡 Parcialmente: é **subordinado** a `rfir_devices` (FK `rfir_device_id`). Parece ser um agrupamento lógico de botões opcional, sub-utilizado em devices simples (ver §8.4 item 2) |
| 3   | `rfir_command` compartilhado entre botões/remotes?                         | ⏳ A confirmar com schema de `rfir_commands` e `rfir_buttons`                                                                                                                      |
| 4   | Por que duas junctions com `ambients`?                                     | ⏳ A confirmar — provavelmente `ambients_rfir_slaves_rel` é vestígio (ver §8.4 item 4)                                                                                             |
| 5   | `page_low/page_high` são alocados pelo firmware ou pelo app?               | ⏳ A confirmar                                                                                                                                                                     |
| 6   | Existe coluna pra marcar comandos órfãos?                                  | ⏳ A confirmar com `\d rfir_commands`                                                                                                                                              |
| 7   | Estratégia de migração entre centrais                                      | ⏳ Sem ferramenta documentada — único caminho seguro hoje é recaptura                                                                                                              |

### 8.7 Próximos passos sugeridos

1. ✅ Capturar `\d rfir_devices` e `\d rfir_remotes` — concluído (§8.2.2 / §8.2.3).
2. ⏳ Capturar `\d` das 4 tabelas restantes (§8.5).
3. Desenhar o ERD real após §8.5.
4. Identificar qual das duas junctions `ambients_*_rel` está em uso — candidata a deprecation.
5. Limpar as 3 FK constraints duplicadas em `rfir_buttons.rfir_remote_id` (manter só uma — escolher CASCADE ou SET NULL conforme regra de negócio).
6. Documentar o procedimento oficial de recaptura IR pós-troca de hardware.
7. Documentar o padrão "1 hardware → N devices lógicos" no glossário do projeto (afeta também outros tipos de slave — ex.: `outlet` com `presence_sensor`s).

---

## 9. Procedimentos Comuns

### 9.1 Atualizar script JS de um shopping

```bash
# 1. Conectar via SSH
ssh -i id_rsa root@<ipv6-da-central>

# 2. Navegar até o diretório
cd <caminho-dos-scripts>

# 3. Editar o arquivo
nano <nome-do-arquivo>.js

# 4. Reiniciar Node-RED
systemctl restart nodered
```

### 9.2 Verificar se dados estão chegando ao ThingsBoard

<!-- Descrever como confirmar que a telemetria está sendo enviada:
     ex. via log, via painel TB, via debug node no Node-RED
-->

### 9.3 Reinicialização completa da central

```bash
reboot
```

---

## 10. Troubleshooting

| Problema               | Causa provável                             | Solução          |
| ---------------------- | ------------------------------------------ | ---------------- |
| Node-RED não inicia    | <!-- ex. porta 1880 em uso -->             | <!-- solução --> |
| Slaves sem leitura     | <!-- ex. cabo Modbus solto -->             | <!-- solução --> |
| Dados não chegam ao TB | <!-- ex. sem internet / token expirado --> | <!-- solução --> |

---

## 11. Observações e Boas Práticas

<!-- Adicionar dicas, avisos, particularidades de instalação -->

---

_Última atualização: 2026-06-30_
