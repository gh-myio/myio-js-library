import type { InventoryDevice } from '../../../../src/utils/devices/inventory/types';

export const NOW = Date.UTC(2026, 9, 6, 12, 0, 0); // 2026-10-06 12:00 UTC
export const HOUR = 3600 * 1000;

/** A healthy, integrated device; override what each test needs. */
export function makeDevice(overrides: Partial<InventoryDevice> = {}): InventoryDevice {
  return {
    id: 'dev-1',
    name: '3F SCSDIChiller1',
    label: 'Chiller 1',
    type: 'CHILLER',
    createdTime: Date.UTC(2025, 0, 1),
    ownerName: 'Shopping da Ilha',
    ownerType: 'CUSTOMER',
    customerId: 'cust-1',
    deviceProfile: 'CHILLER',
    identifier: 'CHILLER',
    ingestionId: 'ing-1',
    gcdrDeviceId: 'gcdr-1',
    centralId: 'central-1',
    slaveId: '10',
    lifecycleStatus: null,
    active: true,
    lastActivityTime: NOW - HOUR,
    attributesLoaded: true,
    ...overrides,
  };
}

/** Raw `entitiesQuery/find` row as TB returns it: every value a string, missing = `{ ts: 0, value: '' }`. */
export function rawRow(
  id: string,
  fields: Record<string, string>,
  attrs: Record<string, string>
): { entityId: { id: string }; latest: { ENTITY_FIELD: Record<string, { ts: number; value: string }>; SERVER_ATTRIBUTE: Record<string, { ts: number; value: string }> } } {
  const wrap = (o: Record<string, string>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ts: v === '' ? 0 : 1, value: v }]));
  return { entityId: { id }, latest: { ENTITY_FIELD: wrap(fields), SERVER_ATTRIBUTE: wrap(attrs) } };
}
