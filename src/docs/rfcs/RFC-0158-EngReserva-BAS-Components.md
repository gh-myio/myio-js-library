# RFC-0158: Building Automation System (BAS) Components

- **Feature Name:** `bas-components`
- **Start Date:** 2026-01-31
- **RFC PR:** (leave this empty)
- **Issue:** (leave this empty)
- **Status:** Draft

---

## Summary

This RFC proposes a unified widget architecture for a Building Automation System (BAS) **operational dashboard** that integrates **water, energy, and HVAC** into a single screen. The approach is inspired by the `MAIN_UNIQUE_DATASOURCE` controller pattern and targets a cohesive set of reusable components under `src/components/bas-components`, with **near real-time** data and **accumulated metrics for the current day**.

---

## Motivation

Current BAS dashboards consist of multiple independent ThingsBoard widgets that lack:

1. **Unified State Management**: Each widget manages its own state independently
2. **Consistent Theming**: No shared theme configuration across widgets
3. **Cross-Widget Communication**: Limited ability for widgets to react to shared context (e.g., floor selection)
4. **Reusable Components**: Widget logic is duplicated across similar components

By creating a unified BAS component library, we can:

- Reduce code duplication
- Enable consistent user experience
- Improve maintainability
- Support floor-based filtering across all widgets
- Handle offline/null states gracefully

---

## Guide-level Explanation

### Dashboard Overview

The BAS operational dashboard provides a digital mirror of building operations, integrating:

| Section | Purpose | Widgets |
|---------|---------|---------|
| **Floors Sidebar** | Context filter | Floor selector |
| **Water Infrastructure** | Water monitoring | Hydrometers, Cisterns, Water Tanks, Solenoids |
| **Environments** | HVAC monitoring | Air conditioning units with temperature/consumption |
| **Pumps & Motors** | Electromechanical equipment | Motor/pump status with power consumption |
| **Charts (Current Day)** | Daily analytics | Temperature and consumption time series |

### Layout Structure

```
┌─────────┬──────────────────────────────────────────┬─────────────────┐
│         │        WATER INFRASTRUCTURE              │                 │
│ FLOORS  │  [Hydro] [Cistern] [Tank] [Solenoid]    │   ENVIRONMENTS  │
│         ├──────────────────────────────────────────┤   (HVAC Cards)  │
│  01º    │                                          │                 │
│  02º    │                                          │   PUMPS &       │
│  03º    │           CHARTS AREA                    │   MOTORS        │
│  ...    │     (Temperature / Consumption)          │                 │
└─────────┴──────────────────────────────────────────┴─────────────────┘
```

Left-to-right flow:
`[ Andares ] | [ Infraestrutura Hídrica ] | [ Ambientes ] | [ Bombas e Motores ]`, with **Current Day Charts** below the central area.

### Widget Types

#### 1. SvgHidrometro (Water Meter)
- **Purpose**: Display water consumption in m³
- **Scope**: Current day (realtime)
- **Data**: `consumption`, `unit`, `status`
- **Instances**:
  - **Hidr. Entrada Geral**
  - **Hidr. Torre / Torre Água Refrigerada**

#### 2. Water Level v2/v3 (Cisterns & Tanks)
- **Purpose**: Display water level percentage and height
- **Visual**: Dynamic fill based on level
- **Data**: `percentage`, `height`, `status`
- **Instances**:
  - **Cisterna 01 / Cisterna 02**
  - **Caixa d’Água – Torre**

#### 3. Solenoide (Solenoid Valve)
- **Purpose**: Show on/off state of hydraulic control
- **States**: `on`, `off`, `unknown`
- **Actions**: Toggle (if permissions allow)

#### 4. Blinking Air List (HVAC Environments)
- **Purpose**: List air conditioning units per floor
- **Data**: Temperature (°C), Power consumption (kW)
- **States**: Active, Inactive, No reading (`--`)
- **Filtering**: Responds to floor selection

#### 5. Motor/Pump List
- **Purpose**: List electromechanical equipment
- **Data**: Power consumption (kW)
- **Rule**: `0.00 kW` = off, `> 0` = running

#### 6. Time Series Charts (Current Day)
- **Purpose**: Daily temperature and consumption trends
- **Metrics**: Min, Max, Avg, Total, Latest
- **Scope**: Current day

---

## Reference-level Explanation

### Directory Structure

```
src/
├── components/
│   └── bas-components/
│       ├── index.ts                    # Public exports
│       ├── types.ts                    # Shared types
│       ├── BASOrchestrator.ts          # Central state manager
│       ├── FloorSelector/              # Floor filter component
│       ├── WaterMeter/                 # Hydrometer display
│       ├── WaterLevel/                 # Tank/cistern level
│       ├── SolenoidControl/            # Solenoid on/off
│       ├── HVACEnvironmentList/        # Air conditioning list
│       ├── MotorPumpList/              # Motor/pump status
│       └── DailyChart/                 # Time series charts
│
└── thingsboard/
    └── bas-components/
        ├── MAIN_BAS_CONTROLLER/        # Unified datasource controller
        ├── svg-hidrometro/             # Legacy widget (migrate)
        ├── water-level-v2/             # Legacy widget (migrate)
        ├── water-level-v3/             # Legacy widget (migrate)
        ├── solenoide-sem-on-off-v2.0.1/
        ├── blinking-air-list-with-consumption-and-temperature-v3/
        ├── blinking-status-motor-list-with-link-v3/
        └── screens/                    # Reference screenshots
```

### BASOrchestrator

Central state manager inspired by `MAIN_UNIQUE_DATASOURCE`:

```typescript
interface BASState {
  selectedFloor: string | null;
  waterInfrastructure: WaterDevice[];
  hvacEnvironments: HVACDevice[];
  motorsAndPumps: MotorDevice[];
  themeMode: 'light' | 'dark';
  isLoading: boolean;
}

interface BASOrchestrator {
  // State management
  getState(): BASState;
  setSelectedFloor(floor: string | null): void;

  // Events
  on(event: BASEventType, handler: BASEventHandler): void;
  off(event: BASEventType, handler: BASEventHandler): void;

  // Data updates
  updateWaterDevices(devices: WaterDevice[]): void;
  updateHVACDevices(devices: HVACDevice[]): void;
  updateMotorDevices(devices: MotorDevice[]): void;
}
```

### Event System

```typescript
type BASEventType =
  | 'bas:floor-changed'      // Floor selection changed
  | 'bas:water-updated'      // Water devices updated
  | 'bas:hvac-updated'       // HVAC devices updated
  | 'bas:motors-updated'     // Motor/pump devices updated
  | 'bas:theme-changed'      // Theme mode changed
  | 'bas:device-clicked';    // Device card clicked
```

### Device Interfaces

```typescript
interface WaterDevice {
  id: string;
  name: string;
  type: 'hydrometer' | 'cistern' | 'tank' | 'solenoid';
  floor?: string;
  value: number;
  unit: string;
  status: 'online' | 'offline' | 'unknown';
  lastUpdate: number;
}

interface HVACDevice {
  id: string;
  name: string;
  floor: string;
  temperature: number | null;
  consumption: number | null;
  status: 'active' | 'inactive' | 'no_reading';
  setpoint?: number;
}

interface MotorDevice {
  id: string;
  name: string;
  floor?: string;
  consumption: number;
  status: 'running' | 'stopped' | 'unknown';
  type: 'pump' | 'motor' | 'other';
}
```

### Null/Offline State Handling

All components must gracefully handle:

| State | Display | Style |
|-------|---------|-------|
| `null` / `undefined` | `--` | Muted text |
| `offline` | `--` + icon | Gray background |
| `0` (motors) | `0.00 kW` | Indicates "off" |
| `loading` | Spinner | Skeleton UI |

---

## Drawbacks

1. **Migration Effort**: Existing ThingsBoard widgets need to be migrated to new components
2. **Learning Curve**: Team needs to learn new component architecture
3. **Backward Compatibility**: Need to maintain legacy widgets during transition

---

## Rationale and Alternatives

### Why This Approach?

The `MAIN_UNIQUE_DATASOURCE` pattern has proven effective for shopping mall dashboards. Applying the same architecture to BAS dashboards provides:

- Consistent development patterns across projects
- Shared utilities and helpers
- Unified testing approach

### Alternatives Considered

1. **Keep Independent Widgets**: Continue with current approach
   - Rejected: Too much code duplication, inconsistent UX

2. **Use ThingsBoard Built-in Features**: Rely on TB's state management
   - Rejected: Limited cross-widget communication, less control

3. **Iframe-based Composition**: Embed widgets in iframes
   - Rejected: Performance overhead, complex state sharing

---

## Prior Art

### MAIN_UNIQUE_DATASOURCE (RFC-0111)

The shopping mall dashboard controller provides:
- Unified datasource handling
- Event-driven architecture
- Module-level caching
- Theme management

### Existing BAS Widgets

Located in `src/thingsboard/bas-components/`:
- 15+ widget implementations
- Various versions (v1, v2, v3)
- Inconsistent patterns

---

## Unresolved Questions

1. **Floor Data Source**: How are floors defined? (Customer attribute? Device metadata?)
2. **Real-time Updates**: WebSocket vs polling for live data?
3. **Permissions**: How to handle action permissions (solenoid toggle)?
4. **Chart Library**: Use existing chart components or new implementation?

---

## Future Possibilities

1. **Alarm Integration**: Connect to alarm system for visual alerts
2. **Automation Rules**: Define automation triggers from dashboard
3. **Historical Analysis**: Extended date range support for charts
4. **Mobile Responsive**: Optimize layout for mobile devices
5. **PDF Reports**: Export daily/weekly operational reports

---

## Implementation Plan

### Phase 1: Foundation
- [ ] Create `BASOrchestrator` with event system
- [ ] Define shared types and interfaces
- [ ] Implement floor selector component

### Phase 2: Water Components
- [ ] Migrate `SvgHidrometro` to new architecture
- [ ] Migrate `WaterLevel` components
- [ ] Migrate `Solenoide` component

### Phase 3: HVAC Components
- [ ] Migrate `BlinkingAirList` with floor filtering
- [ ] Implement temperature/consumption display

### Phase 4: Motor/Pump Components
- [ ] Migrate `MotorList` component
- [ ] Implement consumption status logic

### Phase 5: Charts & Integration
- [ ] Implement daily time series charts
- [ ] Create unified controller (`MAIN_BAS_CONTROLLER`)
- [ ] Integration testing

---

## References

- Draft: `src/docs/rfcs/RFC-0158-EngReserva-BAS-Components.draft.md`
- Readme: `src/thingsboard/bas-components/readme.draft.md`
- Screenshots: `src/thingsboard/bas-components/screens/`
- Existing Widgets: `src/thingsboard/bas-components/*/`
