/**
 * RFC-0183 / RFC-0201 Phase 1 — AlarmServiceOrchestrator factory.
 *
 * Builds an in-memory join between the customer alarm list (GCDR Alarms API)
 * and the per-device baseline (`STATE.itemsBase`) so device cards can render
 * an alarm-count badge without re-querying the API per card.
 *
 * The shape mirrors the production `window.AlarmServiceOrchestrator`
 * constructed in `v-5.2.0/WIDGET/MAIN_VIEW/controller.js
 * ::_buildAlarmServiceOrchestrator` (READ-ONLY reference). v-5.2.0 keys the
 * map by `alarm.deviceId` (which equals the GCDR device UUID); v-5.4.0 keeps
 * the same convention by keying on `BaseItem.gcdrDeviceId`.
 *
 * Lifecycle:
 *   1. Controller calls the factory once `customerAlarms` and
 *      `STATE.itemsBase` are both populated.
 *   2. `refresh()` re-fetches via the supplied `refreshFn`, snapshots the
 *      previous map, rebuilds, then dispatches `myio:alarm-closed` on
 *      `window` for every alarm-id present in the previous snapshot but
 *      missing from the new one.
 */

import type { BaseItem } from '../../types/BaseItem';

/**
 * Minimal GCDR alarm shape consumed by the orchestrator. Only the fields
 * we read are typed strictly; everything else is preserved as `unknown`
 * so consumers that care about API-specific fields can narrow further.
 */
export interface GCDRAlarm {
  /** Stable alarm id (used for diffing across `refresh()` calls). */
  id: string;
  /** GCDR device UUID — matches `BaseItem.gcdrDeviceId`. */
  gcdrDeviceId: string;
  /** Open / Acked / Closed / etc. */
  state?: string;
  /** Severity level (free-form on the API side). */
  severity?: string;
  /**
   * Some deployments of the GCDR Alarm API return `deviceId` instead of
   * `gcdrDeviceId`. The factory accepts both — matching v-5.2.0's
   * normalization step.
   */
  deviceId?: string;
  /** Optional alarm-type tag. */
  alarmType?: string;
  /** Tags array used by the internal-support filter heuristic. */
  tags?: string[];
  /** Category used by the internal-support filter heuristic. */
  category?: string;
  /** Pass-through for any other fields the upstream API includes. */
  [k: string]: unknown;
}

/**
 * Public contract of the constructed orchestrator. v-5.2.0 attaches this
 * object to `window.AlarmServiceOrchestrator`; v-5.4.0 mirrors that.
 */
export interface AlarmServiceOrchestrator {
  /** `Map<gcdrDeviceId, GCDRAlarm[]>` — the join result. */
  deviceAlarmMap: Map<string, GCDRAlarm[]>;
  /** Returns the alarm count for a single device, or `0` if none. */
  getAlarmCountForDevice(gcdrDeviceId: string | null | undefined): number;
  /** Returns the alarm array for a single device, or `[]` if none. */
  getAlarmsForDevice(gcdrDeviceId: string | null | undefined): GCDRAlarm[];
  /**
   * Re-fetches via the supplied `refreshFn`, recomputes the device map,
   * dispatches `myio:alarm-closed` for each removed alarm-id.
   */
  refresh(): Promise<void>;
}

export interface CreateAlarmOrchestratorOpts {
  /** All open customer alarms (already pre-fetched by the controller). */
  customerAlarms: GCDRAlarm[];
  /** Flat base list of all classified devices for the customer. */
  itemsBase: BaseItem[];
  /**
   * When `false` (default in widget settings), alarms whose underlying
   * device is offline are omitted from the join — preventing badge
   * floods when a central drops.
   */
  showOfflineAlarms: boolean;
  /**
   * Pluggable re-fetch routine — the controller wraps
   * `_prefetchCustomerAlarms` and returns the new `customerAlarms` list.
   */
  refreshFn: () => Promise<GCDRAlarm[]>;
}

/**
 * Produces a `GCDRAlarm[]` filtered by the supplied options. Pulled out
 * so `refresh()` can re-use the same logic without duplicating the
 * offline-gating heuristic.
 */
function filterAlarms(
  alarms: GCDRAlarm[],
  itemsBase: BaseItem[],
  showOfflineAlarms: boolean,
): GCDRAlarm[] {
  // Normalize `gcdrDeviceId` (v-5.2.0 normalizes alarm.source ← alarm.deviceId).
  const normalized = alarms.map((alarm) => ({
    ...alarm,
    gcdrDeviceId: alarm.gcdrDeviceId || alarm.deviceId || '',
  }));

  if (showOfflineAlarms) return normalized.filter((a) => Boolean(a.gcdrDeviceId));

  // Build a quick lookup: gcdrDeviceId → device.deviceStatus
  const statusByGcdrId = new Map<string, string>();
  for (const item of itemsBase) {
    if (!item?.gcdrDeviceId) continue;
    statusByGcdrId.set(item.gcdrDeviceId, (item.deviceStatus || '').toLowerCase());
  }

  return normalized.filter((a) => {
    if (!a.gcdrDeviceId) return false;
    const status = statusByGcdrId.get(a.gcdrDeviceId);
    if (status === 'offline' || status === 'no_info') return false;
    return true;
  });
}

/**
 * Builds `Map<gcdrDeviceId, GCDRAlarm[]>` from a flat alarm list.
 */
function buildDeviceAlarmMap(alarms: GCDRAlarm[]): Map<string, GCDRAlarm[]> {
  const map = new Map<string, GCDRAlarm[]>();
  for (const alarm of alarms) {
    const id = alarm.gcdrDeviceId;
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(alarm);
  }
  return map;
}

/**
 * Snapshots `Map<id, alarmId>` so we can compute the closed-alarm diff in
 * `refresh()` without holding onto the entire previous alarm objects.
 */
function snapshotAlarmIndex(
  deviceAlarmMap: Map<string, GCDRAlarm[]>,
): Map<string, string> {
  // alarmId → gcdrDeviceId
  const idx = new Map<string, string>();
  deviceAlarmMap.forEach((alarms, gid) => {
    for (const a of alarms) {
      if (a.id) idx.set(a.id, gid);
    }
  });
  return idx;
}

/**
 * Factory: creates a stateful `AlarmServiceOrchestrator` instance.
 *
 * Side effect on `refresh()`: dispatches `myio:alarm-closed` on `window`
 * for each alarm-id present in the previous snapshot but missing from the
 * new one. Payload: `{ alarmId, gcdrDeviceId }`.
 */
export function createAlarmServiceOrchestrator(
  opts: CreateAlarmOrchestratorOpts,
): AlarmServiceOrchestrator {
  const { itemsBase, refreshFn } = opts;
  let { showOfflineAlarms } = opts;

  let deviceAlarmMap = buildDeviceAlarmMap(
    filterAlarms(opts.customerAlarms || [], itemsBase, showOfflineAlarms),
  );

  function getAlarmCountForDevice(gcdrDeviceId: string | null | undefined): number {
    if (!gcdrDeviceId) return 0;
    return deviceAlarmMap.get(gcdrDeviceId)?.length ?? 0;
  }

  function getAlarmsForDevice(gcdrDeviceId: string | null | undefined): GCDRAlarm[] {
    if (!gcdrDeviceId) return [];
    return deviceAlarmMap.get(gcdrDeviceId) ?? [];
  }

  async function refresh(): Promise<void> {
    // Snapshot the previous index so we can compute the closed-alarm diff
    // (alarm-id keyed — count-keyed would false-positive on
    // close-and-reopen-in-same-cycle scenarios).
    const previousIndex = snapshotAlarmIndex(deviceAlarmMap);

    let nextAlarms: GCDRAlarm[] = [];
    try {
      nextAlarms = (await refreshFn()) || [];
    } catch (err) {
      // Surface the failure via console; do not blow up the orchestrator —
      // consumers will keep the previous map until the next successful
      // refresh.
      // eslint-disable-next-line no-console
      console.warn('[AlarmServiceOrchestrator] refresh() failed:', err);
      return;
    }

    deviceAlarmMap = buildDeviceAlarmMap(
      filterAlarms(nextAlarms, itemsBase, showOfflineAlarms),
    );

    // Compute the closed-alarm diff (RFC-0193): alarm-ids present in old but
    // not in new.
    const newIndex = snapshotAlarmIndex(deviceAlarmMap);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      previousIndex.forEach((gcdrDeviceId, alarmId) => {
        if (!newIndex.has(alarmId)) {
          window.dispatchEvent(
            new CustomEvent('myio:alarm-closed', {
              detail: { alarmId, gcdrDeviceId },
            }),
          );
        }
      });
    }
  }

  return {
    get deviceAlarmMap() {
      return deviceAlarmMap;
    },
    getAlarmCountForDevice,
    getAlarmsForDevice,
    refresh,
  };
}
