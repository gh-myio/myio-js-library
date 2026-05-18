/**
 * RFC-0201 Phase-1 (Pod F0) — AC-Fix-gcdrDeviceId-1
 *
 * Verifies that `extractDeviceMetadataFromRows` returns a `gcdrDeviceId`
 * field sourced from the TB dataKey `gcdrDeviceId` (with case-insensitive
 * fallback to `gcdrdeviceid`).
 */

import { describe, it, expect } from 'vitest';
import { extractDeviceMetadataFromRows } from '../../src/thingsboard/main-dashboard-shopping/v-5.4.0/lib/extractDeviceMetadataFromRows.js';

/**
 * Build a single TB-shaped row for one (entityId, dataKey) pair.
 * `data` is the standard TB `[[ts, value], ...]` array.
 */
function makeRow(entityId: string, keyName: string, value: any, ts = 1714400000000) {
  return {
    datasource: { entityId, entityName: 'demo-device', entityLabel: 'Demo Device' },
    dataKey: { name: keyName },
    data: [[ts, value]],
  };
}

describe('extractDeviceMetadataFromRows — RFC-0201 gcdrDeviceId propagation', () => {
  it('returns gcdrDeviceId when the dataKey is the canonical camelCase "gcdrDeviceId"', () => {
    const rows = [
      makeRow('e1', 'gcdrDeviceId', 'abc-123'),
      makeRow('e1', 'deviceType', '3F_MEDIDOR'),
    ];

    const result = extractDeviceMetadataFromRows(rows);

    expect(result).not.toBeNull();
    expect(result!.gcdrDeviceId).toBe('abc-123');
  });

  it('falls back to lowercase "gcdrdeviceid" when TB lowercases the dataKey name', () => {
    const rows = [
      makeRow('e2', 'gcdrdeviceid', 'lower-cased-uuid'),
      makeRow('e2', 'deviceType', '3F_MEDIDOR'),
    ];

    const result = extractDeviceMetadataFromRows(rows);

    expect(result).not.toBeNull();
    expect(result!.gcdrDeviceId).toBe('lower-cased-uuid');
  });

  it('prefers camelCase over lowercase when both are present', () => {
    const rows = [
      makeRow('e3', 'gcdrDeviceId', 'camel-wins'),
      makeRow('e3', 'gcdrdeviceid', 'lower-loses'),
      makeRow('e3', 'deviceType', '3F_MEDIDOR'),
    ];

    const result = extractDeviceMetadataFromRows(rows);

    expect(result!.gcdrDeviceId).toBe('camel-wins');
  });

  it('returns gcdrDeviceId === null when neither key is present', () => {
    const rows = [
      makeRow('e4', 'deviceType', '3F_MEDIDOR'),
      makeRow('e4', 'connectionStatus', 'online'),
    ];

    const result = extractDeviceMetadataFromRows(rows);

    expect(result).not.toBeNull();
    expect(result!.gcdrDeviceId).toBeNull();
  });

  it('returns null when rows is empty or undefined', () => {
    expect(extractDeviceMetadataFromRows([])).toBeNull();
    expect(extractDeviceMetadataFromRows(null as unknown as any[])).toBeNull();
  });

  it('preserves all canonical BaseItem fields alongside gcdrDeviceId', () => {
    const rows = [
      makeRow('e5', 'gcdrDeviceId', 'g-5'),
      makeRow('e5', 'deviceType', 'HIDROMETRO'),
      makeRow('e5', 'deviceProfile', 'HIDROMETRO'),
      makeRow('e5', 'identifier', 'HID-1'),
      makeRow('e5', 'connectionStatus', 'online'),
      makeRow('e5', 'pulses', 42),
      makeRow('e5', 'ingestionId', 'ing-5'),
    ];

    const result = extractDeviceMetadataFromRows(rows)!;

    expect(result.id).toBe('e5');
    expect(result.entityId).toBe('e5');
    expect(result.deviceType).toBe('HIDROMETRO');
    expect(result.identifier).toBe('HID-1');
    expect(result.connectionStatus).toBe('online');
    expect(result.pulses).toBe(42);
    expect(result.ingestionId).toBe('ing-5');
    expect(result.domain).toBe('water'); // HIDROMETRO -> water (RFC-0111)
    expect(result.gcdrDeviceId).toBe('g-5');
  });
});
