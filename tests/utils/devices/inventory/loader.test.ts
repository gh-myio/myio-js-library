import { describe, it, expect } from 'vitest';
import {
  INVENTORY_SERVER_ATTRIBUTES,
  buildEntitiesQueryBody,
  isBlank,
  parseEntityRow,
  toBooleanStrict,
  toTimestamp,
} from '../../../../src/utils/devices/inventory/loader';
import { rawRow } from './fixtures';

describe('RFC-0237 loader — entitiesQuery body', () => {
  it('requests entity fields and SERVER_ATTRIBUTE keys (active/lastActivityTime are server attributes)', () => {
    const body = buildEntitiesQueryBody(2, 1000);
    expect(body.entityFilter).toEqual({ type: 'entityType', entityType: 'DEVICE' });
    expect(body.pageLink).toMatchObject({ page: 2, pageSize: 1000 });
    expect(body.entityFields.map((f) => f.key)).toEqual(['name', 'label', 'type', 'createdTime', 'ownerName', 'ownerType']);
    expect(body.entityFields.every((f) => f.type === 'ENTITY_FIELD')).toBe(true);
    expect(body.latestValues.every((k) => k.type === 'SERVER_ATTRIBUTE')).toBe(true);
    expect(body.latestValues.map((k) => k.key)).toEqual([...INVENTORY_SERVER_ATTRIBUTES]);
    expect(body.latestValues.map((k) => k.key)).toEqual(expect.arrayContaining(['active', 'lastActivityTime']));
  });
});

describe('RFC-0237 loader — value parsing (TB returns strings)', () => {
  it('isBlank covers null, empty, whitespace and the strings "null"/"undefined"', () => {
    for (const v of [null, undefined, '', '   ', 'null', 'NULL', 'undefined']) expect(isBlank(v)).toBe(true);
    for (const v of ['0', 'x', 0, false]) expect(isBlank(v)).toBe(false);
  });

  it('toBooleanStrict never uses JS truthiness ("false" is false)', () => {
    expect(toBooleanStrict('true')).toBe(true);
    expect(toBooleanStrict('false')).toBe(false);
    expect(toBooleanStrict('FALSE')).toBe(false);
    expect(toBooleanStrict('')).toBeNull();
    expect(toBooleanStrict('yes')).toBeNull();
  });

  it('toTimestamp treats 0, NaN and blank as missing', () => {
    expect(toTimestamp('1781708617523')).toBe(1781708617523);
    expect(toTimestamp('0')).toBeNull();
    expect(toTimestamp('abc')).toBeNull();
    expect(toTimestamp('')).toBeNull();
  });

  it('parses a full row and maps the customer id from the owner name', () => {
    const raw = rawRow(
      'd-1',
      { name: '3F SCSDIACCCasaAr4', label: 'CM AR 4', type: 'default', createdTime: '1761921691242', ownerName: 'Shopping da Ilha', ownerType: 'CUSTOMER' },
      { deviceProfile: 'FANCOIL', ingestionId: 'b536', gcdrDeviceId: '', active: 'false', lastActivityTime: '1791219550575', slaveId: '408' }
    );
    const d = parseEntityRow(raw, { customerIdByName: new Map([['Shopping da Ilha', 'cust-9']]) });
    expect(d).toMatchObject({
      id: 'd-1',
      name: '3F SCSDIACCCasaAr4',
      label: 'CM AR 4',
      type: 'default',
      ownerType: 'CUSTOMER',
      customerId: 'cust-9',
      deviceProfile: 'FANCOIL',
      ingestionId: 'b536',
      gcdrDeviceId: null,
      active: false,
      lastActivityTime: 1791219550575,
      slaveId: '408',
      centralId: null,
      attributesLoaded: true,
    });
  });

  it('tenant-owned devices get no customer id; missing keys become null', () => {
    const d = parseEntityRow(rawRow('d-2', { name: 'X', ownerName: 'MYIO', ownerType: 'TENANT' }, {}), {
      customerIdByName: new Map([['MYIO', 'should-not-be-used']]),
    });
    expect(d.customerId).toBeNull();
    expect(d.label).toBeNull();
    expect(d.active).toBeNull();
    expect(d.lastActivityTime).toBeNull();
  });

  it('marks attributes as not loaded when the page failed', () => {
    expect(parseEntityRow(rawRow('d-3', { name: 'Y' }, {}), { attributesLoaded: false }).attributesLoaded).toBe(false);
  });
});
