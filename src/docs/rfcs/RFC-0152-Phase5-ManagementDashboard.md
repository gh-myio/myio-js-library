# RFC-0152 Phase 5: Management Dashboard Panel

## Status: ⏳ PENDING

## Summary

Create a library component `operational-dashboard` that provides a high-level management view with KPI summary tiles focusing on MTBF, MTTR, availability, and operational metrics across the entire equipment fleet.

---

## Architecture

### Component Structure

```
src/components/operational-dashboard/
├── index.ts                              # Public exports
├── types.ts                              # TypeScript definitions
├── OperationalDashboardView.ts           # View layer
├── OperationalDashboardController.ts     # Controller layer
├── KPICard.ts                            # KPI card sub-component
├── ChartComponents.ts                    # Chart rendering utilities
└── styles.ts                             # CSS styles
```

---

## Component Interface

### Creation Function

```typescript
export function createOperationalDashboardComponent(
  params: OperationalDashboardParams
): OperationalDashboardInstance;
```

### Parameters

```typescript
interface OperationalDashboardParams {
  /** Container element */
  container: HTMLElement;

  /** Theme mode */
  themeMode?: 'light' | 'dark';

  /** Enable debug logging */
  enableDebugMode?: boolean;

  /** Initial period */
  initialPeriod?: DashboardPeriod;

  /** Initial KPIs data */
  kpis?: DashboardKPIs;

  /** Initial trend data */
  trendData?: TrendDataPoint[];

  /** Initial downtime list */
  downtimeList?: DowntimeEntry[];

  /** Callback when period changes */
  onPeriodChange?: (period: DashboardPeriod) => void;

  /** Callback when refresh is requested */
  onRefresh?: () => void;
}
```

### Instance

```typescript
interface OperationalDashboardInstance {
  /** Update KPIs data */
  updateKPIs: (kpis: DashboardKPIs) => void;

  /** Update trend data */
  updateTrendData: (data: TrendDataPoint[]) => void;

  /** Update downtime list */
  updateDowntimeList: (list: DowntimeEntry[]) => void;

  /** Set loading state */
  setLoading: (isLoading: boolean) => void;

  /** Set period */
  setPeriod: (period: DashboardPeriod) => void;

  /** Get current period */
  getPeriod: () => DashboardPeriod;

  /** Set theme mode */
  setThemeMode: (mode: 'light' | 'dark') => void;

  /** Destroy and cleanup */
  destroy: () => void;

  /** Root DOM element */
  element: HTMLElement;
}
```

---

## Data Types

### Dashboard KPIs

```typescript
export type DashboardPeriod = 'today' | 'week' | 'month' | 'quarter';

export interface DashboardKPIs {
  /** Fleet-wide availability percentage */
  fleetAvailability: number;

  /** Availability trend vs previous period (positive = improvement) */
  availabilityTrend: number;

  /** Fleet-wide average MTBF in hours */
  fleetMTBF: number;

  /** Fleet-wide average MTTR in hours */
  fleetMTTR: number;

  /** Total equipment count */
  totalEquipment: number;

  /** Online equipment count */
  onlineCount: number;

  /** Offline equipment count */
  offlineCount: number;

  /** Maintenance equipment count */
  maintenanceCount: number;
}
```

### Trend Data

```typescript
export interface TrendDataPoint {
  /** Date/time label */
  label: string;

  /** Timestamp */
  timestamp: number;

  /** Value (availability, MTBF, etc.) */
  value: number;

  /** Optional secondary value (e.g., MTTR) */
  secondaryValue?: number;
}
```

### Downtime Entry

```typescript
export interface DowntimeEntry {
  /** Equipment name */
  name: string;

  /** Location/Shopping name */
  location: string;

  /** Total downtime hours */
  downtime: number;

  /** Percentage of total period */
  percentage: number;
}
```

---

## KPI Formulas

```typescript
// src/components/operational-dashboard/utils.ts

/**
 * Calculate MTBF (Mean Time Between Failures)
 * MTBF = (Total Operating Time - Maintenance Time) / Number of Failures
 */
export function calculateMTBF(
  operatingHours: number,
  maintenanceHours: number,
  failureCount: number
): number {
  if (failureCount === 0) return operatingHours;
  return (operatingHours - maintenanceHours) / failureCount;
}

/**
 * Calculate MTTR (Mean Time To Repair)
 * MTTR = Total Maintenance Time / Number of Failures
 */
export function calculateMTTR(
  maintenanceHours: number,
  failureCount: number
): number {
  if (failureCount === 0) return 0;
  return maintenanceHours / failureCount;
}

/**
 * Calculate Availability
 * Availability = (MTBF / (MTBF + MTTR)) * 100
 */
export function calculateAvailability(mtbf: number, mttr: number): number {
  if (mtbf + mttr === 0) return 100;
  return (mtbf / (mtbf + mttr)) * 100;
}

/**
 * Format hours for display
 */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}
```

---

## View Implementation

### Main Template

```typescript
private buildHTML(): string {
  return `
    <div class="myio-dashboard-root" data-theme="${this.themeMode}">
      <!-- Header -->
      <header class="dashboard-header">
        <h1>Dashboard Gerencial</h1>
        <div class="header-actions">
          <select id="periodSelector" class="period-select">
            <option value="today" ${this.period === 'today' ? 'selected' : ''}>Hoje</option>
            <option value="week" ${this.period === 'week' ? 'selected' : ''}>Esta Semana</option>
            <option value="month" ${this.period === 'month' ? 'selected' : ''}>Este Mês</option>
            <option value="quarter" ${this.period === 'quarter' ? 'selected' : ''}>Este Trimestre</option>
          </select>
          <button class="refresh-btn" id="refreshBtn" title="Atualizar">🔄</button>
        </div>
      </header>

      <!-- Primary KPIs -->
      <section class="kpi-grid primary">
        ${this.renderPrimaryKPIs()}
      </section>

      <!-- Secondary KPIs (Equipment Status) -->
      <section class="kpi-grid secondary">
        ${this.renderSecondaryKPIs()}
      </section>

      <!-- Charts Section -->
      <section class="charts-grid">
        ${this.renderCharts()}
      </section>

      <!-- Loading Overlay -->
      <div class="loading-overlay" id="loadingState">
        <div class="spinner"></div>
        <p>Carregando dados...</p>
      </div>
    </div>
  `;
}
```

### Primary KPIs

```typescript
private renderPrimaryKPIs(): string {
  const kpis = this.kpis;
  const trendClass = kpis.availabilityTrend >= 0 ? 'positive' : 'negative';
  const trendIcon = kpis.availabilityTrend >= 0 ? '↑' : '↓';

  return `
    <!-- Availability (Large) -->
    <div class="kpi-card large availability">
      <div class="kpi-icon">📊</div>
      <div class="kpi-content">
        <span class="kpi-value">${kpis.fleetAvailability.toFixed(1)}%</span>
        <span class="kpi-label">Disponibilidade da Frota</span>
        <span class="kpi-trend ${trendClass}">
          ${trendIcon} ${Math.abs(kpis.availabilityTrend).toFixed(1)}%
        </span>
      </div>
    </div>

    <!-- MTBF -->
    <div class="kpi-card mtbf">
      <div class="kpi-icon">⏱️</div>
      <div class="kpi-content">
        <span class="kpi-value">${kpis.fleetMTBF}h</span>
        <span class="kpi-label">MTBF Médio</span>
        <span class="kpi-sublabel">Tempo Médio Entre Falhas</span>
      </div>
    </div>

    <!-- MTTR -->
    <div class="kpi-card mttr">
      <div class="kpi-icon">🔧</div>
      <div class="kpi-content">
        <span class="kpi-value">${kpis.fleetMTTR.toFixed(1)}h</span>
        <span class="kpi-label">MTTR Médio</span>
        <span class="kpi-sublabel">Tempo Médio de Reparo</span>
      </div>
    </div>
  `;
}
```

### Secondary KPIs (Equipment Status)

```typescript
private renderSecondaryKPIs(): string {
  const kpis = this.kpis;

  return `
    <div class="kpi-card small total">
      <span class="kpi-value">${kpis.totalEquipment}</span>
      <span class="kpi-label">Total Equipamentos</span>
    </div>
    <div class="kpi-card small online">
      <span class="kpi-value">${kpis.onlineCount}</span>
      <span class="kpi-label">Online</span>
      <div class="kpi-indicator" style="background: #22c55e"></div>
    </div>
    <div class="kpi-card small offline">
      <span class="kpi-value">${kpis.offlineCount}</span>
      <span class="kpi-label">Offline</span>
      <div class="kpi-indicator" style="background: #ef4444"></div>
    </div>
    <div class="kpi-card small maintenance">
      <span class="kpi-value">${kpis.maintenanceCount}</span>
      <span class="kpi-label">Em Manutenção</span>
      <div class="kpi-indicator" style="background: #f59e0b"></div>
    </div>
  `;
}
```

### Charts Section

```typescript
private renderCharts(): string {
  return `
    <!-- Availability Trend -->
    <div class="chart-tile">
      <h3>Disponibilidade por Período</h3>
      <div class="chart-area" id="availabilityChart">
        ${this.renderAvailabilityChart()}
      </div>
    </div>

    <!-- MTBF/MTTR Trend -->
    <div class="chart-tile">
      <h3>MTBF / MTTR Tendência</h3>
      <div class="chart-area" id="mtbfMttrChart">
        ${this.renderMtbfMttrChart()}
      </div>
    </div>

    <!-- Status Distribution -->
    <div class="chart-tile">
      <h3>Equipamentos por Status</h3>
      <div class="chart-area" id="statusChart">
        ${this.renderStatusDonutChart()}
      </div>
    </div>

    <!-- Top Downtime -->
    <div class="chart-tile">
      <h3>Top 5 - Maior Downtime</h3>
      <div class="downtime-list" id="downtimeList">
        ${this.renderDowntimeList()}
      </div>
    </div>
  `;
}
```

### Downtime List

```typescript
private renderDowntimeList(): string {
  if (this.downtimeList.length === 0) {
    return '<p class="no-data">Sem dados de downtime</p>';
  }

  return this.downtimeList.map((item, index) => `
    <div class="downtime-item">
      <span class="rank">${index + 1}</span>
      <div class="item-info">
        <span class="item-name">${item.name}</span>
        <span class="item-location">${item.location}</span>
      </div>
      <div class="item-metrics">
        <span class="downtime-hours">${item.downtime}h</span>
        <div class="downtime-bar">
          <div class="bar-fill" style="width: ${item.percentage}%"></div>
        </div>
        <span class="downtime-percentage">${item.percentage.toFixed(1)}%</span>
      </div>
    </div>
  `).join('');
}
```

---

## Dashboard Layout

### Visual Specification

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Dashboard Gerencial                         [Este Mês ▼] [🔄]           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │      📊 94.7%         │  │    ⏱️ 342h      │  │    🔧 4.2h      │   │
│  │  Disponibilidade      │  │   MTBF Médio    │  │   MTTR Médio    │   │
│  │      +2.3% ↑          │  │                 │  │                 │   │
│  │                       │  │  Tempo Médio    │  │  Tempo Médio    │   │
│  │      (large)          │  │  Entre Falhas   │  │  de Reparo      │   │
│  └───────────────────────┘  └─────────────────┘  └─────────────────┘   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐                        │
│  │   48   │  │   42   │  │    3   │  │    3   │                        │
│  │ Total  │  │ Online │  │Offline │  │ Manut. │                        │
│  │        │  │   🟢   │  │   🔴   │  │   🟡   │                        │
│  └────────┘  └────────┘  └────────┘  └────────┘                        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐      │
│  │ Disponibilidade/Período     │  │   MTBF / MTTR Tendência     │      │
│  │                             │  │                             │      │
│  │   📈 Line Chart             │  │   📈 Dual Line Chart        │      │
│  │                             │  │                             │      │
│  └─────────────────────────────┘  └─────────────────────────────┘      │
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐      │
│  │ Equipamentos por Status     │  │ Top 5 - Maior Downtime      │      │
│  │                             │  │                             │      │
│  │   🍩 Donut Chart            │  │ 1. ESC-02 (Méier)    48h    │      │
│  │   - Online: 42              │  │    ████████████░░░   15%    │      │
│  │   - Offline: 3              │  │ 2. ELV-05 (Central) 32h     │      │
│  │   - Manutenção: 3           │  │    ██████████░░░░░   10%    │      │
│  │                             │  │ 3. ESC-08 (Madur.)  24h     │      │
│  └─────────────────────────────┘  └─────────────────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Period Options

| Value | Label | Description |
|-------|-------|-------------|
| `today` | Hoje | Current day (00:00 to now) |
| `week` | Esta Semana | Current week (Monday to now) |
| `month` | Este Mês | Current month (1st to now) |
| `quarter` | Este Trimestre | Current quarter |

---

## Integration with MAIN_UNIQUE_DATASOURCE

```javascript
// In MAIN_UNIQUE_DATASOURCE controller.js

window.addEventListener('myio:switch-main-state', (ev) => {
  if (ev.detail?.stateId === 'operational_dashboard') {
    renderOperationalDashboard();
  }
});

function renderOperationalDashboard() {
  const container = document.getElementById('mainContentContainer');
  if (!container) return;

  const dashboardComponent = MyIOLibrary.createOperationalDashboardComponent({
    container,
    themeMode: currentThemeMode,
    enableDebugMode: DEBUG_ACTIVE,
    initialPeriod: 'month',
    onPeriodChange: async (period) => {
      console.log('Period changed:', period);
      dashboardComponent.setLoading(true);
      const data = await fetchDashboardData(period);
      dashboardComponent.updateKPIs(data.kpis);
      dashboardComponent.updateTrendData(data.trendData);
      dashboardComponent.updateDowntimeList(data.downtimeList);
      dashboardComponent.setLoading(false);
    },
    onRefresh: async () => {
      console.log('Refresh requested');
      dashboardComponent.setLoading(true);
      const data = await fetchDashboardData(dashboardComponent.getPeriod());
      dashboardComponent.updateKPIs(data.kpis);
      dashboardComponent.updateTrendData(data.trendData);
      dashboardComponent.updateDowntimeList(data.downtimeList);
      dashboardComponent.setLoading(false);
    },
  });

  _operationalDashboardRef = dashboardComponent;

  // Initial data fetch
  fetchDashboardData('month').then(data => {
    dashboardComponent.updateKPIs(data.kpis);
    dashboardComponent.updateTrendData(data.trendData);
    dashboardComponent.updateDowntimeList(data.downtimeList);
  });
}
```

---

## Files to Create

| File | Description |
|------|-------------|
| `src/components/operational-dashboard/index.ts` | Public exports |
| `src/components/operational-dashboard/types.ts` | TypeScript definitions |
| `src/components/operational-dashboard/OperationalDashboardView.ts` | Main view |
| `src/components/operational-dashboard/OperationalDashboardController.ts` | Controller |
| `src/components/operational-dashboard/KPICard.ts` | KPI card component |
| `src/components/operational-dashboard/ChartComponents.ts` | Chart utilities |
| `src/components/operational-dashboard/utils.ts` | KPI calculation functions |
| `src/components/operational-dashboard/styles.ts` | CSS styles |

---

## Exports to Add (`src/index.ts`)

```typescript
// RFC-0152: Operational Dashboard Component
export { createOperationalDashboardComponent } from './components/operational-dashboard';

export type {
  OperationalDashboardParams,
  OperationalDashboardInstance,
  DashboardKPIs,
  DashboardPeriod,
  TrendDataPoint,
  DowntimeEntry,
} from './components/operational-dashboard';

export {
  calculateMTBF,
  calculateMTTR,
  calculateAvailability,
} from './components/operational-dashboard';
```

---

## Testing Checklist

### KPI Cards
- [ ] Fleet Availability displays correctly
- [ ] Trend indicator shows correct direction (↑/↓) and color
- [ ] MTBF displays in hours
- [ ] MTTR displays with decimal
- [ ] Equipment counts are correct (total = online + offline + maintenance)
- [ ] Status indicators show correct colors

### Period Selector
- [ ] Period dropdown works
- [ ] Data updates when period changes
- [ ] Loading state shows during fetch
- [ ] Selected period persists

### Charts
- [ ] Availability trend chart renders
- [ ] MTBF/MTTR dual line chart renders
- [ ] Status donut chart renders with legend
- [ ] Charts update when data changes
- [ ] Empty state shows when no data

### Downtime List
- [ ] Top 5 items display
- [ ] Sorted by highest downtime
- [ ] Progress bars show correct percentage
- [ ] Hours and percentage format correctly

### General
- [ ] Refresh button triggers data reload
- [ ] Theme toggle works
- [ ] Responsive layout (cards stack on mobile)
- [ ] Loading overlay shows/hides
- [ ] Component cleanup on destroy

---

## Dependencies

- **Phase 1**: User access gating
- **Phase 2**: Menu navigation
- **Phase 3**: Equipment data (for calculating fleet KPIs)
- **Types**: `src/types/operational.ts` (already created)
