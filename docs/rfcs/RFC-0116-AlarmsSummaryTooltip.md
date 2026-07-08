# RFC 0116: Alarms Summary Tooltip

- Feature Name: `alarms_summary_tooltip`
- Start Date: 2026-01-02
- RFC PR: (to be assigned)
- Status: **Draft - Nao Liberada**
- Authors: MYIO Engineering
- Target Version: v0.3.x (TBD)
- Related Components: RFC-0112 (Welcome Modal), RFC-0105 (Energy Summary Tooltip)

---

## Summary

This RFC proposes the **AlarmsSummaryTooltip** component for the MYIO library. This tooltip will provide a quick summary of alarms for each customer/shopping in the Welcome Modal.

**STATUS: FUNCIONALIDADE AINDA NAO LIBERADA**

---

## Motivation

The Welcome Modal shows shopping cards with device counts (energy, water, temperature). Users have requested additional quick-access information:

1. **Users** - Who has access to this shopping's dashboard
2. **Alarms** - Active alarms requiring attention
3. **Notifications** - Recent notifications and alerts

This RFC focuses on the Alarms component.

---

## Proposed Features

### Alarm Categories
- **Critical**: System failures, immediate attention required
- **Warning**: Threshold exceeded, monitoring required
- **Info**: Informational alerts, no action required

### Summary View
- Total alarms count
- Active vs acknowledged alarms
- Alarms by severity pie/bar chart
- Recent alarms list (last 5)

### Alarm Details
- Alarm type/category
- Device/location affected
- Timestamp
- Acknowledge button
- Snooze option

### Integration Points
- Welcome Modal shopping cards
- MAIN dashboard telemetry view
- Notification center

---

## API Design (Draft)

```typescript
interface AlarmInfo {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  deviceId?: string;
  deviceLabel?: string;
}

interface AlarmsSummaryData {
  totalAlarms: number;
  activeAlarms: number;
  acknowledgedAlarms: number;
  bySeverity: {
    critical: number;
    warning: number;
    info: number;
  };
  recentAlarms?: AlarmInfo[];
  lastUpdated: string;
  customerName?: string;
}

// Usage
AlarmsSummaryTooltip.show(triggerElement, alarmsSummaryData);
```

---

## Implementation Status

- [x] Placeholder tooltip created (shows "Nao Liberada" message)
- [ ] API integration design
- [ ] Backend alarm aggregation endpoint
- [ ] Full tooltip UI implementation
- [ ] Alarm acknowledgment flow
- [ ] Real-time updates (WebSocket/polling)
- [ ] Testing and validation

---

## Dependencies

- ThingsBoard alarm API
- Backend aggregation service
- User permissions system

---

## Timeline

**Not yet scheduled** - This feature is pending prioritization.

---

## References

- [RFC-0112 Welcome Modal Head Office](./RFC-0112-WelcomeModalHeadOffice.md)
- [RFC-0105 Energy Summary Tooltip](./RFC-0105-EnergySummaryTooltip.md)
- [ThingsBoard Alarm API](https://thingsboard.io/docs/user-guide/alarms/)

---

## Document History

- 2026-01-02: Initial RFC draft created
- 2026-01-02: Placeholder implementation added to library
