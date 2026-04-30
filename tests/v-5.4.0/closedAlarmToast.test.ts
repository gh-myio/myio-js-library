/**
 * RFC-0193 / RFC-0201 Phase 2 (row #25) — AC-RFC-0193-2.
 *
 * The v-5.4.0 controller registers a `myio:alarm-closed` listener that:
 *   - Reads `window.MyIOUtils.alarmNotificationsEnabled` and skips silently
 *     when it's false.
 *   - Builds a PT-BR message of the form
 *     `${alarm.title} resolvido — ${deviceLabel}` and calls
 *     `window.MyIOLibrary.MyIOToast.info(...)`.
 *   - Falls back through `event.detail.alarm.device_label` →
 *     `STATE.itemsBase.find(i => i.gcdrDeviceId === id).labelOrName` →
 *     raw `gcdrDeviceId` for the device label.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const CONTROLLER_PATH = resolve(
  __dirname,
  '../../src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js',
);

interface ToastSandbox {
  window: any;
  toastInfo: ReturnType<typeof vi.fn>;
  /** Run the controller's onInit, awaiting only the synchronous part. */
  init: () => Promise<void>;
  /** Helper to dispatch a `myio:alarm-closed` event into the sandbox. */
  fireClose: (detail: any) => void;
}

function loadController(opts: {
  alarmNotificationsEnabled?: boolean;
  itemsBase?: any[];
} = {}): ToastSandbox {
  const source = readFileSync(CONTROLLER_PATH, 'utf-8');
  const bridge = `
    ;globalThis.__runOnInit = () => self.onInit();
    ;globalThis.__fireClose = (detail) =>
       window.dispatchEvent(new CustomEvent('myio:alarm-closed', { detail }));
  `;

  const toastInfo = vi.fn();

  // Minimal fetch — the controller's `_prefetchCustomerAlarms` and
  // `fetchCredentials` are non-blocking; we only need them to not throw.
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => [
      { key: 'gcdrCustomerId', value: 'gcdr-cust' },
      { key: 'gcdrTenantId', value: 'gcdr-tenant' },
    ],
  }));

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

  // Track listeners ourselves: we WANT the controller's
  // `myio:alarm-closed` listener to be attached, so we keep `window` as a
  // real EventTarget-like object via the proxy underneath.
  const listeners: Record<string, Array<(e: any) => void>> = {};
  const mockWindow: any = {
    MyIOLibrary: {
      MyIOToast: {
        info: toastInfo,
        error: noop,
        warning: noop,
        success: noop,
        show: noop,
        hide: noop,
      },
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
    STATE: {
      itemsBase: opts.itemsBase ?? [],
    },
    MyIOOrchestrator: undefined,
    AlarmServiceOrchestrator: undefined,
    addEventListener(type: string, handler: (e: any) => void) {
      (listeners[type] ||= []).push(handler);
    },
    removeEventListener(type: string, handler: (e: any) => void) {
      listeners[type] = (listeners[type] || []).filter((h) => h !== handler);
    },
    dispatchEvent(e: any) {
      (listeners[e.type] || []).forEach((h) => h(e));
      return true;
    },
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
        customerTB_ID: 'tb-cust-1',
        defaultThemeMode: 'light',
        showOfflineAlarms: false,
        enableSyncButton: false,
        alarmNotificationsEnabled: opts.alarmNotificationsEnabled,
      },
      http: {
        getServerCredentials: () => ({ token: 'fake-jwt' }),
      },
      currentUser: { email: 'tester@example.com' },
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
    toastInfo,
    init: () => sandbox.__runOnInit(),
    fireClose: (detail: any) => sandbox.__fireClose(detail),
  };
}

describe('v-5.4.0 controller — RFC-0193 closed-alarm toast listener', () => {
  it('fires MyIOToast.info on myio:alarm-closed with default settings (enabled)', async () => {
    const sb = loadController({
      itemsBase: [
        { gcdrDeviceId: 'g1', labelOrName: 'Loja Alpha', deviceStatus: 'online' },
      ],
    });
    await sb.init();

    sb.fireClose({
      alarmId: 'a-99',
      gcdrDeviceId: 'g1',
      alarm: { title: 'Consumo elevado', gcdrDeviceId: 'g1' },
    });

    expect(sb.toastInfo).toHaveBeenCalledTimes(1);
    expect(sb.toastInfo).toHaveBeenCalledWith('Consumo elevado resolvido — Loja Alpha');
  });

  it('honors event.detail.alarm.device_label over STATE.itemsBase fallback', async () => {
    const sb = loadController({
      itemsBase: [
        { gcdrDeviceId: 'g1', labelOrName: 'Loja Alpha', deviceStatus: 'online' },
      ],
    });
    await sb.init();
    sb.fireClose({
      alarmId: 'a-1',
      gcdrDeviceId: 'g1',
      alarm: { title: 'Falha de comunicação', device_label: 'Loja Premium' },
    });
    expect(sb.toastInfo).toHaveBeenCalledWith('Falha de comunicação resolvido — Loja Premium');
  });

  it('falls back to gcdrDeviceId when neither alarm.device_label nor itemsBase has the device', async () => {
    const sb = loadController({ itemsBase: [] });
    await sb.init();
    sb.fireClose({
      alarmId: 'a-2',
      gcdrDeviceId: 'g-orphan',
      alarm: { title: 'Pico anormal' },
    });
    expect(sb.toastInfo).toHaveBeenCalledWith('Pico anormal resolvido — g-orphan');
  });

  it('uses generic "Alarme" when alarm has no title/rule/alarmType', async () => {
    const sb = loadController({
      itemsBase: [{ gcdrDeviceId: 'g1', labelOrName: 'Loja A', deviceStatus: 'online' }],
    });
    await sb.init();
    sb.fireClose({ alarmId: 'a-3', gcdrDeviceId: 'g1', alarm: {} });
    expect(sb.toastInfo).toHaveBeenCalledWith('Alarme resolvido — Loja A');
  });

  it('does NOT fire toast when alarmNotificationsEnabled = false', async () => {
    const sb = loadController({
      alarmNotificationsEnabled: false,
      itemsBase: [{ gcdrDeviceId: 'g1', labelOrName: 'Loja A', deviceStatus: 'online' }],
    });
    await sb.init();
    sb.fireClose({
      alarmId: 'a-4',
      gcdrDeviceId: 'g1',
      alarm: { title: 'X' },
    });
    expect(sb.toastInfo).not.toHaveBeenCalled();
  });
});
