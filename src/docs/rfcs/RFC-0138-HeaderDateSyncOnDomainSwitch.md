# RFC-0138: Header Date Sync on Domain Switch

## Status
Implemented

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

Remover a condicao `!hasEmittedInitialPeriod` para emitir as datas **sempre** que o dominio mudar para energy ou water:

```javascript
// DEPOIS (fix)
if (tab === 'energy' || tab === 'water') {
  hasEmittedInitialPeriod = true;
  // emitir datas SEMPRE
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

## Files Changed

- `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/controller.js` (lines 500-537)

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
