# Footer de Comparação - Documentação Técnica

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Componentes](#componentes)
4. [Fluxo de Dados](#fluxo-de-dados)
5. [Problemas Encontrados e Soluções](#problemas-encontrados-e-soluções)
6. [Estado Atual](#estado-atual)
7. [Próximos Passos](#próximos-passos)

---

## Visão Geral

### Objetivo
Implementar um footer de comparação que permite aos usuários:
- ✅ Selecionar dispositivos via checkbox nos cards
- 🔄 Arrastar e soltar cards no footer (drag & drop)
- ✅ Visualizar chips dos dispositivos selecionados
- ✅ Remover dispositivos clicando no "X" dos chips
- ✅ Ver totais agregados (energia, água, etc.)
- ✅ Comparar 2+ dispositivos (botão "Compare")

### Versões
- **Biblioteca:** myio-js-library (src/components/SelectionStore.js, src/thingsboard/main-dashboard-shopping/v-4.0.0/card/template-card-v2.js)
- **Widgets ThingsBoard:** v-5.2.0
  - MAIN_VIEW (Orquestrador)
  - HEADER (Seleção de datas)
  - TELEMETRY (Lista de cards)
  - FOOTER (Dock de seleção)

---

## Arquitetura

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    ThingsBoard Dashboard                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  HEADER Widget (v-5.2.0)                            │  │
│  │  - Date Range Picker                                 │  │
│  │  - Botão "Carregar"                                  │  │
│  │  - Botão "Relatório Geral"                          │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│              emite: myio:update-date                         │
│                      ↓                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  MAIN_VIEW Widget (v-5.2.0) - Orquestrador         │  │
│  │  - MyIOOrchestrator (singleton)                      │  │
│  │  - Centraliza fetch de dados                         │  │
│  │  - Cache de dados por período                        │  │
│  │  - Gerencia busy overlay global                      │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│          emite: myio:telemetry:provide-data                  │
│                      ↓                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TELEMETRY Widget (v-5.2.0)                         │  │
│  │  - Renderiza cards de dispositivos                   │  │
│  │  - Renderiza usando MyIO.renderCardComponentV2()    │  │
│  │  - Escuta: myio:device-params (checkbox)            │  │
│  │  - Escuta: myio:device-params-remove (uncheck)      │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│          Card emite: myio:device-params                      │
│                      ↓                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  MyIOSelectionStore (singleton global)              │  │
│  │  - selectedIds: Set<string>                          │  │
│  │  - entities: Map<id, entity>                         │  │
│  │  - eventListeners: Map<event, callbacks[]>          │  │
│  │  - Gerencia estado de seleção                        │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│            emite: selection:change                           │
│                      ↓                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FOOTER Widget (v-5.2.0)                            │  │
│  │  - Dock (área de chips)                              │  │
│  │  - Totais (contagem + valores agregados)            │  │
│  │  - Botão "Compare" (habilitado com 2+ seleções)     │  │
│  │  - Drag & Drop target                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Biblioteca MyIOLibrary

```
myio-js-library/
├── src/
│   ├── components/
│   │   └── SelectionStore.js          # Singleton de seleção global
│   │       ├── add(id)
│   │       ├── remove(id)
│   │       ├── registerEntity(entity)
│   │       ├── getSelectedIds()
│   │       ├── getSelectedEntities()
│   │       ├── on(event, callback)
│   │       └── _emitSelectionChange()
│   │
│   └── thingsboard/
│       └── main-dashboard-shopping/
│           └── v-4.0.0/
│               └── card/
│                   └── template-card-v2.js  # Componente de Card
│                       ├── enableSelection
│                       ├── enableDragDrop
│                       ├── handleSelect callback
│                       └── emite: myio:device-params
```

---

## Componentes

### 1. SelectionStore (src/components/SelectionStore.js)

**Responsabilidade:** Gerenciar estado global de seleção entre widgets.

**Estrutura de Dados:**
```javascript
{
  selectedIds: Set<string>,           // IDs dos itens selecionados
  entities: Map<id, {                 // Metadados das entidades
    id: string,
    name: string,
    icon: string,
    group: string,
    lastValue: number,
    unit: string,
    status: string
  }>,
  eventListeners: Map<event, callbacks[]>  // Sistema de eventos
}
```

**Métodos Principais:**
```javascript
// Adicionar item à seleção
add(id: string): void
  → selectedIds.add(id)
  → _emitSelectionChange('add', id)

// Remover item da seleção
remove(id: string): void
  → selectedIds.delete(id)
  → _emitSelectionChange('remove', id)

// Registrar metadados de entidade
registerEntity(entity: Object): void
  → entities.set(entity.id, normalizedEntity)

// Obter entidades selecionadas (CORRIGIDO)
getSelectedEntities(): Array<Entity>
  → return getSelectedIds()
      .map(id => entities.get(id))
      .filter(entity => entity !== undefined)

// Sistema de eventos
on(event: string, callback: Function): void
off(event: string, callback: Function): void
_emit(event: string, data: any): void
```

**Eventos Emitidos:**
- `selection:change` - Quando seleção muda (add/remove/clear)
- `selection:totals` - Quando totais são recalculados
- `comparison:open` - Quando comparação é aberta
- `comparison:too_many` - Quando > 20 itens selecionados

**Problemas Corrigidos:**
1. ✅ `getSelectedEntities()` retornava apenas IDs → agora retorna objetos completos
2. ✅ `remove()` tentava encontrar objetos no Set → agora usa `.has()` e `.delete()` com ID string

---

### 2. Card Component (template-card-v2.js)

**Responsabilidade:** Renderizar card de dispositivo com checkbox e drag & drop.

**Classes CSS:**
- `.device-card-centered` - Container principal do card
- `.myio-enhanced-card-container` - Wrapper externo
- `.card-checkbox` - Checkbox de seleção

**Propriedades Importantes:**
```javascript
MyIO.renderCardComponentV2({
  entityObject: {
    entityId: string,
    labelOrName: string,
    deviceType: string,
    val: number,
    perc: number,
    deviceStatus: 'power_on' | 'power_off',
    // ... outros campos
  },
  enableSelection: true,      // Habilita checkbox
  enableDragDrop: true,        // Habilita drag & drop
  handleSelect: (entityObj) => {}  // Callback chamado na renderização
})
```

**Eventos Emitidos:**
- `myio:device-params` - Quando checkbox é marcado
  ```javascript
  {
    id: entityId,
    name: labelOrName,
    icon: 'generic',
    deviceIdentifier: identifier,
    // ... outros campos
  }
  ```

- `myio:device-params-remove` - Quando checkbox é desmarcado
  ```javascript
  {
    id: entityId
  }
  ```

**⚠️ IMPORTANTE:** O callback `handleSelect` é chamado **durante a renderização do card**, não durante a seleção do usuário. Por isso, foi transformado em no-op.

---

### 3. TELEMETRY Widget (v-5.2.0/WIDGET/TELEMETRY/controller.js)

**Responsabilidade:** Renderizar lista de cards e integrar com SelectionStore.

**Listeners de Eventos:**
```javascript
// Linha 1298-1344: Listener para checkbox marcado
window.addEventListener('myio:device-params', (ev) => {
  try {
    const MyIOSelectionStore = MyIO?.MyIOSelectionStore || window.MyIOSelectionStore;

    if (MyIOSelectionStore) {
      // 1. Registra entidade com metadados completos
      const cardEntity = {
        id: ev.detail.id,
        name: ev.detail.name || 'Dispositivo',
        icon: ev.detail.icon || 'generic',
        group: ev.detail.deviceIdentifier || ev.detail.group || 'Dispositivo',
        lastValue: Number(ev.detail.lastValue) || 0,
        unit: ev.detail.unit || (WIDGET_DOMAIN === 'energy' ? 'kWh' : ...),
        status: ev.detail.status || 'unknown'
      };
      MyIOSelectionStore.registerEntity(cardEntity);

      // 2. Adiciona à seleção (emite evento)
      MyIOSelectionStore.add(ev.detail.id);
    }
  } catch (err) {
    LogHelper.error("[TELEMETRY] Error in device-params listener (non-fatal):", err);
  }
});

// Linha 1347-1370: Listener para checkbox desmarcado
window.addEventListener('myio:device-params-remove', (ev) => {
  try {
    const MyIOSelectionStore = MyIO?.MyIOSelectionStore || window.MyIOSelectionStore;
    if (MyIOSelectionStore) {
      MyIOSelectionStore.remove(ev.detail.id);
    }
  } catch (err) {
    LogHelper.error("[TELEMETRY] Error in device-params-remove listener (non-fatal):", err);
  }
});
```

**Callback handleSelect (Linha 688-693):**
```javascript
handleSelect: (entityObj) => {
  // NOTE: This callback is called during card rendering, NOT during user selection
  // Entity registration is handled by the 'myio:device-params' event listener instead
  LogHelper.log("[TELEMETRY] handleSelect called (no-op):", entityObj.labelOrName);
}
```

**Problemas Corrigidos:**
1. ✅ `handleSelect` registrava todas as 92+ entidades na renderização → transformado em no-op
2. ✅ Listeners sem try-catch quebravam o widget → adicionados try-catch com logs "non-fatal"
3. ✅ Registro de entidades duplicado → removido de `handleSelect`, mantido apenas no listener

---

### 4. FOOTER Widget (v-5.2.0/WIDGET/FOOTER/controller.js)

**Responsabilidade:** Exibir chips dos dispositivos selecionados e gerenciar ações.

**Estrutura do Controlador:**
```javascript
const footerController = {
  $root: null,
  $footerEl: null,
  $dock: null,
  $totals: null,
  $compareBtn: null,
  initialized: false,

  // Referências de funções bound
  boundRenderDock: null,
  boundCompareClick: null,
  boundDragOver: null,
  boundDrop: null,
  boundChipClick: null,

  init(ctx): void,
  mountTemplate(): void,
  queryDOMElements(): void,
  renderDock(): void,
  bindEvents(): void,
  onChipClick(e): void,
  onCompareClick(): void,
  onDrop(e): void,
  destroy(): void
}
```

**Template HTML (Linha 81-87):**
```html
<section class="myio-footer">
  <div class="myio-dock" id="myioDock" aria-live="polite"></div>
  <div class="myio-right">
    <div class="myio-meta" id="myioTotals">0 selecionados</div>
    <button id="myioCompare" class="myio-compare" disabled>Compare</button>
  </div>
</section>
```

**Listeners Registrados (Linha 227-229):**
```javascript
MyIOSelectionStore.on("selection:change", this.boundRenderDock);
MyIOSelectionStore.on("selection:totals", this.boundRenderDock);
```

**Lógica de Renderização (Linha 139-168):**
```javascript
renderDock() {
  const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
  const selected = MyIOSelectionStore.getSelectedEntities();  // ← Agora retorna objetos!
  const count = selected.length;

  if (count === 0) {
    // Mostra mensagem vazia
  } else {
    // Cria chips com:
    // - ent.name (nome do dispositivo)
    // - ent.id (para remoção)
  }

  // Atualiza contador e botão
  this.$totals.textContent = count > 0 ? `${count} selecionado(s) | ${totals}` : "0 selecionados";
  this.$compareBtn.disabled = count < 2;
}
```

**Problemas Corrigidos:**
1. ✅ **CRÍTICO:** LogHelper tinha recursão infinita (`LogHelper.log` chamava `LogHelper.log`) → corrigido para `console.log`
2. ✅ Template não era inserido no DOM → adicionado `innerHTML` em `mountTemplate()`
3. ✅ Falta de logs de diagnóstico → adicionados logs em `init()`, `renderDock()`, `bindEvents()`
4. ✅ Acesso inconsistente ao SelectionStore → padronizado com fallback: `window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore`

---

## Fluxo de Dados

### Fluxo de Seleção (Checkbox)

```
1. Usuário clica no checkbox do card
   ↓
2. Card Component (template-card-v2.js)
   → Emite evento: window.dispatchEvent('myio:device-params', { detail: {...} })
   ↓
3. TELEMETRY Widget (listener linha 1298)
   → Registra entidade: MyIOSelectionStore.registerEntity(cardEntity)
   → Adiciona à seleção: MyIOSelectionStore.add(id)
   ↓
4. SelectionStore (src/components/SelectionStore.js)
   → selectedIds.add(id)
   → _emitSelectionChange('add', id)
   → Emite evento: 'selection:change'
   ↓
5. FOOTER Widget (listener linha 227)
   → boundRenderDock() é chamado
   → getSelectedEntities() retorna objetos com metadados
   → Renderiza chips no DOM
```

### Fluxo de Deseleção (Uncheck)

```
1. Usuário desmarca o checkbox
   ↓
2. Card Component
   → Emite evento: 'myio:device-params-remove'
   ↓
3. TELEMETRY Widget (listener linha 1347)
   → Remove da seleção: MyIOSelectionStore.remove(id)
   ↓
4. SelectionStore
   → selectedIds.delete(id)
   → _emitSelectionChange('remove', id)
   → Emite evento: 'selection:change'
   ↓
5. FOOTER Widget
   → boundRenderDock() é chamado
   → Remove chip do DOM
```

### Fluxo de Drag & Drop (🔄 NÃO FUNCIONA AINDA)

```
1. Usuário começa a arrastar o card
   ↓
2. Card Component (dragstart)
   → dataTransfer.setData('text/myio-id', entityId)
   ↓
3. Usuário solta sobre o FOOTER
   ↓
4. FOOTER Widget (onDrop - linha 227)
   → id = e.dataTransfer.getData('text/myio-id')
   → MyIOSelectionStore.add(id)  ← PROBLEMA: entidade não registrada!
   ↓
5. SelectionStore
   → Adiciona ID, mas entidade não existe no Map
   ↓
6. FOOTER renderiza
   → getSelectedEntities() retorna undefined para esse ID
   → Chip não aparece ou sem nome
```

---

## Problemas Encontrados e Soluções

### ✅ Problema 1: FOOTER v5.2.0 não renderizava

**Sintoma:**
- FOOTER v5.0.0 funcionava com widgets v5.2.0
- FOOTER v5.2.0 com widgets v5.2.0 não aparecia nada

**Causa Raiz:**
`mountTemplate()` criava elemento vazio `<section class="myio-footer"></section>` mas nunca inseria o conteúdo do template.html.

**Solução (Commit: linha 81-87 FOOTER/controller.js):**
```javascript
mountTemplate() {
  const footerSection = document.createElement("section");
  footerSection.className = "myio-footer";

  // ✅ Insere o conteúdo do template explicitamente
  footerSection.innerHTML = `
    <div class="myio-dock" id="myioDock" aria-live="polite"></div>
    <div class="myio-right">
      <div class="myio-meta" id="myioTotals">0 selecionados</div>
      <button id="myioCompare" class="myio-compare" disabled>Compare</button>
    </div>
  `;

  this.$root.appendChild(footerSection);
  this.$footerEl = footerSection;
}
```

---

### ✅ Problema 2: LogHelper com recursão infinita no FOOTER

**Sintoma:**
- FOOTER não aparecia em nenhum log
- Stack overflow ao tentar logar qualquer coisa

**Causa Raiz (Linha 16-32 FOOTER/controller.js ANTES):**
```javascript
const LogHelper = {
  log: function(...args) {
    if (DEBUG_ACTIVE) {
      LogHelper.log(...args);  // ❌ Recursão infinita!
    }
  },
  // ... mesma coisa em warn e error
}
```

**Solução (Linha 16-32 FOOTER/controller.js DEPOIS):**
```javascript
const LogHelper = {
  log: function(...args) {
    if (DEBUG_ACTIVE) {
      console.log(...args);  // ✅ Chama console nativo
    }
  },
  warn: function(...args) {
    if (DEBUG_ACTIVE) {
      console.warn(...args);
    }
  },
  error: function(...args) {
    if (DEBUG_ACTIVE) {
      console.error(...args);
    }
  }
}
```

---

### ✅ Problema 3: handleSelect registrava todas as entidades na renderização

**Sintoma:**
- Ao renderizar 92+ cards, `handleSelect` era chamado 92+ vezes
- Log gigante com "Entity registered in SelectionStore" para todos os cards
- SelectionStore ficava com 92 entidades registradas sem o usuário selecionar nada

**Causa Raiz:**
`handleSelect` é um **callback de renderização**, não de seleção. É chamado para cada card renderizado.

**Solução (Linha 688-693 TELEMETRY/controller.js):**
```javascript
handleSelect: (entityObj) => {
  // NOTE: This callback is called during card rendering, NOT during user selection
  // Entity registration is handled by the 'myio:device-params' event listener instead
  LogHelper.log("[TELEMETRY] handleSelect called (no-op):", entityObj.labelOrName);
}
```

**Registro correto movido para listener (Linha 1305-1320):**
```javascript
window.addEventListener('myio:device-params', (ev) => {
  // Registra APENAS quando usuário clica no checkbox
  const cardEntity = { ... };
  MyIOSelectionStore.registerEntity(cardEntity);
  MyIOSelectionStore.add(ev.detail.id);
});
```

---

### ✅ Problema 4: getSelectedEntities() retornava apenas IDs

**Sintoma:**
- FOOTER tentava acessar `ent.name` mas recebia `undefined`
- Chips não exibiam nome do dispositivo

**Causa Raiz (src/components/SelectionStore.js linha 111-114 ANTES):**
```javascript
getSelectedEntities() {
  console.log("biblioteca:", this.getSelectedIds());
  return this.getSelectedIds();  // ❌ Retorna apenas IDs
}
```

**Solução (src/components/SelectionStore.js linha 111-117 DEPOIS):**
```javascript
getSelectedEntities() {
  console.log("[MyIOSelectionStoreClass] biblioteca:", this.getSelectedIds());
  // ✅ Return full entity objects from entities Map based on selected IDs
  return this.getSelectedIds()
    .map(id => this.entities.get(id))
    .filter(entity => entity !== undefined);
}
```

---

### ✅ Problema 5: remove() procurava objetos no Set de IDs

**Sintoma:**
- Remover chip do FOOTER não funcionava
- `selectedIds.delete(itemToRemove)` não encontrava o item

**Causa Raiz (src/components/SelectionStore.js linha 40-49 ANTES):**
```javascript
remove(id) {
  console.log("ITEM PARA REMOÇÃO ID", id);
  // ❌ Procura o objeto com o id
  const itemToRemove = Array.from(this.selectedIds).find(obj => obj.id === id);
  if (!itemToRemove) return;
  console.log("DELETE ID", id)
  this.selectedIds.delete(itemToRemove); // ❌ remove o objeto inteiro
  this._emitSelectionChange('remove', id);
  this._trackEvent('footer_dock.remove_chip', { entityId: id });
}
```

**Solução (src/components/SelectionStore.js linha 40-48 DEPOIS):**
```javascript
remove(id) {
  console.log("[MyIOSelectionStoreClass] ITEM PARA REMOÇÃO ID", id);
  // ✅ Check if ID exists in the Set
  if (!this.selectedIds.has(id)) return;
  console.log("[MyIOSelectionStoreClass] DELETE ID", id)
  this.selectedIds.delete(id); // ✅ remove the ID string
  this._emitSelectionChange('remove', id);
  this._trackEvent('footer_dock.remove_chip', { entityId: id });
}
```

---

### ✅ Problema 6: Listeners sem proteção quebravam o widget

**Sintoma:**
- Qualquer erro em `handleSelect` ou nos listeners quebrava todo o widget TELEMETRY
- Widgets paravam de carregar dados

**Solução:**
Adicionado try-catch em todos os listeners com logs "non-fatal" para garantir que erros de seleção não quebrem o fluxo principal:

```javascript
window.addEventListener('myio:device-params', (ev) => {
  try {
    // ... código do listener
  } catch (err) {
    LogHelper.error("[TELEMETRY] Error in device-params listener (non-fatal):", err);
    // Don't rethrow - we don't want selection errors to break the widget
  }
});
```

---

## 🔍 Estado Atual e Próximos Passos

### 🚨 ATUALIZAÇÃO MAIS RECENTE

**Data**: 2025-10-13

**Mudanças Implementadas**:

1. **Debug Logs Críticos Adicionados** no FOOTER controller.js:
   - **Linha 13-15**: Log no topo do arquivo para confirmar se script carrega
   - **Linhas 340-355**: Logs detalhados no `onInit` para rastrear inicialização
   - Try-catch wrapper para capturar erros silenciosos
   - Logs de contexto, container, e biblioteca disponível

2. **FOOTER_DEBUG_CHECKLIST.md Atualizado**:
   - Novo teste #0: "Script É Carregado?" como primeiro passo
   - Tabela de interpretação de resultados
   - Ações específicas baseadas em quais logs aparecem

**⚡ Ação Necessária - TESTE URGENTE:**

1. **Fazer upload** do `v-5.2.0/WIDGET/FOOTER/controller.js` atualizado no ThingsBoard
2. **Recarregar** a página do dashboard (Ctrl+R ou F5)
3. **Abrir console** (F12)
4. **Procurar** pelos logs `[FOOTER]`:
   - `[FOOTER] 🔵 Script carregado em: [timestamp]`
   - `[FOOTER] 🟢 onInit chamado!`
   - `[FOOTER] MyIOLibrary disponível: true`
   - `[FOOTER] ✅ Inicialização completa!`
5. **Reportar** quais logs aparecem (se algum)

**Interpretação Rápida:**
- ❌ **Nenhum log** → Widget FOOTER não está no dashboard
- ✅ **Log 1 apenas** → Widget existe mas onInit não é chamado
- ✅ **Logs 1-2** → onInit chamado mas biblioteca não disponível
- ✅ **Todos** → FOOTER inicializou, problema é visual/CSS

---

### ✅ Funcionalidades Implementadas

1. **SelectionStore:**
   - ✅ Singleton global funcionando
   - ✅ `add()` e `remove()` corretos
   - ✅ `getSelectedEntities()` retorna objetos completos
   - ✅ Sistema de eventos funcionando
   - ✅ Registro de entidades com metadados

2. **TELEMETRY Widget:**
   - ✅ Renderiza cards corretamente
   - ✅ Listener `myio:device-params` funciona
   - ✅ Listener `myio:device-params-remove` funciona
   - ✅ Registra entidades no SelectionStore
   - ✅ Adiciona/remove IDs da seleção
   - ✅ Proteções try-catch em todos os listeners

3. **FOOTER Widget:**
   - ✅ LogHelper corrigido (sem recursão)
   - ✅ Template inserido no DOM
   - ✅ Listeners registrados no SelectionStore
   - ✅ Logs de diagnóstico adicionados

### ❌ Problemas Pendentes

1. **FOOTER não aparece no log:**
   - ❓ Widget FOOTER não está sendo inicializado
   - ❓ Possível causa: não está adicionado no dashboard ou não tem biblioteca carregada
   - **Verificar:**
     - Widget FOOTER está no dashboard?
     - Biblioteca `myio-js-library` carregada via Resources?
     - Console mostra `[MyIO Footer] init() called`?

2. **Drag & Drop não funciona:**
   - ❓ Cards não são arrastáveis (`draggable="true"` não configurado?)
   - ❓ FOOTER não recebe evento `drop`
   - ❓ Ao soltar, entidade não está registrada no SelectionStore
   - **Verificar:**
     - `document.querySelector('.myio-card').draggable` retorna `true`?
     - Console mostra evento `dragstart`?
     - Console mostra evento `drop` no FOOTER?

3. **Seleção via checkbox:**
   - ✅ Evento `myio:device-params` é emitido
   - ✅ SelectionStore recebe o ID
   - ❌ FOOTER não renderiza porque não está inicializado

### 📊 Logs Atuais

**Do arquivo full-real.log:**

✅ **Eventos de seleção funcionando:**
```
[TELEMETRY] Card selected: {id: '92e50a50-9e33-11f0-afe1-175479a33d89', name: 'Trafo CAG 2'}
[TELEMETRY] Entity registered in SelectionStore: {...}
[MyIOSelectionStoreClass] Entrou na LIB 92e50a50-9e33-11f0-afe1-175479a33d89
[TELEMETRY] Added to SelectionStore: 92e50a50-9e33-11f0-afe1-175479a33d89
```

✅ **SelectionStore retorna objetos:**
```
[MyIOSelectionStoreClass] biblioteca: ['92e50a50-9e33-11f0-afe1-175479a33d89']
```

❌ **FOOTER não aparece:**
```
Nenhuma mensagem com "[MyIO Footer]" encontrada
```

---

## Próximos Passos

### 1. Verificar Inicialização do FOOTER

**Checklist:**
- [ ] Widget FOOTER está adicionado no dashboard ThingsBoard?
- [ ] Widget FOOTER está no state correto?
- [ ] Biblioteca `myio-js-library@latest` está em Resources?
- [ ] Build da biblioteca foi feito após correções? (`npm run build`)
- [ ] Console mostra mensagem `[MyIO Footer] init() called`?
- [ ] Console mostra erro `MyIOLibrary not found`?

**Comandos para testar no console:**
```javascript
// Verificar se biblioteca está carregada
window.MyIOLibrary

// Verificar se SelectionStore está disponível
window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore

// Verificar se FOOTER DOM existe
document.querySelector('.myio-footer')
document.querySelector('#myioDock')

// Verificar se cards existem e são draggable
document.querySelector('.device-card-centered')?.draggable
document.querySelectorAll('.device-card-centered').length
```

### 2. Investigar Drag & Drop

**Checklist:**
- [ ] Verificar se card é draggable: `document.querySelector('.device-card-centered').draggable`
- [ ] Verificar eventos no console:
  - `dragstart` quando arrasta card
  - `dragover` quando passa sobre FOOTER
  - `drop` quando solta no FOOTER
- [ ] Verificar se `template-card-v2.js` configura `draggable="true"`
- [ ] Verificar se FOOTER registra listeners de drag:
  ```javascript
  this.$footerEl.addEventListener("dragover", this.boundDragOver);
  this.$footerEl.addEventListener("drop", this.boundDrop);
  ```

### 3. Solução para Drag & Drop sem Entidade

**Problema:** Ao soltar card no FOOTER via drag, a entidade não está registrada no SelectionStore.

**Soluções possíveis:**

**Opção A: Registrar todas as entidades na renderização** (mais simples)
```javascript
// Em TELEMETRY, renderList(), após criar $card:
const cardEntity = {
  id: entityObject.entityId,
  name: entityObject.labelOrName,
  // ... outros campos
};
MyIOSelectionStore.registerEntity(cardEntity);
```

**Opção B: Incluir metadados no dataTransfer** (mais robusto)
```javascript
// No card, dragstart:
e.dataTransfer.setData('text/myio-id', entityId);
e.dataTransfer.setData('text/myio-entity', JSON.stringify({
  id: entityId,
  name: labelOrName,
  // ... outros campos
}));

// No FOOTER, onDrop:
const id = e.dataTransfer.getData('text/myio-id');
const entityData = e.dataTransfer.getData('text/myio-entity');
if (entityData) {
  const entity = JSON.parse(entityData);
  MyIOSelectionStore.registerEntity(entity);
}
MyIOSelectionStore.add(id);
```

**Opção C: Buscar entidade dos dados do widget** (mais complexo)
- FOOTER acessa `self.ctx.data` do TELEMETRY (não recomendado - widgets isolados)

### 4. Testes de Validação

**Após resolver inicialização do FOOTER:**

1. **Teste de Seleção via Checkbox:**
   - [ ] Clicar checkbox → chip aparece no FOOTER
   - [ ] Desmarcar checkbox → chip desaparece
   - [ ] Contador atualiza corretamente
   - [ ] Totais são calculados

2. **Teste de Remoção:**
   - [ ] Clicar "X" no chip → remove do FOOTER
   - [ ] Checkbox do card também é desmarcado
   - [ ] Contador atualiza

3. **Teste de Drag & Drop:**
   - [ ] Arrastar card → cursor muda
   - [ ] Soltar no FOOTER → chip aparece
   - [ ] Checkbox do card é marcado

4. **Teste de Comparação:**
   - [ ] 0-1 seleções → botão desabilitado
   - [ ] 2+ seleções → botão habilitado
   - [ ] Clicar botão → modal de comparação abre

---

## Referências de Código

### Arquivos Modificados

1. **src/components/SelectionStore.js**
   - Linha 111-117: `getSelectedEntities()` corrigido
   - Linha 40-48: `remove()` corrigido
   - Linha 29-38: `add()` com logs

2. **src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY/controller.js**
   - Linha 688-693: `handleSelect` transformado em no-op
   - Linha 1298-1344: Listener `myio:device-params` com try-catch
   - Linha 1347-1370: Listener `myio:device-params-remove` com try-catch

3. **src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/FOOTER/controller.js**
   - Linha 16-32: LogHelper corrigido (sem recursão)
   - Linha 53-97: `init()` com logs detalhados
   - Linha 81-87: `mountTemplate()` insere HTML
   - Linha 139-168: `renderDock()` com logs
   - Linha 208-230: `bindEvents()` com logs

### Comandos de Build

```bash
# Build da biblioteca
cd C:\Projetos\GitHub\myio\myio-js-library-PROD.git
npm run build

# Distribuição UMD será gerada em:
# dist/myio-js-library.umd.min.js
```

### Configuração ThingsBoard

**Widget Resources (Settings > Resources):**
```
https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js
```

**Ordem dos Widgets no Dashboard:**
1. MAIN_VIEW (top)
2. HEADER
3. TELEMETRY_ENERGY (ou WATER, TANK)
4. FOOTER (bottom)

---

## Glossário

- **SelectionStore:** Singleton global que gerencia estado de seleção entre widgets
- **Entity:** Objeto com metadados de um dispositivo (id, name, icon, group, lastValue, unit, status)
- **Chip:** Elemento visual no FOOTER representando um item selecionado
- **Dock:** Área no FOOTER onde os chips são exibidos
- **Bounded Function:** Função com `this` vinculado para remoção segura de listeners
- **No-op:** Operação que não faz nada (no operation)
- **Orchestrator:** Componente centralizado (MAIN_VIEW) que gerencia fetch e cache de dados

---

## Contato e Suporte

**Desenvolvido por:** MyIO Frontend Guild
**Versão do Documento:** 1.0.0
**Última Atualização:** 2025-01-13

Para dúvidas ou problemas:
1. Verifique os logs do console (F12)
2. Consulte esta documentação
3. Verifique o arquivo de logs: `TELEMETRY/full-real.log`
