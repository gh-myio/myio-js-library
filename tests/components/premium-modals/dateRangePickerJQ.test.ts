// DateRangePickerJQ — maxSpan helper. The jQuery daterangepicker itself loads from
// CDN and is not exercised here.
import { describe, it, expect } from 'vitest';
import {
  buildMaxSpan,
  createNativeFallback,
} from '../../../src/components/premium-modals/internal/DateRangePickerJQ';

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

describe('createNativeFallback (not wired into attach())', () => {
  it('getDates returns LOCAL wall time + offset, not UTC with a local suffix', () => {
    const prevTZ = process.env.TZ;
    process.env.TZ = 'America/Sao_Paulo';
    try {
      const host = document.createElement('div');
      const input = document.createElement('input');
      host.appendChild(input);
      const control = createNativeFallback(input, { presetStart: '2026-09-15', presetEnd: '2026-09-15' });
      // Before: 2026-09-15T03:00:00.000-03:00 → 2026-09-16T02:59:59.000-03:00
      expect(control.getDates()).toEqual({
        startISO: '2026-09-15T00:00:00-03:00',
        endISO: '2026-09-15T23:59:59-03:00',
        startLabel: '15/09/2026',
        endLabel: '15/09/2026',
      });
      control.destroy();
    } finally {
      if (prevTZ === undefined) delete process.env.TZ;
      else process.env.TZ = prevTZ;
    }
  });
});
