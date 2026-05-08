# Central Raiz Educação — Dados, Assets e Conhecimento

> Documento vivo com inventário técnico da Central Raiz Educação (Holding Raiz Educação).
> Referência operacional: [manual-centrais-linix-orangepi.md](../GLOBAL_INFO/manual-centrais-linix-orangepi.md).

---

## 1. Identificação

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| Holding       | Raiz Educação                                  |
| Central       | Central Raiz Educação                          |
| IPv6 (mesh)   | `201:3bed:541b:8c61:3e69:9:d453:1bef`          |
| Gateway ID    | — <!-- preencher com UUID ThingsBoard -->      |
| Hardware      | Orange Pi <!-- modelo a confirmar -->          |
| SO            | <!-- Armbian / Ubuntu — a confirmar -->        |
| Node-RED      | <!-- versão a confirmar -->                    |
| Porta Node-RED| `1880`                                         |

Conexão SSH:
```bash
ssh -i id_rsa root@201:3bed:541b:8c61:3e69:9:d453:1bef
```

---

## 2. PostgreSQL

| Campo     | Valor                     |
| --------- | ------------------------- |
| Usuário   | `hubot`                   |
| Host      | `/var/run/postgresql`     |
| Porta     | `5432` (padrão)           |
| Database  | `hubot`                   |

Conexão:
```bash
psql -U hubot -h /var/run/postgresql
```

### 2.1 Schema `public` — lista de tabelas (`\dt`)

Captura em 2026-04-22 — **27 tabelas**.

```
hubot=# \dt
                 List of relations
 Schema |           Name            | Type  | Owner
--------+---------------------------+-------+-------
 public | SequelizeMeta             | table | hubot
 public | alarms                    | table | hubot
 public | alert_history             | table | hubot
 public | ambient_permissions       | table | hubot
 public | ambients                  | table | hubot
 public | ambients_rfir_devices_rel | table | hubot
 public | ambients_rfir_slaves_rel  | table | hubot
 public | channel_pulse_log         | table | hubot
 public | channels                  | table | hubot
 public | consumption               | table | hubot
 public | consumption_alerts        | table | hubot
 public | consumption_realtime      | table | hubot
 public | environment               | table | hubot
 public | favorites                 | table | hubot
 public | logs                      | table | hubot
 public | metadata                  | table | hubot
 public | node_red_persistence      | table | hubot
 public | raw_energy                | table | hubot
 public | rfir_buttons              | table | hubot
 public | rfir_commands             | table | hubot
 public | rfir_devices              | table | hubot
 public | rfir_remotes              | table | hubot
 public | scenes                    | table | hubot
 public | schedules                 | table | hubot
 public | slaves                    | table | hubot
 public | temperature_history       | table | hubot
 public | users                     | table | hubot
(27 rows)
```

> **Diferença vs. Central Dimension**: aqui **não existe** `schema_migrations` (só `SequelizeMeta`). Dimension tem as duas — provável divergência histórica de versão do bootstrap. Confirmar se impacta rollouts de migration.

### 2.2 Agrupamento funcional das tabelas

Inferência inicial pelo nome — revalidar com `\d <tabela>` quando for mexer.

| Grupo                   | Tabelas                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| Migrations / schema     | `SequelizeMeta`                                                                  |
| Usuários / permissões   | `users`, `ambient_permissions`, `favorites`                                      |
| Ambientes / locais      | `ambients`, `environment`                                                        |
| Dispositivos / escravos | `slaves`, `channels`, `channel_pulse_log`                                        |
| Energia                 | `consumption`, `consumption_realtime`, `consumption_alerts`, `raw_energy`        |
| Temperatura             | `temperature_history`                                                            |
| Alarmes / alertas       | `alarms`, `alert_history`                                                        |
| RFIR (controle remoto)  | `rfir_devices`, `rfir_buttons`, `rfir_commands`, `rfir_remotes`, `ambients_rfir_devices_rel`, `ambients_rfir_slaves_rel` |
| Automação               | `scenes`, `schedules`                                                            |
| Node-RED / sistema      | `node_red_persistence`, `logs`, `metadata`                                       |

### 2.3 Comandos rápidos

```sql
-- Estrutura de uma tabela
\d slaves
\d+ slaves       -- inclui tamanho e storage

-- Contagem
SELECT COUNT(*) FROM slaves;
SELECT COUNT(*) FROM consumption_realtime;

-- Tamanho das tabelas
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
```

### 2.4 Schema `public.slaves`

<!-- Preencher com saída de `\d slaves` quando inspecionado -->

### 2.5 Exemplos de consultas executadas

Log cumulativo de queries úteis com saída real desta central. Adicionar novas abaixo com data + notas.

#### 2026-04-22 — Inventário completo de slaves (`SELECT * FROM slaves`)

```sql
SELECT * FROM slaves;
```

**Total: 55 slaves ativos.**

Distribuição por `type` e código de produto:

| Tipo                  | Qtd | Código (`code`)    | Versão firmware (`version`) | Observação                                |
| --------------------- | --- | ------------------ | --------------------------- | ----------------------------------------- |
| `infrared`            | 35  | `002-002-002-014`  | `7.0.0`                     | RM (remotes) + 1× AC 34                   |
| `three_phase_sensor`  | 13  | `002-002-002-015`  | `6.0.0`                     | Medidores trifásicos (3 canais cada = 39 canais) |
| `outlet`              | 7   | `002-002-002-012`  | `6.0.0`                     | SW (tomadas/switches) — 2 canais cada    |

**Infrared (RM / AC)** — 35 dispositivos (todos `channels=1`):

| Faixa de nome | IDs presentes                                                   | Nomes faltantes |
| ------------- | --------------------------------------------------------------- | --------------- |
| RM 1–15       | 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15                             | —               |
| RM 17–34      | 17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34           | RM 16           |
| RM 38         | 38                                                              | RM 35,36,37     |
| AC 34         | 1 (slave id=52) — único AC                                      | —               |

**Three-phase sensor (3F)** — 13 dispositivos (todos `channels=3`):

| Nome            | Slave id | addr_low | addr_high |
| --------------- | -------- | -------- | --------- |
| 3F 3 / 1 / 11   | 1        | 83       | 248       |
| 3F 9 / 10 / 6   | 2        | 226      | 248       |
| 3F 5 / 7 / 8    | 3        | 250      | 249       |
| 3F 4 / 12 / 2   | 4        | 93       | 249       |
| 3F 36 / 37 / 38 | 5        | 138      | 249       |
| 3F 33 / 34 / 35 | 6        | 160      | 248       |
| 3F 30 / 31 / 32 | 7        | 215      | 248       |
| 3F 27 / 28 / 29 | 8        | 178      | 249       |
| 3F 24 / 25 / 26 | 9        | 254      | 248       |
| 3F 14 / 13 / 18 | 10       | 157      | 249       |
| 3F 16 / 15 / 17 | 11       | 63       | 248       |
| 3F 22 / X / 23  | 13       | 112      | 249       |
| 3F 19 / 20 / 21 | 18       | 53       | 249       |

> **Anomalia**: `3F 22 / X / 23` (id=13) tem `X` no canal central — canal não mapeado / não instalado. Revisar no campo.
> `clamp_type = 0` na maioria; ids 13 e 18 têm `config = {"config_clamp":{"confirmed":true,"value":0}}`.

**Outlets (SW)** — 7 dispositivos (todos `channels=2`):

| Nome  | Slave id | addr_low | addr_high | Config                                                     |
| ----- | -------- | -------- | --------- | ---------------------------------------------------------- |
| SW 5  | 57       | 95       | 248       | channelConfig ch0+ch1 REMOTE_INPUT/HOLDING                 |
| SW 6  | 56       | 153      | 249       | —                                                          |
| SW 7  | 60       | 20       | 249       | —                                                          |
| SW 19 | 58       | 224      | 248       | channelConfig só ch0                                        |
| SW 20 | 59       | 190      | 249       | —                                                          |
| SW 21 | 53       | 94       | 249       | channelConfig ch0+ch1 REMOTE_INPUT/HOLDING                 |
| SW 25 | 54       | 85       | 249       | channelConfig ch0+ch1 + config_clamp + config_temperature |

**Linha do tempo de provisionamento** (pelo `created_at`):

| Período         | Qtd criados | Principais                              |
| --------------- | ----------- | --------------------------------------- |
| 2025-04-12      | 8           | Todos os 3F iniciais (ids 1–11)         |
| 2025-04-19      | 8           | 3F 19/20/21, 3F 22/X/23 + RMs           |
| 2025-04-26      | 10          | Lote de RMs                             |
| 2025-05-02      | 9           | Lote de RMs                             |
| 2025-06-02      | 3           | RM 28, 29, 9                            |
| 2025-06-28      | 2           | RM 2, RM 4                              |
| 2025-07-19      | 1           | AC 34                                   |
| 2025-09-09      | 1           | SW 21                                   |
| 2025-09-27      | 1           | SW 25                                   |
| 2025-10-11      | 4           | SW 5, 6, 19, 20                         |

**Resultado completo (saída bruta `SELECT * FROM slaves;`)**:

```
 id |        type        | addr_low | addr_high | channels |      name       | color |      code       | clamp_type | aggregate | version | temperature_correction | config                                                                                                                                                                                                                 |          created_at           |         updated_at
----+--------------------+----------+-----------+----------+-----------------+-------+-----------------+------------+-----------+---------+------------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+-------------------------------+----------------------------
 20 | infrared           |      230 |       248 |        1 | RM 15           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-19 19:31:38.171865+00 | 2025-05-11 05:26:48.951+00
 53 | outlet             |       94 |       249 |        2 | SW 21           |       | 002-002-002-012 |            | t         | 6.0.0   |                        | {"channelConfig":{"channel0":{"slaveId":53,"channel":0,"channel_type":"REMOTE_INPUT","pulses":1,"output":"HOLDING"},"channel1":{"slaveId":53,"channel":1,"channel_type":"REMOTE_INPUT","pulses":1,"output":"HOLDING"}}} | 2025-09-09 21:43:50.462733+00 | 2025-10-16 22:25:24.178+00
 47 | infrared           |      208 |       248 |        1 | RM 29           |       | 002-002-002-014 |            | t         | 7.0.0   |                        |                                                                                                                                                                                                                        | 2025-06-02 10:42:06.090545+00 | 2025-06-02 11:18:00.309+00
 48 | infrared           |      119 |       248 |        1 | RM 28           |       | 002-002-002-014 |            | t         | 7.0.0   |                        |                                                                                                                                                                                                                        | 2025-06-02 10:52:36.525443+00 | 2025-06-02 11:18:28.976+00
 21 | infrared           |       19 |       249 |        1 | RM 14           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-19 19:48:20.511303+00 | 2025-05-11 05:27:56.028+00
 22 | infrared           |       28 |       248 |        1 | RM 30           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-19 20:04:21.802878+00 | 2025-05-11 05:28:35.212+00
  6 | three_phase_sensor |      160 |       248 |        3 | 3F 33 / 34 / 35 |       | 002-002-002-015 |          0 | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 16:35:00.233144+00 | 2025-05-05 23:20:32.825+00
 49 | infrared           |        3 |       249 |        1 | RM 9            |       | 002-002-002-014 |            | t         | 7.0.0   |                        |                                                                                                                                                                                                                        | 2025-06-02 11:50:58.623685+00 | 2025-06-02 11:51:12.821+00
  5 | three_phase_sensor |      138 |       249 |        3 | 3F 36 / 37 / 38 |       | 002-002-002-015 |          0 | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 16:31:21.949119+00 | 2025-05-05 23:22:44.844+00
 19 | infrared           |       51 |       249 |        1 | RM 21           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-19 18:50:55.779566+00 | 2025-05-11 05:38:24.094+00
 45 | infrared           |      164 |       249 |        1 | RM 12           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-05-02 19:56:37.087294+00 | 2025-05-11 05:38:51.676+00
 23 | infrared           |       61 |       248 |        1 | RM 23           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-19 20:13:16.263134+00 | 2025-05-11 05:29:41.944+00
 43 | infrared           |      133 |       249 |        1 | RM 24           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-05-02 17:35:33.850776+00 | 2025-05-11 05:39:13.241+00
 33 | infrared           |       18 |       249 |        1 | RM 18           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 17:26:13.370553+00 | 2025-05-11 05:39:45.916+00
 60 | outlet             |       20 |       249 |        2 | SW 7            |       | 002-002-002-012 |            | t         | 6.0.0   |                        |                                                                                                                                                                                                                        | 2025-10-11 18:35:46.975975+00 | 2025-10-16 22:26:00.766+00
 26 | infrared           |       25 |       249 |        1 | RM 13           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 14:00:54.795496+00 | 2025-05-11 05:30:42.528+00
 52 | infrared           |       44 |       249 |        1 | AC 34           |       | 002-002-002-014 |            | t         | 7.0.0   |                        |                                                                                                                                                                                                                        | 2025-07-19 13:34:19.602518+00 | 2025-07-19 13:39:45.943+00
 14 | infrared           |       76 |       248 |        1 | RM 5            |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-19 15:00:35.313729+00 | 2025-05-11 05:03:31.132+00
 29 | infrared           |      238 |       249 |        1 | RM 31           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 16:53:20.991899+00 | 2025-05-11 05:31:43.795+00
 27 | infrared           |      245 |       248 |        1 | RM 38           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 14:09:56.503778+00 | 2025-05-11 05:33:04+00
 28 | infrared           |      199 |       248 |        1 | RM 26           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 16:11:07.059717+00 | 2025-05-11 05:33:42.274+00
 24 | infrared           |       40 |       249 |        1 | RM 8            |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 13:04:43.71249+00  | 2025-10-24 15:32:10.978+00
 50 | infrared           |       93 |       248 |        1 | RM 4            |       | 002-002-002-014 |            | t         | 7.0.0   |                        |                                                                                                                                                                                                                        | 2025-06-28 12:40:12.292729+00 | 2025-06-28 13:08:56.482+00
 34 | infrared           |      175 |       249 |        1 | RM 17           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 18:05:33.613648+00 | 2025-05-11 05:40:21.236+00
 39 | infrared           |      137 |       248 |        1 | RM 32           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-05-02 14:54:03.275973+00 | 2025-05-11 05:35:30.127+00
  4 | three_phase_sensor |       93 |       249 |        3 | 3F 4 / 12 / 2   |       | 002-002-002-015 |            | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 14:40:39.374359+00 | 2025-05-11 05:40:59.033+00
 41 | infrared           |       48 |       248 |        1 | RM 22           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-05-02 15:30:39.415004+00 | 2025-05-11 05:36:10.001+00
 38 | infrared           |      140 |       248 |        1 | RM 10           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-05-02 13:37:55.966776+00 | 2025-05-11 05:36:23.481+00
 42 | infrared           |       24 |       249 |        1 | RM 34           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-05-02 16:34:19.345423+00 | 2025-05-11 05:37:02.046+00
 30 | infrared           |       66 |       249 |        1 | RM 3            |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 16:57:15.536272+00 | 2025-06-28 13:09:35.763+00
 11 | three_phase_sensor |       63 |       248 |        3 | 3F 16 / 15 / 17 |       | 002-002-002-015 |          0 | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 17:04:34.585054+00 | 2025-05-11 05:42:20.515+00
 10 | three_phase_sensor |      157 |       249 |        3 | 3F 14 / 13 / 18 |       | 002-002-002-015 |          0 | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 17:03:45.907875+00 | 2025-05-11 05:42:42.875+00
  2 | three_phase_sensor |      226 |       248 |        3 | 3F 9 / 10 / 6   |       | 002-002-002-015 |          0 | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 13:58:28.456869+00 | 2025-05-11 05:43:04.806+00
 51 | infrared           |       31 |       248 |        1 | RM 2            |       | 002-002-002-014 |            | t         | 7.0.0   |                        |                                                                                                                                                                                                                        | 2025-06-28 13:32:40.641805+00 | 2025-08-09 13:25:51.733+00
  3 | three_phase_sensor |      250 |       249 |        3 | 3F 5 / 7 / 8    |       | 002-002-002-015 |          0 | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 14:16:21.212894+00 | 2025-05-11 05:43:57.868+00
  1 | three_phase_sensor |       83 |       248 |        3 | 3F 3 / 1 / 11   |       | 002-002-002-015 |          0 | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 13:48:43.671319+00 | 2025-05-30 02:53:25.855+00
 25 | infrared           |      194 |       248 |        1 | RM 1            |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 13:43:37.264396+00 | 2025-08-09 13:26:46.737+00
 13 | three_phase_sensor |      112 |       249 |        3 | 3F 22 / X / 23  |       | 002-002-002-015 |            | t         | 6.0.0   |                      0 | {"config_clamp":{"confirmed":true,"value":0}}                                                                                                                                                                          | 2025-04-19 14:21:01.316381+00 | 2025-05-05 23:12:30.789+00
 18 | three_phase_sensor |       53 |       249 |        3 | 3F 19 / 20 / 21 |       | 002-002-002-015 |            | t         | 6.0.0   |                      0 | {"config_clamp":{"confirmed":true,"value":0}}                                                                                                                                                                          | 2025-04-19 17:57:54.711656+00 | 2025-05-05 23:12:47.36+00
  9 | three_phase_sensor |      254 |       248 |        3 | 3F 24 / 25 / 26 |       | 002-002-002-015 |          0 | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 16:42:05.666441+00 | 2025-05-05 23:15:13.404+00
  8 | three_phase_sensor |      178 |       249 |        3 | 3F 27 / 28 / 29 |       | 002-002-002-015 |          0 | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 16:40:21.515966+00 | 2025-05-05 23:16:40.316+00
  7 | three_phase_sensor |      215 |       248 |        3 | 3F 30 / 31 / 32 |       | 002-002-002-015 |          0 | t         | 6.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-12 16:37:14.226278+00 | 2025-05-05 23:18:37.752+00
 16 | infrared           |      118 |       248 |        1 | RM 7            |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-19 17:03:11.152676+00 | 2025-05-11 05:13:38.227+00
 15 | infrared           |      200 |       248 |        1 | RM 6            |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-19 15:51:18.804213+00 | 2025-05-11 05:14:27.636+00
 40 | infrared           |      243 |       249 |        1 | RM 27           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-05-02 15:27:51.457301+00 | 2025-05-11 05:37:17.137+00
 36 | infrared           |      145 |       248 |        1 | RM 19           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 19:13:56.63146+00  | 2025-05-11 05:21:11.241+00
 35 | infrared           |       87 |       248 |        1 | RM 20           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-04-26 19:05:24.442859+00 | 2025-05-11 05:22:27.974+00
 44 | infrared           |       74 |       248 |        1 | RM 11           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-05-02 18:46:09.516835+00 | 2025-05-11 05:24:25.879+00
 57 | outlet             |       95 |       248 |        2 | SW 5            |       | 002-002-002-012 |            | t         | 6.0.0   |                        | {"channelConfig":{"channel0":{"slaveId":57,"channel":0,"channel_type":"REMOTE_INPUT","pulses":1,"output":"HOLDING"},"channel1":{"slaveId":57,"channel":1,"channel_type":"REMOTE_INPUT","pulses":1,"output":"HOLDING"}}} | 2025-10-11 16:20:49.045799+00 | 2025-10-16 22:22:34.906+00
 37 | infrared           |       78 |       248 |        1 | RM 25           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-05-02 13:17:36.837933+00 | 2025-10-24 15:31:37.899+00
 56 | outlet             |      153 |       249 |        2 | SW 6            |       | 002-002-002-012 |            | t         | 6.0.0   |                        |                                                                                                                                                                                                                        | 2025-10-11 14:37:46.19916+00  | 2025-10-16 22:23:31.917+00
 59 | outlet             |      190 |       249 |        2 | SW 20           |       | 002-002-002-012 |            | t         | 6.0.0   |                        |                                                                                                                                                                                                                        | 2025-10-11 17:49:36.748986+00 | 2025-10-16 22:24:42.491+00
 54 | outlet             |       85 |       249 |        2 | SW 25           |       | 002-002-002-012 |            | t         | 6.0.0   |                        | {"channelConfig":{"channel1":{"slaveId":54,"channel":1,"channel_type":"REMOTE_INPUT","pulses":1,"output":"HOLDING"},"channel0":{"slaveId":54,"channel":0,"channel_type":"REMOTE_INPUT","pulses":1,"output":"HOLDING"}},"config_clamp":{"confirmed":true,"value":null},"config_temperature":{"confirmed":true,"value":0}} | 2025-09-27 13:43:31.907696+00 | 2025-10-16 22:25:01.78+00
 46 | infrared           |       99 |       249 |        1 | RM 33           |       | 002-002-002-014 |            | t         | 7.0.0   |                      0 |                                                                                                                                                                                                                        | 2025-05-02 20:03:31.478827+00 | 2025-10-24 15:31:01.952+00
 58 | outlet             |      224 |       248 |        2 | SW 19           |       | 002-002-002-012 |            | t         | 6.0.0   |                        | {"channelConfig":{"channel0":{"slaveId":58,"channel":0,"channel_type":"REMOTE_INPUT","pulses":1,"output":"HOLDING"}}}                                                                                                   | 2025-10-11 17:11:32.756129+00 | 2025-10-16 22:25:42.349+00
(55 rows)
```

Notas agregadas:
- **Padrão de códigos** — 3 famílias de hardware em uso, cada uma com `code` próprio: `-014` (infrared), `-015` (three_phase_sensor), `-012` (outlet). `code` parece identificar SKU/firmware base, não é único por slave.
- **`addr_low`/`addr_high`** — compõem o endereço Modbus do slave no barramento. `addr_high` sempre 248 ou 249.
- **`config` JSON** — só populado em slaves que exigem configuração adicional (outlets com `channelConfig`, e dois 3F com `config_clamp`). Slaves com `config` nulo operam com defaults.
- **`temperature_correction`** — `0` em grande parte dos provisionamentos até 2025-05; `NULL` nos slaves criados depois disso (mudança de bootstrap?).
- **Gaps de naming** — ausência de RM 16, 35, 36, 37 no inventário; anomalia `3F 22 / X / 23` com canal não mapeado.

### 2.6 Modelo RFIR — caso `RM 5` / `AC 5` (capturado em 2026-05-04)

Investigação do mapeamento UI → BD para entender como um único hardware
expõe múltiplos devices lógicos. Schemas completos no manual global —
[`manual-centrais-linix-orangepi.md`](../GLOBAL_INFO/manual-centrais-linix-orangepi.md) §8.

#### 2.6.1 Schema `rfir_devices`

```
        Column     |    Type     | FK
   ----------------+-------------+--------------------------------
    id             | integer     | PK
    type           | varchar     |
    category       | varchar     |
    name           | varchar     |
    output         | varchar     |
    slave_id       | integer     | → slaves.id (ON DELETE SET NULL)
    command_on_id  | integer     | → rfir_commands.id (nullable)
    command_off_id | integer     | → rfir_commands.id (nullable)
    created_at     | timestamptz |
    updated_at     | timestamptz |
```

#### 2.6.2 Schema `rfir_remotes`

```
        Column     |    Type     | FK
   ----------------+-------------+-----------------------------------
    id             | integer     | PK
    name           | varchar     |
    rfir_device_id | integer     | → rfir_devices.id (ON DELETE SET NULL)
    created_at     | timestamptz |
    updated_at     | timestamptz |
```

> ⚠️ `rfir_buttons.rfir_remote_id` tem **3 FK constraints duplicadas** com
> `ON DELETE` divergente (1 SET NULL + 2 CASCADE). Débito técnico — ver
> manual §8.4 item 3.

#### 2.6.3 Resultado das queries

```sql
SELECT * FROM rfir_devices WHERE name ILIKE 'AC 5' OR name ILIKE 'RM 5';
```

| id | type | category | name | output | slave_id | command_on_id | command_off_id | created_at                |
| -- | ---- | -------- | ---- | ------ | -------- | ------------- | -------------- | ------------------------- |
| 1  | ir   | other    | AC 5 | both   | 14       | NULL          | NULL           | 2025-04-19 15:01:07.48+00 |

```sql
SELECT * FROM rfir_remotes WHERE name ILIKE 'AC 5' OR name ILIKE 'RM 5';
```

→ **0 rows.**

#### 2.6.4 Interpretação

A UI mostra um agrupador "Remote RM 5" contendo 2 devices: **`AC 5`** (controle
remoto IR) e **`RM 5`** (`temperature_sensor`). O mapeamento real é:

| Item da UI                         | Origem real                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hardware físico (blaster IR)**   | `slaves.id=14`, `name='RM 5'`, `type='infrared'`, `code='002-002-002-014'`, `version='7.0.0'`, `temperature_correction=0`                                                                |
| **`AC 5` (UI: controle remoto IR)**| `rfir_devices.id=1`, `name='AC 5'`, `type='ir'`, `category='other'`, `output='both'`, `slave_id=14` ← aponta direto pro slave RM 5                                                       |
| **`RM 5` (UI: `temperature_sensor`)** | **Sintetizado direto do `slaves.id=14`** quando `temperature_correction IS NOT NULL`. Não tem linha em `rfir_devices` nem em `rfir_remotes`. O firmware 7.0.0 do blaster expõe um termômetro embutido. |

Diagrama:

```
slaves.id=14 (hardware)
   │  type=infrared, name="RM 5", temperature_correction=0
   │
   ├──► rfir_devices.id=1 (lógico, slave_id=14)         ──► UI: device "AC 5" (controle remoto IR)
   │       │
   │       └──► (rfir_buttons → rfir_commands → flash do RM 5)  ← cadeia a investigar
   │
   └──► (sem linha em rfir_*)                           ──► UI: device "RM 5" (temperature_sensor)
                                                              ↑ derivado do próprio slave
```

#### 2.6.5 Observações úteis pra rediscussão

1. **`rfir_remotes` está vazio** para esse `rfir_device` — o nível "remote" é
   opcional. Em `AC 5` os comandos provavelmente são endereçados via
   `rfir_devices.command_on_id`/`command_off_id` direto (mas as duas colunas
   estão `NULL` aqui, então também não é por aí — investigar onde os comandos
   ON/OFF do `AC 5` realmente residem; pode ser que os botões não estejam
   capturados ainda).
2. O mesmo padrão "1 hardware → N devices lógicos" foi observado também em
   QTAs de gerador (slave `outlet` → 2 `presence_sensor`) — ver
   [`investigation-gerador-4-startup-time.md`](../SOUZA-AGUIAR/CENTRAL-GERADOR/investigation-gerador-4-startup-time.md) §6.5.
3. Inventários da UI não podem assumir 1:1 entre `rfir_devices` e itens
   visíveis: alguns devices lógicos (`temperature_sensor` aqui) são derivados
   diretamente de `slaves` sem linha em `rfir_*`.

---

## 3. Assets

<!-- Inventário físico / credenciais de equipamentos instalados na Central Raiz Educação -->

### 3.1 Hardware
- [ ] Orange Pi — modelo / serial / MAC
- [ ] UPS / nobreak — modelo
- [ ] Switch — modelo / portas
- [ ] Modem / roteador — provedor

### 3.2 Dispositivos de campo
- [ ] Medidores (modelo, quantidade, Modbus ID)
- [ ] Escravos RFIR
- [ ] Termostatos
- [ ] Hidrômetros

### 3.3 Acessos
- [ ] VPN (WireGuard) — endpoint / chave pública
- [ ] Cliente / contato técnico local
- [ ] ThingsBoard tenant / customer

---

## 4. Conhecimento / Runbook

<!-- Particularidades operacionais desta central que não se aplicam às demais -->

### 4.1 Integrações específicas
- [ ] Sistemas externos (SCADA, Niagara, Daikin, etc.)
- [ ] Gateways Modbus adicionais

### 4.2 Incidentes e aprendizados
- [ ] Histórico de incidentes relevantes

### 4.3 Configurações customizadas
- [ ] Flows Node-RED específicos desta central
- [ ] Variáveis de ambiente / settings diferentes do padrão

---

## 5. Histórico do documento

| Data       | Autor               | Alteração                                        |
| ---------- | ------------------- | ------------------------------------------------ |
| 2026-04-22 | rplago@gmail.com    | Criação inicial — identificação + `\dt` (27 tabelas) |
| 2026-05-04 | rplago@gmail.com    | §2.6 — modelo RFIR `RM 5`/`AC 5` capturado (`\d rfir_devices`, `\d rfir_remotes`, queries) |
