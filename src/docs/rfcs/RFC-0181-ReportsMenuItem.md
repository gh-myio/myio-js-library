# RFC-0181: Reports Menu Item — Modal de Relatórios a partir do MENU Widget

- **RFC Number:** 0181
- **Status:** Draft
- **Start Date:** 2026-02-25
- **Related RFCs:** RFC-0079 (Menu Navigation Restructure), RFC-0024 (openDashboardPopupReport API), RFC-0180 (Alarms Tab)
- **Files Affected:**
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/settingsSchema.json` *(schema change)*
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/controller.js` *(new handler)*
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/MENU/template.html` *(conditional render)*
  - `src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/HEADER/controller.js` *(reused, no change)*

---

## Summary

Adiciona um item fixo **"Relatórios"** na barra de navegação do MENU widget. Ao clicar, em vez de navegar para um ThingsBoard state, o item abre um novo modal de seleção de relatórios organizado por domínio e sub-categoria.

Os sub-relatórios disponíveis por domínio são:

| Domínio | Sub-relatório | Status |
|---------|---------------|--------|
| **Energia** | Entrada | Deferred |
| **Energia** | Área Comum | Deferred |
| **Energia** | Lojas | **Implementado** (reusa HEADER) |
| **Energia** | Todos Dispositivos | Deferred |
| **Água** | Entrada | Deferred |
| **Água** | Área Comum | Deferred |
| **Água** | Lojas | **Implementado** (reusa HEADER) |
| **Água** | Todos Dispositivos | Deferred |
| **Temperatura** | Ambientes Climatizáveis | Deferred |
| **Temperatura** | Ambientes Não Climatizáveis | Deferred |
| **Temperatura** | Todos Ambientes | Deferred |
| **Alarmes** | Por Dispositivo | Deferred |
| **Alarmes** | Por Dispositivo × Tipo de Alarme | Deferred |
| **Alarmes** | Por Tipo de Alarme | Deferred |

Para **Energia / Lojas** e **Água / Lojas** o botão chama diretamente `MyIOLibrary.openDashboardPopupAllReport(...)` com os mesmos parâmetros já utilizados pelo HEADER widget (domínio `energy` e `water` respectivamente). Os demais botões são renderizados desabilitados com badge *"Em breve"* e implementados em iterações futuras.

---

## Motivation

O dashboard de shopping já possui um botão "Relatório" dentro do HEADER widget que abre o `AllReport` modal de consumo por loja para o domínio ativo (energia ou água). Porém esse botão:

1. Está acoplado ao domínio selecionado no momento — o usuário precisa trocar de aba antes de acessar o relatório de água.
2. Só expõe um relatório (consumo por loja). Não há ponto de entrada para relatórios de **Entrada**, **Área Comum**, **Temperatura** ou **Alarmes**.
3. Não é acessível diretamente da barra lateral de navegação.

Centralizar o acesso a todos os relatórios no MENU widget melhora a descoberta, elimina o acoplamento ao domínio ativo e prepara a estrutura para os novos tipos de relatório planejados.

---

## Guide-Level Explanation

### Fluxo do usuário

1. O usuário vê um novo item **"Relatórios"** na barra lateral do MENU widget (abaixo dos links de navegação existentes ou como link configurável).
2. Ao clicar, um modal flutuante se abre mostrando os domínios disponíveis como abas ou seções.
3. Dentro de cada domínio, os sub-relatórios são listados como cards clicáveis.
4. Cards habilitados (Energia/Lojas e Água/Lojas) abrem imediatamente o `AllReport` modal.
5. Cards desabilitados exibem badge **"Em breve"** e são não-clicáveis.

### Layout do modal (ASCII)

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊  Relatórios                                          [✕ fechar] │
├─────────────────────────────────────────────────────────────────────┤
│  [⚡ Energia]  [💧 Água]  [🌡️ Temperatura]  [🔔 Alarmes]            │
├─────────────────────────────────────────────────────────────────────┤
│  ⚡ Energia                                                          │
│                                                                     │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────┐ │
│  │   Entrada     │  │ Área Comum   │  │   Lojas   ✓  │  │ Todos  │ │
│  │  [Em breve]   │  │  [Em breve]  │  │  (clicável)  │  │[Embrv] │ │
│  └───────────────┘  └──────────────┘  └──────────────┘  └────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Integração com MENU widget

O item "Relatórios" pode ser configurado de duas formas (a decidir na implementação):

**Opção A — Link especial no `settingsSchema.json`:**
Adicionar `stateId: "reports_modal"` como valor reservado. O controller detecta esse valor e chama o handler do modal em vez de navegar pelo ThingsBoard.

**Opção B — Botão fixo fora do `ng-repeat`:**
Adicionar um botão estático no template abaixo de `<nav class="menu-list">`, sem depender do `links` array, para evitar ocupar uma das 5 vagas de link configurável.

A **Opção B** é a recomendada neste RFC para não interferir na contagem `maxItems: 5` do schema existente e não requerer reconfiguração do widget no ThingsBoard.

---

## Reference-Level Explanation

### Part 1 — MENU `template.html` (Opção B)

Adicionar o botão fixo após o `<nav class="menu-list">`:

```html
<!-- RFC-0181: Fixed Reports button -->
<div class="menu-reports-section">
  <button id="btn-open-reports-modal" class="menu-item menu-item--reports">
    <span class="menu-icon">📊</span>
    <span class="label">Relatórios</span>
  </button>
</div>
```

### Part 2 — MENU `controller.js`

#### 2.1 — Bind do botão

Em `onInit`, após a inicialização dos links existentes:

```js
// RFC-0181: Reports modal button
const btnReports = document.getElementById('btn-open-reports-modal');
if (btnReports) {
  btnReports.addEventListener('click', function (e) {
    e.preventDefault();
    openReportsModal();
  });
}
```

#### 2.2 — Função `openReportsModal()`

```js
function openReportsModal() {
  // Lê credenciais do orchestrator (publicadas pelo MAIN_VIEW)
  const orch = window.MyIOOrchestrator || {};
  const INGESTION_ID      = orch.ingestionId      || '';
  const CLIENT_ID         = orch.clientId         || '';
  const CLIENT_SECRET     = orch.clientSecret      || '';
  const DATA_API_HOST     = orch.dataApiBaseUrl    || '';
  const ingestionAuthToken = orch.ingestionToken   || '';

  // Parâmetros comuns para openDashboardPopupAllReport
  const baseReportParams = {
    customerId: INGESTION_ID,
    debug: 0,
    api: {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      dataApiBaseUrl: DATA_API_HOST,
      ingestionToken: ingestionAuthToken,
    },
    ui: { theme: 'light' },
  };

  // Monta e exibe o modal de seleção de relatórios
  _renderReportsPickerModal(baseReportParams);
}
```

#### 2.3 — Função `_renderReportsPickerModal(baseParams)`

Cria o overlay/modal de seleção inline (sem dependência de componente externo):

```js
function _renderReportsPickerModal(baseParams) {
  // Remove instância anterior se existir
  const existing = document.getElementById('myio-reports-picker-modal');
  if (existing) existing.remove();

  const domains = [
    {
      id: 'energy',
      label: 'Energia',
      icon: '⚡',
      items: [
        { id: 'entrada',    label: 'Entrada',           enabled: false },
        { id: 'area_comum', label: 'Área Comum',        enabled: false },
        { id: 'lojas',      label: 'Lojas',             enabled: true  },
        { id: 'todos',      label: 'Todos Dispositivos', enabled: false },
      ],
    },
    {
      id: 'water',
      label: 'Água',
      icon: '💧',
      items: [
        { id: 'entrada',    label: 'Entrada',           enabled: false },
        { id: 'area_comum', label: 'Área Comum',        enabled: false },
        { id: 'lojas',      label: 'Lojas',             enabled: true  },
        { id: 'todos',      label: 'Todos Dispositivos', enabled: false },
      ],
    },
    {
      id: 'temperature',
      label: 'Temperatura',
      icon: '🌡️',
      items: [
        { id: 'climatizavel',     label: 'Ambientes Climatizáveis',     enabled: false },
        { id: 'nao_climatizavel', label: 'Ambientes Não Climatizáveis', enabled: false },
        { id: 'todos',            label: 'Todos Ambientes',             enabled: false },
      ],
    },
    {
      id: 'alarms',
      label: 'Alarmes',
      icon: '🔔',
      items: [
        { id: 'por_dispositivo',      label: 'Por Dispositivo',                  enabled: false },
        { id: 'dispositivo_x_alarme', label: 'Por Dispositivo × Tipo de Alarme', enabled: false },
        { id: 'por_tipo',             label: 'Por Tipo de Alarme',               enabled: false },
      ],
    },
  ];

  // Renderiza o overlay + modal (HTML inline)
  const overlay = document.createElement('div');
  overlay.id = 'myio-reports-picker-modal';
  // ... HTML rendering, tab switching, card click handlers ...

  // Handler de clique nos cards habilitados
  overlay.addEventListener('click', function (e) {
    const card = e.target.closest('[data-domain][data-item]');
    if (!card || card.dataset.enabled !== 'true') return;

    const domain = card.dataset.domain;
    const item   = card.dataset.item;

    if ((domain === 'energy' || domain === 'water') && item === 'lojas') {
      _openLojasReport(domain, baseParams);
    }
    // Outros handlers serão adicionados quando implementados
  });

  document.body.appendChild(overlay);
}
```

#### 2.4 — Função `_openLojasReport(domain, baseParams)`

Delega para o mesmo caminho já usado pelo HEADER widget:

```js
function _openLojasReport(domain, baseParams) {
  if (typeof MyIOLibrary === 'undefined' || !MyIOLibrary.openDashboardPopupAllReport) {
    LogHelper.error('[MENU RFC-0181] MyIOLibrary.openDashboardPopupAllReport not available');
    return;
  }

  MyIOLibrary.openDashboardPopupAllReport({
    ...baseParams,
    domain: domain, // 'energy' | 'water'
    // itemsList: não passado — AllReport usa datasources internos quando ausente
  });
}
```

> **Nota:** `itemsList` é opcional. O HEADER o preenche com datasources filtrados por alias para limitar o scope. O MENU não tem acesso aos datasources do HEADER, portanto não passa `itemsList` nesta iteração; o AllReport modal exibirá todos os itens disponíveis para o customer. Caso seja necessário filtrar, uma futura iteração pode ler de `window.MyIOOrchestrator`.

---

### Part 3 — Credenciais via `window.MyIOOrchestrator`

O MENU widget não tem datasources diretos com as credenciais de API. Elas devem ser lidas de `window.MyIOOrchestrator`, que é populado pelo MAIN_VIEW no `onInit`:

```js
window.MyIOOrchestrator = {
  // ... campos existentes ...
  ingestionId:     '...',  // INGESTION_ID / customerId para AllReport
  clientId:        '...',
  clientSecret:    '...',
  dataApiBaseUrl:  '...',
  ingestionToken:  '...',
};
```

Se `window.MyIOOrchestrator` não estiver disponível (widget carregou antes do MAIN_VIEW), o modal é aberto mas os relatórios retornam erro silencioso da API — comportamento aceitável na primeira versão.

---

### Part 4 — `settingsSchema.json` (sem alteração para Opção B)

Nenhuma alteração necessária no schema. O botão "Relatórios" é estático no template e não consome uma vaga do `links` array.

Se a Opção A for escolhida no futuro, adicionar em `items.properties`:

```json
"type": {
  "title": "Tipo de item",
  "type": "string",
  "enum": ["state", "reports_modal"],
  "default": "state"
}
```

---

### Part 5 — Ícone no `scope.getMenuIcon`

Adicionar mapeamento para o botão fixo (usado somente se Opção A for implementada):

```js
scope.getMenuIcon = function (stateId) {
  const icons = {
    telemetry_content:  '⚡',
    water_content:      '💧',
    temperature_content:'🌡️',
    alarm_content:      '🔔',
    reports_modal:      '📊',  // RFC-0181
  };
  return icons[stateId] || '📄';
};
```

---

### Part 6 — Fluxo de dados completo

```
Usuário clica "Relatórios" (MENU widget)
  |
  `-- openReportsModal()
       |-- lê credenciais de window.MyIOOrchestrator
       `-- _renderReportsPickerModal(baseParams)
            |
            |-- Renderiza overlay com 4 domínios + cards
            |
            `-- Usuário clica em "Lojas" (Energia ou Água)
                 |
                 `-- _openLojasReport(domain, baseParams)
                      |
                      `-- MyIOLibrary.openDashboardPopupAllReport({
                            customerId: INGESTION_ID,
                            domain: 'energy' | 'water',
                            api: { clientId, clientSecret, ... },
                            ui: { theme: 'light' },
                          })
                            |
                            `-- AllReport modal (caminho existente no HEADER)
```

---

## Drawbacks

- **Duplicação de chamada:** O mesmo `openDashboardPopupAllReport` já existe no HEADER. O MENU passa a ser um segundo ponto de entrada para o mesmo relatório. A lógica de filtro por `itemsList` (datasources filtrados por alias) presente no HEADER **não** é replicada nesta primeira iteração — o AllReport abre sem filtro de datasource.
- **Dependência de `MyIOOrchestrator`:** Se o MENU carregar antes do MAIN_VIEW (raro, mas possível), as credenciais estarão vazias e a chamada à API falhará silenciosamente.
- **Botão estático não configurável:** A Opção B adiciona um botão não administrável via ThingsBoard settings. Operadores que precisarem ocultar "Relatórios" não terão como fazê-lo sem editar o template.

---

## Rationale and Alternatives

### Por que Opção B (botão fixo) e não Opção A (link no schema)?

O schema atual limita `maxItems: 5`. Adicionar "Relatórios" como um link configurável consumiria uma vaga de navegação nos shoppings que já usam os 5 slots. Como "Relatórios" não é um estado de navegação ThingsBoard mas um gatilho de modal, faz mais sentido como botão separado com identidade visual distinta.

### Por que não criar um novo widget "REPORTS"?

Criar um widget isolado implicaria novo registro no ThingsBoard, nova posição no layout do dashboard e comunicação inter-widget adicional. O modal picker é leve e auto-contido — não requer estado persistente entre sessões.

### Por que reusar `openDashboardPopupAllReport` em vez de criar nova API?

O `AllReport` modal já renderiza o relatório de consumo por loja para energia e água e está em produção. Criar uma nova API para o mesmo relatório seria duplicação desnecessária. A expansão para os outros sub-relatórios (Entrada, Área Comum, etc.) requererá novas APIs de backend quando implementada.

---

## Prior Art

- **RFC-0024** — Definiu a API `openDashboardPopupReport` e a distinção entre relatório de dispositivo único e todos os dispositivos.
- **RFC-0079** — Reestruturou a navegação do MENU widget; introduziu o `changeDashboardState` e o `scope.getMenuIcon`.
- **HEADER `controller.js` (linhas 974–994)** — Implementação de referência do `openDashboardPopupAllReport` que este RFC reutiliza para Energia/Lojas e Água/Lojas.

---

## Unresolved Questions / Deferred Items

1. **Energia: Entrada** — Requer novo endpoint de relatório no data-api. Deferred.
2. **Energia: Área Comum** — Calculado como `Entrada − (Lojas + Climatização + Elevadores + Esc. Rolantes + Outros)`. Requer suporte no data-api. Deferred.
3. **Energia / Água: Todos Dispositivos** — Relatório cross-categoria. Deferred.
4. **Temperatura: todos os sub-relatórios** — Requer novo endpoint. Deferred.
5. **Alarmes: todos os sub-relatórios** — Requer integração com GCDR/Alarms API. Deferred.
6. **`itemsList` filtrado** — Em iterações futuras, `window.MyIOOrchestrator` deve expor a lista de datasources do customer para que o MENU possa passar `itemsList` ao AllReport modal com o mesmo scope usado pelo HEADER.
7. **Opção A vs B definitiva** — Se o time decidir tornar "Relatórios" configurável (ocultar por customer), migrar para Opção A com `stateId: "reports_modal"` e ajustar `maxItems` no schema.

---

## Future Possibilities

- **Badge de novidades:** Exibir contador de relatórios disponíveis (ex: `(2)`) no botão "Relatórios" à medida que mais sub-relatórios forem implementados.
- **Relatório de Área Comum via AllReport:** Quando o data-api suportar filtragem por sub-categoria, passar `itemsList` com apenas os dispositivos de área comum.
- **Relatório de Alarmes PDF:** Usar a infra de pre-fetch de alarmes do RFC-0180 para gerar um PDF de alarmes por período diretamente do modal de relatórios.
- **Deep-link por domínio:** Abrir o modal de relatórios já posicionado na aba do domínio ativo (lido de `window.MyIOOrchestrator.activeDomain`).
