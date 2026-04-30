/**
 * RFC-0195 / RFC-0201 Phase-2 (Pod G) — AC-RFC-0195-1.
 *
 * Verifies that `window.MyIOOrchestrator.syncDevice(entityId)`:
 *   - Throws a clear error if `entityId` is missing.
 *   - Throws if no JWT (TB token) is reachable.
 *   - Reads `integration_setup.gcdr` from the customer's SERVER_SCOPE
 *     (matching v-5.2.0 `_fetchGcdrCredentials`).
 *   - POSTs a one-row device-map to
 *     `${gcdrApiBaseUrl}/api/v1/device-sync/jobs` with the
 *     `X-API-Key` header and the documented JSON body shape.
 *   - Returns the parsed response on success and rejects on a
 *     non-OK HTTP status.
 *
 * Strategy: load `controller.js` into a vm sandbox, run `onInit` against
 * a stubbed `self.ctx` whose `getServerCredentials` returns a fake JWT
 * and whose `data` array is empty. Then drive the resulting orchestrator
 * stub from outside.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const CONTROLLER_PATH = resolve(
  __dirname,
  '../../src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js'
);

interface SyncSandbox {
  window: any;
  self: any;
  fetchMock: ReturnType<typeof vi.fn>;
  /** Run `onInit` to populate `window.MyIOOrchestrator`. */
  init: () => Promise<void>;
}

/** Build a sandbox where `onInit` can run without throwing. */
function loadController(opts: {
  customerTbId?: string;
  gcdrCustomerId?: string;
  gcdrApiBaseUrl?: string;
  jwt?: string | null;
  fetchImpl?: (url: string, init?: any) => Promise<any>;
}): SyncSandbox {
  const source = readFileSync(CONTROLLER_PATH, 'utf-8');

  // We append a bridge to expose onInit so we can await it from outside.
  // The controller is a global-script, so its `self.onInit` is the natural
  // entry point.
  const bridge = `;globalThis.__runOnInit = () => self.onInit();`;

  const jwt = opts.jwt === undefined ? 'fake-jwt-token' : opts.jwt;

  // Mock fetch — for `fetchCredentials` (initial onInit call to get
  // SERVER_SCOPE) we return an attrs payload that mirrors what
  // syncDevice will also need. We give a separate fetchImpl override so
  // tests can intercept the syncDevice POST specifically.
  const defaultFetch = vi.fn(async (url: string, _init?: any) => {
    const u = String(url);
    if (u.includes('/values/attributes/SERVER_SCOPE')) {
      // Return an attrs array that satisfies fetchCredentials *and*
      // syncDevice's integration_setup.gcdr lookup.
      return {
        ok: true,
        status: 200,
        json: async () => [
          { key: 'clientId', value: 'cid' },
          { key: 'clientSecret', value: 'csec' },
          { key: 'customerId', value: 'ingest-1' },
          { key: 'gcdrCustomerId', value: opts.gcdrCustomerId ?? 'gcdr-cust' },
          { key: 'gcdrTenantId', value: 'gcdr-tenant' },
          {
            key: 'integration_setup',
            value: {
              gcdr: {
                gcdrCustomerId: opts.gcdrCustomerId ?? 'gcdr-cust',
                gcdrApiKey: 'gcdr-api-key-stub',
              },
            },
          },
        ],
      };
    }
    if (u.includes('/api/auth/user')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ email: 'tester@example.com' }),
      };
    }
    // Default: empty success.
    return { ok: true, status: 200, json: async () => ({}) };
  });

  const fetchMock = opts.fetchImpl
    ? vi.fn(opts.fetchImpl as any)
    : defaultFetch;

  // MyIOLibrary stub — onInit calls into a few helpers; we provide just
  // enough to keep the import surface non-throwing. None of these are on
  // the syncDevice code path.
  const noop = () => undefined;
  const noopComponent = () => ({
    setEnergyData: noop,
    setWaterData: noop,
    update: noop,
    destroy: noop,
    getElement: () => ({}),
    setActiveTab: noop,
    setSelected: noop,
    setKpis: noop,
    setShoppings: noop,
    updateUserInfo: noop,
    refresh: noop,
    on: noop,
    off: noop,
    show: noop,
    hide: noop,
  });

  const mockWindow: any = {
    MyIOLibrary: {
      MyIOToast: { info: noop, error: noop, warning: noop, success: noop, show: noop, hide: noop },
      calculateDeviceStatusMasterRules: () => 'online',
      getDomainFromDeviceType: () => 'energy',
      detectContext: () => 'equipments',
      createHeaderShoppingComponent: noopComponent,
      createMenuShoppingComponent: noopComponent,
      createTelemetryGridShoppingComponent: noopComponent,
      createTelemetryInfoShoppingComponent: noopComponent,
      createFooterComponent: noopComponent,
      createAlarmServiceOrchestrator: noop,
      buildEquipmentCategorySummary: () => ({ byCategory: {} }),
      // Newer dependencies referenced by createComponents in some paths
      createBaseComponent: noopComponent,
    },
    MyIOUtils: {},
    STATE: {},
    MyIOOrchestrator: undefined,
    AlarmServiceOrchestrator: undefined,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    setTimeout,
    clearTimeout,
    CustomEvent: class {
      type: string;
      detail: any;
      constructor(type: string, init?: { detail?: any }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
  };

  const mockSelf: any = {
    ctx: {
      data: [],
      settings: {
        customerTB_ID: opts.customerTbId ?? 'tb-customer-1',
        gcdrCustomerId: opts.gcdrCustomerId ?? '',
        gcdrApiBaseUrl: opts.gcdrApiBaseUrl ?? 'https://gcdr-api.test.com',
        defaultThemeMode: 'light',
        showOfflineAlarms: false,
        enableSyncButton: false,
      },
      http: {
        getServerCredentials: () => (jwt ? { token: jwt } : null),
      },
      currentUser: { email: 'tester@example.com' },
    },
  };

  class SandboxCustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  const sandbox: any = {
    window: mockWindow,
    self: mockSelf,
    document: {
      addEventListener: noop,
      removeEventListener: noop,
      createElement: () => ({
        style: {},
        appendChild: noop,
        setAttribute: noop,
      }),
      head: { appendChild: noop },
      body: { appendChild: noop, style: {} },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [], // applyBackgroundToPage iterates over the result
      readyState: 'complete',
      documentElement: { style: {} },
    },
    MyIOLibrary: mockWindow.MyIOLibrary,
    localStorage: {
      getItem: () => null,
      setItem: noop,
      removeItem: noop,
    },
    CustomEvent: SandboxCustomEvent,
    console,
    setTimeout,
    clearTimeout,
    fetch: fetchMock,
    globalThis: {} as any,
  };
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(source + bridge, sandbox);

  return {
    window: mockWindow,
    self: mockSelf,
    fetchMock,
    init: () => sandbox.__runOnInit(),
  };
}

describe('MyIOOrchestrator.syncDevice — RFC-0195 / RFC-0201 Phase 2', () => {
  let sandbox: SyncSandbox;

  beforeEach(async () => {
    sandbox = loadController({
      customerTbId: 'tb-cust-99',
      gcdrCustomerId: 'gcdr-cust',
      gcdrApiBaseUrl: 'https://gcdr-api.test.com',
    });
    // Run onInit to populate the orchestrator stub. We don't await full
    // alarm prefetch / component creation — those run async/non-blocking
    // and we only care that `MyIOOrchestrator.syncDevice` is exposed
    // synchronously after the stub assignment.
    await sandbox.init();
  });

  it('exposes window.MyIOOrchestrator.syncDevice after onInit', () => {
    expect(typeof sandbox.window.MyIOOrchestrator?.syncDevice).toBe('function');
  });

  it('rejects when entityId is missing', async () => {
    await expect(
      sandbox.window.MyIOOrchestrator.syncDevice('')
    ).rejects.toThrow(/entityId required/);
  });

  it('POSTs to {gcdrApiBaseUrl}/api/v1/device-sync/jobs with X-API-Key', async () => {
    const calls: Array<{ url: string; init: any }> = [];
    const sb = loadController({
      customerTbId: 'tb-cust-99',
      gcdrCustomerId: 'gcdr-cust',
      gcdrApiBaseUrl: 'https://gcdr-api.test.com',
      fetchImpl: async (url: string, init?: any) => {
        calls.push({ url: String(url), init });
        if (String(url).includes('/values/attributes/SERVER_SCOPE')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { key: 'clientId', value: 'cid' },
              { key: 'clientSecret', value: 'csec' },
              { key: 'customerId', value: 'ingest-1' },
              { key: 'gcdrCustomerId', value: 'gcdr-cust' },
              {
                key: 'integration_setup',
                value: { gcdr: { gcdrCustomerId: 'gcdr-cust', gcdrApiKey: 'KEY-XYZ' } },
              },
            ],
          };
        }
        if (String(url).includes('/api/v1/device-sync/jobs')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: { jobId: 'job-42' } }),
          };
        }
        if (String(url).includes('/api/auth/user')) {
          return { ok: true, status: 200, json: async () => ({ email: 't@e.com' }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    });
    await sb.init();

    const result = await sb.window.MyIOOrchestrator.syncDevice('entity-123');

    // Find the device-sync POST among captured calls.
    const syncCall = calls.find((c) => c.url.includes('/api/v1/device-sync/jobs'));
    expect(syncCall).toBeDefined();
    expect(syncCall!.url).toBe('https://gcdr-api.test.com/api/v1/device-sync/jobs');
    expect(syncCall!.init.method).toBe('POST');
    expect(syncCall!.init.headers['X-API-Key']).toBe('KEY-XYZ');
    expect(syncCall!.init.headers['Content-Type']).toBe('application/json');

    // Body must include customerId + a single-file device-map for the entity.
    const body = JSON.parse(syncCall!.init.body);
    expect(body.customerId).toBe('gcdr-cust');
    expect(body.dryRun).toBe(false);
    expect(Array.isArray(body.files)).toBe(true);
    expect(body.files).toHaveLength(1);
    expect(body.files[0].name).toBe('single-entity-123');
    expect(body.files[0].content).toMatch(/^tbId\|deviceName\|/);
    expect(body.files[0].content).toContain('entity-123');

    // Success → returns parsed JSON.
    expect(result).toEqual({ data: { jobId: 'job-42' } });
  });

  it('rejects when the device-sync POST returns a non-OK status', async () => {
    const sb = loadController({
      customerTbId: 'tb-cust-99',
      gcdrCustomerId: 'gcdr-cust',
      gcdrApiBaseUrl: 'https://gcdr-api.test.com',
      fetchImpl: async (url: string, _init?: any) => {
        if (String(url).includes('/values/attributes/SERVER_SCOPE')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { key: 'clientId', value: 'cid' },
              { key: 'clientSecret', value: 'csec' },
              { key: 'customerId', value: 'ingest-1' },
              { key: 'gcdrCustomerId', value: 'gcdr-cust' },
              {
                key: 'integration_setup',
                value: { gcdr: { gcdrCustomerId: 'gcdr-cust', gcdrApiKey: 'KEY-XYZ' } },
              },
            ],
          };
        }
        if (String(url).includes('/api/v1/device-sync/jobs')) {
          return {
            ok: false,
            status: 500,
            text: async () => 'internal error',
            json: async () => ({ error: 'internal' }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      },
    });
    await sb.init();

    await expect(
      sb.window.MyIOOrchestrator.syncDevice('entity-fail')
    ).rejects.toThrow(/HTTP 500/);
  });

  it('rejects when JWT is unavailable', async () => {
    const sb = loadController({
      customerTbId: 'tb-cust-99',
      gcdrCustomerId: 'gcdr-cust',
      gcdrApiBaseUrl: 'https://gcdr-api.test.com',
      jwt: null,
    });
    await sb.init();

    await expect(
      sb.window.MyIOOrchestrator.syncDevice('entity-x')
    ).rejects.toThrow(/no JWT/);
  });
});
