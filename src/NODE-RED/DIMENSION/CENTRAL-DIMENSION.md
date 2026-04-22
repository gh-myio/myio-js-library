# Central Dimension — Dados, Assets e Conhecimento

> Documento vivo com inventário técnico da Central Dimension (Holding Dimension).
> Referência operacional: [manual-centrais-linix-orangepi.md](../GLOBAL_INFO/manual-centrais-linix-orangepi.md).

---

## 1. Identificação

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| Holding       | Dimension                                      |
| Central       | Central Dimension                              |
| IPv6 (mesh)   | `203:984:24ef:b578:69a6:7136:b9f2:b5c2`        |
| Gateway ID    | — <!-- preencher com UUID ThingsBoard -->      |
| Hardware      | Orange Pi <!-- modelo a confirmar -->          |
| SO            | <!-- Armbian / Ubuntu — a confirmar -->        |
| Node-RED      | <!-- versão a confirmar -->                    |
| Porta Node-RED| `1880`                                         |

Conexão SSH:
```bash
ssh -i id_rsa root@203:984:24ef:b578:69a6:7136:b9f2:b5c2
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

Captura em 2026-04-22 — **28 tabelas**.

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
 public | schema_migrations         | table | hubot
 public | slaves                    | table | hubot
 public | temperature_history       | table | hubot
 public | users                     | table | hubot
(28 rows)
```

### 2.2 Agrupamento funcional das tabelas

Inferência inicial pelo nome — revalidar com `\d <tabela>` quando for mexer.

| Grupo                 | Tabelas                                                                          |
| --------------------- | -------------------------------------------------------------------------------- |
| Migrations / schema   | `SequelizeMeta`, `schema_migrations`                                             |
| Usuários / permissões | `users`, `ambient_permissions`, `favorites`                                      |
| Ambientes / locais    | `ambients`, `environment`                                                        |
| Dispositivos / escravos | `slaves`, `channels`, `channel_pulse_log`                                      |
| Energia               | `consumption`, `consumption_realtime`, `consumption_alerts`, `raw_energy`        |
| Temperatura           | `temperature_history`                                                            |
| Alarmes / alertas     | `alarms`, `alert_history`                                                        |
| RFIR (controle remoto)| `rfir_devices`, `rfir_slaves` (rel), `rfir_buttons`, `rfir_commands`, `rfir_remotes`, `ambients_rfir_devices_rel`, `ambients_rfir_slaves_rel` |
| Automação             | `scenes`, `schedules`                                                            |
| Node-RED / sistema    | `node_red_persistence`, `logs`, `metadata`                                       |

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

Estrutura (captura 2026-04-22):

```
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
Indexes:
    "slaves_pkey" PRIMARY KEY, btree (id)
Referenced by (FKs de chunks do TimescaleDB):
    _timescaledb_internal._hyper_1_100_chunk (consumption_realtime.slave_id) ON DELETE CASCADE
    _timescaledb_internal._hyper_4_101_chunk (temperature_history.slave_id)  ON DELETE SET NULL
    _timescaledb_internal._hyper_1_103_chunk (consumption_realtime.slave_id) ON DELETE CASCADE
    _timescaledb_internal._hyper_4_104_chunk (temperature_history.slave_id)  ON DELETE SET NULL
```

Observações:
- `consumption_realtime` e `temperature_history` são **hypertables TimescaleDB** — por isso as FKs aparecem em chunks `_hyper_*`.
- `aggregate` default `true`; `version` default `'1.0.0'`.
- Sem índice único por `name` — pode haver homônimos; busca sempre com `LOWER(TRIM(name))`.

### 2.5 Exemplos de consultas executadas

Log cumulativo de queries úteis com saída real desta central. Adicionar novas abaixo (mais recente no topo ou com data — manter formato).

#### 2026-04-22 — Buscar slave por nome (case/space-insensitive)

```sql
SELECT *
FROM slaves
WHERE LOWER(TRIM(name)) = 'temp. sala';
```

Resultado:

```
 id |   type   | addr_low | addr_high | channels |    name    | color |      code       | clamp_type | aggregate | version | temperature_correction | config |          created_at           |        updated_at
----+----------+----------+-----------+----------+------------+-------+-----------------+------------+-----------+---------+------------------------+--------+-------------------------------+---------------------------
  6 | infrared |       15 |       249 |        0 | Temp. Sala |       | 042-001-002-014 |            | t         | 6.0.0   |                        |        | 2022-08-25 19:38:02.143704+00 | 2025-04-11 16:52:24.09+00
(1 row)
```

Notas do achado:
- `id = 6`, `type = infrared`, `code = 042-001-002-014`, `version = 6.0.0`.
- `addr_low=15` / `addr_high=249` → endereço Modbus do slave.
- `channels = 0` → slave de temperatura (sem canais de energia).
- Criado em 2022-08-25; última atualização 2025-04-11.

---

## 3. Assets

<!-- Inventário físico / credenciais de equipamentos instalados na Central Dimension -->

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
| 2026-04-22 | rplago@gmail.com    | Criação inicial — identificação + `\dt` (28 tabelas) |
