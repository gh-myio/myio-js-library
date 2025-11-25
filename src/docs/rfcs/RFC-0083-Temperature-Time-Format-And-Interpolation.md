# RFC-0083: Temperature Domain - Time Format and Interpolation

**Status**: Implementing
**Created**: 2025-01-25
**Author**: Claude Code

## Summary

Enhance temperature domain visualization with:
1. Display time (HH:mm) on X-axis instead of dates
2. Support datetime picker (with hours) for start/end filtering
3. Implement 30-minute interpolation using last known value

## Motivation

Temperature readings require granular time-based visualization:
- Temperature varies throughout the day (not daily aggregates)
- Need to see hourly patterns
- Missing data points should be interpolated for continuous visualization

## Design

### 1. Time Format on X-Axis

When `readingType === 'temperature'`:
- X-axis ticks show: `HH:mm` (e.g., "14:30")
- Tooltip shows: `DD/MM/YYYY HH:mm`
- No change for energy/water domains (keep date format)

### 2. Datetime Picker

When `readingType === 'temperature'`:
- Date inputs include time selectors
- Format: `YYYY-MM-DD HH:mm`
- Default range: Last 24 hours

### 3. 30-Minute Interpolation

**Algorithm**:
```typescript
function interpolateTemperatureData(rawPoints: Point[]): Point[] {
  if (rawPoints.length === 0) return [];

  const interpolated: Point[] = [];
  const interval = 30 * 60 * 1000; // 30 minutes in ms

  // Sort by timestamp
  const sorted = [...rawPoints].sort((a, b) => a.x - b.x);

  // Get time range
  const startTime = sorted[0].x;
  const endTime = sorted[sorted.length - 1].x;

  let lastKnownValue = sorted[0].y;
  let dataIndex = 0;

  // Generate points every 30 minutes
  for (let time = startTime; time <= endTime; time += interval) {
    // Find if we have actual data at this time (±5 min tolerance)
    const actualPoint = sorted.find((p, idx) => {
      if (idx >= dataIndex && Math.abs(p.x - time) < 5 * 60 * 1000) {
        dataIndex = idx + 1;
        return true;
      }
      return false;
    });

    if (actualPoint) {
      lastKnownValue = actualPoint.y;
      interpolated.push({ x: time, y: lastKnownValue });
    } else {
      // Use last known value (step interpolation)
      interpolated.push({ x: time, y: lastKnownValue });
    }
  }

  return interpolated;
}
```

## Implementation

### Files to Modify

1. **`src/components/DemandModal.ts`**:
   - Add `interpolateTemperatureData()` function
   - Modify chart X-axis configuration based on `readingType`
   - Update tooltip callbacks for temperature
   - Add datetime input support

## Examples

### Before (Energy/Water):
- X-axis: "01/11", "02/11", "03/11"
- Tooltip: "02/11/2025"
- Input: Date only

### After (Temperature):
- X-axis: "14:00", "14:30", "15:00"
- Tooltip: "02/11/2025 14:30"
- Input: Date + Time
- Data: Interpolated every 30 minutes

## Migration

- Backward compatible
- Only affects `readingType === 'temperature'`
- Energy/Water unchanged
