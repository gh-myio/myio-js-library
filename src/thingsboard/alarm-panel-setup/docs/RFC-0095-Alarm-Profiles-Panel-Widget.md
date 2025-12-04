# RFC-0095: Alarm Profiles Panel Widget

- **Feature Name:** `alarm_profiles_panel_widget`
- **Start Date:** 2025-11-27
- **RFC PR:** (leave this empty)
- **Implementation Issue:** (leave this empty)
- **Status:** Draft
- **Version:** 0.3.0
- **Author:** MYIO Engineering
- **Target Platform:** ThingsBoard (Custom Widget)

---

## Summary

This RFC defines the Alarm Profiles Panel Widget for the MYIO ThingsBoard ecosystem. The widget provides a profile-centric, alarm-aware operational panel centered on Device Profiles, their Alarm Rules, and associated Rule Chains.

The widget exposes two main operational views driven by multi-selected device profiles:

1. **Devices View** — A grid of devices associated with the selected device profiles.
2. **Alarms View** — A list/grid of recent alarms generated for those device profiles, with filters.

Additionally, for each Device Profile, the widget:
- Shows the associated Rule Chain name inline in the multi-select list
- Provides a Profile Details Modal containing description, alarm rules overview, and rule chain information

---

## Motivation

Operators need a profile-centric, alarm-aware panel that answers:

1. Which device profiles exist and what do they represent?
2. Which Rule Chain is responsible for processing alarms for each device profile?
3. Which devices belong to those profiles?
4. Which alarms have been recently generated under those profiles, and what rules triggered them?

Today, these answers are scattered across multiple ThingsBoard screens:

| Information | Current Location |
|-------------|------------------|
| Device Profiles & Alarm Rules | Configuration screens |
| Rule Chains | Separate configuration area |
| Alarm lists | Global or device-centric views |

This widget consolidates all of that into one operational UI, enabling:

- Multi-select of relevant device profiles
- Immediate visibility of Rule Chains per device profile
- Quick inspection of device profile details (description + rules + Rule Chain)
- Easy switching between Devices and Alarms views

---

## Guide-level Explanation

### User Experience Overview

The Alarm Profiles Panel Widget is designed as a single-page operational dashboard that gives operators complete visibility into their device profiles and associated alarms.

#### Workflow Example

1. **Select Device Profiles**: The operator opens the widget and sees a multi-select list of all available device profiles. Each profile shows its name with the associated Rule Chain in parentheses (e.g., `Chiller Profile (RC-Chiller-Default)`).

2. **View Profile Details**: By clicking the info icon next to any profile, the operator can open a modal showing:
   - Profile description and purpose
   - Associated Rule Chain
   - Configured alarm rules

3. **Switch Views**: Using the view toggle, the operator can switch between:
   - **Devices View**: See all devices belonging to selected profiles
   - **Alarms View**: See recent alarms filtered by date and status

4. **Filter Alarms**: In Alarms View, the operator can filter by:
   - Date interval (start/end)
   - Alarm status (ACTIVE, CLEARED, ACKNOWLEDGED)

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Title, Subtitle, Refresh Button                        │
├─────────────────────────────────────────────────────────────────┤
│  DEVICE PROFILE SELECTOR (Multi-Select)                         │
│  ┌─────────────────────────┐ ┌─────────────────────────┐        │
│  │ ☑ Chiller Profile    ⓘ │ │ ☐ HVAC Profile       ⓘ │        │
│  │   (RC-Chiller-Default)  │ │   (RC-HVAC-Standard)   │        │
│  └─────────────────────────┘ └─────────────────────────┘        │
├─────────────────────────────────────────────────────────────────┤
│  VIEW TOGGLE: [ Devices ] [ Alarms ]                            │
├─────────────────────────────────────────────────────────────────┤
│  MAIN CONTENT AREA                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  (Devices Grid or Alarms List based on selected view)  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Reference-level Explanation

### Widget Deliverables

The widget will be delivered as a standard ThingsBoard custom widget with four files:

| File | Purpose |
|------|---------|
| `controller.js` | JavaScript controller with business logic |
| `template.html` | HTML template structure |
| `style.css` | CSS stylesheet |
| `settings.schema` | Settings schema for configuration |

### Data Model

The widget consumes three conceptual data sets:

#### 1. Device Profiles Data

Represents ThingsBoard Device Profiles with their alarm and rule-flow definitions.

```typescript
interface DeviceProfile {
  profileId: string;           // Unique identifier (Entity ID)
  profileName: string;         // User-friendly name
  profileCode?: string;        // Optional short code
  profileDescriptionShort?: string;  // For inline hints
  profileDescriptionLong?: string;   // For Profile Details Modal
  alarmRules: AlarmRule[];     // Structured alarm rules
  ruleChainId?: string;        // Associated Rule Chain ID
  ruleChainName?: string;      // Human-readable Rule Chain name
}
```

#### 2. Devices Data

Devices bound to specific device profiles.

```typescript
interface Device {
  deviceId: string;
  deviceName: string;
  deviceLabel?: string;
  location?: string;           // Store, area, etc.
  deviceProfileId: string;     // Link to profileId
  currentAlarmSeverity?: AlarmSeverity;
  alarmStatus?: AlarmStatus;
  lastAlarmTs?: number;
}
```

#### 3. Alarms Data

Individual alarm events related to devices belonging to selected device profiles.

```typescript
interface Alarm {
  alarmId: string;
  deviceId: string;
  deviceName: string;
  deviceProfileId: string;
  deviceProfileName: string;
  ruleChainName?: string;
  alarmTs: number;
  alarmStatus: AlarmStatus;
  severity: AlarmSeverity;
  ruleName: string;
  ruleId?: string;
  reason?: string;             // Short description/message
}

type AlarmSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'WARNING' | 'INFO' | 'NONE';
type AlarmStatus = 'ACTIVE' | 'CLEARED' | 'ACKNOWLEDGED' | 'NORMAL';
```

### Interaction Model

#### Device Profile Multi-Select

Each profile is rendered as a selectable pill/card with:

- **Line 1**: Profile Name
- **Line 2**: *(Rule Chain Name)* in small italic font
- **Info Icon**: Opens Profile Details Modal
- **Selection Toggle**: Click main area to select/deselect

Multiple profiles can be selected simultaneously.

#### Profile Details Modal

When the user clicks the info button on a profile:

1. Open modal titled: `"Device Profile Details: <Profile Name>"`
2. Display:
   - Profile name and code
   - Rule Chain name (and optionally ID)
   - Long description / documentation text
   - Alarm Rules overview (JSON or summarized list)
3. Modal is purely informational (read-only)
4. Close via: X button or overlay click

#### View Mode Toggle

| State | Content |
|-------|---------|
| Devices | Grid of devices filtered by selected profiles |
| Alarms | Filtered alarm cards/list |

**Important**: Selected device profiles persist when switching views.

#### Devices View

- Grid listing devices mapped to selected device profiles
- Empty state: `"Select one or more device profiles to see devices."`
- No results: `"No devices found for the selected profiles."`
- Configurable columns: Device, Location, Severity, Status, Last Alarm

#### Alarms View

Filter controls:
- Date Interval (start/end)
- Alarm Status (multi-select)

Alarm card displays:
- Alarm timestamp
- Device name
- Device profile name
- Severity badge
- Alarm status
- Rule name
- Reason/message

Default sort: Most recent alarms first (descending `alarmTs`)

### Settings Schema

#### Appearance Settings

| Key | Type | Description |
|-----|------|-------------|
| `showHeader` | boolean | Show/hide header section |
| `headerTitle` | string | Header title text |
| `compactMode` | boolean | Enable compact layout |

#### Device Profile Mapping

| Key | Type | Description |
|-----|------|-------------|
| `profileIdKey` | string | JSON path to profile ID |
| `profileNameKey` | string | JSON path to profile name |
| `profileCodeKey` | string | JSON path to profile code |
| `profileDescriptionShortKey` | string | JSON path to short description |
| `profileDescriptionLongKey` | string | JSON path to long description |
| `alarmRulesKey` | string | JSON path to alarm rules |
| `ruleChainIdKey` | string | JSON path to rule chain ID |
| `ruleChainNameKey` | string | JSON path to rule chain name |

#### Devices View Settings

| Key | Type | Description |
|-----|------|-------------|
| `showLocationColumn` | boolean | Show location column |
| `showSeverityColumn` | boolean | Show severity column |
| `showStatusColumn` | boolean | Show status column |
| `showLastAlarmColumn` | boolean | Show last alarm column |
| `columnOrder` | string[] | Column ordering |

#### Alarms View Settings

| Key | Type | Description |
|-----|------|-------------|
| `defaultDateInterval` | string | Default interval (e.g., "24h") |
| `defaultStatusFilter` | string[] | Default status filters |
| `maxAlarmsDisplay` | number | Maximum alarms to show |

#### Style Settings

| Key | Type | Description |
|-----|------|-------------|
| `severityClasses` | object | CSS classes per severity |
| `statusClasses` | object | CSS classes per status |
| `profilePillClass` | string | CSS class for profile pills |
| `ruleChainTextClass` | string | CSS class for Rule Chain text |

---

## Drawbacks

1. **Increased Complexity**: Combining multiple data sources (profiles, devices, alarms, rule chains) in one widget increases implementation and maintenance complexity.

2. **Performance Concerns**: Large installations with many profiles, devices, and alarms may experience performance degradation without proper pagination and lazy loading.

3. **ThingsBoard API Dependency**: The widget relies on ThingsBoard REST APIs that may change between versions.

---

## Rationale and Alternatives

### Why This Design?

The profile-centric approach was chosen because:

1. **Operator Mental Model**: Operators think in terms of "types of equipment" (profiles), not individual devices.
2. **Alarm Context**: Understanding which rule chain and alarm rules apply helps operators diagnose issues faster.
3. **Consolidation**: Reduces context-switching between multiple ThingsBoard screens.

### Alternatives Considered

#### Alternative 1: Device-Centric Widget

Focus on individual devices with profile information as secondary context.

**Rejected because**: Does not scale well for operators managing hundreds of devices; profile-centric grouping is more natural for fleet management.

#### Alternative 2: Separate Widgets

Create separate widgets for Devices and Alarms views.

**Rejected because**: Loses the unified profile selection context; requires more dashboard real estate; increases operator cognitive load.

#### Alternative 3: Rule Chain Editor Integration

Embed rule chain visualization directly in the widget.

**Rejected because**: Out of scope for operational monitoring; rule chain editing is a configuration task, not an operational one.

---

## Prior Art

### ThingsBoard Built-in Widgets

- **Alarm Table Widget**: Shows alarms globally or per device, but lacks profile-centric filtering
- **Device Table Widget**: Shows devices, but without alarm context or profile grouping

### Industry Standards

- **Grafana Alerting**: Profile-based alert grouping with rule visualization
- **Prometheus AlertManager**: Label-based grouping similar to profile-based filtering
- **ServiceNow**: Incident panels with category/profile filtering

---

## Unresolved Questions

1. **Rule Chain Visualization**: Should the Profile Details Modal include a simplified rule chain flow diagram, or just metadata?

2. **Alarm Acknowledgment**: Should this widget support inline alarm acknowledgment, or remain purely informational?

3. **Real-time Updates**: Should alarms update in real-time via WebSocket, or require manual refresh?

4. **Profile Hierarchy**: If ThingsBoard supports nested device profiles in the future, how should the hierarchy be displayed?

---

## Future Possibilities

### Phase 2 Enhancements

1. **Tabbed Profile Details Modal**
   - Overview tab
   - Alarm Rules tab (detailed rule editor view, read-only)
   - Rule Chain Flow tab (visual diagram)

2. **Rule Chain Links**
   - Clickable Rule Chain name to open rule chain documentation or visualization

3. **Rich Alarm Rule Visualization**
   - Visual representation of conditions, thresholds, and actions
   - Color-coded severity indicators

### Phase 3 Enhancements

4. **Profile-Level KPIs**
   - Number of alarms per profile
   - Average severity distribution
   - MTBF/MTTR calculations per profile

5. **Alarm Trend Analysis**
   - Time-series charts for alarm frequency
   - Comparison between profiles

6. **Export Functionality**
   - Export alarm history to CSV/PDF
   - Scheduled reports per profile

---

## Appendix A: UX Guidelines

### Visual Hierarchy

Rule Chain name must be visually subordinate to the profile name:

```
┌─────────────────────────────┐
│ Chiller Profile          ⓘ │
│ (RC-Chiller-Default)       │  ← Smaller, italic, in parentheses
└─────────────────────────────┘
```

### Modal Design

Profile Details Modal should feel like a documentation snippet:
- Short textual explanation of what this profile represents
- Clear indication of which Rule Chain runs for this profile
- Structured but not overwhelming

### Dashboard Integration

The widget should maintain a compact, dashboard-friendly layout:
- Avoid excessive vertical scrolling
- Support responsive resizing
- Work well alongside other widgets

---

## Appendix B: Risk Mitigation

| Risk | Description | Mitigation |
|------|-------------|------------|
| Missing Rule Chain | Some device profiles may not have rule chain info accessible | Allow Rule Chain name to be optional; show "No Rule Chain configured" |
| Overloaded Modal | Too many fields can overwhelm the operator | Keep layout simple: profile meta + description + high-level rules overview |
| Data Inconsistency | Alarm data may not include direct profile or rule chain references | Use device → device profile association to enrich alarm data where possible |
| API Rate Limits | Excessive API calls for large installations | Implement caching, pagination, and debounced refresh |

---

## Conclusion

By incorporating Rule Chain awareness and a Profile Details Modal, the Alarm Profiles Panel Widget becomes not only a live operational tool for Devices and Alarms, but also a contextual documentation surface for each Device Profile.

Operators can see, in one consolidated UI:
- Which profiles are active
- Which Rule Chains drive their alarms
- What each profile conceptually represents
- How devices and alarms relate to those profiles

This design aligns with MYIO's need for transparency, operational clarity, and future extensibility on top of ThingsBoard's device profile and rule chain concepts.
