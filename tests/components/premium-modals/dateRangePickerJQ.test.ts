// DateRangePickerJQ — maxSpan helper. The jQuery daterangepicker itself loads from
// CDN and is not exercised here.
import { describe, it, expect } from 'vitest';
import { buildMaxSpan } from '../../../src/components/premium-modals/internal/DateRangePickerJQ';

describe('buildMaxSpan', () => {
  it('limits the range to the END of day N (N calendar days, inclusive)', () => {
    expect(buildMaxSpan(32)).toEqual({ days: 32, milliseconds: -1 });
  });

  it('15/08 00:00 + span reaches 15/09 23:59:59.999, never 16/09 00:00', () => {
    // Same order moment.add() applies a duration: calendar days first, then milliseconds.
    const span = buildMaxSpan(32);
    const limit = new Date(2026, 7, 15);
    limit.setDate(limit.getDate() + span.days);
    limit.setTime(limit.getTime() + span.milliseconds);
    expect(limit).toEqual(new Date(2026, 8, 15, 23, 59, 59, 999));
  });
});
