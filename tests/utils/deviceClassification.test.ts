import { describe, it, expect } from 'vitest';
import {
  extractDeviceMetadataFromRows,
  classifyAllDevices,
  buildByStatusFromDevices,
} from '../../src/utils/thingsboard/deviceClassification';

// Deterministic injected deps (no real lib / clock).
const getDomain = (dt: string) =>
  /HIDROMETRO/i.test(dt) ? 'water' : /TERMOSTATO/i.test(dt) ? 'temperature' : 'energy';
const calcStatus = ({ connectionStatus }: any) => connectionStatus || 'offline';
const catalog = {
  energy: { valueField: 'consumption' },
  water: { valueField: 'pulses' },
  temperature: { valueField: 'temperature' },
};

function rowsFor(entityId: string, kv: Record<string, any>, ts: Record<string, number> = {}) {
  return Object.entries(kv).map(([name, val]) => ({
    datasource: { entityId, entityName: `name-${entityId}`, entityLabel: `label-${entityId}` },
    dataKey: { name },
    data: [[ts[name] ?? 0, val]],
  }));
}

describe('extractDeviceMetadataFromRows (RFC-0209)', () => {
  it('resolves domain → valueField → value (energy)', () => {
    const d = extractDeviceMetadataFromRows(
      rowsFor('e1', {
        deviceType: '3F_MEDIDOR',
        deviceProfile: '3F_MEDIDOR',
        consumption: 45.6,
        connectionStatus: 'online',
        identifier: 'LOJA-1',
      }),
      { catalog, getDomain, calcStatus }
    )!;
    expect(d.domain).toBe('energy');
    expect(d.value).toBe(45.6);
    expect(d.consumption).toBe(45.6);
    expect(d.deviceProfile).toBe('3F_MEDIDOR');
    expect(d.deviceStatus).toBe('online');
    expect(d.identifier).toBe('LOJA-1');
  });

  it('sets the domain raw field via computed key (temperature) without literals', () => {
    const d = extractDeviceMetadataFromRows(
      rowsFor('t1', { deviceType: 'TERMOSTATO', temperature: 25, connectionStatus: 'online' }),
      { catalog, getDomain, calcStatus }
    )!;
    expect(d.domain).toBe('temperature');
    expect(d.value).toBe(25);
    expect((d as any).temperature).toBe(25); // computed key set
  });

  it('value is null when the domain has no catalog valueField (no fallback)', () => {
    const d = extractDeviceMetadataFromRows(
      rowsFor('g1', { deviceType: 'MEDIDOR_GAS', connectionStatus: 'online' }),
      { catalog: {}, getDomain: () => 'gas', calcStatus }
    )!;
    expect(d.domain).toBe('gas');
    expect(d.value).toBeNull();
  });

  it('returns null for empty rows', () => {
    expect(extractDeviceMetadataFromRows([], { catalog, getDomain, calcStatus })).toBeNull();
  });
});

describe('classifyAllDevices (RFC-0209)', () => {
  const profileIndex = {
    '3F_MEDIDOR': { domain: 'energy', column: 'energy-stores' },
    CHILLER: { domain: 'energy', column: 'energy-commonarea' },
  };
  const domains = [
    { code: 'energy', columns: [{ key: 'energy-stores' }, { key: 'energy-commonarea' }] },
  ];

  it('routes devices by profileIndex and pre-seeds empty columns', () => {
    const data = [
      ...rowsFor('e1', { deviceType: '3F_MEDIDOR', deviceProfile: '3F_MEDIDOR', consumption: 10, connectionStatus: 'online' }),
      ...rowsFor('e2', { deviceType: 'CHILLER', deviceProfile: 'CHILLER', consumption: 20, connectionStatus: 'online' }),
    ];
    const { byDomainColumn, unknown } = classifyAllDevices(data, { catalog, getDomain, calcStatus, profileIndex, domains });
    expect(byDomainColumn.energy['energy-stores']).toHaveLength(1);
    expect(byDomainColumn.energy['energy-commonarea']).toHaveLength(1);
    expect(unknown).toHaveLength(0);
  });

  it('puts unmapped deviceProfiles into unknown[] (never dropped silently)', () => {
    const data = rowsFor('x1', { deviceType: 'MISTERY', deviceProfile: 'MISTERY', consumption: 5, connectionStatus: 'online' });
    const { byDomainColumn, unknown } = classifyAllDevices(data, { catalog, getDomain, calcStatus, profileIndex, domains });
    expect(unknown).toHaveLength(1);
    expect(unknown[0].deviceProfile).toBe('MISTERY');
    expect(byDomainColumn.energy['energy-stores']).toHaveLength(0);
  });
});

describe('buildByStatusFromDevices (RFC-0209)', () => {
  const mk = (deviceStatus: string, value = 1) => ({ deviceStatus, value }) as any;

  it('aggregates each status bucket', () => {
    const counts = buildByStatusFromDevices([
      mk('power_on', 10),
      mk('online', 5),
      mk('power_on', 0), // online + value 0 → noConsumption
      mk('offline'),
      mk('no_info'),
      mk('waiting'),
      mk('not_installed'),
      mk('alert'),
      mk('failure'),
      mk('something_else'), // → offline (else branch)
    ]);
    expect(counts.normal).toBe(2);
    expect(counts.noConsumption).toBe(1);
    expect(counts.offline).toBe(3); // offline + no_info + else
    expect(counts.waiting).toBe(2); // waiting + not_installed
    expect(counts.alert).toBe(1);
    expect(counts.failure).toBe(1);
  });

  it('falls back to connectionStatus when deviceStatus is empty', () => {
    const counts = buildByStatusFromDevices([{ deviceStatus: '', connectionStatus: 'online', value: 3 } as any]);
    expect(counts.normal).toBe(1);
  });
});
