em
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MAIN_VIEW\controller.js
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\TELEMETRY\controller.js
src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\MENU

temos que incrementar a robustez e resilëncia

o caso é

entrei no dashboard e ok, tudo carregou ok

mas eventualmente eu clico no menu em água, carrega outro widget telemetry domain water tudo em branco

s[o funciona se eu clico em carregr no
]src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET\HEADER

isso jamais pode acontecer, analogamente se eu clicar em temperature ou voltar para energy

☐ Analyze MAIN_VIEW controller for domain switch handling
☐ Analyze TELEMETRY controller for data loading issues
☐ Identify root cause of blank telemetry on domain switch
☐ Implement fix for resilient domain switching

---

## 🔍 Análise Completa - Root Cause Identificado

Identifiquei a **causa raiz** do problema onde o widget TELEMETRY fica em branco ao trocar de domínio:

### 📋 O Problema

**Fluxo Normal (que falha):**

1. ✅ Dashboard carrega OK com domain `energy`
2. 👆 Usuário clica em "Água" no MENU
3. 📡 MENU emite `myio:dashboard-state` com `tab: 'water'`
4. 🔄 MAIN_VIEW escuta e chama `hydrateDomain('water', currentPeriod)`
5. 📤 MAIN_VIEW emite `myio:telemetry:provide-data` para domain `water`
6. ❌ **PROBLEMA:** Widget TELEMETRY de Água ainda está com `WIDGET_DOMAIN = 'energy'` (configurado no onInit)
7. 🚫 TELEMETRY **ignora** o evento porque `domain !== WIDGET_DOMAIN`
8. 🖥️ Tela fica em branco!

**Por que funciona ao clicar "Carregar" no HEADER?**

- O botão força um `myio:update-date`
- Neste momento, o ThingsBoard já renderizou o widget correto de Água
- O widget agora tem `WIDGET_DOMAIN = 'water'` (do settings)
- Ele processa o evento corretamente ✅

### 🎯 Root Cause

**Race Condition entre navegação de states e propagação de dados:**

O TELEMETRY widget tem uma validação rígida no `dataProvideHandler`:

```javascript
if (domain !== WIDGET_DOMAIN) {
  LogHelper.log(`Ignoring event for domain ${domain}, my domain is ${WIDGET_DOMAIN}`);
  return;
}
```

Esta validação assume que o `WIDGET_DOMAIN` é estático (definido no onInit). Mas quando o usuário troca de aba:

1. O MAIN_VIEW já emite dados para o novo domínio
2. O widget antigo ainda está no DOM (ou o novo ainda está inicializando)
3. Os dados são perdidos

---

## 🛠️ Plano de Solução - Incrementando Robustez e Resiliência

Proponho uma abordagem **multi-camadas** para garantir que jamais aconteça novamente:

### ✅ **Camada 1: Cache Persist no Orchestrator (MAIN_VIEW)**

**Melhorias no MAIN_VIEW:**

1. **Criar cache persistente de dados por domínio** que sobrevive a trocas de tab
2. **Timestamp de última emissão** para evitar emitir dados stale
3. **Re-emitir dados quando widget registrar** interesse tardio

**Código:**

```javascript
// No MAIN_VIEW, após emitProvide()
window.MyIOOrchestratorData = window.MyIOOrchestratorData || {};
window.MyIOOrchestratorData[domain] = {
  periodKey: pKey,
  items: items,
  timestamp: Date.now(),
  version: (window.MyIOOrchestratorData[domain]?.version || 0) + 1,
};
```

### ✅ **Camada 2: Late-Joining Widget Support (TELEMETRY)**

**Melhorias no TELEMETRY:**

1. **Ao inicializar, verificar se já existem dados no cache do orchestrator**
2. **Registrar interesse ativo** no domínio (event listener pattern)
3. **Processar dados pendentes** imediatamente se disponíveis

**Código:**

```javascript
// No onInit do TELEMETRY, após configurar WIDGET_DOMAIN:
setTimeout(() => {
  const cachedData = window.MyIOOrchestratorData?.[WIDGET_DOMAIN];

  if (cachedData && cachedData.items && cachedData.items.length > 0) {
    const age = Date.now() - cachedData.timestamp;

    if (age < 30000) {
      // Dados fresco < 30s
      LogHelper.log(`[TELEMETRY] Found cached data for ${WIDGET_DOMAIN}, processing...`);
      dataProvideHandler({ detail: cachedData });
      return;
    }
  }

  // Se não tem dados, pedir ao orchestrator
  requestDataFromOrchestrator();
}, 500);
```

### ✅ **Camada 3: Validação de Customer ID (Anti-Stale)**

**Prevenir que dados de outro shopping sejam exibidos:**

```javascript
// No periodKey, incluir customerTB_ID
function periodKey(domain, period) {
  const customerTbId = window.MyIOOrchestrator?.customerTB_ID || 'default';
  return `${customerTbId}:${domain}:${period.startISO}:${period.endISO}`;
}

// No TELEMETRY, validar antes de processar
const currentCustomerId = window.MyIOUtils?.customerTB_ID;
const cachedCustomerId = periodKey.split(':')[0];

if (currentCustomerId && cachedCustomerId !== currentCustomerId) {
  LogHelper.warn('Customer mismatch - clearing stale cache');
  delete window.MyIOOrchestratorData[domain];
}
```

### ✅ **Camada 4: Mutex e Debounce (Anti-Duplicate)**

**Evitar múltiplas chamadas simultâneas:**

```javascript
// No MAIN_VIEW, adicionar mutex por domínio
const domainMutex = new Map();

async function hydrateDomain(domain, period) {
  if (domainMutex.get(domain)) {
    LogHelper.log(`Already hydrating ${domain}, skipping...`);
    return;
  }

  domainMutex.set(domain, true);
  try {
    // ... fetch logic
  } finally {
    domainMutex.set(domain, false);
  }
}
```

### ✅ **Camada 5: Timeout Fallback (Último Recurso)**

**Se dados não chegarem em 5s, tentar novamente:**

```javascript
// No TELEMETRY, após showBusy()
busyTimeoutId = setTimeout(() => {
  if (!STATE.itemsBase || STATE.itemsBase.length === 0) {
    LogHelper.warn('[TELEMETRY] Timeout waiting for data, requesting again...');
    requestDataFromOrchestrator();
  }
}, 5000);
```

---

## 📝 Resumo das Alterações

| Arquivo | Alterações | Objetivo | |---------|-----------|----------| | **MAIN_VIEW** | Cache persistente `MyIOOrchestratorData` | Dados sobrevivem a troca de tab | | **MAIN_VIEW** | Mutex por domínio | Evitar duplicate hydration | | **MAIN_VIEW** | CustomerID no periodKey | Validar dados do shopping correto | | **TELEMETRY** | Check cache ao inicializar | Processar dados pendentes | | **TELEMETRY** | Timeout fallback | Re-request se não chegar dados | | **TELEMETRY** | Validação de customerID | Prevenir stale data |

---

## ✅ Benefícios

1. **🎯 Elimina race condition** - Dados sempre disponíveis no cache
2. **🔒 Previne stale data** - Validação de customerID
3. **♻️ Evita duplicate requests** - Mutex e debounce
4. **⏱️ Timeout resiliente** - Fallback automático
5. **🚀 Performance** - Cache reduz chamadas API

---

Gostaria que eu prossiga com a implementação? Posso detalhar cada alteração ou começar a aplicar as mudanças.

---

Implementei uma solução completa para aumentar a robustez e resiliência na troca de domínios (Energia, Água, Temperatura), eliminando o problema de widgets ficarem em branco ao navegar pelo menu.

### Principais Melhorias Implementadas:

#### 1. Orchestrator (MAIN_VIEW) - Resiliência Proativa

- **Late-Joiner Delivery**: O Orchestrator agora detecta quando um widget se registra (mesmo que tardiamente durante a carga da página) e envia imediatamente os últimos dados válidos do cache para aquele domínio.
- **Resposta Instantânea na Troca de Aba**: Ao trocar de aba no menu, se houver dados frescos (< 2 min) no cache, eles são emitidos para a UI **antes** mesmo de iniciar a nova busca na rede. Isso elimina o "estado em branco" visual.

#### 2. Widget TELEMETRY - Inicialização Robusta

- **Registro Ativo**: O widget agora se anuncia formalmente para o Orchestrator ao inicializar.
- **Observador de Visibilidade**: Adicionado listener para `myio:dashboard-state`. Se a aba do widget se torna ativa e ele percebe que está sem dados, ele solicita uma atualização proativa.
- **Check de Cache Imediato**: O widget agora verifica o cache global no exato momento do `onInit`, capturando dados que possam ter chegado milissegundos antes dele estar pronto.
- **Mecanismo de Timeout (Retry)**: Implementado um fallback de segurança de 8 segundos. Se o widget estiver em estado de "carregando" mas nenhum dado chegar, ele dispara automaticamente uma nova solicitação.

#### 3. Proteção Contra Dados Obsoletos (Anti-Stale)

- Reforcei a validação do `customerTB_ID` em todas as camadas de cache. Isso garante que, ao navegar entre shoppings diferentes, os dados de um nunca vazem para o outro, invalidando o cache agressivamente quando necessário.

Com estas mudanças, o fluxo de dados tornou-se independente da ordem exata de carregamento dos componentes do ThingsBoard, garantindo que a informação flua corretamente assim que o widget estiver visível.
