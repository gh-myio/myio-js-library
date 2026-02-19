# RFC-0175: Requirements for Alarms Backend Team

> **From**: myio-js-library (Frontend / ThingsBoard Widgets)
> **To**: Alarms Backend Team (`alarms-backend.git`)
> **Date**: 2026-02-19
> **Context**: RFC-0175 replaces mock data in the Operational Indicators panels (RFC-0152) with real Alarms Backend API calls.

---

## TL;DR

The myio-js-library (ThingsBoard dashboard widgets) will start consuming the Alarms Backend REST API and WebSocket to display real alarm data in 3 panels: General List, Alarms & Notifications, and Management Dashboard.

**We need from you**:
1. CORS enabled for ThingsBoard dashboard origins
2. Confirmation of the `GET /api/v1/alarms/stats/by-device` response shape
3. Validation of the expected response contracts listed below
4. (Optional) A new field `avgResolutionTimeMinutes` in per-device stats

**No new endpoints are required** — we plan to use only existing endpoints.

---

## 1. Endpoints We Will Consume

### 1.1 Alarm List & Actions

| Endpoint | Method | What We Use It For |
|----------|--------|-------------------|
| `GET /alarms` | GET | Phase 4: Alarm list with filters (severity, state, pagination) |
| `GET /alarms/:id` | GET | Phase 4: Alarm detail view |
| `POST /alarms/:id/ack` | POST | Phase 4: Acknowledge alarm |
| `POST /alarms/:id/silence` | POST | Phase 4: Snooze alarm |
| `POST /alarms/:id/escalate` | POST | Phase 4: Escalate alarm |
| `POST /alarms/:id/close` | POST | Phase 4: Close alarm |

### 1.2 Statistics

| Endpoint | Method | What We Use It For |
|----------|--------|-------------------|
| `GET /api/v1/alarms/stats` | GET | Phase 4 & 5: KPI cards (total, bySeverity, byState, openCritical, last24Hours) |
| `GET /api/v1/alarms/stats/trend` | GET | Phase 4 & 5: Trend line charts |
| `GET /api/v1/alarms/stats/top-offenders` | GET | Phase 5: Top 5 Downtime ranking |
| `GET /api/v1/alarms/stats/by-device` | GET | Phase 3: Alert count per equipment card |

### 1.3 WebSocket

| Connection | What We Use It For |
|------------|-------------------|
| `wss://alarms-api.a.myio-bas.com/ws?tenantId={id}` | Real-time: prepend new alarms, update alarm state changes |

**Events we listen to**: `alarm.created`, `alarm.updated`

---

## 2. Action Required: CORS Configuration

The myio-js-library runs inside ThingsBoard dashboards served from customer-specific domains. The Alarms Backend must accept `Origin` headers from these domains.

**Required origins** (at minimum):

```
https://*.thingsboard.cloud
https://*.myio-bas.com
https://*.myio.com.br
http://localhost:*          (development)
```

**Required CORS headers**:

```http
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, x-request-id
Access-Control-Allow-Credentials: true
```

**Question for you**: What is the current `CORS_ORIGIN` configuration? Is it a whitelist or wildcard? Can you add the ThingsBoard origins listed above?

---

## 3. Action Required: Confirm `by-device` Endpoint Response

We found `GET /api/v1/alarms/stats/by-device` in the ONBOARDING.md but its response shape is not fully documented.

**What we expect to receive**:

```json
[
  {
    "deviceId": "temperature-sensor-001",
    "deviceName": "Sensor Câmara Fria",
    "alarmCount": 12,
    "bySeverity": {
      "CRITICAL": 3,
      "HIGH": 5,
      "MEDIUM": 4,
      "LOW": 0,
      "INFO": 0
    },
    "openCount": 2,
    "avgResolutionTimeMinutes": 45
  }
]
```

**Fields we need** (minimum):

| Field | Type | Required? | Usage |
|-------|------|-----------|-------|
| `deviceId` | string | **Yes** | Match with ThingsBoard device ID |
| `alarmCount` | number | **Yes** | Show "recent alerts" count on equipment card |
| `openCount` | number | Nice to have | Show active alarm badge |
| `avgResolutionTimeMinutes` | number | Nice to have | Approximate MTTR per device |

**Question for you**: Does this endpoint exist? If yes, what is the actual response shape? If not, is it planned?

---

## 4. Response Contracts We Depend On

Below are the exact response shapes we map from. If any of these change, our mappers will break. Please treat these as contracts.

### 4.1 `GET /alarms` — Alarm Object

```typescript
interface AlarmApiResponse {
  id: string;               // "alrm_7Ks9xMpQr2nL4vWz"
  title: string;
  alarmType: string;        // "TEMPERATURE_HIGH"
  severity: string;         // "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  state: string;            // "OPEN" | "ACK" | "SNOOZED" | "ESCALATED" | "CLOSED"
  tenantId: string;
  customerId?: string;
  centralId?: string;
  deviceId: string;         // ← we use this to match TB devices
  deviceType: string;
  description?: string;
  fingerprint: string;
  metadata?: Record<string, unknown>;
  raisedAt: string;         // ISO 8601
  updatedAt: string;        // ISO 8601
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

**Pagination wrapper**:
```json
{
  "data": [ AlarmApiResponse, ... ],
  "pagination": { "hasMore": true, "cursor": "...", "total": 150 }
}
```

### 4.2 `GET /api/v1/alarms/stats` — Stats Object

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

### 4.3 `GET /api/v1/alarms/stats/trend` — Trend Array

```json
[
  {
    "period": "2026-02-10",
    "count": 12,
    "bySeverity": { "CRITICAL": 2, "HIGH": 3, "MEDIUM": 4, "LOW": 2, "INFO": 1 }
  },
  {
    "period": "2026-02-11",
    "count": 8
  }
]
```

**Question**: Is `bySeverity` included in each trend data point? Or is it only in the aggregate stats?

### 4.4 `GET /api/v1/alarms/stats/top-offenders` — Top Offenders Array

```json
[
  {
    "deviceId": "device-uuid-1",
    "deviceName": "Sensor Câmara Fria",
    "alarmCount": 25,
    "totalDowntimeMinutes": 4320
  },
  {
    "deviceId": "device-uuid-2",
    "deviceName": "Escada Rolante ESC-01",
    "alarmCount": 18,
    "totalDowntimeMinutes": 2880
  }
]
```

**Fields we need**:

| Field | Type | Required? | Usage |
|-------|------|-----------|-------|
| `deviceId` | string | **Yes** | Match with TB device for name/location |
| `deviceName` | string | Nice to have | Fallback display name |
| `alarmCount` | number | **Yes** | Ranking metric |
| `totalDowntimeMinutes` | number | Nice to have | Show downtime hours in dashboard |

**Question**: Does `totalDowntimeMinutes` exist in the response? If not, we'll use `alarmCount` as the ranking metric and omit the downtime column.

### 4.5 WebSocket `alarm.created` / `alarm.updated` Events

```json
{
  "type": "alarm.created",
  "data": {
    "alarm": { /* same AlarmApiResponse shape as GET /alarms */ }
  }
}
```

**Question**: Is the `alarm` object inside `data` the same shape as the REST `GET /alarms` response? Or is it a subset?

---

## 5. Authentication

We will authenticate using a GCDR-issued JWT stored in ThingsBoard customer attributes. The flow:

```
1. Widget loads → reads GCDR credentials from TB SERVER_SCOPE attributes
2. POST /auth/login to GCDR → receives JWT with aud: ["gcdr-api", "alarm-orchestrator"]
3. Uses this JWT for all Alarms Backend calls (Authorization: Bearer <token>)
4. On 401 → re-login to GCDR and retry
```

**No action needed from you** — this uses the existing JWT validation already in the Alarms Backend.

**One question**: Is there a way to validate a token without a full request? (e.g., a lightweight `GET /auth/validate` or `GET /health/auth`?) This would let us fail fast on invalid tokens instead of discovering it on the first alarm request.

---

## 6. Query Parameters We Will Send

### `GET /alarms`

| Parameter | Example Values | Notes |
|-----------|---------------|-------|
| `state` | `OPEN`, `ACK`, `ESCALATED` | Single value per request, or comma-separated? |
| `severity` | `CRITICAL`, `HIGH` | Single value per request, or comma-separated? |
| `limit` | `10`, `20`, `50` | Default: 20 |
| `cursor` | `eyJpZCI6Ijk5OSJ9` | From previous response pagination |

**Question**: Can we filter by **multiple** states or severities in one request? e.g., `?state=OPEN,ACK&severity=CRITICAL,HIGH`? Or do we need separate requests?

### `GET /api/v1/alarms/stats`

| Parameter | Example Values |
|-----------|---------------|
| `tenantId` | `11111111-1111-1111-1111-111111111111` |
| `period` | `day`, `week`, `month` |

### `GET /api/v1/alarms/stats/trend`

| Parameter | Example Values |
|-----------|---------------|
| `tenantId` | `11111111-1111-1111-1111-111111111111` |
| `period` | `day`, `week`, `month` |
| `groupBy` | `hour`, `day`, `week` |

**Question**: We have a `quarter` period in the UI. What should we send to the API? `period=month` × 3? Or is there a `quarter` option?

### `GET /api/v1/alarms/stats/top-offenders`

| Parameter | Example Values |
|-----------|---------------|
| `tenantId` | `11111111-1111-1111-1111-111111111111` |
| `limit` | `5`, `10` |

---

## 7. Expected Request Volume

Rough estimate of API calls per active user session:

| Scenario | Requests | Frequency |
|----------|----------|-----------|
| Open Alarms panel (Phase 4 list) | `GET /alarms` | Once on open, then cached 15s |
| Open Alarms dashboard tab | `GET /stats` + `GET /stats/trend` | Once on open, then cached 30-60s |
| Open Management Dashboard (Phase 5) | `GET /stats` + `GET /stats/trend` + `GET /stats/top-offenders` | Once on open, cached 30-60s |
| Open General List (Phase 3) | `GET /stats/by-device` | Once on open, cached 120s |
| Alarm action (ack/close/etc.) | `POST /alarms/:id/ack` | On user click |
| WebSocket | 1 persistent connection | Per session |

**Total estimated**: ~5-10 REST calls per panel view, heavily cached. Head Office users (multiple shoppings) may have slightly higher volume.

**We cache aggressively** (15-60s TTL) to minimize backend load.

---

## 8. Summary of Questions

| # | Question | Priority | Blocking? |
|---|----------|----------|-----------|
| 1 | Can you add ThingsBoard origins to CORS? | **High** | **Yes** |
| 2 | What is the `GET /stats/by-device` response shape? | **High** | Yes (Phase 3) |
| 3 | Does `totalDowntimeMinutes` exist in top-offenders? | Medium | No (graceful fallback) |
| 4 | Is `bySeverity` included in trend data points? | Medium | No (graceful fallback) |
| 5 | Can `GET /alarms` filter by multiple states/severities? | Medium | No (we can make multiple requests) |
| 6 | Is the WebSocket alarm payload the same shape as REST? | Medium | No (we'll handle differences) |
| 7 | Is there a `GET /auth/validate` or similar? | Low | No |
| 8 | Is `quarter` supported as a period value? | Low | No (we'll use `month`) |

---

## 9. Timeline

| Phase | Description | Dependency on Backend |
|-------|-------------|----------------------|
| **Phase A** (infra) | HTTP client, cache, auth flow | CORS must be enabled |
| **Phase B** (alarms panel) | Alarm list, stats, actions | Endpoints already exist |
| **Phase C** (general list) | Per-device alarm counts | `by-device` endpoint confirmed |
| **Phase D** (dashboard) | KPIs, trends, top offenders | Endpoints already exist |
| **Phase E** (WebSocket) | Real-time updates | WebSocket already exists |
| **Phase F** (hardening) | Error handling, retry | No dependency |

**Earliest we can start Phase A**: As soon as CORS is configured.

---

## 10. Contact

- **Frontend team**: myio-js-library (`myio-js-library-PROD.git`)
- **RFC document**: `src/docs/rfcs/RFC-0175-AlarmsRealUsage.draft.md`
- **Tech Lead**: Rodrigo Lago - rodrigo@myio.com.br
