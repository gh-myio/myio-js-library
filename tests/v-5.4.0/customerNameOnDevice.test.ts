/**
 * RFC-0201 Phase 2 (row #27) — AC-Pod-K-1.
 *
 * `extractDeviceMetadataFromRows` MUST stamp `customerName` on every device
 * it builds, sourced from `self.ctx.dashboard.title` (or the first
 * datasource.name when the dashboard has no title). This is the input
 * the export pipeline (`exportGridCsv/Xls/Pdf`) reads to produce the
 * customer-prefixed filename and the PDF cover/header.
 *
 * Strategy: load the controller in a vm sandbox with stubbed `self.ctx`
 * variations and call the internal `extractDeviceMetadataFromRows` fn via
 * a bridge that exports it onto globalThis at parse time.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const CONTROLLER_PATH = resolve(
  __dirname,
  '../../src/thingsboard/main-dashboard-shopping/v-5.4.0/controller.js',
);

function loadExtract(opts: {
  dashboardTitle?: string;
  datasourceName?: string;
  ownerName?: string;
}) {
  const source = readFileSync(CONTROLLER_PATH, 'utf-8');
  // The controller defines `extractDeviceMetadataFromRows` at module scope
  // but doesn't export it. We bridge it by appending an assignment at the
  // bottom of the source — when the module is parsed, the function name
  // is already bound.
  const bridge = `;globalThis.__extract = extractDeviceMetadataFromRows;`;

  const ds: any = {};
  if (opts.datasourceName) ds.name = opts.datasourceName;
  ds.entityId = 'entity-A';
  ds.entityName = 'Device-A';
  ds.entityLabel = 'Device-A';

  const noop = () => undefined;
  const sandbox: any = {
    window: {
      MyIOLibrary: {
        calculateDeviceStatusMasterRules: () => 'online',
        getDomainFromDeviceType: () => 'energy',
        detectContext: () => 'equipments',
        MyIOToast: { error: noop, info: noop, success: noop, warning: noop, show: noop, hide: noop },
      },
      MyIOUtils: {},
      STATE: {},
      addEventListener: noop,
      dispatchEvent: () => true,
      setTimeout,
      clearTimeout,
      CustomEvent: class {},
    },
    self: {
      ctx: {
        dashboard: opts.dashboardTitle ? { title: opts.dashboardTitle } : null,
        datasources: opts.datasourceName ? [ds] : [],
        settings: {},
        http: { getServerCredentials: () => null },
      },
    },
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
    MyIOLibrary: undefined,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    CustomEvent: class {},
    console,
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    globalThis: {} as any,
  };
  sandbox.MyIOLibrary = sandbox.window.MyIOLibrary;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(source + bridge, sandbox);

  // Build a minimal `rows` array shaped like what TB datasources produce.
  const tsKey = (label: string) => ({
    dataKey: { label, name: label },
    data: [[Date.now(), '42']],
    datasource: ds,
  });
  const rows = [
    tsKey('consumption'),
    {
      dataKey: { label: 'deviceType', name: 'deviceType' },
      data: [[Date.now(), '3F_MEDIDOR']],
      datasource: ds,
    },
    {
      dataKey: { label: 'ownerName', name: 'ownerName' },
      data: [[Date.now(), opts.ownerName ?? '']],
      datasource: ds,
    },
  ];
  return sandbox.__extract(rows);
}

describe('extractDeviceMetadataFromRows — RFC-0201 Phase 2 customerName', () => {
  it('uses self.ctx.dashboard.title when present', () => {
    const device = loadExtract({ dashboardTitle: 'Shopping Iguatemi' });
    expect(device.customerName).toBe('Shopping Iguatemi');
  });

  it('falls back to first datasource.name when dashboard title is empty', () => {
    const device = loadExtract({ datasourceName: 'Customer Vila Velha' });
    expect(device.customerName).toBe('Customer Vila Velha');
  });

  it('falls back to ownerName attribute when neither dashboard title nor datasource.name is set', () => {
    const device = loadExtract({ ownerName: 'Cliente Demo' });
    expect(device.customerName).toBe('Cliente Demo');
  });

  it('returns empty string when no source provides a customer name', () => {
    const device = loadExtract({});
    expect(device.customerName).toBe('');
  });

  it('trims whitespace from the dashboard title before stamping', () => {
    const device = loadExtract({ dashboardTitle: '   Mall Recife   ' });
    expect(device.customerName).toBe('Mall Recife');
  });
});
