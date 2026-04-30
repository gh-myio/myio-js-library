/**
 * RFC-0194 / RFC-0201 Phase 2 (row #26) — AC-RFC-0194-1.
 *
 * The v-5.4.0 controller exposes the customer-wide default-dashboard config
 * via two paths:
 *   1. READ on onInit: `fetchCredentials` reads `customerDefaultDashboard`
 *      (or the override key from `settings.customerDefaultDashboardKey`)
 *      from the TB CUSTOMER SERVER_SCOPE attributes and assigns
 *      `window.MyIOOrchestrator.defaultDashboardCfg` /
 *      `defaultDashboardId`. JSON-string values are parsed transparently.
 *   2. WRITE on demand: `MyIOOrchestrator.setDefaultDashboard({ dashboardId,
 *      dashboardName })` POSTs to the TB CUSTOMER SERVER_SCOPE attribute
 *      with an audit-logged config object (version bump, changelog entry,
 *      changedBy identity), updates the in-memory copy, and dispatches
 *      `myio:default-dashboard-changed`.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const CONTROLLER_PATH = resolve(
  __dirname,
  '../../src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js',
);

interface DashSandbox {
  window: any;
  fetchCalls: Array<{ url: string; init?: any }>;
  init: () => Promise<void>;
}

function loadController(opts: {
  customerTbId?: string;
  attrShape?: 'object' | 'json-string' | 'absent' | 'custom';
  customAttrKey?: string;
  storedCfg?: unknown;
  jwt?: string | null;
  syncResponseOk?: boolean;
} = {}): DashSandbox {
  const source = readFileSync(CONTROLLER_PATH, 'utf-8');
  const bridge = `;globalThis.__runOnInit = () => self.onInit();`;

  const calls: Array<{ url: string; init?: any }> = [];
  const cfgPayload = {
    dashboardId: 'dash-prod-1',
    dashboardName: 'Production Dashboard',
    version: 3,
    updatedAt: '2026-04-01T12:00:00.000Z',
  };
  const fetchMock = vi.fn(async (url: string, init?: any) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/values/attributes/SERVER_SCOPE')) {
      const attrs: any[] = [
        { key: 'gcdrCustomerId', value: 'gcdr-cust' },
        { key: 'clientId', value: 'cid' },
        { key: 'clientSecret', value: 'csec' },
      ];
      if (opts.attrShape === 'object') {
        attrs.push({ key: 'customerDefaultDashboard', value: opts.storedCfg ?? cfgPayload });
      } else if (opts.attrShape === 'json-string') {
        attrs.push({
          key: 'customerDefaultDashboard',
          value: JSON.stringify(opts.storedCfg ?? cfgPayload),
        });
      } else if (opts.attrShape === 'custom') {
        attrs.push({ key: opts.customAttrKey || 'altKey', value: opts.storedCfg ?? cfgPayload });
      }
      return { ok: true, status: 200, json: async () => attrs };
    }
    if (init?.method === 'POST' && String(url).endsWith('/attributes/SERVER_SCOPE')) {
      return {
        ok: opts.syncResponseOk !== false,
        status: opts.syncResponseOk === false ? 500 : 200,
        text: async () => (opts.syncResponseOk === false ? 'server error' : ''),
        json: async () => ({}),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });

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

  const dispatched: any[] = [];
  const listeners: Record<string, Array<(e: any) => void>> = {};
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
      createBaseComponent: noopComponent,
    },
    MyIOUtils: {},
    STATE: { itemsBase: [] },
    MyIOOrchestrator: undefined,
    AlarmServiceOrchestrator: undefined,
    addEventListener(t: string, h: (e: any) => void) {
      (listeners[t] ||= []).push(h);
    },
    removeEventListener(t: string, h: (e: any) => void) {
      listeners[t] = (listeners[t] || []).filter((f) => f !== h);
    },
    dispatchEvent(e: any) {
      dispatched.push(e);
      (listeners[e.type] || []).forEach((h) => h(e));
      return true;
    },
    setTimeout,
    clearTimeout,
    CustomEvent: class {
      type: string;
      detail: any;
      constructor(t: string, init?: { detail?: any }) {
        this.type = t;
        this.detail = init?.detail;
      }
    },
    __dispatched: dispatched,
  };

  const mockSelf: any = {
    ctx: {
      data: [],
      settings: {
        customerTB_ID: opts.customerTbId ?? 'tb-cust-99',
        defaultThemeMode: 'light',
        showOfflineAlarms: false,
        enableSyncButton: false,
        customerDefaultDashboardKey:
          opts.attrShape === 'custom' ? (opts.customAttrKey || '') : '',
      },
      http: {
        getServerCredentials: () =>
          opts.jwt === null ? null : { token: opts.jwt ?? 'fake-jwt-token' },
      },
      currentUser: {
        id: 'usr-007',
        name: 'Tester',
        email: 'tester@example.com',
      },
    },
  };

  const sandbox: any = {
    window: mockWindow,
    self: mockSelf,
    document: {
      addEventListener: noop,
      removeEventListener: noop,
      createElement: () => ({ style: {}, appendChild: noop, setAttribute: noop }),
      head: { appendChild: noop },
      body: { appendChild: noop, style: {} },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      readyState: 'complete',
      documentElement: { style: {} },
    },
    MyIOLibrary: mockWindow.MyIOLibrary,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    CustomEvent: mockWindow.CustomEvent,
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
    fetchCalls: calls,
    init: () => sandbox.__runOnInit(),
  };
}

describe('v-5.4.0 controller — RFC-0194 customer default dashboard', () => {
  describe('READ path — fetchCredentials', () => {
    it('exposes defaultDashboardCfg + defaultDashboardId when attr is an object', async () => {
      const sb = loadController({ attrShape: 'object' });
      await sb.init();
      const orch = sb.window.MyIOOrchestrator;
      expect(orch.defaultDashboardId).toBe('dash-prod-1');
      expect(orch.defaultDashboardCfg).toMatchObject({
        dashboardId: 'dash-prod-1',
        dashboardName: 'Production Dashboard',
      });
    });

    it('parses JSON-string attribute values transparently', async () => {
      const sb = loadController({ attrShape: 'json-string' });
      await sb.init();
      expect(sb.window.MyIOOrchestrator.defaultDashboardId).toBe('dash-prod-1');
    });

    it('honors the customerDefaultDashboardKey override', async () => {
      const sb = loadController({
        attrShape: 'custom',
        customAttrKey: 'tenant_default_dashboard_v2',
      });
      await sb.init();
      expect(sb.window.MyIOOrchestrator.defaultDashboardId).toBe('dash-prod-1');
    });

    it('exposes null cfg + null id when attribute is absent', async () => {
      const sb = loadController({ attrShape: 'absent' });
      await sb.init();
      expect(sb.window.MyIOOrchestrator.defaultDashboardCfg).toBeNull();
      expect(sb.window.MyIOOrchestrator.defaultDashboardId).toBeNull();
    });
  });

  describe('WRITE path — setDefaultDashboard()', () => {
    it('rejects with a clear error when dashboardId is missing', async () => {
      const sb = loadController({ attrShape: 'object' });
      await sb.init();
      await expect(
        sb.window.MyIOOrchestrator.setDefaultDashboard({ dashboardName: 'X' } as any),
      ).rejects.toThrow(/dashboardId required/);
    });

    it('rejects when JWT is unavailable', async () => {
      const sb = loadController({ attrShape: 'object', jwt: null });
      await sb.init();
      await expect(
        sb.window.MyIOOrchestrator.setDefaultDashboard({
          dashboardId: 'd1',
          dashboardName: 'D1',
        }),
      ).rejects.toThrow(/no JWT/);
    });

    it('POSTs to the TB CUSTOMER SERVER_SCOPE with a versioned + changelog payload', async () => {
      const sb = loadController({ attrShape: 'object' });
      await sb.init();
      const result = await sb.window.MyIOOrchestrator.setDefaultDashboard({
        dashboardId: 'dash-new',
        dashboardName: 'New Dashboard',
      });

      const post = sb.fetchCalls.find(
        (c) => c.init?.method === 'POST' && c.url.endsWith('/attributes/SERVER_SCOPE'),
      );
      expect(post).toBeDefined();
      expect(post!.url).toMatch(/\/api\/plugins\/telemetry\/CUSTOMER\/tb-cust-99\/attributes\/SERVER_SCOPE$/);
      expect(post!.init.headers['X-Authorization']).toBe('Bearer fake-jwt-token');
      const body = JSON.parse(post!.init.body);
      expect(body.customerDefaultDashboard).toBeDefined();
      const newCfg = body.customerDefaultDashboard;
      expect(newCfg.dashboardId).toBe('dash-new');
      expect(newCfg.dashboardName).toBe('New Dashboard');
      // Version monotonically increments past the previous (3 → 4).
      expect(newCfg.version).toBe(4);
      // Changelog: latest entry first; previous + next + changedBy populated.
      expect(Array.isArray(newCfg.changelog)).toBe(true);
      expect(newCfg.changelog[0].next.dashboardId).toBe('dash-new');
      expect(newCfg.changelog[0].previous.dashboardId).toBe('dash-prod-1');
      expect(newCfg.changelog[0].changedBy.email).toBe('tester@example.com');
      expect(newCfg.changelog[0].version).toBe(4);

      // Caller gets the new cfg back.
      expect(result.dashboardId).toBe('dash-new');

      // In-memory mirror updated; event dispatched.
      expect(sb.window.MyIOOrchestrator.defaultDashboardId).toBe('dash-new');
      const event = (sb.window.__dispatched as any[]).find(
        (e) => e.type === 'myio:default-dashboard-changed',
      );
      expect(event).toBeDefined();
      expect(event.detail.newCfg.dashboardId).toBe('dash-new');
    });

    it('writes to the override attribute key when set', async () => {
      const sb = loadController({
        attrShape: 'custom',
        customAttrKey: 'tenant_default_dashboard_v2',
      });
      await sb.init();
      await sb.window.MyIOOrchestrator.setDefaultDashboard({
        dashboardId: 'dash-x',
        dashboardName: 'X',
      });
      const post = sb.fetchCalls.find(
        (c) => c.init?.method === 'POST' && c.url.endsWith('/attributes/SERVER_SCOPE'),
      );
      const body = JSON.parse(post!.init.body);
      expect(body.tenant_default_dashboard_v2).toBeDefined();
      expect(body.customerDefaultDashboard).toBeUndefined();
    });

    it('rejects when the TB POST returns a non-OK status', async () => {
      const sb = loadController({ attrShape: 'object', syncResponseOk: false });
      await sb.init();
      await expect(
        sb.window.MyIOOrchestrator.setDefaultDashboard({
          dashboardId: 'dash-fail',
          dashboardName: 'F',
        }),
      ).rejects.toThrow(/HTTP 500/);
    });
  });
});
