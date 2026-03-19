# RFC-0175: Alarms Real Usage - Replacing Mock Data with Real Alarms Backend API

- **Start Date**: 2026-02-19
- **RFC PR**: N/A (draft)
- **Status**: Draft
- **Depends on**: RFC-0152 (Operational Indicators Panels)
- **Related**: RFC-0111 (Device Domain Classification), RFC-0128 (Equipment Subcategorization)

---

## Summary

Replace all mock/hardcoded data in the RFC-0152 Operational Indicators panels (Phase 3 General List, Phase 4 Alarms & Notifications, Phase 5 Management Dashboard) with real data fetched from the **Alarms Backend** (`alarms-api`) REST API and WebSocket. Device and customer master data continue to come from **ThingsBoard** (already available via datasources and existing myio-js-library events). This RFC documents the `AlarmService` module architecture, API endpoint mapping, type transformation layer, authentication flow, real-time WebSocket integration, and a phased rollout plan.

---

## Motivation

RFC-0152 introduced five phases of Operational Indicators for shopping mall equipment monitoring. Phases 1 (User Access Gating) and 2 (Menu Column Navigation) are fully implemented using real ThingsBoard attributes. However, **Phases 3, 4, and 5 still render mock data**:

- **Phase 3 (General List)**: Equipment cards with fabricated availability, MTBF, MTTR, and alert counts.
- **Phase 4 (Alarms & Notifications)**: Alarm list and dashboard with hardcoded severity distributions, trend data, and alarm records.
- **Phase 5 (Management Dashboard)**: Fleet-wide KPIs, trend charts, and Top 5 Downtime list all using static values.

The Alarms Backend is now production-ready with REST APIs, WebSocket support, and comprehensive statistics endpoints. The myio-js-library needs a well-defined integration layer to:

1. Fetch real alarm data, statistics, and trends from the Alarms Backend.
2. Combine alarm data with device/customer data **already available from ThingsBoard** (via `myio:data-ready`, `myio:customers-ready` events, and existing classification utilities like `detectDomain()`, `classifyEquipment()`).
3. Map backend API responses to the existing TypeScript types in `src/types/alarm.ts` and `src/types/operational.ts`.
4. Support real-time updates via WebSocket.
5. Handle authentication for the Alarms Backend.

### Why NOT use the GCDR API?

The GCDR (Global Central Data Registry) is the ecosystem's Single Source of Truth for master data. However, **the myio-js-library runs inside ThingsBoard**, which already provides:

| Data | ThingsBoard Source | GCDR Equivalent (NOT needed) |
|------|-------------------|------------------------------|
| Device list | Datasource + `myio:data-ready` event | `GET /customers/:id/devices` |
| Customer/shopping names | `myio:customers-ready` event | `GET /customers/:id` |
| Device type/classification | `detectDomain()`, `classifyEquipment()` (RFC-0111/0128) | Device metadata from GCDR |
| Device status (online/offline) | `calculateDeviceStatusMasterRules()` | Device connectivity from GCDR |
| Location/asset info | ThingsBoard device attributes | `GET /customers/:id/assets` |

Adding GCDR API calls would introduce unnecessary complexity (extra auth, CORS, latency) for data we already have. **Only the Alarms Backend provides data that ThingsBoard does not have**: alarm records, alarm statistics, alarm trends, alarm actions, and real-time alarm events.

---

## Ecosystem Overview

### Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   ThingsBoard Dashboard                                   │
│                                                                          │
│   myio-js-library (this project)                                         │
│                                                                          │
│   ┌─────────────────────────────┐    ┌────────────────────────────────┐ │
│   │  TB Datasources (existing)  │    │  AlarmService (NEW - RFC-0175) │ │
│   │                             │    │                                │ │
│   │  • Device data              │    │  • Alarm list & detail         │ │
│   │  • Customer/shopping list   │    │  • Alarm stats & trends        │ │
│   │  • Device status            │    │  • Alarm actions (ack, close)  │ │
│   │  • Equipment classification │    │  • WebSocket real-time         │ │
│   │                             │    │                                │ │
│   │  Events:                    │    │  API calls to:                 │ │
│   │  • myio:data-ready          │    │  Alarms Backend (Fastify)      │ │
│   │  • myio:customers-ready     │    │                                │ │
│   │  • myio:filter-applied      │    │                                │ │
│   └─────────────────────────────┘    └──────────────┬─────────────────┘ │
│                                                      │                    │
└──────────────────────────────────────────────────────┼────────────────────┘
                                                       │ REST + WebSocket
                                                       ▼
                                            ┌──────────────────────┐
                                            │  Alarms Backend      │
                                            │  (Fastify)           │
                                            │                      │
                                            │  • GET /alarms       │
                                            │  • GET /stats        │
                                            │  • GET /stats/trend  │
                                            │  • GET /stats/top-*  │
                                            │  • POST /alarms/ack  │
                                            │  • WS /ws            │
                                            └──────────┬───────────┘
                                                       │
                                                       ▼
                                              PostgreSQL + Redis
```

### Alarms Backend (Alarm Orchestrator)

The Alarms Backend processes alarm events, manages alarm lifecycle (OPEN, ACK, SNOOZED, ESCALATED, CLOSED), computes statistics, and dispatches notifications (Telegram, WorkOrder, Webhook).

| Aspect | Detail |
|--------|--------|
| **Framework** | Fastify 5 (Node.js 20) |
| **Database** | PostgreSQL 16 + Redis (BullMQ) |
| **Production URL** | `https://alarms-api.a.myio-bas.com` |
| **Staging URL** | `https://alarms-staging.myio.com.br` |
| **Local URL** | `http://localhost:3020` |
| **WebSocket (prod)** | `wss://alarms-api.a.myio-bas.com/ws` |
| **WebSocket (local)** | `ws://localhost:3020/ws` |
| **Auth** | JWT Bearer Token (audience: `alarm-orchestrator`) |
| **Swagger** | `/docs` |

### Authentication Context

The GCDR (Identity Provider) emits JWT tokens with multiple audiences:

```json
{
  "sub": "user-uuid",
  "tenant_id": "tenant-uuid",
  "email": "usuario@empresa.com",
  "roles": ["role:super-admin", "role:operator"],
  "iss": "gcdr",
  "aud": ["gcdr-api", "alarm-orchestrator"]
}
```

The Alarms Backend validates that `"alarm-orchestrator"` is present in the `aud` claim. The myio-js-library needs to obtain a GCDR-issued JWT to call the Alarms Backend (see [Authentication Flow](#4-authentication-flow)).

### What ThingsBoard Already Provides

The myio-js-library already has a rich event-driven data layer:

| Event | Data Available | Used By |
|-------|---------------|---------|
| `myio:data-ready` | All classified devices with status, domain, context | Phase 3 (equipment list) |
| `myio:customers-ready` | Shopping/customer list | Phase 3, 4, 5 (customer names) |
| `myio:equipment-count-updated` | Equipment counts by category | Phase 3 (stats) |
| `myio:filter-applied` | Active filters | All phases |

Utility functions already available:

| Function | Purpose |
|----------|---------|
| `detectDomain(device)` | Classify device as energy/water/temperature |
| `detectContext(device)` | Detect specific context (equipments, stores, etc.) |
| `classifyEquipment(device)` | Subcategorize into climatizacao, elevadores, escadas, etc. |
| `calculateDeviceStatusMasterRules(device)` | Determine device online/offline/waiting/weak status |

---

## Guide-Level Explanation

### Developer Experience

From a developer working on RFC-0152 panels, the integration should feel like swapping a mock function call for a real one:

```typescript
// BEFORE (mock data)
const { alarms, stats } = await fetchAlarmsData();

// AFTER (real data via AlarmService)
import { AlarmService } from 'myio-js-library';

const service = AlarmService.getInstance({ alarmsApiUrl, token });
const alarms = await service.getAlarms(filters);
const stats = await service.getAlarmStats(tenantId, 'week');
```

For equipment data (Phase 3), device data continues to come from ThingsBoard:

```typescript
// Equipment data still comes from TB events (no change)
window.addEventListener('myio:data-ready', (e) => {
  const devices = e.detail.classified;
  const escalators = devices.filter(d => classifyEquipment(d) === 'escadas_rolantes');
  const elevators = devices.filter(d => classifyEquipment(d) === 'elevadores');

  // NEW: Enrich with alarm data from Alarms Backend
  const alertCounts = await service.getStatsByDevice(tenantId);
  // Merge alert counts into equipment cards...
});
```

The `AlarmService` handles:
- API URL resolution (from widget settings, customer attributes, or defaults)
- JWT token attachment
- Response mapping to existing `src/types/alarm.ts` and `src/types/operational.ts` types
- Caching with TTL for repeated reads
- Error handling with graceful fallback to empty states
- WebSocket connection for real-time updates

### Data Flow

```
Widget onInit()
    │
    ├─ 1. Resolve Alarms API URL (widget settings → customer attrs → default)
    ├─ 2. Obtain authentication token (GCDR JWT)
    ├─ 3. Initialize AlarmService.getInstance(config)
    │
    ├─ Phase 3: General List
    │   ├─ Equipment data ← ThingsBoard (myio:data-ready + classifyEquipment)
    │   ├─ Alert counts per device ← AlarmService.getStatsByDevice()
    │   └─ Merge TB device data + alarm counts → EquipmentCardData[]
    │
    ├─ Phase 4: Alarms & Notifications
    │   ├─ service.getAlarms(filters)              → Alarms GET /alarms
    │   ├─ service.getAlarmStats(tenantId, period)  → Alarms GET /stats
    │   ├─ service.getAlarmTrend(tenantId, period)  → Alarms GET /stats/trend
    │   └─ service.acknowledgeAlarm(id, data)       → Alarms POST /alarms/{id}/ack
    │
    ├─ Phase 5: Management Dashboard
    │   ├─ Equipment counts ← ThingsBoard (myio:equipment-count-updated)
    │   ├─ service.getAlarmStats(tenantId, period)  → Alarms GET /stats
    │   ├─ service.getAlarmTrend(tenantId, period)  → Alarms GET /stats/trend
    │   ├─ service.getTopOffenders(tenantId, limit)  → Alarms GET /stats/top-offenders
    │   └─ Compute fleet KPIs from TB data + alarm stats
    │
    └─ WebSocket (optional, for real-time)
        ├─ service.connectWebSocket(tenantId)
        ├─ on 'alarm.created'  → prepend to alarm list, refresh stats
        └─ on 'alarm.updated'  → update alarm in list
```

---

## Reference-Level Explanation

### 1. AlarmService Module Architecture

The `AlarmService` will be a new module in `src/services/alarm/` with the following structure:

```
src/services/alarm/
├── index.ts                    # Public exports
├── AlarmService.ts             # Main facade (singleton)
├── clients/
│   └── AlarmApiClient.ts       # HTTP client for Alarms Backend
├── websocket/
│   └── AlarmWebSocket.ts       # WebSocket client for real-time
├── mappers/
│   ├── alarmMapper.ts          # API response → Alarm types
│   ├── statsMapper.ts          # API response → AlarmStats / DashboardKPIs
│   └── equipmentMapper.ts      # TB device + alarm data → EquipmentCardData
├── cache/
│   └── ServiceCache.ts         # In-memory TTL cache
└── config/
    └── apiConfig.ts            # URL resolution + defaults
```

**Note**: No `GCDRApiClient` — device/customer data comes from ThingsBoard.

### 2. API Endpoints Used (Alarms Backend Only)

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `GET /alarms` | GET | List alarms with filters | Phase 4 (Alarm List) |
| `GET /alarms/:id` | GET | Get single alarm detail | Phase 4 (Alarm Detail) |
| `POST /alarms/:id/ack` | POST | Acknowledge an alarm | Phase 4 (Alarm Actions) |
| `POST /alarms/:id/silence` | POST | Snooze an alarm | Phase 4 (Alarm Actions) |
| `POST /alarms/:id/escalate` | POST | Escalate an alarm | Phase 4 (Alarm Actions) |
| `POST /alarms/:id/close` | POST | Close an alarm | Phase 4 (Alarm Actions) |
| `GET /api/v1/alarms/stats` | GET | Aggregate alarm statistics | Phase 4 Dashboard, Phase 5 KPIs |
| `GET /api/v1/alarms/stats/trend` | GET | Alarm trend over time | Phase 4 Dashboard, Phase 5 Charts |
| `GET /api/v1/alarms/stats/top-offenders` | GET | Top devices by alarm count | Phase 5 Top Downtime |
| `GET /api/v1/alarms/stats/by-device` | GET | Per-device alarm stats | Phase 3 (Alert counts per equipment) |

**Request headers** (all endpoints):
```http
Content-Type: application/json
Authorization: Bearer <gcdr-jwt-token>
```

#### `GET /alarms` - List Alarms

**Query parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | enum | Filter by: OPEN, ACK, SNOOZED, ESCALATED, CLOSED |
| `severity` | enum | Filter by: CRITICAL, HIGH, MEDIUM, LOW, INFO |
| `limit` | number | Items per page (1-100, default: 20) |
| `cursor` | string | Pagination cursor |

**Response**:
```json
{
  "data": [
    {
      "id": "alrm_7Ks9xMpQr2nL4vWz",
      "title": "Temperatura acima do limite",
      "alarmType": "TEMPERATURE_HIGH",
      "severity": "CRITICAL",
      "state": "OPEN",
      "tenantId": "uuid",
      "customerId": "uuid",
      "centralId": "uuid",
      "deviceId": "device-123",
      "deviceType": "temperature-sensor",
      "description": "Sensor registrou 45°C (limite: 40°C)",
      "fingerprint": "hash-unico",
      "metadata": { "currentValue": 45, "threshold": 40, "unit": "celsius" },
      "raisedAt": "2026-02-10T10:30:00.000Z",
      "updatedAt": "2026-02-10T10:30:00.000Z",
      "occurrenceCount": 1
    }
  ],
  "pagination": { "hasMore": true, "cursor": "eyJpZCI6Ijk5OSJ9", "total": 150 }
}
```

#### `GET /api/v1/alarms/stats` - Alarm Statistics

**Query parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | uuid | Tenant ID (required) |
| `period` | enum | Time period: `day`, `week`, `month` |

**Response**:
```json
{
  "total": 150,
  "bySeverity": { "CRITICAL": 10, "HIGH": 25, "MEDIUM": 50, "LOW": 40, "INFO": 25 },
  "byState": { "OPEN": 15, "ACK": 5, "SNOOZED": 2, "ESCALATED": 3, "CLOSED": 125 },
  "openCritical": 3,
  "openHigh": 7,
  "last24Hours": 12,
  "avgResolutionTimeMinutes": 45
}
```

#### `GET /api/v1/alarms/stats/trend` - Alarm Trend

**Query parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | uuid | Tenant ID (required) |
| `period` | enum | `day`, `week`, `month` |
| `groupBy` | enum | `hour`, `day`, `week` |

#### `GET /api/v1/alarms/stats/top-offenders` - Top Offenders

**Query parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `tenantId` | uuid | Tenant ID (required) |
| `limit` | number | Number of results (default: 5) |

#### Alarm Actions

```bash
# Acknowledge
POST /alarms/{id}/ack
Body: { "acknowledgedBy": "email", "note": "optional" }

# Silence (snooze)
POST /alarms/{id}/silence
Body: { "silencedBy": "email", "duration": "4h", "reason": "optional" }

# Escalate
POST /alarms/{id}/escalate
Body: { "escalatedBy": "email", "reason": "optional" }

# Close
POST /alarms/{id}/close
Body: { "closedBy": "email", "resolution": "optional" }
```

#### Response Patterns

**Success (single item)**:
```json
{ "success": true, "data": { ... } }
```

**Error**:
```json
{
  "error": {
    "code": "ALARM_NOT_FOUND",
    "message": "Alarme não encontrado: alrm_xxx",
    "timestamp": "2026-01-21T10:30:00Z"
  }
}
```

**HTTP status codes**: 200 OK, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable Entity, 500 Internal Server Error.

### 3. Type Mapping

#### 3.1 Alarms Backend Response → `Alarm` (src/types/alarm.ts)

```typescript
// Alarms Backend response shape (from GET /alarms)
interface AlarmApiResponse {
  id: string;           // e.g., "alrm_7Ks9xMpQr2nL4vWz"
  title: string;
  alarmType: string;    // e.g., "TEMPERATURE_HIGH"
  severity: string;     // "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  state: string;        // "OPEN" | "ACK" | "SNOOZED" | "ESCALATED" | "CLOSED"
  tenantId: string;
  customerId?: string;
  centralId?: string;
  deviceId: string;
  deviceType: string;
  description?: string;
  fingerprint: string;
  metadata?: Record<string, unknown>;
  raisedAt: string;     // ISO 8601
  updatedAt: string;    // ISO 8601
  closedAt?: string;
  closedBy?: string;
  resolution?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  snoozedUntil?: string;
  escalatedAt?: string;
  escalatedBy?: string;
  occurrenceCount?: number;
}
```

**Mapping to `Alarm`** (`src/types/alarm.ts`):

```typescript
// src/services/alarm/mappers/alarmMapper.ts
export function mapApiAlarmToAlarm(api: AlarmApiResponse, customerName?: string): Alarm {
  return {
    id: api.id,
    customerId: api.customerId ?? api.tenantId,
    customerName: customerName ?? '',
    source: api.deviceId,
    severity: api.severity as AlarmSeverity,
    state: api.state as AlarmState,
    title: api.title,
    description: api.description ?? '',
    tags: {
      alarmType: api.alarmType,
      deviceType: api.deviceType,
      ...(api.metadata as Record<string, string> ?? {}),
    },
    firstOccurrence: api.raisedAt,
    lastOccurrence: api.updatedAt,
    occurrenceCount: api.occurrenceCount ?? 1,
    acknowledgedAt: api.acknowledgedAt,
    acknowledgedBy: api.acknowledgedBy,
    snoozedUntil: api.snoozedUntil,
    closedAt: api.closedAt,
    closedBy: api.closedBy,
    closedReason: api.resolution,
  };
}
```

**Customer name enrichment**: The `customerName` comes from the TB `myio:customers-ready` cache (already loaded), not from a GCDR API call. The mapper receives it as a parameter.

#### 3.2 Alarms Stats Response → `AlarmStats` (src/types/alarm.ts)

The mapping is nearly 1:1 because `src/types/alarm.ts` was designed based on the Alarms Backend schema:

```typescript
// src/services/alarm/mappers/statsMapper.ts
export function mapApiStatsToAlarmStats(api: AlarmStatsApiResponse): AlarmStats {
  return {
    total: api.total,
    bySeverity: {
      CRITICAL: api.bySeverity?.CRITICAL ?? 0,
      HIGH: api.bySeverity?.HIGH ?? 0,
      MEDIUM: api.bySeverity?.MEDIUM ?? 0,
      LOW: api.bySeverity?.LOW ?? 0,
      INFO: api.bySeverity?.INFO ?? 0,
    },
    byState: {
      OPEN: api.byState?.OPEN ?? 0,
      ACK: api.byState?.ACK ?? 0,
      SNOOZED: api.byState?.SNOOZED ?? 0,
      ESCALATED: api.byState?.ESCALATED ?? 0,
      CLOSED: api.byState?.CLOSED ?? 0,
    },
    openCritical: api.openCritical,
    openHigh: api.openHigh,
    last24Hours: api.last24Hours,
  };
}
```

#### 3.3 Alarms Trend Response → `AlarmTrendDataPoint` (src/types/alarm.ts)

```typescript
export function mapApiTrendToTrendDataPoints(
  apiTrend: Array<{ period: string; count: number; bySeverity?: Record<string, number> }>
): AlarmTrendDataPoint[] {
  return apiTrend.map(point => ({
    label: point.period,
    timestamp: new Date(point.period).getTime(),
    total: point.count,
    bySeverity: point.bySeverity ? {
      CRITICAL: point.bySeverity.CRITICAL ?? 0,
      HIGH: point.bySeverity.HIGH ?? 0,
      MEDIUM: point.bySeverity.MEDIUM ?? 0,
      LOW: point.bySeverity.LOW ?? 0,
      INFO: point.bySeverity.INFO ?? 0,
    } : undefined,
  }));
}
```

#### 3.4 TB Device + Alarm Data → `EquipmentCardData` (src/types/operational.ts)

Equipment data comes from **ThingsBoard** (not GCDR). The mapper combines TB device data with alarm metrics from the Alarms Backend:

```typescript
// src/services/alarm/mappers/equipmentMapper.ts
import { classifyEquipment } from '../../../utils/equipmentCategory';
import { calculateDeviceStatusMasterRules } from '../../../utils/deviceInfo';

/**
 * Maps a ThingsBoard device (from myio:data-ready) + alarm metrics
 * into an EquipmentCardData for the General List panel.
 */
export function mapTBDeviceToEquipment(
  device: any,              // TB device from classified data
  customerName: string,     // From myio:customers-ready cache
  alarmMetrics?: {
    recentAlerts: number;
    hasReversal: boolean;
    avgResolutionMinutes: number;
  }
): EquipmentCardData {
  const category = classifyEquipment(device);
  const deviceStatus = calculateDeviceStatusMasterRules(device);

  // Map device category to EquipmentType
  const type: EquipmentType =
    category === 'escadas_rolantes' ? 'escada' :
    category === 'elevadores' ? 'elevador' :
    'escada'; // fallback

  // Map device status to EquipmentStatus
  let status: EquipmentStatus = 'offline';
  if (['power_on', 'online', 'normal', 'ok', 'running', 'active'].includes(deviceStatus)) {
    status = 'online';
  }
  // If device has active maintenance alarm, override to 'maintenance'
  // (determined from alarmMetrics)

  // MTTR approximation from alarm resolution time
  const mttr = alarmMetrics?.avgResolutionMinutes
    ? alarmMetrics.avgResolutionMinutes / 60
    : 0;

  // MTBF approximation: if we know recent alerts count and a time window
  // MTBF = periodHours / failureCount (rough estimation)
  const mtbf = alarmMetrics?.recentAlerts && alarmMetrics.recentAlerts > 0
    ? (720 / alarmMetrics.recentAlerts) // 720h = 30 days
    : 720; // No failures = very high MTBF

  const availability = (mtbf + mttr) > 0
    ? (mtbf / (mtbf + mttr)) * 100
    : 100;

  return {
    id: device.id?.id ?? device.entityId ?? '',
    name: device.name ?? device.label ?? '',
    type,
    status,
    availability: Math.round(availability * 10) / 10,
    mtbf: Math.round(mtbf * 10) / 10,
    mttr: Math.round(mttr * 10) / 10,
    hasReversal: alarmMetrics?.hasReversal ?? false,
    recentAlerts: alarmMetrics?.recentAlerts ?? 0,
    customerName,
    location: device.label ?? device.name ?? '',
    customerId: device.customerId?.id,
    entityId: device.id?.id,
  };
}
```

#### 3.5 Aggregated Data → `DashboardKPIs` (src/types/operational.ts)

The `DashboardKPIs` type is computed from TB equipment data + Alarms stats:

```typescript
export function computeDashboardKPIs(
  equipmentList: EquipmentCardData[],
  alarmStats: AlarmStats
): DashboardKPIs {
  const total = equipmentList.length;
  const onlineCount = equipmentList.filter(e => e.status === 'online').length;
  const offlineCount = equipmentList.filter(e => e.status === 'offline').length;
  const maintenanceCount = equipmentList.filter(e => e.status === 'maintenance').length;

  const avgMtbf = total > 0
    ? equipmentList.reduce((sum, e) => sum + e.mtbf, 0) / total
    : 0;
  const avgMttr = total > 0
    ? equipmentList.reduce((sum, e) => sum + e.mttr, 0) / total
    : 0;

  const fleetAvailability = (avgMtbf + avgMttr) > 0
    ? (avgMtbf / (avgMtbf + avgMttr)) * 100
    : 100;

  return {
    fleetAvailability,
    availabilityTrend: 0,  // Requires comparison with previous period
    fleetMTBF: avgMtbf,
    fleetMTTR: avgMttr,
    totalEquipment: total,
    onlineCount,
    offlineCount,
    maintenanceCount,
  };
}
```

#### 3.6 Top Offenders → `DowntimeEntry` (src/types/operational.ts)

```typescript
interface TopOffenderApiResponse {
  deviceId: string;
  deviceName?: string;
  alarmCount: number;
  totalDowntimeMinutes?: number;
}

export function mapTopOffendersToDowntimeEntries(
  offenders: TopOffenderApiResponse[],
  tbDeviceMap: Map<string, { name: string; customerName: string }>,  // From TB cache
  periodHours: number
): DowntimeEntry[] {
  return offenders.map(o => {
    const tbDevice = tbDeviceMap.get(o.deviceId);
    const downtimeHours = (o.totalDowntimeMinutes ?? 0) / 60;
    return {
      name: tbDevice?.name ?? o.deviceName ?? o.deviceId,
      location: tbDevice?.customerName ?? '',
      downtime: downtimeHours,
      percentage: periodHours > 0 ? (downtimeHours / periodHours) * 100 : 0,
    };
  });
}
```

### 4. Authentication Flow

#### 4.1 The Challenge

The ThingsBoard widget has a **TB-issued JWT token**. The Alarms Backend expects a **GCDR-issued JWT token** with `aud: "alarm-orchestrator"`. These are different tokens issued by different systems.

#### 4.2 Recommended Strategy: GCDR Credentials in TB Customer Attributes

Store GCDR login credentials as encrypted ThingsBoard `SERVER_SCOPE` customer attributes. The AlarmService performs a GCDR login on initialization:

```typescript
// During widget initialization
const gcdrEmail = await fetchCustomerAttribute('gcdr-service-email');
const gcdrPassword = await fetchCustomerAttribute('gcdr-service-password');
const gcdrApiUrl = await fetchCustomerAttribute('gcdr-api-url');

// Login to GCDR to get a JWT accepted by Alarms Backend
const loginResponse = await fetch(`${gcdrApiUrl}/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-Id': tenantId,
  },
  body: JSON.stringify({ email: gcdrEmail, password: gcdrPassword }),
});
const { accessToken, refreshToken } = await loginResponse.json();

// Now use accessToken for all Alarms Backend calls
const service = AlarmService.getInstance({
  alarmsApiUrl: 'https://alarms-api.a.myio-bas.com',
  token: accessToken,
  refreshToken,
});
```

**Required TB customer attributes** (`SERVER_SCOPE`):

| Attribute Key | Type | Description |
|---------------|------|-------------|
| `gcdr-service-email` | string | GCDR service account email |
| `gcdr-service-password` | string | GCDR service account password (encrypted) |
| `gcdr-api-url` | string | GCDR API URL (for login only) |
| `alarms-api-url` | string | Alarms Backend URL |

#### 4.3 Alternative Strategies

| Strategy | Pros | Cons |
|----------|------|------|
| **Shared JWT secret** (TB and GCDR use same secret) | Simplest; TB token works directly | Security risk; tight coupling |
| **Token exchange endpoint** in GCDR | Clean; no stored credentials | Requires GCDR API change |
| **Service API Key** in TB attributes | No login needed; read-only | Alarms Backend may not support API Keys |

#### 4.4 Token Refresh

The AlarmService must handle token expiration:

```typescript
// Auto-refresh on 401 response
private async requestWithRefresh<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    return await this.request(path, options);
  } catch (error) {
    if (error instanceof AlarmApiError && error.statusCode === 401 && this.refreshToken) {
      await this.refreshAccessToken();
      return await this.request(path, options);
    }
    throw error;
  }
}
```

### 5. API URL Configuration Strategy

API URL is resolved using a priority chain:

```
1. Widget Settings (highest priority)
   └─ self.ctx.widgetConfig.settings.alarmsApiUrl

2. ThingsBoard Customer Attributes (SERVER_SCOPE)
   └─ attribute: 'alarms-api-url'

3. Production Default (lowest priority)
   └─ 'https://alarms-api.a.myio-bas.com'
```

```typescript
// src/services/alarm/config/apiConfig.ts
export interface AlarmServiceConfig {
  alarmsApiUrl: string;
  token: string;
  refreshToken?: string;
  tenantId?: string;
  wsUrl?: string;
  cacheTtlMs?: number;      // Default: 30000 (30s)
  requestTimeoutMs?: number; // Default: 10000 (10s)
}

const PRODUCTION_DEFAULTS = {
  alarmsApiUrl: 'https://alarms-api.a.myio-bas.com',
  wsUrl: 'wss://alarms-api.a.myio-bas.com/ws',
  cacheTtlMs: 30_000,
  requestTimeoutMs: 10_000,
};

export async function resolveApiConfig(ctx: WidgetContext): Promise<AlarmServiceConfig> {
  const settings = ctx.widgetConfig?.settings ?? {};
  let alarmsApiUrl = settings.alarmsApiUrl;

  if (!alarmsApiUrl) {
    const attrs = await fetchCustomerAttributes(ctx, ['alarms-api-url']);
    alarmsApiUrl = attrs['alarms-api-url'];
  }

  return {
    alarmsApiUrl: alarmsApiUrl || PRODUCTION_DEFAULTS.alarmsApiUrl,
    token: '', // Will be set after GCDR login
    wsUrl: settings.wsUrl || PRODUCTION_DEFAULTS.wsUrl,
    cacheTtlMs: PRODUCTION_DEFAULTS.cacheTtlMs,
    requestTimeoutMs: PRODUCTION_DEFAULTS.requestTimeoutMs,
  };
}
```

### 6. HTTP Client Implementation

```typescript
// src/services/alarm/clients/AlarmApiClient.ts
export class AlarmApiClient {
  private token: string;

  constructor(
    private baseUrl: string,
    token: string,
    private timeoutMs: number = 10_000
  ) {
    this.token = token;
  }

  updateToken(newToken: string): void {
    this.token = newToken;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          ...options?.headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AlarmApiError(response.status, await response.text());
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // --- Alarms CRUD ---

  async getAlarms(params: {
    state?: string; severity?: string; limit?: number; cursor?: string;
  }): Promise<{
    data: AlarmApiResponse[];
    pagination: { hasMore: boolean; cursor?: string; total?: number };
  }> {
    const query = buildQueryString(params);
    return this.request(`/alarms?${query}`);
  }

  async getAlarmById(id: string): Promise<AlarmApiResponse> {
    const result = await this.request<{ data: AlarmApiResponse }>(`/alarms/${id}`);
    return result.data;
  }

  // --- Alarm Actions ---

  async acknowledgeAlarm(id: string, acknowledgedBy: string, note?: string): Promise<void> {
    await this.request(`/alarms/${id}/ack`, {
      method: 'POST',
      body: JSON.stringify({ acknowledgedBy, note }),
    });
  }

  async silenceAlarm(id: string, silencedBy: string, duration: string, reason?: string): Promise<void> {
    await this.request(`/alarms/${id}/silence`, {
      method: 'POST',
      body: JSON.stringify({ silencedBy, duration, reason }),
    });
  }

  async escalateAlarm(id: string, escalatedBy: string, reason?: string): Promise<void> {
    await this.request(`/alarms/${id}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ escalatedBy, reason }),
    });
  }

  async closeAlarm(id: string, closedBy: string, resolution?: string): Promise<void> {
    await this.request(`/alarms/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ closedBy, resolution }),
    });
  }

  // --- Statistics ---

  async getStats(tenantId: string, period?: string): Promise<AlarmStatsApiResponse> {
    const query = buildQueryString({ tenantId, period });
    return this.request(`/api/v1/alarms/stats?${query}`);
  }

  async getStatsByDevice(tenantId: string, period?: string): Promise<DeviceStatsApiResponse[]> {
    const query = buildQueryString({ tenantId, period });
    return this.request(`/api/v1/alarms/stats/by-device?${query}`);
  }

  async getTrend(tenantId: string, period: string, groupBy: string): Promise<TrendApiResponse[]> {
    const query = buildQueryString({ tenantId, period, groupBy });
    return this.request(`/api/v1/alarms/stats/trend?${query}`);
  }

  async getTopOffenders(tenantId: string, limit: number = 5): Promise<TopOffenderApiResponse[]> {
    const query = buildQueryString({ tenantId, limit: String(limit) });
    return this.request(`/api/v1/alarms/stats/top-offenders?${query}`);
  }
}
```

### 7. WebSocket Real-Time Integration

```typescript
// src/services/alarm/websocket/AlarmWebSocket.ts
export class AlarmWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelayMs = 1000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(
    private wsUrl: string,
    private tenantId?: string
  ) {}

  connect(): void {
    const url = this.tenantId
      ? `${this.wsUrl}?tenantId=${this.tenantId}`
      : this.wsUrl;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected', {});
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit(message.type, message.data ?? message);
      } catch {
        // Ignore non-JSON messages
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  on(eventType: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
    return () => { this.listeners.get(eventType)?.delete(callback); };
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
  }

  private emit(eventType: string, data: unknown): void {
    this.listeners.get(eventType)?.forEach(cb => cb(data));
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
```

**WebSocket event types from Alarms Backend**:

| Event | Payload | Usage |
|-------|---------|-------|
| `connected` | `{}` | Connection established |
| `alarm.created` | `{ alarm: AlarmApiResponse }` | Prepend to alarm list, update stats |
| `alarm.updated` | `{ alarm: AlarmApiResponse }` | Update alarm in list (state change) |
| `ingest.received` | `{ eventId, deviceId }` | Optional: show ingestion indicator |
| `pong` | `{}` | Heartbeat response |

### 8. In-Memory Cache

```typescript
// src/services/alarm/cache/ServiceCache.ts
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class ServiceCache {
  private store = new Map<string, CacheEntry<unknown>>();

  constructor(private defaultTtlMs: number = 30_000) {}

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.store.delete(key);
      }
    }
  }
}
```

**Cache keys and TTLs**:

| Data | Cache Key Pattern | TTL | Rationale |
|------|-------------------|-----|-----------|
| Alarm list | `alarms:${filterHash}` | 15s | Frequently changing |
| Alarm stats | `stats:${tenantId}:${period}` | 30s | Moderate change rate |
| Alarm trend | `trend:${tenantId}:${period}:${groupBy}` | 60s | Historical, slow to change |
| Top offenders | `offenders:${tenantId}:${limit}` | 60s | Historical |

**Note**: Equipment list and customer data are cached by ThingsBoard itself (via module-level caching pattern from RFC-0126). No duplicate caching needed.

### 9. Error Handling

#### 9.1 Error Type

```typescript
export class AlarmApiError extends Error {
  constructor(
    public statusCode: number,
    public responseBody: string,
    message?: string
  ) {
    super(message ?? `Alarms API error ${statusCode}: ${responseBody}`);
    this.name = 'AlarmApiError';
  }
}
```

#### 9.2 Error Handling Strategy

| Scenario | Behavior |
|----------|----------|
| **Network timeout** | Return cached data if available; otherwise return empty state with `isError: true` flag |
| **401 Unauthorized** | Attempt token refresh once via GCDR; if fails, dispatch `myio:auth-error` event |
| **403 Forbidden** | Log warning; return empty state (user lacks permissions) |
| **404 Not Found** | Return empty state |
| **429 Rate Limited** | Exponential backoff (1s, 2s, 4s); max 3 retries |
| **500 Server Error** | Return cached data if available; retry once after 2s |
| **WebSocket disconnect** | Auto-reconnect with exponential backoff (max 5 attempts) |
| **CORS error** | Log error; show "service unavailable" in UI |

#### 9.3 Cache Fallback Pattern

```typescript
async function fetchWithCacheFallback<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  cache: ServiceCache,
  defaultValue: T,
  ttlMs?: number
): Promise<{ data: T; isStale: boolean; isError: boolean }> {
  try {
    const data = await fetcher();
    cache.set(cacheKey, data, ttlMs);
    return { data, isStale: false, isError: false };
  } catch (error) {
    const cached = cache.get<T>(cacheKey);
    if (cached) {
      console.warn(`[AlarmService] Using cached data for ${cacheKey}`, error);
      return { data: cached, isStale: true, isError: false };
    }
    console.error(`[AlarmService] No cache available for ${cacheKey}`, error);
    return { data: defaultValue, isStale: false, isError: true };
  }
}
```

### 10. AlarmService Facade

```typescript
// src/services/alarm/AlarmService.ts
export class AlarmService {
  private static instance: AlarmService | null = null;
  private alarmClient: AlarmApiClient;
  private wsClient: AlarmWebSocket | null = null;
  private cache: ServiceCache;

  private constructor(config: AlarmServiceConfig) {
    this.alarmClient = new AlarmApiClient(
      config.alarmsApiUrl, config.token, config.requestTimeoutMs
    );
    this.cache = new ServiceCache(config.cacheTtlMs);

    if (config.wsUrl) {
      this.wsClient = new AlarmWebSocket(config.wsUrl, config.tenantId);
    }
  }

  static getInstance(config: AlarmServiceConfig): AlarmService {
    if (!AlarmService.instance) {
      AlarmService.instance = new AlarmService(config);
    }
    return AlarmService.instance;
  }

  static resetInstance(): void {
    AlarmService.instance?.destroy();
    AlarmService.instance = null;
  }

  // ----- Phase 4: Alarms & Notifications -----

  async getAlarms(filters: AlarmFilters): Promise<Alarm[]> {
    const { data } = await fetchWithCacheFallback(
      `alarms:${JSON.stringify(filters)}`,
      async () => {
        const response = await this.alarmClient.getAlarms(filters);
        return response.data.map(a => mapApiAlarmToAlarm(a));
      },
      this.cache,
      [] as Alarm[],
      15_000
    );
    return data;
  }

  async getAlarmStats(tenantId: string, period?: string): Promise<AlarmStats> {
    const { data } = await fetchWithCacheFallback(
      `stats:${tenantId}:${period}`,
      async () => {
        const response = await this.alarmClient.getStats(tenantId, period);
        return mapApiStatsToAlarmStats(response);
      },
      this.cache,
      DEFAULT_ALARM_STATS,
      30_000
    );
    return data;
  }

  async getAlarmTrend(
    tenantId: string, period: string, groupBy: string
  ): Promise<AlarmTrendDataPoint[]> {
    const { data } = await fetchWithCacheFallback(
      `trend:${tenantId}:${period}:${groupBy}`,
      async () => {
        const response = await this.alarmClient.getTrend(tenantId, period, groupBy);
        return mapApiTrendToTrendDataPoints(response);
      },
      this.cache,
      [] as AlarmTrendDataPoint[],
      60_000
    );
    return data;
  }

  async acknowledgeAlarm(alarmId: string, acknowledgedBy: string, note?: string): Promise<void> {
    await this.alarmClient.acknowledgeAlarm(alarmId, acknowledgedBy, note);
    this.cache.invalidate('alarms:');
    this.cache.invalidate('stats:');
  }

  async silenceAlarm(alarmId: string, silencedBy: string, duration: string, reason?: string): Promise<void> {
    await this.alarmClient.silenceAlarm(alarmId, silencedBy, duration, reason);
    this.cache.invalidate('alarms:');
    this.cache.invalidate('stats:');
  }

  async escalateAlarm(alarmId: string, escalatedBy: string, reason?: string): Promise<void> {
    await this.alarmClient.escalateAlarm(alarmId, escalatedBy, reason);
    this.cache.invalidate('alarms:');
    this.cache.invalidate('stats:');
  }

  async closeAlarm(alarmId: string, closedBy: string, resolution?: string): Promise<void> {
    await this.alarmClient.closeAlarm(alarmId, closedBy, resolution);
    this.cache.invalidate('alarms:');
    this.cache.invalidate('stats:');
  }

  // ----- Phase 3: Alert counts for equipment -----

  async getDeviceAlarmCounts(tenantId: string, period?: string): Promise<Map<string, number>> {
    const stats = await this.alarmClient.getStatsByDevice(tenantId, period);
    const map = new Map<string, number>();
    for (const entry of stats) {
      map.set(entry.deviceId, entry.alarmCount ?? 0);
    }
    return map;
  }

  // ----- Phase 5: Management Dashboard -----

  async getTopDowntime(
    tenantId: string,
    tbDeviceMap: Map<string, { name: string; customerName: string }>,
    limit: number = 5
  ): Promise<DowntimeEntry[]> {
    const { data } = await fetchWithCacheFallback(
      `offenders:${tenantId}:${limit}`,
      async () => {
        const offenders = await this.alarmClient.getTopOffenders(tenantId, limit);
        return mapTopOffendersToDowntimeEntries(offenders, tbDeviceMap, 720);
      },
      this.cache,
      [] as DowntimeEntry[],
      60_000
    );
    return data;
  }

  // ----- WebSocket -----

  connectRealTime(): void {
    this.wsClient?.connect();
  }

  onAlarmCreated(callback: (alarm: Alarm) => void): () => void {
    return this.wsClient?.on('alarm.created', (data: unknown) => {
      const apiAlarm = (data as { alarm: AlarmApiResponse }).alarm;
      callback(mapApiAlarmToAlarm(apiAlarm));
    }) ?? (() => {});
  }

  onAlarmUpdated(callback: (alarm: Alarm) => void): () => void {
    return this.wsClient?.on('alarm.updated', (data: unknown) => {
      const apiAlarm = (data as { alarm: AlarmApiResponse }).alarm;
      callback(mapApiAlarmToAlarm(apiAlarm));
    }) ?? (() => {});
  }

  disconnectRealTime(): void {
    this.wsClient?.disconnect();
  }

  // ----- Lifecycle -----

  destroy(): void {
    this.wsClient?.disconnect();
    this.cache.invalidate();
  }
}
```

---

## Implementation Phases

### Phase A: AlarmService Core Infrastructure

**Goal**: Create the module skeleton, HTTP client, cache, and config resolution.

**Files**:
- `src/services/alarm/index.ts`
- `src/services/alarm/AlarmService.ts` (skeleton)
- `src/services/alarm/clients/AlarmApiClient.ts`
- `src/services/alarm/cache/ServiceCache.ts`
- `src/services/alarm/config/apiConfig.ts`

**Acceptance criteria**:
- AlarmApiClient can make authenticated requests to Alarms Backend
- URL resolution from widget settings, customer attributes, and defaults works
- In-memory cache with TTL works
- GCDR login flow for obtaining JWT token works

### Phase B: Alarms & Notifications Panel (Phase 4 Real Data)

**Goal**: Replace mock `fetchAlarmsData()` with real API calls.

**Files**:
- `src/services/alarm/mappers/alarmMapper.ts`
- `src/services/alarm/mappers/statsMapper.ts`
- Update Phase 4 controller to use `AlarmService`

**Acceptance criteria**:
- Alarm list fetches from `GET /alarms` with filter support
- Alarm stats fetches from `GET /api/v1/alarms/stats`
- Alarm trend fetches from `GET /api/v1/alarms/stats/trend`
- Alarm actions (ack, snooze, escalate, close) work via POST endpoints
- Data maps correctly to `Alarm`, `AlarmStats`, `AlarmTrendDataPoint` types
- Customer names enriched from TB `myio:customers-ready` cache
- Cache fallback on API errors returns empty states (no broken UI)

### Phase C: General List Panel (Phase 3 Real Data)

**Goal**: Replace mock `fetchOperationalEquipment()` — device data from TB, alarm counts from Alarms Backend.

**Files**:
- `src/services/alarm/mappers/equipmentMapper.ts`
- Update Phase 3 controller to use TB events + `AlarmService`

**Acceptance criteria**:
- Equipment list comes from ThingsBoard `myio:data-ready` event (existing pattern)
- Devices filtered using `classifyEquipment()` for escalators and elevators
- Alert counts per device fetched from Alarms `GET /api/v1/alarms/stats/by-device`
- MTBF/MTTR approximated from alarm data (see [Unresolved Questions](#4-mtbfmttr-data-source))
- Data maps correctly to `EquipmentCardData` type

### Phase D: Management Dashboard Panel (Phase 5 Real Data)

**Goal**: Replace mock `fetchDashboardData()` with aggregated real data.

**Files**:
- Update Phase 5 controller to use TB events + `AlarmService`

**Acceptance criteria**:
- Fleet KPIs computed from TB equipment data + alarm stats
- Trend charts populated from `GET /api/v1/alarms/stats/trend`
- Top 5 Downtime list from `GET /api/v1/alarms/stats/top-offenders`, enriched with TB device names
- Period selector (`today`, `week`, `month`, `quarter`) maps to API parameters
- Data maps correctly to `DashboardKPIs`, `TrendDataPoint`, `DowntimeEntry` types

### Phase E: WebSocket Real-Time Updates

**Goal**: Add real-time alarm updates via WebSocket.

**Files**:
- `src/services/alarm/websocket/AlarmWebSocket.ts`
- Update Phase 4 controller to subscribe to WebSocket events

**Acceptance criteria**:
- WebSocket connects to Alarms Backend with tenant filter
- `alarm.created` events prepend new alarms to the list
- `alarm.updated` events update existing alarm state in the list
- Stats are refreshed when WebSocket events are received
- Auto-reconnect with exponential backoff on disconnect
- Clean disconnect on widget destroy

### Phase F: Error Handling & Resilience Hardening

**Goal**: Production-ready error handling, retry logic, and monitoring.

**Deliverables**:
- Exponential backoff for rate limiting (429)
- Token refresh on 401 via GCDR re-login
- Graceful degradation with cached/empty data
- Console logging for debugging
- Event dispatch (`myio:alarm-service-error`) for widget-level error display

---

## Drawbacks

1. **External API dependency**: The ThingsBoard dashboard now depends on the Alarms Backend being available. If it's down, alarm-related panels will show empty states or stale cached data. Equipment data (Phase 3) is unaffected since it comes from TB.

2. **Authentication complexity**: The Alarms Backend expects a GCDR-issued JWT, not a ThingsBoard JWT. This requires a login step or credential storage in TB customer attributes.

3. **CORS configuration**: The Alarms Backend must allow requests from the ThingsBoard dashboard origin. Requires CORS configuration on the Alarms Backend.

4. **Bundle size**: Adding an HTTP client, WebSocket handling, mappers, and cache increases the library bundle size. The `AlarmService` module should be tree-shakeable.

5. **MTBF/MTTR approximation**: True MTBF/MTTR requires operating time data that neither TB nor the Alarms Backend tracks directly. We'll use approximations from alarm counts and resolution times.

---

## Alternatives

### Alternative 1: ThingsBoard Alarms API Only

Use ThingsBoard's built-in alarm system instead of the external Alarms Backend.

**Pros**: No external dependency; JWT token already available; native integration.
**Cons**: TB alarms lack the sophisticated guard system (dedup, cooldown, hysteresis), dispatch channels (Telegram, WorkOrder), and the rich statistics endpoints (`/stats`, `/stats/trend`, `/stats/top-offenders`). Would require building aggregation logic client-side.

**Decision**: Rejected. The Alarms Backend provides significantly more value.

### Alternative 2: Server-Side BFF

Build a Backend-for-Frontend that aggregates Alarms + TB data, returning pre-computed data structures.

**Pros**: Single API call per panel; can compute MTBF/MTTR server-side; no CORS issues.
**Cons**: Additional service to deploy/maintain; delays time-to-market.

**Decision**: Deferred. Can be introduced later if client-side aggregation proves insufficient.

### Alternative 3: Push Alarm Stats to TB Attributes

A background job writes pre-computed alarm stats as ThingsBoard customer attributes, consumed natively.

**Pros**: Native TB access; no CORS issues; works offline.
**Cons**: Stale data; complex background job; limited by TB attribute size; no real-time.

**Decision**: Rejected for primary data source. Could be used as a fallback.

---

## Unresolved Questions

### 1. Authentication Bridge (Critical)

**Question**: How does the ThingsBoard widget obtain a GCDR-issued JWT?

**Recommended**: Store GCDR service credentials in TB customer `SERVER_SCOPE` attributes. AlarmService calls `POST /auth/login` on GCDR during initialization.

**Alternatives**:
- **A**: Shared JWT secret between TB and GCDR/Alarms (security trade-off)
- **B**: Token exchange endpoint in GCDR that accepts TB tokens
- **C**: Service API Key support in Alarms Backend (requires backend change)

**Impact**: Blocks all phases. Must be resolved before Phase A.

### 2. CORS Configuration

**Question**: Is the Alarms Backend configured to accept requests from the ThingsBoard dashboard origin?

**Current state**: Unknown. Need to verify `CORS_ORIGIN` on the Alarms Backend includes the TB dashboard URL(s).

**Impact**: Blocks all phases if CORS is not configured. Alternative: use a server-side proxy.

### 3. Rate Limiting

**Question**: What are the actual rate limits on the Alarms Backend for frontend clients?

**Impact**: Need to ensure the caching layer keeps request volume well below limits, especially for Head Office dashboards managing multiple shoppings.

### 4. MTBF/MTTR Data Source

**Question**: Where does operating time (uptime hours) per device come from?

The MTBF formula requires `operatingHours` and `failureCount`. The Alarms Backend tracks alarm counts and `avgResolutionTimeMinutes`, but not total operating time.

**Options**:
- Compute from TB device connectivity data (online duration from telemetry)
- Use `avgResolutionTimeMinutes` from Alarms stats as MTTR proxy; approximate MTBF from alarm frequency
- Introduce a new endpoint in Alarms Backend for MTBF/MTTR pre-computation

### 5. Alarms Backend `by-device` Endpoint

**Question**: Does `GET /api/v1/alarms/stats/by-device` return per-device alert counts?

Listed in ONBOARDING but response shape needs verification. Critical for Phase 3 (showing `recentAlerts` per equipment card).

### 6. Widget Settings Schema

**Question**: What is the preferred widget settings schema for configuring the Alarms API URL and credentials?

Need to define the ThingsBoard widget settings JSON schema.

---

## Appendix A: Period Mapping

```typescript
function mapPeriodToApiPeriod(period: DashboardPeriod): string {
  switch (period) {
    case 'today': return 'day';
    case 'week': return 'week';
    case 'month': return 'month';
    case 'quarter': return 'month'; // API may not support quarter directly
  }
}

function mapPeriodToGroupBy(period: DashboardPeriod): string {
  switch (period) {
    case 'today': return 'hour';
    case 'week': return 'day';
    case 'month': return 'day';
    case 'quarter': return 'week';
  }
}
```

## Appendix B: Alarm States Reference

```
OPEN ──────────► ACK ──────────► CLOSED
  │                │
  │                ├──► SNOOZED ──► ACK / ESCALATED / CLOSED
  │                │
  │                └──► ESCALATED ──► ACK / CLOSED
  │
  ├──► SNOOZED ──► ACK / ESCALATED / CLOSED
  │
  └──► ESCALATED ──► ACK / CLOSED

CLOSED = terminal state (irreversible)
```

## Appendix C: Severity and State Mappings

These are already defined in `src/types/alarm.ts` and match the Alarms Backend exactly:

| Severity | API Value | Display Label | Color |
|----------|-----------|---------------|-------|
| Critical | `CRITICAL` | Critico | `#ef4444` |
| High | `HIGH` | Alto | `#f97316` |
| Medium | `MEDIUM` | Medio | `#eab308` |
| Low | `LOW` | Baixo | `#3b82f6` |
| Info | `INFO` | Informativo | `#6b7280` |

| State | API Value | Display Label | Color |
|-------|-----------|---------------|-------|
| Open | `OPEN` | Aberto | `#ef4444` |
| Acknowledged | `ACK` | Reconhecido | `#f59e0b` |
| Snoozed | `SNOOZED` | Adiado | `#8b5cf6` |
| Escalated | `ESCALATED` | Escalado | `#dc2626` |
| Closed | `CLOSED` | Fechado | `#6b7280` |

## Appendix D: Alarms Backend URLs Quick Reference

| Environment | REST API | WebSocket |
|-------------|----------|-----------|
| Local | `http://localhost:3020` | `ws://localhost:3020/ws` |
| Staging | `https://alarms-staging.myio.com.br` | `wss://alarms-staging.myio.com.br/ws` |
| Production | `https://alarms-api.a.myio-bas.com` | `wss://alarms-api.a.myio-bas.com/ws` |
