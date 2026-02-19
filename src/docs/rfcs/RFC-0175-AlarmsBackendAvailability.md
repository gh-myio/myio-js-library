# RFC-0175: New Endpoint Request — Equipment Availability Stats

> **From**: myio-js-library (Frontend / ThingsBoard Widgets)
> **To**: Alarms Backend Team (`alarms-backend.git`)
> **Date**: 2026-02-19
> **Context**: Supplement to RFC-0175. Requests a **new endpoint** to provide MTBF, MTTR, and Availability metrics computed from alarm history.

---

## TL;DR

We need a new endpoint `GET /api/v1/alarms/stats/availability` that computes **per-device and fleet-wide availability metrics** (MTBF, MTTR, Availability %) from alarm history data.

**Why**: The Operational Indicators panels (RFC-0152) display MTBF, MTTR, and Availability on every equipment card and on the fleet-wide stats header. These values cannot be computed client-side because only the Alarms Backend has the full alarm lifecycle data (`raisedAt`, `closedAt`, duration).

**The data already exists** in the `alarms` table — this endpoint just needs to aggregate it.

---

## 1. Endpoint Specification

### `GET /api/v1/alarms/stats/availability`

### 1.1 Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `customerId` | uuid | **Yes** | — | Customer ID (shopping). Maps to the `customerId` field in alarms. |
| `startAt` | ISO 8601 | **Yes** | — | Start of the time window (inclusive). e.g., `2026-02-01T00:00:00.000Z` |
| `endAt` | ISO 8601 | **Yes** | — | End of the time window (inclusive). e.g., `2026-02-19T23:59:59.999Z` |
| `deviceType` | string | No | — | Filter by device type. Comma-separated. e.g., `ESCADA_ROLANTE,ELEVADOR` |
| `deviceIds` | string | No | — | Filter specific device IDs. Comma-separated, max 50. |
| `includeByDevice` | boolean | No | `true` | Include per-device breakdown in response. Set `false` for fleet-only summary. |

**Note**: The frontend is responsible for computing `startAt` and `endAt` based on the UI period selector. This gives full flexibility for custom ranges without the backend needing to interpret period semantics.

| UI Period | `startAt` | `endAt` |
|-----------|-----------|---------|
| Hoje | `2026-02-19T00:00:00.000Z` | `2026-02-19T23:59:59.999Z` |
| Esta Semana | `2026-02-17T00:00:00.000Z` (Monday) | `2026-02-19T23:59:59.999Z` |
| Este Mês | `2026-02-01T00:00:00.000Z` | `2026-02-19T23:59:59.999Z` |
| Este Trimestre | `2026-01-01T00:00:00.000Z` | `2026-02-19T23:59:59.999Z` |
| Últimos 30 dias | `2026-01-20T00:00:00.000Z` | `2026-02-19T23:59:59.999Z` |
| Custom range | User-defined | User-defined |

### 1.2 Example Requests

```bash
# Fleet-wide stats for a shopping — this month
GET /api/v1/alarms/stats/availability?customerId=aaaa-bbbb-cccc&startAt=2026-02-01T00:00:00.000Z&endAt=2026-02-19T23:59:59.999Z

# Filtered to escalators and elevators only — last 30 days
GET /api/v1/alarms/stats/availability?customerId=aaaa-bbbb-cccc&startAt=2026-01-20T00:00:00.000Z&endAt=2026-02-19T23:59:59.999Z&deviceType=ESCADA_ROLANTE,ELEVADOR

# Specific devices only
GET /api/v1/alarms/stats/availability?customerId=aaaa-bbbb-cccc&startAt=2026-02-01T00:00:00.000Z&endAt=2026-02-19T23:59:59.999Z&deviceIds=dev-001,dev-002,dev-003

# Fleet summary only (lighter response) — this week
GET /api/v1/alarms/stats/availability?customerId=aaaa-bbbb-cccc&startAt=2026-02-17T00:00:00.000Z&endAt=2026-02-19T23:59:59.999Z&includeByDevice=false

# Full quarter
GET /api/v1/alarms/stats/availability?customerId=aaaa-bbbb-cccc&startAt=2026-01-01T00:00:00.000Z&endAt=2026-03-31T23:59:59.999Z&deviceType=ELEVADOR
```

### 1.3 Request Headers

```http
Content-Type: application/json
Authorization: Bearer <gcdr-jwt-token>
```

---

## 2. Expected Response

### 2.1 Full Response Shape (TypeScript)

```typescript
interface AvailabilityStatsResponse {
  /** Query metadata */
  customerId: string;
  startAt: string;           // ISO 8601 — echoes the request parameter
  endAt: string;             // ISO 8601 — echoes the request parameter
  periodTotalHours: number;  // Computed: (endAt - startAt) in hours

  /** Fleet-wide aggregated metrics */
  fleet: {
    /** Total devices that match the filter */
    totalDevices: number;
    /** Devices that had at least 1 alarm in the period */
    devicesWithAlarms: number;
    /** Sum of all alarm occurrences across all devices */
    totalFailures: number;
    /** Sum of all downtime hours across all devices */
    totalDowntimeHours: number;
    /** Sum of all operating hours across all devices */
    totalOperatingHours: number;
    /** Average MTBF across all devices (hours) */
    avgMtbfHours: number;
    /** Average MTTR across all devices (hours) */
    avgMttrHours: number;
    /** Average availability across all devices (0-100%) */
    avgAvailability: number;
    /** Device count grouped by health status */
    byStatus: {
      healthy: number;    // availability >= 95%
      degraded: number;   // availability >= 80% and < 95%
      critical: number;   // availability < 80%
    };
  };

  /**
   * Pre-computed summary for the OperationalHeaderDevicesGrid component.
   * Maps directly to OperationalHeaderStats — frontend can pass this
   * to headerInstance.updateStats() with minimal transformation.
   *
   * Classification is based on alarm state per device:
   * - onlineNormal:       no OPEN alarms
   * - onlineStandby:      no alarms at all in the period (never failed)
   * - onlineAlert:        has OPEN alarm with severity HIGH or MEDIUM
   * - onlineFailure:      has OPEN alarm with severity CRITICAL
   * - maintenanceOnline:  has OPEN alarm with alarmType containing "MAINTENANCE" and device has other recent activity
   * - maintenanceOffline: has OPEN alarm with alarmType containing "MAINTENANCE" and no recent activity
   * - offline:            device has no activity and has OPEN CRITICAL alarm for > 24h
   */
  summary: {
    total: number;
    online: number;
    offline: number;
    maintenance: number;
    warning: number;
    avgAvailability: number;   // 0-100%
    avgMtbf: number;           // hours
    avgMttr: number;           // hours
    onlineStandby: number;
    onlineNormal: number;
    onlineAlert: number;
    onlineFailure: number;
    maintenanceOnline: number;
    maintenanceOffline: number;
  };

  /** Per-device breakdown (only if includeByDevice=true) */
  byDevice?: DeviceAvailability[];
}

interface DeviceAvailability {
  /** Device ID (matches ThingsBoard device entity ID) */
  deviceId: string;
  /** Device display name (from alarm records) */
  deviceName: string;
  /** Device type (e.g., ESCADA_ROLANTE, ELEVADOR) */
  deviceType: string;
  /** Customer ID this device belongs to */
  customerId: string;
  /** Number of alarm events (failures) in the period */
  failureCount: number;
  /** Total hours the device was in alarm/down state */
  totalDowntimeHours: number;
  /** Total hours the device was operating normally */
  operatingHours: number;
  /** Mean Time Between Failures (hours). 0 if always down, periodTotalHours if no failures */
  mtbfHours: number;
  /** Mean Time To Repair (hours). 0 if no failures */
  mttrHours: number;
  /** Availability percentage (0-100) */
  availability: number;
  /** Timestamp of most recent failure (null if no failures) */
  lastFailureAt: string | null;
  /** Duration of the longest single downtime event (hours) */
  longestDowntimeHours: number;
  /** Health status classification */
  status: 'healthy' | 'degraded' | 'critical';
}
```

### 2.2 Sample Response JSON

```json
{
  "customerId": "c5a2e3f0-1234-5678-9abc-def012345678",
  "startAt": "2026-02-01T00:00:00.000Z",
  "endAt": "2026-02-19T23:59:59.999Z",
  "periodTotalHours": 456,

  "fleet": {
    "totalDevices": 48,
    "devicesWithAlarms": 18,
    "totalFailures": 67,
    "totalDowntimeHours": 201.5,
    "totalOperatingHours": 21686.5,
    "avgMtbfHours": 320.4,
    "avgMttrHours": 3.0,
    "avgAvailability": 99.08,
    "byStatus": {
      "healthy": 30,
      "degraded": 12,
      "critical": 6
    }
  },

  "summary": {
    "total": 48,
    "online": 36,
    "offline": 3,
    "maintenance": 5,
    "warning": 4,
    "avgAvailability": 99.08,
    "avgMtbf": 320.4,
    "avgMttr": 3.0,
    "onlineStandby": 10,
    "onlineNormal": 18,
    "onlineAlert": 5,
    "onlineFailure": 3,
    "maintenanceOnline": 3,
    "maintenanceOffline": 2
  },

  "byDevice": [
    {
      "deviceId": "a1b2c3d4-0001-1111-aaaa-000000000001",
      "deviceName": "ESC-01",
      "deviceType": "ESCADA_ROLANTE",
      "customerId": "c5a2e3f0-1234-5678-9abc-def012345678",
      "failureCount": 5,
      "totalDowntimeHours": 12.3,
      "operatingHours": 443.7,
      "mtbfHours": 88.7,
      "mttrHours": 2.5,
      "availability": 97.30,
      "lastFailureAt": "2026-02-18T14:30:00.000Z",
      "longestDowntimeHours": 4.2,
      "status": "degraded"
    },
    {
      "deviceId": "a1b2c3d4-0002-2222-bbbb-000000000002",
      "deviceName": "ELV-01",
      "deviceType": "ELEVADOR",
      "customerId": "c5a2e3f0-1234-5678-9abc-def012345678",
      "failureCount": 0,
      "totalDowntimeHours": 0,
      "operatingHours": 456,
      "mtbfHours": 456,
      "mttrHours": 0,
      "availability": 100.00,
      "lastFailureAt": null,
      "longestDowntimeHours": 0,
      "status": "healthy"
    },
    {
      "deviceId": "a1b2c3d4-0003-3333-cccc-000000000003",
      "deviceName": "ESC-02",
      "deviceType": "ESCADA_ROLANTE",
      "customerId": "c5a2e3f0-1234-5678-9abc-def012345678",
      "failureCount": 12,
      "totalDowntimeHours": 48.0,
      "operatingHours": 408.0,
      "mtbfHours": 34.0,
      "mttrHours": 4.0,
      "availability": 89.47,
      "lastFailureAt": "2026-02-19T09:15:00.000Z",
      "longestDowntimeHours": 8.5,
      "status": "critical"
    },
    {
      "deviceId": "a1b2c3d4-0004-4444-dddd-000000000004",
      "deviceName": "ELV-02",
      "deviceType": "ELEVADOR",
      "customerId": "c5a2e3f0-1234-5678-9abc-def012345678",
      "failureCount": 2,
      "totalDowntimeHours": 3.5,
      "operatingHours": 452.5,
      "mtbfHours": 226.3,
      "mttrHours": 1.8,
      "availability": 99.23,
      "lastFailureAt": "2026-02-15T08:20:00.000Z",
      "longestDowntimeHours": 2.1,
      "status": "healthy"
    },
    {
      "deviceId": "a1b2c3d4-0005-5555-eeee-000000000005",
      "deviceName": "ESC-03",
      "deviceType": "ESCADA_ROLANTE",
      "customerId": "c5a2e3f0-1234-5678-9abc-def012345678",
      "failureCount": 8,
      "totalDowntimeHours": 36.0,
      "operatingHours": 420.0,
      "mtbfHours": 52.5,
      "mttrHours": 4.5,
      "availability": 92.11,
      "lastFailureAt": "2026-02-19T11:45:00.000Z",
      "longestDowntimeHours": 6.3,
      "status": "degraded"
    }
  ]
}
```

---

## 3. Calculation Logic

The backend computes these from the existing `alarms` table. Pseudocode:

```sql
-- For each device in the period:

-- 1. Count failures
failureCount = COUNT(*) FROM alarms
  WHERE customerId = :customerId
    AND raisedAt >= :startAt
    AND raisedAt <= :endAt
    AND deviceId = :deviceId

-- 2. Total downtime (hours)
--    For CLOSED alarms: closedAt - raisedAt
--    For OPEN alarms:   NOW() - raisedAt
totalDowntimeHours = SUM(
  CASE
    WHEN closedAt IS NOT NULL THEN EXTRACT(EPOCH FROM closedAt - raisedAt) / 3600
    ELSE EXTRACT(EPOCH FROM NOW() - raisedAt) / 3600
  END
) FROM alarms
  WHERE customerId = :customerId
    AND raisedAt >= :startAt
    AND raisedAt <= :endAt
    AND deviceId = :deviceId

-- 3. Operating hours
operatingHours = periodTotalHours - totalDowntimeHours

-- 4. MTBF
mtbfHours = CASE
  WHEN failureCount = 0 THEN periodTotalHours
  ELSE operatingHours / failureCount
END

-- 5. MTTR
mttrHours = CASE
  WHEN failureCount = 0 THEN 0
  ELSE totalDowntimeHours / failureCount
END

-- 6. Availability
availability = (operatingHours / periodTotalHours) * 100

-- 7. Status
status = CASE
  WHEN availability >= 95 THEN 'healthy'
  WHEN availability >= 80 THEN 'degraded'
  ELSE 'critical'
END
```

**Fleet averages**:
```sql
avgMtbfHours    = AVG(mtbfHours)    across all devices
avgMttrHours    = AVG(mttrHours)    across all devices
avgAvailability = AVG(availability) across all devices
```

### Edge Cases

| Case | Behavior |
|------|----------|
| Device with 0 alarms | `failureCount=0`, `mtbf=periodTotalHours`, `mttr=0`, `availability=100`, `status=healthy` |
| Device with alarm still OPEN | Downtime = `now() - raisedAt` (ongoing) |
| Overlapping alarms on same device | Sum only the **union** of downtime intervals (avoid double-counting) |
| Device not found in alarms table | Include with `failureCount=0` if device list is known, or omit |
| `startAt` > `endAt` | Return 400 Bad Request |
| Very large range (> 1 year) | Return 400 Bad Request or cap at 365 days |

---

## 4. How We Use This in the Frontend

### 4.1 Stats Header (OperationalHeaderDevicesGrid)

```
┌──────┬───────────────────────┬────────────────────┬─────────┬───────────┬───────────┬───────────┐
│TOTAL │ ONLINE                │ MANUTENÇÃO         │ OFFLINE │ MTBF      │ MTTR      │ DISP.     │
│  48  │ Standby Normal Alerta │ Online    Offline   │    6    │   320h    │   3.0h    │   99%     │
│      │   10     20     12    │   3          3      │         │  MÉDIA    │  MÉDIA    │  MÉDIA    │
└──────┴───────────────────────┴────────────────────┴─────────┴───────────┴───────────┴───────────┘
```

```typescript
// Frontend computes the date range
const now = new Date();
const startAt = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); // 1st of month
const endAt = now.toISOString();

// response = GET /api/v1/alarms/stats/availability?customerId=xxx&startAt=...&endAt=...

// Direct pass-through — summary maps 1:1 to OperationalHeaderStats
headerInstance.updateStats(response.summary);

// Which is equivalent to:
// headerInstance.updateStats({
//   total: 48,
//   online: 36,
//   offline: 3,
//   maintenance: 5,
//   warning: 4,
//   avgAvailability: 99.08,
//   avgMtbf: 320.4,
//   avgMttr: 3.0,
//   onlineStandby: 10,
//   onlineNormal: 18,
//   onlineAlert: 5,
//   onlineFailure: 3,
//   maintenanceOnline: 3,
//   maintenanceOffline: 2,
// });
```

### 4.2 Equipment Cards (Phase 3 - General List)

Each card shows per-device metrics:

```
┌─────────────────────────────┐
│ ESC-01              [Online]│
│ Escada Rolante              │
│                             │
│       ┌─────────┐          │
│       │  97.3%  │          │
│       │  gauge  │          │
│       └─────────┘          │
│     Disponibilidade         │
│                             │
│  MTBF: 88.7h  │ MTTR: 2.5h │
│  🔔 5 alertas              │
└─────────────────────────────┘
```

```typescript
// Map byDevice to EquipmentCardData
response.byDevice.forEach(device => {
  equipmentCard.availability = device.availability;
  equipmentCard.mtbf = device.mtbfHours;
  equipmentCard.mttr = device.mttrHours;
  equipmentCard.recentAlerts = device.failureCount;
});
```

### 4.3 Management Dashboard (Phase 5)

```typescript
// Fleet KPIs
dashboardKPIs.fleetAvailability = response.fleet.avgAvailability;
dashboardKPIs.fleetMTBF = response.fleet.avgMtbfHours;
dashboardKPIs.fleetMTTR = response.fleet.avgMttrHours;
dashboardKPIs.totalEquipment = response.fleet.totalDevices;
```

---

## 5. Performance Considerations

### Expected Volume

- **Devices per customer**: 10-80 (typical shopping has 20-50 operational devices)
- **Alarms per device per month**: 0-30
- **Call frequency**: Once per panel open, cached 60s on frontend

### Suggested Backend Optimizations

| Optimization | Description |
|-------------|-------------|
| **Precomputed materialized view** | Refresh hourly: aggregate downtime per device per day |
| **Index** | `CREATE INDEX idx_alarms_customer_period ON alarms (customerId, raisedAt, deviceId)` |
| **Limit byDevice** | Cap at 200 devices in response. If more, return `fleet` only |
| **Cache** | Backend can cache result for 5-10 minutes per customerId+startAt+endAt combo |

---

## 6. Questions for Backend Team

| # | Question | Priority |
|---|----------|----------|
| 1 | Does the `alarms` table have a `customerId` column? Or only `tenantId`? If only `tenantId`, we can use that instead. | **High** |
| 2 | How do you handle overlapping alarms on the same device? (e.g., two alarms open simultaneously) | Medium |
| 3 | Is there a device registry in the Alarms Backend? Or does `totalDevices` come from distinct `deviceId` values in alarms? | Medium |
| 4 | Can `deviceType` filtering be done server-side? Or do we filter client-side? | Low |
| 5 | Should there be a max allowed range between `startAt` and `endAt`? We suggest 365 days. | Low |

---

## 7. Priority

| Priority | Reason |
|----------|--------|
| **High** | This endpoint populates the main KPIs on all 3 Operational Indicators panels. Without it, MTBF/MTTR/Availability show `0h` / `0%`. |

---

## 8. Contact

- **Frontend team**: myio-js-library (`myio-js-library-PROD.git`)
- **RFC document**: `src/docs/rfcs/RFC-0175-AlarmsBackendAvailability.md`
- **Related**: `RFC-0175-AlarmsBackendRequirements.md` (general backend requirements)
- **Tech Lead**: Rodrigo Lago - rodrigo@myio.com.br
