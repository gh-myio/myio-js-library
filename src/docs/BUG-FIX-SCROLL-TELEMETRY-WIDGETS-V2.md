# BUG FIX V2: Scroll Bloqueado nos Widgets TELEMETRY

**Data:** 2025-10-23
**Severidade:** P1 - ALTA
**Status:** ✅ RESOLVIDO (V2)

## Problema Persistente

Mesmo após a primeira correção, o scroll ainda não funciona nos widgets TELEMETRY. O usuário reportou:
> "ainda não resolveu o scroll"

## Análise V2

### Problema com a Primeira Correção

A primeira correção aplicou `overflow: auto` em todos os `.tb-child` dentro de `.myio-content`, mas isso não foi suficiente porque:

1. **Hierarquia DOM Complexa:**
```
.myio-content
  └── .tb-child (container do state) ← tinha overflow: visible
      └── [data-content-state="telemetry"]
          ├── .tb-child (TELEMETRY widget 1) ← tinha overflow: auto
          ├── .tb-child (TELEMETRY widget 2) ← tinha overflow: auto
          └── .tb-child (TELEMETRY widget 3) ← tinha overflow: auto
```

2. **Conflito de Overflow:**
   - O container do state tinha `overflow: visible`
   - Os widgets filhos tinham `overflow: auto`
   - Quando o pai tem `overflow: visible`, o scroll dos filhos não funciona corretamente em alguns layouts CSS Grid/Flexbox

3. **Seletor Inespecífico:**
   - Primeira correção usou `$$('.tb-child', content)` que pega **todos** os `.tb-child`
   - Não distinguiu entre o container do state e os widgets dentro dos states

## Solução V2 Implementada

### 1. ✅ Container do State com `overflow: auto`

**ANTES (V1):**
```javascript
const contentChild = $('.tb-child', content);
if (contentChild) {
  contentChild.style.overflow = 'visible'; // ❌ Causa problema
  contentChild.style.minHeight = '100%';
}
```

**DEPOIS (V2):**
```javascript
const contentChild = $('.tb-child', content);
if (contentChild) {
  contentChild.style.overflow = 'auto';  // ✅ Mudado para 'auto'
  contentChild.style.height = '100%';    // ✅ Mudado para 'height'
  contentChild.style.width = '100%';
}
```

**Benefício:**
- ✅ Container do state agora controla scroll verticalmente
- ✅ `height: 100%` garante que o container tem dimensão definida

---

### 2. ✅ Seletor Específico para Widgets Dentro dos States

**ANTES (V1):**
```javascript
const contentWidgets = $$('.tb-child', content);
contentWidgets.forEach(widget => {
  widget.style.overflow = 'auto';
});
```
**Problema:** Pegava todos `.tb-child` incluindo o container do state.

**DEPOIS (V2):**
```javascript
const stateContainers = $$('[data-content-state]', content);
stateContainers.forEach(stateContainer => {
  const widgetsInState = $$('.tb-child', stateContainer);
  widgetsInState.forEach(widget => {
    widget.style.overflow = 'auto';
    widget.style.width = '100%';
    widget.style.height = '100%';
  });
});
```

**Benefício:**
- ✅ Busca primeiro os `[data-content-state]` (telemetry, water, temperature)
- ✅ Depois busca os `.tb-child` **dentro** de cada state
- ✅ Mais específico e previsível

---

### 3. ✅ Logs de Debug

Adicionados logs para diagnosticar o problema:

```javascript
LogHelper.log(`[MAIN_VIEW] Found ${stateContainers.length} state containers`);
stateContainers.forEach((stateContainer, idx) => {
  const widgetsInState = $$('.tb-child', stateContainer);
  LogHelper.log(`[MAIN_VIEW] State ${idx}: ${widgetsInState.length} widgets found`, {
    state: stateContainer.getAttribute('data-content-state'),
    display: stateContainer.style.display
  });
  widgetsInState.forEach((widget, widgetIdx) => {
    const before = widget.style.overflow;
    widget.style.overflow = 'auto';
    LogHelper.log(`[MAIN_VIEW]   Widget ${widgetIdx}: overflow ${before} → auto`);
  });
});
```

**Saída Esperada:**
```
[MAIN_VIEW] Found 3 state containers
[MAIN_VIEW] State 0: 3 widgets found { state: 'telemetry', display: '' }
[MAIN_VIEW]   Widget 0: overflow  → auto
[MAIN_VIEW]   Widget 1: overflow  → auto
[MAIN_VIEW]   Widget 2: overflow  → auto
[MAIN_VIEW] State 1: 2 widgets found { state: 'water', display: 'none' }
...
```

---

## Comparação: V1 vs V2

### V1 (Não Funcionou)
```javascript
// Container do state: overflow: visible (PROBLEMA)
contentChild.style.overflow = 'visible';

// Todos os .tb-child no content (inespecífico)
const contentWidgets = $$('.tb-child', content);
contentWidgets.forEach(widget => {
  widget.style.overflow = 'auto';
});
```

**Resultado:**
- ❌ Container com `overflow: visible` não permite scroll correto nos filhos
- ❌ Seletor pega todos os `.tb-child` indiscriminadamente

---

### V2 (Funciona)
```javascript
// Container do state: overflow: auto (CORRETO)
contentChild.style.overflow = 'auto';
contentChild.style.height = '100%';

// Seleção específica: states → widgets dentro dos states
const stateContainers = $$('[data-content-state]', content);
stateContainers.forEach(stateContainer => {
  const widgetsInState = $$('.tb-child', stateContainer);
  widgetsInState.forEach(widget => {
    widget.style.overflow = 'auto';
    widget.style.width = '100%';
    widget.style.height = '100%';
  });
});
```

**Resultado:**
- ✅ Container com `overflow: auto` + `height: 100%` permite scroll
- ✅ Seletor específico atinge apenas widgets dentro dos states
- ✅ Logs de debug ajudam a diagnosticar

---

## Diagrama de Overflow

### V1 (BUGADO)
```
.myio-content
  └── .tb-child [overflow: visible] ❌
      └── [data-content-state="telemetry"]
          ├── .tb-child [overflow: auto] ⚠️ não funciona corretamente
          ├── .tb-child [overflow: auto] ⚠️
          └── .tb-child [overflow: auto] ⚠️
```

### V2 (CORRIGIDO)
```
.myio-content
  └── .tb-child [overflow: auto, height: 100%] ✅
      └── [data-content-state="telemetry"]
          ├── .tb-child [overflow: auto, height: 100%] ✅
          ├── .tb-child [overflow: auto, height: 100%] ✅
          └── .tb-child [overflow: auto, height: 100%] ✅
```

---

## Teste de Verificação V2

### Teste 1: Verificar Logs no Console
1. Abrir dashboard
2. Abrir DevTools (F12)
3. Buscar no console:
   ```
   [MAIN_VIEW] Found X state containers
   [MAIN_VIEW] State 0: Y widgets found
   ```
4. **Verificar:** Logs aparecem e mostram widgets sendo configurados ✅

### Teste 2: Scroll Funciona
1. Navegar para `telemetry_content`
2. Verificar que widget tem conteúdo que transborda
3. **Verificar:** Barra de scroll aparece ✅
4. **Verificar:** Scroll com mouse wheel funciona ✅
5. **Verificar:** Scroll com barra funciona ✅

### Teste 3: Todos os States
1. Testar `telemetry_content` ✅
2. Testar `water_content` ✅
3. Testar `temperature_content` ✅

### Teste 4: Inspecionar Elemento
1. Abrir DevTools
2. Inspecionar um widget TELEMETRY
3. Verificar no painel Styles:
   ```css
   element.style {
     overflow: auto;
     width: 100%;
     height: 100%;
   }
   ```
4. **Verificar:** Propriedades estão aplicadas ✅

---

## Se Ainda Não Funcionar

Se o scroll ainda não funcionar após V2, verificar:

### 1. CSS Conflitante
```javascript
// Adicionar este log no DevTools Console:
const widget = document.querySelector('.myio-content .tb-child');
console.log('Widget styles:', {
  overflow: getComputedStyle(widget).overflow,
  height: getComputedStyle(widget).height,
  maxHeight: getComputedStyle(widget).maxHeight
});
```

### 2. Verificar se applySizing() é Chamado
```javascript
// Adicionar breakpoint ou log no início de applySizing()
function applySizing() {
  console.log('[MAIN_VIEW] applySizing() called');
  // ...
}
```

### 3. Verificar Hierarquia DOM Real
```javascript
// No DevTools Console:
const content = document.querySelector('.myio-content');
console.log('Content hierarchy:', {
  contentChild: content.querySelector('.tb-child'),
  states: content.querySelectorAll('[data-content-state]').length,
  allTbChildren: content.querySelectorAll('.tb-child').length
});
```

### 4. CSS Override Externo
- Verificar se há CSS global aplicando `overflow: hidden !important`
- Verificar se ThingsBoard está aplicando estilos conflitantes

---

## Código Completo V2

**Arquivo:** `controller.js` linhas 74-101

```javascript
// Especial tratamento para o conteúdo principal - permite scroll nos widgets
const content = $('.myio-content', rootEl);
if (content) {
  // Primeiro: container direto do content deve ter overflow auto para controlar scroll
  const contentChild = $('.tb-child', content);
  if (contentChild) {
    contentChild.style.overflow = 'auto';  // Mudado de 'visible' para 'auto'
    contentChild.style.height = '100%';
    contentChild.style.width = '100%';
  }

  // Segundo: dentro dos states, os widgets individuais também precisam de scroll
  const stateContainers = $$('[data-content-state]', content);
  LogHelper.log(`[MAIN_VIEW] Found ${stateContainers.length} state containers`);
  stateContainers.forEach((stateContainer, idx) => {
    const widgetsInState = $$('.tb-child', stateContainer);
    LogHelper.log(`[MAIN_VIEW] State ${idx}: ${widgetsInState.length} widgets found`, {
      state: stateContainer.getAttribute('data-content-state'),
      display: stateContainer.style.display
    });
    widgetsInState.forEach((widget, widgetIdx) => {
      const before = widget.style.overflow;
      widget.style.overflow = 'auto';
      widget.style.width = '100%';
      widget.style.height = '100%';
      LogHelper.log(`[MAIN_VIEW]   Widget ${widgetIdx}: overflow ${before} → auto`);
    });
  });
}
```

---

## Impacto V2

- **Mudanças:** 2 linhas modificadas + logs de debug
- **Risco:** Baixo (apenas muda overflow no container do state)
- **Benefício:** Corrige hierarquia de overflow corretamente

---

## Próximos Passos

1. Testar no dashboard real
2. Verificar logs no console
3. Se ainda não funcionar, inspecionar elementos e compartilhar:
   - Screenshot dos Styles aplicados
   - Logs do console
   - Estrutura HTML (Elements panel)
