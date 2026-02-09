# CARD_AMBIENTE_V6_ARCHITECTURE - Template Card Ambiente V6

> Documento de arquitetura do componente `renderCardAmbienteV6` para renderizacao de cards de ambientes com dados agregados de multiplos dispositivos.

## 1. Visao Geral

O `template-card-ambiente-v6` e um componente para renderizacao de cards de **ambientes** (environments) que agregam dados de multiplos dispositivos:

- Sensor de temperatura (termostato)
- Medidor de energia (3F_MEDIDOR)
- Controle remoto (on/off)

### Diferencas do Card V6 (Dispositivo)

| Aspecto            | Card V6 (Dispositivo)        | Card Ambiente V6             |
| ------------------ | ---------------------------- | ---------------------------- |
| Proposito          | Dispositivo individual       | Ambiente com N dispositivos  |
| Dados              | Val unico                    | Agregados (temp+cons+remote) |
| Status             | Status do device             | Status agregado dos devices  |
| Acoes              | Dashboard/Report/Settings    | Dashboard/Report/Settings    |
| Remote toggle      | Nao                          | Sim (se hasRemote)           |
| Device count badge | Nao                          | Sim                          |

### Localizacao

```
src/components/template-card-ambiente-v6/
├── template-card-ambiente-v6.js      # Implementacao (~720 linhas)
├── template-card-ambiente-v6.d.ts    # Type definitions
└── index.js                          # Re-export
```

---

## 2. API Principal

### 2.1 renderCardAmbienteV6()

```typescript
function renderCardAmbienteV6(
  options: RenderCardAmbienteOptions
): [HTMLElement, CardAmbienteApi];
```

#### Parametros (RenderCardAmbienteOptions)

| Parametro              | Tipo                    | Obrigatorio | Descricao                          |
| ---------------------- | ----------------------- | ----------- | ---------------------------------- |
| `ambienteData`         | `AmbienteData`          | Sim         | Dados do ambiente                  |
| `handleActionDashboard`| `Function \| undefined` | Nao         | Callback botao Dashboard           |
| `handleActionReport`   | `Function \| undefined` | Nao         | Callback botao Relatorio           |
| `handleActionSettings` | `Function \| undefined` | Nao         | Callback botao Configuracoes       |
| `handleClickCard`      | `Function \| undefined` | Nao         | Callback click no card             |
| `handleSelect`         | `Function \| undefined` | Nao         | Callback selecao checkbox          |
| `handleToggleRemote`   | `Function \| undefined` | Nao         | Callback toggle ligado/desligado   |
| `enableSelection`      | `boolean`               | Nao         | Habilitar selecao (default: true)  |
| `enableDragDrop`       | `boolean`               | Nao         | Habilitar drag-drop (default: true)|
| `customStyle`          | `CustomStyle`           | Nao         | Estilos customizados por card      |

#### Retorno

```typescript
// Tuple: [container element, card API]
[HTMLElement, CardAmbienteApi]

interface CardAmbienteApi {
  getElement(): HTMLElement;     // Container element
  getId(): string;               // Ambiente ID
  getData(): AmbienteData;       // Dados atuais
  setSelected(selected: boolean): void;  // Toggle selecao
  updateData(newData: Partial<AmbienteData>): void;  // Atualizar dados
  destroy(): void;               // Remover do DOM
}
```

---

## 3. Estrutura de Dados

### 3.1 AmbienteData

```typescript
interface AmbienteData {
  /** ID unico do ambiente */
  id: string;

  /** Label de exibicao */
  label: string;

  /** Identificador opcional */
  identifier?: string;

  /** Temperatura atual em °C (agregada) */
  temperature?: number;

  /** Consumo atual em kW (agregado) */
  consumption?: number;

  /** Estado do controle remoto */
  isOn?: boolean;

  /** Se ambiente possui controle remoto */
  hasRemote?: boolean;

  /** Status geral: 'online' | 'offline' */
  status?: 'online' | 'offline';

  /** Dispositivos do ambiente */
  devices?: AmbienteDevice[];
}
```

### 3.2 AmbienteDevice

```typescript
interface AmbienteDevice {
  /** Device ID */
  id: string;

  /** Tipo do device no contexto ambiente */
  type: 'temperature' | 'energy' | 'remote';

  /** Tipo original do dispositivo (TERMOSTATO, 3F_MEDIDOR, etc.) */
  deviceType?: string;

  /** Status do dispositivo */
  status?: 'online' | 'offline';

  /** Valor atual (temperatura, consumo, ou 0/1 para remote) */
  value?: number;
}
```

---

## 4. Status Agregado

### 4.1 Logica de Agregacao

```javascript
function getAggregatedStatus(devices) {
  if (!devices || devices.length === 0) return 'offline';

  const hasOffline = devices.some(d =>
    d.status === 'offline' || d.connectionStatus === 'offline'
  );

  const allOnline = devices.every(d =>
    d.status === 'online' || d.connectionStatus === 'online'
  );

  if (allOnline) return 'online';
  if (hasOffline) return 'offline';
  return 'online';
}
```

### 4.2 Regras

| Cenario                    | Status Resultante |
| -------------------------- | ----------------- |
| Todos devices online       | `online`          |
| Pelo menos 1 offline       | `offline`         |
| Array vazio                | `offline`         |
| Status explicitamente dado | Usa `status` prop |

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
function applyCustomStyle(container, card, customStyle) {
  // width → container.style.width
  // height → container.style.height, card.style.minHeight
  // backgroundColor → card.style.background
  // fontColor → card.style.color, label.style.color
  // fontSize → label.style.fontSize
}
```

---

## 6. Estrutura HTML

### 6.1 Layout do Card

```
.myio-ambiente-card-container
└── .myio-ambiente-card [.clickable] [.selected] [.offline]
    │
    ├── .myio-ambiente-card__actions (piano-keys lateral esquerda)
    │   ├── input.myio-ambiente-card__checkbox (se enableSelection)
    │   ├── button.myio-ambiente-card__action (Dashboard)
    │   ├── button.myio-ambiente-card__action (Report)
    │   └── button.myio-ambiente-card__action (Settings)
    │
    └── .myio-ambiente-card__body (conteudo central)
        │
        ├── .myio-ambiente-card__header
        │   ├── .myio-ambiente-card__label (nome truncado)
        │   └── .myio-ambiente-card__status-dot [.online|.offline]
        │
        ├── .myio-ambiente-card__metrics
        │   ├── .myio-ambiente-card__metric (temperatura)
        │   │   ├── .myio-ambiente-card__metric-icon (emoji)
        │   │   └── .myio-ambiente-card__metric-value.temperature
        │   │
        │   ├── .myio-ambiente-card__metric (consumo)
        │   │   ├── .myio-ambiente-card__metric-icon (emoji)
        │   │   └── .myio-ambiente-card__metric-value.consumption
        │   │
        │   └── .myio-ambiente-card__remote-toggle [.on|.off]
        │       └── Ligado/Desligado toggle (se hasRemote)
        │
        ├── .myio-ambiente-card__identifier (se identifier)
        │
        └── .myio-ambiente-card__device-count (badge com contagem)
```

### 6.2 Classes CSS Principais

| Classe                                    | Descricao                           |
| ----------------------------------------- | ----------------------------------- |
| `.myio-ambiente-card`                     | Card principal                      |
| `.myio-ambiente-card:hover`               | translateY(-2px) + shadow           |
| `.myio-ambiente-card.clickable`           | cursor: pointer                     |
| `.myio-ambiente-card.selected`            | Border verde + gradient verde       |
| `.myio-ambiente-card.offline`             | Border vermelha + animacao          |
| `.myio-ambiente-card__status-dot.online`  | Bolinha verde com glow              |
| `.myio-ambiente-card__status-dot.offline` | Bolinha vermelha pulsante           |
| `.myio-ambiente-card__metric-value.temperature` | Cor azul (#0d6efd)            |
| `.myio-ambiente-card__metric-value.consumption` | Cor verde (#198754)           |
| `.myio-ambiente-card__remote-toggle.on`   | Background verde claro              |
| `.myio-ambiente-card__remote-toggle.off`  | Background cinza claro              |

---

## 7. Metricas Exibidas

### 7.1 Temperatura

```javascript
// Exibida se temperature !== undefined && temperature !== null
formatTemperature(value) {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + '°C';
}

// Visual: 🌡️ 22.5°C
```

### 7.2 Consumo

```javascript
// Exibida se consumption !== undefined && consumption !== null
formatConsumption(value) {
  if (value === null || value === undefined || isNaN(value)) return '--';
  // Usa formatEnergy se disponivel
  return formatEnergy(Number(value));
  // Fallback: X.XX kW
}

// Visual: ⚡ 1.50 kW
```

### 7.3 Controle Remoto

```javascript
// Exibido se hasRemote === true
// Visual (on):  🟢 Ligado
// Visual (off): ⚫ Desligado

// Clicavel - dispara handleToggleRemote(!isOn, ambienteData)
```

---

## 8. Callbacks

### 8.1 handleClickCard

```javascript
// Disparado ao clicar no card (exceto actions e remote toggle)
handleClickCard?: (data: AmbienteData) => void;

card.addEventListener('click', () => {
  handleClickCard(ambienteData);
});
```

### 8.2 handleToggleRemote

```javascript
// Disparado ao clicar no remote toggle
handleToggleRemote?: (isOn: boolean, data: AmbienteData) => void;

remoteEl.addEventListener('click', (e) => {
  e.stopPropagation();
  handleToggleRemote?.(!isOn, ambienteData);
});
```

### 8.3 handleSelect

```javascript
// Disparado ao marcar/desmarcar checkbox
handleSelect?: (id: string, selected: boolean) => void;

checkbox.addEventListener('change', (e) => {
  e.stopPropagation();
  card.classList.toggle('selected', checkbox.checked);
  handleSelect?.(id, checkbox.checked);
});
```

### 8.4 Action Buttons

```javascript
// Todos param propagacao (e.stopPropagation)
handleActionDashboard?: (data: AmbienteData) => void;
handleActionReport?: (data: AmbienteData) => void;
handleActionSettings?: (data: AmbienteData) => void;
```

---

## 9. API do Card

### 9.1 Metodos

```typescript
interface CardAmbienteApi {
  // Obter container DOM
  getElement(): HTMLElement;

  // Obter ID do ambiente
  getId(): string;

  // Obter dados atuais
  getData(): AmbienteData;

  // Alterar estado de selecao
  setSelected(selected: boolean): void;

  // Atualizar dados dinamicamente
  updateData(newData: Partial<AmbienteData>): void;

  // Destruir e remover do DOM
  destroy(): void;
}
```

### 9.2 updateData()

Atualiza parcialmente os dados sem recriar o card:

```javascript
api.updateData({
  temperature: 23.5,      // Atualiza display temperatura
  consumption: 2.1,       // Atualiza display consumo
  isOn: false,            // Atualiza toggle remote
  status: 'offline',      // Atualiza bolinha status
});
```

---

## 10. Dependencias

### 10.1 Imports Internos

| Modulo              | Fonte                   | Proposito              |
| ------------------- | ----------------------- | ---------------------- |
| `MyIOSelectionStore`| `../SelectionStore.js`  | Gerenciamento selecao  |
| `MyIODraggableCard` | `../DraggableCard.js`   | Drag-and-drop          |
| `formatEnergy`      | `../../format/energy.ts`| Formatacao consumo     |

### 10.2 Imagens Default

```javascript
const IMAGES = {
  thermometer: 'https://cdn-icons-png.flaticon.com/.../thermometer.png',
  energy: 'https://cdn-icons-png.flaticon.com/.../energy.png',
  remote: 'https://cdn-icons-png.flaticon.com/.../remote.png',
  ambiente: 'https://cdn-icons-png.flaticon.com/.../ambiente.png',
  dashboard: 'https://cdn-icons-png.flaticon.com/.../dashboard.png',
  report: 'https://cdn-icons-png.flaticon.com/.../report.png',
  settings: 'https://cdn-icons-png.flaticon.com/.../settings.png',
};
```

---

## 11. Integracao com RFC-0161 (Hierarquia)

O card ambiente V6 e usado em conjunto com a hierarquia de ambientes do RFC-0161:

```javascript
// buildSidebarItemsFromHierarchy() cria items para EntityListPanel
// Cada leaf ambiente pode ser renderizado como card:

const leafAmbientes = getLeafAmbientes();

leafAmbientes.forEach((ambiente) => {
  const [cardEl, api] = renderCardAmbienteV6({
    ambienteData: {
      id: ambiente.id,
      label: ambiente.name,
      temperature: ambiente.aggregatedData?.temperature?.avg,
      consumption: ambiente.aggregatedData?.consumption?.total,
      hasRemote: ambiente.aggregatedData?.hasRemote,
      isOn: ambiente.aggregatedData?.isRemoteOn,
      status: ambiente.aggregatedData?.onlineCount > 0 ? 'online' : 'offline',
      devices: ambiente.devices,
    },
    handleClickCard: (data) => selectAmbiente(data.id),
    handleToggleRemote: (isOn, data) => toggleAmbienteRemote(data.id, isOn),
  });

  container.appendChild(cardEl);
});
```

---

## 12. Exemplo Completo

```javascript
import { renderCardAmbienteV6 } from 'myio-js-library';

const ambienteData = {
  id: 'amb-melicidade-nobreak',
  label: 'Sala Nobreak',
  identifier: 'Melicidade',
  temperature: 22.5,
  consumption: 1.85,
  isOn: true,
  hasRemote: true,
  status: 'online',
  devices: [
    { id: 'dev-1', type: 'temperature', deviceType: 'TERMOSTATO', value: 22.5, status: 'online' },
    { id: 'dev-2', type: 'energy', deviceType: '3F_MEDIDOR', value: 1.85, status: 'online' },
    { id: 'dev-3', type: 'remote', deviceType: 'REMOTE', value: 1, status: 'online' },
  ],
};

const [cardEl, api] = renderCardAmbienteV6({
  ambienteData,
  handleClickCard: (data) => {
    console.log('Ambiente clicado:', data.label);
    openAmbienteDetails(data.id);
  },
  handleToggleRemote: (isOn, data) => {
    console.log('Toggle remote:', isOn);
    sendRemoteCommand(data.id, isOn);
  },
  handleActionSettings: (data) => {
    openAmbienteSettings(data.id);
  },
  enableSelection: true,
  enableDragDrop: false,
  customStyle: {
    width: '280px',
    height: '140px',
    backgroundColor: '#f8f9fa',
  },
});

// Inserir no DOM
document.getElementById('ambientes-grid').appendChild(cardEl);

// Atualizar posteriormente
api.updateData({ temperature: 23.0, consumption: 2.0 });

// Destruir quando necessario
api.destroy();
```

---

## 13. Comparacao Visual

### Card Dispositivo V6

```
┌────────────────────────────────────┐
│ [✓] │  [Imagem]                    │
│ [📊]│   Nome Device                │
│ [📋]│   Identificador              │
│ [⚙️]│   1.234,56 kWh  +15%         │
└────────────────────────────────────┘
```

### Card Ambiente V6

```
┌────────────────────────────────────┐
│ [✓] │ Sala Nobreak            🟢  │
│ [📊]│                              │
│ [📋]│ 🌡️ 22.5°C  ⚡ 1.85kW        │
│ [⚙️]│ [🟢 Ligado]                  │
│     │ Melicidade                   │
│     │ 📱 3 dispositivos            │
└────────────────────────────────────┘
```

---

_Documento criado em: 2026-02-09_
_Versao: 6.0.0_
