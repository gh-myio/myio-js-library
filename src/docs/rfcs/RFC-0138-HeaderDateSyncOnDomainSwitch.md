# RFC-0138: Header Date Sync on Domain Switch

## Status
Implemented (v4 - with waitForCtxData period validation)

## Problem

Quando o usuario trocava de dominio (energia → agua) via MENU, o periodo de datas selecionado no HEADER nao era aplicado ao novo dominio. O sistema usava o periodo antigo/cacheado.

### Cenario do Bug

1. Usuario esta em energia, muda a data no HEADER e clica "Carregar" - funciona
2. Usuario clica em "Agua" no MENU para trocar de dominio
3. **BUG:** O dominio agua carrega com o periodo ANTIGO, nao o periodo atual do dateRangePicker
4. Usuario tem que clicar "Atualizar" novamente para aplicar as datas corretas

### Causa Raiz

O listener de `myio:dashboard-state` no HEADER so emitia as datas **uma vez** (na primeira troca de dominio):

```javascript
// ANTES (bug)
if (!hasEmittedInitialPeriod && (tab === 'energy' || tab === 'water')) {
  hasEmittedInitialPeriod = true;
  // emitir datas...
}
```

Apos a primeira emissao, trocas subsequentes de dominio nao re-emitiam as datas atuais, e o orchestrator usava o `currentPeriod` cacheado.

## Solution

### Fix 1: Emitir datas em toda troca de dominio

Remover a condicao `!hasEmittedInitialPeriod` para emitir as datas **sempre** que o dominio mudar para energy ou water:

```javascript
// ANTES (bug)
if (!hasEmittedInitialPeriod && (tab === 'energy' || tab === 'water')) { ... }

// DEPOIS (fix)
if (tab === 'energy' || tab === 'water') {
  hasEmittedInitialPeriod = true;
  // emitir datas SEMPRE
}
```

### Fix 2: Atualizar self.__range no onApply do DateRangePicker

O problema persistiu porque `self.__range` nao era atualizado quando o usuario selecionava novas datas no DateRangePicker. O callback `onApply` so atualizava `self.ctx.$scope.startTs/endTs`, mas o codigo do RFC-0138 le de `self.__range`.

```javascript
// ANTES (bug) - onApply nao atualizava self.__range
onApply: function (result) {
  self.ctx.$scope.startTs = result.startISO;
  self.ctx.$scope.endTs = result.endISO;
  // self.__range continuava com datas antigas!
}

// DEPOIS (fix) - onApply atualiza self.__range
onApply: function (result) {
  self.ctx.$scope.startTs = result.startISO;
  self.ctx.$scope.endTs = result.endISO;

  // RFC-0138 FIX: Update self.__range
  if (result.startISO && result.endISO) {
    self.__range.start = moment(result.startISO);
    self.__range.end = moment(result.endISO);
  }
}
```

## Flow After Fix

```
MENU → myio:dashboard-state (tab: 'water')
  ↓
HEADER:
  1. Atualiza currentDomain para 'water'
  2. Atualiza estado dos controles
  3. Le datas atuais do dateRangePicker (self.__range)
  4. Emite myio:update-date com periodo atual  ← FIX
  ↓
ORCHESTRATOR:
  1. Recebe myio:update-date
  2. Atualiza currentPeriod com datas corretas
  3. Chama hydrateDomain('water', currentPeriod)  ← Agora com datas corretas!
  ↓
TELEMETRY:
  1. Recebe myio:update-date
  2. Atualiza periodo interno
  3. Carrega dados de agua com periodo correto
```

### Fix 3: fetchAndEnrich verifica periodKey no cache

O cache de dados (`MyIOOrchestratorData`) so verificava idade do cache, nao o periodo. Isso fazia com que dados do periodo antigo fossem retornados.

```javascript
// ANTES (bug) - retornava cache sem verificar periodo
const cachedData = window.MyIOOrchestratorData?.[domain];
if (cachedData && cachedData.items.length > 0 && cacheAge < 30000) {
  return cachedData.items; // Retorna dados de qualquer periodo!
}

// DEPOIS (fix) - verifica se periodo corresponde
const currentPeriodKey = periodKey(domain, period);
const periodMatches = cachedData.periodKey === currentPeriodKey;
if (cacheAge < 30000 && periodMatches) {
  return cachedData.items; // So retorna se periodo corresponder
}
```

### Fix 4: hydrateDomain passa force flag para spinner

O spinner de carregamento nao aparecia ao trocar de dominio por causa do cooldown de 30 segundos. Agora `hydrateDomain` aceita `options.force` para ignorar cooldown.

```javascript
// ANTES (bug) - spinner nao aparecia se cooldown ativo
showGlobalBusy(domain, 'Carregando dados...');

// DEPOIS (fix) - passa force para ignorar cooldown
hydrateDomain(domain, period, { force: true });
// que internamente chama:
showGlobalBusy(domain, 'Carregando dados...', 25000, { force: true });
```

### Fix 5: waitForCtxData verifica periodo antes de retornar cache

A funcao `waitForCtxData` retornava 'cached' sem verificar se o periodo correspondia. Isso fazia com que dados de um periodo antigo fossem usados.

```javascript
// ANTES (bug) - waitForCtxData ignorava periodo
async function waitForCtxData(maxWaitMs, checkIntervalMs, domain) {
  if (cachedData && cacheAge < 30000) {
    return 'cached'; // Retorna sem verificar periodo!
  }
}

// DEPOIS (fix) - waitForCtxData valida periodo
async function waitForCtxData(maxWaitMs, checkIntervalMs, domain, period) {
  const expectedPeriodKey = periodKey(domain, period);
  const periodMatches = cachedData.periodKey === expectedPeriodKey;
  if (cacheAge < 30000 && periodMatches) {
    return 'cached'; // So retorna se periodo corresponder
  } else if (!periodMatches) {
    // Continua esperando ctx.data ou timeout
  }
}
```

## Files Changed

- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/controller.js`:
  - Lines 500-537: myio:dashboard-state listener (Fix 1)
  - Lines 306-325: onApply callback do DateRangePicker (Fix 2)
- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`:
  - fetchAndEnrich: Cache period validation (Fix 3)
  - hydrateDomain: Added options.force parameter (Fix 4)
  - waitForCtxData: Added period parameter and validation (Fix 5)
  - myio:dashboard-state listener: Passes force=true
  - myio:update-date listener: Passes force=true when period changed

## Testing

1. Abrir dashboard em energia
2. Mudar data para um periodo especifico (ex: 01/09 - 30/09)
3. Clicar "Carregar" - energia carrega com periodo correto
4. Clicar em "Agua" no MENU
5. **Esperado:** Agua carrega automaticamente com o periodo 01/09 - 30/09
6. **Antes:** Agua carregava com periodo antigo/inicial

## Related RFCs

- RFC-0042: Dashboard state management
- RFC-0045: Initial period emission
- RFC-0096: Race condition fix for domain state
- RFC-0130: Retry mechanism and global period storage
