# Guia de Teste - Observabilidade Implementada

## ✅ O que foi implementado

1. **func-001-FeriadoCheck.js** - Adicionado campo `_observability` (linhas 233-317)
2. **func-002-PersistAdapter.js** - Node adapter para persist-in (arquivo completo)

---

## 🧪 Passo a Passo para Testar

### Teste 1: Verificar Campo `_observability`

**Objetivo**: Confirmar que o campo está sendo adicionado ao payload

**Passos**:
1. Abrir Node-RED
2. Adicionar um **debug node** após o `func-001-FeriadoCheck`
3. Configurar debug para mostrar `msg.payload._observability`
4. Executar o flow
5. Verificar no console

**Resultado Esperado**:
```json
{
  "logKey": "automation_log_ArCondicionadoSala1_1699876543210",
  "logData": {
    "device": "Ar Condicionado Sala 1",
    "deviceId": "device-uuid-123",
    "action": "ON",
    "shouldActivate": true,
    "shouldShutdown": false,
    "reason": "weekday",
    "schedule": {
      "startHour": "08:00",
      "endHour": "18:00",
      "retain": true,
      "holiday": false,
      "daysWeek": { "mon": true, "tue": true }
    },
    "context": {
      "isHolidayToday": false,
      "currentWeekDay": "wed",
      "holidayPolicy": "exclusive",
      "totalSchedules": 1
    },
    "timestamp": "2025-11-12T14:30:00-03:00",
    "timestampMs": 1699876543210
  }
}
```

**Validações**:
- ✅ Campo `_observability` existe
- ✅ `logKey` tem formato correto
- ✅ `action` é "ON" ou "OFF"
- ✅ `reason` é "weekday", "holiday" ou "excluded"
- ✅ `timestamp` é válido (ISO 8601)

---

### Teste 2: Verificar Retrocompatibilidade

**Objetivo**: Garantir que o fluxo original continua funcionando

**Passos**:
1. Verificar que o **relay/switch node** recebe o payload
2. Confirmar que campos originais estão presentes:
   - `shouldActivate`
   - `shouldShutdown`
   - `device`
   - `deviceName`
   - etc.
3. Testar acionamento do device

**Resultado Esperado**:
```json
{
  "currentIndex": 0,
  "length": 10,
  "shouldActivate": true,
  "shouldShutdown": false,
  "device": { ... },
  "deviceName": "Ar Condicionado Sala 1",
  "excludedDays": [],
  "currDate": "2025-11-12T00:00:00Z",
  "currentTimeSP": "2025-11-12T14:30:00-03:00",
  "storedHolidaysDays": [],
  "schedules": [ ... ],
  "_observability": { ... }
}
```

**Validações**:
- ✅ Device liga/desliga corretamente
- ✅ Todos os campos originais presentes
- ✅ Nenhum erro no console
- ✅ Performance igual (sem lag)

---

### Teste 3: Testar func-002-PersistAdapter

**Objetivo**: Validar transformação para persist-in

**Passos**:
1. Adicionar `func-002-PersistAdapter` node no flow
2. Conectar `func-001` → `func-002`
3. Configurar `func-002` com **2 outputs**
4. Adicionar **debug nodes** nos 2 outputs
5. Executar o flow

**Resultado Esperado - Output 0 (Log)**:
```json
{
  "payload": {
    "key": "automation_log_ArCondicionadoSala1_1699876543210",
    "value": {
      "device": "Ar Condicionado Sala 1",
      "action": "ON",
      "reason": "weekday",
      "schedule": { ... },
      "timestamp": "2025-11-12T14:30:00-03:00"
    }
  }
}
```

**Resultado Esperado - Output 1 (Métricas)**:
```json
{
  "payload": {
    "key": "automation_metrics_total",
    "value": {
      "total": 1234,
      "last_device": "Ar Condicionado Sala 1",
      "last_time": "2025-11-12T14:30:00-03:00",
      "last_action": "ON",
      "last_reason": "weekday",
      "updated_at": "2025-11-12T14:30:01-03:00"
    }
  }
}
```

**Validações**:
- ✅ Output 0 tem estrutura `{ payload: { key, value } }`
- ✅ Output 1 tem estrutura `{ payload: { key, value } }`
- ✅ `key` tem formato correto
- ✅ `value` é um objeto válido

---

### Teste 4: Testar Persistência no Banco

**Objetivo**: Confirmar que dados são salvos no banco

**Passos**:
1. Conectar outputs do `func-002` aos **persist-in nodes**
2. Configurar persist-in para seu banco (PostgreSQL, MongoDB, etc.)
3. Executar o flow
4. Consultar o banco

**Query SQL de Validação** (PostgreSQL):
```sql
-- Verificar logs salvos
SELECT * FROM automation_log
ORDER BY timestampMs DESC
LIMIT 10;

-- Verificar métricas
SELECT * FROM automation_metrics_total;
```

**Resultado Esperado**:
```
device                  | action | reason  | timestamp
------------------------+--------+---------+-------------------------
Ar Condicionado Sala 1  | ON     | weekday | 2025-11-12 14:30:00
Iluminação Corredor     | OFF    | weekday | 2025-11-12 14:29:00
Ventilador Hall         | ON     | holiday | 2025-12-25 10:00:00
```

**Validações**:
- ✅ Registros sendo salvos
- ✅ Timestamps corretos
- ✅ Campos não-nulos
- ✅ Formato JSON válido

---

### Teste 5: Testar Cenários Especiais

#### 5.1. Feriado

**Setup**:
- Adicionar data em `stored_holidays`: `['2025-12-25']`
- Criar schedule com `holiday: true`
- Simular execução no dia 25/12/2025

**Resultado Esperado**:
```json
{
  "_observability": {
    "logData": {
      "reason": "holiday",
      "context": {
        "isHolidayToday": true
      }
    }
  }
}
```

**Validação**: ✅ `reason === 'holiday'`

---

#### 5.2. Dia Excluído

**Setup**:
- Adicionar data em `stored_excludedDays`
- Simular execução nessa data

**Resultado Esperado**:
```json
{
  "_observability": {
    "logData": {
      "reason": "excluded",
      "shouldActivate": false,
      "shouldShutdown": true
    }
  }
}
```

**Validação**: ✅ `reason === 'excluded'`

---

#### 5.3. Sem Schedule

**Setup**:
- Device sem nenhuma agenda configurada

**Resultado Esperado**:
```json
{
  "_observability": {
    "logData": {
      "schedule": null,
      "context": {
        "totalSchedules": 0
      }
    }
  }
}
```

**Validação**: ✅ `schedule === null`

---

#### 5.4. Múltiplos Schedules

**Setup**:
- Device com 3 agendas diferentes

**Resultado Esperado**:
```json
{
  "_observability": {
    "logData": {
      "schedule": {
        "startHour": "08:00",
        "endHour": "12:00"
      },
      "context": {
        "totalSchedules": 3
      }
    }
  }
}
```

**Validação**: ✅ `context.totalSchedules === 3`

---

## 🐛 Troubleshooting

### Problema 1: Campo `_observability` não aparece

**Causa Possível**: Código não foi salvo ou flow não foi redeployed

**Solução**:
1. Verificar se func-001-FeriadoCheck.js tem linhas 233-317
2. Fazer redeploy do flow (botão "Deploy" no Node-RED)
3. Limpar cache do browser (Ctrl+F5)

---

### Problema 2: Erro "transformDate is not defined"

**Causa**: Função `transformDate` não está disponível

**Solução**: Verificar se função existe no topo do arquivo (linha 29-33)
```javascript
function transformDate(dateString) {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().split('T')[0];
}
```

---

### Problema 3: persist-in não recebe dados

**Causa Possível**: func-002 não está conectado corretamente

**Solução**:
1. Verificar wire entre func-001 e func-002
2. Verificar wires entre func-002 e persist-in (2 outputs)
3. Adicionar debug nodes para trace

---

### Problema 4: Timestamp errado

**Causa**: Timezone do servidor diferente de America/Sao_Paulo

**Solução**:
```javascript
// No func-001, linha 293, forçar timezone:
timestamp: new Date(currentTimeSP.toLocaleString('en-US', {
  timeZone: 'America/Sao_Paulo'
})).toISOString()
```

---

## 📊 Métricas de Sucesso

Ao final dos testes, você deve ter:

- ✅ **100%** dos campos originais funcionando
- ✅ **0 erros** no console do Node-RED
- ✅ **Campo `_observability`** presente em todos os payloads
- ✅ **Dados persistidos** no banco de dados
- ✅ **Queries** retornando dados corretos
- ✅ **Performance** igual ao original (< 5ms overhead)

---

## 🎯 Checklist Final

- [ ] Teste 1: Campo `_observability` presente ✅
- [ ] Teste 2: Retrocompatibilidade 100% ✅
- [ ] Teste 3: func-002 transforma corretamente ✅
- [ ] Teste 4: Dados salvos no banco ✅
- [ ] Teste 5.1: Cenário feriado ✅
- [ ] Teste 5.2: Cenário excluído ✅
- [ ] Teste 5.3: Sem schedule ✅
- [ ] Teste 5.4: Múltiplos schedules ✅
- [ ] Performance OK (< 5ms overhead) ✅
- [ ] Sem erros no console ✅

---

## 📝 Relatório de Teste (Template)

```markdown
## Relatório de Teste - Observabilidade

**Data**: 2025-11-12
**Testador**: [Seu Nome]
**Ambiente**: [Dev/Staging/Prod]

### Resultados

| Teste | Status | Observações |
|---|---|---|
| Campo _observability | ✅ PASS | Campo presente e completo |
| Retrocompatibilidade | ✅ PASS | Fluxo original OK |
| func-002 Adapter | ✅ PASS | 2 outputs corretos |
| Persistência no banco | ✅ PASS | Dados salvos |
| Cenário feriado | ✅ PASS | reason='holiday' |
| Cenário excluído | ✅ PASS | reason='excluded' |
| Sem schedule | ✅ PASS | schedule=null |
| Performance | ✅ PASS | +2ms overhead |

### Conclusão

✅ **Implementação bem-sucedida!** Sistema de observabilidade funcionando corretamente.

### Próximos Passos

1. Deploy em staging
2. Monitorar por 24h
3. Validar dashboards
4. Deploy em produção
```

---

**Versão**: 1.0
**Data**: 2025-11-12
**Autor**: Rodrigo Lago
**Status**: ✅ Pronto para testes
