# CARD_V6_ARCHITECTURE - Template Card V6

> Documento de arquitetura do componente `renderCardComponentV6` para renderizacao de cards de dispositivos individuais.

## 1. Visao Geral

O `template-card-v6` e um componente standalone para renderizacao de cards de dispositivos com suporte a:

- Multiplos tipos de dispositivos (energia, agua, tanque, temperatura)
- CustomStyle para personalizacao visual por card
- Selection e Drag-and-Drop
- Tooltips de range (temperatura, energia, comparacao)
- Status dinamico com animacoes
- Formatacao inteligente de valores

### Localizacao

```
src/components/template-card-v6/
├── template-card-v6.js      # Implementacao principal (~1200 linhas)
└── template-card-v6.d.ts    # Type definitions
```

---

## 2. API Principal

### 2.1 renderCardComponentV6()

```typescript
function renderCardComponentV6(options: RenderCardV6Options): CardResult;
```

#### Parametros (RenderCardV6Options)

| Parametro                  | Tipo                     | Obrigatorio | Descricao                                |
| -------------------------- | ------------------------ | ----------- | ---------------------------------------- |
| `entityObject`             | `Record<string, any>`    | Sim         | Dados do dispositivo                     |
| `handleActionDashboard`    | `Function \| undefined`  | Nao         | Callback botao Dashboard                 |
| `handleActionReport`       | `Function \| undefined`  | Nao         | Callback botao Relatorio                 |
| `handleActionSettings`     | `Function \| undefined`  | Nao         | Callback botao Configuracoes             |
| `handleSelect`             | `Function \| undefined`  | Nao         | Callback selecao checkbox                |
| `handleClickCard`          | `Function \| undefined`  | Nao         | Callback click no card                   |
| `useNewComponents`         | `boolean`                | Nao         | Usar componentes novos (default: true)   |
| `enableSelection`          | `boolean`                | Nao         | Habilitar selecao (default: true)        |
| `enableDragDrop`           | `boolean`                | Nao         | Habilitar drag-drop (default: true)      |
| `showEnergyRangeTooltip`   | `boolean`                | Nao         | Mostrar tooltip range energia            |
| `showPercentageTooltip`    | `boolean`                | Nao         | Mostrar tooltip percentual               |
| `showTempComparisonTooltip`| `boolean`                | Nao         | Mostrar tooltip comparacao temperatura   |
| `showTempRangeTooltip`     | `boolean`                | Nao         | Mostrar tooltip range temperatura        |
| `customStyle`              | `CustomStyle`            | Nao         | Estilos customizados por card            |

#### Retorno (CardResult)

```typescript
interface CardResult {
  get(index: number): HTMLElement | undefined;
  0: HTMLElement;              // Container element
  length: number;
  find(selector: string): unknown;
  on(event: string, handler: EventListener): unknown;
  addClass(className: string): unknown;
  removeClass(className: string): unknown;
  destroy(): void;
}
```

---

## 3. Entity Object

### 3.1 Estrutura Completa

```typescript
interface EntityObject {
  entityId: string;              // ID unico do dispositivo
  labelOrName: string;           // Nome de exibicao
  deviceIdentifier: string;      // Identificador do device
  entityType: string;            // Tipo da entidade (DEVICE, ASSET)
  deviceType: string;            // Tipo do dispositivo (ver secao 4)
  slaveId?: string;              // ID do escravo Modbus
  ingestionId?: string;          // ID de ingestao
  val: number;                   // Valor principal (consumo, nivel, temp)
  centralId?: string;            // ID da central
  updatedIdentifiers?: object;   // Identificadores atualizados
  perc?: number;                 // Percentual (0-100)
  deviceStatus: string;          // Status do dispositivo
  centralName?: string;          // Nome da central
  connectionStatusTime?: number; // Timestamp status conexao
  timeVal?: number;              // Timestamp do valor
  lastDisconnectTime?: number;   // Ultimo disconnect
  customerName?: string;         // Nome do cliente
  waterLevel?: number;           // Nivel de agua (tanks)
  waterPercentage?: number;      // Percentual agua (tanks)
  temperature?: number;          // Temperatura atual
  temperatureMin?: number;       // Temperatura minima (range)
  temperatureMax?: number;       // Temperatura maxima (range)
  temperatureStatus?: string;    // Status temperatura
}
```

---

## 4. Tipos de Dispositivos

### 4.1 Configuracao por Tipo

```javascript
const DEVICE_TYPE_CONFIG = {
  // === ENERGIA ===
  '3F_MEDIDOR':       { category: 'energy', image: 'url...' },
  'RELOGIO':          { category: 'energy', image: 'url...' },
  'ENTRADA':          { category: 'energy', image: 'url...' },
  'SUBESTACAO':       { category: 'energy', image: 'url...' },
  'FANCOIL':          { category: 'energy', image: 'url...' },
  'CHILLER':          { category: 'energy', image: 'url...' },
  'MOTOR':            { category: 'energy', image: 'url...' },
  'BOMBA':            { category: 'energy', image: 'url...' },
  'BOMBA_HIDRAULICA': { category: 'energy', image: 'url...' },
  'BOMBA_CAG':        { category: 'energy', image: 'url...' },
  'BOMBA_INCENDIO':   { category: 'energy', image: 'url...' },
  'ELEVADOR':         { category: 'energy', image: 'url...' },
  'ESCADA_ROLANTE':   { category: 'energy', image: 'url...' },
  'COMPRESSOR':       { category: 'energy', image: null },
  'VENTILADOR':       { category: 'energy', image: null },
  'AR_CONDICIONADO':  { category: 'energy', image: null },
  'HVAC':             { category: 'energy', image: null },

  // === AGUA ===
  'HIDROMETRO':             { category: 'water', image: 'url...' },
  'HIDROMETRO_AREA_COMUM':  { category: 'water', image: 'url...' },
  'HIDROMETRO_SHOPPING':    { category: 'water', image: 'url...' },
  'CAIXA_DAGUA':            { category: 'water', image: 'url...' },

  // === TANQUE (imagem dinamica por nivel) ===
  'TANK':        { category: 'tank', image: null },

  // === TEMPERATURA (imagem dinamica por status) ===
  'TERMOSTATO':  { category: 'temperature', image: null },
};
```

### 4.2 Categorias

| Categoria     | Unidade | Formatacao                        |
| ------------- | ------- | --------------------------------- |
| `energy`      | kWh/MWh | `formatEnergy()` ou MyIOUtils     |
| `water`       | m3      | `X.XX m³`                         |
| `tank`        | m.c.a   | `X.XX m.c.a` (metros coluna agua) |
| `temperature` | °C      | `X.X °C`                          |

---

## 5. CustomStyle

### 5.1 Propriedades

```typescript
interface CustomStyle {
  fontSize?: string;        // Ex: '14px', '0.9rem'
  backgroundColor?: string; // Ex: '#1a1a2e', 'rgba(0,0,0,0.5)'
  fontColor?: string;       // Ex: '#ffffff', '#333'
  width?: string;           // Ex: '300px', '100%'
  height?: string;          // Ex: '180px', 'auto'
}
```

### 5.2 Aplicacao

```javascript
// applyCustomStyle() aplica em:
// - Container: width, height
// - Card (.device-card-centered): background, width, height
// - Titulo (.device-title): fontSize, fontColor
// - Subtitulo (.device-subtitle): fontSize * 0.84, fontColor
// - Valor (.consumption-value): fontSize * 0.94, fontColor
// - Badge (.device-percentage-badge): fontSize * 0.81, fontColor
```

### 5.3 Exemplo de Uso

```javascript
renderCardComponentV6({
  entityObject: { ... },
  handleClickCard: (entity) => console.log(entity),
  customStyle: {
    fontSize: '14px',
    backgroundColor: '#1e293b',
    fontColor: '#e0e0e0',
    width: '260px',
    height: '160px',
  },
});
```

---

## 6. Status do Dispositivo

### 6.1 Device Status Types

```javascript
// DeviceStatusType enum values
const DEVICE_STATUS = {
  POWER_ON: 'power_on',
  ONLINE: 'online',
  NORMAL: 'normal',
  OK: 'ok',
  RUNNING: 'running',
  ACTIVE: 'active',
  OFFLINE: 'offline',
  NO_INFO: 'no_info',
  WAITING: 'waiting',
  WEAK_CONNECTION: 'weak_connection',
};
```

### 6.2 Mapeamento Visual

| Status           | Cor Card     | Animacao               |
| ---------------- | ------------ | ---------------------- |
| online/power_on  | Normal       | Nenhuma                |
| offline          | Borda #ff4d4f| border-blink-v6 (1s)   |
| waiting          | Normal       | Nenhuma                |
| weak_connection  | Normal       | Nenhuma                |
| no_info          | Cinza        | Nenhuma                |

---

## 7. Estrutura HTML

### 7.1 Layout do Card

```
.myio-enhanced-card-container-v6
└── .myio-draggable-card [.selected] [.offline]
    ├── .card-actions (piano-keys lateral esquerda)
    │   ├── input.card-checkbox (se enableSelection)
    │   ├── button.card-action (Dashboard)
    │   ├── button.card-action (Report)
    │   └── button.card-action (Settings)
    │
    ├── .card-body (conteudo central)
    │   ├── .card-icon (imagem do dispositivo)
    │   ├── .card-title (nome truncado)
    │   ├── .card-group (identificador)
    │   └── .card-value
    │       ├── valor formatado
    │       ├── .card-unit
    │       └── .card-percentage
    │
    └── .card-status-indicator (bolinha status)
```

### 7.2 Classes CSS

| Classe                       | Descricao                                |
| ---------------------------- | ---------------------------------------- |
| `.myio-draggable-card`       | Card principal com transicoes            |
| `.myio-draggable-card:hover` | Scale 1.05 no hover                      |
| `.selected`                  | Border verde + shadow verde              |
| `.offline`                   | Border vermelha + animacao pulsante      |
| `.card-status-ok`            | Bolinha verde                            |
| `.card-status-alert`         | Bolinha amarela                          |
| `.card-status-fail`          | Bolinha vermelha                         |
| `.card-status-unknown`       | Bolinha cinza                            |

---

## 8. Dependencias

### 8.1 Imports Internos

| Modulo                    | Fonte                        | Proposito                      |
| ------------------------- | ---------------------------- | ------------------------------ |
| `MyIOSelectionStore`      | `../SelectionStore.js`       | Gerenciamento de selecao       |
| `MyIODraggableCard`       | `../DraggableCard.js`        | Drag-and-drop                  |
| `formatEnergy`            | `../../format/energy.ts`     | Formatacao kWh/MWh             |
| `deviceStatus utils`      | `../../utils/deviceStatus.js`| Status icons e mapeamentos     |
| `TempRangeTooltip`        | `../../utils/TempRangeTooltip`| Tooltip range temperatura     |
| `EnergyRangeTooltip`      | `../../utils/EnergyRangeTooltip`| Tooltip range energia      |
| `DeviceComparisonTooltip` | `../../utils/DeviceComparisonTooltip`| Tooltip comparacao   |
| `TempComparisonTooltip`   | `../../utils/TempComparisonTooltip`| Tooltip temp comparacao|

### 8.2 Dependencias Globais (Opcionais)

```javascript
// MyIOUtils (window global) para formatacao com settings
window.MyIOUtils?.formatEnergyWithSettings(value);
window.MyIOUtils?.formatTemperatureWithSettings(value);
window.MyIOUtils?.formatWaterWithSettings(value);
```

---

## 9. Funcoes Auxiliares

### 9.1 Formatacao

| Funcao             | Input            | Output                           |
| ------------------ | ---------------- | -------------------------------- |
| `formatCardValue`  | (value, type)    | String formatada com unidade     |
| `formatEnergy`     | number           | "X.XX kWh" ou "X.XX MWh"         |
| `determineUnit`    | deviceType       | String unidade ('kWh','m³','°C') |

### 9.2 Classificacao

| Funcao                    | Input       | Output                        |
| ------------------------- | ----------- | ----------------------------- |
| `getDeviceCategory`       | deviceType  | 'energy'\|'water'\|'tank'\|'temperature' |
| `isEnergyDeviceType`      | deviceType  | boolean                       |
| `isWaterDeviceType`       | deviceType  | boolean                       |
| `isTemperatureDeviceType` | deviceType  | boolean                       |
| `getStaticDeviceImage`    | deviceType  | URL string                    |

### 9.3 Imagens Dinamicas

```javascript
// TANK: Imagem muda baseado no nivel
getDeviceImageUrl('TANK', percentage);
// 0-25%:   Tanque vazio
// 26-50%:  Tanque 1/4
// 51-75%:  Tanque 1/2
// 76-100%: Tanque cheio

// TERMOSTATO: Imagem muda baseado no status/offline
getDeviceImageUrl('TERMOSTATO', 0, { tempStatus, isOffline });
```

---

## 10. Toast Global

O componente inclui um sistema de Toast global para avisos:

```javascript
// MyIOToast interno
MyIOToast.show('Mensagem', 'warning', 3500);  // warning ou error
```

---

## 11. Exemplo Completo

```javascript
import { renderCardComponentV6 } from 'myio-js-library';

const entityObject = {
  entityId: 'device-123',
  labelOrName: 'Medidor Loja 01',
  deviceIdentifier: 'MED-001',
  entityType: 'DEVICE',
  deviceType: '3F_MEDIDOR',
  val: 1234.56,
  perc: 15.2,
  deviceStatus: 'online',
  temperature: null,
  waterLevel: null,
};

const cardResult = renderCardComponentV6({
  entityObject,
  handleClickCard: (entity) => {
    console.log('Card clicado:', entity);
  },
  handleActionSettings: (entity) => {
    openSettingsModal(entity);
  },
  enableSelection: false,
  enableDragDrop: false,
  customStyle: {
    fontSize: '13px',
    backgroundColor: '#1a1a2e',
    fontColor: '#e0e0e0',
    width: '240px',
    height: '150px',
  },
});

// Inserir no DOM
container.appendChild(cardResult[0]);

// Destruir quando nao mais necessario
cardResult.destroy();
```

---

## 12. Migracoes e Deprecacoes

### 12.1 handInfo (DEPRECATED)

```javascript
// DEPRECATED: handInfo foi removido
// Funcionalidade movida para settings modal
if (handInfo) {
  console.warn('handInfo is deprecated. Info moved to settings modal.');
}
```

### 12.2 V5 → V6

| V5                         | V6                                    |
| -------------------------- | ------------------------------------- |
| Depende de v5 base         | Standalone (clonado)                  |
| Sem customStyle            | customStyle suportado                 |
| Info icon nas actions      | Removido (movido para settings)       |
| Gap imagem 10px            | Gap imagem 4px                        |
| Min-height 126px           | Min-height 114px                      |

---

_Documento criado em: 2026-02-09_
_Versao: 6.0.0_
