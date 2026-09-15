/**
 * ED-1149 / RFC-0229 §3.1 — MeasurementSetupPersister.loadSettings() dual-read
 * (GCDR `display.measurementDisplaySettings` first, TB SERVER_SCOPE fallback).
 *
 * `MeasurementSetupPersister` doesn't support fetch injection (unlike
 * `CustomerConfigApiClient`), so these tests stub `globalThis.fetch` and route
 * responses by URL: the TB attributes endpoint vs. the GCDR customer-config
 * endpoint (hit internally by `resolveConfigField`/`loadCustomerConfig`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MeasurementSetupPersister } from '../../../../src/components/premium-modals/measurement-setup/MeasurementSetupPersister';
import { DEFAULT_SETTINGS, MeasurementDisplaySettings } from '../../../../src/components/premium-modals/measurement-setup/types';

function tbResponse(settings: unknown): Response {
  const body = settings === null ? [] : [{ key: 'measurementDisplaySettings', value: JSON.stringify(settings) }];
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function gcdrConfigResponse(display: unknown): Response {
  return new Response(
    JSON.stringify({ success: true, data: { display } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

const CUSTOM_SETTINGS: MeasurementDisplaySettings = {
  version: '2.0.0',
  updatedAt: '2026-01-01T00:00:00Z',
  water: { unit: 'liters', decimalPlaces: 0, autoScale: false },
  energy: { unit: 'mwh', decimalPlaces: 2, forceUnit: true },
  temperature: { unit: 'fahrenheit', decimalPlaces: 2 },
};

let fetchMock: ReturnType<typeof vi.fn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  warnSpy.mockRestore();
  vi.restoreAllMocks();
});

describe('MeasurementSetupPersister.loadSettings — TB-only (no gcdr param, unchanged behavior)', () => {
  it('loads settings from the TB SERVER_SCOPE attribute', async () => {
    fetchMock.mockResolvedValue(tbResponse(CUSTOM_SETTINGS));
    const persister = new MeasurementSetupPersister('jwt-1', 'https://tb.example');
    const result = await persister.loadSettings('cust-tb-1');
    expect(result?.water.unit).toBe('liters');
    expect(result?.energy.decimalPlaces).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/plugins/telemetry/CUSTOMER/cust-tb-1/values/attributes/SERVER_SCOPE');
  });

  it('returns null when the TB attribute is absent', async () => {
    fetchMock.mockResolvedValue(tbResponse(null));
    const persister = new MeasurementSetupPersister('jwt-1', 'https://tb.example');
    const result = await persister.loadSettings('cust-tb-2');
    expect(result).toBeNull();
  });
});

describe('MeasurementSetupPersister.loadSettings — GCDR-first dual-read (gcdr param provided)', () => {
  it('resolves from GCDR when display.measurementDisplaySettings is present', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/config')) {
        return Promise.resolve(
          gcdrConfigResponse({ measurementDisplaySettings: CUSTOM_SETTINGS, mapInstantaneousPower: null })
        );
      }
      return Promise.resolve(tbResponse(null)); // TB has nothing — GCDR must win
    });
    const persister = new MeasurementSetupPersister('jwt-1', 'https://tb.example');
    const result = await persister.loadSettings('cust-dual-1', {
      baseUrl: 'https://gcdr.example',
      customerId: 'cust-dual-1',
      apiKey: 'gcdr_cust_ABC',
      tenantId: 'tenant-1',
    });
    expect(result?.water.unit).toBe('liters');
    expect(result?.temperature.unit).toBe('fahrenheit');
  });

  it('falls back to TB when GCDR has no usable value (display.measurementDisplaySettings absent)', async () => {
    const tbOnlySettings: MeasurementDisplaySettings = {
      ...CUSTOM_SETTINGS,
      water: { unit: 'm3', decimalPlaces: 3, autoScale: true },
    };
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/config')) return Promise.resolve(gcdrConfigResponse({ measurementDisplaySettings: null, mapInstantaneousPower: null }));
      return Promise.resolve(tbResponse(tbOnlySettings));
    });
    const persister = new MeasurementSetupPersister('jwt-1', 'https://tb.example');
    const result = await persister.loadSettings('cust-dual-2', {
      baseUrl: 'https://gcdr.example',
      customerId: 'cust-dual-2',
      apiKey: 'gcdr_cust_ABC',
    });
    expect(result?.water.unit).toBe('m3');
  });

  it('falls back to TB when GCDR is unreachable', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/config')) return Promise.reject(new TypeError('network down'));
      return Promise.resolve(tbResponse(CUSTOM_SETTINGS));
    });
    const persister = new MeasurementSetupPersister('jwt-1', 'https://tb.example');
    const result = await persister.loadSettings('cust-dual-3', {
      baseUrl: 'https://gcdr.example',
      customerId: 'cust-dual-3',
      apiKey: 'gcdr_cust_ABC',
    });
    expect(result?.water.unit).toBe('liters');
  });

  it('returns null when neither GCDR nor TB has a value', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/config')) return Promise.resolve(gcdrConfigResponse({ measurementDisplaySettings: null, mapInstantaneousPower: null }));
      return Promise.resolve(tbResponse(null));
    });
    const persister = new MeasurementSetupPersister('jwt-1', 'https://tb.example');
    const result = await persister.loadSettings('cust-dual-4', {
      baseUrl: 'https://gcdr.example',
      customerId: 'cust-dual-4',
      apiKey: 'gcdr_cust_ABC',
    });
    expect(result).toBeNull();
  });
});

describe('MeasurementSetupPersister.validateAndMergeSettings', () => {
  it('fills in missing fields with DEFAULT_SETTINGS', () => {
    const persister = new MeasurementSetupPersister('jwt-1', 'https://tb.example');
    const merged = persister.validateAndMergeSettings({ water: { unit: 'liters', decimalPlaces: 0, autoScale: false } });
    expect(merged.energy).toEqual(DEFAULT_SETTINGS.energy);
    expect(merged.water.unit).toBe('liters');
  });
});
