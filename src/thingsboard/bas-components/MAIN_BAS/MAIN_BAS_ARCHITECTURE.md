# RFC-0158: MAIN_BAS Architecture

> Documento de arquitetura do widget BAS (Building Automation System) do ThingsBoard que orquestra o dashboard de automacao predial.

## 1. Visao Geral

O `MAIN_BAS` e o widget controlador do dashboard de automacao predial que:
- Recebe dados do ThingsBoard via datasources multiplas (agua, HVAC, motores)
- Classifica dispositivos por tipo (hidrometro, cisterna, tanque, solenoide, HVAC, motor/bomba)
- Gerencia tres paineis independentes: Sidebar (andares), Water (infraestrutura hidrica), Charts (graficos por dominio)
- Delega renderizacao HVAC/Motores ao componente `BASDashboardView` da MyIOLibrary
- Utiliza `renderCardComponentV6` para renderizacao de cards com `customStyle`
- Suporta temas (dark/light) e filtro por andar com sincronizacao entre paineis

### Localizacao
```
src/thingsboard/bas-components/MAIN_BAS/
├── controller.js              # Logica principal (679 linhas)
├── template.html              # Template HTML com 5 host slots (20 linhas)
├── styles.css                 # Layout skeleton + loading/error states (226 linhas)
├── settingsSchema.json        # Schema de configuracao do widget (165 linhas)
├── MAIN_BAS_ARCHITECTURE.md   # Este documento
├── BAS_Dashboard_UI_Alignment.md  # Alinhamento de UI (dark theme target)
└── feedback.md                # Notas de feedback

src/components/bas-dashboard/
├── index.ts                   # Factory function createBASDashboard() (114 linhas)
├── types.ts                   # Interfaces e tipos TypeScript (142 linhas)
├── BASDashboardController.ts  # Controller MVC (87 linhas)
├── BASDashboardView.ts        # View — renderiza HVAC + Motores com cards v6 (354 linhas)
└── styles.ts                  # CSS do dashboard injetado via JS (390 linhas)
```

---

## 2. Hierarquia de Componentes

```
MAIN_BAS (ThingsBoard Widget — controller.js)
│
├─ template.html (layout skeleton)
│  │
│  ├─ #bas-header            (reservado, vazio por enquanto)
│  │
│  └─ .bas-content-layout    (flexbox horizontal)
│     │
│     ├─ #bas-sidebar-host   ← EntityListPanel (andares)
│     │  ├─ Botao "Todos"
│     │  └─ Botao por andar (01o, 02o, ...)
│     │
│     └─ .bas-main-slot      (flexbox vertical)
│        │
│        ├─ #bas-water-host  ← CardGridPanel (dispositivos de agua)
│        │  └─ Grid de cards v6 (hidrometros, cisternas, tanques, solenoides)
│        │
│        ├─ #bas-charts-host ← Chart Tab Bar + Consumption7DaysChart
│        │  ├─ Tab: Energia (bar chart, kWh/MWh)
│        │  ├─ Tab: Agua (bar chart, L/m3)
│        │  └─ Tab: Temperatura (line chart preenchido, oC)
│        │
│        └─ #bas-main-content ← BASDashboardView (HVAC + Motores)
│           │
│           ├─ Right Panel
│           │  ├─ Ambientes (HVAC)
│           │  │  └─ Lista de cards v6 (termostatos com tooltip de range)
│           │  │
│           │  └─ Bombas e Motores
│           │     └─ Lista de cards v6 (bombas, motores)
│           │
│           └─ [Cada card usa renderCardComponentV6 com customStyle]
│
└─ Eventos globais (bas:floor-changed, bas:device-clicked)
```

### Separacao de Responsabilidades

O controller.js gerencia **tres paineis independentes** e delega apenas HVAC/Motores para o BASDashboardView:

| Painel | Host | Componente | Gerenciado por |
|--------|------|------------|----------------|
| Sidebar (andares) | `#bas-sidebar-host` | `EntityListPanel` | controller.js |
| Agua | `#bas-water-host` | `CardGridPanel` | controller.js |
| Graficos | `#bas-charts-host` | `Consumption7DaysChart` | controller.js |
| HVAC + Motores | `#bas-main-content` | `BASDashboardView` | MyIOLibrary |

> **Nota**: O `createBASDashboard()` recebe `showFloorsSidebar: false`, `showWaterInfrastructure: false`, `showCharts: false` para evitar duplicacao — esses paineis ja estao gerenciados pelo controller.

### Secoes Configuraveis
Cada secao pode ser ligada/desligada via widget settings:

| Setting | Secao | Default |
|---------|-------|---------|
| `showFloorsSidebar` | Sidebar de andares | `true` |
| `showWaterInfrastructure` | Grid de dispositivos de agua | `true` |
| `showEnvironments` | Painel de ambientes HVAC | `true` |
| `showPumpsMotors` | Painel de bombas e motores | `true` |
| `showCharts` | Area de graficos com tabs | `true` |

---

## 3. Fluxo de Dados

### 3.1 Inicializacao (onInit)

```
[ThingsBoard Widget Carrega]
         │
         ▼
[getSettings(ctx)]
  └─ Extrai configuracoes do widget (labels, cores, visibilidade, cardCustomStyle, sidebarBackgroundImage)
         │
         ▼
[Busca containers no DOM]
  ├─ #bas-dashboard-root
  ├─ #bas-sidebar-host
  ├─ #bas-water-host
  ├─ #bas-charts-host
  └─ #bas-main-content
         │
         ▼
[showLoading(mainContent)]
         │
         ▼
[initializeDashboard(ctx, mainContent, sidebarHost, waterHost, chartsHost, settings)]
  │
  ├─ Verifica MyIOLibrary.createBASDashboard disponivel
  │
  ├─ parseDevicesFromData(ctx.data)
  │  └─ Classifica dispositivos por aliasName → waterDevices, hvacDevices, motorDevices, floors
  │
  ├─ mountSidebarPanel(sidebarHost)
  │  └─ EntityListPanel com lista de andares + botao "Todos"
  │
  ├─ mountWaterPanel(waterHost)
  │  └─ CardGridPanel com waterDeviceToEntityObject() → cards v6
  │
  ├─ mountChartPanel(chartsHost)
  │  ├─ Tab bar (Energia | Agua | Temperatura)
  │  └─ switchChartDomain('energy') → createConsumption7DaysChart()
  │
  └─ MyIOLibrary.createBASDashboard(mainContent, { settings, hvacDevices, motorDevices, floors })
     └─ BASDashboardController → BASDashboardView → renderCardComponentV6
```

### 3.2 Atualizacao de Dados (onDataUpdated)

```
[ThingsBoard dispara onDataUpdated]
         │
         ▼
[Verifica _basInstance e _ctx existem]
         │
         ▼
[parseDevicesFromData(ctx.data)]
         │
         ▼
[Atualiza paineis independentes:]
  ├─ _floorListPanel.setItems() — se lista de andares mudou
  ├─ _waterPanel.setItems() — rebuilds water grid com filtro de andar ativo
  └─ _basInstance.updateData({ hvacDevices, motorDevices, floors })
         │
         ▼
[BASDashboardView re-renderiza grids afetados]
  ├─ renderHVACList() → renderCardComponentV6()
  └─ renderMotorsList() → renderCardComponentV6()
```

### 3.3 Diagrama de Fluxo de Eventos

```
┌─────────────────────────────────────────────────────────────────────┐
│                       INTERACAO DO USUARIO                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Usuario clica botao de andar na sidebar]                          │
│           │                                                         │
│           ▼                                                         │
│  [EntityListPanel.handleClickItem / handleClickAll]                 │
│           │                                                         │
│           ├─► _basInstance.setSelectedFloor(floor | null)           │
│           │   └─► BASDashboardView filtra HVAC + Motores            │
│           ├─► _waterPanel.setItems(filtered waterDevices)           │
│           ├─► panel.setSelectedId(floor)                            │
│           └─► window.dispatchEvent('bas:floor-changed', { floor })  │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  [Usuario clica em card de dispositivo]                             │
│           │                                                         │
│           ▼                                                         │
│  [handleClickCard() via renderCardComponentV6]                      │
│           │                                                         │
│           └─► window.dispatchEvent('bas:device-clicked', { device })│
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  [Usuario clica tab de grafico (Energia|Agua|Temperatura)]          │
│           │                                                         │
│           ▼                                                         │
│  [switchChartDomain(domain, chartContainer)]                        │
│           ├─► Destroi chart existente (_chartInstance.destroy())     │
│           ├─► Cria novo canvas (Chart.js precisa canvas fresh)      │
│           └─► createConsumption7DaysChart({ domain, config })       │
│               └─► .render()                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Classificacao de Dispositivos

### 4.1 Parser (parseDevicesFromData)

O controller.js classifica dispositivos pelo `aliasName` da datasource:

| Alias Pattern | Tipo Resultante | Categoria | Telemetry Keys |
|---------------|----------------|-----------|----------------|
| `hidrometro`, `water_meter` | `hydrometer` | Water | `consumption`, `value`, `active` |
| `cisterna`, `cistern` | `cistern` | Water | `level`, `percentage`, `active` |
| `caixa`, `tank` | `tank` | Water | `level`, `percentage`, `active` |
| `solenoide`, `solenoid` | `solenoid` | Water | `state`, `status` |
| `hvac`, `air`, `ambiente` | HVAC | HVAC | `temperature`, `consumption`, `power`, `active`, `setpoint` |
| `motor`, `pump`, `bomba` | `motor` ou `pump` | Motor | `consumption`, `power` |

> **Nota**: O `floor` e extraido do telemetry key `floor` ou do label do dispositivo via regex.

### 4.2 Mapeamento para Card v6

A `BASDashboardView` e o `waterDeviceToEntityObject` convertem dispositivos BAS para o formato `entityObject` do card v6:

| BAS Type | Card deviceType | Card Category |
|----------|----------------|---------------|
| `hydrometer` | `HIDROMETRO` | Water |
| `cistern` | `CAIXA_DAGUA` | Water |
| `tank` | `TANK` | Tank |
| `solenoid` | `BOMBA_HIDRAULICA` | Water |
| HVAC | `TERMOSTATO` | Temperature |
| `pump` | `BOMBA_HIDRAULICA` | Energy |
| `motor` | `MOTOR` | Energy |

### 4.3 Status Mapping

| BAS Status | Card Status (DeviceStatusType) |
|------------|-------------------------------|
| `online` / `active` / `running` | `online` (water) / `power_on` (HVAC, motor) |
| `offline` / `inactive` / `stopped` | `offline` |
| `unknown` / `no_reading` | `no_info` |

---

## 5. Graficos (Chart Management)

O controller.js gerencia graficos independentemente do BASDashboardView, montando-os diretamente no `#bas-charts-host`.

### 5.1 Configuracao por Dominio

```javascript
CHART_DOMAIN_CONFIG = {
  energy:      { unit: 'kWh', unitLarge: 'MWh', threshold: 10000, label: 'Energia' },
  water:       { unit: 'L',   unitLarge: 'm3',  threshold: 1000,  label: 'Agua' },
  temperature: { unit: 'oC',  unitLarge: 'oC',  threshold: 999,   label: 'Temperatura' },
};
```

### 5.2 Troca de Dominio (switchChartDomain)

```
1. Destroi _chartInstance existente
2. Limpa innerHTML do chartContainer
3. Cria novo <canvas> element (Chart.js requer canvas fresco)
4. Cria novo createConsumption7DaysChart() com config do dominio
5. Chama .render()
```

| Dominio | Tipo de Chart | Fill | Periodo Default |
|---------|--------------|------|-----------------|
| `energy` | bar | false | 7 dias |
| `water` | bar | false | 7 dias |
| `temperature` | line | true | 7 dias |

> **Nota**: Atualmente usa `createMockFetchData()` com dados aleatorios. Substituir por fetch real quando API estiver disponivel.

---

## 6. Template Card v6 (customStyle)

O BAS dashboard utiliza `renderCardComponentV6` que aceita um parametro `customStyle` para personalizar a aparencia dos cards:

```javascript
renderCardComponentV6({
  entityObject,
  handleClickCard: () => onDeviceClick(device),
  enableSelection: false,
  enableDragDrop: false,
  customStyle: {
    fontSize: '14px',
    backgroundColor: '#1a1a2e',
    fontColor: '#ffffff',
    width: '240px',
    height: '160px',
  },
});
```

### Propriedades do customStyle

| Propriedade | Alvo | Exemplo |
|-------------|------|---------|
| `fontSize` | Titulo, subtitulo, valor, badge (escala proporcional) | `'14px'`, `'0.9rem'` |
| `backgroundColor` | Background do card (sobrescreve gradiente) | `'#1e293b'` |
| `fontColor` | Titulo, subtitulo, valor, badge de porcentagem | `'#fff'` |
| `width` | Container externo + card interno | `'300px'`, `'100%'` |
| `height` | Container + min-height do card | `'180px'` |

O `cardCustomStyle` e configuravel via `widgetSettings.cardCustomStyle` no ThingsBoard.

---

## 7. Estrutura de Dados

### 7.1 WaterDevice

```typescript
interface WaterDevice {
  id: string;
  name: string;
  type: 'hydrometer' | 'cistern' | 'tank' | 'solenoid';
  floor?: string | null;
  value: number;       // consumo (m3), nivel (%), ou estado (0|1)
  unit: string;        // 'm3', '%', ''
  status: 'online' | 'offline' | 'unknown';
  lastUpdate: number;
}
```

### 7.2 HVACDevice

```typescript
interface HVACDevice {
  id: string;
  name: string;
  floor: string;
  temperature: number | null;
  consumption: number | null;
  status: 'active' | 'inactive' | 'no_reading';
  setpoint?: number | null;
}
```

### 7.3 MotorDevice

```typescript
interface MotorDevice {
  id: string;
  name: string;
  floor?: string | null;
  consumption: number;
  status: 'running' | 'stopped' | 'unknown';
  type: 'pump' | 'motor' | 'other';
}
```

---

## 8. Ciclo de Vida do Widget

### 8.1 self.onInit()

```
1. Salva referencia do contexto (_ctx) e settings (_settings)
2. Busca containers no DOM:
   - #bas-dashboard-root (raiz)
   - #bas-sidebar-host (sidebar)
   - #bas-water-host (agua)
   - #bas-charts-host (graficos)
   - #bas-main-content (HVAC + motores)
3. Mostra loading spinner em #bas-main-content
4. Chama initializeDashboard():
   a. Verifica MyIOLibrary.createBASDashboard disponivel
   b. Parseia dados das datasources
   c. Monta EntityListPanel (sidebar)
   d. Monta CardGridPanel (agua)
   e. Monta chart tab bar + chart (graficos)
   f. Cria BASDashboard (HVAC + motores) com settings ajustados
   g. Salva referencia em _basInstance
```

### 8.2 self.onDataUpdated()

```
1. Verifica _basInstance e _ctx existem
2. Parseia novos dados com parseDevicesFromData()
3. Atualiza sidebar se lista de andares mudou
4. Atualiza water panel com novos dispositivos
5. Chama _basInstance.updateData() com hvac + motores + floors
   → View re-renderiza grids afetados
```

### 8.3 self.onResize()

```
1. Chama _basInstance.resize() se disponivel
   → Charts e paineis serao redimensionados
```

### 8.4 self.onDestroy()

```
1. Destroi _chartInstance
2. Destroi _floorListPanel
3. Destroi _waterPanel
4. Destroi _basInstance → View remove root do DOM
5. Limpa todas as referencias:
   _chartInstance, _currentChartDomain, _floorListPanel,
   _waterPanel, _basInstance, _ctx, _settings,
   _currentFloors, _currentWaterDevices = null/[]
```

### 8.5 self.typeParameters()

```javascript
{
  maxDatasources: -1,       // ilimitadas
  maxDataKeys: -1,          // ilimitadas
  singleEntity: false,      // multiplas entidades
  hasDataPageLink: false,
  warnOnPageDataOverflow: false,
  dataKeysOptional: true,   // nao obriga data keys
}
```

---

## 9. Variaveis Module-Level

```javascript
_basInstance            // BASDashboardController instance
_floorListPanel         // EntityListPanel (floors sidebar)
_waterPanel             // CardGridPanel (water devices)
_chartInstance          // Consumption7DaysChart (chart ativo)
_currentChartDomain     // 'energy' | 'water' | 'temperature' (default: 'energy')
_ctx                    // ThingsBoard context
_settings               // Widget configuration (getSettings result)
_currentFloors          // Array<string> — lista de andares atuais
_currentWaterDevices    // Array<WaterDevice> — dispositivos de agua atuais
```

---

## 10. Configuracoes do Widget (settingsSchema.json)

### 10.1 Grupos de Configuracao

| Grupo | Settings |
|-------|----------|
| **Geral** | `enableDebugMode`, `defaultThemeMode` |
| **Labels** | `dashboardTitle`, `floorsLabel`, `environmentsLabel`, `pumpsMotorsLabel`, `temperatureChartTitle`, `consumptionChartTitle` |
| **Visibilidade** | `showFloorsSidebar`, `showWaterInfrastructure`, `showEnvironments`, `showPumpsMotors`, `showCharts` |
| **Cores** | `primaryColor`, `warningColor`, `errorColor`, `successColor` |
| **Cards** | `cardCustomStyle` (fontSize, backgroundColor, fontColor, width, height) |
| **Extra** | `sidebarBackgroundImage` (imagem de fundo da sidebar) |

### 10.2 Temas

O dashboard suporta dois temas via CSS classes:
- **Dark** (padrao visual): `bas-dashboard` (sem modificador)
- **Light**: `bas-dashboard--light`

Cores tematicas sao aplicadas via CSS custom properties:
```css
/* Dark theme (default) */
--bas-bg-main: #0B1220;
--bas-bg-panel: #101A2B;
--bas-bg-card: #FFFFFF;
--bas-border-subtle: rgba(255, 255, 255, 0.10);
--bas-text-primary: rgba(255, 255, 255, 0.92);
--bas-text-muted: rgba(255, 255, 255, 0.60);
--bas-primary-color: #2F5848;
--bas-warning-color: #f57c00;
--bas-error-color: #c62828;
--bas-success-color: #2e7d32;
```

---

## 11. Eventos Globais

### 11.1 Eventos Emitidos

| Evento | Disparado Por | Payload |
|--------|--------------|---------|
| `bas:floor-changed` | Selecao de andar (sidebar ou dashboard) | `{ floor: string \| null }` |
| `bas:device-clicked` | Click em card de dispositivo (agua, HVAC, motor) | `{ device: WaterDevice \| HVACDevice \| MotorDevice }` |

### 11.2 Uso por Widgets Externos

```javascript
// Escutar mudanca de andar
window.addEventListener('bas:floor-changed', (e) => {
  console.log('Andar selecionado:', e.detail.floor);
});

// Escutar click em dispositivo
window.addEventListener('bas:device-clicked', (e) => {
  console.log('Dispositivo:', e.detail.device);
});
```

---

## 12. Layout CSS (styles.css)

### 12.1 Estrutura de Layout

```
.bas-dashboard-container (flex column, 100% x 100%, bg: #0B1220)
│
├─ .bas-header (flex-shrink: 0)
│
└─ .bas-content-layout (flex row, flex: 1)
   │
   ├─ .bas-sidebar-slot (width: 220px, flex-shrink: 0, padding: 12px)
   │  └─ .myio-elp (flex: 1, EntityListPanel fills slot)
   │
   └─ .bas-main-slot (flex: 1, flex column)
      │
      ├─ .bas-water-slot (flex-shrink: 0, padding: 12px 18px)
      │  └─ .myio-cgp (max-height: 260px)
      │
      ├─ .bas-charts-slot (flex-shrink: 0, padding: 0 18px 12px)
      │  ├─ .bas-chart-tabs (flex row, tab bar)
      │  │  └─ .bas-chart-tab / .bas-chart-tab--active
      │  └─ .bas-chart-card (bg: #FFF, border-radius: 16px, min-height: 280px)
      │     └─ canvas (100% width, max-height: 260px)
      │
      └─ .bas-dashboard-slot (flex: 1, overflow: hidden)
         └─ .bas-dashboard (height: 100%)
```

### 12.2 Responsivo

| Breakpoint | Comportamento |
|------------|--------------|
| > 900px | Layout horizontal: sidebar (220px) + main slot |
| <= 900px | Layout vertical: sidebar em cima (max-height: 280px), main slot abaixo |

---

## 13. Dependencias da MyIOLibrary

### 13.1 Componentes Utilizados

| Funcao/Classe | Fonte | Proposito |
|---------------|-------|-----------|
| `createBASDashboard()` | `src/components/bas-dashboard/index.ts` | Factory do dashboard (HVAC + Motores) |
| `BASDashboardController` | `src/components/bas-dashboard/BASDashboardController.ts` | Controller MVC |
| `BASDashboardView` | `src/components/bas-dashboard/BASDashboardView.ts` | View — renderiza HVAC + Motores |
| `renderCardComponentV6()` | `src/components/template-card-v6/template-card-v6.js` | Renderizacao de cards com customStyle |
| `EntityListPanel` | `src/components/entity-list-panel/` | Sidebar de andares com busca e selecao |
| `CardGridPanel` | `src/components/card-grid-panel/` | Grid responsivo de cards para agua |
| `createConsumption7DaysChart()` | `src/components/charts/` | Grafico de consumo 7 dias |

### 13.2 Cadeia de Dependencia

```
controller.js
  │
  ├─ MyIOLibrary.EntityListPanel
  │  └─ Sidebar de andares (search, select, "Todos")
  │
  ├─ MyIOLibrary.CardGridPanel
  │  └─ Grid de cards de agua → renderCardComponentV6
  │
  ├─ MyIOLibrary.createConsumption7DaysChart
  │  └─ Chart.js (bar/line por dominio)
  │
  └─ MyIOLibrary.createBASDashboard()
       └─ BASDashboardController
            └─ BASDashboardView
                 └─ renderCardComponentV6()
                      └─ renderCardComponentV5()  (delegacao interna)
                           ├─ MyIOSelectionStore
                           ├─ MyIODraggableCard
                           ├─ formatEnergy()
                           ├─ deviceStatus utils
                           ├─ TempRangeTooltip
                           ├─ EnergyRangeTooltip
                           ├─ DeviceComparisonTooltip
                           └─ TempComparisonTooltip
```

---

## 14. Pontos Criticos de Implementacao

### 14.1 Gotchas

1. **MyIOLibrary deve estar carregada** antes do `onInit`
   - O controller verifica `typeof MyIOLibrary === 'undefined'`
   - Se nao disponivel, mostra erro no container

2. **parseDevicesFromData depende de aliasName**
   - Dispositivos classificados pelo nome do alias da datasource
   - Alias deve conter keywords (ex: `hidrometro`, `hvac`, `motor`)
   - Alias nao reconhecido = dispositivo ignorado silenciosamente

3. **Andares extraidos do label ou atributo `floor`**
   - `extractFloorFromLabel()` busca pattern numerico no nome
   - Padrao regex: `/(\d+)|andar\s*(\d+)|floor\s*(\d+)/i`
   - Exemplos: "01o andar" → "01", "Floor 02" → "02"

4. **Cards sem action buttons no BAS**
   - `handleActionDashboard`, `handleActionReport`, `handleActionSettings` = `undefined`
   - Selection e drag-drop desabilitados (`enableSelection: false`, `enableDragDrop: false`)
   - Apenas `handleClickCard` ativo para emitir `bas:device-clicked`

5. **customStyle e opcional**
   - Se `cardCustomStyle` nao definido no widget settings, cards usam estilo padrao do v5
   - `customStyle: this.settings.cardCustomStyle || undefined`

6. **Chart precisa de canvas fresco**
   - `switchChartDomain()` destroi o chart antigo e cria um novo `<canvas>` element
   - Chart.js nao permite reutilizar canvas apos destroy

7. **Tres paineis gerenciados separadamente**
   - Sidebar, Water e Charts sao gerenciados pelo controller.js
   - BASDashboardView so gerencia HVAC e Motores
   - O `createBASDashboard` recebe flags `false` para evitar duplicacao

8. **Dados de graficos sao mock**
   - `createMockFetchData()` gera dados aleatorios
   - Deve ser substituido por fetch real quando API estiver disponivel

### 14.2 Padroes Recomendados

```javascript
// Verificar instancia antes de atualizar
if (_basInstance && _basInstance.updateData) {
  _basInstance.updateData({ ... });
}

// Usar cardCustomStyle para personalizar cards no widget settings
{
  "cardCustomStyle": {
    "fontSize": "13px",
    "backgroundColor": "#1a1a2e",
    "fontColor": "#e0e0e0",
    "width": "220px",
    "height": "150px"
  }
}

// Configurar imagem de fundo da sidebar
{
  "sidebarBackgroundImage": "url_da_imagem"
}
```

---

## 15. Referencia de Arquivos

| Arquivo | Linhas | Descricao |
|---------|--------|-----------|
| `controller.js` | 679 | Widget controller — lifecycle + parsing + panels + charts |
| `template.html` | 20 | Layout com 5 host slots (header, sidebar, water, charts, main) |
| `styles.css` | 226 | Layout skeleton, chart tabs, loading/error states, responsivo |
| `settingsSchema.json` | 165 | Schema de configuracao do ThingsBoard (4 grupos) |
| `BASDashboardController.ts` | 87 | MVC Controller — delega para View |
| `BASDashboardView.ts` | 354 | MVC View — renderiza HVAC + Motores com cards v6 |
| `types.ts` | 142 | Interfaces TypeScript (WaterDevice, HVACDevice, MotorDevice, etc) |
| `styles.ts` | 390 | CSS do dashboard injetado via JS (dark/light themes, responsivo) |
| `index.ts` | 114 | Factory function createBASDashboard() + type exports |

---

## 16. Referencias

| RFC | Descricao |
|-----|-----------|
| RFC-0158 | Building Automation System (BAS) Dashboard |
| RFC-0130 | Tooltips de range (temperatura, energia, comparacao) |
| RFC-0108 | Formatacao inteligente (MyIOUtils measurement settings) |
| RFC-0111 | Classificacao de dominio/contexto de dispositivos |

---

*Documento atualizado em: 2026-02-05*
*Versao: v6.1.0 (template-card-v6 com customStyle + chart tabs + 5-slot template)*
