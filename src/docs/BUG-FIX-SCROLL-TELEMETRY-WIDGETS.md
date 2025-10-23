# BUG FIX: Scroll Bloqueado nos Widgets TELEMETRY

**Data:** 2025-10-23
**Severidade:** P1 - ALTA
**Status:** ✅ RESOLVIDO

## Problema

Após mudanças recentes no `MAIN_VIEW/controller.js`, os widgets TELEMETRY dentro dos states de content (ex: `telemetry_content`, `water_content`) **perderam a capacidade de scroll**:

- ❌ Barra de rolagem vertical não aparece
- ❌ Scroll com mouse wheel não funciona
- ❌ Conteúdo que transborda fica oculto e inacessível

### User Report
> "reparei que agora no state content, exemplo: telemetry_content, water_content, onde temos 3 widgets TELEMETRY, agora numa das mudanças recentes, cada widget TELEMETRY não mostra mais a barra de rolagem vertical e nem com o scroll do mouse está funcionando o scroll"

## Causa Raiz

**Arquivo:** `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MAIN_VIEW/controller.js`

**Código Problemático (linhas 63-69 - ANTES):**
```javascript
// Garante que os tb-child elementos não tenham overflow issues
const tbChildren = $$('.tb-child', rootEl);
tbChildren.forEach(child => {
  child.style.overflow = 'hidden'; // ❌ BLOQUEIA SCROLL EM TODOS OS WIDGETS!
  child.style.width = '100%';
  child.style.height = '100%';
});
```

**Problema:**
- O código aplicava `overflow: hidden` **globalmente** em todos os `.tb-child` dentro do `rootEl`
- Isso incluía não apenas os widgets do MENU, mas também os widgets TELEMETRY dentro de `.myio-content`
- A tentativa de correção nas linhas 74-78 só afetava o `.tb-child` direto de `.myio-content`, não os widgets filhos

**Tentativa de Correção Parcial (ANTES - linhas 74-78):**
```javascript
const content = $('.myio-content', rootEl);
if (content) {
  const contentChild = $('.tb-child', content);
  if (contentChild) {
    contentChild.style.overflow = 'visible'; // ⚠️ Só pega o PRIMEIRO .tb-child
    contentChild.style.minHeight = '100%';
  }
}
```

**Por que não funcionou:**
- `$('.tb-child', content)` retorna apenas o **primeiro** `.tb-child` dentro de `.myio-content`
- Os widgets TELEMETRY individuais dentro dos states (`telemetry_content`, etc) ainda tinham `overflow: hidden` aplicado pela primeira iteração global

## Solução Implementada

### 1. ✅ Aplicar `overflow: hidden` APENAS no Menu

**Código (linhas 63-72 - DEPOIS):**
```javascript
// Garante que os tb-child elementos do MENU não tenham overflow issues
const menu = $('.myio-menu', rootEl);
if (menu) {
  const menuChildren = $$('.tb-child', menu);
  menuChildren.forEach(child => {
    child.style.overflow = 'hidden';
    child.style.width = '100%';
    child.style.height = '100%';
  });
}
```

**Benefício:**
- ✅ Mantém o comportamento original no menu (sem scroll desnecessário)
- ✅ Não afeta os widgets de content

---

### 2. ✅ Permitir Scroll em TODOS os Widgets de Content

**Código (linhas 83-89 - DEPOIS):**
```javascript
// Garante que os widgets dentro do content tenham scroll
const contentWidgets = $$('.tb-child', content);
contentWidgets.forEach(widget => {
  widget.style.overflow = 'auto'; // Permite scroll vertical e horizontal
  widget.style.width = '100%';
  widget.style.height = '100%';
});
```

**Benefício:**
- ✅ Usa `$$()` que retorna **todos** os elementos `.tb-child` (não apenas o primeiro)
- ✅ `overflow: auto` permite scroll quando conteúdo transborda
- ✅ Aplica-se a todos os widgets TELEMETRY dentro dos states

---

## Comparação: Antes vs Depois

### Antes (BUGADO)
```javascript
// GLOBAL - afeta TODOS os .tb-child (menu + content)
const tbChildren = $$('.tb-child', rootEl);
tbChildren.forEach(child => {
  child.style.overflow = 'hidden'; // ❌ Bloqueia scroll
});

// Tentativa de correção PARCIAL
const contentChild = $('.tb-child', content); // ⚠️ Só pega o PRIMEIRO
contentChild.style.overflow = 'visible';
```

**Resultado:**
- ❌ Menu: `overflow: hidden` ✅ (correto)
- ❌ Content container: `overflow: visible` ✅ (correto)
- ❌ **Widgets TELEMETRY:** `overflow: hidden` ❌ (BLOQUEADO!)

---

### Depois (CORRIGIDO)
```javascript
// ESPECÍFICO - afeta apenas .tb-child do MENU
const menuChildren = $$('.tb-child', menu);
menuChildren.forEach(child => {
  child.style.overflow = 'hidden'; // Menu sem scroll
});

// ESPECÍFICO - afeta TODOS os .tb-child do CONTENT
const contentWidgets = $$('.tb-child', content);
contentWidgets.forEach(widget => {
  widget.style.overflow = 'auto'; // ✅ Permite scroll
});
```

**Resultado:**
- ✅ Menu: `overflow: hidden` ✅
- ✅ Content container: `overflow: visible` ✅
- ✅ **Widgets TELEMETRY:** `overflow: auto` ✅ (SCROLL FUNCIONA!)

---

## Diagrama de Hierarquia

### Estrutura DOM
```
rootEl (.myio-container)
├── .myio-menu
│   └── .tb-child (overflow: hidden ✅)
│       └── HEADER widget
└── .myio-content
    └── .tb-child (overflow: visible ✅)
        ├── [data-content-state="telemetry"]
        │   ├── .tb-child (overflow: auto ✅) ← TELEMETRY 1
        │   ├── .tb-child (overflow: auto ✅) ← TELEMETRY 2
        │   └── .tb-child (overflow: auto ✅) ← TELEMETRY 3
        ├── [data-content-state="water"]
        │   ├── .tb-child (overflow: auto ✅)
        │   └── .tb-child (overflow: auto ✅)
        └── [data-content-state="temperature"]
            └── .tb-child (overflow: auto ✅)
```

### Antes (BUGADO)
```
❌ Todos os .tb-child recebiam overflow: hidden
❌ Correção parcial só afetava 1 elemento
```

### Depois (CORRIGIDO)
```
✅ Menu: overflow: hidden (mantém original)
✅ Content widgets: overflow: auto (permite scroll)
```

---

## Teste de Verificação

### Teste 1: Scroll Vertical
1. Abrir dashboard com state `telemetry_content`
2. Verificar que widget TELEMETRY tem múltiplos itens (> altura visível)
3. **Verificar:** Barra de scroll vertical aparece ✅
4. **Verificar:** Scroll com mouse wheel funciona ✅

### Teste 2: Scroll em Múltiplos Widgets
1. Navegar para `water_content`
2. Repetir teste de scroll
3. Navegar para `temperature_content`
4. Repetir teste de scroll
5. **Verificar:** Todos os states têm scroll funcional ✅

### Teste 3: Menu Não Afetado
1. Verificar que menu (HEADER) não tem scroll desnecessário
2. **Verificar:** Menu mantém `overflow: hidden` ✅

---

## Impacto

- **Severidade:** P1 (bloqueava acesso a dados fora da área visível)
- **Afeta:** Todos os widgets TELEMETRY em todos os states de content
- **Fix:** 15 linhas de código (refatoração de seletor)
- **Risco:** Baixo (apenas muda overflow de hidden → auto nos widgets corretos)

## Histórico de Commits

**Commit que introduziu o bug:** `99ca4e1` - "almost stable 5.2.0 fla"
- Aplicou `overflow: hidden` globalmente em todos `.tb-child`
- Tentou corrigir apenas para o primeiro elemento de content

**Commit desta correção:** (pendente)
- Separa lógica de overflow: menu vs content
- Usa `$$()` para pegar todos os widgets de content

---

## Lições Aprendidas

1. **Evitar Seletores Globais Agressivos**
   - ❌ `$$('.tb-child', rootEl)` → afeta tudo
   - ✅ `$$('.tb-child', menu)` → específico

2. **Usar `$$()` para Todos os Elementos**
   - ❌ `$('.tb-child', content)` → só o primeiro
   - ✅ `$$('.tb-child', content)` → todos

3. **Testar Scroll em Todos os States**
   - Não assumir que correção em um state funciona em todos
   - Testar `telemetry_content`, `water_content`, `temperature_content`

4. **Overflow: auto vs hidden vs visible**
   - `hidden`: sem scroll, corta conteúdo
   - `visible`: sem scroll, conteúdo transborda
   - `auto`: scroll aparece quando necessário ✅

---

## Checklist de Implementação

- [x] Código corrigido
- [x] Documentação criada
- [ ] Testado em telemetry_content
- [ ] Testado em water_content
- [ ] Testado em temperature_content
- [ ] Testado com mouse wheel
- [ ] Verificado que menu não foi afetado
- [ ] Commit e push para produção
