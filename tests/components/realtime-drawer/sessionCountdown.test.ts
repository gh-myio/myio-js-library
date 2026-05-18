/**
 * RFC-0201 Phase-2 pod J — Session countdown.
 *
 * Verifies the mm:ss formatter and `isSessionExpired` predicate that drive
 * the `#rtt-session-countdown` pill and stop the realtime polling loop.
 *
 * The realtime modal itself uses `setInterval` to redraw the pill, so we
 * exercise the pure helpers and simulate ticks via the formatter — without
 * mounting a real DOM-bound interval.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatSessionRemaining,
  isSessionExpired,
} from '../../../src/components/realtime-drawer/helpers';

describe('realtime-drawer / session countdown — formatter', () => {
  it('formats whole minutes correctly', () => {
    expect(formatSessionRemaining(5 * 60 * 1000)).toBe('5:00');
    expect(formatSessionRemaining(60 * 1000)).toBe('1:00');
  });

  it('zero-pads seconds', () => {
    expect(formatSessionRemaining(65 * 1000)).toBe('1:05'); // 1m 5s -> 1:05
    expect(formatSessionRemaining(9 * 1000)).toBe('0:09');
    expect(formatSessionRemaining(0)).toBe('0:00');
  });

  it('rounds-up sub-second remainders so 4:59.4 still reads 5:00 until it ticks', () => {
    // 4 min 59.4 s = 299_400 ms -> ceil 300 s -> 5:00
    expect(formatSessionRemaining(299_400)).toBe('5:00');
    // 4 min 58.4 s = 298_400 ms -> ceil 299 s -> 4:59
    expect(formatSessionRemaining(298_400)).toBe('4:59');
  });

  it('clamps negative / non-finite inputs to 0:00', () => {
    expect(formatSessionRemaining(-100)).toBe('0:00');
    expect(formatSessionRemaining(Number.NaN)).toBe('0:00');
    expect(formatSessionRemaining(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('realtime-drawer / session countdown — expiry & polling stop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('decrements as wall-clock time advances and triggers stop at zero', () => {
    const SESSION_LEN = 5 * 60 * 1000; // 5 min
    const start = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(start);
    const expiresAt = start + SESSION_LEN;

    // Initial display = 5:00, not expired
    expect(formatSessionRemaining(expiresAt - Date.now())).toBe('5:00');
    expect(isSessionExpired(expiresAt)).toBe(false);

    // Advance 30s -> 4:30
    vi.advanceTimersByTime(30_000);
    expect(formatSessionRemaining(expiresAt - Date.now())).toBe('4:30');
    expect(isSessionExpired(expiresAt)).toBe(false);

    // Advance to ~4 min later (total ~4:30) -> 0:30
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(formatSessionRemaining(expiresAt - Date.now())).toBe('0:30');
    expect(isSessionExpired(expiresAt)).toBe(false);

    // Advance the final 30 s -> 0:00 and now expired -> polling must stop
    vi.advanceTimersByTime(30_000);
    expect(formatSessionRemaining(expiresAt - Date.now())).toBe('0:00');
    expect(isSessionExpired(expiresAt)).toBe(true);
  });

  it('polling-loop guard halts when isSessionExpired returns true', () => {
    // Simulate the realtime drawer's recursive setTimeout poll loop. We hold
    // a tickCount and break out the moment isSessionExpired is true.
    const start = Date.now();
    const expiresAt = start + 60_000; // 1 minute session

    let pollCount = 0;
    function poll(): void {
      if (isSessionExpired(expiresAt)) return; // polling stops
      pollCount++;
      // schedule next tick in 10s
      setTimeout(poll, 10_000);
    }
    poll();
    // Run all timers up to 2 min — polling should stop at the 60s mark.
    vi.advanceTimersByTime(120_000);
    // 1 immediate poll + 5 scheduled ticks before expiry (10,20,30,40,50)
    expect(pollCount).toBeLessThanOrEqual(7);
    expect(pollCount).toBeGreaterThanOrEqual(5);
    // After expiry no further increments
    const frozen = pollCount;
    vi.advanceTimersByTime(60_000);
    expect(pollCount).toBe(frozen);
  });

  it('treats non-positive expiresAt as already expired', () => {
    expect(isSessionExpired(0)).toBe(true);
    expect(isSessionExpired(-1)).toBe(true);
    expect(isSessionExpired(Number.NaN)).toBe(true);
  });
});
