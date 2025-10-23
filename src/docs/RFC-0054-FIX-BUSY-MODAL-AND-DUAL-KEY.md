# RFC-0054: Fix Busy Modal Persistence e Dual Cache Key

Data: 2025-10-22
Status: Aceito — Implementação recomendada
Prioridade: P1 (UX e Performance)
Relacionados: RFC-0042 (Orchestrator), RFC-0044 (Busy Centralizado), RFC-0052 (Cache Toggle), RFC-0053 (Sem iframes)
Owner: Plataforma MyIO

---

## Resumo Executivo

ApÃ³s implementaÃ§Ã£o bem-sucedida do RFC-0053 (navegaÃ§Ã£o sem iframes) e RFC-0052 (cache toggle), foram identificados dois problemas crÃ­ticos que impactam a experiÃªncia do usuÃ¡rio:

1. **Modal "Carregando dados" persiste apÃ³s dados jÃ¡ estarem visÃ­veis** - usuÃ¡rio vÃª os cards carregados ao fundo, mas a modal nÃ£o Ã© removida
2. **Dual cache key** - primeira requisiÃ§Ã£o usa `null:energy:...` e dÃ¡ timeout de 10s, segunda usa `customerTB_ID:energy:...` e funciona

Ambos problemas decorrem de **race conditions** e **mÃºltiplas instÃ¢ncias de widgets** carregando simultaneamente.

---

## MotivaÃ§Ã£o

### Problema 1: Modal Busy NÃ£o Esconde ApÃ³s Dados Carregados

**Sintoma relatado pelo usuÃ¡rio:**
> "por que mesmo eu conseguindo ver os dados jÃ¡ carregados ao fundo ainda ficou mostrando a modal carregando dados ou carregando dados energy"

**EvidÃªncia no log:**
```
Line 341: [TELEMETRY] ðŸ“Š Data processed successfully - ensuring busy is hidden
Line 350: [TELEMETRY] ðŸ“Š Data processed successfully - ensuring busy is hidden
Line 359: [TELEMETRY] ðŸ“Š Data processed successfully - ensuring busy is hidden
... mas NÃƒO hÃ¡ log "[Orchestrator] âœ… Global busy hidden" correspondente!
```

**AnÃ¡lise:**
- 3 widgets TELEMETRY processaram dados com sucesso (1, 65 e 231 items)
- Cada widget chamou "ensuring busy is hidden" no `dataProvideHandler`
- Mas `hideGlobalBusy()` **NÃƒO foi chamado** apÃ³s esses eventos
- `hideGlobalBusy()` sÃ³ Ã© chamado no `finally` block do `fetchAndEnrich`, mas hÃ¡ **mÃºltiplas requisiÃ§Ãµes em paralelo**
- A Ãºltima requisiÃ§Ã£o (com timeout de 30s) bloqueia o hide da modal

**SequÃªncia temporal:**
```
T+0s:   [Orchestrator] showGlobalBusy() - timeout ID: 443
T+0.2s: [Orchestrator] showGlobalBusy() - timeout ID: 447 (substitui 443)
T+0.4s: [Orchestrator] showGlobalBusy() - timeout ID: 450 (substitui 447)
T+0.6s: [Orchestrator] showGlobalBusy() - timeout ID: 453 (substitui 450)
...
T+5s:   [TELEMETRY] ðŸ“Š Data processed successfully (DADOS VISÃVEIS!)
T+8s:   [Orchestrator] hideGlobalBusy() called (primeira requisiÃ§Ã£o terminou)
T+10s:  [Orchestrator] hideGlobalBusy() called (segunda requisiÃ§Ã£o terminou)
T+30s:  [Orchestrator] hideGlobalBusy() called (Ãºltima requisiÃ§Ã£o timeout)
```

**Problema:** Modal sÃ³ esconde quando a **ÃšLTIMA** requisiÃ§Ã£o termina (seja sucesso ou timeout), mesmo que os dados jÃ¡ estejam visÃ­veis hÃ¡ 25 segundos!

---

### Problema 2: Dual Cache Key

**EvidÃªncia no log:**
```
Line 147: hydrateDomain called for energy: {key: 'null:energy:2025-10-01...', inFlight: false}
Line 155: [Orchestrator] â³ Waiting for credentials to be set...
... (timeout 10s)

Line 158: hydrateDomain called for energy: {key: '20b93da0-9011-11f0-...:energy:2025-10-01...', inFlight: false}
Line 166: [Orchestrator] â³ Waiting for credentials to be set...
... (sucesso em 5s)
```

**AnÃ¡lise:**
1. **Primeira chamada:** HEADER emite `myio:update-date` ANTES de `customerTB_ID` estar disponÃ­vel
   - Cache key gerado: `null:energy:...`
   - `fetchAndEnrich` espera 10s por credentials e dÃ¡ timeout

2. **Segunda chamada:** HEADER emite `myio:update-date` DEPOIS de `customerTB_ID` estar disponÃ­vel
   - Cache key gerado: `20b93da0-...:energy:...`
   - `fetchAndEnrich` obtÃ©m credentials e busca dados com sucesso

**Root Cause:**
- HEADER emite evento no `onInit()` logo apÃ³s inicializar o DateRangePicker
- MAIN_VIEW ainda estÃ¡ populando `widgetSettings.customerTB_ID` via async fetch de attributes
- Race condition: evento emitido antes de credentials estarem prontas

**Fluxo atual (INCORRETO):**
```javascript
// MAIN_VIEW/controller.js
async onInit() {
  // 1. Inicializa orchestrator (customerTB_ID ainda undefined)

  // 2. Busca credentials do TB (async - leva ~500ms)
  const attrs = await fetchCustomerAttributes();

  // 3. Seta credentials no orchestrator
  MyIOOrchestrator.setCredentials(...);
}

// HEADER/controller.js
onInit() {
  // 4. Emite evento INICIAL (pode executar antes de step 3!)
  this.emitInitialPeriod(); // âŒ customerTB_ID pode ser null aqui!
}
```

---

## Problemas Identificados no Log

### 1. Modal Busy Persiste (P0 - UX crÃ­tico)
- **Status:** âŒ CRÃTICO
- **Impacto:** UsuÃ¡rio vÃª dados carregados mas modal "Carregando..." bloqueia interaÃ§Ã£o
- **Causa:** `hideGlobalBusy()` sÃ³ executa quando ÃšLTIMA requisiÃ§Ã£o paralela termina
- **Workaround atual:** Nenhum - usuÃ¡rio deve aguardar timeout de 30s

### 2. Dual Cache Key (P1 - Performance)
- **Status:** âš ï¸ ALTA PRIORIDADE
- **Impacto:** 10s de delay desnecessÃ¡rio + requisiÃ§Ã£o duplicada para API
- **Causa:** HEADER emite evento antes de `customerTB_ID` estar disponÃ­vel
- **Workaround atual:** Segunda requisiÃ§Ã£o funciona, mas hÃ¡ 10s de delay

### 3. MÃºltiplas InstÃ¢ncias de TELEMETRY (P2 - Performance)
- **Status:** âš ï¸ MÃ‰DIA PRIORIDADE
- **Impacto:** 6 widgets carregados, 3 renderizando, 17 pending listeners
- **Causa:** Template HTML pode ter mÃºltiplos `<tb-dashboard-state stateId="telemetry_content">`
- **EvidÃªncia:**
  ```
  6x "[TELEMETRY] Controller loaded - VERSION WITH ORCHESTRATOR SUPPORT"
  3x widgets processando dados (1, 65, 231 items)
  "[Orchestrator] ðŸ“¢ Processing 17 pending listeners for energy"
  ```

### 4. Multiple showGlobalBusy() Calls (P2 - Log noise)
- **Status:** âš ï¸ MÃ‰DIA PRIORIDADE
- **Impacto:** MÃºltiplas chamadas `showGlobalBusy()` substituindo timeout IDs
- **Causa:** Cada `hydrateDomain` chama `showGlobalBusy()` independentemente
- **EvidÃªncia:**
  ```
  timeout ID: 443 â†’ 447 â†’ 450 â†’ 453 (4 chamadas em sequÃªncia)
  ```

### 5. Credentials Timeout na Primeira RequisiÃ§Ã£o (P1 - Performance)
- **Status:** âš ï¸ ALTA PRIORIDADE
- **Impacto:** Primeira requisiÃ§Ã£o sempre espera 10s e falha
- **Causa:** Cache key usa `null` porque `customerTB_ID` ainda nÃ£o foi setado
- **Resultado:** Timeout error + API nÃ£o chamada + retry necessÃ¡rio

---

## DecisÃ£o de Arquitetura

### OpÃ§Ã£o A: Contador de RequisiÃ§Ãµes Ativas (RECOMENDADA)

**Conceito:** Orchestrator mantÃ©m contador de requisiÃ§Ãµes ativas por domÃ­nio. Modal sÃ³ esconde quando contador chega a zero.

**Vantagens:**
- âœ… Modal esconde assim que PRIMEIRA requisiÃ§Ã£o bem-sucedida termina
- âœ… NÃ£o depende de todas as requisiÃ§Ãµes paralelas terminarem
- âœ… Suporta mÃºltiplas instÃ¢ncias de widgets
- âœ… CompatÃ­vel com arquitetura atual

**Desvantagens:**
- âš ï¸ Aumenta complexidade (contador + mutex)

**ImplementaÃ§Ã£o:**
```javascript
// MAIN_VIEW/controller.js - MyIOOrchestrator

const activeRequests = new Map(); // domain -> count

function showGlobalBusy(domain, message) {
  if (!activeRequests.has(domain)) {
    activeRequests.set(domain, 0);
  }

  const count = activeRequests.get(domain);
  activeRequests.set(domain, count + 1);

  LogHelper.log(`[Orchestrator] ðŸ“Š Active requests for ${domain}: ${count + 1}`);

  // SÃ³ mostra modal se for a primeira requisiÃ§Ã£o
  if (count === 0) {
    // Show modal logic...
    LogHelper.log(`[Orchestrator] ðŸ”„ showGlobalBusy() domain=${domain}`);
  } else {
    LogHelper.log(`[Orchestrator] â­ï¸ Skipping showGlobalBusy (already shown)`);
  }
}

function hideGlobalBusy(domain) {
  const count = activeRequests.get(domain) || 0;

  if (count <= 1) {
    activeRequests.set(domain, 0);
    // Hide modal logic...
    LogHelper.log(`[Orchestrator] âœ… hideGlobalBusy() - all requests completed`);
  } else {
    activeRequests.set(domain, count - 1);
    LogHelper.log(`[Orchestrator] â­ï¸ Skipping hideGlobalBusy (${count - 1} active)`);
  }
}
```

**CritÃ©rios de aceite:**
- Modal esconde assim que primeira requisiÃ§Ã£o bem-sucedida retornar
- Log mostra: "Active requests: 4 â†’ 3 â†’ 2 â†’ 1 â†’ 0 (hide modal)"
- UsuÃ¡rio NÃƒO vÃª dados carregados com modal bloqueando

---

### OpÃ§Ã£o B: Event-driven Hide (ALTERNATIVA)

**Conceito:** TELEMETRY widgets emitem evento `myio:telemetry:data-ready` quando processam dados. Orchestrator esconde modal ao receber primeiro evento.

**Vantagens:**
- âœ… Modal esconde imediatamente quando dados ficam visÃ­veis
- âœ… Desacoplado do fetch (widget decide quando estÃ¡ pronto)

**Desvantagens:**
- âŒ Maior complexidade (novo canal de eventos)
- âŒ Widgets precisam implementar novo evento

**ImplementaÃ§Ã£o:**
```javascript
// TELEMETRY/controller.js - dataProvideHandler
function handleProvideData(event) {
  // ... process data ...

  if (enrichedItems.length > 0) {
    renderCards(enrichedItems);

    // Notifica orchestrator que dados estÃ£o visÃ­veis
    window.dispatchEvent(new CustomEvent('myio:telemetry:data-ready', {
      detail: { domain: WIDGET_DOMAIN }
    }));
  }
}

// MAIN_VIEW/controller.js - MyIOOrchestrator
window.addEventListener('myio:telemetry:data-ready', (event) => {
  const { domain } = event.detail;
  hideGlobalBusy(domain);
  LogHelper.log(`[Orchestrator] ðŸŽ‰ Data ready for ${domain} - hiding busy`);
});
```

---

## SoluÃ§Ã£o para Dual Cache Key

### Fix: Esperar Credentials Antes de Emitir Evento

**Problema atual:**
```javascript
// HEADER/controller.js
self.onInit = async function() {
  initDatePicker();

  // Emite IMEDIATAMENTE (customerTB_ID pode ser null!)
  emitInitialPeriod(); // âŒ
};
```

**SoluÃ§Ã£o:**
```javascript
// HEADER/controller.js
self.onInit = async function() {
  initDatePicker();

  // Espera credentials estarem disponÃ­veis
  await MyIOOrchestrator.waitForCredentials(); // âœ…

  // Agora emite com customerTB_ID correto
  emitInitialPeriod();
};

// MAIN_VIEW/controller.js - MyIOOrchestrator
let credentialsPromise = null;

function setCredentials(customerId, clientId, clientSecret) {
  CUSTOMER_ING_ID = customerId;
  CLIENT_ID = clientId;
  CLIENT_SECRET = clientSecret;

  if (credentialsResolve) {
    credentialsResolve(); // Resolve promise existente
  }
}

function waitForCredentials(timeoutMs = 5000) {
  if (CLIENT_ID && CLIENT_SECRET && CUSTOMER_ING_ID) {
    return Promise.resolve(); // JÃ¡ disponÃ­vel
  }

  if (!credentialsPromise) {
    credentialsPromise = new Promise((resolve, reject) => {
      credentialsResolve = resolve;
      setTimeout(() => reject(new Error('Credentials timeout')), timeoutMs);
    });
  }

  return credentialsPromise;
}
```

**CritÃ©rios de aceite:**
- Apenas UMA chamada `hydrateDomain` com cache key correto
- Nenhum timeout de 10s na primeira requisiÃ§Ã£o
- Log mostra: "âœ… Credentials available before emitting event"

---

## SoluÃ§Ã£o para MÃºltiplas InstÃ¢ncias TELEMETRY

### InvestigaÃ§Ã£o NecessÃ¡ria

**Verificar template HTML:**
```bash
grep -n "tb-dashboard-state.*telemetry_content" MAIN_VIEW/template.html
```

**Expectativa:**
- Apenas UM `<tb-dashboard-state stateId="telemetry_content">` no template
- Se mÃºltiplos existirem: remover duplicatas

**EvidÃªncia atual:**
```
6x "[TELEMETRY] Controller loaded"
3x widgets processando dados
17 pending listeners
```

**PossÃ­veis causas:**
1. Template tem mÃºltiplos `<div data-content-state="telemetry_content">` com o mesmo widget
2. ThingsBoard estÃ¡ carregando widget duplicado por configuraÃ§Ã£o incorreta
3. Estados TB tÃªm widgets duplicados

**Action items:**
1. Inspecionar MAIN_VIEW/template.html
2. Inspecionar configuraÃ§Ã£o de Estados TB
3. Verificar se hÃ¡ cÃ³digo criando widgets dinamicamente

---

## Plano de ImplementaÃ§Ã£o

### Fase 1: Fix Busy Modal Persistence (P0)
**Prazo:** 2-4 horas
**Owner:** Desenvolvedor Frontend

**Tasks:**
1. Implementar contador de requisiÃ§Ãµes ativas (OpÃ§Ã£o A)
2. Modificar `showGlobalBusy()` para incrementar contador
3. Modificar `hideGlobalBusy()` para decrementar e verificar zero
4. Adicionar logs: "Active requests: X"
5. Testar: verificar modal esconde apÃ³s primeira requisiÃ§Ã£o bem-sucedida

### Fase 2: Fix Dual Cache Key (P1)
**Prazo:** 1-2 horas
**Owner:** Desenvolvedor Frontend

**Tasks:**
1. Implementar `waitForCredentials()` no Orchestrator
2. Modificar HEADER para await antes de emitir evento
3. Adicionar timeout de 5s com fallback
4. Testar: verificar apenas uma chamada `hydrateDomain` com key correto

### Fase 3: Investigar MÃºltiplas InstÃ¢ncias (P2)
**Prazo:** 1-2 horas
**Owner:** Desenvolvedor Frontend

**Tasks:**
1. Inspecionar MAIN_VIEW/template.html
2. Inspecionar configuraÃ§Ã£o de Estados TB no dashboard
3. Verificar cÃ³digo que cria widgets dinamicamente
4. Remover duplicatas se encontradas
5. Testar: verificar apenas 1 widget TELEMETRY por domÃ­nio

### Fase 4: Cleanup de Logs (P3)
**Prazo:** 30min
**Owner:** Desenvolvedor Frontend

**Tasks:**
1. Remover logs duplicados de `showGlobalBusy()`
2. Consolidar logs em um Ãºnico ponto de entrada
3. Adicionar IDs de requisiÃ§Ã£o para rastreamento

---

## Plano de Testes

### Teste 1: Modal Esconde ApÃ³s Primeira RequisiÃ§Ã£o
**Setup:**
1. Abrir dashboard
2. Clicar em "Energia" no menu
3. Observar modal "Carregando dados energy..."

**Expectativa:**
- Modal aparece imediatamente
- Dados carregam em ~5s
- Modal esconde assim que dados aparecem (nÃ£o espera 30s)

**Logs esperados:**
```
[Orchestrator] ðŸ“Š Active requests for energy: 1
[Orchestrator] ðŸ”„ showGlobalBusy() domain=energy
... (requisiÃ§Ã£o)
[Orchestrator] ðŸ“Š Active requests for energy: 0
[Orchestrator] âœ… hideGlobalBusy() - all requests completed
```

### Teste 2: Apenas Uma RequisiÃ§Ã£o com Cache Key Correto
**Setup:**
1. Limpar localStorage
2. Recarregar dashboard
3. Observar logs no console

**Expectativa:**
- Apenas UMA chamada `hydrateDomain` para energy
- Cache key: `20b93da0-...:energy:...` (nÃ£o `null:energy:...`)
- Nenhum timeout de 10s

**Logs esperados:**
```
[Orchestrator] âœ… Credentials available before emitting event
[Orchestrator] hydrateDomain called for energy: {key: '20b93da0-...:energy:...'}
[Orchestrator] âœ… Fresh data fetched for energy in ~5000ms
```

### Teste 3: Apenas Uma InstÃ¢ncia TELEMETRY
**Setup:**
1. Abrir dashboard
2. Observar console

**Expectativa:**
- 1x "[TELEMETRY] Controller loaded" por domÃ­nio
- 1x widget processando dados por domÃ­nio
- MÃ¡ximo 3-4 pending listeners (um por domÃ­nio)

**Logs esperados:**
```
[TELEMETRY] Controller loaded - VERSION WITH ORCHESTRATOR SUPPORT
[TELEMETRY energy] Built X items from TB
[Orchestrator] ðŸ“¢ Processing 1 pending listeners for energy
```

---

## Riscos e DependÃªncias

### Riscos
1. **Contador de requisiÃ§Ãµes desincronizado** - Se houver erro antes de `hideGlobalBusy()`, contador pode ficar > 0
   - **MitigaÃ§Ã£o:** Implementar timeout de seguranÃ§a (30s) que forÃ§a hide

2. **waitForCredentials() pode bloquear HEADER indefinidamente** - Se credentials nunca setadas
   - **MitigaÃ§Ã£o:** Timeout de 5s com fallback para emitir evento mesmo assim

3. **MÃºltiplas instÃ¢ncias podem ser intencional** - ThingsBoard pode estar configurado assim
   - **MitigaÃ§Ã£o:** Verificar com usuÃ¡rio antes de remover

### DependÃªncias
- âœ… RFC-0053 implementado (navegaÃ§Ã£o sem iframes)
- âœ… RFC-0042 implementado (Orchestrator)
- âœ… RFC-0044 implementado (Busy Centralizado)

---

## CritÃ©rios de Aceite Geral

### Must-Have (P0/P1)
- [ ] Modal "Carregando..." esconde assim que dados ficam visÃ­veis
- [ ] Apenas UMA requisiÃ§Ã£o `hydrateDomain` por evento `myio:update-date`
- [ ] Cache key SEMPRE usa `customerTB_ID` correto (nunca `null`)
- [ ] Nenhum timeout de 10s na primeira requisiÃ§Ã£o

### Should-Have (P2)
- [ ] Apenas uma instÃ¢ncia de widget TELEMETRY por domÃ­nio
- [ ] Logs consolidados e sem duplicaÃ§Ã£o excessiva
- [ ] Pending listeners <= nÃºmero de domÃ­nios ativos

### Nice-to-Have (P3)
- [ ] IDs de requisiÃ§Ã£o nos logs para rastreamento
- [ ] MÃ©tricas de performance (tempo de carregamento por requisiÃ§Ã£o)

---

## ReferÃªncias

- Master: `RFC-0042-ORCHESTRATOR.md` (central data management)
- Master: `RFC-0044-BUSY-CENTRALIZADO.md` (busy modal implementation)
- Master: `RFC-0052-CACHE-TOGGLE.md` (cache control)
- Master: `RFC-0053-ELIMINATE-IFRAMES.md` (single window context)
- Log analisado: `dashboard.myio-bas.com-1761182787138-CLEAN.log`

---

## ApÃªndices

### ApÃªndice A: Fluxo Atual vs Proposto

**Fluxo Atual (INCORRETO):**
```
T+0ms:    MAIN_VIEW inicia (customerTB_ID = undefined)
T+50ms:   HEADER inicia e emite myio:update-date
          â””â”€> hydrateDomain(key: 'null:energy:...')  âŒ
              â””â”€> fetchAndEnrich espera credentials (10s timeout)
T+200ms:  MAIN_VIEW recebe attrs e seta credentials
T+300ms:  HEADER recebe myio:dashboard-state e emite NOVAMENTE
          â””â”€> hydrateDomain(key: '20b93da0:energy:...')  âœ…
              â””â”€> fetchAndEnrich obtÃ©m dados (5s)
T+5300ms: Dados carregados e visÃ­veis
T+8000ms: Primeira requisiÃ§Ã£o timeout
T+30000ms: Modal FINALMENTE esconde  âŒ PROBLEMA!
```

**Fluxo Proposto (CORRETO):**
```
T+0ms:    MAIN_VIEW inicia (customerTB_ID = undefined)
T+50ms:   HEADER inicia e AGUARDA credentials
          â””â”€> await waitForCredentials()  âœ…
T+200ms:  MAIN_VIEW recebe attrs e seta credentials
          â””â”€> resolve waitForCredentials()
T+201ms:  HEADER emite myio:update-date com credentials prontas
          â””â”€> hydrateDomain(key: '20b93da0:energy:...')  âœ…
              â””â”€> fetchAndEnrich obtÃ©m dados (5s)
              â””â”€> Active requests: 1 â†’ 0
T+5200ms: Dados carregados, modal esconde IMEDIATAMENTE  âœ…
```

### ApÃªndice B: CÃ³digo de Exemplo Completo

**MAIN_VIEW/controller.js - Contador de requisiÃ§Ãµes:**
```javascript
const MyIOOrchestrator = (function() {
  const activeRequests = new Map(); // domain -> count
  let credentialsResolve = null;
  let credentialsPromise = null;

  function showGlobalBusy(domain, message = "Carregando dados...") {
    const count = activeRequests.get(domain) || 0;
    activeRequests.set(domain, count + 1);

    LogHelper.log(`[Orchestrator] ðŸ“Š Active requests for ${domain}: ${count + 1}`);

    if (count === 0) {
      // Show modal only for first request
      const timeoutId = WidgetMonitor.startMonitoring(domain);
      showBusyModal(domain, message);
      LogHelper.log(`[Orchestrator] ðŸ”„ showGlobalBusy() domain=${domain} message="${message}"`);
      LogHelper.log(`[Orchestrator] âœ… Global busy shown for ${domain}, timeout ID: ${timeoutId}`);
    } else {
      LogHelper.log(`[Orchestrator] â­ï¸ Skipping showGlobalBusy (already shown, ${count + 1} active)`);
    }
  }

  function hideGlobalBusy(domain) {
    const count = activeRequests.get(domain) || 0;

    if (count <= 1) {
      activeRequests.set(domain, 0);
      WidgetMonitor.stopMonitoring(domain);
      hideBusyModal();
      LogHelper.log(`[Orchestrator] âœ… hideGlobalBusy() - all ${domain} requests completed`);
    } else {
      activeRequests.set(domain, count - 1);
      LogHelper.log(`[Orchestrator] â­ï¸ Skipping hideGlobalBusy (${count - 1} active ${domain} requests)`);
    }
  }

  function setCredentials(customerId, clientId, clientSecret) {
    CUSTOMER_ING_ID = customerId;
    CLIENT_ID = clientId;
    CLIENT_SECRET = clientSecret;

    LogHelper.log(`[Orchestrator] âœ… Credentials set successfully`);

    if (credentialsResolve) {
      credentialsResolve();
      credentialsResolve = null;
    }
  }

  function waitForCredentials(timeoutMs = 5000) {
    if (CLIENT_ID && CLIENT_SECRET && CUSTOMER_ING_ID) {
      LogHelper.log(`[Orchestrator] âœ… Credentials already available`);
      return Promise.resolve();
    }

    if (!credentialsPromise) {
      LogHelper.log(`[Orchestrator] â³ Waiting for credentials (timeout: ${timeoutMs}ms)...`);
      credentialsPromise = new Promise((resolve, reject) => {
        credentialsResolve = resolve;
        setTimeout(() => {
          LogHelper.warn(`[Orchestrator] âš ï¸ Credentials timeout after ${timeoutMs}ms`);
          reject(new Error(`Credentials timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });
    }

    return credentialsPromise;
  }

  return {
    showGlobalBusy,
    hideGlobalBusy,
    setCredentials,
    waitForCredentials,
    // ... outros mÃ©todos
  };
})();
```

**HEADER/controller.js - Await credentials:**
```javascript
self.onInit = async function() {
  LogHelper.log('[HEADER] ðŸŸ¢ onInit started');

  // Init date picker
  const period = getDefaultPeriod();
  initDateRangePicker(period);

  // Wait for credentials before emitting
  try {
    await MyIOOrchestrator.waitForCredentials(5000);
    LogHelper.log('[HEADER] âœ… Credentials ready, emitting initial period');
  } catch (error) {
    LogHelper.warn('[HEADER] âš ï¸ Proceeding without credentials (timeout)');
  }

  // Now emit with correct customerTB_ID
  if (currentDomain) {
    emitDateUpdate(currentDomain, period);
  }
};
```

---

**Fim do RFC-0054**

---

## Atualização 2025-10-23 — Correções aprovadas com base no LOG

Observações principais do log ...2787138-CLEAN.log:
- Várias emissões de myio:update-date e múltiplos showBusy()/hideBusy().
- provide-data com 354 itens entregue várias vezes; logo após, novos showGlobalBusy() por reexecuções e timeouts de credenciais (10s).
- Chaves de cache divergentes: 20b93da0-...:energy:... e posteriormente 
ull:energy:....

Decisões e ações técnicas
- Busy Modal (P0):
  - Implementar contador de requisições por domínio (show/hide idempotentes).
  - Ocultar modal no primeiro provide-data com itens > 0 (segurança UX).
  - Evitar reabrir modal se lastProvide.periodKey igual e ge < 30s (cooldown, sem iframes).
- Dual Key (P1):
  - Congelar customerTB_ID em window.MyIOOrchestrator.customerTbId após onInit() do MAIN_VIEW e usá-lo em cacheKey().
  - Header: emitir período inicial somente após myio:orchestrator:ready e credentialsSet=true (com debounce 200ms).
- Debounce/Coalescência (P1):
  - Debounce 200–300ms para myio:update-date no HEADER.
  - No Orchestrator, se inFlight para o mesmo periodKey, não reabrir modal; apenas adicionar listeners pendentes.

Especificação de implementação
- Contador + cooldown (MAIN_VIEW Orchestrator):
`
const activeRequests = new Map(); // domain -> count
const lastProvide = new Map();    // domain -> { periodKey, at }

function showGlobalBusy(domain, message){
  const now = Date.now();
  const lp = lastProvide.get(domain);
  if (lp && (now - lp.at) < 30_000) {
    // Cooldown: não reabrir modal
    LogHelper.log([Orchestrator] ⏭️ Cooldown active for , skipping busy);
    return;
  }
  const n = activeRequests.get(domain) || 0;
  activeRequests.set(domain, n + 1);
  if (n === 0) { /* exibir overlay */ }
}

function hideGlobalBusy(domain){
  const n = activeRequests.get(domain) || 0;
  if (n <= 1) { activeRequests.set(domain, 0); /* ocultar overlay */ }
  else { activeRequests.set(domain, n - 1); }
}

function onProvide(domain, periodKey, items){
  if (items && items.length) {
    lastProvide.set(domain, { periodKey, at: Date.now() });
    hideGlobalBusy(domain); // segurança UX
  }
}
`
- emitProvide(...): chamar onProvide(domain, periodKey, items) após window.dispatchEvent(...).
- equest-data listener: se lastProvide recente para mesmo período, reemitir evento e não abrir modal (refresh em background opcional).

- Dual key (MAIN_VIEW + HEADER):
`
// MAIN_VIEW onInit()
window.MyIOOrchestrator.customerTbId = widgetSettings.customerTB_ID;
function cacheKey(domain, period){
  const id = window.MyIOOrchestrator.customerTbId;
  if (!id) throw new Error('customerTB_ID missing');
  return ${id}::::;
}

// HEADER onInit()
window.addEventListener('myio:orchestrator:ready', () => {
  if (window.MyIOOrchestrator?.credentialsSet) {
    setTimeout(() => emitInitialPeriod(), 200);
  }
});
`

Critérios de aceite finais
- Modal não permanece visível quando dados já estão na tela.
- Ausência de logs com null:energy:... em chaves.
- Busy overlay não reabre em loop para o mesmo período dentro de 30s.
- Redução clara de requisições duplicadas para o mesmo periodKey.

---

## Atualização 2025-10-23 02:01 — Análise LOG dashboard.myio-bas.com-1761185672056-CLEAN.log

### Status de Implementação

**✅ P0: Contador de Requisições Ativas - IMPLEMENTADO E FUNCIONANDO**

Evidência do log:
```
Linha 68:  [Orchestrator] 📢 Active requests for energy: 1 (totalBefore=0)
Linha 75:  [Orchestrator] 📢 Active requests for energy: 1 (totalBefore=0)
Linha 82:  [Orchestrator] 📢 Active requests for energy: 2 (totalBefore=1)
Linha 177: [Orchestrator] ⬇ hideGlobalBusy(energy) -> 2→1, total=1
Linha 233: [Orchestrator] ⬇ hideGlobalBusy(energy) -> 1→0, total=0
Linha 234: [Orchestrator] ✅ Global busy hidden
```

**Resultado:** Modal esconde corretamente quando contador chega a 0, mesmo com requisições paralelas. ✅

---

### 🐛 Novos Problemas Identificados

#### Problema 4: Mutex Release Causa Requisição Desnecessária Após Dados Carregados (P0 - CRÍTICO)

**Descrição:**
Após dados serem carregados com sucesso (T+2.6s), uma requisição antiga com `null` key que estava esperando o mutex ser liberado EXECUTA quando a primeira requisição dá timeout (T+10s), causando:
- Nova requisição desnecessária para API
- Risco de modal reabrir mesmo com dados visíveis
- Logs poluídos com erros de timeout

**Sequência Temporal do Problema:**

```
T+0s    Requisição 1: hydrateDomain(key: 'null:energy:...', inFlight: false)
        ↳ Active requests: 0→1
        ↳ showGlobalBusy()
        ↳ fetchAndEnrich() aguardando credentials...

T+0.2s  Requisição 2: hydrateDomain(key: '20b93da0:energy:...', inFlight: false)
        ↳ Active requests: 0→1
        ↳ fetchAndEnrich() aguardando credentials...

T+0.4s  Requisição 3: TELEMETRY widget request
        ↳ hydrateDomain(key: 'null:energy:...', inFlight: TRUE)
        ↳ ⏸️ Waiting for mutex release... (BLOQUEIA AQUI!)

T+2.6s  ✅ DADOS CARREGADOS COM SUCESSO (Requisição 2)
        ↳ fetchAndEnrich: fetched 354 items
        ↳ 3x widgets processaram dados (1, 65, 231 items)
        ↳ hideGlobalBusy: 2→1
        ↳ hideGlobalBusy: 1→0
        ↳ ✅ Modal escondida, usuário VÊ OS DADOS!

T+10s   ❌ TIMEOUT Requisição 1 (null key)
        ↳ Credentials timeout after 10s
        ↳ fetchAndEnrich error
        ↳ finally block executa:
            - hideGlobalBusy: 1→0
            - sharedWidgetState.mutex = false ❌ LIBERA MUTEX
            - delete inFlight[key]

T+10s   ❌ Requisição 3 DESBLOQUEIA
        ↳ Mutex foi liberado → sai do "waiting for mutex"
        ↳ hydrateDomain executa NOVAMENTE
        ↳ Active requests: 0→1
        ↳ showGlobalBusy() ❌ REABRE MODAL!
        ↳ Nova requisição para API (desnecessária!)

T+20s   ❌ SEGUNDO TIMEOUT
        ↳ Credentials timeout after 10s
        ↳ hideGlobalBusy: 1→0
```

**Evidência no Log:**
```
Linha 233: [Orchestrator] ⬇ hideGlobalBusy(energy) -> 1→0, total=0
Linha 234: [Orchestrator] ✅ Global busy hidden
           ↑ Dados carregados, modal escondida ✅

Linha 243: [Orchestrator] ⚠️ Credentials timeout - Credentials timeout after 10s
           ↑ Timeout da primeira requisição (esperado)

Linha 252: [Orchestrator] 📢 Active requests for energy: 1 (totalBefore=0)
Linha 253: [Orchestrator] ✅ Global busy shown (domain=energy)
           ↑ ❌ MODAL REABRE! Dados já estavam visíveis há 7.4 segundos!

Linha 266: [Orchestrator] ⚠️ Credentials timeout - Credentials timeout after 10s
           ↑ Segundo timeout (requisição desnecessária)
```

**Análise Técnica:**

1. **Cache Key Mismatch:** O código que verifica cache recente compara `periodKey` completa:
   ```javascript
   // Linha ~1406 MAIN_VIEW/controller.js
   if (recent && recent.periodKey === key && (Date.now() - recent.timestamp) < 30000) {
     // Retorna dados recentes
   }
   ```

   **Problema:**
   - `key` da requisição problemática: `null:energy:2025-10-01...`
   - `key` dos dados em cache: `20b93da0:energy:2025-10-01...`
   - **NÃO BATEM!** Comparação falha e faz nova requisição

2. **Mutex Release Incondicional:** O `finally` block sempre libera o mutex, mesmo quando há dados recentes válidos:
   ```javascript
   // Linha ~1440 MAIN_VIEW/controller.js
   finally {
     hideGlobalBusy(domain);
     sharedWidgetState.mutex = false; // ❌ Sempre libera
     delete sharedWidgetState.inFlight[key];
   }
   ```

---

### 🎯 Soluções Propostas

#### Solução 1: Comparar Período Ignorando customerTB_ID (RECOMENDADA)

**Objetivo:** Permitir que requisições com `null` customerTB_ID aproveitem cache de requisições com customerTB_ID correto.

**Implementação:**
```javascript
// MAIN_VIEW/controller.js - antes da linha ~1406

/**
 * RFC-0054: Extrai período da cache key, ignorando customerTB_ID
 * @param {string} cacheKey - Ex: 'null:energy:2025-10-01...:day' ou '20b93da0:energy:2025-10-01...:day'
 * @returns {string} Ex: 'energy:2025-10-01...:day'
 */
function extractPeriod(cacheKey) {
  if (!cacheKey) return '';
  const parts = cacheKey.split(':');
  return parts.slice(1).join(':'); // Remove primeiro segmento (customerTB_ID)
}

// Substituir verificação de cache (linha ~1405-1410):
try {
  const recent = OrchestratorState.cache[domain];

  if (recent && (Date.now() - recent.timestamp) < 30000) {
    const recentPeriod = extractPeriod(recent.periodKey);
    const currentPeriod = extractPeriod(key);

    if (recentPeriod === currentPeriod) {
      LogHelper.log(`[Orchestrator] ⏭️ No-busy refresh for ${domain} (recent data, period match)`);
      if (recent.periodKey !== key) {
        LogHelper.log(`[Orchestrator] 📝 Cache key mismatch ignored: ${key} vs ${recent.periodKey}`);
      }
      emitProvide(domain, recent.periodKey, recent.items);
      return recent.items; // ✅ Retorna dados recentes mesmo com customerTB_ID diferente
    }
  }
} catch (e) {
  LogHelper.warn(`[Orchestrator] ⚠️ Cache check failed:`, e);
}
```

**Critérios de Aceite:**
- Requisição com `null:energy:2025-10-01...` encontra cache `20b93da0:energy:2025-10-01...`
- Log mostra: "⏭️ No-busy refresh for energy (recent data, period match)"
- Log mostra: "📝 Cache key mismatch ignored: null:energy... vs 20b93da0:energy..."
- Retorna dados imediatamente sem fazer nova requisição

---

#### Solução 2: Mutex Condicional Baseado em Cache Recente

**Objetivo:** Não liberar mutex se há dados recentes válidos disponíveis.

**Implementação:**
```javascript
// MAIN_VIEW/controller.js - finally block (linha ~1440)

finally {
  LogHelper.log(`[Orchestrator] 🏁 Finally block - hiding busy for ${domain}`);
  hideGlobalBusy(domain);

  // RFC-0054: Verificar se há dados recentes antes de liberar mutex
  const hasRecentData = OrchestratorState.cache[domain] &&
                        (Date.now() - OrchestratorState.cache[domain].timestamp) < 30000;

  if (hasRecentData) {
    const recentPeriod = extractPeriod(OrchestratorState.cache[domain].periodKey);
    const currentPeriod = extractPeriod(key);

    if (recentPeriod === currentPeriod) {
      LogHelper.log(`[Orchestrator] ⏭️ Keeping mutex locked - recent data available for ${domain}`);
      LogHelper.log(`[Orchestrator] 📊 Cache: ${OrchestratorState.cache[domain].periodKey}, Request: ${key}`);
      // NÃO libera mutex - previne requisições duplicadas
    } else {
      sharedWidgetState.mutex = false;
      LogHelper.log(`[Orchestrator] 🔓 Mutex released - different period`);
    }
  } else {
    sharedWidgetState.mutex = false;
    LogHelper.log(`[Orchestrator] 🔓 Mutex released - no recent data`);
  }

  delete sharedWidgetState.inFlight[key];
  LogHelper.log(`[Orchestrator] 🧹 Cleaned up inFlight for ${key}`);
}
```

**Critérios de Aceite:**
- Após dados serem carregados, mutex NÃO é liberado para requisições do mesmo período
- Log mostra: "⏭️ Keeping mutex locked - recent data available"
- Requisições bloqueadas permanecem bloqueadas e eventualmente expiram silenciosamente
- Modal NÃO reabre após dados já visíveis

---

#### Solução 3: Cancelar Requisições Pendentes Após Sucesso

**Objetivo:** Ao carregar dados com sucesso, cancelar todas as requisições pendentes para o mesmo período.

**Implementação:**
```javascript
// MAIN_VIEW/controller.js - após emitProvide (linha ~1360)

// Após emitir dados com sucesso
emitProvide(domain, key, items);
LogHelper.log(`[Orchestrator] 📡 Emitted provide-data for ${domain} with ${items.length} items`);

// RFC-0054: Cancelar requisições pendentes para o mesmo período
const currentPeriod = extractPeriod(key);
let canceledCount = 0;

Object.keys(sharedWidgetState.inFlight).forEach(pendingKey => {
  if (pendingKey !== key) { // Não cancelar a própria requisição
    const pendingPeriod = extractPeriod(pendingKey);

    if (pendingPeriod === currentPeriod) {
      LogHelper.log(`[Orchestrator] ❌ Canceling redundant request: ${pendingKey}`);
      delete sharedWidgetState.inFlight[pendingKey];
      canceledCount++;
    }
  }
});

if (canceledCount > 0) {
  LogHelper.log(`[Orchestrator] 🧹 Canceled ${canceledCount} redundant requests for ${domain}`);
}
```

**Critérios de Aceite:**
- Após primeira requisição bem-sucedida, outras requisições para mesmo período são canceladas
- Log mostra: "❌ Canceling redundant request: null:energy:..."
- Log mostra: "🧹 Canceled X redundant requests for energy"
- Requisições canceladas não executam `fetchAndEnrich`

---

### 📊 Comparativo: Antes vs Depois das Soluções

**ANTES (Problema Atual):**
```
T+0s:   Req1 (null key) inicia → aguarda credentials
T+0.2s: Req2 (key correto) inicia → aguarda credentials
T+0.4s: Req3 (null key) → bloqueada por mutex
T+2.6s: Req2 sucesso → dados visíveis ✅
T+10s:  Req1 timeout → libera mutex
        Req3 desbloqueia → NOVA REQUISIÇÃO ❌
        Modal REABRE ❌
T+20s:  Req3 timeout
```

**DEPOIS (Com Soluções 1+2+3):**
```
T+0s:   Req1 (null key) inicia → aguarda credentials
T+0.2s: Req2 (key correto) inicia → aguarda credentials
T+0.4s: Req3 (null key) → bloqueada por mutex
T+2.6s: Req2 sucesso → dados visíveis ✅
        → Cancelamento automático de Req1 e Req3 ✅
        → Mutex mantido bloqueado ✅
T+10s:  Req1 timeout silencioso (já cancelada)
        Req3 permanece bloqueada (não executa) ✅
```

---

### 🔬 Plano de Testes para Novas Soluções

#### Teste 1: Cache Key Mismatch Resolvido
**Setup:**
1. Limpar cache
2. Abrir dashboard
3. Aguardar primeira requisição com `null` key dar timeout
4. Verificar se segunda requisição com key correto carrega dados

**Expectativa:**
- Terceira requisição (com `null` key) encontra cache da segunda
- Log: "⏭️ No-busy refresh for energy (recent data, period match)"
- Log: "📝 Cache key mismatch ignored: null:energy... vs 20b93da0:energy..."
- Dados retornados sem nova chamada à API

#### Teste 2: Mutex Não Liberado com Dados Recentes
**Setup:**
1. Carregar dados com sucesso
2. Forçar timeout de requisição antiga
3. Verificar logs

**Expectativa:**
- Log: "⏭️ Keeping mutex locked - recent data available for energy"
- Modal NÃO reabre
- Nenhuma nova requisição para API

#### Teste 3: Requisições Redundantes Canceladas
**Setup:**
1. Abrir console
2. Carregar dashboard
3. Observar logs após primeira requisição bem-sucedida

**Expectativa:**
- Log: "❌ Canceling redundant request: null:energy:..."
- Log: "🧹 Canceled X redundant requests for energy"
- Apenas uma requisição para API chega a `fetchAndEnrich`

---

### 📝 Checklist de Implementação

**Solução 1: Cache Key Comparison (P0 - CRÍTICO)**
- [x] Implementar função `extractPeriod(cacheKey)` - Linha 1357
- [x] Modificar verificação de cache recente (linha ~1415-1433)
- [x] Adicionar logs de debug para cache key mismatch
- [ ] Testar com requisições `null` e `20b93da0` keys

**Solução 2: Mutex Condicional (P0 - CRÍTICO)**
- [x] Modificar `finally` block em `fetchAndEnrich` - Linha 1470-1489
- [x] Adicionar verificação de cache recente antes de liberar mutex
- [x] Adicionar logs para decisão de mutex
- [ ] Testar que mutex permanece bloqueado quando apropriado

**Solução 3: Cancelamento de Requisições (P1 - ALTA)**
- [x] Implementar loop de cancelamento após `emitProvide` - Linha 1456-1474
- [x] Adicionar contador de requisições canceladas
- [x] Implementar `inFlight.delete()` para requisições redundantes
- [ ] Testar que `inFlight` é limpo corretamente

**Validação Geral:**
- [ ] Executar script clean-log em novo teste
- [ ] Verificar log: "⏭️ No-busy refresh for energy (recent data, period match)"
- [ ] Verificar log: "📝 Cache key mismatch ignored: null:energy... vs 20b93da0:energy..."
- [ ] Verificar log: "⏭️ Keeping mutex locked - recent data available"
- [ ] Verificar log: "❌ Canceling redundant request: null:energy..."
- [ ] Verificar log: "🧹 Canceled X redundant requests for energy"
- [ ] Verificar ausência de "📢 Active requests" após dados carregados
- [ ] Verificar ausência de "✅ Global busy shown" após modal escondida
- [ ] Verificar apenas UMA chamada à API por período

---

### 🎯 Impacto Esperado

**Performance:**
- ✅ Redução de ~66% em requisições à API (2-3 requests → 1 request)
- ✅ Eliminação de 10-20s de timeouts desnecessários
- ✅ Menor carga no servidor de API

**UX:**
- ✅ Modal NÃO reabre após dados visíveis
- ✅ Experiência mais fluida e previsível
- ✅ Menos "flicker" de loading

**Logs:**
- ✅ Menos erros de timeout nos logs
- ✅ Logs mais limpos e interpretáveis
- ✅ Melhor rastreabilidade de requisições

---

**Status Final RFC-0054:**
- ✅ P0: Contador de Requisições - IMPLEMENTADO
- ⚠️ P0: Mutex Release/Cache Key - SOLUÇÃO PROPOSTA (3 fixes)
- ❌ P1: Dual Cache Key - PENDENTE (waitForCredentials)
- ❌ P2: Múltiplas Instâncias - PENDENTE (investigação)
