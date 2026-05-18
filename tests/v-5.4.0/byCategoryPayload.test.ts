/**
 * RFC-0201 Phase-2 / RFC-0196 — `myio:energy-summary-ready` byCategory.
 *
 * Verifies that after `processDataAndDispatchEvents` runs, the
 * `myio:energy-summary-ready` event detail includes a `byCategory`
 * field whose shape mirrors `buildEquipmentCategorySummary` (the six
 * canonical category keys + `area_comum` residual).
 *
 * Strategy mirrors `processDataAndDispatchEvents.test.ts`: load the
 * controller into a fresh vm context with mocked globals, capture
 * dispatched events, run the function, assert the payload.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const CONTROLLER_PATH = resolve(
  __dirname,
  '../../src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js'
);

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

interface CapturedEvent {
  type: string;
  detail: any;
}

interface ProcessedSandbox {
  window: any;
  events: CapturedEvent[];
  run: () => boolean;
}

function loadController(ctxData: any[]): ProcessedSandbox {
  const source = readFileSync(CONTROLLER_PATH, 'utf-8');

  // Append a bridge so we can reach the closed-over function from outside.
  const bridge = `
    ;globalThis.__processDataAndDispatchEvents = processDataAndDispatchEvents;
  `;

  const events: CapturedEvent[] = [];

  // Fake `buildEquipmentCategorySummary` mirroring the real return shape.
  // Returns the six canonical keys + `area_comum`, computed from a
  // simple sum over the seeded devices. The real implementation classifies
  // each device by deviceType/Profile/identifier; for this test the
  // controller passes us `allEnergy` (already classified by domain), so
  // we just count by deviceProfile.
  const fakeBuildEquipmentCategorySummary = (devices: any[]) => {
    const init = () => ({ devices: [] as any[], count: 0, consumption: 0, percentage: 0, subcategories: {} });
    const summary: Record<string, ReturnType<typeof init>> = {
      entrada: init(),
      lojas: init(),
      climatizacao: init(),
      elevadores: init(),
      escadas_rolantes: init(),
      outros: init(),
      area_comum: init(),
    };
    for (const d of devices || []) {
      const profile = String(d?.deviceProfile || '').toUpperCase();
      const dtype = String(d?.deviceType || '').toUpperCase();
      const value = Number(d?.value || 0);
      let cat = 'outros';
      if (['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO'].some((t) => profile.includes(t) || dtype.includes(t))) cat = 'entrada';
      else if (dtype === '3F_MEDIDOR' && profile === '3F_MEDIDOR') cat = 'lojas';
      else if (['CHILLER', 'FANCOIL', 'HVAC', 'AR_CONDICIONADO', 'BOMBA_CAG'].some((t) => profile.includes(t))) cat = 'climatizacao';
      else if (profile.includes('ELEVADOR')) cat = 'elevadores';
      else if (profile.includes('ESCADA')) cat = 'escadas_rolantes';
      summary[cat].devices.push(d);
      summary[cat].count++;
      summary[cat].consumption += value;
    }
    const entrada = summary.entrada.consumption;
    const mapped =
      summary.lojas.consumption +
      summary.climatizacao.consumption +
      summary.elevadores.consumption +
      summary.escadas_rolantes.consumption +
      summary.outros.consumption;
    summary.area_comum.consumption = Math.max(0, entrada - mapped);
    return summary;
  };

  const mockWindow: any = {
    MyIOLibrary: {
      calculateDeviceStatusMasterRules: () => 'online',
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
      buildEquipmentCategorySummary: fakeBuildEquipmentCategorySummary,
    },
    MyIOUtils: {
      temperatureLimits: { minTemperature: 18, maxTemperature: 26 },
    },
    STATE: {},
    addEventListener: () => {},
    dispatchEvent: (event: any) => {
      events.push({ type: event?.type, detail: event?.detail });
      return true;
    },
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
    events,
    run: () => sandbox.__processDataAndDispatchEvents(),
  };
}

describe('processDataAndDispatchEvents — RFC-0196 byCategory payload', () => {
  let sandbox: ProcessedSandbox;

  beforeEach(() => {
    // Seed: 1 entrada + 1 loja + 1 chiller + 1 elevador + 1 escada + 1 outros + 1 water + 1 temperature.
    // Each energy device has a distinct value so we can verify the
    // category split end-to-end.
    const rows = [
      // ENTRADA — 50
      makeRow('en-en', 'entrada', 'deviceType', 'ENTRADA'),
      makeRow('en-en', 'entrada', 'deviceProfile', 'ENTRADA'),
      makeRow('en-en', 'entrada', 'consumption', 50),
      // LOJAS — 20
      makeRow('en-lj', 'loja', 'deviceType', '3F_MEDIDOR'),
      makeRow('en-lj', 'loja', 'deviceProfile', '3F_MEDIDOR'),
      makeRow('en-lj', 'loja', 'consumption', 20),
      // CLIMATIZACAO — 10
      makeRow('en-cl', 'chiller', 'deviceType', '3F_MEDIDOR'),
      makeRow('en-cl', 'chiller', 'deviceProfile', 'CHILLER'),
      makeRow('en-cl', 'chiller', 'consumption', 10),
      // ELEVADORES — 5
      makeRow('en-elv', 'elv', 'deviceType', '3F_MEDIDOR'),
      makeRow('en-elv', 'elv', 'deviceProfile', 'ELEVADOR'),
      makeRow('en-elv', 'elv', 'consumption', 5),
      // ESCADAS — 3
      makeRow('en-esc', 'esc', 'deviceType', '3F_MEDIDOR'),
      makeRow('en-esc', 'esc', 'deviceProfile', 'ESCADA_ROLANTE'),
      makeRow('en-esc', 'esc', 'consumption', 3),
      // OUTROS — 2
      makeRow('en-out', 'out', 'deviceType', '3F_MEDIDOR'),
      makeRow('en-out', 'out', 'deviceProfile', 'BOMBA_INCENDIO'),
      makeRow('en-out', 'out', 'consumption', 2),
      // WATER (used to verify water summary doesn't claim byCategory)
      makeRow('wt-1', 'water', 'deviceType', 'HIDROMETRO'),
      makeRow('wt-1', 'water', 'pulses', 99),
    ];

    sandbox = loadController(rows);
  });

  it('emits myio:energy-summary-ready with a non-null byCategory containing the 6 canonical keys + area_comum', () => {
    sandbox.run();

    const energyEvent = sandbox.events.find((e) => e.type === 'myio:energy-summary-ready');
    expect(energyEvent).toBeDefined();
    expect(energyEvent!.detail).toBeDefined();

    // Required existing fields still present.
    expect(typeof energyEvent!.detail.totalDevices).toBe('number');
    expect(typeof energyEvent!.detail.totalConsumption).toBe('number');
    expect(energyEvent!.detail.byStatus).toBeDefined();

    // RFC-0196 — byCategory present and non-null.
    expect(energyEvent!.detail.byCategory).toBeDefined();
    expect(energyEvent!.detail.byCategory).not.toBeNull();

    const byCategory = energyEvent!.detail.byCategory;
    // Six canonical keys + area_comum residual.
    expect(byCategory).toHaveProperty('entrada');
    expect(byCategory).toHaveProperty('lojas');
    expect(byCategory).toHaveProperty('climatizacao');
    expect(byCategory).toHaveProperty('elevadores');
    expect(byCategory).toHaveProperty('escadas_rolantes');
    expect(byCategory).toHaveProperty('outros');
    expect(byCategory).toHaveProperty('area_comum');
  });

  it('byCategory consumption values reflect seeded device totals', () => {
    sandbox.run();
    const energyEvent = sandbox.events.find((e) => e.type === 'myio:energy-summary-ready');
    const byCategory = energyEvent!.detail.byCategory;

    expect(byCategory.entrada.consumption).toBe(50);
    expect(byCategory.lojas.consumption).toBe(20);
    expect(byCategory.climatizacao.consumption).toBe(10);
    expect(byCategory.elevadores.consumption).toBe(5);
    expect(byCategory.escadas_rolantes.consumption).toBe(3);
    expect(byCategory.outros.consumption).toBe(2);
    // area_comum is residual = entrada − mapped = 50 − (20+10+5+3+2) = 10.
    expect(byCategory.area_comum.consumption).toBe(10);
  });

  it('water-summary-ready does NOT include byCategory (intentional — no canonical hidrômetro split)', () => {
    sandbox.run();
    const waterEvent = sandbox.events.find((e) => e.type === 'myio:water-summary-ready');
    expect(waterEvent).toBeDefined();
    expect(waterEvent!.detail).toBeDefined();
    // byCategory is intentionally undefined for water.
    expect(waterEvent!.detail.byCategory).toBeUndefined();
  });

  it('falls back to byCategory=null when buildEquipmentCategorySummary is unavailable', () => {
    // Re-load with the helper missing.
    const source = readFileSync(CONTROLLER_PATH, 'utf-8');
    const bridge = `;globalThis.__processDataAndDispatchEvents = processDataAndDispatchEvents;`;
    const events: CapturedEvent[] = [];

    const mockWindow: any = {
      MyIOLibrary: {
        calculateDeviceStatusMasterRules: () => 'online',
        getDomainFromDeviceType: () => 'energy',
        detectContext: () => 'equipments',
        // buildEquipmentCategorySummary deliberately omitted.
      },
      MyIOUtils: { temperatureLimits: { minTemperature: 18, maxTemperature: 26 } },
      STATE: {},
      addEventListener: () => {},
      dispatchEvent: (event: any) => {
        events.push({ type: event?.type, detail: event?.detail });
        return true;
      },
      CustomEvent: globalThis.CustomEvent ?? class {
        detail: any;
        type: string;
        constructor(type: string, init?: { detail?: any }) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    };

    const mockSelf: any = {
      ctx: {
        data: [
          makeRow('en-1', 'd', 'deviceType', '3F_MEDIDOR'),
          makeRow('en-1', 'd', 'deviceProfile', '3F_MEDIDOR'),
          makeRow('en-1', 'd', 'consumption', 1),
        ],
        http: { getServerCredentials: () => null },
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

    const sb: any = {
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
    sb.globalThis = sb;

    vm.createContext(sb);
    vm.runInContext(source + bridge, sb);

    sb.__processDataAndDispatchEvents();

    const energyEvent = events.find((e) => e.type === 'myio:energy-summary-ready');
    expect(energyEvent).toBeDefined();
    // The contract: field is present, value is null, listeners must
    // tolerate the missing-helper case.
    expect(energyEvent!.detail).toHaveProperty('byCategory');
    expect(energyEvent!.detail.byCategory).toBeNull();
  });
});
