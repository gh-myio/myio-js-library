# RFC-0148: TelemetryInfoShoppingComponent

**Status:** Draft
**Author:** MyIO Team
**Created:** 2025-01-XX
**Related RFCs:** RFC-0056, RFC-0105, RFC-0106, RFC-0108, RFC-0134

## Summary

Migrar o widget ThingsBoard `TELEMETRY_INFO` (`src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/TELEMETRY_INFO/`) para um componente library reutilizável exposto em `src/index.ts`, com showcase em `showcase/telemetry-info-shopping/`.

## Motivation

O widget TELEMETRY_INFO apresenta informações consolidadas de consumo por categoria (entrada, lojas, climatização, elevadores, escadas rolantes, outros, área comum) com gráfico de pizza para distribuição. Atualmente está acoplado ao ThingsBoard. A migração para componente library permite:

1. **Reutilização** - Usar o mesmo componente em diferentes contextos
2. **Testabilidade** - Testar isoladamente com showcase
3. **Manutenibilidade** - Código centralizado e versionado
4. **Multi-domain** - Suporte a energia e água com interfaces específicas

## Design

### Factory Function

```typescript
export function createTelemetryInfoShoppingComponent(options: TelemetryInfoOptions): TelemetryInfoComponent
```

### Interfaces

```typescript
interface TelemetryInfoOptions {
  container: HTMLElement | string;
  domain: 'energy' | 'water';

  // Optional settings
  showDevicesList?: boolean;
  chartColors?: ChartColors;
  waterIncludeBathrooms?: boolean;
  labelWidget?: string;
  modalTitle?: string;

  // Callbacks
  onCategoryClick?: (category: CategoryType, devices: Device[]) => void;
  onExpandClick?: () => void;
}

interface ChartColors {
  climatizacao?: string;   // Default: '#00C896'
  elevadores?: string;     // Default: '#5B2EBC'
  escadasRolantes?: string; // Default: '#FF6B6B'
  lojas?: string;          // Default: '#FFC107'
  outros?: string;         // Default: '#9C27B0'
  areaComum?: string;      // Default: '#4CAF50'
}

// Energy domain categories
type EnergyCategoryType =
  | 'entrada'
  | 'climatizacao'
  | 'elevadores'
  | 'escadasRolantes'
  | 'lojas'
  | 'outros'
  | 'areaComum';

// Water domain categories
type WaterCategoryType =
  | 'entrada'
  | 'lojas'
  | 'banheiros'
  | 'areaComum'
  | 'pontosNaoMapeados';

interface CategoryData {
  devices: Device[];
  total: number;
  perc: number;
}

interface EnergyState {
  entrada: CategoryData;
  consumidores: {
    climatizacao: CategoryData;
    elevadores: CategoryData;
    escadasRolantes: CategoryData;
    lojas: CategoryData;
    outros: CategoryData;
    areaComum: CategoryData;
    totalGeral: number;
    percGeral: number;
  };
  grandTotal: number;
}

interface WaterState {
  entrada: CategoryData;
  lojas: CategoryData;
  banheiros: CategoryData;
  areaComum: CategoryData;
  pontosNaoMapeados: CategoryData & {
    isCalculated: boolean;
    hasInconsistency: boolean;
  };
  grandTotal: number;
  includeBathrooms: boolean;
}

interface TelemetryInfoComponent {
  // Data updates
  setData(data: TelemetryData): void;
  setEnergyData(summary: EnergySummary): void;
  setWaterData(summary: WaterSummary): void;
  clearData(): void;

  // State
  getState(): EnergyState | WaterState;
  getDomain(): 'energy' | 'water';

  // Modal
  openModal(): void;
  closeModal(): void;
  isModalOpen(): boolean;

  // Chart
  refreshChart(): void;
  getChartInstance(): Chart | null;

  // Settings
  setChartColors(colors: Partial<ChartColors>): void;
  setLabel(label: string): void;

  // Lifecycle
  destroy(): void;
}
```

### Events (Input - Listened)

| Event | Purpose | Payload |
|-------|---------|---------|
| `myio:telemetry:provide-data` | Receive telemetry data | `{ domain, periodKey, items }` |
| `myio:telemetry:provide-water` | Water-specific data | `{ domain, context, items }` |
| `myio:telemetry:clear` | Clear cache/state | `{ domain }` |
| `myio:update-date` | Date range changed | `{ period: { startISO, endISO } }` |
| `myio:telemetry:update` | Consolidated update | `{ domain, entrada, lojas, ... }` |
| `myio:measurement-settings-updated` | Unit settings changed | `{ energy, water }` |

### Events (Output - Dispatched)

| Event | Purpose | Payload |
|-------|---------|---------|
| `myio:telemetry-info:ready` | Component initialized | `{ domain }` |
| `myio:telemetry-info:category-click` | Category card clicked | `{ category, devices }` |
| `myio:telemetry-info:modal-opened` | Modal opened | `{ domain }` |
| `myio:telemetry-info:modal-closed` | Modal closed | `{ domain }` |

### UI Components

#### 1. Category Cards Grid

Grid layout com cards para cada categoria:

**Energy Domain (6-7 cards):**
- Entrada (entrada total - 100% reference)
- Climatização (HVAC, chillers, bombas)
- Elevadores
- Escadas Rolantes
- Lojas
- Outros
- Área Comum (residual calculation)
- Total Consumidores

**Water Domain (5 cards):**
- Entrada (hidrometro_entrada)
- Lojas
- Banheiros (extracted from área comum)
- Área Comum
- Pontos Não Mapeados (residual with inconsistency flag)

#### 2. Pie Chart

- Chart.js pie chart com distribuição de consumo
- Custom legend com cores e valores
- Tooltips com formatação localizada (pt-BR)
- Animações suaves

#### 3. Expanded Modal

- Full-screen modal com gráfico ampliado
- Same data as main chart
- Close button and backdrop click to close
- Max z-index for proper layering

### File Structure

```
src/
├── components/
│   └── telemetry-info-shopping/
│       ├── TelemetryInfoView.ts        # Main component class
│       ├── TelemetryInfoChart.ts       # Chart.js integration
│       ├── TelemetryInfoModal.ts       # Modal component
│       ├── TelemetryInfoState.ts       # State management
│       ├── TelemetryInfoStyles.ts      # CSS-in-JS styles
│       ├── types.ts                    # TypeScript interfaces
│       └── index.ts                    # Exports
├── index.ts                            # Library exports
showcase/
└── telemetry-info-shopping/
    ├── index.html
    ├── start-server.bat
    ├── start-server.sh
    ├── stop-server.bat
    └── stop-server.sh
```

### CSS Variables

Reutiliza variáveis do MyIO Design System:

```css
:root {
  /* Card backgrounds */
  --myio-card-bg: #FFFFFF;
  --myio-card-border: #E0E0E0;
  --myio-card-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  /* Text colors */
  --myio-text-primary: #222222;
  --myio-text-secondary: #666666;
  --myio-text-muted: #999999;

  /* Category colors (chart) */
  --myio-color-climatizacao: #00C896;
  --myio-color-elevadores: #5B2EBC;
  --myio-color-escadas: #FF6B6B;
  --myio-color-lojas: #FFC107;
  --myio-color-outros: #9C27B0;
  --myio-color-area-comum: #4CAF50;

  /* Modal */
  --myio-modal-backdrop: rgba(0, 0, 0, 0.75);
  --myio-modal-bg: #FFFFFF;
  --myio-modal-z-index: 2147483647;
}
```

### Dependencies

- **Chart.js v4.4.0** - Pie chart rendering
- **MyIOLibrary** - formatEnergy, formatWater utilities

## Implementation

### Phase 1: Core Component

1. Create `TelemetryInfoView.ts` with:
   - Container setup
   - Grid layout rendering
   - Category card components
   - Event listener registration

2. Create `TelemetryInfoState.ts` with:
   - Energy state management
   - Water state management
   - Aggregation logic
   - Percentage calculations

### Phase 2: Chart Integration

1. Create `TelemetryInfoChart.ts` with:
   - Chart.js initialization
   - Data mapping to chart format
   - Custom legend rendering
   - Tooltip callbacks
   - Chart destruction/recreation

### Phase 3: Modal

1. Create `TelemetryInfoModal.ts` with:
   - Modal HTML generation
   - Open/close logic
   - Body scroll lock
   - Z-index management
   - Modal chart instance

### Phase 4: Integration

1. Export from `src/index.ts`:
   ```typescript
   export { createTelemetryInfoShoppingComponent } from './components/telemetry-info-shopping';
   export type {
     TelemetryInfoOptions,
     TelemetryInfoComponent,
     ChartColors,
     EnergyState,
     WaterState
   } from './components/telemetry-info-shopping/types';
   ```

2. Create showcase HTML with mock data

### Showcase Usage

```html
<script type="module">
  import { createTelemetryInfoShoppingComponent } from '/dist/index.esm.js';

  const component = createTelemetryInfoShoppingComponent({
    container: '#telemetry-info-container',
    domain: 'energy',
    chartColors: {
      climatizacao: '#00C896',
      elevadores: '#5B2EBC',
      escadasRolantes: '#FF6B6B',
      lojas: '#FFC107',
      outros: '#9C27B0',
      areaComum: '#4CAF50'
    },
    onCategoryClick: (category, devices) => {
      console.log('Category clicked:', category, devices);
    }
  });

  // Simulate data update
  component.setEnergyData({
    entrada: { total: 15000, devices: [] },
    lojas: { total: 5000, perc: 33.3, devices: [] },
    climatizacao: { total: 4500, perc: 30, devices: [] },
    elevadores: { total: 1500, perc: 10, devices: [] },
    escadasRolantes: { total: 750, perc: 5, devices: [] },
    outros: { total: 1250, perc: 8.3, devices: [] },
    areaComum: { total: 2000, perc: 13.3, devices: [] }
  });
</script>
```

## Migration Path

### From ThingsBoard Widget

```javascript
// Old: ThingsBoard widget controller
self.onInit = async function() {
  // Widget-specific initialization
};

// New: Library component
import { createTelemetryInfoShoppingComponent } from 'myio-js-library';

const telemetryInfo = createTelemetryInfoShoppingComponent({
  container: self.ctx.$container[0],
  domain: self.ctx.settings?.DOMAIN || 'energy',
  chartColors: self.ctx.settings?.chartColors,
  waterIncludeBathrooms: self.ctx.settings?.waterIncludeBathrooms
});

// Events still work the same way
window.addEventListener('myio:telemetry:provide-data', (ev) => {
  telemetryInfo.setData(ev.detail);
});
```

## Showcase Server

Port: **3337**

```bash
# Windows
start-server.bat

# Linux/Mac
./start-server.sh
```

## Testing

### Manual Testing

1. Energy domain rendering
2. Water domain rendering
3. Chart rendering and animations
4. Modal open/close
5. Category click callbacks
6. Data updates via events
7. Theme switching (light/dark)
8. Measurement unit changes

### Unit Tests

- State management functions
- Percentage calculations
- Residual calculations (área comum)
- Device classification

## Risks

1. **Chart.js dependency** - External library required
2. **Modal z-index conflicts** - May conflict with other modals
3. **Large state objects** - Memory considerations for many devices
4. **Cross-browser canvas** - Chart.js canvas rendering differences

## References

- [RFC-0056: 6 Categories + Light Mode](./RFC-0056.md)
- [RFC-0105: Device Status Aggregation](./RFC-0105.md)
- [RFC-0106: STATE from Summary](./RFC-0106.md)
- [RFC-0108: Measurement Settings](./RFC-0108.md)
- [RFC-0134: Build Local Server Simulation](./RFC-0134--BuildLocalServerSimulationThingsboard.md)
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
