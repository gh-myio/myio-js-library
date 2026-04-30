/**
 * RFC-0193 / RFC-0201 Phase 2 (row #25) — AC-RFC-0193-1.
 *
 * `createAlarmServiceOrchestrator.refresh()` MUST dispatch one
 * `myio:alarm-closed` CustomEvent for every alarm-id that disappears
 * between two snapshots, and the event detail MUST include the FULL
 * previous alarm object (so the listener can render a meaningful toast
 * without a separate lookup).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createAlarmServiceOrchestrator,
  type GCDRAlarm,
} from '../../../src/components/alarms/createAlarmServiceOrchestrator';

interface StubItem {
  gcdrDeviceId: string | null;
  deviceStatus: string;
}

function makeAlarm(overrides: Partial<GCDRAlarm> & { id: string; gcdrDeviceId: string }): GCDRAlarm {
  return {
    id: overrides.id,
    gcdrDeviceId: overrides.gcdrDeviceId,
    state: 'OPEN',
    severity: 'HIGH',
    alarmType: 'over_consumption',
    title: 'Consumo elevado',
    ...overrides,
  };
}

describe('createAlarmServiceOrchestrator — RFC-0193 closed-alarm event', () => {
  const itemsBase: StubItem[] = [
    { gcdrDeviceId: 'g1', deviceStatus: 'online' },
    { gcdrDeviceId: 'g2', deviceStatus: 'online' },
  ];

  let dispatchSpy: ReturnType<typeof vi.spyOn>;
  let captured: CustomEvent[];

  beforeEach(() => {
    captured = [];
    dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation((e: Event) => {
      if (e instanceof CustomEvent && e.type === 'myio:alarm-closed') {
        captured.push(e);
      }
      return true;
    });
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it('dispatches no event on the first refresh (no previous snapshot to diff against)', async () => {
    const initial: GCDRAlarm[] = [makeAlarm({ id: 'a1', gcdrDeviceId: 'g1' })];
    const next: GCDRAlarm[] = [];
    const orch = createAlarmServiceOrchestrator({
      // Constructor populates the FIRST snapshot. After this, refresh()
      // diffs against the constructor's snapshot — closing every initial
      // alarm WILL produce a 'myio:alarm-closed' event.
      customerAlarms: initial,
      itemsBase: itemsBase as never,
      showOfflineAlarms: true,
      refreshFn: async () => next,
    });

    expect(captured).toHaveLength(0);
    await orch.refresh();
    expect(captured).toHaveLength(1);
    expect(captured[0].detail.alarmId).toBe('a1');
  });

  it('dispatches one myio:alarm-closed per disappeared alarm-id, with full alarm object', async () => {
    const initial: GCDRAlarm[] = [
      makeAlarm({ id: 'a1', gcdrDeviceId: 'g1', title: 'T1', device_label: 'Loja A' }),
      makeAlarm({ id: 'a2', gcdrDeviceId: 'g2', title: 'T2', device_label: 'Loja B' }),
      makeAlarm({ id: 'a3', gcdrDeviceId: 'g1', title: 'T3', device_label: 'Loja A' }),
    ];
    // Refresh returns only a2 — both a1 and a3 should fire close events.
    const next: GCDRAlarm[] = [makeAlarm({ id: 'a2', gcdrDeviceId: 'g2' })];

    const orch = createAlarmServiceOrchestrator({
      customerAlarms: initial,
      itemsBase: itemsBase as never,
      showOfflineAlarms: true,
      refreshFn: async () => next,
    });
    await orch.refresh();

    const closedIds = captured.map((e) => e.detail.alarmId).sort();
    expect(closedIds).toEqual(['a1', 'a3']);

    const a1Event = captured.find((e) => e.detail.alarmId === 'a1');
    expect(a1Event).toBeDefined();
    expect(a1Event!.detail.gcdrDeviceId).toBe('g1');
    // RFC-0193: full alarm object MUST be on the payload so the listener
    // can read device_label / title without a separate lookup.
    expect(a1Event!.detail.alarm).toBeDefined();
    expect(a1Event!.detail.alarm.title).toBe('T1');
    expect(a1Event!.detail.alarm.device_label).toBe('Loja A');
  });

  it('does NOT dispatch myio:alarm-closed for alarms that persist across refresh', async () => {
    const alarms: GCDRAlarm[] = [
      makeAlarm({ id: 'persist-1', gcdrDeviceId: 'g1' }),
      makeAlarm({ id: 'persist-2', gcdrDeviceId: 'g2' }),
    ];
    const orch = createAlarmServiceOrchestrator({
      customerAlarms: alarms,
      itemsBase: itemsBase as never,
      showOfflineAlarms: true,
      refreshFn: async () => alarms, // identical set
    });
    await orch.refresh();
    expect(captured).toHaveLength(0);
  });

  it('does NOT dispatch when refreshFn throws — keeps previous map and stays silent', async () => {
    const initial: GCDRAlarm[] = [makeAlarm({ id: 'a1', gcdrDeviceId: 'g1' })];
    const orch = createAlarmServiceOrchestrator({
      customerAlarms: initial,
      itemsBase: itemsBase as never,
      showOfflineAlarms: true,
      refreshFn: async () => {
        throw new Error('network down');
      },
    });
    await orch.refresh();
    expect(captured).toHaveLength(0);
    // Map remains pointed at the previous alarms.
    expect(orch.getAlarmCountForDevice('g1')).toBe(1);
  });

  it('closing-and-reopening with a NEW alarm-id triggers exactly one close event', async () => {
    const initial: GCDRAlarm[] = [makeAlarm({ id: 'old', gcdrDeviceId: 'g1' })];
    const next: GCDRAlarm[] = [makeAlarm({ id: 'new', gcdrDeviceId: 'g1' })];
    const orch = createAlarmServiceOrchestrator({
      customerAlarms: initial,
      itemsBase: itemsBase as never,
      showOfflineAlarms: true,
      refreshFn: async () => next,
    });
    await orch.refresh();
    expect(captured).toHaveLength(1);
    expect(captured[0].detail.alarmId).toBe('old');
  });
});
