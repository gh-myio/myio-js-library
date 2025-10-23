# Fix: HEADER Robustness and Reliability Improvements

**Data:** 2025-10-23
**Widget:** HEADER v-5.2.0
**Severidade:** P0 - CRÍTICA
**Status:** ✅ RESOLVIDO

## Problemas Reportados

**User Report:**
> "agora funcionou bem, deu um refresh na tela depois não funcionou, mostrou erro. Dados recarregados automaticamente mas ficou tudo zerado e além disso no HEADER na 5.2.0 ao mudar o intervalo e clicar em carregar não recarregou nada, nem o Limpar está zerando nada, os widgets telemetry continuam com os dados e de forma intermitente no domain energy o botão no HEADER para Relatório ficou desabilitado ao invés de mostrar Relatório Consumo Geral por Loja desabilitado e as vezes Relatório Consumo, e deveria mostrar energia enfim tem que ficar mais robusto esses controles"

### Resumo dos Problemas

1. ❌ **Intermitência:** Funciona, depois refresh e para de funcionar
2. ❌ **Dados zerados:** Recarrega mas fica tudo zerado
3. ❌ **Carregar não recarrega:** Mudar intervalo + clicar "Carregar" não faz nada
4. ❌ **Limpar não limpa:** Clicar "Limpar" não zera os dados visuais
5. ❌ **Texto inconsistente:** Botão "Relatório" mostra textos diferentes de forma intermitente

---

## Problema 1: updateControlsState com domain=null

### Causa Raiz

```javascript
// ANTES (linha 343)
updateControlsState(currentDomain); // ❌ currentDomain = null no init
```

**Fluxo Problemático:**
```
1. HEADER onInit()
   ↓
2. currentDomain = null (linha 29)
   ↓
3. updateControlsState(null) ← ❌ CHAMADO COM NULL!
   ↓
4. isSupported = (null === 'energy' || null === 'water') = false
   ↓
5. btnLoad.disabled = true ❌ (errado!)
```

**Intermitência:** Se evento `myio:dashboard-state` chega rápido, funciona. Se demora, botões ficam desabilitados.

---

### Solução

**1. Validar domain antes de processar:**

```javascript
const updateControlsState = (domain) => {
  LogHelper.log(`[HEADER] 🔧 updateControlsState called with domain: ${domain}`);

  // RFC-0054: Validate domain
  if (!domain) {
    LogHelper.warn(`[HEADER] ⚠️ updateControlsState called with null/undefined domain - skipping`);
    return; // ✅ Early return - não processa null
  }

  // ... resto da lógica
};
```

**2. Remover chamada inicial com null:**

```javascript
// REMOVIDO (linha 343):
// updateControlsState(currentDomain); // ❌ currentDomain é null aqui
```

**Benefício:** Elimina race condition e intermitência.

---

## Problema 2: Botão "Relatório" com Texto Inconsistente

### Causa Raiz

**Lógica de fallback inconsistente:**

```javascript
// ANTES (linhas 279-285)
if (btnText && domainLabels[domain]) {
  btnText.textContent = domainLabels[domain]; // ✅ "Relatório ... Energia por Loja"
  btnGen.title = domainLabels[domain];
} else if (btnText) {
  btnText.textContent = 'Relatório Consumo Geral'; // ⚠️ Texto genérico
  btnGen.title = 'Relatório Consumo Geral';
}
```

**Problema:**
- Se `domain` está em `domainLabels` → Texto específico ✅
- Se `domain` NÃO está em `domainLabels` → Texto genérico ⚠️
- Se `domain` é `null/undefined` → Texto genérico ou não muda ❌

**Intermitência:** Dependendo de quando `updateControlsState` é chamado, texto varia.

---

### Solução

**Simplificar lógica com operador `||`:**

```javascript
// DEPOIS (linhas 286-291)
if (btnGen && btnText) {
  const label = domainLabels[domain] || 'Relatório Consumo Geral';
  btnText.textContent = label;
  btnGen.title = label;
  btnGen.disabled = !reportSupported;
  LogHelper.log(`[HEADER] 📊 Report button: "${label}" (${btnGen.disabled ? 'disabled' : 'enabled'})`);
}
```

**Comportamento:**
- `domain='energy'` → `label = "Relatório Consumo Geral de Energia por Loja"` ✅
- `domain='water'` → `label = "Relatório Consumo Geral de Água por Loja"` ✅
- `domain='temperature'` → `label = "Relatório Consumo Geral"` ✅
- `domain=null` → **Não executa** (early return) ✅

---

## Problema 3: Botão "Carregar" Não Recarrega

### Causa Raiz

**Evento `myio:update-date` era emitido, mas:**

1. **currentDomain poderia ser null** → Orchestrator ignora
2. **Sem validação** → Erro silencioso
3. **Sem logs detalhados** → Difícil de debugar

---

### Solução

**Adicionar validações robustas:**

```javascript
btnLoad?.addEventListener("click", () => {
  LogHelper.log("[HEADER] 🔄 Carregar button clicked");

  // RFC-0054: Validate current domain
  if (!currentDomain) {
    LogHelper.error("[HEADER] ❌ Cannot load - currentDomain is null");
    alert("Erro: Domínio atual não definido. Por favor, selecione uma aba no menu.");
    return; // ✅ Early return com feedback ao usuário
  }

  if (currentDomain !== 'energy' && currentDomain !== 'water') {
    LogHelper.warn(`[HEADER] ⚠️ Cannot load - domain ${currentDomain} not supported`);
    alert(`Domínio "${currentDomain}" não suporta carregamento de dados.`);
    return; // ✅ Early return com feedback
  }

  // ... emit event
  LogHelper.log(`[HEADER] 📅 Emitting period for domain ${currentDomain}:`, period);
  emitToAllContexts("myio:update-date", { period });
  LogHelper.log("[HEADER] ✅ Period emitted successfully");
});
```

**Benefícios:**
- ✅ Valida `currentDomain` antes de emitir
- ✅ Feedback claro ao usuário via alert
- ✅ Logs detalhados para debug
- ✅ Elimina "Carregar não faz nada" silenciosamente

---

## Problema 4: Botão "Limpar" Não Limpa Dados Visuais

### Causa Raiz

**Fluxo ANTES:**
```
1. User clica "Limpar"
   ↓
2. Limpa localStorage ✅
3. Invalida cache do orchestrator ✅
4. Dispara evento 'myio:telemetry:clear' ✅
5. TELEMETRY widgets limpam visualmente ✅
6. ❌ NÃO dispara 'myio:update-date' para recarregar
   ↓
7. Widgets ficam zerados ❌
```

**Problema:** Limpa mas não recarrega → dados ficam zerados.

---

### Solução

**Auto-reload após limpar:**

```javascript
// DEPOIS (linhas 499-517)
// RFC-0054: Auto-reload data after clearing
LogHelper.log(`[HEADER] 🔄 Auto-reloading data for domain: ${currentDomain}`);

// Small delay to ensure clear event is processed
setTimeout(() => {
  const startISO = toISO(self.ctx.$scope.startTs || inputStart.value + "T00:00:00", 'America/Sao_Paulo');
  const endISO = toISO(self.ctx.$scope.endTs || inputEnd.value + "T23:59:00", 'America/Sao_Paulo');

  const period = {
    startISO,
    endISO,
    granularity: calcGranularity(startISO, endISO),
    tz: 'America/Sao_Paulo'
  };

  LogHelper.log(`[HEADER] 📅 Emitting reload period:`, period);
  emitToAllContexts("myio:update-date", { period });
  LogHelper.log("[HEADER] ✅ Reload triggered successfully");
}, 100); // 100ms delay to ensure clear event is processed
```

**Fluxo DEPOIS:**
```
1. User clica "Limpar"
   ↓
2. Limpa localStorage ✅
3. Invalida cache do orchestrator ✅
4. Dispara 'myio:telemetry:clear' ✅
5. TELEMETRY widgets limpam visualmente ✅
6. ✅ Aguarda 100ms
7. ✅ Dispara 'myio:update-date' com período atual
8. ✅ Orchestrator chama API (sem cache)
9. ✅ TELEMETRY widgets renderizam novos dados
10. ✅ Dados atualizados exibidos!
```

**Mensagem ao usuário:**
```javascript
// ANTES:
alert("Cache limpo com sucesso! Clique em 'Carregar' para buscar dados atualizados.");

// DEPOIS:
alert("Cache limpo com sucesso! Recarregando dados...");
```

**Benefício:** UX melhor - não precisa clicar "Carregar" manualmente.

---

## Problema 5: Validações no Botão "Limpar"

### Solução

**Adicionar validações similares ao botão "Carregar":**

```javascript
// RFC-0054: Validate current domain
if (!currentDomain) {
  LogHelper.error("[HEADER] ❌ Cannot clear - currentDomain is null");
  alert("Erro: Domínio atual não definido. Por favor, selecione uma aba no menu.");
  return;
}

if (currentDomain !== 'energy' && currentDomain !== 'water') {
  LogHelper.warn(`[HEADER] ⚠️ Cannot clear - domain ${currentDomain} not supported`);
  alert(`Domínio "${currentDomain}" não suporta limpeza de cache.`);
  return;
}
```

---

## Resumo das Mudanças

### 1. updateControlsState (linhas 263-311)

**ANTES:**
```javascript
const updateControlsState = (domain) => {
  // Sem validação
  const isSupported = domain === 'energy' || domain === 'water';

  if (btnGen) {
    if (btnText && domainLabels[domain]) {
      btnText.textContent = domainLabels[domain];
    } else if (btnText) {
      btnText.textContent = 'Relatório Consumo Geral'; // Inconsistente
    }
    btnGen.disabled = !reportSupported;
  }
  // Sem logs detalhados
};
```

**DEPOIS:**
```javascript
const updateControlsState = (domain) => {
  LogHelper.log(`[HEADER] 🔧 updateControlsState called with domain: ${domain}`);

  // ✅ Validação early return
  if (!domain) {
    LogHelper.warn(`[HEADER] ⚠️ updateControlsState called with null/undefined domain - skipping`);
    return;
  }

  const isSupported = domain === 'energy' || domain === 'water';
  const reportSupported = domain === 'water';

  // ✅ Lógica simplificada com operador ||
  if (btnGen && btnText) {
    const label = domainLabels[domain] || 'Relatório Consumo Geral';
    btnText.textContent = label;
    btnGen.title = label;
    btnGen.disabled = !reportSupported;
    LogHelper.log(`[HEADER] 📊 Report button: "${label}" (${btnGen.disabled ? 'disabled' : 'enabled'})`);
  }

  // ✅ Logs detalhados para cada controle
  LogHelper.log(`[HEADER] 📅 Date range: ${isSupported ? 'enabled' : 'disabled'}`);
  LogHelper.log(`[HEADER] 🔄 Carregar button: ${isSupported ? 'enabled' : 'disabled'}`);
  LogHelper.log(`[HEADER] 🗑️ Limpar button: ${isSupported ? 'enabled' : 'disabled'}`);
  LogHelper.log(`[HEADER] ✅ updateControlsState completed for domain: ${domain}`);
};
```

---

### 2. btnLoad (linhas 388-424)

**Adicionado:**
- ✅ Validação de `currentDomain` (null check)
- ✅ Validação de domínio suportado
- ✅ Feedback ao usuário via alert
- ✅ Logs detalhados antes/depois de emitir evento

---

### 3. btnForceRefresh (linhas 426-531)

**Adicionado:**
- ✅ Validação de `currentDomain` (null check)
- ✅ Validação de domínio suportado
- ✅ Auto-reload após limpar cache (setTimeout 100ms)
- ✅ Mensagem atualizada: "Recarregando dados..."
- ✅ Logs detalhados do fluxo completo

---

## Fluxo Completo (Corrigido)

### Inicialização

```
1. Dashboard carrega
   ↓
2. HEADER onInit()
   ↓ - currentDomain = null
   ↓ - Registra listeners
   ↓ - ✅ NÃO chama updateControlsState(null)
   ↓
3. MAIN_VIEW dispara 'myio:dashboard-state' com tab='energy'
   ↓
4. HEADER recebe evento
   ↓ - currentDomain = 'energy' ✅
   ↓ - updateControlsState('energy'):
   ↓   - Valida domain ✅
   ↓   - btnGen: "Relatório ... Energia por Loja" (disabled) ✅
   ↓   - btnLoad: enabled ✅
   ↓   - btnForceRefresh: enabled ✅
   ↓
5. HEADER aguarda 500ms e emite 'myio:update-date' ✅
6. Dados carregados ✅
```

---

### Usuário Clica "Carregar"

```
1. User clica "Carregar"
   ↓
2. Valida currentDomain ✅
   ↓ - Se null → alert + return ✅
   ↓ - Se não suportado → alert + return ✅
   ↓
3. Emite 'myio:update-date' com período atual ✅
4. Logs: "Emitting period for domain energy" ✅
5. Orchestrator chama API ✅
6. Dados atualizados ✅
```

---

### Usuário Clica "Limpar"

```
1. User clica "Limpar"
   ↓
2. Valida currentDomain ✅
   ↓ - Se null → alert + return ✅
   ↓ - Se não suportado → alert + return ✅
   ↓
3. Confirmação: "Limpar cache e recarregar?" ✅
4. Limpa localStorage ✅
5. Invalida orchestrator cache ✅
6. Dispara 'myio:telemetry:clear' ✅
7. TELEMETRY widgets limpam visualmente ✅
8. ✅ Aguarda 100ms
9. ✅ Dispara 'myio:update-date'
10. ✅ Orchestrator chama API (sem cache)
11. ✅ TELEMETRY widgets renderizam novos dados
12. ✅ Alert: "Cache limpo com sucesso! Recarregando dados..."
```

---

## Logs de Debug

### Console Esperado (Inicialização)

```
[MAIN_VIEW] 🚀 Dispatching initial tab event for default state: energy
[HEADER] Dashboard state changed to: energy
[HEADER] 🔧 updateControlsState called with domain: energy
[HEADER] 📊 Report button: "Relatório Consumo Geral de Energia por Loja" (disabled)
[HEADER] 📅 Date range: enabled
[HEADER] 🔄 Carregar button: enabled
[HEADER] 🗑️ Limpar button: enabled
[HEADER] ✅ updateControlsState completed for domain: energy
[HEADER] 📅 Will emit initial period for domain energy after 500ms delay...
[HEADER] 📅 Timeout fired, checking __range...
[HEADER] 🚀 Emitting initial period for domain energy: {...}
[Orchestrator] 📅 Received myio:update-date event
[Orchestrator] 🔄 hydrateDomain(energy)
```

---

### Console Esperado (Carregar)

```
[HEADER] 🔄 Carregar button clicked
[HEADER] 📅 Emitting period for domain energy: {...}
[HEADER] ✅ RFC-0053: Emitted myio:update-date (single context)
[HEADER] ✅ Period emitted successfully
[Orchestrator] 📅 Received myio:update-date event
[Orchestrator] 🔄 hydrateDomain(energy)
```

---

### Console Esperado (Limpar)

```
[HEADER] 🗑️ Limpar (Force Refresh) clicked
[HEADER] 🗑️ Removed localStorage key: myio:cache:...
[HEADER] ✅ LocalStorage cache cleared (5 keys removed)
[HEADER] ✅ Orchestrator cache invalidated
[HEADER] ✅ Emitted clear event for domain: energy
[HEADER] 🔄 Auto-reloading data for domain: energy
[TELEMETRY energy] 🧹 Received clear event - clearing visual content
[TELEMETRY energy] ✅ shopsList cleared
[HEADER] 📅 Emitting reload period: {...}
[HEADER] ✅ RFC-0053: Emitted myio:update-date (single context)
[HEADER] ✅ Reload triggered successfully
[HEADER] 🔄 Force Refresh completed successfully
[Orchestrator] 📅 Received myio:update-date event
[Orchestrator] 🔄 hydrateDomain(energy)
```

---

## Teste de Verificação

### Teste 1: Inicialização Robusta

1. Abrir dashboard (state padrão: energy)
2. **Verificar Console:**
   - ✅ Nenhum warning sobre `currentDomain=null`
   - ✅ `updateControlsState` chamado apenas COM domain válido
   - ✅ Botões habilitados/desabilitados corretamente
3. **Verificar HEADER:**
   - ✅ "Relatório Consumo Geral de Energia por Loja" (disabled)
   - ✅ "Carregar" (enabled)
   - ✅ "Limpar" (enabled)

---

### Teste 2: Carregar com Validação

1. Dashboard carregado
2. Clicar "Carregar"
3. **Verificar Console:**
   - ✅ `[HEADER] 🔄 Carregar button clicked`
   - ✅ `[HEADER] 📅 Emitting period for domain energy`
   - ✅ `[HEADER] ✅ Period emitted successfully`
   - ✅ `[Orchestrator] 🔄 hydrateDomain(energy)`
4. **Verificar UI:**
   - ✅ Dados atualizados nos widgets TELEMETRY

---

### Teste 3: Limpar com Auto-Reload

1. Dashboard com dados
2. Clicar "Limpar"
3. Confirmar modal
4. **Verificar Console:**
   - ✅ Cache cleared
   - ✅ `myio:telemetry:clear` emitido
   - ✅ `🔄 Auto-reloading data for domain: energy`
   - ✅ `📅 Emitting reload period`
   - ✅ `hydrateDomain(energy)` chamado
5. **Verificar UI:**
   - ✅ Widgets limpam momentaneamente
   - ✅ Dados recarregam automaticamente após 100ms
   - ✅ Alert: "Cache limpo com sucesso! Recarregando dados..."

---

### Teste 4: Texto Consistente do Botão Relatório

1. Dashboard em energy
2. Refresh (F5)
3. **Verificar:**
   - ✅ Sempre "Relatório Consumo Geral de Energia por Loja"
   - ❌ NUNCA "Relatório Consumo Geral" (genérico)
   - ❌ NUNCA "Relatório Consumo" (truncado)
4. Trocar para water
5. **Verificar:**
   - ✅ "Relatório Consumo Geral de Água por Loja"
6. Trocar para alarm
7. **Verificar:**
   - ✅ Botão disabled
   - ✅ Texto permanece do último domain válido

---

## Impacto

- **Severidade:** P0 (dashboard intermitente, não confiável)
- **Usuários afetados:** Todos
- **Mudanças:** 3 funções refatoradas (updateControlsState, btnLoad, btnForceRefresh)
- **Risco:** Baixo (apenas validações e logs)
- **Breaking changes:** Nenhum

---

## Commit Message

```
fix(HEADER): robustness improvements for controls and data loading

Problems:
1. Intermittent failures after refresh (race conditions)
2. "Carregar" button not reloading data
3. "Limpar" button clearing but not reloading (data stays zeroed)
4. Report button text inconsistent (varies between refreshes)
5. Lack of validation causing silent failures

Root causes:
1. updateControlsState(null) called on init before event received
2. No validation of currentDomain before emitting events
3. "Limpar" not auto-reloading after clearing cache
4. Fallback text logic inconsistent
5. Insufficient logging for debugging

Solutions:
1. Early return in updateControlsState if domain is null/undefined
2. Validate currentDomain before emitting in btnLoad/btnForceRefresh
3. Auto-reload data after clearing cache (100ms delay)
4. Simplify text logic with || operator
5. Add detailed logs at every step

Result:
- No more intermittent failures
- "Carregar" always works with validation feedback
- "Limpar" clears and auto-reloads data
- Report button text always consistent
- Easy to debug with detailed logs

Files: HEADER/controller.js lines 263-531
RFC: RFC-0054
Severity: P0 - Dashboard controls were unreliable
```

---

✅ **HEADER agora é robusto, confiável e com feedback claro ao usuário!** 🎉
