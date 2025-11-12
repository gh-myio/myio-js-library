# Comparação de Abordagens: Persistência Não-Invasiva

## 🎯 Problema

O `func-001-FeriadoCheck.js` já tem um `return` estruturado que **não pode ser quebrado** pois outros nodes dependem dele:

```javascript
// ❌ NÃO PODEMOS MUDAR ISSO!
return {
  deviceName: device.deviceName,
  payload: {
    currentIndex: currIndex,
    length: keys.length,
    shouldActivate,
    shouldShutdown,
    device,
    deviceName: device.deviceName,
    excludedDays,
    currDate,
    currentTimeSP,
    storedHolidaysDays,
    schedules
  }
};
```

---

## ✅ Soluções Não-Invasivas

### Abordagem 1: Adicionar Campo `_observability` ⭐ (Recomendada)

**Vantagem**: Mínima modificação no código existente

**Mudança no func-001**:
```javascript
return {
  deviceName: device.deviceName,
  payload: {
    // ========== CAMPOS ORIGINAIS (intocados) ==========
    currentIndex: currIndex,
    length: keys.length,
    shouldActivate,
    shouldShutdown,
    device,
    deviceName: device.deviceName,
    excludedDays,
    currDate,
    currentTimeSP,
    storedHolidaysDays,
    schedules,

    // ========== NOVO: Dados de observabilidade ==========
    _observability: {
      logKey: `automation_log_${deviceName}_${Date.now()}`,
      logData: {
        device: deviceName,
        action: shouldActivate ? 'ON' : 'OFF',
        reason: isHolidayToday ? 'holiday' : 'weekday',
        timestamp: currentTimeSP.toISOString()
      }
    }
  }
};
```

**Flow no Node-RED**:
```
┌────────────────────────┐
│ func-001-FeriadoCheck  │
│ (com _observability)   │
└───────┬────────────────┘
        │
        ├──> [relay node] ────> Device ON/OFF
        │    (usa shouldActivate)
        │
        └──> [func-002-PersistAdapter] ──┬──> [persist-in] Log
                                          └──> [persist-in] Metrics
```

**Prós**:
- ✅ Não quebra fluxo existente
- ✅ Código legado continua funcionando
- ✅ Fácil de implementar (1 campo adicional)
- ✅ Fácil de testar

**Contras**:
- ⚠️ Aumenta tamanho do payload (mínimo)

---

### Abordagem 2: Link Out Paralelo (Alternativa)

**Vantagem**: Zero modificação no return

**Mudança no func-001**:
```javascript
// ========== ANTES do return, adiciona: ==========
const observability = {
  logKey: `automation_log_${deviceName}_${Date.now()}`,
  logData: {
    device: deviceName,
    action: shouldActivate ? 'ON' : 'OFF',
    reason: isHolidayToday ? 'holiday' : 'weekday',
    timestamp: currentTimeSP.toISOString()
  }
};

// Envia para link node (paralelo)
node.send([
  null, // output[0]: vazio (não usado)
  { payload: observability } // output[1]: para persist
]);

// ========== Return original intocado! ==========
return {
  deviceName: device.deviceName,
  payload: {
    currentIndex: currIndex,
    // ... todo o resto igual
  }
};
```

**Flow no Node-RED**:
```
┌────────────────────────┐
│ func-001-FeriadoCheck  │
└──┬──────────────────┬──┘
   │                  │
   │ output[0]        │ output[1]
   │ (return)         │ (node.send)
   ↓                  ↓
[relay node]    [func-002-PersistAdapter]
(Device ON/OFF)      │
                     ├──> [persist-in] Log
                     └──> [persist-in] Metrics
```

**Prós**:
- ✅ Return original 100% intocado
- ✅ Separação total de responsabilidades
- ✅ Fácil de remover se não funcionar

**Contras**:
- ⚠️ Precisa de 2 outputs no node
- ⚠️ Mais complexo de entender

---

## 📊 Comparação

| Critério | Abordagem 1 (_observability) | Abordagem 2 (link out) |
|---|---|---|
| **Modificação no return** | Campo adicional | Nenhuma |
| **Complexidade** | Baixa | Média |
| **Retrocompatibilidade** | 100% | 100% |
| **Facilidade de remoção** | Fácil | Muito fácil |
| **Outputs no node** | 1 (existente) | 2 (novo) |
| **Debugging** | Simples | Requer trace |
| **Recomendação** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 🎯 Recomendação Final

**Use Abordagem 1** (`_observability` no payload)

**Por quê?**
1. ✅ Mais simples de implementar
2. ✅ Mais fácil de debugar (tudo no payload)
3. ✅ Não requer mudança de outputs
4. ✅ Padrão comum em Node-RED (campos `_*` para metadados)

---

## 🚀 Implementação Passo a Passo

### Passo 1: Modificar func-001-FeriadoCheck.js

**Adicionar** antes do `return`:

```javascript
// Prepara dados de observabilidade
const timestamp = Date.now();
const logKey = `automation_log_${deviceName}_${timestamp}`;

const observability = {
  logKey: logKey,
  logData: {
    device: deviceName,
    deviceId: device.deviceId || currentKey,
    action: shouldActivate ? 'ON' : 'OFF',
    shouldActivate: shouldActivate,
    shouldShutdown: shouldShutdown,
    reason: isHolidayToday ? 'holiday' :
            (excludedDays.length > 0 && excludedDays.includes(currDate) ? 'excluded' : 'weekday'),
    schedule: schedules && schedules.length > 0 ? {
      startHour: schedules[0].startHour,
      endHour: schedules[0].endHour,
      retain: schedules[0].retain,
      holiday: schedules[0].holiday
    } : null,
    context: {
      isHolidayToday: isHolidayToday,
      currentWeekDay: currWeekDay,
      holidayPolicy: flow.get('holiday_policy') || 'exclusive'
    },
    timestamp: currentTimeSP.toISOString(),
    timestampMs: timestamp
  }
};
```

**Modificar** o `return`:

```javascript
return {
  deviceName: device.deviceName,
  payload: {
    currentIndex: currIndex,
    length: keys.length,
    shouldActivate,
    shouldShutdown,
    device,
    deviceName: device.deviceName,
    excludedDays,
    currDate,
    currentTimeSP,
    storedHolidaysDays,
    schedules,

    // ========== NOVO ==========
    _observability: observability
  }
};
```

### Passo 2: Criar func-002-PersistAdapter.js

Arquivo já criado: `func-002-PersistAdapter.js`

### Passo 3: Configurar Node-RED Flow

1. **Adicionar** `func-002-PersistAdapter` node após `func-001`
2. **Conectar** `func-001` → `func-002` (link wire)
3. **Configurar** `func-002` com 2 outputs
4. **Conectar** outputs do `func-002`:
   - Output 0 → `persist-in` node (log detalhado)
   - Output 1 → `persist-in` node (métricas)
5. **Manter** fluxo original `func-001` → `relay/switch` intacto

### Passo 4: Testar

```javascript
// No console do Node-RED, você verá:
[info] func-002: Persisting automation event
[info] Device: Ar Condicionado Sala 1
[info] Action: ON
[info] Reason: holiday
[info] Log Key: automation_log_ArCondSala1_1699876543
```

---

## 📝 Checklist de Validação

- [ ] func-001 retorna com campo `_observability`
- [ ] Fluxo original continua funcionando (relay/switch)
- [ ] func-002 recebe o payload corretamente
- [ ] persist-in recebe log detalhado (output[0])
- [ ] persist-in recebe métricas (output[1])
- [ ] Dados aparecem no banco de dados
- [ ] Queries funcionam corretamente

---

## 🎓 Dicas

1. **Teste o fluxo original primeiro** (sem persist) para garantir que não quebrou
2. **Use debug nodes** após cada output para ver os dados
3. **Valide o formato** do payload no persist-in
4. **Monitore o banco** para confirmar persistência

---

**Versão**: 1.0
**Data**: 2025-11-12
**Autor**: Rodrigo Lago
**Status**: ✅ Pronto para implementação
