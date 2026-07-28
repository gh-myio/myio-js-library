/**
 * RFC-0228 A5a — the device-category SEAM (`deviceCategoryPort.ts`).
 *
 * Proves the injectable port contract that the UI depends on (feedback §5), using
 * ONLY the in-memory fake — no HTTP, no host. Also proves the HTTP stub refuses to
 * run until B6 ships, so nothing accidentally relies on a presumed device API.
 */

import { describe, it, expect } from 'vitest';
import {
  createFakeDeviceCategoryPort,
  createHttpDeviceCategoryPort,
  DeviceCategoryConflictError,
  type DeviceCategoryPort,
} from '../../../src/components/financial-goals/deviceCategoryPort';

const seed = [
  { deviceId: 'd1', code: 'SCP-001', label: 'Loja 1', tariffCategory: 'SPECIFIC' as const, version: '3' },
  { deviceId: 'd2', code: 'SCP-002', label: 'Corredor L2', tariffCategory: null, version: '0' },
  { deviceId: 'd3', code: 'SCP-003', label: 'Praça', tariffCategory: 'COMMON_AREA' as const, version: '1' },
];

describe('createFakeDeviceCategoryPort', () => {
  it('lists all seeded devices with their explicit category', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    const rows = await port.listDevices({ customerId: 'c1' });
    expect(rows.map((r) => r.deviceId)).toEqual(['d1', 'd2', 'd3']);
    expect(rows.find((r) => r.deviceId === 'd2')!.tariffCategory).toBeNull();
    expect(rows.find((r) => r.deviceId === 'd1')!.tariffCategory).toBe('SPECIFIC');
  });

  it('filters by domain when the seed tags one', async () => {
    const port = createFakeDeviceCategoryPort([
      { deviceId: 'e1', domain: 'ENERGY', tariffCategory: null },
      { deviceId: 'w1', domain: 'WATER', tariffCategory: null },
    ]);
    const energy = await port.listDevices({ customerId: 'c1', domain: 'ENERGY' });
    expect(energy.map((r) => r.deviceId)).toEqual(['e1']);
  });

  it('setCategory updates the row and bumps version', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    const updated = await port.setCategory({ deviceId: 'd2', category: 'COMMON_AREA', expectedVersion: '0' });
    expect(updated.tariffCategory).toBe('COMMON_AREA');
    expect(updated.version).toBe('1');
    const rows = await port.listDevices({ customerId: 'c1' });
    expect(rows.find((r) => r.deviceId === 'd2')!.tariffCategory).toBe('COMMON_AREA');
  });

  it('setCategory can clear a category to null', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    const updated = await port.setCategory({ deviceId: 'd1', category: null, expectedVersion: '3' });
    expect(updated.tariffCategory).toBeNull();
  });

  it('rejects a stale expectedVersion with a conflict error', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    await expect(
      port.setCategory({ deviceId: 'd1', category: 'COMMON_AREA', expectedVersion: '999' })
    ).rejects.toBeInstanceOf(DeviceCategoryConflictError);
  });

  it('bumpVersion simulates a concurrent edit that then conflicts', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    port.bumpVersion('d3'); // someone else edited d3
    await expect(
      port.setCategory({ deviceId: 'd3', category: 'SPECIFIC', expectedVersion: '1' })
    ).rejects.toBeInstanceOf(DeviceCategoryConflictError);
  });

  it('exposes setCategoryBulk by default and reports per-device failures', async () => {
    const port = createFakeDeviceCategoryPort(seed);
    expect(typeof port.setCategoryBulk).toBe('function');
    const res = await port.setCategoryBulk!({ deviceIds: ['d1', 'd2', 'missing'], category: 'COMMON_AREA' });
    expect(res.updated).toBe(2);
    expect(res.failed).toEqual([{ deviceId: 'missing', reason: 'UNKNOWN_DEVICE' }]);
  });

  it('omits setCategoryBulk when supportsBulk:false (exercises the N-call fallback)', () => {
    const port = createFakeDeviceCategoryPort(seed, { supportsBulk: false });
    expect(port.setCategoryBulk).toBeUndefined();
  });
});

describe('createHttpDeviceCategoryPort (awaits B6)', () => {
  it('is a marked stub: every method throws until B6 lands', async () => {
    const port: DeviceCategoryPort = createHttpDeviceCategoryPort({ baseUrl: 'https://example.invalid' });
    await expect(port.listDevices({ customerId: 'c1' })).rejects.toThrow(/B6/);
    await expect(port.setCategory({ deviceId: 'd1', category: null })).rejects.toThrow(/B6/);
  });
});
