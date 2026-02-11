# RFC-0158: MAIN_BAS Architecture

> Documento de arquitetura do widget BAS (Building Automation System) do ThingsBoard que orquestra o dashboard de automacao predial.

---

## Sumario de Documentos de Arquitetura

Este documento faz parte de um conjunto de documentos que descrevem a arquitetura do MAIN_BAS:

| Documento | Descricao |
| --------- | --------- |
| [MAIN_BAS_ARCHITECTURE.md](./MAIN_BAS_ARCHITECTURE.md) | Arquitetura geral do widget BAS (este documento) |
| [CARD_V6_ARCHITECTURE.md](./CARD_V6_ARCHITECTURE.md) | Arquitetura do `renderCardComponentV6` - cards de dispositivos individuais |
| [CARD_AMBIENTE_V6_ARCHITECTURE.md](./CARD_AMBIENTE_V6_ARCHITECTURE.md) | Arquitetura do `renderCardAmbienteV6` - cards de ambientes agregados |
| [BAS_Dashboard_UI_Alignment.md](./BAS_Dashboard_UI_Alignment.md) | Alinhamento visual e dark theme |

### Componentes de Card

O MAIN_BAS utiliza dois tipos de cards V6:

1. **Card V6 (Dispositivo)** - `renderCardComponentV6()`
   - Para dispositivos individuais (medidores, bombas, termostatos)
   - Suporta multiplas categorias: energy, water, tank, temperature
   - CustomStyle para personalizacao visual
   - [Ver documentacao completa](./CARD_V6_ARCHITECTURE.md)

2. **Card Ambiente V6** - `renderCardAmbienteV6()`
   - Para ambientes com multiplos dispositivos agregados
   - Exibe temperatura + consumo + controle remoto
   - Badge de contagem de dispositivos
   - [Ver documentacao completa](./CARD_AMBIENTE_V6_ARCHITECTURE.md)

---

## 1. Visao Geral

O `MAIN_BAS` e o widget controlador do dashboard de automacao predial que:

- Recebe dados do ThingsBoard via datasources multiplas (agua, HVAC, motores)
- Classifica dispositivos por tipo (hidrometro, cisterna, tanque, solenoide, HVAC, motor/bomba)
- Gerencia tres paineis independentes: Sidebar (andares), Water (infraestrutura hidrica), Charts (graficos por dominio)
- Delega renderizacao HVAC/Motores ao componente `BASDashboardView` da MyIOLibrary (modo panels-only)
- Utiliza `renderCardComponentV6` para renderizacao de cards com `customStyle`
- Suporta temas (dark/light) e filtro por andar com sincronizacao entre paineis

### Localizacao

```
src/thingsboard/bas-components/MAIN_BAS/
├── controller.js              # Logica principal (681 linhas)
├── template.html              # Template HTML — CSS Grid com 4 slots (19 linhas)
├── styles.css                 # Layout CSS Grid + chart tabs + loading/error + responsivo (266 linhas)
├── settingsSchema.json        # Schema de configuracao do widget (165 linhas)
├── MAIN_BAS_ARCHITECTURE.md   # Este documento
├── BAS_Dashboard_UI_Alignment.md  # Alinhamento de UI (dark theme target)
└── feedback.md                # Notas de feedback

src/components/bas-dashboard/
├── index.ts                   # Factory function createBASDashboard() (113 linhas)
├── types.ts                   # Interfaces e tipos TypeScript (141 linhas)
├── BASDashboardController.ts  # Controller MVC (86 linhas)
├── BASDashboardView.ts        # View — renderiza HVAC + Motores com cards v6 + panels-only mode (368 linhas)
└── styles.ts                  # CSS do dashboard injetado via JS (400 linhas)
```

---

## 2. Hierarquia de Componentes

```
MAIN_BAS (ThingsBoard Widget — controller.js)
│
├─ template.html (layout skeleton — CSS Grid 4 cols × 2 rows)
│  │
│  ├─ #bas-header            (reservado, vazio por enquanto)
│  │
│  └─ .bas-content-layout    (CSS Grid: 20% | 40% | 20% | 20%)
│     │
│     ├─ #bas-sidebar-host   (col 1, row 1)     ← EntityListPanel (andares)
│     │  ├─ Botao "Todos"
│     │  └─ Botao por andar (01o, 02o, ...)
│     │
│     ├─ #bas-water-host     (col 2, row 1)     ← CardGridPanel (dispositivos de agua)
│     │  └─ Grid de cards v6 (hidrometros, cisternas, tanques, solenoides)
│     │
│     ├─ #bas-charts-host    (col 1–2, row 2)   ← Tab bar + Consumption7DaysChart
│     │  ├─ Tab: Energia (bar chart, kWh/MWh)
│     │  ├─ Tab: Agua (bar chart, L/m3)
│     │  └─ Tab: Temperatura (line chart preenchido, oC)
│     │
│     └─ #bas-main-content   (col 3–4, row 1–2) ← BASDashboardView (panels-only mode)
│        │
│        └─ Right Panel (100% width — panels-only mode removes header/main area)
│           ├─ Ambientes (HVAC)
│           │  └─ Lista de cards v6 (termostatos com tooltip de range)
│           │
│           └─ Bombas e Motores
│              └─ Lista de cards v6 (bombas, motores)
│
└─ Eventos globais (bas:floor-changed, bas:device-clicked)
```

### Layout Visual (target.design.txt)

```
  ┌────────────────────────┬────────────────────────┬───────────────┬──────────────┐
  │ EntityList             │ Water cards            │               │              │
  │ (50% height 20% width) │ (50% height 40% width) │ Ambientes     │ Bombas e     │
  ├────────────────────────┤────────────────────────│ (100% height  │ Motores      │
  │ [E] [A] [T]                                     │  20% width)   │ (100% height │
  │ Chart                                           │               │  20% width)  │
  │ (50% height 60% width)                          │               │              │
  └─────────────────────────────────────────────────┴───────────────┴──────────────┘
  |  20% width             |       40%              |      20%      |      20%     |
```

### Expected Layout

```
┌─────────────────┬─────────────────────────┬───────────────┬───────────────┐
│ Ambientes       │ INFRAESTRUTURA HIDRICA  │ Ambientes     │ Bombas e      │
│ ───────────     │ ─────────────────────   │ (HVAC)        │ Motores       │
│ Nome ↑          │ ┌─────┐ ┌─────┐ ┌─────┐ │ ───────────   │ ───────────   │
│                 │ │Hidr.│ │Hidr.│ │Hidr.│ │ ┌─────┐       │ ┌─────┐       │
│ ○ Água          │ │Reuso│ │Pipa │ │Irrig│ │ │Temp.│       │ │DM4  │       │
│ ○ Auditório     │ └─────┘ └─────┘ └─────┘ │ │RJ 1 │       │ │B7R  │       │
│ ○ Bombas        │ ┌─────┐                 │ └─────┘       │ └─────┘       │
│ ○ Configuração  │ │Hidr.│                 │ ┌─────┐       │ ┌─────┐       │
│ ○ Deck          │ │Sabes│                 │ │Temp.│       │ │DM3  │       │
│ ○ Integrações   │ └─────┘                 │ │RJ 2 │       │ │B7   │       │
│ ○ Sala Nobreak  │                         │ └─────┘       │ └─────┘       │
│ ○ Staff RJ      │                         │               │               │
├─────────────────┴─────────────────────────┤               │               │
│ [Energia] [Água] [Temperatura]            │               │               │
│ ┌───────────────────────────────────────┐ │               │               │
│ │         📊 Chart (7 dias)             │ │               │               │
│ │         Bar chart kWh                 │ │               │               │
│ └───────────────────────────────────────┘ │               │               │
└───────────────────────────────────────────┴───────────────┴───────────────┘
  20% width           40% width               20% width       20% width
```

### Separacao de Responsabilidades

O controller.js gerencia **tres paineis independentes** e delega apenas HVAC/Motores para o BASDashboardView:

| Painel            | Host                | Componente              | Gerenciado por |
| ----------------- | ------------------- | ----------------------- | -------------- |
| Sidebar (andares) | `#bas-sidebar-host` | `EntityListPanel`       | controller.js  |
| Agua              | `#bas-water-host`   | `CardGridPanel`         | controller.js  |
| Graficos          | `#bas-charts-host`  | `Consumption7DaysChart` | controller.js  |
| HVAC + Motores    | `#bas-main-content` | `BASDashboardView`      | MyIOLibrary    |

> **Nota**: O `createBASDashboard()` recebe `showFloorsSidebar: false`, `showWaterInfrastructure: false`, `showCharts: false` para evitar duplicacao — esses paineis ja estao gerenciados pelo controller. Isso ativa o **panels-only mode** do BASDashboardView (ver secao 15).

### Secoes Configuraveis

Cada secao pode ser ligada/desligada via widget settings:

| Setting                   | Secao                        | Default |
| ------------------------- | ---------------------------- | ------- |
| `showFloorsSidebar`       | Sidebar de andares           | `true`  |
| `showWaterInfrastructure` | Grid de dispositivos de agua | `true`  |
| `showEnvironments`        | Painel de ambientes HVAC     | `true`  |
| `showPumpsMotors`         | Painel de bombas e motores   | `true`  |
| `showCharts`              | Area de graficos com tabs    | `true`  |

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
[Busca containers no DOM via CSS Grid slots]
  ├─ #bas-dashboard-root
  ├─ #bas-sidebar-host   (col 1, row 1)
  ├─ #bas-water-host     (col 2, row 1)
  ├─ #bas-charts-host    (col 1–2, row 2)
  └─ #bas-main-content   (col 3–4, row 1–2)
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
  └─ MyIOLibrary.createBASDashboard(mainContent, {
       settings: { ...settings, showFloorsSidebar: false, showWaterInfrastructure: false, showCharts: false },
       hvacDevices, motorDevices, floors
     })
     └─ BASDashboardController → BASDashboardView (panels-only mode) → renderCardComponentV6
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

| Alias Pattern               | Tipo Resultante   | Categoria | Telemetry Keys                                              |
| --------------------------- | ----------------- | --------- | ----------------------------------------------------------- |
| `hidrometro`, `water_meter` | `hydrometer`      | Water     | `consumption`, `value`, `active`                            |
| `cisterna`, `cistern`       | `cistern`         | Water     | `level`, `percentage`, `active`                             |
| `caixa`, `tank`             | `tank`            | Water     | `level`, `percentage`, `active`                             |
| `solenoide`, `solenoid`     | `solenoid`        | Water     | `state`, `status`                                           |
| `hvac`, `air`, `ambiente`   | HVAC              | HVAC      | `temperature`, `consumption`, `power`, `active`, `setpoint` |
| `motor`, `pump`, `bomba`    | `motor` ou `pump` | Motor     | `consumption`, `power`                                      |

> **Nota**: O `floor` e extraido do telemetry key `floor` ou do label do dispositivo via regex.

### 4.1.1 Validacao de Energy Devices (RFC-0171)

O domain `energy` nao e mais usado como default. Dispositivos so sao classificados como energy se passarem na validacao:

```javascript
// Usa deviceProfile como fonte primaria (mais confiavel que deviceType)
var effectiveType = deviceProfile || deviceType;
var domain = MyIOLibrary.getDomainFromDeviceType(effectiveType);

// Se domain === 'energy', valida antes de incluir
if (domain === 'energy') {
  var isValidEnergy = MyIOLibrary.isEnergyDevice(deviceProfile);
  var isMotorPump = deviceProfile.includes('BOMBA') || deviceProfile.includes('MOTOR');
  var isEntrada = deviceProfile.includes('ENTRADA') || deviceProfile.includes('TRAFO');

  if (!isValidEnergy && !isMotorPump && !isEntrada) {
    // Skip - dispositivo ignorado (nao e energy valido)
    return;
  }
}
```

**Dispositivos aceitos como energy:**
- `3F_MEDIDOR` ou qualquer deviceProfile contendo `3F` ou `MEDIDOR`
- `BOMBA`, `MOTOR` (bombas e motores)
- `ENTRADA`, `RELOGIO`, `TRAFO`, `SUBESTACAO` (medidores de entrada)

### 4.2 Mapeamento para Card v6

A `BASDashboardView` e o `waterDeviceToEntityObject` convertem dispositivos BAS para o formato `entityObject` do card v6:

| BAS Type     | Card deviceType    | Card Category |
| ------------ | ------------------ | ------------- |
| `hydrometer` | `HIDROMETRO`       | Water         |
| `cistern`    | `CAIXA_DAGUA`      | Water         |
| `tank`       | `TANK`             | Tank          |
| `solenoid`   | `BOMBA_HIDRAULICA` | Water         |
| HVAC         | `TERMOSTATO`       | Temperature   |
| `pump`       | `BOMBA_HIDRAULICA` | Energy        |
| `motor`      | `MOTOR`            | Energy        |

### 4.3 Status Mapping

| BAS Status                         | Card Status (DeviceStatusType)              |
| ---------------------------------- | ------------------------------------------- |
| `online` / `active` / `running`    | `online` (water) / `power_on` (HVAC, motor) |
| `offline` / `inactive` / `stopped` | `offline`                                   |
| `unknown` / `no_reading`           | `no_info`                                   |

---

## 5. Graficos (Chart Management)

O controller.js gerencia graficos independentemente do BASDashboardView, montando-os diretamente no `#bas-charts-host` (col 1–2, row 2 do CSS Grid).

### 5.1 Configuracao por Dominio

```javascript
CHART_DOMAIN_CONFIG = {
  energy: { unit: 'kWh', unitLarge: 'MWh', threshold: 10000, label: 'Energia' },
  water: { unit: 'L', unitLarge: 'm3', threshold: 1000, label: 'Agua' },
  temperature: { unit: 'oC', unitLarge: 'oC', threshold: 999, label: 'Temperatura' },
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

| Dominio       | Tipo de Chart | Fill  | Periodo Default |
| ------------- | ------------- | ----- | --------------- |
| `energy`      | bar           | false | 7 dias          |
| `water`       | bar           | false | 7 dias          |
| `temperature` | line          | true  | 7 dias          |

### 5.3 Formato de Dados (fetchData)

O componente `createConsumption7DaysChart` espera que `fetchData` retorne o formato `Consumption7DaysData`:

```javascript
// Formato CORRETO — usado pelo componente internamente via data.dailyTotals
{
  labels: ['01/02', '02/02', '03/02', ...],  // string[]
  dailyTotals: [450.2, 320.1, 510.8, ...],   // number[]
}
```

> **IMPORTANTE**: O campo correto e `dailyTotals` (nao `datasets`). O componente acessa `data.dailyTotals` diretamente em `buildChartConfig()` e `getDisplayedValues()`.

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

| Propriedade       | Alvo                                                  | Exemplo              |
| ----------------- | ----------------------------------------------------- | -------------------- |
| `fontSize`        | Titulo, subtitulo, valor, badge (escala proporcional) | `'14px'`, `'0.9rem'` |
| `backgroundColor` | Background do card (sobrescreve gradiente)            | `'#1e293b'`          |
| `fontColor`       | Titulo, subtitulo, valor, badge de porcentagem        | `'#fff'`             |
| `width`           | Container externo + card interno                      | `'300px'`, `'100%'`  |
| `height`          | Container + min-height do card                        | `'180px'`            |

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
  value: number; // consumo (m3), nivel (%), ou estado (0|1)
  unit: string; // 'm3', '%', ''
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
2. Busca containers no DOM (CSS Grid slots):
   - #bas-dashboard-root (raiz)
   - #bas-sidebar-host (col 1, row 1)
   - #bas-water-host (col 2, row 1)
   - #bas-charts-host (col 1–2, row 2)
   - #bas-main-content (col 3–4, row 1–2)
3. Mostra loading spinner em #bas-main-content
4. Chama initializeDashboard():
   a. Verifica MyIOLibrary.createBASDashboard disponivel
   b. Parseia dados das datasources
   c. Monta EntityListPanel (sidebar)
   d. Monta CardGridPanel (agua)
   e. Monta chart tab bar + chart (graficos)
   f. Cria BASDashboard (HVAC + motores) com settings ajustados (panels-only)
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
_basInstance; // BASDashboardController instance
_floorListPanel; // EntityListPanel (floors sidebar)
_waterPanel; // CardGridPanel (water devices)
_chartInstance; // Consumption7DaysChart (chart ativo)
_currentChartDomain; // 'energy' | 'water' | 'temperature' (default: 'energy')
_ctx; // ThingsBoard context
_settings; // Widget configuration (getSettings result)
_currentFloors; // Array<string> — lista de andares atuais
_currentWaterDevices; // Array<WaterDevice> — dispositivos de agua atuais
```

---

## 10. Configuracoes do Widget (settingsSchema.json)

### 10.1 Grupos de Configuracao

| Grupo            | Settings                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Geral**        | `enableDebugMode`, `defaultThemeMode`                                                                                      |
| **Labels**       | `dashboardTitle`, `floorsLabel`, `environmentsLabel`, `pumpsMotorsLabel`, `temperatureChartTitle`, `consumptionChartTitle` |
| **Visibilidade** | `showFloorsSidebar`, `showWaterInfrastructure`, `showEnvironments`, `showPumpsMotors`, `showCharts`                        |
| **Cores**        | `primaryColor`, `warningColor`, `errorColor`, `successColor`                                                               |
| **Cards**        | `cardCustomStyle` (fontSize, backgroundColor, fontColor, width, height)                                                    |
| **Extra**        | `sidebarBackgroundImage` (imagem de fundo da sidebar)                                                                      |

### 10.2 Temas

O dashboard suporta dois temas via CSS classes:

- **Dark** (padrao visual): `bas-dashboard` (sem modificador)
- **Light**: `bas-dashboard--light`

Cores tematicas sao aplicadas via CSS custom properties:

```css
/* Dark theme (default) */
--bas-bg-main: #0b1220;
--bas-bg-panel: #101a2b;
--bas-bg-card: #ffffff;
--bas-border-subtle: rgba(255, 255, 255, 0.1);
--bas-text-primary: rgba(255, 255, 255, 0.92);
--bas-text-muted: rgba(255, 255, 255, 0.6);
--bas-primary-color: #2f5848;
--bas-warning-color: #f57c00;
--bas-error-color: #c62828;
--bas-success-color: #2e7d32;
```

---

## 11. Eventos Globais

### 11.1 Eventos Emitidos

| Evento               | Disparado Por                                    | Payload                                                |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `bas:floor-changed`  | Selecao de andar (sidebar ou dashboard)          | `{ floor: string \| null }`                            |
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

## 12. Layout CSS (styles.css) — CSS Grid

### 12.1 Estrutura de Layout

O layout utiliza **CSS Grid** com 4 colunas e 2 linhas, conforme especificado em `logs/target.design.txt`:

```
.bas-dashboard-container (flex column, 100% × 100%, bg: #0B1220)
│
├─ .bas-header (flex-shrink: 0, reservado)
│
└─ .bas-content-layout (CSS Grid)
   │  grid-template-columns: 20% 40% 20% 20%
   │  grid-template-rows: 50% 50%
   │
   ├─ .bas-sidebar-slot (col 1, row 1 — 20% × 50%)
   │  └─ .myio-elp (flex: 1, EntityListPanel fills slot)
   │  └─ border-right + border-bottom: subtle separators
   │
   ├─ .bas-water-slot (col 2, row 1 — 40% × 50%)
   │  └─ .myio-cgp (height: 100%, CardGridPanel fills slot)
   │  └─ padding: 12px, border-right + border-bottom
   │
   ├─ .bas-charts-slot (col 1–2, row 2 — 60% × 50%)
   │  ├─ .bas-chart-tabs (flex row, tab bar)
   │  │  └─ .bas-chart-tab / .bas-chart-tab--active
   │  │     └─ active: underline 2px #3d7a62, color #3d7a62
   │  └─ .bas-chart-card (bg: #FFF, border-radius: 12px, flex: 1)
   │     └─ canvas (100% width/height)
   │  └─ border-right: subtle separator
   │
   └─ .bas-dashboard-slot (col 3–4, row 1–2 — 40% × 100%)
      └─ .bas-dashboard (height: 100%)
         └─ BASDashboardView (panels-only mode, 100% width)
```

### 12.2 CSS Grid Definition

```css
.bas-content-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 20% 40% 20% 20%;
  grid-template-rows: 50% 50%;
  overflow: hidden;
  min-height: 0;
}

.bas-sidebar-slot {
  grid-column: 1;
  grid-row: 1;
}
.bas-water-slot {
  grid-column: 2;
  grid-row: 1;
}
.bas-charts-slot {
  grid-column: 1 / 3;
  grid-row: 2;
}
.bas-dashboard-slot {
  grid-column: 3 / 5;
  grid-row: 1 / 3;
}
```

### 12.3 Responsivo

| Breakpoint | Comportamento                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------- |
| > 900px    | CSS Grid: 4 colunas (20% 40% 20% 20%) × 2 linhas (50% 50%)                                    |
| <= 900px   | 2 colunas (1fr 1fr) × 3 linhas auto: sidebar+water (row 1), charts (row 2), dashboard (row 3) |

```css
@media (max-width: 900px) {
  .bas-content-layout {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto;
  }
  .bas-sidebar-slot {
    grid-column: 1;
    grid-row: 1;
    max-height: 220px;
  }
  .bas-water-slot {
    grid-column: 2;
    grid-row: 1;
    max-height: 220px;
  }
  .bas-charts-slot {
    grid-column: 1 / 3;
    grid-row: 2;
    max-height: 300px;
  }
  .bas-dashboard-slot {
    grid-column: 1 / 3;
    grid-row: 3;
    min-height: 280px;
  }
}
```

---

## 13. Dependencias da MyIOLibrary

### 13.1 Componentes Utilizados

| Funcao/Classe                   | Fonte                                                    | Proposito                                          |
| ------------------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| `createBASDashboard()`          | `src/components/bas-dashboard/index.ts`                  | Factory do dashboard (HVAC + Motores)              |
| `BASDashboardController`        | `src/components/bas-dashboard/BASDashboardController.ts` | Controller MVC                                     |
| `BASDashboardView`              | `src/components/bas-dashboard/BASDashboardView.ts`       | View — renderiza HVAC + Motores (panels-only mode) |
| `renderCardComponentV6()`       | `src/components/template-card-v6/template-card-v6.js`    | Renderizacao de cards com customStyle              |
| `EntityListPanel`               | `src/components/entity-list-panel/`                      | Sidebar de andares com busca e selecao             |
| `CardGridPanel`                 | `src/components/card-grid-panel/`                        | Grid responsivo de cards para agua                 |
| `createConsumption7DaysChart()` | `src/components/Consumption7DaysChart/`                  | Grafico de consumo 7 dias (Chart.js)               |

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
  │     └─ fetchData → { labels: string[], dailyTotals: number[] }
  │
  └─ MyIOLibrary.createBASDashboard()
       └─ BASDashboardController
            └─ BASDashboardView (panels-only mode)
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
   - BASDashboardView so gerencia HVAC e Motores (panels-only mode)
   - O `createBASDashboard` recebe flags `false` para evitar duplicacao

8. **Dados de graficos sao mock**
   - `createMockFetchData()` gera dados aleatorios
   - Retorna `{ labels, dailyTotals }` (formato `Consumption7DaysData`)
   - Deve ser substituido por fetch real quando API estiver disponivel

9. **CSS Grid layout depende de 4 slots flat**
   - Template tem 4 filhos diretos dentro de `.bas-content-layout` (sem wrapper divs)
   - Grid spanning: charts ocupa col 1–2, dashboard ocupa col 3–4 e row 1–2
   - Wrapper divs adicionais quebraria o grid placement

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

## 15. BASDashboardView — Panels-Only Mode

Quando o controller.js passa `showCharts: false`, `showFloorsSidebar: false`, e `showWaterInfrastructure: false` para o `createBASDashboard()`, o `BASDashboardView` entra em **panels-only mode**.

### Deteccao

```typescript
// BASDashboardView.ts — linha 121
private isPanelsOnly(): boolean {
  return !this.settings.showCharts
    && !this.settings.showFloorsSidebar
    && !this.settings.showWaterInfrastructure;
}
```

### Comportamento

| Modo        | Header           | Main Area   | Right Panel                            |
| ----------- | ---------------- | ----------- | -------------------------------------- |
| Normal      | Visivel (titulo) | Charts area | Lateral (largura fixa)                 |
| Panels-only | Oculto           | Oculto      | 100% width (preenche todo o container) |

### CSS

```css
/* styles.ts */
.bas-dashboard__content--panels-only {
  flex: 1;
}
.bas-dashboard__content--panels-only .bas-dashboard__right-panel {
  width: 100%;
  min-width: unset;
  border-left: none;
}
```

### Uso no MAIN_BAS

O `#bas-main-content` (grid slot col 3–4, row 1–2) recebe o BASDashboardView em panels-only mode, que renderiza os paineis de Ambientes e Bombas e Motores preenchendo 100% do espaco disponivel (40% da largura total × 100% da altura).

---

## 16. Referencia de Arquivos

| Arquivo                     | Linhas | Descricao                                                                     |
| --------------------------- | ------ | ----------------------------------------------------------------------------- |
| `controller.js`             | 681    | Widget controller — lifecycle + parsing + panels + charts                     |
| `template.html`             | 19     | Layout com 4 CSS Grid slots (header, sidebar, water, charts, dashboard)       |
| `styles.css`                | 266    | CSS Grid layout (20%\|40%\|20%\|20%), chart tabs, loading/error, responsivo   |
| `settingsSchema.json`       | 165    | Schema de configuracao do ThingsBoard (4 grupos)                              |
| `BASDashboardController.ts` | 86     | MVC Controller — delega para View                                             |
| `BASDashboardView.ts`       | 368    | MVC View — renderiza HVAC + Motores (panels-only mode)                        |
| `types.ts`                  | 141    | Interfaces TypeScript (WaterDevice, HVACDevice, MotorDevice, etc)             |
| `styles.ts`                 | 400    | CSS do dashboard injetado via JS (dark/light themes, panels-only, responsivo) |
| `index.ts`                  | 113    | Factory function createBASDashboard() + type exports                          |

---

## 17. RFC-0171: Filtros e Validacoes de Dispositivos

### 17.1 Filtro de Ambientes (EntityListPanel)

A sidebar de ambientes (`buildAmbienteItems`) filtra itens pelo padrao de label `(NNN)-`:

```javascript
// Regex para validar label de ambiente
var ambienteLabelPattern = /^\(\d{3}\)-/;

// Exemplos validos: "(001)-Deck", "(002)-Sala Nobreak", "(010)-Auditorio"
// Exemplos invalidos: "3F_MEDIDOR-001", "Termostato-Sala1", "HVAC-Central"
```

| Label | Incluido? |
|-------|-----------|
| `(001)-Deck` | ✅ Sim |
| `(002)-Sala do Nobreak` | ✅ Sim |
| `Melicidade-3F_MEDIDOR-001` | ❌ Nao |
| `Termostato-Sala1` | ❌ Nao |

### 17.2 Filtro de Energy Devices (CardGridPanel)

A funcao `buildEnergyCardItems` valida dispositivos de energia usando `isEnergyDevice()`:

```javascript
// MyIOLibrary.isEnergyDevice verifica deviceType/deviceProfile
var isValid = MyIOLibrary.isEnergyDevice(deviceType);
// Retorna true para: 3F_MEDIDOR, *3F*, *MEDIDOR*
```

### 17.3 Validacao no Parse (Energy nao e mais default)

O parse (`parseDevicesFromData`) agora valida dispositivos de energia antes de classifica-los:

```javascript
// Se domain === 'energy' (default), valida com isEnergyDevice
if (domain === 'energy') {
  var isValidEnergy = MyIOLibrary.isEnergyDevice(deviceProfile)
                   || MyIOLibrary.isEnergyDevice(deviceType);
  var isMotorPump = profileUpper.includes('BOMBA')
                 || profileUpper.includes('MOTOR');
  var isEntrada = profileUpper.includes('ENTRADA')
               || profileUpper.includes('TRAFO');

  if (!isValidEnergy && !isMotorPump && !isEntrada) {
    return; // Skip - nao e energy valido
  }
}
```

| deviceProfile | Resultado |
|---------------|-----------|
| `3F_MEDIDOR` | ✅ Incluido (isEnergyDevice) |
| `ENTRADA` | ✅ Incluido (isEntrada) |
| `BOMBA_HIDRAULICA` | ✅ Incluido (isMotorPump) |
| `ASSET_AMBIENT` | ❌ Ignorado |
| `(vazio)` | ❌ Ignorado |

### 17.4 Remocao do Subtitle da EntityListPanel

O subtitle "Dispositivos" ou "Nome ↑" foi removido da sidebar:

```javascript
var panel = new MyIOLibrary.EntityListPanel({
  title: settings.sidebarLabel,
  icon: '📍',
  quantity: items.length,
  subtitle: null, // Removido
  items: items,
  // ...
});
```

---

## 18. Referencias

| RFC      | Descricao                                               |
| -------- | ------------------------------------------------------- |
| RFC-0158 | Building Automation System (BAS) Dashboard              |
| RFC-0130 | Tooltips de range (temperatura, energia, comparacao)    |
| RFC-0108 | Formatacao inteligente (MyIOUtils measurement settings) |
| RFC-0111 | Classificacao de dominio/contexto de dispositivos       |
| RFC-0171 | Filtros e validacoes de dispositivos (ambiente, energy) |

---

_Documento atualizado em: 2026-02-11_
_Versao: v8.0.0 (RFC-0171: Filtros de ambiente e energy + validacao no parse)_
