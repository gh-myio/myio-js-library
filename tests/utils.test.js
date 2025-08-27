import { describe, it, expect } from 'vitest';
import { getValueByDatakey, getValueByDatakeyLegacy, findValue } from '../src/utils/getValueByDatakey.ts';

describe('getValueByDatakey', () => {
  it('should retrieve simple property values', () => {
    const data = { temperature: 25, humidity: 60 };
    
    expect(getValueByDatakey(data, 'temperature')).toBe(25);
    expect(getValueByDatakey(data, 'humidity')).toBe(60);
    expect(getValueByDatakey(data, 'nonexistent')).toBeUndefined();
  });

  it('should retrieve nested property values', () => {
    const data = {
      sensor: {
        temperature: 25,
        location: {
          building: 'A',
          floor: 2
        }
      }
    };
    
    expect(getValueByDatakey(data, 'sensor.temperature')).toBe(25);
    expect(getValueByDatakey(data, 'sensor.location.building')).toBe('A');
    expect(getValueByDatakey(data, 'sensor.location.floor')).toBe(2);
    expect(getValueByDatakey(data, 'sensor.nonexistent')).toBeUndefined();
  });

  it('should handle array indices', () => {
    const data = {
      readings: [10, 20, 30],
      sensors: [
        { id: 1, value: 100 },
        { id: 2, value: 200 }
      ]
    };
    
    expect(getValueByDatakey(data, 'readings[0]')).toBe(10);
    expect(getValueByDatakey(data, 'readings[1]')).toBe(20);
    expect(getValueByDatakey(data, 'readings[2]')).toBe(30);
    expect(getValueByDatakey(data, 'readings[3]')).toBeUndefined();
    expect(getValueByDatakey(data, 'sensors[0].id')).toBe(1);
    expect(getValueByDatakey(data, 'sensors[1].value')).toBe(200);
  });

  it('should search in arrays of objects', () => {
    const dataArray = [
      { temperature: 25, location: 'room1' },
      { humidity: 60, location: 'room2' },
      { temperature: 22, location: 'room3' }
    ];
    
    expect(getValueByDatakey(dataArray, 'temperature')).toBe(25); // First match
    expect(getValueByDatakey(dataArray, 'humidity')).toBe(60);
    expect(getValueByDatakey(dataArray, 'location')).toBe('room1'); // First match
    expect(getValueByDatakey(dataArray, 'nonexistent')).toBeUndefined();
  });

  it('should handle edge cases', () => {
    expect(getValueByDatakey(null, 'key')).toBeUndefined();
    expect(getValueByDatakey(undefined, 'key')).toBeUndefined();
    expect(getValueByDatakey({}, '')).toBeUndefined();
    expect(getValueByDatakey({}, null)).toBeUndefined();
    expect(getValueByDatakey({ key: null }, 'key')).toBeNull();
    expect(getValueByDatakey({ key: 0 }, 'key')).toBe(0);
    expect(getValueByDatakey({ key: false }, 'key')).toBe(false);
  });

  it('should handle invalid array indices', () => {
    const data = { items: [1, 2, 3] };
    
    expect(getValueByDatakey(data, 'items[-1]')).toBeUndefined();
    expect(getValueByDatakey(data, 'items[abc]')).toBeUndefined();
    expect(getValueByDatakey(data, 'items[]')).toBeUndefined();
    expect(getValueByDatakey(data, 'nonexistent[0]')).toBeUndefined();
  });
});

describe('getValueByDatakeyLegacy', () => {
  const legacyData = [
    { dataSourceName: 'sensor1', dataKey: 'temperature', value: 25 },
    { dataSourceName: 'sensor1', dataKey: 'humidity', value: 60 },
    { dataSourceName: 'sensor2', dataKey: 'temperature', value: 22 },
    { dataSourceName: 'sensor2', dataKey: 'pressure', value: 1013 }
  ];

  it('should find values by dataSourceName and dataKey', () => {
    expect(getValueByDatakeyLegacy(legacyData, 'sensor1', 'temperature')).toBe(25);
    expect(getValueByDatakeyLegacy(legacyData, 'sensor1', 'humidity')).toBe(60);
    expect(getValueByDatakeyLegacy(legacyData, 'sensor2', 'temperature')).toBe(22);
    expect(getValueByDatakeyLegacy(legacyData, 'sensor2', 'pressure')).toBe(1013);
  });

  it('should return undefined for non-matching combinations', () => {
    expect(getValueByDatakeyLegacy(legacyData, 'sensor1', 'pressure')).toBeUndefined();
    expect(getValueByDatakeyLegacy(legacyData, 'sensor3', 'temperature')).toBeUndefined();
    expect(getValueByDatakeyLegacy(legacyData, 'sensor1', 'nonexistent')).toBeUndefined();
  });

  it('should handle edge cases', () => {
    expect(getValueByDatakeyLegacy([], 'sensor1', 'temperature')).toBeUndefined();
    expect(getValueByDatakeyLegacy(null, 'sensor1', 'temperature')).toBeUndefined();
    expect(getValueByDatakeyLegacy(legacyData, '', 'temperature')).toBeUndefined();
    expect(getValueByDatakeyLegacy(legacyData, 'sensor1', '')).toBeUndefined();
    expect(getValueByDatakeyLegacy(legacyData, null, 'temperature')).toBeUndefined();
    expect(getValueByDatakeyLegacy(legacyData, 'sensor1', null)).toBeUndefined();
  });

  it('should handle malformed data objects', () => {
    const malformedData = [
      { dataSourceName: 'sensor1', dataKey: 'temperature', value: 25 },
      null,
      { dataSourceName: 'sensor2' }, // missing dataKey
      { dataKey: 'humidity', value: 60 }, // missing dataSourceName
      { dataSourceName: 'sensor3', dataKey: 'pressure', value: 1013 }
    ];

    expect(getValueByDatakeyLegacy(malformedData, 'sensor1', 'temperature')).toBe(25);
    expect(getValueByDatakeyLegacy(malformedData, 'sensor3', 'pressure')).toBe(1013);
    expect(getValueByDatakeyLegacy(malformedData, 'sensor2', 'anything')).toBeUndefined();
  });
});

describe('findValue', () => {
  const modernData = {
    sensor: {
      temperature: 25,
      readings: [10, 20, 30]
    }
  };

  const legacyData = [
    { dataSourceName: 'sensor1', dataKey: 'temperature', value: 25 },
    { dataSourceName: 'sensor1', dataKey: 'humidity', value: 60 }
  ];

  it('should work in modern mode (path-based)', () => {
    expect(findValue(modernData, 'sensor.temperature')).toBe(25);
    expect(findValue(modernData, 'sensor.readings[1]')).toBe(20);
    expect(findValue(modernData, 'nonexistent.path')).toBeUndefined();
  });

  it('should work in legacy mode (ThingsBoard-style)', () => {
    expect(findValue(legacyData, 'sensor1', 'temperature')).toBe(25);
    expect(findValue(legacyData, 'sensor1', 'humidity')).toBe(60);
    expect(findValue(legacyData, 'sensor1', 'nonexistent')).toBeUndefined();
  });

  it('should distinguish between modern and legacy modes correctly', () => {
    // Modern mode: legacyDataKey is undefined
    expect(findValue(modernData, 'sensor.temperature')).toBe(25);
    expect(findValue(modernData, 'sensor.temperature', undefined)).toBe(25);
    
    // Legacy mode: legacyDataKey is provided (even if empty string)
    expect(findValue(legacyData, 'sensor1', '')).toBeUndefined();
    expect(findValue(legacyData, 'sensor1', 'temperature')).toBe(25);
  });

  it('should handle edge cases in both modes', () => {
    expect(findValue(null, 'path')).toBeUndefined();
    expect(findValue(null, 'source', 'key')).toBeUndefined();
    expect(findValue(modernData, '')).toBeUndefined();
    expect(findValue(legacyData, '', 'key')).toBeUndefined();
  });
});
