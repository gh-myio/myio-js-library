/**
 * RFC-0241 — Shopping v-5.2.0 wiring (MAIN_VIEW owner / MENU consumer).
 *
 * The MAIN_VIEW controller is a ThingsBoard widget script (not importable), so
 * the RFC-0241 block — delimited by its start/end comments — is extracted from
 * the source and evaluated with stubbed collaborators. This exercises the real
 * code of `_computeCanManageGoalsTariffs` and `MyIOUtils.openGoalsTariffs`.
 *
 * Covers AC-01..AC-04 (gate), AC-06 (MENU never touches MyIOLibrary / creds in the
 * hub wiring), AC-07 (goals editor + refresh + myio:goals-updated), AC-08 wiring
 * (pricing panel always with tariffApi, caller-asserted `allowed`), AC-09 (missing
 * credentials → toast, no modal). No real HTTP: every lib call is a spy.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WIDGET_DIR = resolve(process.cwd(), 'src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET');
const MAIN_SRC = readFileSync(resolve(WIDGET_DIR, 'MAIN_VIEW/controller.js'), 'utf8');
const MENU_SRC = readFileSync(resolve(WIDGET_DIR, 'MENU/controller.js'), 'utf8');

function extractBlock(): string {
  const start = MAIN_SRC.indexOf('// ── RFC-0241: Metas e Tarifas');
  const end = MAIN_SRC.indexOf('// ── fim RFC-0241');
  if (start < 0 || end < 0) throw new Error('RFC-0241 block markers not found in MAIN_VIEW');
  return MAIN_SRC.slice(start, end);
}

type Harness = {
  canManage: () => boolean;
  toastError: ReturnType<typeof vi.fn>;
  fetchGoals: ReturnType<typeof vi.fn>;
  lib: Record<string, any>;
};

function load(): Harness {
  const toastError = vi.fn();
  const fetchGoals = vi.fn(async () => undefined);
  const LogHelper = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'window',
    'LogHelper',
    'toastError',
    '_fetchGoalsFromGCDR',
    `${extractBlock()}\nreturn { _computeCanManageGoalsTariffs };`
  );
  const out = factory(window, LogHelper, toastError, fetchGoals);
  const pricingHandle = { on: vi.fn() };
  const lib = {
    version: '0.1.575',
    openGoalsTariffsHub: vi.fn(),
    openGoalsPanel: vi.fn(),
    openPricingPanel: vi.fn(() => pricingHandle),
    pricingHandle,
  };
  (window as any).MyIOLibrary = lib;
  return { canManage: out._computeCanManageGoalsTariffs, toastError, fetchGoals, lib };
}

function setUser(u: { SuperAdmin?: boolean; UserAdmin?: boolean; restrict?: boolean }) {
  (window as any).MyIOUtils = {
    SuperAdmin: u.SuperAdmin === true,
    UserAdmin: u.UserAdmin === true,
    currentUserEmail: 'admin@shopping.com.br',
    customerName: 'Shopping A',
    isFeatureVisible: (path: string[]) =>
      !(u.restrict && path.join('.') === 'menu.settings.goalsTariffs'),
  };
}

function setOrch(o: Partial<Record<string, any>> = {}) {
  (window as any).MyIOOrchestrator = {
    gcdrApiBaseUrl: 'https://gcdr.example/api/v1',
    gcdrCustomerId: 'gc-1',
    gcdrTenantId: 'tn-1',
    gcdrApiKey: 'test-key',
    customerTB_ID: 'tb-1',
    getVisibleTab: () => 'water',
    ...o,
  };
}

beforeEach(() => {
  setOrch();
});

afterEach(() => {
  delete (window as any).MyIOUtils;
  delete (window as any).MyIOOrchestrator;
  delete (window as any).MyIOLibrary;
});

describe('RFC-0241 MAIN_VIEW — canManageGoalsTariffs (AC-01..AC-04)', () => {
  it('AC-01: SuperAdmin without isUserAdmin is allowed', () => {
    setUser({ SuperAdmin: true });
    expect(load().canManage()).toBe(true);
  });
  it('AC-02: user admin (any email / TENANT_ADMIN → UserAdmin) is allowed', () => {
    setUser({ UserAdmin: true });
    expect(load().canManage()).toBe(true);
  });
  it('AC-03: anyone else is denied', () => {
    setUser({});
    expect(load().canManage()).toBe(false);
  });
  it('AC-04: restrict_view menu.settings.goalsTariffs=false hides it even for eligible users', () => {
    setUser({ SuperAdmin: true, UserAdmin: true, restrict: true });
    expect(load().canManage()).toBe(false);
  });
});

describe('RFC-0241 MAIN_VIEW — openGoalsTariffs', () => {
  it('denies (no modal) when the user is not eligible', () => {
    setUser({});
    const h = load();
    expect((window as any).MyIOUtils.openGoalsTariffs()).toBe(false);
    expect(h.lib.openGoalsTariffsHub).not.toHaveBeenCalled();
  });

  it('AC-09: missing gcdrCustomerId or gcdrApiKey → actionable toast, no modal', () => {
    setUser({ UserAdmin: true });
    const h = load();
    setOrch({ gcdrCustomerId: '' });
    expect((window as any).MyIOUtils.openGoalsTariffs()).toBe(false);
    expect(h.toastError).toHaveBeenLastCalledWith(expect.stringContaining('gcdrCustomerId'));
    setOrch({ gcdrApiKey: '' });
    expect((window as any).MyIOUtils.openGoalsTariffs()).toBe(false);
    expect(h.toastError).toHaveBeenLastCalledWith(expect.stringContaining('gcdrApiKey'));
    expect(h.lib.openGoalsTariffsHub).not.toHaveBeenCalled();
  });

  it('opens the hub with the three areas and the dashboard footer', () => {
    setUser({ SuperAdmin: true });
    const h = load();
    expect((window as any).MyIOUtils.openGoalsTariffs({ source: 'settings-hub' })).toBe(true);
    const opts = h.lib.openGoalsTariffsHub.mock.calls[0][0];
    expect(Object.keys(opts.handlers).filter((k) => typeof opts.handlers[k] === 'function').sort()).toEqual([
      'compare',
      'manage',
      'tariffs',
    ]);
    expect(opts.footer).toEqual({ customerName: 'Shopping A', libVersion: '0.1.575' });
  });

  it('AC-07: manage → openGoalsPanel for this shopping; save refreshes goalsData and emits myio:goals-updated', async () => {
    setUser({ UserAdmin: true });
    const h = load();
    (window as any).MyIOUtils.openGoalsTariffs();
    h.lib.openGoalsTariffsHub.mock.calls[0][0].handlers.manage();
    const p = h.lib.openGoalsPanel.mock.calls[0][0];
    expect(p).toMatchObject({
      customerId: 'gc-1',
      apiKey: 'test-key',
      baseUrl: 'https://gcdr.example', // /api/v1 stripped (the panel appends it)
      tenantId: 'tn-1',
      domain: 'WATER', // visible tab
      locale: 'pt-BR',
    });

    const events: any[] = [];
    const onEvt = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener('myio:goals-updated', onEvt);
    p.onSaved({ version: 7 });
    await new Promise((r) => setTimeout(r, 0));
    window.removeEventListener('myio:goals-updated', onEvt);
    expect(h.fetchGoals).toHaveBeenCalledWith('https://gcdr.example', 'gc-1', 'test-key', 'tn-1');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ customerId: 'gc-1', version: 7 });
  });

  it('AC-08: tariffs → openPricingPanel always with tariffApi, locked customer and caller-asserted allowed', () => {
    setUser({ UserAdmin: true }); // non-@myio admin
    const h = load();
    (window as any).MyIOUtils.openGoalsTariffs();
    h.lib.openGoalsTariffsHub.mock.calls[0][0].handlers.tariffs();
    const p = h.lib.openPricingPanel.mock.calls[0][0];
    expect(p).toMatchObject({
      customers: [{ tbId: 'tb-1', gcdrCustomerId: 'gc-1', title: 'Shopping A' }],
      lockCustomer: true,
      allowed: true,
      domain: 'water',
      tariffApi: { baseUrl: 'https://gcdr.example', apiKey: 'test-key', tenantId: 'tn-1' },
    });

    // 'save' → myio:tariffs-updated with the latest changed entry.
    const onSave = h.lib.pricingHandle.on.mock.calls.find((c: any[]) => c[0] === 'save')[1];
    const events: any[] = [];
    const onEvt = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener('myio:tariffs-updated', onEvt);
    onSave([
      { domain: 'energy', category: 'lojas', periodKey: '2026-01', updatedAt: '2026-01-01T00:00:00Z', version: 1 },
      { domain: 'water', category: 'area_comum', periodKey: '2026-03', updatedAt: '2026-03-01T00:00:00Z', version: 4 },
    ]);
    window.removeEventListener('myio:tariffs-updated', onEvt);
    expect(events[0]).toMatchObject({ customerId: 'gc-1', domain: 'water', category: 'area_comum', year: 2026, version: 4 });
  });

  it('compare → asks MENU (single GoalsModal implementation) via myio:open-goals-modal', () => {
    setUser({ SuperAdmin: true });
    const h = load();
    (window as any).MyIOUtils.openGoalsTariffs();
    const spy = vi.fn();
    window.addEventListener('myio:open-goals-modal', spy);
    h.lib.openGoalsTariffsHub.mock.calls[0][0].handlers.compare();
    window.removeEventListener('myio:open-goals-modal', spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('never reads the simulator dev key overrides', () => {
    const code = extractBlock()
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join('\n');
    expect(code).not.toMatch(/GCDR_CUSTOMER_API_KEY|gcdr_customer_api_key/);
  });
});

describe('RFC-0241 — bridge & MENU static checks (AC-06)', () => {
  it('MAIN LIB_SYMBOLS exposes the new lib symbols', () => {
    for (const s of [
      'openGoalsTariffsHub',
      'openGoalsPanel',
      'openPricingPanel',
      'createTariffApiClient',
      'createTariffValuator',
      'formatMoneyBRL',
      'sumMoneyDecimals',
    ]) {
      expect(MAIN_SRC).toContain(`'${s}',`);
    }
  });

  it('MENU code never references window.MyIOLibrary (comments excluded)', () => {
    const code = MENU_SRC.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l));
    expect(code.filter((l) => l.includes('MyIOLibrary'))).toEqual([]);
  });

  it('MENU hub wiring delegates to MyIOUtils.openGoalsTariffs and the MAIN-computed permission only', () => {
    const lines = MENU_SRC.split('\n').filter((l) => /goals-tariffs|openGoalsTariffs|canManageGoalsTariffs/.test(l));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l).not.toMatch(/gcdr(ApiKey|TenantId|CustomerId|ApiBaseUrl)/);
    expect(MENU_SRC).toMatch(/'goals-tariffs': \(\) => window\.MyIOUtils\?\.openGoalsTariffs\?\.\(/);
    expect(MENU_SRC).toMatch(/permissions: \{ 'goals-tariffs': window\.MyIOUtils\?\.canManageGoalsTariffs === true \}/);
  });
});
