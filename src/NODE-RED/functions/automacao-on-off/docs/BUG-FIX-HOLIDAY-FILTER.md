# Bug Fix: Filtro Holiday com daysWeek

## 🐛 Bug Reportado

**Data:** 2025-11-23
**Reportado por:** Analista de QA
**Severidade:** ALTA - Agendas com holiday+daysWeek não funcionam em dias normais

---

## 📋 Descrição do Bug

### Sintoma
Quando um agendamento tem `holiday: true` **E TAMBÉM** tem dias da semana marcados em `daysWeek`, o filtro `exclusive` **remove completamente** essa agenda quando **não é feriado**.

### Feedback do Analista
> "Quando Feriado tá selecionado junto com os demais, ele EXCLUI"

### Agendamento Afetado
```json
{
  "type": "individual",
  "startHour": "17:30",
  "endHour": "05:30",
  "daysWeek": {
    "mon": true,
    "tue": true,
    "wed": true,
    "thu": true,
    "fri": true,
    "sat": true,
    "sun": true
  },
  "holiday": true,  // ← Marcado como feriado
  "retain": true
}
```

### Comportamento Esperado vs Atual

| Cenário | holiday | isHolidayToday | Comportamento Atual | Comportamento Esperado |
|---------|---------|----------------|---------------------|------------------------|
| Dia normal com `holiday=true` + `daysWeek` | true | false | ❌ Remove agenda | ✅ Usa `daysWeek` |
| Feriado com `holiday=true` | true | true | ✅ Ativa | ✅ Ativa |
| Dia normal com `holiday=false` | false | false | ✅ Usa `daysWeek` | ✅ Usa `daysWeek` |
| Feriado com `holiday=false` | false | true | ✅ Remove agenda | ✅ Remove agenda |

---

## 🔍 Causa Raiz

### Código Original (BUGADO)

**lib/scheduleEngine.js (linha 63-77):**
```javascript
// Filtra schedules com base na política de feriado
if (holidayPolicy === 'exclusive') {
  sortedSchedules = sortedSchedules.filter(s => !!s.holiday === isHolidayToday);
  //                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                                              PROBLEMA: Filtro muito restritivo!

  // Se isHolidayToday = false E s.holiday = true
  // ⇒ true === false ⇒ FALSE
  // ⇒ REMOVE o agendamento! ❌
}
```

**func-001-FeriadoCheck.js (linha 138-146):**
```javascript
if (holidayPolicy === 'exclusive') {
  schedules = (schedules || []).filter(s => !!s.holiday === isHolidayToday);
  // ❌ Mesmo problema
}
```

### Por que falha?

A lógica original assume que `holiday: true` significa **"APENAS em feriados"**, mas o comportamento esperado pelos usuários é **"TAMBÉM em feriados"**.

**Exemplo:**
- Usuário marca `holiday: true` + todos os dias da semana
- **Intenção:** "Quero que funcione todos os dias, incluindo feriados"
- **Resultado atual:** Agenda é **removida** em dias normais ❌

---

## ✅ Solução Aplicada

### Nova Lógica - "Holiday INCLUSIVO"

**Regra corrigida:**
- **Em FERIADO:** Mantém APENAS schedules com `holiday=true`
- **Em DIA NORMAL:** Mantém TODOS os schedules (permite `holiday=true` usar `daysWeek`)

### Código Corrigido

**lib/scheduleEngine.js (linha 63-83):**
```javascript
// Filtra schedules com base na política de feriado
if (holidayPolicy === 'exclusive') {
  if (isHolidayToday) {
    // Em FERIADO: mantém APENAS schedules com holiday=true
    sortedSchedules = sortedSchedules.filter(s => s.holiday === true);

    // Feriado sem agenda de feriado ⇒ desliga
    if (sortedSchedules.length === 0) {
      return {
        shouldActivate: false,
        shouldShutdown: true,
        appliedSchedule: null,
        reason: 'holiday_no_schedule',
        isHolidayToday,
        totalSchedules: 0
      };
    }
  }
  // Em DIA NORMAL: mantém TODOS os schedules
  // - schedules com holiday=false usarão daysWeek normalmente
  // - schedules com holiday=true TAMBÉM podem usar daysWeek em dias normais
}
```

**func-001-FeriadoCheck.js (linha 138-152):**
```javascript
if (holidayPolicy === 'exclusive') {
  if (isHolidayToday) {
    // Em FERIADO: mantém APENAS schedules com holiday=true
    schedules = (schedules || []).filter(s => s.holiday === true);

    // Feriado sem agenda de feriado ⇒ desliga
    if (!schedules || schedules.length === 0) {
      shouldShutdown = true;
      shouldActivate = false;
    }
  }
  // Em DIA NORMAL: mantém TODOS os schedules
  // - schedules com holiday=false usarão daysWeek normalmente
  // - schedules com holiday=true TAMBÉM podem usar daysWeek em dias normais
}
```

### Justificativa

1. **Mais intuitivo:** `holiday: true` agora significa "funciona em feriados E em dias marcados"
2. **Flexibilidade:** Permite agendas que funcionam tanto em feriados quanto em dias normais
3. **Backward compatible:** Agendas apenas com `holiday: true` (sem `daysWeek`) ainda funcionam apenas em feriados

---

## 🧪 Testes Criados

### Categoria 10: Bug - Holiday com daysWeek 🐛

**Teste 1: Agenda holiday=true em dia normal**
```javascript
test('🐛 BUG: Agenda com holiday=true + daysWeek deve funcionar em dias normais', () => {
  const schedules = [{
    startHour: '17:30',
    endHour: '05:30',
    retain: true,
    holiday: true,  // ← Marcado como holiday
    daysWeek: { mon: true, tue: true, ..., sun: true }
  }];

  // Sábado normal (NÃO é feriado) às 18:00
  const nowLocal = new Date(2025, 10, 22, 18, 0, 0);

  const result = processDevice({
    device,
    schedules,
    excludedDays: [],
    storedHolidaysDays: [], // ← Não é feriado
    nowLocal,
    holidayPolicy: 'exclusive'
  });

  // ✅ COM FIX: Usa daysWeek e ativa
  expect(result.shouldActivate).toBe(true);
  expect(result.shouldShutdown).toBe(false);
});
```

**Teste 2: Agenda holiday=true em feriado**
```javascript
test('✅ Agenda com holiday=true deve funcionar EM FERIADO também', () => {
  const schedules = [{
    startHour: '17:30',
    endHour: '05:30',
    retain: true,
    holiday: true,
    daysWeek: { mon: true, ..., sun: true }
  }];

  // Feriado às 18:00
  const nowLocal = new Date(2025, 10, 22, 18, 0, 0);

  const result = processDevice({
    device,
    schedules,
    excludedDays: [],
    storedHolidaysDays: ['2025-11-22'], // ← É feriado
    nowLocal,
    holidayPolicy: 'exclusive'
  });

  // ✅ Funciona corretamente
  expect(result.shouldActivate).toBe(true);
  expect(result.shouldShutdown).toBe(false);
});
```

---

## 📊 Impacto do Fix

### Antes do Fix
```
Test Suites: 1 failed, 1 total
Tests:       1 failed, 40 passed, 41 total

❌ Teste falhando: "Agenda com holiday=true + daysWeek deve funcionar em dias normais"
Resultado: totalSchedules: 0 (agenda foi removida pelo filtro)
```

### Depois do Fix
```
Test Suites: 1 passed, 1 total
Tests:       41 passed, 41 total  ✅
Time:        0.668s
```

**100% dos testes passando!** 🎉

---

## 📝 Arquivos Modificados

1. **lib/scheduleEngine.js**
   - Linha 63-83: Lógica de filtro holiday corrigida

2. **func-001-FeriadoCheck.js**
   - Linha 138-152: Lógica de filtro holiday corrigida

3. **tests/func-001-FeriadoCheck.test.js**
   - Linha 926-988: Nova categoria de testes (Categoria 10)

---

## 🎯 Casos de Uso Corrigidos

### Caso 1: Agenda "Todos os Dias + Feriados"
**Schedule:** 17:30-05:30, `holiday: true`, todos dias marcados
**Antes:**
- ❌ Dia normal: Não funciona (agenda removida)
- ✅ Feriado: Funciona

**Depois:**
- ✅ Dia normal: Funciona (usa `daysWeek`)
- ✅ Feriado: Funciona

### Caso 2: Agenda "Apenas Feriados"
**Schedule:** 08:00-18:00, `holiday: true`, sem `daysWeek` OU todos false
**Antes:**
- ✅ Feriado: Funciona

**Depois:**
- ✅ Feriado: Funciona (sem mudança de comportamento)

### Caso 3: Agenda "Apenas Dias Normais"
**Schedule:** 08:00-18:00, `holiday: false`, dias específicos marcados
**Antes:**
- ✅ Dia normal: Funciona
- ✅ Feriado: Não funciona

**Depois:**
- ✅ Dia normal: Funciona (sem mudança de comportamento)
- ✅ Feriado: Não funciona (sem mudança de comportamento)

---

## 🚀 Deploy e Validação

### Checklist de Deploy
- [x] Testes unitários passando (41/41)
- [x] Teste de regressão criado
- [x] Documentação atualizada
- [x] Código revisado
- [ ] Testar em ambiente de staging
- [ ] Monitorar logs de produção
- [ ] Validar com equipamentos reais

### Monitoramento Recomendado
1. Verificar equipamentos com `holiday: true` + `daysWeek` marcados
2. Confirmar que funcionam em dias normais
3. Confirmar que funcionam em feriados
4. Verificar que agendas apenas de feriado ainda funcionam corretamente

---

## 📚 Referências

- Issue original: Feedback do analista de QA
- Testes: `tests/func-001-FeriadoCheck.test.js` (Categoria 10, linha 926)
- Código principal: `lib/scheduleEngine.js` e `func-001-FeriadoCheck.js`

---

## 🏆 Conclusão

### ✅ Bug Corrigido com Sucesso

**Mudanças aplicadas:**
1. ✅ Filtro holiday agora é **inclusivo** em vez de **exclusivo**
2. ✅ `holiday: true` + `daysWeek` agora funciona em dias normais
3. ✅ Testes de regressão criados (2 novos testes)
4. ✅ 41/41 testes passando

**Impacto:**
- Agendas com "feriado + dias da semana" agora funcionam como esperado
- Comportamento mais intuitivo para o usuário
- Maior flexibilidade no agendamento
- Sem quebra de funcionalidades existentes

**Status: PRONTO PARA PRODUÇÃO** 🚀

---

## 🔄 Histórico de Mudanças

| Data | Versão | Mudança |
|------|--------|---------|
| 2025-11-23 | 1.0 | Fix inicial do filtro holiday |
