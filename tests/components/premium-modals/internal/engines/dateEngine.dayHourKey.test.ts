import { describe, it, expect } from 'vitest';
import { toDayKey, toHourKey } from '../../../../../src/components/premium-modals/internal/engines/DateEngine';
import { AllReportModal } from '../../../../../src/components/premium-modals/report-all/AllReportModal';
import type { OpenAllReportParams } from '../../../../../src/components/premium-modals/types';

const HOUR_MS = 60 * 60 * 1000;

function baseParams(overrides: Partial<OpenAllReportParams> = {}): OpenAllReportParams {
  return {
    customerId: 'customer-1',
    domain: 'energy',
    api: {
      dataApiBaseUrl: 'https://api.example.com',
      ingestionToken: 'token',
    },
    ...overrides,
  };
}

describe('DateEngine.toDayKey / toHourKey (RFC-0223 tz-pinned bucket keys)', () => {
  it('toDayKey is tz-pinned, not UTC-naive (a naive toISOString().slice(0,10) would be wrong here)', () => {
    // 2026-07-16T02:30:00Z is 2026-07-15 23:30 in America/Sao_Paulo (UTC-3, no DST since 2019).
    const ts = new Date('2026-07-16T02:30:00Z').getTime();
    expect(toDayKey(ts)).toBe('2026-07-15');
    expect(toHourKey(ts)).toBe('2026-07-15T23');
  });

  it('toDayKey/toHourKey accept an explicit tz override (not hard-coded to São Paulo)', () => {
    const ts = new Date('2026-01-10T12:00:00Z').getTime();
    expect(toDayKey(ts, 'America/Sao_Paulo')).toBe('2026-01-10');
    // America/New_York is UTC-5 in January (EST): 12:00Z -> 07:00 local, same day.
    expect(toDayKey(ts, 'America/New_York')).toBe('2026-01-10');
    expect(toHourKey(ts, 'America/New_York')).toBe('2026-01-10T07');
  });

  it('a spring-forward DST day yields 23 distinct hour keys, not a hard-coded 24 (AC17)', () => {
    // America/New_York spring-forward: 2024-03-10, clocks jump 02:00 -> 03:00.
    // Sample every UTC hour across a 48h window and keep only the ones landing
    // on the transition's local calendar day.
    const start = new Date('2024-03-10T00:00:00Z').getTime();
    const dayKeys = new Set<string>();
    const hourKeysForDay = new Set<string>();
    for (let i = 0; i < 48; i++) {
      const ts = start + i * HOUR_MS;
      const day = toDayKey(ts, 'America/New_York');
      dayKeys.add(day);
      if (day === '2024-03-10') hourKeysForDay.add(toHourKey(ts, 'America/New_York'));
    }
    expect(hourKeysForDay.size).toBe(23);
    expect(hourKeysForDay.has('2024-03-10T02')).toBe(false);
  });

  it('a fall-back DST day collapses the repeated local hour into one bucket key (24 distinct keys from 25 real readings)', () => {
    // America/New_York fall-back: 2024-11-03, local 01:00-01:59 occurs twice.
    // 25 hourly UTC samples land on this local day; the repeated local hour
    // must aggregate under ONE key so summed consumption for "hour 01" isn't
    // silently dropped or double-labeled.
    const start = new Date('2024-11-03T00:00:00Z').getTime();
    const hourKeysForDay: string[] = [];
    for (let i = 0; i < 48; i++) {
      const ts = start + i * HOUR_MS;
      if (toDayKey(ts, 'America/New_York') === '2024-11-03') {
        hourKeysForDay.push(toHourKey(ts, 'America/New_York'));
      }
    }
    expect(hourKeysForDay.length).toBe(25); // 25 real hourly readings that calendar day
    expect(new Set(hourKeysForDay).size).toBe(24); // but only 24 distinct hour buckets
    const occurrences = hourKeysForDay.filter((k) => k === '2024-11-03T01').length;
    expect(occurrences).toBe(2); // the repeated local hour maps twice into the same key
  });

  it('L4 (code review): bucketByDay sums a REAL DST fall-back collision, not just a synthetic same-hour-key pair', () => {
    // allReportModal.sections.test.ts's L4 tests prove the aggregation logic
    // with two timestamps 15 minutes apart (same hour key by construction).
    // This test drives the actual mechanism the reviewer described: two
    // real UTC instants that only collide because of the America/New_York
    // 2024-11-03 fall-back transition (the same transition as the test
    // above), fed straight into bucketByDay.
    const start = new Date('2024-11-03T00:00:00Z').getTime();
    const collidingTimestamps: number[] = [];
    for (let i = 0; i < 48; i++) {
      const t = start + i * HOUR_MS;
      if (
        toDayKey(t, 'America/New_York') === '2024-11-03' &&
        toHourKey(t, 'America/New_York') === '2024-11-03T01'
      ) {
        collidingTimestamps.push(t);
      }
    }
    expect(collidingTimestamps.length).toBe(2);

    const modal = new AllReportModal(
      baseParams({ domain: 'energy', api: { dataApiBaseUrl: 'x', ingestionToken: 'y', timezone: 'America/New_York' } })
    ) as any;
    const points = collidingTimestamps.map((timestamp, i) => ({ timestamp, value: i === 0 ? 4 : 6 }));
    const buckets = modal.bucketByDay(points, ['2024-11-03'], '1h');
    const day = buckets.get('2024-11-03');
    expect(day.hours.get('2024-11-03T01')).toBe(10); // 4 + 6, NOT 6 (last-write-wins)
    expect(day.value).toBe(10);
  });

  it('accepts a Date object as well as a numeric timestamp', () => {
    const d = new Date('2026-07-16T02:30:00Z');
    expect(toDayKey(d)).toBe(toDayKey(d.getTime()));
    expect(toHourKey(d)).toBe(toHourKey(d.getTime()));
  });
});
