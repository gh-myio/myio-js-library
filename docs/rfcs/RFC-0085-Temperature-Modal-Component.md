# RFC-0085: Temperature Modal Component (openTemperatureModal)

**Status**: 📋 Proposed
**Created**: 2025-01-25
**Author**: Claude Code
**Priority**: High

## Summary

Extrair a funcionalidade de modal de temperatura que atualmente está injetada no widget `TELEMETRY` (`controller.js`) e transformá-la em um componente reutilizável exportado pela biblioteca como `openTemperatureModal`.

## Problem

### Situação Atual (Problemática):

```
src/thingsboard/.../WIDGET/TELEMETRY/controller.js
  └─ Linhas 1276-1792: Código de modal de temperatura INJETADO
       ├─ Fetch de telemetria temperature via ThingsBoard API
       ├─ Clamping de outliers (15-40°C)
       ├─ Cálculo de estatísticas (avg, min, max)
       ├─ Renderização de gráfico canvas customizado
       ├─ Seletor de data (startDate/endDate)
       ├─ Botão "Consultar" para atualizar período
       └─ CSS inline + HTML inline (~500 linhas)
```

**Problemas**:
1. ❌ **Código duplicado**: Lógica complexa misturada com widget
2. ❌ **Difícil manutenção**: Mudanças requerem editar widget gigante
3. ❌ **Não reutilizável**: Impossível usar fora do widget TELEMETRY
4. ❌ **Testes impossíveis**: Código acoplado ao ThingsBoard
5. ❌ **~500 linhas inline**: CSS + HTML + JS misturados

### O Que Deveria Ser:

```
src/components/TemperatureModal.ts (NOVO)
  └─ Componente exportado na lib
       ├─ openTemperatureModal(params)
       ├─ Standalone modal com gráfico
       ├─ API consistente (similar a DemandModal/RealTimeTelemetryModal)
       └─ Testável e reutilizável

src/index.ts
  └─ export { openTemperatureModal }

Widget TELEMETRY
  └─ Apenas chama: await openTemperatureModal({ ... })
```

## Design

### Nova Modal: `TemperatureModal`

#### Interface TypeScript

```typescript
export interface TemperatureModalParams {
  // Required
  token: string;                       // JWT token ThingsBoard
  deviceId: string;                    // ThingsBoard device UUID
  startDate: string;                   // ISO datetime "YYYY-MM-DDTHH:mm:ss"
  endDate: string;                     // ISO datetime "YYYY-MM-DDTHH:mm:ss"

  // Optional
  label?: string;                      // Device label (default: "Dispositivo")
  currentTemperature?: number;         // Current temp value (for display)
  temperatureMin?: number;             // Min threshold (for visual range)
  temperatureMax?: number;             // Max threshold (for visual range)
  temperatureStatus?: 'ok' | 'above' | 'below'; // Status indicator
  container?: HTMLElement | string;    // Mount container (default: body)
  onClose?: () => void;                // Callback when modal closes
  locale?: 'pt-BR' | 'en-US';         // Locale (default: 'pt-BR')

  // Advanced
  clampRange?: { min: number; max: number }; // Outlier clamping (default: 15-40°C)
  styles?: Partial<TemperatureModalStyles>; // Style overrides
}

export interface TemperatureModalInstance {
  destroy: () => void;
  updateData: (startDate: string, endDate: string) => Promise<void>;
}

export interface TemperatureModalStyles {
  primaryColor: string;
  dangerColor: string;
  warningColor: string;
  successColor: string;
}
```

#### Funcionalidades Principais

1. **Fetch de Telemetria Temperature**
   - ThingsBoard API: `/api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries?keys=temperature`
   - Parâmetros: `startTs`, `endTs`, `limit=50000`, `agg=NONE`
   - Retry logic em caso de erro

2. **Outlier Clamping**
   ```typescript
   function clampTemperature(value: number, range = { min: 15, max: 40 }): number {
     if (value < range.min) return range.min;
     if (value > range.max) return range.max;
     return value;
   }
   ```

3. **Estatísticas Calculadas**
   ```typescript
   interface TemperatureStats {
     avg: number;      // Média
     min: number;      // Mínima
     max: number;      // Máxima
     count: number;    // Quantidade de leituras
   }
   ```

4. **Gráfico Canvas Customizado**
   - Linha temporal com interpolação
   - Eixo X: Data/Hora formatada
   - Eixo Y: Temperatura (°C)
   - Linhas de threshold (min/max) tracejadas
   - Tooltip ao hover

5. **Seletor de Período**
   - Dois inputs: startDate, endDate (datetime-local)
   - Botão "Consultar" para buscar novo período
   - Loading state durante fetch

6. **Cards de Estatísticas**
   ```
   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  Atual   │  │  Média   │  │  Mínima  │  │  Máxima  │
   │  24.5°C  │  │  23.8°C  │  │  18.2°C  │  │  28.7°C  │
   │  ✅ OK   │  │          │  │          │  │          │
   └──────────┘  └──────────┘  └──────────┘  └──────────┘
   ```

#### Interface Visual

```
┌───────────────────────────────────────────────────────────┐
│  🌡️  Temperatura - [Device Name]              [X] Fechar │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │  Atual   │  │  Média   │  │  Mínima  │  │  Máxima  ││
│  │  24.5°C  │  │  23.8°C  │  │  18.2°C  │  │  28.7°C  ││
│  │  ✅ OK   │  │  ~500    │  │          │  │          ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│                                                           │
│  ┌─────────────────── Gráfico ─────────────────────────┐│
│  │                                                      ││
│  │  30°C ┌─────────────────────────────────────────┐  ││
│  │       │       Linha temperatura (azul)          │  ││
│  │  25°C │           ╱╲    ╱╲                      │  ││
│  │       │          ╱  ╲  ╱  ╲                     │  ││
│  │  20°C │   ····························· (max)   │  ││
│  │       │         ╱    ╲╱    ╲                    │  ││
│  │  15°C │   ····························· (min)   │  ││
│  │       └──────────────────────────────────────────┘  ││
│  │        00:00  04:00  08:00  12:00  16:00  20:00    ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  📅 Período:                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐       │
│  │ 📅 01/01/2025 00:00 │  │ 📅 25/01/2025 23:59 │       │
│  └─────────────────────┘  └─────────────────────┘       │
│                                                           │
│  [🔍 Consultar]                                          │
│                                                           │
│  💡 Leituras consideradas: 500 pontos                    │
│  ⚠️  Valores fora de 15-40°C são ajustados               │
│                                                           │
│  [⬇️ Exportar CSV]  [📄 Gerar Relatório]  [Fechar]     │
└───────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Create Component Structure

#### 1. Create `src/components/TemperatureModal.ts`
```typescript
/**
 * RFC-0085: Temperature Modal Component
 *
 * Displays temperature telemetry data with statistics and timeline chart.
 * Fetches data from ThingsBoard API.
 */

export interface TemperatureModalParams { ... }
export interface TemperatureModalInstance { ... }

export async function openTemperatureModal(
  params: TemperatureModalParams
): Promise<TemperatureModalInstance> {
  // Implementation
}
```

#### 2. Key Functions to Implement

```typescript
// Data fetching
async function fetchTemperatureData(
  token: string,
  deviceId: string,
  startTs: number,
  endTs: number
): Promise<TemperatureTelemetry[]>

// Statistics calculation
function calculateStats(
  data: TemperatureTelemetry[],
  clampRange: { min: number; max: number }
): TemperatureStats

// Outlier clamping
function clampTemperature(
  value: number,
  range: { min: number; max: number }
): number

// Chart rendering
function drawTemperatureChart(
  canvas: HTMLCanvasElement,
  data: TemperatureTelemetry[],
  minRange?: number,
  maxRange?: number
): void

// CSV export
function exportTemperatureCSV(
  data: TemperatureTelemetry[],
  deviceLabel: string,
  stats: TemperatureStats
): void
```

### Phase 2: Migrate Existing Code

#### Files to Extract From:

**Source**: `src/thingsboard/.../WIDGET/TELEMETRY/controller.js`

| Lines | Description | Destination |
|-------|-------------|-------------|
| 1276-1336 | Temperature data fetch + stats | `fetchTemperatureData()` |
| 1337-1468 | Modal HTML structure | Modal template in `TemperatureModal.ts` |
| 1305-1312 | Clamping function | `clampTemperature()` |
| 1501-1633 | Canvas chart drawing | `drawTemperatureChart()` |
| 1652-1662 | Stats update logic | `calculateStats()` |
| 1697-1760 | Date query handler | Event listener in modal |

#### Files to Modify:

**1. `src/components/TemperatureModal.ts` (CREATE)**
- New standalone component
- TypeScript interfaces
- Self-contained modal logic
- Canvas chart rendering
- Date selector + query button

**2. `src/index.ts` (MODIFY)**
```typescript
// RFC-0085: Temperature Modal Component
export { openTemperatureModal } from './components/TemperatureModal';
export type {
  TemperatureModalParams,
  TemperatureModalInstance,
  TemperatureStats
} from './components/TemperatureModal';
```

**3. `src/thingsboard/.../WIDGET/TELEMETRY/controller.js` (SIMPLIFY)**

**Before** (lines 1276-1792):
```javascript
// 500+ lines of inline modal code
if (isTermostato) {
  // Fetch temperature data
  const url = `/api/plugins/telemetry/...`;
  const response = await fetch(url, ...);
  const data = await response.json();

  // Calculate stats
  let avgTemp = ...;
  let minTemp = ...;

  // Create modal HTML (200+ lines)
  const modalHTML = `<div>...</div>`;

  // Draw chart (150+ lines)
  const canvas = ...;
  canvas.drawChart(...);
}
```

**After** (10 lines):
```javascript
if (isTermostato) {
  await MyIO.openTemperatureModal({
    token: jwtToken,
    deviceId: it.tbId || it.id,
    startDate: new Date(startTs).toISOString(),
    endDate: new Date(endTs).toISOString(),
    label: it.label || 'Dispositivo',
    currentTemperature: it.temperature,
    temperatureMin: it.temperatureMin,
    temperatureMax: it.temperatureMax,
    temperatureStatus: it.temperatureStatus,
    locale: 'pt-BR'
  });
}
```

### Phase 3: Testing & Validation

#### Test Cases

```typescript
// Test 1: Modal opens with valid data
await openTemperatureModal({
  token: 'valid-jwt',
  deviceId: 'device-uuid',
  startDate: '2025-01-01T00:00:00-03:00',
  endDate: '2025-01-25T23:59:59-03:00',
  label: 'Sensor Allegria'
});

// Test 2: Outlier clamping works
const clamped = clampTemperature(50); // Should return 40
const clamped2 = clampTemperature(5); // Should return 15

// Test 3: Stats calculation
const stats = calculateStats([
  { ts: 1000, value: 20 },
  { ts: 2000, value: 25 },
  { ts: 3000, value: 22 }
]);
// Expected: { avg: 22.33, min: 20, max: 25, count: 3 }

// Test 4: Date query updates chart
const instance = await openTemperatureModal({...});
await instance.updateData('2025-01-20T00:00:00', '2025-01-21T23:59:59');
```

## Migration Strategy

### Step 1: Create Component (v0.1.137)
- ✅ Create `TemperatureModal.ts` with full implementation
- ✅ Export in `index.ts`
- ✅ Build and test standalone

### Step 2: Integrate in Widget (v0.1.138)
- ✅ Import in TELEMETRY widget
- ✅ Replace inline code with component call
- ✅ Test in ThingsBoard dashboard

### Step 3: Cleanup (v0.1.139)
- ✅ Remove old inline code from controller.js
- ✅ Update documentation
- ✅ Add unit tests

## API Examples

### Basic Usage

```typescript
import { openTemperatureModal } from 'myio-js-library';

const modal = await openTemperatureModal({
  token: localStorage.getItem('jwt_token'),
  deviceId: '1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6',
  startDate: '2025-01-01T00:00:00-03:00',
  endDate: '2025-01-25T23:59:59-03:00',
  label: 'Sensor Sala Principal',
  currentTemperature: 24.5,
  temperatureMin: 18,
  temperatureMax: 28,
  temperatureStatus: 'ok'
});

// Later: programatically update date range
await modal.updateData(
  '2025-01-20T00:00:00-03:00',
  '2025-01-25T23:59:59-03:00'
);

// Close modal
modal.destroy();
```

### Advanced Usage (Custom Styles)

```typescript
await openTemperatureModal({
  token: jwtToken,
  deviceId: deviceId,
  startDate: startISO,
  endDate: endISO,
  label: 'Termostato Allegria',
  clampRange: { min: 10, max: 50 }, // Custom clamping
  styles: {
    primaryColor: '#1976d2',
    dangerColor: '#d32f2f',
    warningColor: '#ffa726',
    successColor: '#66bb6a'
  },
  onClose: () => {
    console.log('Modal closed');
  }
});
```

## Breaking Changes

**None** - This is a new component addition.

Existing widget code will continue to work until migration is complete.

## Benefits

### Before RFC-0085:
- ❌ 500+ lines inline in widget
- ❌ Impossible to test
- ❌ Not reusable
- ❌ Hard to maintain
- ❌ Mixed concerns (widget + modal)

### After RFC-0085:
- ✅ Standalone component (~400 lines)
- ✅ Fully testable
- ✅ Reusable anywhere
- ✅ Easy to maintain
- ✅ Separation of concerns
- ✅ Consistent API with other modals
- ✅ TypeScript type safety

## Open Questions

1. **Should we support Chart.js instead of canvas?**
   - Current: Custom canvas rendering
   - Alternative: Use Chart.js for consistency
   - **Decision**: Start with canvas (matches current), consider Chart.js in RFC-0086

2. **Should we add real-time mode (auto-refresh)?**
   - Similar to RFC-0082 (DemandModal real-time)
   - **Decision**: Add in Phase 4 (optional enhancement)

3. **Export to PDF?**
   - Current: Only CSV export
   - **Decision**: Add PDF in separate RFC (consistent with other modals)

4. **Should we interpolate missing data?**
   - Similar to RFC-0083 (30-min interpolation)
   - **Decision**: No interpolation for now (temperature readings are sparse)

## References

- RFC-0082: Real-Time Mode (DemandModal)
- RFC-0083: Temperature Time Format & Interpolation
- RFC-0084: Real-Time Telemetry Modal
- Current implementation: `TELEMETRY/controller.js` lines 1276-1792
- ThingsBoard API: `/api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries`

## Success Criteria

- [ ] Component builds without errors
- [ ] Modal opens and displays temperature data correctly
- [ ] Statistics (avg, min, max) calculate correctly
- [ ] Outlier clamping works (15-40°C default)
- [ ] Chart renders temperature timeline
- [ ] Date selector updates chart data
- [ ] CSV export works
- [ ] Widget integration successful (replaces inline code)
- [ ] No regression in existing functionality
- [ ] TypeScript types exported correctly
- [ ] Documentation complete

## Timeline

- **Week 1**: Create component structure + API
- **Week 2**: Implement chart rendering + statistics
- **Week 3**: Widget integration + testing
- **Week 4**: Cleanup + documentation
