# RFC-0001: Operational Indicators Panel Widget (Escalators & Elevators)

- **Feature Name:** `operational_indicators_panel`
- **Start Date:** 2025-12-12
- **RFC PR:** (leave empty)
- **ThingsBoard Issue:** (leave empty)

---

## Summary

Build an Operational Indicators Panel widget in ThingsBoard for real-time monitoring of escalators and elevators. The panel consists of modular cards updated in real-time, with automatic alerts and consolidated reports.

---

## Motivation

### Why are we doing this?

Facility management teams need immediate visibility into equipment performance to:

- Reduce unplanned downtime through proactive monitoring
- Track maintenance efficiency via standardized KPIs (MTBF, MTTR)
- Receive automatic alerts for critical events (failures, power anomalies, phase reversal)
- Generate compliance and operational reports

### What use cases does it support?

1. Real-time monitoring of escalator/elevator availability
2. Automatic calculation and display of reliability metrics
3. Automated email alerts for equipment failures and anomalies
4. Monthly consolidated reporting for management review

### What is the expected outcome?

A modular, responsive ThingsBoard widget that provides individual and consolidated views of equipment performance with automatic alerting capabilities.

---

## Guide-level Explanation

### Core Concepts

Each equipment (Escalator or Elevator) generates an individual card displaying:

| Field | Type | Example |
|-------|------|---------|
| Name | Text | Escalator 01 |
| Status | Badge (green/red) | Online |
| Phase Reversal | Animated icon/alert | "Reversal detected" |
| Availability | Circular Gauge | 97% |
| MTBF | Text | 12.4h |
| MTTR | Text | 0.6h |
| Alerts | Counter | 3 recent |

### Key Performance Indicators

**Availability (%)**
```
Availability = MTBF / (MTBF + MTTR) × 100
```

**MTBF - Mean Time Between Failures (hours)**
```
MTBF = (Total Operation Time - Maintenance Time) / Number of Stops
```

**MTTR - Mean Time To Repair (hours)**
```
MTTR = Total Maintenance Time / Number of Stops
```

### Additional Technical Indicators

- **Grid Frequency** - Evaluates power quality
- **Power Demand** - Compares actual consumption vs nominal load
- **Current Intensity** - Monitors R/S/T phases of motors
- **Electrical Voltage** - Real-time three-phase power monitoring
- **Energy Consumption** - Consolidated data by month/hour/day

---

## Reference-level Explanation

### Data Architecture

| Property | Value |
|----------|-------|
| Source | ThingsBoard Telemetry (server scope / client scope) |
| Update Interval | Every 1 minute (real-time) |
| History Storage | Telemetry attributes consolidated hourly |

### Widget Structure

```
widget/
├── html/
│   └── template.html          # Card grid layout
├── css/
│   └── styles.css             # Responsive styling
├── javascript/
│   ├── controller.js          # Main widget controller
│   ├── calculations.js        # KPI calculations (MTBF, MTTR, Availability)
│   ├── alerts.js              # Alert management
│   └── utils.js               # Helper functions
└── settings/
    └── schema.json            # Widget configuration schema
```

### Operational Rules

1. **Real-time Query**: Data updated D-1 (previous day)
2. **Global Monthly Report**: Historical measurement records
3. **Inactivity Window**: 22:00 - 05:00 - Equipment enters automatic OFF state
4. **Email Alert Triggers**: @Atendentes_CME, Mechanical team, CCM
5. **Additional Alerts**: Abnormal grid frequency variation
6. **Phase Reversal Detection**: Generated when phase inversion is detected

### Automatic Alerts

| Event | Action |
|-------|--------|
| Equipment stoppage | Email / Message |
| Power grid oscillation | Configurable variation alert |
| Equipment offline (10pm-5am) | Automatic email |
| Phase inversion (Direction reversal) | Priority notification |

### API Endpoints Required

```javascript
// Telemetry subscription
self.ctx.defaultSubscription.subscribeForPaginatedData(...)

// Get entity attributes
self.ctx.attributeService.getEntityAttributes(...)

// Send email alert
self.ctx.http.post('/api/plugins/telemetry/...')
```

### Visual Architecture (Lovable Cards)

Cards organized in responsive grid with:

- Filter by equipment type (Escalator / Elevator)
- "Consolidated View" toggle switch
- "Export Monthly Report" button (PDF/CSV)

---

## Drawbacks

1. **Performance**: Real-time updates every minute may increase server load with many devices
2. **Complexity**: KPI calculations require accurate timestamp tracking
3. **Email Dependencies**: Alert system depends on properly configured SMTP

---

## Rationale and Alternatives

### Why this design?

- **Modular cards**: Easy to add/remove equipment without redesigning
- **ThingsBoard native**: Leverages existing telemetry infrastructure
- **Responsive grid**: Works on desktop and mobile devices

### Alternatives considered

1. **External dashboard (Grafana)**: Rejected - requires additional infrastructure
2. **Static reports only**: Rejected - no real-time visibility
3. **Single consolidated view**: Rejected - loses granular equipment tracking

---

## Prior Art

- ThingsBoard Entity Cards widget
- Industrial SCADA dashboard patterns
- ISO 22400 KPI standards for manufacturing

---

## Unresolved Questions

1. Should alerts be configurable per equipment or global only?
2. What is the data retention policy for historical telemetry?
3. Should PDF reports include charts or tables only?
4. Integration with existing maintenance ticketing system?

---

## Future Possibilities

### Phase 2 Enhancements

- Dynamic filters (Shopping, Zone, Floor, Type)
- Integration with energy and HVAC panels
- AI-powered failure prediction based on historical MTBF patterns

### Phase 3 Enhancements

- Mobile app notifications
- Predictive maintenance scheduling
- Integration with spare parts inventory

---

## Implementation Plan

### MVP - Phase 1 Deliverables

- [ ] Individual indicator cards
- [ ] Automatic availability calculation
- [ ] Offline email alerts (22h-5h window)
- [ ] Simple consolidated view (general average)
- [ ] Monthly report with ranking

### Automatic Reports

| Type | Description |
|------|-------------|
| Daily (D-1) | Availability and MTTR/MTBF snapshot |
| Monthly | Consolidated global measurement report (PDF/CSV) |

---

## Expected Benefits

1. **Increased operational reliability** and reduced downtime
2. **Immediate visibility** of failures and maintenance trends
3. **Full integration** with Myio platform, strengthening automation and data analysis

---

## Appendix A: Widget Settings Schema

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "default": "Operational Indicators"
      },
      "refreshInterval": {
        "type": "number",
        "default": 60000
      },
      "inactivityWindowStart": {
        "type": "number",
        "default": 22
      },
      "inactivityWindowEnd": {
        "type": "number",
        "default": 5
      },
      "alertEmails": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }
}
```

---

## Appendix B: Telemetry Keys

| Key | Description | Unit |
|-----|-------------|------|
| `availability` | Equipment availability | % |
| `mtbf` | Mean Time Between Failures | hours |
| `mttr` | Mean Time To Repair | hours |
| `status` | Online/Offline state | boolean |
| `phaseReversal` | Phase inversion detected | boolean |
| `gridFrequency` | Power grid frequency | Hz |
| `powerDemand` | Current power consumption | kW |
| `currentR` | Current intensity phase R | A |
| `currentS` | Current intensity phase S | A |
| `currentT` | Current intensity phase T | A |
| `voltageRS` | Voltage R-S | V |
| `voltageST` | Voltage S-T | V |
| `voltageTR` | Voltage T-R | V |
| `energyConsumption` | Total energy consumed | kWh |
