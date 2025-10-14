# FOOTER Widget - Checklist de Debug

## ❌ Problema Identificado
**FOOTER widget não está sendo renderizado no DOM**

## 📊 Diagnóstico Atual

### ✅ O Que Funciona
- Cards renderizados: 301 cards
- Cards draggable: true
- Biblioteca carregada: MyIOLibrary ✓
- SelectionStore disponível: true
- Checkbox selection: funciona

### ❌ O Que Não Funciona
- Footer no DOM: **false**
- Dock no DOM: **false**
- Totals no DOM: **false**
- Nenhum log `[MyIO Footer]` no console

---

## 🔍 Checklist de Investigação

### 0. ⚡ TESTE CRÍTICO: Script É Carregado?

**PRIMEIRO PASSO - Execute antes de tudo:**

O FOOTER controller.js foi modificado com logs críticos no início do arquivo.

**Ação:** Recarregue a página (Ctrl+R ou F5) e abra o console.

**Procure por estas mensagens na ordem:**

1. `[FOOTER] 🔵 Script carregado em: [timestamp]`
2. `[FOOTER] 🟢 onInit chamado!`
3. `[FOOTER] MyIOLibrary disponível: true`
4. `[FOOTER] ✅ Inicialização completa!`

**Interpretação dos Resultados:**

| Logs que Aparecem | Diagnóstico | Próxima Ação |
|-------------------|-------------|--------------|
| ❌ Nenhum log | Script não está sendo carregado | Ir para checklist #1 (widget não adicionado) |
| ✅ Log 1, ❌ Logs 2-4 | Script carregado mas onInit não chamado | Ir para checklist #3 (verificar state) |
| ✅ Logs 1-2, ❌ Log 3 | onInit chamado mas biblioteca não disponível | Ir para checklist #6 (ordem de carregamento) |
| ✅ Logs 1-3, ❌ Log 4 | Erro durante inicialização | Verificar se há `[FOOTER] ❌ Erro` no console |
| ✅ Todos os logs | FOOTER inicializou! | Verificar por que não aparece no DOM (checklist #4) |

---

### 1. Widget FOOTER Está Adicionado no Dashboard?

**Ação:** Verificar no ThingsBoard

- [ ] Abrir o dashboard no ThingsBoard
- [ ] Ir em modo de edição (ícone de lápis)
- [ ] Verificar se há um widget "FOOTER" ou similar na lista de widgets
- [ ] Verificar em qual **state** o widget está configurado

**Possíveis problemas:**
- Widget não foi adicionado ao dashboard
- Widget está em state diferente (default vs outros)
- Widget foi removido acidentalmente

---

### 2. Widget FOOTER Tem o Controller Correto?

**Ação:** Verificar configuração do widget no ThingsBoard

- [ ] Clicar no widget FOOTER (modo edição)
- [ ] Ir em "Advanced" ou "Settings"
- [ ] Verificar se o controller aponta para:
  ```
  v-5.2.0/WIDGET/FOOTER/controller.js
  ```
- [ ] Verificar se o template aponta para:
  ```
  v-5.2.0/WIDGET/FOOTER/template.html (se aplicável)
  ```
- [ ] Verificar se o CSS aponta para:
  ```
  v-5.2.0/WIDGET/FOOTER/style.css (se aplicável)
  ```

**Possíveis problemas:**
- Controller aponta para v-5.0.0 em vez de v-5.2.0
- Arquivo controller.js não foi salvo/uploaded
- Syntax error no controller.js

---

### 3. Há Erros de JavaScript no Console?

**Ação:** Verificar console do navegador

Execute no console:
```javascript
// Ver todos os erros do FOOTER
console.log('Procurando erros do FOOTER...');
```

Depois, recarregue a página (Ctrl+R) e observe o console.

**Procure por:**
- [ ] Mensagem de erro com "FOOTER" no texto
- [ ] Mensagem "MyIOLibrary not found" do FOOTER
- [ ] Syntax error em controller.js
- [ ] "Uncaught" ou "TypeError" relacionado ao FOOTER

**Possíveis problemas:**
- Recursão infinita no LogHelper (já corrigido)
- Erro de sintaxe no controller.js
- Biblioteca não carregada antes do FOOTER inicializar

---

### 4. Widget FOOTER Está Visível (Não Oculto)?

**Ação:** Verificar CSS/Layout

Execute no console:
```javascript
// Verificar se há elementos ocultos do FOOTER
const hiddenFooters = document.querySelectorAll('[class*="footer"][style*="display: none"]');
console.log('Footer oculto?', hiddenFooters.length > 0);
console.log('Elementos:', hiddenFooters);

// Verificar se há containers do widget vazios
const widgets = document.querySelectorAll('[class*="widget"]');
console.log('Total widgets:', widgets.length);
widgets.forEach((w, i) => {
  if (w.textContent.includes('footer') || w.innerHTML.includes('footer')) {
    console.log(`Widget ${i} tem footer:`, w);
  }
});
```

**Possíveis problemas:**
- Widget está com `display: none`
- Widget está fora da viewport (height: 0)
- Z-index negativo

---

### 5. Lifecycle Hooks São Chamados?

**Ação:** Adicionar logs de debug

Adicione temporariamente no início do `controller.js` do FOOTER:
```javascript
console.log('[FOOTER DEBUG] Script loaded!');

self.onInit = function () {
  console.log('[FOOTER DEBUG] onInit called!', self.ctx);

  // ... resto do código
  footerController.init(self.ctx);
}
```

Recarregue e verifique:
- [ ] `[FOOTER DEBUG] Script loaded!` aparece?
- [ ] `[FOOTER DEBUG] onInit called!` aparece?

**Se NÃO aparecer:**
- Widget não está no dashboard
- Widget está em state errado
- Controller não está sendo executado

**Se aparecer mas FOOTER não renderiza:**
- Erro dentro de `footerController.init()`
- Biblioteca não disponível
- Erro no `mountTemplate()`

---

### 6. Biblioteca É Carregada ANTES do FOOTER?

**Ação:** Verificar ordem de carregamento

No ThingsBoard, widgets são carregados em ordem. Verifique:

- [ ] MAIN_VIEW é o primeiro widget (top)
- [ ] HEADER vem depois
- [ ] TELEMETRY vem depois
- [ ] FOOTER é o último (bottom)

**Execute no console:**
```javascript
// Verificar se biblioteca já estava disponível quando FOOTER tentou inicializar
console.log('Ordem de carregamento:');
console.log('1. MyIOLibrary:', !!window.MyIOLibrary);
console.log('2. SelectionStore:', !!(window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore));
```

**Possíveis problemas:**
- FOOTER tenta inicializar antes da biblioteca carregar
- Biblioteca não está em "Resources" do widget
- CDN unpkg.com está fora do ar

---

### 7. Resources Estão Configurados?

**Ação:** Verificar Resources do widget

Para CADA widget (MAIN_VIEW, HEADER, TELEMETRY, FOOTER):

- [ ] Clicar no widget (modo edição)
- [ ] Ir em "Resources"
- [ ] Verificar se há:
  ```
  https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js
  ```
- [ ] Verificar se o tipo é "External Resource" (não "Local")

**Possíveis problemas:**
- FOOTER não tem a biblioteca em Resources
- URL da biblioteca está errada
- CDN não está acessível

---

## 🔧 Soluções Rápidas

### Solução 1: Re-adicionar Widget FOOTER

Se o widget não estiver no dashboard:

1. Modo edição do dashboard
2. "Add Widget" ou "+"
3. Importar widget FOOTER v-5.2.0
4. Posicionar no bottom do layout
5. Configurar Resources:
   ```
   https://unpkg.com/myio-js-library@latest/dist/myio-js-library.umd.min.js
   ```
6. Salvar

---

### Solução 2: Adicionar Logs de Debug

Editar `v-5.2.0/WIDGET/FOOTER/controller.js`:

**No topo do arquivo (linha 1):**
```javascript
console.log('[FOOTER] 🔵 Script carregado em:', new Date().toISOString());
```

**Substituir linha 298 (self.onInit):**
```javascript
self.onInit = function () {
  console.log('[FOOTER] 🟢 onInit chamado!');
  console.log('[FOOTER] ctx:', self.ctx);
  console.log('[FOOTER] container:', self.ctx?.$container);
  console.log('[FOOTER] MyIOLibrary:', !!window.MyIOLibrary);

  // Passa o contexto do widget (self.ctx) para o controlador
  footerController.init(self.ctx);
};
```

Salvar, fazer upload no ThingsBoard, recarregar página e verificar console.

---

### Solução 3: Verificar State do Widget

ThingsBoard usa "states" para mostrar/ocultar widgets.

1. Modo edição
2. Clicar no widget FOOTER
3. "Advanced" → "Widget settings"
4. Verificar "Target state": deve ser o **mesmo state dos outros widgets**
   - Se outros estão em "default", FOOTER também deve estar
   - Se outros estão em "custom_state", FOOTER também deve estar

---

### Solução 4: Forçar Inicialização Manual

Como último recurso, execute no console:

```javascript
// Criar FOOTER manualmente
const footerDiv = document.createElement('div');
footerDiv.style.cssText = 'position: fixed; bottom: 0; left: 0; right: 0; z-index: 999;';

const footerHTML = `
  <section class="myio-footer" style="background: #f0f0f0; padding: 16px; box-shadow: 0 -2px 8px rgba(0,0,0,0.1);">
    <div class="myio-dock" id="myioDock" style="display: inline-block;">
      <span class="myio-empty">Arraste itens para cá ou selecione no card</span>
    </div>
    <div class="myio-right" style="float: right;">
      <div class="myio-meta" id="myioTotals" style="display: inline-block; margin-right: 12px;">0 selecionados</div>
      <button id="myioCompare" class="myio-compare" disabled style="padding: 8px 16px;">Compare</button>
    </div>
  </section>
`;

footerDiv.innerHTML = footerHTML;
document.body.appendChild(footerDiv);

// Registrar listener no SelectionStore
const MyIOSelectionStore = window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore;
if (MyIOSelectionStore) {
  MyIOSelectionStore.on('selection:change', (data) => {
    console.log('[FOOTER MANUAL] selection:change', data);
    const dock = document.querySelector('#myioDock');
    const totals = document.querySelector('#myioTotals');

    if (data.selectedIds.length === 0) {
      dock.innerHTML = '<span class="myio-empty">Arraste itens para cá ou selecione no card</span>';
      totals.textContent = '0 selecionados';
    } else {
      const selected = MyIOSelectionStore.getSelectedEntities();
      const chips = selected.map(ent => `<span style="background: #e0e0e0; padding: 4px 8px; margin: 0 4px; border-radius: 4px;">${ent.name}</span>`).join('');
      dock.innerHTML = chips;
      totals.textContent = `${selected.length} selecionado(s)`;
    }
  });
  console.log('✅ FOOTER manual criado com sucesso!');
} else {
  console.error('❌ SelectionStore não disponível!');
}
```

Se isso funcionar, confirma que o problema é com o widget do ThingsBoard, não com o código.

---

## 📝 Próximos Passos

Depois de executar este checklist:

1. **Reporte os resultados:**
   - Quais items do checklist passaram ✅
   - Quais items falharam ❌
   - Mensagens de erro encontradas

2. **Se FOOTER aparecer:**
   - Testar checkbox selection
   - Testar drag & drop
   - Testar remoção de chips
   - Testar botão Compare

3. **Se FOOTER não aparecer:**
   - Compartilhar screenshot da configuração do widget
   - Compartilhar erros do console
   - Verificar se widget está no dashboard

---

## 🆘 Informações para Debug

Se precisar de ajuda, forneça:

```javascript
// Execute no console e copie o resultado:
console.log('=== DEBUG INFO ===');
console.log('1. Widgets no dashboard:', document.querySelectorAll('[class*="widget"]').length);
console.log('2. Footer no DOM:', !!document.querySelector('.myio-footer'));
console.log('3. MyIOLibrary:', !!window.MyIOLibrary);
console.log('4. SelectionStore:', !!(window.MyIOLibrary?.MyIOSelectionStore || window.MyIOSelectionStore));
console.log('5. Cards:', document.querySelectorAll('.device-card-centered').length);
console.log('6. URL atual:', window.location.href);
console.log('7. User agent:', navigator.userAgent);
console.log('==================');
```

E um screenshot do dashboard no modo de edição mostrando todos os widgets.
