# Temperature Report - Architecture

## Overview

The Temperature Report is a Node-RED flow that exposes an API endpoint for retrieving historical temperature readings from hospital devices. It processes device data, queries a PostgreSQL database, and returns enriched temperature records with device names and adjusted values.

## Flow Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  HTTP POST      │────▶│  Get Slave IDs   │────▶│  SQL Query      │────▶│  Process Results  │────▶│  HTTP Response   │
│  /rpc/temp_     │     │  (Function)      │     │  (PostgreSQL)   │     │  (Controller)     │     │  200 OK          │
│  report         │     │                  │     │                 │     │                   │     │                  │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └───────────────────┘     └──────────────────┘
```

## Components

### 1. API Endpoint

| Property | Value |
|----------|-------|
| Method   | `POST` |
| Path     | `/rpc/temperature_report` |
| Content-Type | `application/json` |

**Request Payload:**

```json
{
  "devices": ["Room A (Souza Aguiar CO2)", "Room B (Souza Aguiar CO2)"],
  "dateStart": "2026-02-01T00:00:00.000Z",
  "dateEnd": "2026-02-12T00:00:00.000Z"
}
```

### 2. Get Slave IDs (Function Node)

**File:** `Get-slave-ids.js`

This function maps device names from the request to their corresponding slave IDs stored in the flow context.

**Logic:**
1. Reads `slave_data` from flow context (pre-loaded device registry)
2. Iterates through requested device names
3. Transforms device names (e.g., `Room A (Souza Aguiar CO2)` → `Temp. Room A`)
4. Finds matching slave device by name
5. Collects slave IDs for the SQL query

**Output:**
```json
{
  "devices": [...],
  "dateStart": "...",
  "dateEnd": "...",
  "slaveIds": [44, 45, 46]
}
```

### 3. SQL Query

**File:** `query.md`

Queries the `temperature_history` table for readings at specific time intervals.

```sql
SELECT DISTINCT ON (date_trunc('day', timestamp), slave_id, hour_group)
    date_trunc('day', timestamp) AS reading_date,
    slave_id,
    hour_group,
    timestamp,
    value
FROM (
    SELECT
        timestamp,
        slave_id,
        value,
        CASE
            WHEN date_part('hour', timestamp) >= 11 AND date_part('hour', timestamp) < 12 THEN '11:00'
            WHEN date_part('hour', timestamp) >= 17 AND date_part('hour', timestamp) < 18 THEN '17:00'
            WHEN date_part('hour', timestamp) >= 23 THEN '23:00'
        END AS hour_group
    FROM temperature_history
    WHERE timestamp >= :dateStart
      AND timestamp < :dateEnd
      AND slave_id IN (:slaveIds)
) subquery
WHERE hour_group IS NOT NULL
ORDER BY date_trunc('day', timestamp), slave_id, hour_group, timestamp;
```

**Time Intervals:**
| Hour Group | Window |
|------------|--------|
| `11:00`    | 11:00 - 11:59 |
| `17:00`    | 17:00 - 17:59 |
| `23:00`    | 23:00 - 23:59 |

### 4. Result Processing (Controller)

**File:** `nodered.controller.js`

Processes raw query results and enriches them with device names and adjusted values.

**Features:**

1. **Device Name Resolution**
   - Looks up device by `slave_id` in the flow's `slave_data`
   - Extracts clean device name from format: `Temp. {DeviceName} {adjustment}`

2. **Value Adjustment**
   - Supports calibration adjustments encoded in device names
   - Format: `Temp. DeviceName +2.5` or `Temp. DeviceName -1` or `Temp. DeviceName x0.95`

   | Operator | Action |
   |----------|--------|
   | `+`      | Add to value |
   | `-`      | Subtract from value |
   | `x`      | Multiply value |

**Example Device Name Parsing:**
```
Input:  "Temp. Surgery Room 4 -7"
Output: deviceName = "Surgery Room 4"
        adjustment = -7 (subtract 7 from raw value)
```

### 5. API Response

**Status:** `200 OK`

**Response Schema:**
```typescript
interface TemperatureReading {
  reading_date: string;      // ISO date (day precision)
  slave_id: number;          // Device slave ID
  time_interval: string;     // ISO timestamp of reading
  avg_value: string;         // Raw average value from DB
  deviceName: string;        // Human-readable device name
  value: number;             // Adjusted temperature value
}

type Response = TemperatureReading[];
```

**Example Response:**
```json
[
  {
    "reading_date": "2026-02-11T00:00:00.000Z",
    "slave_id": 44,
    "time_interval": "2026-02-11T11:00:00.000Z",
    "avg_value": "25.0000000000000000",
    "deviceName": "Co2_Cirurgia4",
    "value": 18
  }
]
```

## Data Flow

```
                                    ┌─────────────────────────────┐
                                    │     Flow Context            │
                                    │     (slave_data)            │
                                    │                             │
                                    │  [                          │
                                    │    { id: 44, name: "Temp.   │
                                    │      Co2_Cirurgia4 -7" },   │
                                    │    ...                      │
                                    │  ]                          │
                                    └──────────┬──────────────────┘
                                               │
                                               │ lookup
                                               ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Request    │    │  Slave IDs   │    │    Query     │    │   Response   │
│              │    │              │    │   Results    │    │              │
│  devices: [  │───▶│  slaveIds:   │───▶│              │───▶│  deviceName  │
│    "Room A"  │    │    [44, 45]  │    │  slave_id,   │    │  + adjusted  │
│  ]           │    │              │    │  value, ...  │    │  value       │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

## Dependencies

| Dependency | Purpose |
|------------|---------|
| Node-RED   | Flow execution runtime |
| PostgreSQL | Temperature history storage |
| Flow Context (`slave_data`) | Device registry with slave IDs and names |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No matching slave IDs | Returns `null`, logs warning |
| Device not found in response processing | Logs warning, returns raw reading without enrichment |
| Invalid adjustment format | No adjustment applied, uses raw value |

## Configuration

The `slave_data` flow context must be pre-populated with the device registry before this endpoint can function. This is typically done by a separate initialization flow that queries ThingsBoard for device metadata.
