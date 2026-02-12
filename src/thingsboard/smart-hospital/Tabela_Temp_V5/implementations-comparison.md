# Temperature Report Implementations - Comparative Analysis

This document compares the three implementations of the Temperature Report flow.

## Summary Matrix

| Feature | Ar-Comprimido | CO2 | Maternidade |
|---------|---------------|-----|-------------|
| Device name filter | Generic regex | Generic regex + debug logs | Hardcoded string |
| Query granularity | 30-min intervals | 30-min intervals | Specific hours (11, 17, 23) |
| Aggregation | AVG per interval | AVG per interval | Single value (DISTINCT ON) |
| Timezone handling | America/Sao_Paulo | America/Sao_Paulo | UTC only |
| Unicode support in regex | Yes | Yes | No |
| Value source | `avg_value` | `avg_value` | `value` |
| Debug logs | No | Yes (Get-slave-ids) | Yes (controller) |

---

## 1. Get-slave-ids.js

### Ar-Comprimido
```javascript
const modifiedDeviceName = `Temp. ${device.replace(/ \([^)]+\)/g, '')}`;
```
- **Regex:** `/ \([^)]+\)/g` - Removes ANY text inside parentheses
- **Debug logs:** None

### CO2
```javascript
node.warn(`Antes: ${device}`);
const modifiedDeviceName = `Temp. ${device.replace(/ \([^)]+\)/g, '')}`;
node.warn(`depois: ${modifiedDeviceName}`);
```
- **Regex:** `/ \([^)]+\)/g` - Same as Ar-Comprimido
- **Debug logs:** Yes - logs before/after transformation

### Maternidade
```javascript
const modifiedDeviceName = `Temp. ${device.replace(' (Souza Aguiar CO2)', '')}`;
```
- **Regex:** None - Hardcoded string `' (Souza Aguiar CO2)'`
- **Debug logs:** None

### Key Differences

| Aspect | Ar-Comprimido | CO2 | Maternidade |
|--------|---------------|-----|-------------|
| Filter type | Generic regex | Generic regex | Hardcoded string |
| Handles any suffix | Yes | Yes | No (only CO2) |
| Debug output | No | Yes | No |

---

## 2. query.md (SQL)

### Ar-Comprimido & CO2 (Identical)
```sql
SELECT
  date_trunc('day', timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS reading_date,
  slave_id,
  date_trunc('hour', timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') +
    interval '30 minutes' * floor(date_part('minute', ...) / 30) AS time_interval,
  AVG(value) AS avg_value
FROM temperature_history
WHERE timestamp >= :dateStart
  AND timestamp < :dateEnd
  AND slave_id IN (:slaveIds)
GROUP BY reading_date, slave_id, time_interval
ORDER BY slave_id, time_interval;
```

**Characteristics:**
- Returns **all** 30-minute intervals in the date range
- Uses `AVG()` aggregation
- Timezone: `America/Sao_Paulo`
- Output field: `avg_value`

### Maternidade
```sql
SELECT DISTINCT ON (date_trunc('day', timestamp), slave_id, hour_group)
  date_trunc('day', timestamp) AS reading_date,
  slave_id,
  hour_group,
  timestamp,
  value
FROM (
  SELECT timestamp, slave_id, value,
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

**Characteristics:**
- Returns **only 3 specific hours** per day (11:00, 17:00, 23:00)
- Uses `DISTINCT ON` - first reading in each hour window
- Timezone: UTC (no conversion)
- Output field: `value` (raw, not averaged)

### Key Differences

| Aspect | Ar-Comprimido / CO2 | Maternidade |
|--------|---------------------|-------------|
| Intervals per day | ~48 (every 30 min) | 3 (fixed hours) |
| Aggregation method | AVG() | DISTINCT ON (first value) |
| Timezone | America/Sao_Paulo | UTC |
| Output column | `avg_value` | `value` |
| Missing data behavior | Gap in results | Gap in results |

---

## 3. nodered.controller.js

### Ar-Comprimido & CO2 (Identical)
```javascript
// Regex with Unicode support
const match = device.name.match(/^(Temp\.\s*)([\wÀ-ÿ\s\d-]+?)(?:\s([+\-x]\d+(\.\d+)?))?$/);

// Value source
let adjustedValue = Number(reading.avg_value);

// No debug logs for adjustment
```

### Maternidade
```javascript
// Regex WITHOUT Unicode support
const match = device.name.match(/^(Temp\.\s*)([\w\s\d-]+?)(?:\s([+\-x]\d+(\.\d+)?))?$/);

// Value source
let adjustedValue = Number(reading.value);

// Debug logs for adjustment
node.warn({
  device: deviceName,
  originalValue: reading.value,
  adjustedValue,
});
```

### Key Differences

| Aspect | Ar-Comprimido / CO2 | Maternidade |
|--------|---------------------|-------------|
| Regex pattern | `[\wÀ-ÿ\s\d-]` (Unicode) | `[\w\s\d-]` (ASCII only) |
| Handles accents (é, ã, etc.) | Yes | No |
| Value source | `reading.avg_value` | `reading.value` |
| Debug logs | No | Yes |

---

## Compatibility Issues

### 1. Maternidade's Hardcoded Filter
```javascript
// Only works for CO2 devices
device.replace(' (Souza Aguiar CO2)', '')
```
Will fail silently for devices with other suffixes like `(Ar Comprimido)`.

### 2. Value Field Mismatch
| Implementation | Query returns | Controller expects |
|----------------|---------------|-------------------|
| Ar-Comprimido | `avg_value` | `reading.avg_value` |
| CO2 | `avg_value` | `reading.avg_value` |
| Maternidade | `value` | `reading.value` |

If you swap query/controller between implementations, values will be `NaN`.

### 3. Unicode Device Names
Devices with accented names (e.g., `Temp. Cirurgia Pediátrica -5`) will:
- Work in Ar-Comprimido/CO2
- Fail to match in Maternidade (returns raw device name instead of parsed)

---

## Recommendations

### Unified Implementation

1. **Get-slave-ids.js**: Use generic regex `/ \([^)]+\)/g` (Ar-Comprimido style)

2. **query.md**: Choose based on use case:
   - **High-resolution monitoring**: 30-min intervals (Ar-Comprimido/CO2)
   - **Compliance reports**: Specific hours (Maternidade)

3. **nodered.controller.js**:
   - Use Unicode regex `[\wÀ-ÿ\s\d-]`
   - Normalize value source: always use `avg_value` or always use `value`
   - Add parameter to toggle debug logs

4. **Missing data handling**: All implementations have the same gap issue - consider implementing the v2 controller that fills missing slots with `"-"`.
