# RFC-0152 Phase 4: Alarms and Notifications Panel

## Status: ⏳ PENDING

## Summary

Create a library component `operational-alarms` that provides a centralized view for alarms with two tabs: a filterable list view and a dashboard with KPI summaries. Follows the same architecture as `src/components/telemetry-grid`.

---

## Architecture

### Component Structure

```
src/components/operational-alarms/
├── index.ts                           # Public exports
├── types.ts                           # TypeScript definitions
├── OperationalAlarmsView.ts           # View layer (rendering)
├── OperationalAlarmsController.ts     # Controller layer (logic)
├── AlarmCard.ts                       # Reusable alarm card component
├── AlarmDashboard.ts                  # Dashboard sub-component
└── styles.ts                          # CSS styles (injected)
```

---

## Component Interface

### Creation Function

```typescript
// src/components/operational-alarms/index.ts

export function createOperationalAlarmsComponent(
  params: OperationalAlarmsParams
): OperationalAlarmsInstance;
```

### Parameters

```typescript
interface OperationalAlarmsParams {
  /** Container element */
  container: HTMLElement;

  /** Theme mode */
  themeMode?: 'light' | 'dark';

  /** Enable debug logging */
  enableDebugMode?: boolean;

  /** Initial alarms data */
  alarms?: Alarm[];

  /** Initial stats data (for dashboard) */
  stats?: AlarmStats;

  /** Initial active tab */
  initialTab?: 'list' | 'dashboard';

  /** Callback when alarm card is clicked */
  onAlarmClick?: (alarm: Alarm) => void;

  /** Callback when acknowledge button is clicked */
  onAcknowledge?: (alarmId: string) => void;

  /** Callback when tab changes */
  onTabChange?: (tab: 'list' | 'dashboard') => void;

  /** Callback when filters change */
  onFilterChange?: (filters: AlarmFilters) => void;
}
```

### Instance

```typescript
interface OperationalAlarmsInstance {
  /** Update alarms data */
  updateAlarms: (alarms: Alarm[]) => void;

  /** Update dashboard stats */
  updateStats: (stats: AlarmStats) => void;

  /** Set loading state */
  setLoading: (isLoading: boolean) => void;

  /** Set active tab */
  setActiveTab: (tab: 'list' | 'dashboard') => void;

  /** Get active tab */
  getActiveTab: () => 'list' | 'dashboard';

  /** Set theme mode */
  setThemeMode: (mode: 'light' | 'dark') => void;

  /** Get current filters */
  getFilters: () => AlarmFilters;

  /** Set filters */
  setFilters: (filters: Partial<AlarmFilters>) => void;

  /** Destroy and cleanup */
  destroy: () => void;

  /** Root DOM element */
  element: HTMLElement;
}
```

---

## Data Types

### Alarm Data

```typescript
// src/components/operational-alarms/types.ts

export type AlarmSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type AlarmState = 'OPEN' | 'ACK' | 'SNOOZED' | 'ESCALATED' | 'CLOSED';

export interface Alarm {
  /** Unique identifier */
  id: string;

  /** Customer ID */
  customerId: string;

  /** Customer/Shopping name */
  customerName: string;

  /** Source device/entity */
  source: string;

  /** Alarm severity */
  severity: AlarmSeverity;

  /** Current state */
  state: AlarmState;

  /** Alarm title */
  title: string;

  /** Detailed description */
  description: string;

  /** Custom tags */
  tags: Record<string, string>;

  /** First occurrence (ISO timestamp) */
  firstOccurrence: string;

  /** Last occurrence (ISO timestamp) */
  lastOccurrence: string;

  /** Occurrence count */
  occurrenceCount: number;

  /** Acknowledged timestamp */
  acknowledgedAt?: string;

  /** Acknowledged by user */
  acknowledgedBy?: string;

  /** Snoozed until timestamp */
  snoozedUntil?: string;

  /** Closed timestamp */
  closedAt?: string;

  /** Closed by user */
  closedBy?: string;

  /** Close reason */
  closedReason?: string;
}
```

### Alarm Stats (Dashboard)

```typescript
export interface AlarmStats {
  /** Total alarm count */
  total: number;

  /** Count by severity */
  bySeverity: Record<AlarmSeverity, number>;

  /** Count by state */
  byState: Record<AlarmState, number>;

  /** Open critical count */
  openCritical: number;

  /** Open high count */
  openHigh: number;

  /** Last 24 hours count */
  last24Hours: number;

  /** Trend data for charts */
  trendData?: AlarmTrendPoint[];
}

export interface AlarmTrendPoint {
  timestamp: number;
  label: string;
  count: number;
}
```

### Filters

```typescript
export interface AlarmFilters {
  /** Search query */
  search: string;

  /** Severity filter (multi-select) */
  severity: AlarmSeverity[] | null;

  /** State filter (multi-select) */
  state: AlarmState[] | null;

  /** Date range start */
  fromDate: string | null;

  /** Date range end */
  toDate: string | null;

  /** Customer ID filter */
  customerId: string | null;
}

export const DEFAULT_ALARM_FILTERS: AlarmFilters = {
  search: '',
  severity: null,
  state: null,
  fromDate: null,
  toDate: null,
  customerId: null,
};
```

---

## Configuration

### Severity Configuration

```typescript
export const SEVERITY_CONFIG: Record<AlarmSeverity, SeverityConfig> = {
  CRITICAL: {
    bg: 'rgba(239, 68, 68, 0.1)',
    border: '#ef4444',
    text: '#dc2626',
    icon: '🔴',
    label: 'Crítico',
  },
  HIGH: {
    bg: 'rgba(249, 115, 22, 0.1)',
    border: '#f97316',
    text: '#ea580c',
    icon: '🟠',
    label: 'Alto',
  },
  MEDIUM: {
    bg: 'rgba(234, 179, 8, 0.1)',
    border: '#eab308',
    text: '#ca8a04',
    icon: '🟡',
    label: 'Médio',
  },
  LOW: {
    bg: 'rgba(59, 130, 246, 0.1)',
    border: '#3b82f6',
    text: '#2563eb',
    icon: '🔵',
    label: 'Baixo',
  },
  INFO: {
    bg: 'rgba(107, 114, 128, 0.1)',
    border: '#6b7280',
    text: '#4b5563',
    icon: '⚪',
    label: 'Informativo',
  },
};
```

### State Configuration

```typescript
export const STATE_CONFIG: Record<AlarmState, StateConfig> = {
  OPEN: { label: 'Aberto', color: '#ef4444' },
  ACK: { label: 'Reconhecido', color: '#f59e0b' },
  SNOOZED: { label: 'Adiado', color: '#8b5cf6' },
  ESCALATED: { label: 'Escalado', color: '#dc2626' },
  CLOSED: { label: 'Fechado', color: '#6b7280' },
};
```

---

## View Implementation

### Main Template

```typescript
private buildHTML(): string {
  return `
    <div class="myio-alarms-root" data-theme="${this.themeMode}">
      <!-- Tab Navigation -->
      <nav class="myio-alarms-tabs">
        <button class="tab-btn ${this.activeTab === 'list' ? 'active' : ''}" data-tab="list">
          <span class="tab-icon">📋</span>
          <span>Lista de Alarmes</span>
        </button>
        <button class="tab-btn ${this.activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
          <span class="tab-icon">📊</span>
          <span>Dashboard</span>
        </button>
      </nav>

      <!-- List Tab Content -->
      <section class="tab-content ${this.activeTab === 'list' ? 'active' : ''}" id="listTab">
        ${this.buildListTabHTML()}
      </section>

      <!-- Dashboard Tab Content -->
      <section class="tab-content ${this.activeTab === 'dashboard' ? 'active' : ''}" id="dashboardTab">
        ${this.buildDashboardTabHTML()}
      </section>

      <!-- Loading State -->
      <div class="myio-alarms-loading" id="loadingState">
        <div class="spinner"></div>
        <p>Carregando alarmes...</p>
      </div>
    </div>
  `;
}
```

### List Tab Template

```typescript
private buildListTabHTML(): string {
  return `
    <!-- Premium Filters -->
    <div class="filters-section">
      <div class="filter-row">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="alarmSearch" placeholder="Buscar alarme..." />
        </div>
        <select id="severityFilter" class="filter-select" multiple>
          <option value="CRITICAL">Crítico</option>
          <option value="HIGH">Alto</option>
          <option value="MEDIUM">Médio</option>
          <option value="LOW">Baixo</option>
          <option value="INFO">Informativo</option>
        </select>
        <select id="stateFilter" class="filter-select" multiple>
          <option value="OPEN">Aberto</option>
          <option value="ACK">Reconhecido</option>
          <option value="SNOOZED">Adiado</option>
          <option value="ESCALATED">Escalado</option>
          <option value="CLOSED">Fechado</option>
        </select>
      </div>
      <div class="filter-row">
        <label>De:</label>
        <input type="date" id="dateFrom" />
        <label>Até:</label>
        <input type="date" id="dateTo" />
        <button class="clear-filters-btn" id="clearFilters">Limpar Filtros</button>
      </div>
    </div>

    <!-- Alarm Grid -->
    <div class="alarms-grid" id="alarmsGrid">
      <!-- Cards rendered dynamically -->
    </div>

    <!-- Empty State -->
    <div class="empty-state" id="emptyState">
      <div class="empty-icon">🔔</div>
      <p>Nenhum alarme encontrado</p>
    </div>
  `;
}
```

### Dashboard Tab Template

```typescript
private buildDashboardTabHTML(): string {
  return `
    <!-- KPI Summary Cards -->
    <div class="kpi-row">
      <div class="kpi-card">
        <span class="kpi-value" id="totalAlarms">0</span>
        <span class="kpi-label">Total Alarmes</span>
      </div>
      <div class="kpi-card critical">
        <span class="kpi-value" id="openCritical">0</span>
        <span class="kpi-label">Críticos Abertos</span>
      </div>
      <div class="kpi-card warning">
        <span class="kpi-value" id="openHigh">0</span>
        <span class="kpi-label">Altos Abertos</span>
      </div>
      <div class="kpi-card info">
        <span class="kpi-value" id="last24Hours">0</span>
        <span class="kpi-label">Últimas 24h</span>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="charts-row">
      <div class="chart-container">
        <h3>Tendência de Alarmes</h3>
        <div class="chart-area" id="trendChart">
          <!-- SVG chart rendered here -->
        </div>
      </div>
      <div class="chart-container">
        <h3>Alarmes por Estado</h3>
        <div class="chart-area" id="stateChart">
          <!-- Donut chart rendered here -->
        </div>
      </div>
      <div class="chart-container">
        <h3>Alarmes por Severidade</h3>
        <div class="chart-area" id="severityChart">
          <!-- Bar chart rendered here -->
        </div>
      </div>
    </div>
  `;
}
```

---

## Alarm Card Layout

### Visual Specification

```
┌─────────────────────────────────────────────────────────┐
│ ┌─────────────┐ ┌──────────────┐            há 5min    │
│ │🔴 CRITICAL  │ │   Aberto     │                       │
│ └─────────────┘ └──────────────┘                       │
├─────────────────────────────────────────────────────────┤
│ Falha de comunicação com dispositivo                    │
│ ALM-2024-001234                                         │
├─────────────────────────────────────────────────────────┤
│ ┌────┐                                                  │
│ │ SM │  Shopping Madureira                              │
│ └────┘  ESC-02 - Escada Rolante                         │
├─────────────────────────────────────────────────────────┤
│ 📊 15 ocorrências                                       │
│ ⏱️ Primeira: há 2 dias                                  │
│ 🕐 Última: há 5 minutos                                 │
├─────────────────────────────────────────────────────────┤
│ [tipo: comunicação] [zona: piso1] [+2]                  │
├─────────────────────────────────────────────────────────┤
│ [Reconhecer]  [Detalhes]                          [⋮]   │
└─────────────────────────────────────────────────────────┘
```

### Card Rendering

```typescript
// AlarmCard.ts

export function renderAlarmCard(alarm: Alarm): string {
  const severity = SEVERITY_CONFIG[alarm.severity];
  const state = STATE_CONFIG[alarm.state];
  const isActive = alarm.state === 'OPEN' || alarm.state === 'ESCALATED';
  const relativeTime = formatRelativeTime(alarm.lastOccurrence);

  return `
    <article class="alarm-card ${isActive ? 'active' : ''}"
             data-id="${alarm.id}"
             data-severity="${alarm.severity}"
             style="border-left: 4px solid ${severity.border}">

      <header class="card-header">
        <div class="badges">
          <span class="severity-badge" style="
            background: ${severity.bg};
            color: ${severity.text};
            border: 1px solid ${severity.border}
          ">
            ${severity.icon} ${severity.label}
          </span>
          <span class="state-badge" style="color: ${state.color}">
            ${state.label}
          </span>
        </div>
        <span class="last-occurrence">${relativeTime}</span>
      </header>

      <div class="card-body">
        <h3 class="alarm-title">${alarm.title}</h3>
        <p class="alarm-id">${alarm.id}</p>

        <div class="customer-info">
          <div class="customer-avatar">
            ${alarm.customerName.slice(0, 2).toUpperCase()}
          </div>
          <div class="customer-details">
            <span class="customer-name">${alarm.customerName}</span>
            <span class="alarm-source">${alarm.source}</span>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat">
            <span class="stat-icon">📊</span>
            <span>${alarm.occurrenceCount} ocorrências</span>
          </div>
          <div class="stat">
            <span class="stat-icon">⏱️</span>
            <span>Primeira: ${formatRelativeTime(alarm.firstOccurrence)}</span>
          </div>
          <div class="stat">
            <span class="stat-icon">🕐</span>
            <span>Última: ${relativeTime}</span>
          </div>
        </div>

        ${renderTags(alarm.tags)}
      </div>

      <footer class="card-footer">
        ${alarm.state === 'OPEN' ? `
          <button class="btn-ack" data-alarm-id="${alarm.id}">Reconhecer</button>
        ` : ''}
        <button class="btn-details" data-alarm-id="${alarm.id}">Detalhes</button>
        ${alarm.state !== 'CLOSED' ? `
          <button class="btn-more" data-alarm-id="${alarm.id}">⋮</button>
        ` : ''}
      </footer>
    </article>
  `;
}

function renderTags(tags: Record<string, string>): string {
  const entries = Object.entries(tags);
  if (entries.length === 0) return '';

  const visibleTags = entries.slice(0, 3);
  const remainingCount = entries.length - 3;

  return `
    <div class="tags-row">
      ${visibleTags.map(([k, v]) => `
        <span class="tag">${k}: ${v}</span>
      `).join('')}
      ${remainingCount > 0 ? `
        <span class="tag more">+${remainingCount}</span>
      ` : ''}
    </div>
  `;
}
```

---

## Dashboard Charts

### Simple SVG Charts (No External Dependencies)

```typescript
// AlarmDashboard.ts

/** Render trend line chart */
function renderTrendChart(data: AlarmTrendPoint[]): string {
  if (data.length === 0) return '<p class="no-data">Sem dados</p>';

  const width = 300;
  const height = 150;
  const padding = 20;
  const maxCount = Math.max(...data.map(d => d.count));

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - (d.count / maxCount) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart">
      <polyline
        points="${points}"
        fill="none"
        stroke="#8b5cf6"
        stroke-width="2"
      />
      ${data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - (d.count / maxCount) * (height - 2 * padding);
        return `<circle cx="${x}" cy="${y}" r="4" fill="#8b5cf6" />`;
      }).join('')}
    </svg>
  `;
}

/** Render donut chart for state distribution */
function renderStateDonutChart(byState: Record<AlarmState, number>): string {
  const total = Object.values(byState).reduce((a, b) => a + b, 0);
  if (total === 0) return '<p class="no-data">Sem dados</p>';

  // SVG donut chart implementation
  // ...
}

/** Render bar chart for severity distribution */
function renderSeverityBarChart(bySeverity: Record<AlarmSeverity, number>): string {
  const max = Math.max(...Object.values(bySeverity));
  if (max === 0) return '<p class="no-data">Sem dados</p>';

  return `
    <div class="bar-chart">
      ${Object.entries(bySeverity).map(([severity, count]) => {
        const config = SEVERITY_CONFIG[severity as AlarmSeverity];
        const percentage = (count / max) * 100;
        return `
          <div class="bar-item">
            <span class="bar-label">${config.icon} ${config.label}</span>
            <div class="bar-track">
              <div class="bar-fill" style="
                width: ${percentage}%;
                background: ${config.border}
              "></div>
            </div>
            <span class="bar-value">${count}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
```

---

## Integration with MAIN_UNIQUE_DATASOURCE

```javascript
// In MAIN_UNIQUE_DATASOURCE controller.js

window.addEventListener('myio:switch-main-state', (ev) => {
  if (ev.detail?.stateId === 'operational_alarms') {
    renderOperationalAlarms();
  }
});

function renderOperationalAlarms() {
  const container = document.getElementById('mainContentContainer');
  if (!container) return;

  const alarmsComponent = MyIOLibrary.createOperationalAlarmsComponent({
    container,
    themeMode: currentThemeMode,
    enableDebugMode: DEBUG_ACTIVE,
    initialTab: 'list',
    onAlarmClick: (alarm) => {
      console.log('Alarm clicked:', alarm);
      // TODO: Open alarm detail modal
    },
    onAcknowledge: async (alarmId) => {
      console.log('Acknowledge alarm:', alarmId);
      // TODO: Call API to acknowledge alarm
    },
    onTabChange: (tab) => {
      console.log('Tab changed:', tab);
    },
  });

  _operationalAlarmsRef = alarmsComponent;

  // Fetch mock data
  fetchAlarmsData().then(({ alarms, stats }) => {
    alarmsComponent.updateAlarms(alarms);
    alarmsComponent.updateStats(stats);
  });
}
```

---

## Files to Create

| File | Description |
|------|-------------|
| `src/components/operational-alarms/index.ts` | Public exports |
| `src/components/operational-alarms/types.ts` | TypeScript definitions |
| `src/components/operational-alarms/OperationalAlarmsView.ts` | Main view |
| `src/components/operational-alarms/OperationalAlarmsController.ts` | Controller |
| `src/components/operational-alarms/AlarmCard.ts` | Card component |
| `src/components/operational-alarms/AlarmDashboard.ts` | Dashboard component |
| `src/components/operational-alarms/styles.ts` | CSS styles |

---

## Exports to Add (`src/index.ts`)

```typescript
// RFC-0152: Operational Alarms Component
export { createOperationalAlarmsComponent } from './components/operational-alarms';

export type {
  OperationalAlarmsParams,
  OperationalAlarmsInstance,
  Alarm,
  AlarmSeverity,
  AlarmState,
  AlarmStats,
  AlarmFilters,
} from './components/operational-alarms';

export {
  SEVERITY_CONFIG,
  STATE_CONFIG,
  DEFAULT_ALARM_FILTERS,
} from './components/operational-alarms';
```

---

## Testing Checklist

### List Tab
- [ ] Alarms grid renders correctly
- [ ] Severity badges show correct colors/icons
- [ ] State badges show correct labels
- [ ] Relative time displays correctly
- [ ] Tags render (max 3 + count)
- [ ] CRITICAL alarms have pulsing animation
- [ ] Search filter works
- [ ] Severity multi-select filter works
- [ ] State multi-select filter works
- [ ] Date range filter works
- [ ] Clear filters button works
- [ ] Acknowledge button changes state
- [ ] Card click callback fires

### Dashboard Tab
- [ ] KPI cards show correct values
- [ ] Trend chart renders
- [ ] State donut chart renders
- [ ] Severity bar chart renders
- [ ] Charts update when data changes

### General
- [ ] Tab switching works
- [ ] Tab state persists during session
- [ ] Theme toggle works
- [ ] Loading state shows/hides
- [ ] Empty state shows when no alarms
- [ ] Responsive layout works
- [ ] Component cleanup on destroy

---

## Dependencies

- **Phase 1**: User access gating
- **Phase 2**: Menu navigation
- **Types**: `src/types/alarm.ts` (already created)
