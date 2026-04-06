# Banco de Dados PostgreSQL — Timeseries nas Centrais MyIO

> **Escopo:** Estrutura e operação do banco PostgreSQL de séries temporais instalado nas centrais Orange Pi.
> **Audiência:** Técnicos e desenvolvedores MyIO.

---

## 1. Visão Geral

| Campo | Valor |
|-------|-------|
| SGBD | PostgreSQL <!-- versão: ex. 14.x --> |
| Extensão timeseries | **TimescaleDB** (`ts_insert_blocker` trigger em tabelas hypertable) |
| Usuário padrão | `hubot` |
| Banco padrão | `hubot` |
| Porta | `5432` |

---

## 2. Acesso

```bash
# Conectar localmente (já dentro da central via SSH)
psql -U hubot

# Conectar em banco específico
psql -U hubot -d <nome-do-banco>
```

---

## 3. Tabelas

### 3.1 Listagem completa (`\dt`)

```
 Schema |           Name            | Type  | Owner
--------+---------------------------+-------+-------
 public | SequelizeMeta             | table | hubot
 public | alarms                    | table | hubot
 public | alert_history             | table | hubot
 public | ambient_permissions       | table | hubot
 public | ambients                  | table | hubot
 public | ambients_rfir_devices_rel | table | hubot
 public | ambients_rfir_slaves_rel  | table | hubot
 public | channel_pulse_log         | table | hubot  ← TimescaleDB hypertable
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
```

### 3.2 Grupos por domínio

| Grupo | Tabelas |
|-------|---------|
| **Timeseries / métricas** | `channel_pulse_log`, `consumption`, `consumption_realtime`, `raw_energy`, `temperature_history` |
| **Devices / topologia** | `slaves`, `channels`, `ambients`, `ambient_permissions`, `metadata` |
| **Alertas** | `alarms`, `alert_history`, `consumption_alerts` |
| **Automação** | `scenes`, `schedules`, `favorites` |
| **RF IR** | `rfir_devices`, `rfir_remotes`, `rfir_commands`, `rfir_buttons`, `ambients_rfir_devices_rel`, `ambients_rfir_slaves_rel` |
| **Sistema** | `users`, `environment`, `logs`, `node_red_persistence`, `SequelizeMeta` |

### 3.3 `channel_pulse_log` — Hypertable TimescaleDB (pulsos de energia)

Tabela principal de séries temporais. Particionada automaticamente pelo TimescaleDB (17 chunks ativos).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `timestamp` | `TIMESTAMPTZ` (precision 0) | Momento da leitura — default `now()`, NOT NULL |
| `channel` | `INTEGER` | Canal do medidor |
| `value` | `INTEGER` | Valor do pulso |
| `slave_id` | `INTEGER` | FK para `slaves.id` |
| `reading` | `INTEGER` | Leitura acumulada |

**Índices:**
- `channel_pulse_log_timestamp_idx` — `timestamp DESC`
- `idx_channel_pulse_log_slave_channel_time` — `(slave_id, channel, timestamp DESC)`

> **TimescaleDB:** INSERT direto é bloqueado pelo trigger `ts_insert_blocker`; inserir normalmente via `INSERT INTO channel_pulse_log ...` (o TimescaleDB redireciona internamente para o chunk correto).

### 3.4 Outras tabelas de série temporal

| Tabela | Descrição |
|--------|-----------|
| `consumption` | Consumo calculado / agregado por período |
| `consumption_realtime` | Snapshot de consumo em tempo real |
| `raw_energy` | Leituras brutas de energia antes de processamento |
| `temperature_history` | Histórico de temperatura por sensor |

```sql
-- Ver estrutura de qualquer tabela
\d+ <nome-da-tabela>
```

---

## 4. Queries Comuns

### 4.1 Últimas leituras de um slave (pulsos)

```sql
SELECT *
FROM channel_pulse_log
WHERE slave_id = <id>
ORDER BY timestamp DESC
LIMIT 20;
```

### 4.2 Leituras em um intervalo de tempo

```sql
SELECT *
FROM channel_pulse_log
WHERE slave_id = <id>
  AND timestamp BETWEEN '<data-inicio>' AND '<data-fim>'
ORDER BY timestamp ASC;
```

### 4.3 Contagem de registros por slave

```sql
SELECT slave_id, COUNT(*) AS total
FROM channel_pulse_log
GROUP BY slave_id
ORDER BY total DESC;
```

### 4.4 Últimas 24 horas

```sql
SELECT *
FROM channel_pulse_log
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

### 4.5 Histórico de temperatura de um sensor

```sql
SELECT *
FROM temperature_history
WHERE slave_id = <id>
ORDER BY timestamp DESC
LIMIT 50;
```

### 4.6 Listar todos os slaves cadastrados

```sql
SELECT id, name, slave_id, type, active
FROM slaves
ORDER BY name;
```

### 4.7 Últimas leituras por slave (canal 1)

```sql
SELECT DISTINCT ON (slave_id)
  slave_id, channel, value, reading, timestamp
FROM channel_pulse_log
WHERE channel = 1
ORDER BY slave_id, timestamp DESC;
```

---

## 5. Manutenção

### 5.1 Tamanho do banco

```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

### 5.2 Tamanho por tabela

```sql
SELECT
  relname AS tabela,
  pg_size_pretty(pg_total_relation_size(relid)) AS tamanho_total
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### 5.3 Limpar dados antigos (retenção)

```sql
-- CUIDADO: ação irreversível
-- channel_pulse_log é TimescaleDB — DROP CHUNKS é mais eficiente que DELETE
SELECT drop_chunks('channel_pulse_log', INTERVAL '<n> days');

-- Para tabelas normais:
DELETE FROM temperature_history
WHERE timestamp < NOW() - INTERVAL '<n> days';
```

### 5.4 VACUUM / ANALYZE

```sql
VACUUM ANALYZE <tabela>;
```

---

## 6. Scripts SQL de Correção

### 6.1 Fluxo padrão

```bash
# 1. Criar arquivo temporário
cat > /tmp/fix-<shopping>.sql << 'EOF'
-- SQL aqui
EOF

# 2. Executar
psql -U hubot -f /tmp/fix-<shopping>.sql

# 3. Remover após uso
rm /tmp/fix-<shopping>.sql
```

### 6.2 Scripts aplicados por central

| Central | Script | Data | Descrição |
|---------|--------|------|-----------|
| <!-- central --> | <!-- arquivo --> | <!-- data --> | <!-- o que fez --> |

---

## 7. Troubleshooting

| Problema | Causa provável | Solução |
|----------|---------------|---------|
| `psql: could not connect to server` | PostgreSQL parado | `systemctl restart postgresql` |
| Tabela vazia / sem dados recentes | Node-RED parado ou erro de conexão | Verificar logs: `journalctl -u nodered -f` |
| Disco cheio | Retenção não configurada | Limpar dados antigos (seção 5.3) |
| Permissão negada | Usuário errado | Conectar como `hubot` ou `postgres` |

---

## 8. Observações

<!-- Adicionar particularidades de cada central, versões, extensões instaladas, etc. -->

---

*Última atualização: 2026-04-06*
