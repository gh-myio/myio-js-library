import { describe, it, expect } from 'vitest';
import { addNamespace } from '../src/utils/namespace.js';

describe('addNamespace', () => {
  it('should add namespace to object keys', () => {
    const payload = { temperature: 22, humidity: 65 };
    const namespace = 'Building A';
    const expected = {
      'temperature (Building A)': 22,
      'humidity (Building A)': 65
    };
    
    const result = addNamespace(payload, namespace);
    expect(result).toEqual(expected);
  });

  it('should handle empty namespace', () => {
    const payload = { temperature: 22, humidity: 65 };
    const namespace = '';
    const expected = { temperature: 22, humidity: 65 };
    
    const result = addNamespace(payload, namespace);
    expect(result).toEqual(expected);
  });

  it('should handle undefined namespace', () => {
    const payload = { temperature: 22, humidity: 65 };
    const expected = { temperature: 22, humidity: 65 };
    
    const result = addNamespace(payload);
    expect(result).toEqual(expected);
  });

  it('should handle namespace with whitespace', () => {
    const payload = { temperature: 22 };
    const namespace = '  Building A  ';
    const expected = { 'temperature (Building A)': 22 };
    
    const result = addNamespace(payload, namespace);
    expect(result).toEqual(expected);
  });

  it('should handle empty object', () => {
    const payload = {};
    const namespace = 'Building A';
    const expected = {};
    
    const result = addNamespace(payload, namespace);
    expect(result).toEqual(expected);
  });

  it('should handle complex object values', () => {
    const payload = {
      sensor: { value: 22, unit: 'C' },
      status: 'active',
      readings: [1, 2, 3]
    };
    const namespace = 'Floor 1';
    const expected = {
      'sensor (Floor 1)': { value: 22, unit: 'C' },
      'status (Floor 1)': 'active',
      'readings (Floor 1)': [1, 2, 3]
    };
    
    const result = addNamespace(payload, namespace);
    expect(result).toEqual(expected);
  });

  it('should throw error for null payload', () => {
    expect(() => addNamespace(null, 'namespace')).toThrow('Payload must be an object.');
  });

  it('should throw error for undefined payload', () => {
    expect(() => addNamespace(undefined, 'namespace')).toThrow('Payload must be an object.');
  });

  it('should throw error for non-object payload', () => {
    expect(() => addNamespace('not an object', 'namespace')).toThrow('Payload must be an object.');
    expect(() => addNamespace(123, 'namespace')).toThrow('Payload must be an object.');
    expect(() => addNamespace([], 'namespace')).toThrow('Payload must be an object.');
  });

  it('should not modify original object', () => {
    const payload = { temperature: 22, humidity: 65 };
    const originalPayload = { ...payload };
    const namespace = 'Building A';
    
    addNamespace(payload, namespace);
    
    expect(payload).toEqual(originalPayload);
  });

  it('should handle special characters in namespace', () => {
    const payload = { temperature: 22 };
    const namespace = 'Building A & B (Main)';
    const expected = { 'temperature (Building A & B (Main))': 22 };
    
    const result = addNamespace(payload, namespace);
    expect(result).toEqual(expected);
  });
});
