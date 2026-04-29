# Central Macaé — Dados, Assets e Conhecimento

> Documento vivo com inventário técnico da Central Macaé (Holding Soul Malls).
> Referência operacional: [manual-centrais-linix-orangepi.md](../../GLOBAL_INFO/manual-centrais-linix-orangepi.md).

---

## 1. Identificação

| Campo          | Valor                                          |
| -------------- | ---------------------------------------------- |
| Holding        | Soul Malls                                     |
| Central        | Macaé                                          |
| IPv6 (mesh)    | `200:bf4f:c3a0:e697:17ff:28a5:38ae:536b`       |
| Gateway ID     | `571ff592-8983-43b3-b7f2-96ab688d4f1c`         |
| Hardware       | Orange Pi <!-- modelo a confirmar -->          |
| SO             | <!-- Armbian / Ubuntu — a confirmar -->        |
| Node-RED       | <!-- versão a confirmar -->                    |
| Porta Node-RED | `1880`                                         |

Conexão SSH:
```bash
ssh -i id_rsa root@200:bf4f:c3a0:e697:17ff:28a5:38ae:536b
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

Captura em 2026-04-28 — **27 tabelas**.

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

> ⚠️ **Diferença vs. CENTRAL-DIMENSION:** Macaé **não tem** a tabela
> `schema_migrations` (Dimension tem 28 tabelas). Apenas `SequelizeMeta` é usado
> para versionamento de schema. Investigar se isso indica versão de stack
> diferente ou se é só limpeza pós-migration.

#### 2.1.1 Views e Materialized Views

Captura em 2026-04-28:

```
hubot=# \dv
Did not find any relations.

hubot=# \dm
Did not find any relations.
```

**Não há views nem matviews** (regulares ou Timescale continuous aggregates) nesta central. Todas as consultas batem direto nas tabelas. Coerente com o restante da stack — é o mesmo padrão observado nas outras centrais já documentadas.

#### 2.1.2 Inventário completo de relações (`\d`)

Captura em 2026-04-28 — **44 relações** = 27 tabelas + 17 sequências + 0 views + 0 matviews.

```
hubot=# \d
                    List of relations
 Schema |            Name             |   Type   | Owner
--------+-----------------------------+----------+-------
 public | SequelizeMeta               | table    | hubot
 public | alarms                      | table    | hubot
 public | alarms_id_seq               | sequence | hubot
 public | alert_history               | table    | hubot
 public | alert_history_id_seq        | sequence | hubot
 public | ambient_permissions         | table    | hubot
 public | ambient_permissions_id_seq  | sequence | hubot
 public | ambients                    | table    | hubot
 public | ambients_id_seq             | sequence | hubot
 public | ambients_rfir_devices_rel   | table    | hubot
 public | ambients_rfir_slaves_rel    | table    | hubot
 public | channel_pulse_log           | table    | hubot
 public | channels                    | table    | hubot
 public | channels_id_seq             | sequence | hubot
 public | consumption                 | table    | hubot
 public | consumption_alerts          | table    | hubot
 public | consumption_alerts_id_seq   | sequence | hubot
 public | consumption_id_seq          | sequence | hubot
 public | consumption_realtime        | table    | hubot
 public | consumption_realtime_id_seq | sequence | hubot
 public | environment                 | table    | hubot
 public | favorites                   | table    | hubot
 public | favorites_id_seq            | sequence | hubot
 public | logs                        | table    | hubot
 public | metadata                    | table    | hubot
 public | node_red_persistence        | table    | hubot
 public | raw_energy                  | table    | hubot
 public | raw_energy_id_seq           | sequence | hubot
 public | rfir_buttons                | table    | hubot
 public | rfir_buttons_id_seq         | sequence | hubot
 public | rfir_commands               | table    | hubot
 public | rfir_commands_id_seq        | sequence | hubot
 public | rfir_devices                | table    | hubot
 public | rfir_devices_id_seq         | sequence | hubot
 public | rfir_remotes                | table    | hubot
 public | rfir_remotes_id_seq         | sequence | hubot
 public | scenes                      | table    | hubot
 public | scenes_id_seq               | sequence | hubot
 public | schedules                   | table    | hubot
 public | schedules_id_seq            | sequence | hubot
 public | slaves                      | table    | hubot
 public | slaves_id_seq               | sequence | hubot
 public | temperature_history         | table    | hubot
 public | users                       | table    | hubot
(44 rows)
```

> ⚠️ **Curiosidade:** `consumption_realtime` aparece com `consumption_realtime_id_seq` — porém o `\d consumption_realtime` revela que a tabela **não tem coluna `id`** (ver §2.4.2). A sequência foi criada mas nunca consumida — provável resíduo de migration revertida. Não afeta operação.

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

### 2.4 Schemas das tabelas-chave

#### 2.4.1 `public.slaves`

<!-- Capturar com `\d slaves` na primeira sessão SSH e colar aqui. -->

#### 2.4.2 `public.consumption_realtime`

Captura em 2026-04-28:

```
hubot=# \d consumption_realtime
                       Table "public.consumption_realtime"
     Column     |            Type             | Collation | Nullable |  Default
----------------+-----------------------------+-----------+----------+-----------
 timestamp      | timestamp(0) with time zone |           | not null | now()
 slave_id       | integer                     |           | not null |
 value          | real                        |           | not null |
 value_reactive | real                        |           |          | '0'::real
Indexes:
    "consumption_realtime_slave_id_timestamp" btree (slave_id, "timestamp")
Foreign-key constraints:
    "consumption_realtime_slave_id_fkey" FOREIGN KEY (slave_id) REFERENCES slaves(id) ON UPDATE CASCADE ON DELETE CASCADE
Triggers:
    ts_insert_blocker BEFORE INSERT ON consumption_realtime FOR EACH ROW EXECUTE PROCEDURE _timescaledb_internal.insert_blocker()
Number of child tables: 15 (Use \d+ to list them.)
```

Observações:

- **Hypertable Timescale** com 15 chunks. Consultas batem na tabela pai e o Timescale roteia automaticamente.
- **Sem coluna `id`** apesar de existir uma `consumption_realtime_id_seq` órfã.
- **Sem `ambient_id` nem `type`** — diferente da `consumption` (esta última está vazia, ver §2.5).
- `value_reactive` é potência reativa (kVAr), default `0`.
- `timestamp(0)` = precisão de 1 segundo (sem milissegundos).
- Índice `(slave_id, timestamp)` favorece queries filtradas por device.

### 2.5 Distribuição de dados — onde os registros realmente moram

Captura em 2026-04-28:

```sql
SELECT 'consumption'           AS tbl, COUNT(*) FROM consumption
UNION ALL
SELECT 'consumption_realtime',        COUNT(*) FROM consumption_realtime
UNION ALL
SELECT 'consumption_alerts',          COUNT(*) FROM consumption_alerts
UNION ALL
SELECT 'raw_energy',                  COUNT(*) FROM raw_energy
UNION ALL
SELECT 'temperature_history',         COUNT(*) FROM temperature_history
ORDER BY tbl;
```

```
         tbl          |  count
----------------------+---------
 consumption          |       0
 consumption_alerts   |       0
 consumption_realtime | 2525062
 raw_energy           |       0
 temperature_history  |       0
(5 rows)
```

**Achados:**

- ✅ **`consumption_realtime`** é a única tabela com dados (~2.5M linhas) — telemetria granular real.
- ❌ **`consumption`**, **`consumption_alerts`**, **`raw_energy`** estão vazias. Provavelmente vestígios de design antigo nunca populados nesta central. **Não usar em queries.**
- ❌ **`temperature_history`** vazia → Macaé é central **só de energia**, sem termostato/sensor de temperatura.

> 💡 **Implicação prática:** queries de consumo histórico **devem** rodar contra `consumption_realtime`. Bater em `consumption` retorna sempre 0 linhas.

### 2.6 Exemplos de consultas executadas

Log cumulativo de queries úteis com saída real desta central.

#### 2026-04-28 — Janela 22h dia 26 → 04h dia 27 (BRT) com nome do device

Cenário: investigar o gap de telemetria em torno do reboot da central
(boot em ~02:39 BRT do dia 27).

```sql
SELECT
  cr.timestamp AT TIME ZONE 'America/Sao_Paulo' AS ts_brt,
  cr.timestamp                                  AS ts_utc,
  cr.slave_id,
  s.name                                        AS slave_name,
  s.type                                        AS slave_type,
  cr.value,
  cr.value_reactive
FROM consumption_realtime cr
LEFT JOIN slaves s ON s.id = cr.slave_id
WHERE cr.timestamp >= '2026-04-26 22:00:00-03'
  AND cr.timestamp <  '2026-04-27 04:00:00-03'
ORDER BY cr.timestamp, cr.slave_id;
```

Notas:
- Brasília é UTC-3 fixo (sem horário de verão desde 2019). Literais com offset
  `-03` funcionam independente do `TimeZone` da sessão (que neste server é UTC).
- Range half-open (`>=` ... `<`) evita perda de microssegundos no limite superior.

#### 2026-04-28 — Distribuição por hora (visualizar gap do reboot)

```sql
SELECT
  date_trunc('hour', timestamp AT TIME ZONE 'America/Sao_Paulo') AS hora_brt,
  COUNT(*)                  AS rows,
  COUNT(DISTINCT slave_id)  AS slaves_ativos
FROM consumption_realtime
WHERE timestamp >= '2026-04-26 22:00:00-03'
  AND timestamp <  '2026-04-27 04:00:00-03'
GROUP BY 1
ORDER BY 1;
```

Esperado: rows densas até ~22:xx do dia 26 → gap silencioso (central down) →
rows reaparecendo após ~02:39 BRT do dia 27.

#### 2026-04-28 — Agregado por slave na janela

```sql
SELECT
  cr.slave_id,
  s.name                                    AS slave_name,
  s.type                                    AS slave_type,
  COUNT(*)                                  AS samples,
  ROUND(AVG(cr.value)::numeric, 2)          AS avg_val,
  ROUND(MIN(cr.value)::numeric, 2)          AS min_val,
  ROUND(MAX(cr.value)::numeric, 2)          AS max_val,
  ROUND(SUM(cr.value)::numeric, 2)          AS sum_val,
  ROUND(AVG(cr.value_reactive)::numeric, 2) AS avg_reactive
FROM consumption_realtime cr
LEFT JOIN slaves s ON s.id = cr.slave_id
WHERE cr.timestamp >= '2026-04-26 22:00:00-03'
  AND cr.timestamp <  '2026-04-27 04:00:00-03'
GROUP BY cr.slave_id, s.name, s.type
ORDER BY samples DESC;
```

#### 2026-04-28 — Range total dos dados

```sql
SELECT
  COUNT(*) AS total_rows,
  MIN(timestamp) AT TIME ZONE 'America/Sao_Paulo' AS oldest_brt,
  MAX(timestamp) AT TIME ZONE 'America/Sao_Paulo' AS newest_brt,
  MIN(timestamp)                              AS oldest_utc,
  MAX(timestamp)                              AS newest_utc
FROM consumption_realtime;
```

Útil pra responder "desde quando essa central grava telemetria" e "quando foi
o último ponto registrado".

---

## 3. Assets

<!-- Inventário físico / credenciais de equipamentos instalados na Central Macaé -->

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
- [ ] ThingsBoard tenant / customer (Gateway ID já registrado em §1)

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

## 5. Backups Node-RED

| Arquivo                                       | Data       | Notas                |
| --------------------------------------------- | ---------- | -------------------- |
| `bkp-central-macae-20260428-1621-all-flows.json` | 2026-04-28 | Backup inicial completo |

---

_Última atualização: 2026-04-28_
