# Observabilidade e Persistência de Logs

## 🎯 Visão Geral

O sistema de automação agora persiste **todos os eventos de decisão** no banco de dados via `persist-in` node, permitindo:
- ✅ Histórico permanente de ativações
- ✅ Análise de padrões de uso
- ✅ Auditoria completa
- ✅ Detecção de problemas
- ✅ Dashboards e relatórios

---

## 🔄 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│  func-001-FeriadoCheck.js                                   │
│  (Decisão: ligar/desligar)                                  │
└──────────────┬──────────────────────────────────────────────┘
               │
               ├─ output[0] ──────> [switch/relay node]
               │                    (Executa comando ON/OFF)
               │
               ├─ output[1] ──────> [persist-in node]
               │                    (Salva log detalhado)
               │                            │
               │                            ▼
               │                    [Banco de Dados]
               │                    automation_log_{device}_{timestamp}
               │
               └─ output[2] ──────> [persist-in node]
                                    (Atualiza métricas globais)
                                            │
                                            ▼
                                    [Banco de Dados]
                                    automation_metrics_total
```

---

## 📊 Estrutura de Dados Persistidos

### 1. Log Detalhado por Decisão

**Chave**: `automation_log_{deviceName}_{timestamp}`

**Exemplo**: `automation_log_ArCondicionadoSala1_1699876543210`

**Valor (JSON)**:
```json
{
  "device": "Ar Condicionado Sala 1",
  "deviceId": "device-uuid-123",
  "action": "ON",
  "shouldActivate": true,
  "shouldShutdown": false,
  "reason": "holiday",
  "schedule": {
    "startHour": "10:00",
    "endHour": "18:00",
    "retain": true,
    "holiday": true
  },
  "context": {
    "isHolidayToday": true,
    "currentWeekDay": "thu",
    "holidayPolicy": "exclusive"
  },
  "timestamp": "2025-11-12T14:30:00-03:00",
  "timestampMs": 1699876543210
}
```

**Campos**:
| Campo | Tipo | Descrição |
|---|---|---|
| `device` | string | Nome amigável do device |
| `deviceId` | string | UUID do device |
| `action` | string | "ON" ou "OFF" |
| `shouldActivate` | boolean | true se deve ligar |
| `shouldShutdown` | boolean | true se deve desligar |
| `reason` | string | "holiday", "weekday", "excluded" |
| `schedule` | object | Detalhes da agenda aplicada |
| `context` | object | Contexto da decisão (feriado, dia da semana, política) |
| `timestamp` | string | ISO 8601 com timezone |
| `timestampMs` | number | Unix timestamp em ms |

---

### 2. Métricas Agregadas (Contador Global)

**Chave**: `automation_metrics_total`

**Valor (JSON)**:
```json
{
  "total": 15234,
  "last_device": "Ar Condicionado Sala 1",
  "last_time": "2025-11-12T14:30:00-03:00",
  "last_action": "ON"
}
```

**Campos**:
| Campo | Tipo | Descrição |
|---|---|---|
| `total` | number | Total de decisões desde o início |
| `last_device` | string | Último device acionado |
| `last_time` | string | Timestamp da última decisão |
| `last_action` | string | "ON" ou "OFF" |

---

## 🔍 Queries de Análise

### 1. Ativações por Device (Hoje)

```sql
SELECT
  device,
  COUNT(*) as activations,
  SUM(CASE WHEN action = 'ON' THEN 1 ELSE 0 END) as turn_on_count,
  SUM(CASE WHEN action = 'OFF' THEN 1 ELSE 0 END) as turn_off_count
FROM automation_log
WHERE DATE(timestamp) = CURRENT_DATE
GROUP BY device
ORDER BY activations DESC;
```

**Resultado Esperado**:
```
device                    | activations | turn_on_count | turn_off_count
--------------------------+-------------+---------------+---------------
Ar Condicionado Sala 1    |     24      |      12       |      12
Iluminação Corredor       |     18      |       9       |       9
```

---

### 2. Ativações por Motivo (Últimos 7 dias)

```sql
SELECT
  reason,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM automation_log
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY reason
ORDER BY count DESC;
```

**Resultado Esperado**:
```
reason    | count | percentage
----------+-------+-----------
weekday   | 1200  |   75.00
holiday   |  300  |   18.75
excluded  |  100  |    6.25
```

---

### 3. Devices com Alternância Excessiva (Última hora)

```sql
SELECT
  device,
  COUNT(*) as toggles,
  MIN(timestamp) as first_toggle,
  MAX(timestamp) as last_toggle
FROM automation_log
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY device
HAVING COUNT(*) > 10
ORDER BY toggles DESC;
```

**Resultado Esperado**:
```
device                  | toggles | first_toggle          | last_toggle
------------------------+---------+-----------------------+----------------------
Ventilador Hall         |   15    | 2025-11-12 13:30:00   | 2025-11-12 14:25:00
```

⚠️ **Alerta**: Devices com > 10 toggles/hora podem ter configuração errada!

---

### 4. Horários de Pico de Ativação (Últimos 30 dias)

```sql
SELECT
  EXTRACT(HOUR FROM timestamp) as hour_of_day,
  COUNT(*) as activations,
  AVG(CASE WHEN action = 'ON' THEN 1 ELSE 0 END) * 100 as turn_on_percentage
FROM automation_log
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY EXTRACT(HOUR FROM timestamp)
ORDER BY hour_of_day;
```

**Resultado Esperado**:
```
hour_of_day | activations | turn_on_percentage
------------+-------------+-------------------
     8      |     450     |       80.00
     9      |     520     |       75.00
    10      |     480     |       60.00
    ...
    18      |     510     |       40.00
    19      |     420     |       20.00
```

📊 **Insight**: Pico de ligações às 8h (início do expediente), pico de desligamentos às 19h.

---

### 5. Comparativo Feriado vs Dia Normal

```sql
SELECT
  reason,
  DATE(timestamp) as date,
  COUNT(*) as activations,
  AVG(EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / 3600) as avg_duration_hours
FROM automation_log
WHERE DATE(timestamp) >= CURRENT_DATE - 30
GROUP BY reason, DATE(timestamp)
ORDER BY date DESC;
```

**Resultado Esperado**:
```
reason    | date       | activations | avg_duration_hours
----------+------------+-------------+-------------------
holiday   | 2025-12-25 |      8      |       10.5
weekday   | 2025-12-24 |     24      |        9.2
weekday   | 2025-12-23 |     26      |        9.5
```

📈 **Insight**: Feriados têm menos ativações mas durações maiores.

---

## 📊 Dashboard Widgets Sugeridos

### Widget 1: Ativações Hoje (Card)
```
┌─────────────────────────────┐
│  ATIVAÇÕES HOJE             │
│                             │
│        1,234                │
│                             │
│  ↑ 12% vs ontem             │
└─────────────────────────────┘
```

### Widget 2: Top 5 Devices (Tabela)
```
┌─────────────────────────────────────┐
│  TOP 5 DEVICES MAIS ACIONADOS      │
├──────────────────────────┬──────────┤
│ Ar Condicionado Sala 1   │   24     │
│ Iluminação Corredor      │   18     │
│ Ventilador Hall          │   15     │
│ Bomba Água               │   12     │
│ Sistema HVAC             │   10     │
└──────────────────────────┴──────────┘
```

### Widget 3: Ativações por Hora (Gráfico de Linha)
```
Ativações
    ↑
500 │           ╱╲
400 │         ╱    ╲
300 │       ╱        ╲
200 │     ╱            ╲
100 │   ╱                ╲___
  0 └────────────────────────→ Hora
    0  2  4  6  8 10 12 14 16 18 20 22
```

### Widget 4: Motivo das Ativações (Pizza)
```
     ┌────────────┐
     │  Weekday   │ ━━━━━━ 75%
     │  Holiday   │ ━━━━━  19%
     │  Excluded  │ ━━     6%
     └────────────┘
```

---

## 🔔 Alertas Automáticos

### Alerta 1: Alternância Excessiva
```javascript
// Se device alterna > 10x em 1 hora
node.warn({
  severity: 'HIGH',
  alert: 'excessive_toggling',
  device: 'Ventilador Hall',
  toggles: 15,
  time_window: '1 hour',
  suggestion: 'Check for overlapping schedules'
});
```

### Alerta 2: Device Sem Ativação
```javascript
// Se device esperado não foi acionado nas últimas 24h
node.warn({
  severity: 'MEDIUM',
  alert: 'missing_activation',
  device: 'Bomba Água',
  last_activation: '2025-11-10 08:00:00',
  hours_since: 48,
  suggestion: 'Check schedule configuration or device status'
});
```

### Alerta 3: Feriado sem Agenda de Feriado
```javascript
// Se é feriado mas não tem agenda holiday=true
node.warn({
  severity: 'LOW',
  alert: 'holiday_without_schedule',
  date: '2025-12-25',
  devices_affected: 12,
  suggestion: 'Configure holiday schedules for optimal efficiency'
});
```

---

## 🎯 Casos de Uso Práticos

### 1. Auditoria
**Pergunta**: "Quem ligou o ar condicionado da sala 1 às 2h da manhã?"

**Query**:
```sql
SELECT * FROM automation_log
WHERE device = 'Ar Condicionado Sala 1'
  AND action = 'ON'
  AND EXTRACT(HOUR FROM timestamp) = 2
ORDER BY timestamp DESC
LIMIT 10;
```

---

### 2. Otimização de Consumo
**Pergunta**: "Quais devices ficam ligados mais tempo?"

**Query**:
```sql
WITH device_sessions AS (
  SELECT
    device,
    action,
    timestamp,
    LEAD(timestamp) OVER (PARTITION BY device ORDER BY timestamp) as next_timestamp
  FROM automation_log
)
SELECT
  device,
  SUM(EXTRACT(EPOCH FROM (next_timestamp - timestamp)) / 3600) as total_hours_on
FROM device_sessions
WHERE action = 'ON'
GROUP BY device
ORDER BY total_hours_on DESC;
```

---

### 3. Detecção de Anomalias
**Pergunta**: "Houve ativações fora do horário esperado?"

**Query**:
```sql
SELECT * FROM automation_log
WHERE (
  -- Ativações fora do horário comercial (antes 6h ou após 22h)
  EXTRACT(HOUR FROM timestamp) < 6
  OR EXTRACT(HOUR FROM timestamp) > 22
)
AND reason = 'weekday' -- Dia normal (não feriado)
ORDER BY timestamp DESC;
```

---

## 🚀 Implementação no Node-RED

### Passo 1: Modificar func-001-FeriadoCheck.js

Adicionar ao final da função, antes do `return`:

```javascript
// ... lógica existente de decisão ...

// Preparar dados para persistir
const timestamp = Date.now();
const logKey = `automation_log_${deviceName}_${timestamp}`;

const logData = {
  device: deviceName,
  deviceId: device.deviceId || currentKey,
  action: shouldActivate ? 'ON' : 'OFF',
  shouldActivate,
  shouldShutdown,
  reason: isHolidayToday ? 'holiday' : (excludedDays.includes(currDate) ? 'excluded' : 'weekday'),
  schedule: schedules[0], // ou o schedule aplicado
  context: {
    isHolidayToday,
    currentWeekDay: currWeekDay,
    holidayPolicy: flow.get('holiday_policy') || 'exclusive'
  },
  timestamp: currentTimeSP.toISOString(),
  timestampMs: timestamp
};

// Retornar 3 outputs
return [
  {
    // Output 0: Comando para o device
    deviceName: device.deviceName,
    payload: {
      shouldActivate,
      shouldShutdown,
      device,
      deviceName: device.deviceName
    }
  },
  {
    // Output 1: Log para persist-in
    payload: {
      key: logKey,
      value: logData
    }
  },
  {
    // Output 2: Métricas globais
    payload: {
      key: 'automation_metrics_total',
      value: {
        total: (flow.get('automation_metrics_total') || 0) + 1,
        last_device: deviceName,
        last_time: currentTimeSP.toISOString(),
        last_action: shouldActivate ? 'ON' : 'OFF'
      }
    }
  }
];
```

### Passo 2: Configurar Node-RED Flow

1. **Adicionar 2 saídas** ao func-001-FeriadoCheck (total: 3 outputs)
2. **Conectar output[1]** → `persist-in` node (log detalhado)
3. **Conectar output[2]** → `persist-in` node (métricas)

### Passo 3: Verificar Funcionamento

No console do Node-RED, você verá:
```
[info] Persisting: automation_log_ArCondicionadoSala1_1699876543210
[info] Persisting: automation_metrics_total
```

---

## 📈 Benefícios Mensuráveis

| Benefício | Antes | Depois |
|---|---|---|
| **Auditoria** | ❌ Impossível | ✅ Completa |
| **Histórico** | ❌ Sem dados | ✅ Permanente |
| **Detecção de problemas** | ⏰ Dias | ⏰ Minutos |
| **Análise de padrões** | ❌ Manual | ✅ Automática |
| **Otimização de consumo** | ❓ Desconhecido | 📊 Mensurável |

---

## 🎓 Próximos Passos

1. ✅ Implementar persistência (Fase 1)
2. ✅ Validar dados no banco
3. ✅ Criar queries básicas
4. ⏳ Criar dashboard de monitoramento (Fase 2)
5. ⏳ Configurar alertas automáticos (Fase 3)
6. ⏳ Otimizar performance (Fase 3)

---

**Versão**: 1.0
**Data**: 2025-11-12
**Autor**: Rodrigo Lago
**Status**: ✅ Pronto para implementação
