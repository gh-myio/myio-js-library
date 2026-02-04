# RFC-0160: MAIN_UNIQUE_DATASOURCE Architecture

> Documento de arquitetura do widget principal do ThingsBoard que orquestra todos os componentes da biblioteca MyIO.

## 1. Visão Geral

O `MAIN_UNIQUE_DATASOURCE` é o widget controlador central que:
- Recebe dados do ThingsBoard via datasource `AllDevices`
- Classifica dispositivos por domínio (energy, water, temperature) e contexto
- Orquestra a criação e comunicação entre componentes
- Gerencia estados, temas e filtros globais

### Localização
```
src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/
├── controller.js      # Lógica principal (~6,800 linhas)
├── template.html      # Template HTML com 4 seções de layout
└── settingsSchema.json # Schema de configuração do widget
```

---

## 2. Hierarquia de Componentes em Cascata

```
MAIN_UNIQUE_DATASOURCE (ThingsBoard Widget)
│
├─ WelcomeModalView
│  └─ Modal de landing page com cards de shoppings
│
├─ HeaderComponent (RFC-0113)
│  ├─ KPI cards (Energia, Água, Temperatura)
│  ├─ Tooltips com breakdown por status/categoria
│  └─ Botão de filtro e voltar
│
├─ MenuComponent (RFC-0114)
│  ├─ Tabs de domínio (Energia, Água, Temperatura, Operational)
│  ├─ Seletor de contexto
│  ├─ Date range picker
│  └─ Botões: Filtrar, Carregar, Limpar, Metas
│
├─ [ÁREA PRINCIPAL - Mutuamente Exclusivos]
│  │
│  ├─ TelemetryGridComponent (RFC-0121)
│  │  └─ Grid de cards de dispositivos
│  │
│  ├─ EnergyPanelComponent (RFC-0132)
│  │  └─ Painel de resumo de energia
│  │
│  ├─ WaterPanelComponent (RFC-0133)
│  │  └─ Painel de resumo de água
│  │
│  ├─ OperationalGridComponent (RFC-0152)
│  │  └─ Grid de equipamentos operacionais
│  │
│  ├─ OperationalDashboardComponent (RFC-0152)
│  │  └─ Dashboard de KPIs operacionais
│  │
│  └─ AlarmsNotificationsPanelComponent (RFC-0152)
│     └─ Painel de alarmes e notificações
│
└─ FooterComponent (RFC-0115)
   └─ Seleção de dispositivos e comparação
```

### Regra de Exclusividade
Apenas um componente da área principal é ativo por vez:
- `switchToTelemetryGrid()` → destrói panels
- `switchToEnergyPanel()` → destrói telemetryGrid
- `switchToWaterPanel()` → destrói outros panels
- `switchToOperationalGrid()` → destrói todos os outros

---

## 3. Fluxo de Eventos (Event-Driven Architecture)

### 3.1 Eventos Emitidos pelo Controller

| Evento | Disparado Por | Payload |
|--------|--------------|---------|
| `myio:data-ready` | processDataAndDispatchEvents() | `{ classified, shoppingCards, deviceCounts, shoppings }` |
| `myio:energy-summary-ready` | processDataAndDispatchEvents() | `{ customerTotal, byStatus, byCategory, byShoppingTotal }` |
| `myio:water-summary-ready` | processDataAndDispatchEvents() | `{ customerTotal, byStatus, byCategory, byShoppingTotal }` |
| `myio:temperature-data-ready` | processDataAndDispatchEvents() | `{ globalAvg, shoppingsInRange, devices, byStatus }` |
| `myio:equipment-count-updated` | processDataAndDispatchEvents() | `{ totalEquipments, filteredEquipments, byStatus }` |
| `myio:dashboard-state` | handleContextChange() | `{ domain, context, viewMode }` |

### 3.2 Eventos Recebidos pelo Controller

| Evento | Origem | Ação |
|--------|--------|------|
| `myio:request-shoppings` | MenuComponent | Retorna lista de shoppings cacheada |
| `myio:force-refresh` | Menu (Limpar) | Limpa cache e recarrega dados |
| `myio:filter-applied` | Header/Menu | Aplica filtro em todos componentes |
| `myio:theme-change` | Header/Menu | Atualiza tema em todos componentes |
| `myio:switch-main-state` | MenuController | Navega para painel operacional |
| `myio:telemetry-card-action` | TelemetryGrid | Abre popup (dashboard/report/settings) |
| `myio:update-date` | Menu | Recarrega dados com novo período |
| `myio:request-reload` | Menu (Carregar) | Recarrega dados |
| `myio:open-goals-panel` | Menu (Metas) | Abre painel de metas |
| `myio:open-welcome-modal` | Header (Voltar) | Reabre modal de boas-vindas |
| `myio:panel-modal-request` | TelemetryGrid | Abre painel em modal overlay |

### 3.3 Diagrama de Fluxo de Eventos

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INICIALIZAÇÃO                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [ThingsBoard Widget Carrega]                                        │
│           │                                                          │
│           ▼                                                          │
│  [Registra Event Handlers Globais]  ◄─────────────────────────────┐ │
│  (myio:request-shoppings, myio:force-refresh)                      │ │
│           │                                                        │ │
│           ▼                                                        │ │
│  [Cria Componentes em Sequência]                                   │ │
│   ├─ WelcomeModal ───► espera myio:data-ready                      │ │
│   ├─ HeaderComponent ─► espera myio:data-ready                     │ │
│   ├─ MenuComponent ──► recebe shoppings do cache                   │ │
│   ├─ TelemetryGrid ──► recebe devices do MyIOOrchestrator          │ │
│   └─ FooterComponent                                               │ │
│           │                                                        │ │
│           ▼                                                        │ │
│  [processDataAndDispatchEvents()]                                  │ │
│   ├─ Classifica dispositivos por domínio/contexto                  │ │
│   ├─ Cacheia em variáveis globais ─────────────────────────────────┘ │
│   └─ Dispara eventos myio:*-ready                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       INTERAÇÃO DO USUÁRIO                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Usuário muda Tab/Contexto no Menu]                                 │
│           │                                                          │
│           ▼                                                          │
│  [Menu emite evento de mudança]                                      │
│           │                                                          │
│           ▼                                                          │
│  [handleContextChange(tabId, contextId)]                             │
│           │                                                          │
│           ├─► operational ────► switchToOperationalGrid()            │
│           ├─► energy_general ─► switchToEnergyPanel()                │
│           ├─► water_summary ──► switchToWaterPanel()                 │
│           └─► default ────────► switchToTelemetryGrid()              │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────── │
│                                                                      │
│  [Usuário aplica Filtro]                                             │
│           │                                                          │
│           ▼                                                          │
│  [myio:filter-applied recebido]                                      │
│           │                                                          │
│           ├─► Filtra dados classificados                             │
│           ├─► Atualiza Header com totais filtrados                   │
│           ├─► TelemetryGrid.applyFilter()                            │
│           └─► Dispara eventos *-summary-ready (filtrados)            │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────── │
│                                                                      │
│  [Usuário muda Tema]                                                 │
│           │                                                          │
│           ▼                                                          │
│  [myio:theme-change recebido]                                        │
│           │                                                          │
│           ├─► Atualiza currentThemeMode                              │
│           ├─► Aplica background na página                            │
│           └─► Chama setThemeMode() em TODOS componentes              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Padrões de Gerenciamento de Estado

### 4.1 Cache em Nível de Módulo (RFC-0126)

```javascript
// Variáveis globais no escopo do módulo
let _cachedShoppings = [];        // Lista de shoppings
let _cachedClassified = null;     // Dados classificados
let _cachedDeviceCounts = null;   // Contagens por domínio
let _menuInstanceRef = null;      // Referência do Menu
let _headerInstanceRef = null;    // Referência do Header
```

**Problema Resolvido**: `onDataUpdated` pode disparar DURANTE operações async do `onInit`, causando perda de dados.

**Solução**: Registrar handlers no escopo do módulo ANTES de operações async:
```javascript
// ANTES de qualquer código async
window.addEventListener('myio:request-shoppings', () => {
  if (_menuInstanceRef) {
    _menuInstanceRef.updateShoppings?.(_cachedShoppings);
  }
});
```

### 4.2 Stores Globais (window objects)

| Store | Propósito |
|-------|-----------|
| `window.MyIOOrchestratorData` | Dados classificados e enriquecidos |
| `window.MyIOUtils` | Credenciais, auth, utilitários |
| `window.MyIOOrchestrator` | Métodos para obter dados por domínio/contexto |
| `window.custumersSelected` | Filtro atual (legado) |
| `window.STATE` | IDs de shoppings selecionados |

### 4.3 Cache de Dados com TTL

```javascript
const DATA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

_dataCache = {
  timestamp: Date.now(),
  enrichedData: { ... },
  isValid() { return (Date.now() - this.timestamp) < DATA_CACHE_TTL_MS; },
  set(data) { this.enrichedData = data; this.timestamp = Date.now(); },
  clear() { this.enrichedData = null; this.timestamp = 0; }
};
```

---

## 5. Dependências da MyIOLibrary

### 5.1 Criação de Componentes

| Função | Componente |
|--------|------------|
| `createWelcomeModalView()` | Modal de landing page |
| `createHeaderComponent()` | Header com KPIs |
| `createMenuComponent()` | Menu de navegação |
| `createTelemetryGridComponent()` | Grid de dispositivos |
| `createEnergyPanelComponent()` | Painel de energia |
| `createWaterPanelComponent()` | Painel de água |
| `createOperationalGeneralListComponent()` | Grid operacional |
| `createOperationalDashboardComponent()` | Dashboard operacional |
| `createAlarmsNotificationsPanelComponent()` | Painel de alarmes |
| `createFooterComponent()` | Footer de seleção |
| `createLoadingSpinner()` | Spinner de carregamento |

### 5.2 Processamento de Dados

| Função | Propósito |
|--------|-----------|
| `buildEquipmentCategoryDataForTooltip()` | Categorização RFC-0128 |
| `buildMyioIngestionAuth()` | Autenticação ingestion |
| `fetchThingsboardCustomerAttrsFromStorage()` | Atributos do cliente TB |
| `createLogHelper()` | Logging RFC-0122 |

### 5.3 Popups e Modais

| Função | Propósito |
|--------|-----------|
| `openDashboardPopupEnergy()` | Popup de consumo |
| `openDashboardPopupReport()` | Popup de relatório |
| `openDashboardPopupSettings()` | Popup de configurações |
| `openGoalsPanel()` | Painel de metas |
| `MyIOToast.success/error/warning()` | Notificações toast |

---

## 6. Estrutura de Dados

### 6.1 Dados Classificados

```javascript
classified = {
  energy: {
    equipments: [ { ...device, domain: 'energy', context: 'equipments' } ],
    stores: [ { ...device, domain: 'energy', context: 'stores' } ],
    entrada: [ { ...device, domain: 'energy', context: 'entrada' } ]
  },
  water: {
    hidrometro_entrada: [...],
    banheiros: [...],
    hidrometro_area_comum: [...],
    hidrometro: [...]
  },
  temperature: {
    termostato: [...],
    termostato_external: [...]
  }
}
```

### 6.2 Device Status Values

```javascript
ONLINE_STATUSES = ['power_on', 'online', 'normal', 'ok', 'running', 'active']
OFFLINE_STATUSES = ['offline', 'no_info']
WAITING_STATUSES = ['waiting', 'aguardando', 'not_installed', 'pending', 'connecting']
WEAK_STATUSES = ['weak_connection', 'conexao_fraca', 'bad']
```

### 6.3 Shopping Cards Format

```javascript
{
  title: 'Shopping Name',
  buttonId: 'ShoppingXXX',
  dashboardId: 'UUID',
  entityId: 'UUID',
  entityType: 'ASSET',
  customerId: null,
  deviceCounts: {
    energy: null,      // null = loading, number = loaded
    water: null,
    temperature: null
  }
}
```

---

## 7. Ciclo de Vida do Widget

### 7.1 self.onInit() - Sequência Completa

```
1. Limpa cache de módulo
2. Carrega referência MyIOLibrary
3. Inicializa LogHelper
4. Busca credenciais do ThingsBoard
5. Configura MyIOUtils globais
6. Verifica acesso a indicadores operacionais (RFC-0152)
7. Registra event handlers globais (antes de async)
8. Cria WelcomeModal
9. Cria HeaderComponent (aguarda data-ready)
10. Cria MenuComponent
11. Cria TelemetryGridComponent (com retry)
12. Cria FooterComponent
13. Registra event handlers restantes
14. setTimeout: processDataAndDispatchEvents()
15. setTimeout: enrichDevicesWithConsumption()
```

### 7.2 self.onDataUpdated() - Vazio por Design (RFC-0127)

```javascript
self.onDataUpdated = function () {
  // RFC-0127: intencionalmente vazio
  // Todo processamento feito em onInit via processDataAndDispatchEvents()
};
```

**Razão**: Evita loops infinitos e conflitos de timing com onInit.

---

## 8. Modos de Visualização

### 8.1 currentViewMode States

| Valor | Componente Ativo |
|-------|------------------|
| `'telemetry'` | TelemetryGridComponent |
| `'energy-panel'` | EnergyPanelComponent |
| `'water-panel'` | WaterPanelComponent |
| `'operational-grid'` | OperationalGridComponent |
| `'operational-dashboard'` | OperationalDashboardComponent |
| `'alarms-panel'` | AlarmsNotificationsPanelComponent |

### 8.2 Funções de Troca de View

```javascript
switchToTelemetryGrid(container, tabId, contextId, target)
  → Destrói: energyPanel, waterPanel, operationalGrid, operationalDashboard, alarmsPanel
  → Cria: TelemetryGridComponent

switchToEnergyPanel(container)
  → Destrói: telemetryGrid, waterPanel, operationalGrid
  → Cria: EnergyPanelComponent

switchToWaterPanel(container)
  → Destrói: telemetryGrid, energyPanel, operationalGrid
  → Cria: WaterPanelComponent

switchToOperationalGrid(container, contextId, target)
  → Destrói: telemetryGrid, energyPanel, waterPanel
  → Cria: OperationalGeneralListComponent

renderOperationalDashboard(container)
  → Destrói: todos via destroyAllPanels()
  → Cria: OperationalDashboardComponent

renderAlarmsNotificationsPanel(container)
  → Destrói: todos via destroyAllPanels()
  → Cria: AlarmsNotificationsPanelComponent
```

---

## 9. Pontos Críticos de Implementação

### 9.1 Gotchas

1. **onDataUpdated DEVE estar vazio** (RFC-0127)
   - Não adicionar lógica aqui
   - Usar processDataAndDispatchEvents() do onInit

2. **Listeners globais devem vir PRIMEIRO** (linhas 148-169)
   - Antes de código async
   - Captura eventos durante inicialização

3. **Alias 'AllDevices' obrigatório**
   - processDataAndDispatchEvents() filtra por `aliasName === 'AllDevices'`
   - Se configurado com nome diferente, dados não processados

4. **Null-check em referências de componentes**
   - Componentes podem ser destruídos e recriados
   - Sempre usar: `headerInstance?.setThemeMode?.(themeMode)`

5. **Estrutura de eventos deve ser consistente**
   - `myio:data-ready`: `{ classified, shoppingCards, deviceCounts, shoppings }`
   - `myio:energy-summary-ready`: `{ customerTotal, byStatus, byCategory, ... }`

### 9.2 Padrões Recomendados

```javascript
// Verificar MyIOLibrary antes de criar componentes
if (MyIOLibrary?.createHeaderComponent) {
  headerInstance = MyIOLibrary.createHeaderComponent({ ... });
}

// Usar retry com toast para dados assíncronos
retryGetDevicesWithToast(domain, context, maxRetries=5, intervalMs=3000);

// Despachar eventos após processamento
window.dispatchEvent(new CustomEvent('myio:energy-summary-ready', {
  detail: { customerTotal, byStatus, byCategory }
}));
```

---

## 10. Referências

| RFC | Descrição |
|-----|-----------|
| RFC-0113 | HeaderComponent - KPI cards |
| RFC-0114 | MenuComponent - Navegação |
| RFC-0115 | FooterComponent - Seleção |
| RFC-0121 | TelemetryGridComponent - Grid de dispositivos |
| RFC-0122 | LogHelper - Sistema de logging |
| RFC-0126 | Module-level caching para timing issues |
| RFC-0127 | onInit-based processing |
| RFC-0128 | Categorização de equipamentos de energia |
| RFC-0132 | EnergyPanelComponent |
| RFC-0133 | WaterPanelComponent |
| RFC-0137 | LoadingSpinner progressivo |
| RFC-0152 | Painéis operacionais (grid, dashboard, alarmes) |

---

*Documento gerado em: 2026-02-04*
*Versão: v5.2.0*
