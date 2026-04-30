/**
 * RFC-0201 Phase-1 (Pod F0) — AC-Fix-gcdrDeviceId-2
 *
 * Verifies that after `processDataAndDispatchEvents` runs against a
 * classified set of `ctx.data` rows, `window.STATE.itemsBase` exists
 * as a flat array of every device, each with a `gcdrDeviceId` field
 * (possibly null).
 *
 * Strategy: load `controller.js` source, expose its inner functions
 * via a tiny shim, eval it with a mocked `self.ctx`, then invoke
 * `processDataAndDispatchEvents()` directly. This is option (b) from
 * the directive — required because `processDataAndDispatchEvents` is
 * not exported (lives inside the global-script controller).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const CONTROLLER_PATH = resolve(
  __dirname,
  '../../src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js'
);

/** Build a TB-shaped row helper for a given (entityId, dataKey, value). */
function makeRow(
  entityId: string,
  entityName: string,
  keyName: string,
  value: any,
  ts = 1714400000000,
  aliasName = 'AllDevices'
) {
  return {
    datasource: { entityId, entityName, entityLabel: entityName, aliasName },
    dataKey: { name: keyName },
    data: [[ts, value]],
  };
}

interface ProcessedSandbox {
  window: any;
  self: any;
  /** Invokes the controller's `processDataAndDispatchEvents`. */
  run: () => boolean;
}

/**
 * Load controller.js into a fresh vm context with mocked globals.
 * We append a small bridge that re-exports the inner function we need.
 */
function loadController(ctxData: any[]): ProcessedSandbox {
  const source = readFileSync(CONTROLLER_PATH, 'utf-8');

  // Append a bridge so we can reach the closed-over function from outside.
  const bridge = `
    ;globalThis.__processDataAndDispatchEvents = processDataAndDispatchEvents;
  `;

  // Minimal MyIOLibrary stub — only what `extractDeviceMetadataFromRows`
  // and `classifyAllDevices` reach for. Domain detection in
  // `extractDeviceMetadataFromRows` already works without the stub
  // (string-based on deviceType), so we can safely return undefined for
  // unknown helpers.
  const mockWindow: any = {
    MyIOLibrary: {
      calculateDeviceStatusMasterRules: () => 'online',
      // Mirror the real RFC-0111 helpers just enough to get devices into
      // valid (domain, context) buckets. `classifyAllDevices` discards
      // any device whose `classified[domain][context]` slot is undefined.
      getDomainFromDeviceType: (deviceType: string) => {
        const t = String(deviceType || '').toUpperCase();
        if (t.includes('HIDROMETRO')) return 'water';
        if (t.includes('TERMOSTATO')) return 'temperature';
        return 'energy';
      },
      detectContext: (_device: any, domain: string) => {
        if (domain === 'water') return 'hidrometro';
        if (domain === 'temperature') return 'termostato';
        return 'equipments';
      },
    },
    MyIOUtils: {
      temperatureLimits: { minTemperature: 18, maxTemperature: 26 },
    },
    STATE: {},
    addEventListener: () => {},
    dispatchEvent: () => true,
    CustomEvent: globalThis.CustomEvent ?? class {
      detail: any;
      type: string;
      constructor(type: string, init?: { detail?: any }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  };

  const mockSelf: any = {
    ctx: { data: ctxData, http: { getServerCredentials: () => null } },
  };

  // Polyfill CustomEvent inside the vm context (controller.js uses
  // `new CustomEvent(...)` as a free identifier, not `window.CustomEvent`).
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
    document: { addEventListener: () => {} },
    MyIOLibrary: mockWindow.MyIOLibrary,
    localStorage: mockWindow.localStorage,
    CustomEvent: SandboxCustomEvent,
    console,
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: false, status: 0, json: async () => ({}) }),
    globalThis: {} as any,
  };
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(source + bridge, sandbox);

  return {
    window: mockWindow,
    self: mockSelf,
    run: () => sandbox.__processDataAndDispatchEvents(),
  };
}

describe('processDataAndDispatchEvents — RFC-0201 STATE.itemsBase', () => {
  let sandbox: ProcessedSandbox;

  beforeEach(() => {
    // 3 devices: one energy (with gcdrDeviceId), one water (with lowercase
    // gcdrdeviceid), one temperature (no gcdr mapping).
    const rows = [
      // Energy — 3F_MEDIDOR
      makeRow('en-1', 'energy-loja', 'deviceType', '3F_MEDIDOR'),
      makeRow('en-1', 'energy-loja', 'deviceProfile', '3F_MEDIDOR'),
      makeRow('en-1', 'energy-loja', 'identifier', 'LJ-001'),
      makeRow('en-1', 'energy-loja', 'gcdrDeviceId', 'gcdr-en-1'),
      makeRow('en-1', 'energy-loja', 'consumption', 123.45),
      // Water — HIDROMETRO with lowercase key
      makeRow('wt-1', 'water-banho', 'deviceType', 'HIDROMETRO'),
      makeRow('wt-1', 'water-banho', 'identifier', 'HD-001'),
      makeRow('wt-1', 'water-banho', 'gcdrdeviceid', 'gcdr-wt-1'),
      makeRow('wt-1', 'water-banho', 'pulses', 99),
      // Temperature — TERMOSTATO without gcdrDeviceId
      makeRow('tm-1', 'temp-loja', 'deviceType', 'TERMOSTATO'),
      makeRow('tm-1', 'temp-loja', 'identifier', 'TM-001'),
      makeRow('tm-1', 'temp-loja', 'temperature', 22.5),
    ];

    sandbox = loadController(rows);
  });

  it('exposes window.STATE.itemsBase as a flat array of all devices', () => {
    const ok = sandbox.run();
    expect(ok).toBe(true);

    const itemsBase = sandbox.window.STATE.itemsBase;
    expect(Array.isArray(itemsBase)).toBe(true);
    expect(itemsBase.length).toBe(3);

    const ids = itemsBase.map((it: any) => it.entityId).sort();
    expect(ids).toEqual(['en-1', 'tm-1', 'wt-1']);
  });

  it('every item in STATE.itemsBase has a gcdrDeviceId field (possibly null)', () => {
    sandbox.run();
    const itemsBase = sandbox.window.STATE.itemsBase;

    for (const item of itemsBase) {
      expect(item).toHaveProperty('gcdrDeviceId');
    }
  });

  it('preserves the gcdrDeviceId values across both case variants', () => {
    sandbox.run();
    const byEntity: Record<string, any> = Object.fromEntries(
      sandbox.window.STATE.itemsBase.map((it: any) => [it.entityId, it])
    );

    expect(byEntity['en-1'].gcdrDeviceId).toBe('gcdr-en-1');
    expect(byEntity['wt-1'].gcdrDeviceId).toBe('gcdr-wt-1');
    expect(byEntity['tm-1'].gcdrDeviceId).toBeNull();
  });
});
