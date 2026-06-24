# Runbook: Reprocessing / Resyncing Gateway Data

Use this when a gateway has corrupt, missing, or outlier readings for a specific time period and you need to force a clean resync.

---

## Overview

The ingestion pipeline works as follows:
1. The gateway syncs readings via MQTT, advancing `lastWaterFetchTimestamp` (or `lastEnergyFetchTimestamp`) as data comes in.
2. Raw readings land in `water_readings` / `energy_readings`.
3. A TimescaleDB continuous aggregate (`aggregated_water_hourly` / `aggregated_energy_hourly`) is refreshed by background jobs — this is what the frontend queries.

To resync a period you need to:
1. Delete the bad raw readings for that period.
2. Roll back the gateway's last sync timestamp to the start of the period.
3. Wait for the gateway to re-push the data via MQTT.
4. Manually refresh the aggregate for the affected period (the auto-refresh job will also handle this, but it's slower).

---

## Step-by-step

### 1. Identify the gateway and time range

- **gateway_id**: from the gateway detail page or the `gateways` table.
- **Time range**: always use UTC. The frontend displays times in UTC-3, so add 3 hours. E.g. a spike at 20:00 on the chart = `23:00:00+00` in UTC.

### 2. Delete raw readings for the period

```sql
DELETE FROM water_readings
WHERE gateway_id = '<gateway_id>'
  AND timestamp >= '<start_utc>+00'
  AND timestamp < '<end_utc>+00';
```

> For energy data, use `energy_readings` instead.

Example (resync 21/03/2026 05:00 → 22/03/2026 05:00 UTC):
```sql
DELETE FROM water_readings
WHERE gateway_id = 'cb318f02-1020-4f99-857f-d44d001d939b'
  AND timestamp >= '2026-03-21 05:00:00+00'
  AND timestamp < '2026-03-22 05:00:00+00';
```

### 3. Roll back the gateway's last sync timestamp

Set `lastWaterFetchTimestamp` to the **start** of the period you want to resync from:

```sql
UPDATE gateways
SET "lastWaterFetchTimestamp" = '<start_utc>+00'
WHERE id = '<gateway_id>';
```

The gateway will receive this timestamp on its next MQTT connection and begin re-pushing data from that point forward.

### 4. Wait for the resync to complete

Monitor via the gateway detail page or query:

```sql
SELECT "lastWaterFetchTimestamp"
FROM gateways
WHERE id = '<gateway_id>';
```

Wait until `lastWaterFetchTimestamp` has advanced past the end of your resync window.

### 5. Restore the last sync timestamp (if needed)

If the resync window ends in the past and you don't want the gateway to keep re-pushing old data indefinitely, set the timestamp to ~2 hours ago once it has caught up to the end of the window:

```sql
UPDATE gateways
SET "lastWaterFetchTimestamp" = NOW() - INTERVAL '2 hours'
WHERE id = '<gateway_id>';
```

### 6. Refresh the aggregate

The auto-refresh job will eventually pick this up, but to fix the frontend immediately:

```sql
-- Use start of the affected day and midnight of the day AFTER (exclusive upper bound)
CALL refresh_continuous_aggregate(
  'aggregated_water_hourly',
  '<day_start_utc>',
  '<next_day_start_utc>'
);
```

Example:
```sql
CALL refresh_continuous_aggregate(
  'aggregated_water_hourly',
  '2026-03-21 00:00:00',
  '2026-03-22 00:00:00'
);
```

> **Important:** always use `00:00:00` of the *next* day as the upper bound — not `23:59:59`. TimescaleDB floors `window_end` to the nearest bucket boundary, so `23:59:59` would exclude the `23:00–00:00` bucket.

> For energy data, use `aggregated_energy_hourly` instead.

### 7. Verify

```sql
-- Check no outlier remains in the aggregate
SELECT bucket, total_m3, slave_id, channel
FROM aggregated_water_hourly
WHERE gateway_id = '<gateway_id>'
  AND bucket >= '<day_start_utc>'
  AND bucket < '<next_day_start_utc>'
ORDER BY bucket;

-- Confirm raw data looks clean
SELECT timestamp, value, slave_id, channel
FROM water_readings
WHERE gateway_id = '<gateway_id>'
  AND timestamp >= '<day_start_utc>'
  AND timestamp < '<next_day_start_utc>'
ORDER BY timestamp;
```

---

## Quick reference

| What | Table/Column |
|------|-------------|
| Raw water readings | `water_readings` |
| Raw energy readings | `energy_readings` |
| Water aggregate | `aggregated_water_hourly` |
| Energy aggregate | `aggregated_energy_hourly` |
| Water sync pointer | `gateways.lastWaterFetchTimestamp` |
| Energy sync pointer | `gateways.lastEnergyFetchTimestamp` |

## Notes

- All timestamps in the DB are UTC. The frontend shows UTC-3.
- The aggregate refresh window upper bound must be `00:00:00` of the day *after* the last affected day — using `23:59:59` will silently skip the last hourly bucket (23:00–00:00).
- Refresh jobs are system-wide (not per-gateway), so running one will also refresh other gateways' aggregates for the same period. This is harmless.
- If multiple gateways need resyncing, batch the deletes and timestamp resets before triggering the aggregate refresh.
