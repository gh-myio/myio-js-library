/**
 * RFC-0183 / RFC-0201 Phase-1 — AC-RFC-0183-1, AC-RFC-0183-2.
 *
 * Verifies the AlarmServiceOrchestrator factory correctly:
 *   - Joins customerAlarms × itemsBase by `gcdrDeviceId` into
 *     `Map<gcdrDeviceId, GCDRAlarm[]>`.
 *   - Returns 0/[] for null/undefined lookups.
 *   - Honors the `showOfflineAlarms` gate at orchestrator level.
 *   - Re-fetches via `refreshFn` and dispatches `myio:alarm-closed` for
 *     every alarm-id present in the previous snapshot but absent from
 *     the new one.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAlarmServiceOrchestrator,
  type GCDRAlarm,
} from '../../../src/components/alarms/createAlarmServiceOrchestrator';
import type { BaseItem } from '../../../src/types/BaseItem';

/**
 * Build a minimal `BaseItem` with just the fields the orchestrator reads.
 * The factory only touches `gcdrDeviceId` and `deviceStatus`; everything
 * else is filler to satisfy the type.
 */
function makeItem(overrides: Partial<BaseItem>): BaseItem {
  return {
    id: overrides.entityId ?? 'tb-default',
    entityId: overrides.entityId ?? 'tb-default',
    name: 'Device',
    label: 'Device',
    labelOrName: 'Device',
    deviceType: '3F_MEDIDOR',
    deviceProfile: '3F_MEDIDOR',
    identifier: '',
    centralName: '',
    slaveId: '',
    centralId: '',
    customerId: '',
    ownerName: '',
    ingestionId: '',
    consumption: null,
    val: null,
    value: null,
    pulses: undefined,
    temperature: undefined,
    connectionStatus: 'online',
    deviceStatus: 'online',
    domain: 'energy',
    lastActivityTime: undefined,
    lastConnectTime: undefined,
    gcdrDeviceId: null,
    ...overrides,
  };
}

function makeAlarm(overrides: Partial<GCDRAlarm>): GCDRAlarm {
  return {
    id: 'alarm-default',
    gcdrDeviceId: 'gcdr-default',
    state: 'OPEN',
    severity: 'major',
    ...overrides,
  };
}

describe('RFC-0183 createAlarmServiceOrchestrator', () => {
  describe('AC-RFC-0183-1 — deviceAlarmMap join + counts', () => {
    it('builds correct counts for 3 alarms across 2 devices (1 + 2)', () => {
      // Three customers devices, two of them have alarms.
      const itemsBase: BaseItem[] = [
        makeItem({ entityId: 'tb-A', gcdrDeviceId: 'gcdr-A', deviceStatus: 'online' }),
        makeItem({ entityId: 'tb-B', gcdrDeviceId: 'gcdr-B', deviceStatus: 'online' }),
        makeItem({ entityId: 'tb-C', gcdrDeviceId: 'gcdr-C', deviceStatus: 'online' }),
      ];
      const customerAlarms: GCDRAlarm[] = [
        makeAlarm({ id: 'a1', gcdrDeviceId: 'gcdr-A' }),
        makeAlarm({ id: 'a2', gcdrDeviceId: 'gcdr-B' }),
        makeAlarm({ id: 'a3', gcdrDeviceId: 'gcdr-B' }),
      ];

      const orch = createAlarmServiceOrchestrator({
        customerAlarms,
        itemsBase,
        showOfflineAlarms: true, // not relevant when all online
        refreshFn: async () => [],
      });

      expect(orch.getAlarmCountForDevice('gcdr-A')).toBe(1);
      expect(orch.getAlarmCountForDevice('gcdr-B')).toBe(2);
      // Unaffected device → 0.
      expect(orch.getAlarmCountForDevice('gcdr-C')).toBe(0);
      // Map size should equal the number of devices that have alarms.
      expect(orch.deviceAlarmMap.size).toBe(2);
    });

    it('returns 0 for null/undefined gcdrDeviceId', () => {
      const orch = createAlarmServiceOrchestrator({
        customerAlarms: [],
        itemsBase: [],
        showOfflineAlarms: false,
        refreshFn: async () => [],
      });
      expect(orch.getAlarmCountForDevice(null)).toBe(0);
      expect(orch.getAlarmCountForDevice(undefined)).toBe(0);
      expect(orch.getAlarmsForDevice(null)).toEqual([]);
      expect(orch.getAlarmsForDevice(undefined)).toEqual([]);
    });

    it('accepts alarm.deviceId as a fallback when gcdrDeviceId is missing', () => {
      // Some GCDR API responses still use `deviceId` instead of `gcdrDeviceId`
      // — the factory must accept both (mirrors v-5.2.0 normalization).
      const itemsBase = [
        makeItem({ entityId: 'tb-A', gcdrDeviceId: 'gcdr-A', deviceStatus: 'online' }),
      ];
      const customerAlarms = [
        // gcdrDeviceId omitted, deviceId provided:
        { id: 'a1', deviceId: 'gcdr-A' } as unknown as GCDRAlarm,
      ];
      const orch = createAlarmServiceOrchestrator({
        customerAlarms,
        itemsBase,
        showOfflineAlarms: true,
        refreshFn: async () => [],
      });
      expect(orch.getAlarmCountForDevice('gcdr-A')).toBe(1);
    });
  });

  describe('AC-RFC-0183-2 — showOfflineAlarms gating', () => {
    it('hides alarms on offline devices when showOfflineAlarms = false', () => {
      const itemsBase: BaseItem[] = [
        makeItem({ entityId: 'tb-A', gcdrDeviceId: 'gcdr-A', deviceStatus: 'offline' }),
        makeItem({ entityId: 'tb-B', gcdrDeviceId: 'gcdr-B', deviceStatus: 'online' }),
      ];
      const customerAlarms: GCDRAlarm[] = [
        makeAlarm({ id: 'a1', gcdrDeviceId: 'gcdr-A' }),
        makeAlarm({ id: 'a2', gcdrDeviceId: 'gcdr-B' }),
      ];

      const orch = createAlarmServiceOrchestrator({
        customerAlarms,
        itemsBase,
        showOfflineAlarms: false,
        refreshFn: async () => [],
      });

      expect(orch.getAlarmCountForDevice('gcdr-A')).toBe(0); // offline → hidden
      expect(orch.getAlarmCountForDevice('gcdr-B')).toBe(1); // online → visible
    });

    it('shows alarms on offline devices when showOfflineAlarms = true', () => {
      const itemsBase: BaseItem[] = [
        makeItem({ entityId: 'tb-A', gcdrDeviceId: 'gcdr-A', deviceStatus: 'offline' }),
      ];
      const customerAlarms: GCDRAlarm[] = [
        makeAlarm({ id: 'a1', gcdrDeviceId: 'gcdr-A' }),
      ];

      const orch = createAlarmServiceOrchestrator({
        customerAlarms,
        itemsBase,
        showOfflineAlarms: true,
        refreshFn: async () => [],
      });

      expect(orch.getAlarmCountForDevice('gcdr-A')).toBe(1);
    });

    it('treats no_info status as offline for the gating heuristic', () => {
      const itemsBase: BaseItem[] = [
        makeItem({ entityId: 'tb-A', gcdrDeviceId: 'gcdr-A', deviceStatus: 'no_info' }),
      ];
      const customerAlarms: GCDRAlarm[] = [makeAlarm({ id: 'a1', gcdrDeviceId: 'gcdr-A' })];
      const orch = createAlarmServiceOrchestrator({
        customerAlarms,
        itemsBase,
        showOfflineAlarms: false,
        refreshFn: async () => [],
      });
      expect(orch.getAlarmCountForDevice('gcdr-A')).toBe(0);
    });
  });

  describe('refresh() — closed-alarm diff dispatches myio:alarm-closed', () => {
    let dispatched: CustomEvent[] = [];

    beforeEach(() => {
      dispatched = [];
      // Capture every CustomEvent dispatched onto window.
      const orig = window.dispatchEvent.bind(window);
      vi.spyOn(window, 'dispatchEvent').mockImplementation((ev: Event) => {
        if (ev instanceof CustomEvent) dispatched.push(ev);
        return orig(ev);
      });
    });

    it('dispatches myio:alarm-closed for every removed alarm-id', async () => {
      const itemsBase: BaseItem[] = [
        makeItem({ entityId: 'tb-A', gcdrDeviceId: 'gcdr-A', deviceStatus: 'online' }),
      ];
      const initial: GCDRAlarm[] = [
        makeAlarm({ id: 'a1', gcdrDeviceId: 'gcdr-A' }),
        makeAlarm({ id: 'a2', gcdrDeviceId: 'gcdr-A' }),
      ];
      // After refresh, only a1 remains — a2 should fire myio:alarm-closed.
      const refreshed: GCDRAlarm[] = [makeAlarm({ id: 'a1', gcdrDeviceId: 'gcdr-A' })];

      const orch = createAlarmServiceOrchestrator({
        customerAlarms: initial,
        itemsBase,
        showOfflineAlarms: true,
        refreshFn: async () => refreshed,
      });

      expect(orch.getAlarmCountForDevice('gcdr-A')).toBe(2);
      await orch.refresh();
      expect(orch.getAlarmCountForDevice('gcdr-A')).toBe(1);

      const closed = dispatched.filter((e) => e.type === 'myio:alarm-closed');
      expect(closed).toHaveLength(1);
      expect((closed[0].detail as { alarmId: string }).alarmId).toBe('a2');
      expect((closed[0].detail as { gcdrDeviceId: string }).gcdrDeviceId).toBe('gcdr-A');
    });

    it('does not dispatch myio:alarm-closed when no alarms were removed', async () => {
      const itemsBase: BaseItem[] = [
        makeItem({ entityId: 'tb-A', gcdrDeviceId: 'gcdr-A', deviceStatus: 'online' }),
      ];
      const initial: GCDRAlarm[] = [makeAlarm({ id: 'a1', gcdrDeviceId: 'gcdr-A' })];
      const refreshed: GCDRAlarm[] = [
        makeAlarm({ id: 'a1', gcdrDeviceId: 'gcdr-A' }),
        makeAlarm({ id: 'a2', gcdrDeviceId: 'gcdr-A' }), // new alarm — not closed
      ];

      const orch = createAlarmServiceOrchestrator({
        customerAlarms: initial,
        itemsBase,
        showOfflineAlarms: true,
        refreshFn: async () => refreshed,
      });

      await orch.refresh();
      const closed = dispatched.filter((e) => e.type === 'myio:alarm-closed');
      expect(closed).toHaveLength(0);
    });
  });
});
