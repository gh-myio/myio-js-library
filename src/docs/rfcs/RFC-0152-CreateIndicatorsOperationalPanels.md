# RFC-0152: Create Indicators Operational Panels

## Status

**In Progress** - Phases 1-2 implemented, Phases 3-5 pending

## Summary

Add a new menu column, **Operational Indicators**, gated by a customer `SERVER_SCOPE` attribute
(`show-indicators-operational-panels = true`). Provide three submenus:

1. General List
2. Alarms and Notifications
3. Operational Indicators Management Dashboard

The screens are built as new ThingsBoard widgets under
`src/MYIO-SIM/v5.2.0/` and follow existing UI patterns from the main dashboard cards.

## Motivation

Operations teams need a dedicated space for operational KPIs and alarm visibility that is
separate from current equipment dashboards, while reusing the existing design language.

## Scope

- Add a new menu column in `src/components/menu` with three submenus.
- Implement three panels as ThingsBoard widgets.
- Gate the menu entry by a `SERVER_SCOPE` attribute.

## Out of Scope

- Backend changes or new APIs.
- Changes to existing widgets outside this feature.

---

# Implementation Phases

## Phase 1: User Access Toggle & Gating

### Status: ✅ IMPLEMENTED

### Description

Gate the Operational Indicators feature by a customer attribute (`show-indicators-operational-panels`) stored in ThingsBoard's `SERVER_SCOPE`. Only authorized customers see the new functionality.

### Files Modified

| File | Changes |
|------|---------|
| `src/MYIO-SIM/v5.2.0/MAIN_UNIQUE_DATASOURCE/controller.js` | Added `fetchOperationalIndicatorsAccess()` function and event dispatch |

### Implementation Details

#### 1.1 Function Added to controller.js (lines ~300-350)

```javascript
// RFC-0152: Fetch Operational Indicators access from customer attributes
const fetchOperationalIndicatorsAccess = async () => {
  const customerTB_ID = getCustomerTB_ID();
  const jwt = getJwtToken();

  LogHelper.log('RFC-0152: Checking operational indicators access for customer:', customerTB_ID);

  if (!customerTB_ID || !jwt) {
    LogHelper.warn('RFC-0152: Missing customerTB_ID or JWT token');
    return { showOperationalPanels: false };
  }

  try {
    if (MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage) {
      const attrs = await MyIOLibrary.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
      const showOperationalPanels = attrs?.['show-indicators-operational-panels'] === true;

      LogHelper.log('RFC-0152: Operational indicators access:', showOperationalPanels);

      // Update MyIOUtils with operational indicators state
      if (window.MyIOUtils) {
        window.MyIOUtils.operationalIndicators = {
          enabled: showOperationalPanels,
        };
      }

      // Dispatch event for Menu component to react
      window.dispatchEvent(
        new CustomEvent('myio:operational-indicators-access', {
          detail: { enabled: showOperationalPanels },
        })
      );

      return { showOperationalPanels };
    }
  } catch (error) {
    LogHelper.error('RFC-0152: Failed to fetch operational indicators access:', error);
  }

  return { showOperationalPanels: false };
};
```

#### 1.2 Global State Exposed on window.MyIOUtils (line ~2305)

```javascript
window.MyIOUtils = {
  // ... existing properties ...
  // RFC-0152: Operational Indicators feature gating
  operationalIndicators: {
    enabled: false, // Will be set after attribute check
  },
};
```

#### 1.3 Function Called in onInit (line ~2438)

```javascript
// Fetch credentials from ThingsBoard
await fetchCredentialsFromThingsBoard();

// RFC-0152: Fetch Operational Indicators access
await fetchOperationalIndicatorsAccess();
```

### Event Dispatched

| Event | Detail |
|-------|--------|
| `myio:operational-indicators-access` | `{ enabled: boolean }` |

### Testing Checklist

- [ ] Create customer in ThingsBoard with `show-indicators-operational-panels = true`
- [ ] Verify `window.MyIOUtils.operationalIndicators.enabled` is `true`
- [ ] Create customer without attribute → verify `enabled` is `false`
- [ ] Verify event `myio:operational-indicators-access` is dispatched

---

## Phase 2: Menu Column & Navigation

### Status: ✅ IMPLEMENTED

### Description

Add a fourth menu column "Operational Indicators" alongside Energy, Water, and Temperature columns. This column only appears when the gating check passes.

### Files Modified

| File | Changes |
|------|---------|
| `src/components/menu/types.ts` | Added `OPERATIONAL_INDICATORS_TAB` constant |
| `src/components/menu/MenuView.ts` | Added 4th column logic, event listener, CSS for 4 columns |

### Implementation Details

#### 2.1 Tab Configuration Added to types.ts

```typescript
/**
 * RFC-0152: Operational Indicators Tab Configuration
 * Conditionally shown based on customer attribute 'show-indicators-operational-panels'
 */
export const OPERATIONAL_INDICATORS_TAB: TabConfig = {
  id: 'operational',
  label: 'Indicadores Operacionais',
  icon: '📊',
  contexts: [
    {
      id: 'general-list',
      target: 'operational_general_list',
      title: 'Lista Geral',
      description: 'Visao geral dos equipamentos operacionais',
      icon: '📋',
    },
    {
      id: 'alarms',
      target: 'operational_alarms',
      title: 'Alarmes e Notificacoes',
      description: 'Central de alarmes e alertas',
      icon: '🔔',
    },
    {
      id: 'dashboard',
      target: 'operational_dashboard',
      title: 'Dashboard Gerencial',
      description: 'KPIs e indicadores de gestao',
      icon: '📈',
    },
  ],
  defaultContext: 'general-list',
};
```

#### 2.2 State Variables Added to MenuView.ts

```typescript
// RFC-0152: Operational Indicators tab state
private operationalTabEnabled = false;
private operationalAccessHandler: ((ev: Event) => void) | null = null;
```

#### 2.3 Event Listener in bindEvents()

```typescript
// RFC-0152: Operational Indicators Access
this.operationalAccessHandler = (ev: Event) => {
  const customEv = ev as CustomEvent<{ enabled: boolean }>;
  const enabled = customEv.detail?.enabled === true;

  if (enabled && !this.operationalTabEnabled) {
    this.operationalTabEnabled = true;
    // Add operational tab to tabs array
    if (!this.tabs.find((t) => t.id === 'operational')) {
      this.tabs = [...this.tabs, OPERATIONAL_INDICATORS_TAB];
      this.contextsByTab.set(
        OPERATIONAL_INDICATORS_TAB.id,
        OPERATIONAL_INDICATORS_TAB.defaultContext ?? OPERATIONAL_INDICATORS_TAB.contexts[0]?.id ?? ''
      );
    }
    // Rebuild the unified modal to include the 4th column
    this.rebuildUnifiedModal();
  }
};
window.addEventListener('myio:operational-indicators-access', this.operationalAccessHandler);
```

#### 2.4 Methods Added to MenuView.ts

- `rebuildUnifiedModal()` - Rebuilds the modal with 4 columns
- `rebindUnifiedModalEvents()` - Re-binds events after rebuild

#### 2.5 CSS Added for 4-Column Layout

```css
/* RFC-0152: Operational Indicators Column Styling */
.myio-unified-column.operational .myio-unified-column-header {
  background: linear-gradient(135deg, #f3e8ff 0%, #ddd6fe 100%);
}

.myio-unified-option.operational:hover {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.2);
}

.myio-unified-option.operational.is-active {
  background: rgba(139, 92, 246, 0.12);
  border-color: #8b5cf6;
}

/* RFC-0152: 4-column layout when operational tab is enabled */
.myio-unified-modal-body.four-columns {
  min-width: 900px;
}

@media (max-width: 900px) {
  .myio-unified-modal-body.four-columns {
    flex-wrap: wrap;
  }
  .myio-unified-modal-body.four-columns .myio-unified-column {
    flex: 1 1 calc(50% - 1px);
  }
}
```

### Navigation State Events

When user selects an operational context, the following event is dispatched:

```javascript
// Existing event from handleUnifiedOptionSelect
window.dispatchEvent(new CustomEvent('myio:context-change', {
  detail: {
    tabId: 'operational',
    contextId: 'general-list' | 'alarms' | 'dashboard',
    target: 'operational_general_list' | 'operational_alarms' | 'operational_dashboard'
  }
}));
```

### Testing Checklist

- [ ] Enable attribute → verify 4th column appears in menu modal
- [ ] Click each submenu → verify `context-change` event fires with correct target
- [ ] Disable attribute → verify 4th column is hidden
- [ ] Test responsive layout (4 → 2 → 1 columns)
- [ ] Verify purple theme styling on operational column

---

## Phase 3: General List Panel

### Status: 🟡 PARTIAL (files created, needs completion)

### Description

Provide a list view of operational equipment (escalators, elevators) with KPI cards showing availability, MTBF, MTTR, and alert status.

### Files to Create/Modify

| File | Status | Description |
|------|--------|-------------|
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_GENERAL_LIST/controller.js` | ✅ Created | Widget controller with mock data |
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_GENERAL_LIST/styles.css` | ✅ Created | Component styles |
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_GENERAL_LIST/template.html` | ✅ Created | HTML template |
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_GENERAL_LIST/settingsSchema.json` | ⏳ Pending | Widget settings |
| `src/components/operational/EquipmentCard.ts` | ⏳ Pending | Reusable card component |
| `src/types/operational.ts` | ✅ Created | TypeScript definitions |

### Widget Structure

```
OPERATIONAL_GENERAL_LIST/
├── controller.js      # Widget lifecycle and data management
├── template.html      # HTML structure
├── styles.css         # Component styles
└── settingsSchema.json # Widget configuration
```

### Equipment Card Data Structure

```typescript
interface EquipmentCardData {
  id: string;
  name: string;                           // e.g., 'ESC-01', 'ELV-02'
  type: 'escada' | 'elevador';
  status: 'online' | 'offline' | 'maintenance';
  availability: number;                   // 0-100 percentage
  mtbf: number;                           // Mean Time Between Failures (hours)
  mttr: number;                           // Mean Time To Repair (hours)
  hasReversal: boolean;                   // Reversal detection warning
  recentAlerts: number;                   // Count of recent alerts
  customerName: string;                   // Shopping name
  location: string;                       // e.g., 'Piso 1', 'Torre A'
}
```

### Card Layout Specification

```
┌─────────────────────────────────────────┐
│ ESC-01                    [Online]      │
│ Escada Rolante                          │
│ Piso 1                                  │
├─────────────────────────────────────────┤
│ ⚠️ Reversão detectada (if hasReversal)  │
├─────────────────────────────────────────┤
│         ┌─────────┐                     │
│         │   97%   │                     │
│         │  Gauge  │                     │
│         └─────────┘                     │
│       Disponibilidade                   │
├─────────────────────────────────────────┤
│  ⏱️ MTBF: 480h    │  🔧 MTTR: 2h        │
├─────────────────────────────────────────┤
│  🔔 3 alertas recentes (if > 0)         │
├─────────────────────────────────────────┤
│  [Shopping Madureira]                   │
└─────────────────────────────────────────┘
```

### Filter Options

| Filter | Options |
|--------|---------|
| Search | Name, Customer, Location |
| Status | All, Online, Offline, Maintenance |
| Type | All, Escadas Rolantes, Elevadores |

### settingsSchema.json (TO BE CREATED)

```json
{
  "schema": {
    "type": "object",
    "title": "Operational General List Settings",
    "properties": {
      "enableDebugMode": {
        "type": "boolean",
        "title": "Enable Debug Mode",
        "default": false
      },
      "defaultThemeMode": {
        "type": "string",
        "title": "Default Theme Mode",
        "default": "dark",
        "enum": ["light", "dark"]
      },
      "refreshInterval": {
        "type": "number",
        "title": "Refresh Interval (seconds)",
        "default": 60
      }
    }
  }
}
```

### Remaining Tasks

1. Create `settingsSchema.json`
2. Create `src/components/operational/EquipmentCard.ts` as reusable component
3. Integrate with real datasource when API is available
4. Add card click action to open equipment detail modal

### Testing Checklist

- [ ] Navigate to General List submenu → verify grid renders
- [ ] Search for equipment → verify filtering works
- [ ] Apply status filter → verify cards filter correctly
- [ ] Apply type filter → verify cards filter correctly
- [ ] Verify availability gauge renders correctly (green/amber/red based on %)
- [ ] Verify reversal warning shows with pulse animation
- [ ] Verify theme toggle works (light/dark)

---

## Phase 4: Alarms and Notifications Panel

### Status: ⏳ PENDING

### Description

Provide a centralized view for alarms and notifications with two tabs:
1. **List View**: Filterable grid of alarm cards
2. **Dashboard View**: Summary tiles and charts

### Files to Create

| File | Description |
|------|-------------|
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_ALARMS/controller.js` | Widget controller with tab logic |
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_ALARMS/template.html` | HTML with tabs |
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_ALARMS/styles.css` | Styles for cards and dashboard |
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_ALARMS/settingsSchema.json` | Widget settings |
| `src/components/operational/AlarmCard.ts` | Reusable alarm card component |
| `src/types/alarm.ts` | ✅ Created - TypeScript definitions |

### Alarm Data Structure

```typescript
type AlarmSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
type AlarmState = 'OPEN' | 'ACK' | 'SNOOZED' | 'ESCALATED' | 'CLOSED';

interface Alarm {
  id: string;
  customerId: string;
  customerName: string;
  source: string;
  severity: AlarmSeverity;
  state: AlarmState;
  title: string;
  description: string;
  tags: Record<string, string>;
  firstOccurrence: string;      // ISO timestamp
  lastOccurrence: string;       // ISO timestamp
  occurrenceCount: number;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  closedAt?: string;
  closedBy?: string;
}
```

### Alarm Card Layout Specification

```
┌─────────────────────────────────────────┐
│ [🔴 CRITICAL] [Aberto]     há 5min      │
├─────────────────────────────────────────┤
│ Falha de comunicação com dispositivo    │
│ ALM-2024-001234                         │
├─────────────────────────────────────────┤
│ [SM] Shopping Madureira                 │
│      ESC-02 - Escada Rolante            │
├─────────────────────────────────────────┤
│ 📊 15 ocorrências                       │
│ ⏱️ Primeira: há 2 dias                  │
│ 🕐 Última: há 5 minutos                 │
├─────────────────────────────────────────┤
│ [tipo: comunicacao] [zona: piso1]       │
├─────────────────────────────────────────┤
│ [Reconhecer] [Detalhes] [⋮]             │
└─────────────────────────────────────────┘
```

### Severity Configuration

| Severity | Background | Border | Icon | Label PT |
|----------|------------|--------|------|----------|
| CRITICAL | `rgba(239,68,68,0.1)` | `#ef4444` | 🔴 | Crítico |
| HIGH | `rgba(249,115,22,0.1)` | `#f97316` | 🟠 | Alto |
| MEDIUM | `rgba(234,179,8,0.1)` | `#eab308` | 🟡 | Médio |
| LOW | `rgba(59,130,246,0.1)` | `#3b82f6` | 🔵 | Baixo |
| INFO | `rgba(107,114,128,0.1)` | `#6b7280` | ⚪ | Informativo |

### State Configuration

| State | Label PT | Color |
|-------|----------|-------|
| OPEN | Aberto | `#ef4444` |
| ACK | Reconhecido | `#f59e0b` |
| SNOOZED | Adiado | `#8b5cf6` |
| ESCALATED | Escalado | `#dc2626` |
| CLOSED | Fechado | `#6b7280` |

### Dashboard KPIs

| KPI | Description |
|-----|-------------|
| Total Alarms | Total count of all alarms |
| Open Critical | Count of CRITICAL + OPEN alarms |
| Open High | Count of HIGH + OPEN alarms |
| Last 24 Hours | Alarms created in last 24h |

### Dashboard Charts

1. **Trend Chart**: Line chart showing alarm count over time
2. **State Chart**: Donut chart showing alarms by state
3. **Severity Chart**: Bar chart showing alarms by severity

### Filter Options (Premium)

| Filter | Type | Options |
|--------|------|---------|
| Search | Text | Title, ID, Source |
| Severity | Multi-select | CRITICAL, HIGH, MEDIUM, LOW, INFO |
| State | Multi-select | OPEN, ACK, SNOOZED, ESCALATED, CLOSED |
| Date From | Date picker | Start date |
| Date To | Date picker | End date |
| Customer | Select | List of customers |

### Tab Navigation

```html
<nav class="alarms-tabs">
  <button class="tab-btn active" data-tab="list">
    <span class="tab-icon">📋</span>
    <span>Lista de Alarmes</span>
  </button>
  <button class="tab-btn" data-tab="dashboard">
    <span class="tab-icon">📊</span>
    <span>Dashboard</span>
  </button>
</nav>
```

### Testing Checklist

- [ ] Navigate to Alarms submenu → verify list tab shows by default
- [ ] Switch to Dashboard tab → verify KPI cards render
- [ ] Switch back to List tab → verify state is preserved
- [ ] Apply severity filter → verify cards filter correctly
- [ ] Apply state filter → verify cards filter correctly
- [ ] Apply date range → verify cards filter correctly
- [ ] Verify CRITICAL alarms have pulsing animation
- [ ] Verify charts render correctly in Dashboard tab
- [ ] Test "Reconhecer" button → verify state changes to ACK
- [ ] Test theme toggle → verify all elements update

---

## Phase 5: Management Dashboard Panel

### Status: ⏳ PENDING

### Description

Provide a high-level management view with KPI summary tiles focusing on MTBF, MTTR, availability, and operational metrics across the entire equipment fleet.

### Files to Create

| File | Description |
|------|-------------|
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_DASHBOARD/controller.js` | Dashboard controller |
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_DASHBOARD/template.html` | Dashboard layout |
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_DASHBOARD/styles.css` | Dashboard styles |
| `src/MYIO-SIM/v5.2.0/OPERATIONAL_DASHBOARD/settingsSchema.json` | Widget settings |

### Dashboard KPIs

| KPI | Icon | Description | Format |
|-----|------|-------------|--------|
| Fleet Availability | 📊 | Overall fleet availability | XX.X% |
| Availability Trend | ↑/↓ | vs previous period | +X.X% / -X.X% |
| Fleet MTBF | ⏱️ | Average MTBF across fleet | XXXh |
| Fleet MTTR | 🔧 | Average MTTR across fleet | X.Xh |
| Total Equipment | 🔢 | Total equipment count | XX |
| Online | 🟢 | Online equipment count | XX |
| Offline | 🔴 | Offline equipment count | XX |
| Maintenance | 🟡 | Maintenance equipment count | XX |

### KPI Formulas

```javascript
// MTBF = (Total Operating Time - Maintenance Time) / Number of Failures
function calculateMTBF(operatingHours, maintenanceHours, failureCount) {
  if (failureCount === 0) return operatingHours;
  return (operatingHours - maintenanceHours) / failureCount;
}

// MTTR = Total Maintenance Time / Number of Failures
function calculateMTTR(maintenanceHours, failureCount) {
  if (failureCount === 0) return 0;
  return maintenanceHours / failureCount;
}

// Availability = (MTBF / (MTBF + MTTR)) * 100
function calculateAvailability(mtbf, mttr) {
  if (mtbf + mttr === 0) return 100;
  return (mtbf / (mtbf + mttr)) * 100;
}
```

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard Gerencial                    [Período: Este Mês ▼]│
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌───────────────┐ ┌───────────────┐     │
│ │   📊 94.7%      │ │  ⏱️ 342h     │ │  🔧 4.2h      │     │
│ │ Disponibilidade │ │  MTBF Médio  │ │  MTTR Médio   │     │
│ │    +2.3% ↑      │ │              │ │               │     │
│ └─────────────────┘ └───────────────┘ └───────────────┘     │
├─────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                         │
│ │  48  │ │  42  │ │   3  │ │   3  │                         │
│ │Total │ │Online│ │Offline│ │Manut│                         │
│ └──────┘ └──────┘ └──────┘ └──────┘                         │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────────────────┐ ┌────────────────────────┐       │
│ │ Disponibilidade/Período│ │    MTBF/MTTR Trend    │       │
│ │      [Line Chart]      │ │      [Line Chart]     │       │
│ └────────────────────────┘ └────────────────────────┘       │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────────────────┐ ┌────────────────────────┐       │
│ │  Equipamentos/Status  │ │ Top 5 Maior Downtime   │       │
│ │    [Donut Chart]      │ │ 1. ESC-02 (48h - 15%)  │       │
│ │                       │ │ 2. ELV-05 (32h - 10%)  │       │
│ └────────────────────────┘ └────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Period Selector Options

| Option | Label PT | Date Range |
|--------|----------|------------|
| today | Hoje | Current day |
| week | Esta Semana | Current week |
| month | Este Mês | Current month |
| quarter | Este Trimestre | Current quarter |

### Top Downtime List Structure

```typescript
interface DowntimeEntry {
  name: string;           // Equipment name
  location: string;       // Shopping name
  downtime: number;       // Hours
  percentage: number;     // % of total period
}
```

### Testing Checklist

- [ ] Navigate to Management Dashboard → verify KPIs render
- [ ] Change period selector → verify data updates
- [ ] Verify availability trend indicator color (green for positive, red for negative)
- [ ] Verify downtime list sorts by highest downtime first
- [ ] Verify charts render and update with period change
- [ ] Test theme toggle → verify all elements update
- [ ] Verify responsive layout on smaller screens

---

## Shared Components & Types

### Status: 🟡 PARTIAL

### Files Created

| File | Description |
|------|-------------|
| `src/types/operational.ts` | ✅ TypeScript definitions for equipment, KPIs, filters |
| `src/types/alarm.ts` | ✅ TypeScript definitions for alarms |

### Files to Create

| File | Description |
|------|-------------|
| `src/components/operational/index.ts` | Export all operational components |
| `src/components/operational/EquipmentCard.ts` | Reusable equipment card |
| `src/components/operational/AlarmCard.ts` | Reusable alarm card |
| `src/utils/operationalHelpers.js` | Shared utility functions |

### Event Coordination

| Event | Dispatched By | Consumed By | Detail |
|-------|---------------|-------------|--------|
| `myio:operational-indicators-access` | MAIN_UNIQUE_DATASOURCE | MenuView | `{ enabled: boolean }` |
| `myio:context-change` | MenuView | Dashboard state | `{ tabId, contextId, target }` |
| `myio:operational-equipment-ready` | Widget | Other components | `{ equipment[], stats }` |
| `myio:operational-alarms-ready` | Widget | Other components | `{ alarms[], stats }` |

---

## Showcase / Testing

### Status: ⏳ PENDING

### File to Create

| File | Description |
|------|-------------|
| `showcase/operational-indicators/index.html` | Showcase page for testing |

### Showcase Requirements

1. Mock customer attribute `show-indicators-operational-panels = true`
2. Mock equipment data (escalators, elevators)
3. Mock alarm data with various severities and states
4. Mock dashboard KPIs
5. Demonstrate tab switching in Alarms panel
6. Theme toggle support

---

## Exports Update

### Status: ⏳ PENDING

### File to Modify

| File | Changes Needed |
|------|----------------|
| `src/index.ts` | Export new types and components |

### Exports to Add

```typescript
// RFC-0152: Operational Indicators Types
export type {
  EquipmentCardData,
  EquipmentStats,
  EquipmentStatus,
  EquipmentType,
  DashboardKPIs,
  DashboardPeriod,
  DowntimeEntry,
  OperationalStore,
} from './types/operational';

export {
  calculateMTBF,
  calculateMTTR,
  calculateAvailability,
  getStatusColors,
  getAvailabilityColor,
  DEFAULT_EQUIPMENT_STATS,
  DEFAULT_DASHBOARD_KPIS,
} from './types/operational';

// RFC-0152: Alarm Types
export type {
  Alarm,
  AlarmCardData,
  AlarmSeverity,
  AlarmState,
  AlarmStats,
  AlarmFilters,
} from './types/alarm';

export {
  SEVERITY_CONFIG,
  STATE_CONFIG,
  DEFAULT_ALARM_STATS,
  getSeverityConfig,
  getStateConfig,
  isAlarmActive,
  formatAlarmRelativeTime,
} from './types/alarm';

// RFC-0152: Menu Tab Configuration
export { OPERATIONAL_INDICATORS_TAB } from './components/menu';
```

---

## Open Questions / Risks

1. **Attribute Name**: Confirmed as `show-indicators-operational-panels`
2. **Data Source**: Mock data for now; real API integration TBD
3. **Real-time Updates**: Polling vs WebSocket TBD
4. **Permissions**: Role-based permissions for alarm actions (acknowledge, escalate) TBD

---

## Implementation Checklist Summary

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | User Access Toggle & Gating | ✅ Done |
| 2 | Menu Column & Navigation | ✅ Done |
| 3 | General List Panel | 🟡 Partial |
| 4 | Alarms and Notifications Panel | ⏳ Pending |
| 5 | Management Dashboard Panel | ⏳ Pending |
| - | Update index.ts exports | ⏳ Pending |
| - | Create showcase page | ⏳ Pending |

---

## References

- Inspiration: `C:\Projetos\GitHub\myio\ascend-monitor-hub.git`
- Alarm patterns: `C:\Projetos\GitHub\myio\alarms-frontend.git`
- Card patterns: `src/thingsboard/main-dashboard-shopping/v-5.2.0/card/template-card-v5.js`
