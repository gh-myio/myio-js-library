# Bug Fix: Midnight Crossing com Todos os Dias Ativos

## 🐛 Bug Detectado

**Data:** 2025-11-22
**Reportado por:** Log real de produção
**Severidade:** ALTA - Equipamentos não ativam quando deveriam

---

## 📋 Descrição do Bug

### Sintoma
Quando um schedule midnight crossing (ex: 17:45-05:30) tem **todos os dias da semana ativos**, o equipamento **não ativa** durante o período, mesmo estando dentro da janela de horário.

### Log Real (Totem Publicidade)
```javascript
{
  device: "Totem Publicidade",
  action: "OFF",  // ❌ ERRADO - deveria ser "ON"
  shouldActivate: false,  // ❌ ERRADO - deveria ser true
  shouldShutdown: true,
  reason: "weekday",
  schedule: {
    startHour: "17:45",
    endHour: "05:30",
    retain: true,
    holiday: false,
    daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
  },
  context: {
    currentWeekDay: "sat"
  },
  timestamp: "2025-11-22T21:14:38.163Z"  // UTC
}
```

### Horário Real
- **UTC:** 21:14:38
- **São Paulo:** 18:14:38 ✅
- **Schedule:** 17:45 - 05:30
- **Esperado:** `shouldActivate: true` (dentro da janela)
- **Resultado:** `shouldActivate: false` ❌

---

## 🔍 Causa Raiz

### Problema 1: Lógica de Evitar Dupla Ativação
**Código original (BUGADO):**
```javascript
if (crossesMidnight) {
  const yesterday = subtractWeekDay(currWeekDay);
  let acted = false;

  // Verifica período ontem→hoje
  if (days[yesterday]) {
    // ... processa
    acted = true;
  }

  // ❌ BUG: Só verifica hoje se ontem NÃO processou
  if (!acted && days[currWeekDay]) {  // <-- PROBLEMA AQUI
    // ... processa período hoje→amanhã
  }
}
```

**Por que falha:**
1. Sábado 18:14
2. Sexta (yesterday) também está ativa (`fri: true`)
3. Processa período sexta 17:45 → sábado 05:30
4. Como 18:14 > 05:30, retorna `shutdown: true`
5. `acted = true`
6. Condição `!acted && days[currWeekDay]` é **falsa**
7. Não processa período sábado 17:45 → domingo 05:30
8. Resultado: `shutdown` ❌

### Problema 2: Precedência de Shutdown
**Código original (BUGADO):**
```javascript
if (anyAct && anyShut) {
  shouldActivate = false;
  shouldShutdown = true;  // ❌ shutdown vence
}
```

**Por que falha:**
- Quando ambos os períodos são processados (ontem E hoje)
- Um pode retornar `activate`, outro `shutdown`
- Regra "shutdown wins" causa desligamento incorreto

---

## ✅ Solução Aplicada

### Fix 1: Sempre Verificar Ambos os Períodos
**Código corrigido:**
```javascript
if (crossesMidnight) {
  const yesterday = subtractWeekDay(currWeekDay);

  const shouldCheckYesterday = (isHolidaySchedule && isHolidayToday) || (days && days[yesterday]);
  const shouldCheckToday = (isHolidaySchedule && isHolidayToday) || (days && days[currWeekDay]);

  // ✅ Sempre verifica ontem SE ontem está habilitado
  if (shouldCheckYesterday) {
    const startYesterday = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
    const [shut, act] = decide(retain, nowLocal, startYesterday, endTime);
    anyAct = anyAct || act;
    anyShut = anyShut || shut;
    // ... edge cases
  }

  // ✅ Sempre verifica hoje SE hoje está habilitado
  // REMOVIDO: !acted
  if (shouldCheckToday) {
    const endTomorrow = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
    const [shut, act] = decide(retain, nowLocal, startTime, endTomorrow);
    anyAct = anyAct || act;
    anyShut = anyShut || shut;
  }
}
```

### Fix 2: Mudar Precedência para "Activate Wins"
**Código corrigido:**
```javascript
if (anyAct && anyShut) {
  // ✅ Precedência: ATIVAR vence
  // Se há pelo menos um período ativo, mantém ativo
  shouldActivate = true;
  shouldShutdown = false;
}
```

**Justificativa:**
- Se **qualquer** período diz "ativar", o equipamento deve ficar ativo
- É mais seguro manter ligado do que desligar incorretamente
- Comportamento esperado pelo usuário

---

## 🧪 Teste Criado

### Teste de Regressão
```javascript
test('🐛 BUG: Sábado 18:14 com schedule 17:45-05:30 (todos dias ativos)', () => {
  const device = { deviceName: 'Totem Publicidade', deviceId: 'totem-1' };

  const schedules = [{
    startHour: '17:45',
    endHour: '05:30',
    retain: true,
    holiday: false,
    daysWeek: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
  }];

  // Sábado 18:14 (após início 17:45, antes do fim 05:30 de domingo)
  const nowLocal = new Date(2025, 10, 22, 18, 14, 38);

  const result = processDevice({
    device,
    schedules,
    excludedDays: [],
    storedHolidaysDays: [],
    nowLocal,
    holidayPolicy: 'exclusive'
  });

  // ✅ AGORA PASSA
  expect(result.shouldActivate).toBe(true);
  expect(result.shouldShutdown).toBe(false);
  expect(result.currWeekDay).toBe('sat');
});
```

---

## 📊 Impacto do Fix

### Antes do Fix
```
Test Suites: 1 failed, 1 total
Tests:       2 failed, 36 passed, 38 total
```

Testes falhando:
- ❌ Feriado com agenda 22h-06h (midnight crossing)
- ❌ BUG: Sábado 18:14 com schedule 17:45-05:30

### Depois do Fix
```
Test Suites: 1 passed, 1 total
Tests:       38 passed, 38 total  ✅
Time:        1.0s
```

**100% dos testes passando!** 🎉

---

## 📝 Arquivos Modificados

1. **func-001-FeriadoCheck.js**
   - Linha 167-203: Lógica de midnight crossing
   - Linha 222-234: Resolução de precedência

2. **lib/scheduleEngine.js**
   - Linha 94-130: Lógica de midnight crossing
   - Linha 148-163: Resolução de precedência

3. **tests/func-001-FeriadoCheck.test.js**
   - Linha 792-819: Novo teste de regressão

---

## 🎯 Casos de Uso Corrigidos

### Caso 1: Todos os Dias Ativos
**Schedule:** 17:45-05:30, seg-dom todos true
**Hora:** Sábado 18:14
**Antes:** ❌ Desliga
**Depois:** ✅ Ativa

### Caso 2: Feriado com Midnight Crossing
**Schedule:** 22:00-06:00, holiday: true
**Hora:** Feriado quinta 02:00
**Antes:** ❌ Desliga
**Depois:** ✅ Ativa

### Caso 3: Múltiplas Agendas com Overlap
**Schedules:** [22:00-02:00 dom, 01:00-05:00 seg]
**Hora:** Segunda 01:30
**Antes:** ❌ Conflito
**Depois:** ✅ Ativa (ambas ativas)

---

## 🚀 Deploy e Validação

### Checklist de Deploy
- [x] Testes unitários passando (38/38)
- [x] Teste de regressão criado
- [x] Documentação atualizada
- [x] Código revisado
- [ ] Testar em ambiente de staging
- [ ] Monitorar logs de produção
- [ ] Validar com equipamentos reais

### Monitoramento Recomendado
1. Verificar logs de `shouldActivate/shouldShutdown`
2. Confirmar que equipamentos com "todos dias ativos" funcionam
3. Validar feriados com midnight crossing
4. Checar equipamentos com múltiplas agendas

---

## 📚 Referências

- Issue original: Log real do Totem Publicidade
- Testes: `tests/func-001-FeriadoCheck.test.js` (Categoria 9, linha 792)
- Análise técnica: `ANALISE-MIDNIGHT-CROSSING.md`
- Resumo de testes: `RESUMO-FINAL-TESTES.md`

---

## 🏆 Conclusão

### ✅ Bug Corrigido com Sucesso

**Mudanças aplicadas:**
1. ✅ Removida flag `acted` que impedia processar ambos períodos
2. ✅ Mudada precedência de "shutdown wins" para "activate wins"
3. ✅ Teste de regressão criado para prevenir reintrodução do bug
4. ✅ 38/38 testes passando

**Impacto:**
- Equipamentos com "todos os dias" agora funcionam corretamente
- Feriados com midnight crossing funcionam
- Múltiplas agendas com overlap funcionam
- Comportamento mais intuitivo e seguro

**Status: PRONTO PARA PRODUÇÃO** 🚀
