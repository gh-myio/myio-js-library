import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/components/premium-modals/report-all/openDashboardPopupAllReport', () => ({
  openDashboardPopupAllReport: vi.fn(() => ({ close: vi.fn(), on: vi.fn() })),
}));
vi.mock('../../src/components/demand-panel-v2/openDemandPanelV2', () => ({
  openDemandPanelV2: vi.fn(() => ({ close: vi.fn(), refresh: vi.fn() })),
}));
vi.mock('../../src/components/library-version-checker', () => ({
  createLibraryVersionChecker: vi.fn(() => ({ destroy: vi.fn(), setTheme: vi.fn() })),
}));

import { openDashboardPopupAllReport } from '../../src/components/premium-modals/report-all/openDashboardPopupAllReport';
import { openDemandPanelV2 } from '../../src/components/demand-panel-v2/openDemandPanelV2';
import { createLibraryVersionChecker } from '../../src/components/library-version-checker';
import { createModalFooter } from '../../src/components/premium-modals/footer-modal';
import {
  openReportsHub,
  createDashboardReportsHubContext,
  ReportsHubUserError,
} from '../../src/components/premium-modals/reports-hub';
import type {
  ReportsHubContext,
  ReportsHubHandlerDef,
  OpenReportsHubParams,
} from '../../src/components/premium-modals/reports-hub';

const allReport = vi.mocked(openDashboardPopupAllReport);
const demandPanel = vi.mocked(openDemandPanelV2);
const checker = vi.mocked(createLibraryVersionChecker);

const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};
const $ = (sel: string, doc: Document = document) => doc.querySelector(sel) as HTMLElement | null;
const card = (domain: string, item: string, doc: Document = document) =>
  $(`.rh-card[data-domain="${domain}"][data-item="${item}"]`, doc) as HTMLButtonElement | null;
const key = (k: string, target: EventTarget = $('.rh-overlay')!, extra: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...extra }));

const groups = {
  energy: {
    lojas: [{ ingestionId: 'ing-1', label: 'Loja 1', tbId: 'tb-1', gcdrDeviceId: 'g-1', deviceProfile: '3F_MEDIDOR' }],
    entrada: [{ ingestionId: 'ing-e', label: 'Entrada', tbId: 'tb-e', gcdrDeviceId: 'g-e', deviceProfile: 'ENTRADA' }],
    ocultos: [{ ingestionId: 'ing-o', label: 'Oculto', tbId: 'tb-o' }],
  },
  water: { lojas: [{ ingestionId: 'w-1', label: 'Hidro' }] },
  temperature: { climatizavel: [{ ingestionId: 't-1', label: 'Sala', offSetTemperature: 2 }] },
};

function makeContext(over: Partial<ReportsHubContext> = {}): ReportsHubContext {
  return {
    domains: ['energy', 'water', 'temperature'],
    getGroups: (d) => groups[d] as never,
    getAllReportBase: () => ({ customerId: 'ing-cust', api: { clientId: 'c', clientSecret: 's' }, ui: { theme: 'light' } }) as never,
    ...over,
  };
}

const handles: Array<{ close(): void }> = [];
const open = (over: Partial<OpenReportsHubParams> = {}) => {
  const h = openReportsHub({ context: makeContext(), enabledItems: { water_lojas: true, energy_demand_telemetry: true }, ...over });
  handles.push(h);
  return h;
};

beforeEach(() => {
  document.body.innerHTML = '';
  allReport.mockClear();
  demandPanel.mockClear();
  checker.mockClear();
});
afterEach(() => {
  handles.splice(0).forEach((h) => h.close());
  document.querySelectorAll('.rh-overlay').forEach((n) => n.remove());
});

describe('RFC-0239 openReportsHub — rendering', () => {
  it('renders tabs in catalog order, hides alarms (no handler), locks disabled items', () => {
    const h = open();
    const tabs = [...document.querySelectorAll('.rh-tab')].map((t) => (t as HTMLElement).dataset.domain);
    expect(tabs).toEqual(['energy', 'water', 'temperature']);
    expect(card('energy', 'lojas')!.dataset.state).toBe('enabled');
    expect(card('energy', 'entrada')!.dataset.state).toBe('locked');
    expect(card('energy', 'entrada')!.getAttribute('aria-disabled')).toBe('true');
    expect(card('energy', 'entrada')!.textContent).toContain('Indisponível para este cliente');
    expect($('[data-domain="alarms"]')).toBeNull();
    expect($('.rh-modal')!.getAttribute('role')).toBe('dialog');
    expect($('.rh-tab[aria-selected="true"]')!.dataset.domain).toBe('energy');
    h.close();
  });

  it('a host alarm-report handler shows the Alarmes tab', () => {
    const alarm: ReportsHubHandlerDef = { domains: ['alarms'], prepare: () => () => {} };
    open({ handlers: { 'alarm-report': alarm }, enabledItems: { alarms_por_tipo: true } });
    expect(card('alarms', 'por_tipo')!.dataset.state).toBe('enabled');
  });

  it('C-1: a group-report item placed in alarms by a custom catalog is never shown', () => {
    open({
      catalog: [{ id: 'alarms', label: 'A', items: [{ id: 'x', label: 'X', description: '', icon: '', tint: { bg: '#fff', fg: '#000' }, kind: 'group-report' }] }],
      enabledItems: { alarms_x: true },
    });
    expect(card('alarms', 'x')).toBeNull();
    expect($('.rh-empty')!.textContent).toBe('Nenhum relatório disponível');
  });

  it('C-4: catalog markup is rendered as text; emoji icons are aria-hidden', () => {
    open({
      catalog: [{ id: 'energy', label: '<b>E</b>', items: [{ id: 'x"><img src=x onerror=alert(1)>', label: '<img src=x onerror=alert(1)>', description: '<script>1</script>', icon: '<svg onload=alert(1)>', tint: { bg: 'red;background:url(x)', fg: '#000' }, kind: 'group-report' }] }],
      enabledItems: { 'energy_x"><img src=x onerror=alert(1)>': true },
    });
    expect(document.querySelector('img, script, svg, b')).toBeNull();
    const c = $('.rh-card')!;
    expect(c.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(($('.rh-ico') as HTMLElement).getAttribute('aria-hidden')).toBe('true');
    expect(($('.rh-ico') as HTMLElement).style.background).toBe('');
  });

  it('C-7: only water enabled → opens on Água', () => {
    open({ enabledItems: { energy_lojas: false, water_todos: true } });
    expect($('.rh-tab[aria-selected="true"]')!.dataset.domain).toBe('water');
  });

  it('stub orchestrator context (no domains) → empty state', () => {
    open({ context: makeContext({ domains: [] }) });
    expect($('.rh-empty')).not.toBeNull();
    expect($('.rh-tab')).toBeNull();
  });
});

describe('RFC-0239 openReportsHub — selection protocol', () => {
  it('group report: prepare → hub closes → open AllReport with itemsList and base precedence (P-14)', async () => {
    const order: string[] = [];
    const ctx = makeContext({
      ensureDomainLoaded: vi.fn(async () => { order.push('hydrate'); }),
      getAllReportBase: () => ({ customerId: 'ing-cust', api: {}, ui: { theme: 'light', width: 900 }, theme: { '--x': '1' }, customerName: 'Base' }) as never,
    });
    allReport.mockImplementation(() => { order.push(document.querySelector('.rh-overlay') ? 'open-with-hub' : 'open'); return { close: vi.fn(), on: vi.fn() }; });
    const h = open({ context: ctx });
    card('water', 'lojas')!.click();
    expect(card('water', 'lojas')!.getAttribute('aria-busy')).toBe('true');
    expect(card('energy', 'lojas')!.disabled).toBe(true);
    await flush();
    expect(order).toEqual(['hydrate', 'open']);
    expect(h.isOpen).toBe(false);
    const p = allReport.mock.calls[0][0];
    expect(p).toMatchObject({ customerId: 'ing-cust', domain: 'water', group: 'lojas', ui: { theme: 'light', width: 900 }, theme: { '--x': '1' }, customerName: 'Base' });
    expect(p.itemsList).toEqual([{ id: 'w-1', identifier: 'Hidro', label: 'Hidro', excludeGroupsTotals: null }]);
  });

  it('hub palette/name win over the base; temperature ranges and offset forwarded', async () => {
    const palette = { mode: 'dark', cssVars: () => ({ '--myio-brand-700': '#123456' }) } as never;
    open({
      context: makeContext({ temperature: { validRange: { min: 15, max: 40 }, idealRange: { min: 20, max: 24 } } }),
      theme: palette,
      customerName: 'Shopping A',
      enabledItems: { temperature_climatizavel: true },
      initialDomain: 'temperature',
    });
    card('temperature', 'climatizavel')!.click();
    await flush();
    const p = allReport.mock.calls[0][0];
    expect(p.theme).toBe(palette);
    expect(p.customerName).toBe('Shopping A');
    expect(p.ui).toEqual({ theme: 'light' });
    expect(p.temperatureValidRange).toEqual({ min: 15, max: 40 });
    expect(p.temperatureIdealRange).toEqual({ min: 20, max: 24 });
    expect(p.itemsList[0].temperatureOffset).toBe(2);
  });

  it('demand panel: energy devices without ocultos, customer ids kept, name from the hub', async () => {
    const dp = { customer: { tbCustomerId: 'tb-c', gcdrCustomerId: 'g-c', name: '' }, user: { tbUserId: 'u', name: 'U' }, store: {}, api: {} };
    open({ context: makeContext({ getDemandPanelParams: () => dp as never }), customerName: 'Shopping A' });
    card('energy', 'demand_telemetry')!.click();
    await flush();
    const p = demandPanel.mock.calls[0][0];
    expect(p.devices.map((d) => d.tbDeviceId).sort()).toEqual(['tb-1', 'tb-e']);
    expect(p.customer).toEqual({ tbCustomerId: 'tb-c', gcdrCustomerId: 'g-c', name: 'Shopping A' });
    expect('themeMode' in p).toBe(false);
  });

  it('demand params null → inline message, hub stays open, retry works', async () => {
    let ready = false;
    const dp = { customer: { tbCustomerId: 'tb-c', gcdrCustomerId: 'g-c', name: 'X' }, user: { tbUserId: 'u', name: 'U' }, store: {}, api: {} };
    const onError = vi.fn();
    const h = open({ context: makeContext({ getDemandPanelParams: () => (ready ? (dp as never) : null) }), onError });
    card('energy', 'demand_telemetry')!.click();
    await flush();
    expect(h.isOpen).toBe(true);
    const err = card('energy', 'demand_telemetry')!.parentElement!.querySelector('.rh-err')!;
    expect(err.textContent).toContain('Relatório de demanda indisponível para este cliente.');
    expect(err.getAttribute('aria-live')).toBe('polite');
    expect(card('energy', 'lojas')!.disabled).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ phase: 'prepare', item: 'demand_telemetry' }));
    ready = true;
    (err.querySelector('.rh-retry') as HTMLButtonElement).click();
    await flush();
    expect(demandPanel).toHaveBeenCalledTimes(1);
    expect(h.isOpen).toBe(false);
  });

  it('close during prepare aborts: destination never opened', async () => {
    let release!: () => void;
    let seen: AbortSignal | undefined;
    const slow: ReportsHubHandlerDef = {
      domains: ['energy'],
      prepare: ({ signal }) => { seen = signal; return new Promise((r) => { release = () => r(() => { throw new Error('must not open'); }); }); },
    };
    const h = open({ handlers: { 'group-report': slow } });
    card('energy', 'lojas')!.click();
    h.close();
    expect(seen!.aborted).toBe(true);
    release();
    await flush();
    expect(allReport).not.toHaveBeenCalled();
  });

  it('a second click during prepare is ignored (one destination)', async () => {
    const prepare = vi.fn(async () => () => allReport({} as never));
    open({ handlers: { 'group-report': { domains: ['energy', 'water', 'temperature'], prepare } } });
    card('energy', 'lojas')!.click();
    card('energy', 'lojas')!.click();
    card('water', 'lojas')!.click();
    await flush();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(allReport).toHaveBeenCalledTimes(1);
  });

  it('open() throwing → onError(phase open), no unhandled rejection', async () => {
    const onError = vi.fn();
    open({ handlers: { 'group-report': { domains: ['energy'], prepare: () => () => { throw new Error('boom'); } } }, onError });
    card('energy', 'lojas')!.click();
    await flush();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ phase: 'open' }));
  });

  it('locked card ignores click and Enter', async () => {
    open();
    card('energy', 'entrada')!.click();
    key('Enter', card('energy', 'entrada')!);
    await flush();
    expect(allReport).not.toHaveBeenCalled();
  });

  it('user-facing message only for ReportsHubUserError; generic otherwise', async () => {
    open({ handlers: { 'group-report': { domains: ['energy'], prepare: () => { throw new Error('secret detail'); } } } });
    card('energy', 'lojas')!.click();
    await flush();
    const txt = card('energy', 'lojas')!.parentElement!.querySelector('.rh-err')!.textContent!;
    expect(txt).toContain('Não foi possível abrir este relatório.');
    expect(txt).not.toContain('secret');
    expect(new ReportsHubUserError('x')).toBeInstanceOf(Error);
  });
});

describe('RFC-0239 openReportsHub — lifecycle, keyboard, focus', () => {
  it('toggle: second open closes; toggle:false returns the same open handle', () => {
    const a = open();
    const b = open();
    expect(a.isOpen).toBe(false);
    expect(b.isOpen).toBe(false);
    expect($('.rh-overlay')).toBeNull();
    const c = open();
    const d = open({ toggle: false });
    expect(c.isOpen && d.isOpen).toBe(true);
    expect(document.querySelectorAll('.rh-overlay')).toHaveLength(1);
  });

  it('two documents are independent singletons', () => {
    const other = document.implementation.createHTMLDocument('other');
    const a = open();
    const b = open({ document: other });
    expect(a.isOpen && b.isOpen).toBe(true);
    expect(other.querySelector('.rh-overlay')).not.toBeNull();
    b.close();
    expect(a.isOpen).toBe(true);
  });

  it('Esc and backdrop close; ✕ closes; close is idempotent', () => {
    let h = open();
    key('Escape');
    expect(h.isOpen).toBe(false);
    h = open();
    $('.rh-overlay')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(h.isOpen).toBe(false);
    h = open();
    ($('#myio-reports-hub-close') as HTMLElement).click();
    expect(h.isOpen).toBe(false);
    h.close();
    expect(h.isOpen).toBe(false);
  });

  it('arrow keys move between tabs; initial focus on the active tab', () => {
    open();
    expect((document.activeElement as HTMLElement).dataset.domain).toBe('energy');
    key('ArrowRight', document.activeElement!);
    expect((document.activeElement as HTMLElement).dataset.domain).toBe('water');
    expect($('.rh-tab[aria-selected="true"]')!.dataset.domain).toBe('water');
    key('ArrowLeft', document.activeElement!);
    key('ArrowLeft', document.activeElement!);
    expect((document.activeElement as HTMLElement).dataset.domain).toBe('temperature');
  });

  it('Tab is contained in the dialog', () => {
    open();
    const focusables = [...$('.rh-modal')!.querySelectorAll<HTMLElement>('button')].filter((b) => b.tabIndex >= 0 && !b.closest('[hidden]'));
    focusables[focusables.length - 1].focus();
    key('Tab', document.activeElement!);
    expect(document.activeElement).toBe(focusables[0]);
    key('Tab', document.activeElement!, { shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });

  it('focus returns to the opener on cancel, not after success', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    open().close();
    expect(document.activeElement).toBe(opener);
    opener.focus();
    open();
    card('energy', 'lojas')!.click();
    await flush();
    expect(document.activeElement).not.toBe(opener);
  });

  it('no timers or document/window listeners left after close (fake timers, pending promises flushed)', async () => {
    vi.useFakeTimers();
    const added: Array<[EventTarget, string, unknown]> = [];
    const removed: Array<[EventTarget, string, unknown]> = [];
    const targets: EventTarget[] = [window, document];
    const origAdd = targets.map((t) => t.addEventListener);
    const origRemove = targets.map((t) => t.removeEventListener);
    targets.forEach((t, i) => {
      t.addEventListener = function (type: string, fn: unknown, o?: unknown) { added.push([t, type, fn]); return origAdd[i].call(t, type, fn as never, o as never); } as never;
      t.removeEventListener = function (type: string, fn: unknown, o?: unknown) { removed.push([t, type, fn]); return origRemove[i].call(t, type, fn as never, o as never); } as never;
    });
    try {
      const h = open();
      h.close();
      await flush();
      vi.runOnlyPendingTimers();
      expect(vi.getTimerCount()).toBe(0);
      added.forEach(([t, type, fn]) => {
        expect(removed.some(([rt, rtype, rfn]) => rt === t && rtype === type && rfn === fn)).toBe(true);
      });
    } finally {
      targets.forEach((t, i) => { t.addEventListener = origAdd[i]; t.removeEventListener = origRemove[i]; });
      vi.useRealTimers();
    }
  });
});

describe('RFC-0239 G-3 / footer', () => {
  it('the hub never reads dashboard globals (mount, navigation, selection, close)', async () => {
    const guarded = ['MyIOUtils', 'MyIOOrchestrator', 'MyIOLibrary', 'MyIOOrchestratorData'];
    const w = window as unknown as Record<string, unknown>;
    guarded.forEach((k) => Object.defineProperty(w, k, { configurable: true, get() { throw new Error(`G-3 violation: window.${k}`); } }));
    try {
      const h = open({ theme: { mode: 'light', cssVars: () => ({ '--myio-brand-700': '#111111' }) } as never, customerName: 'A' });
      key('ArrowRight', document.activeElement!);
      card('water', 'lojas')!.click();
      await flush();
      expect(allReport).toHaveBeenCalledTimes(1);
      expect(h.isOpen).toBe(false);
      open().close();
    } finally {
      guarded.forEach((k) => delete w[k]);
    }
  });

  it('theme/name A in params wins over globals B', () => {
    const w = window as unknown as Record<string, unknown>;
    w.MyIOUtils = { theme: { '--myio-brand-700': '#bbbbbb' }, customerName: 'B' };
    w.MyIOLibrary = { version: '9.9.9' };
    try {
      open({ theme: { mode: 'light', cssVars: () => ({ '--myio-brand-700': '#aaaaaa' }) } as never, customerName: 'A' });
      expect(($('.rh-modal') as HTMLElement).style.getPropertyValue('--myio-brand-700')).toBe('#aaaaaa');
      expect($('.myio-modal-footer-premium')!.textContent).toContain('A');
      expect($('.myio-modal-footer-premium')!.textContent).not.toContain('9.9.9');
    } finally {
      delete w.MyIOUtils;
      delete w.MyIOLibrary;
    }
  });

  it('footer static version: the version checker is never instantiated', () => {
    open({ customerName: 'A' });
    expect(checker).not.toHaveBeenCalled();
    expect($('.myio-modal-footer-premium')!.textContent).toMatch(/v\d+\.\d+\.\d+/);
  });

  it('regression: footer default mode still uses the checker', () => {
    createModalFooter({ libVersion: { current: '1.0.0' } }).destroy();
    expect(checker).toHaveBeenCalledTimes(1);
  });

  it('dark mode from the palette applies to the hub only', () => {
    open({ theme: { mode: 'dark', cssVars: () => ({}) } as never });
    expect($('.rh-modal')!.getAttribute('data-theme')).toBe('dark');
  });
});

describe('RFC-0239 createDashboardReportsHubContext', () => {
  const jwt = (userId: string, first: string) =>
    `x.${btoa(JSON.stringify({ userId, firstName: first, sub: `${first}@x.com` }))}.y`;

  it('stub orchestrator → no domains, no throw', () => {
    const ctx = createDashboardReportsHubContext({ orchestrator: { isReady: false } as never, tbCustomerId: 'tb', getJwt: () => '' });
    expect(ctx.domains).toEqual([]);
    expect(ctx.getDemandPanelParams).toBeUndefined();
    expect(() => createDashboardReportsHubContext({ orchestrator: null, tbCustomerId: '', getJwt: () => '' })).not.toThrow();
  });

  it('water-only orchestrator → only Água is offered', () => {
    const ctx = createDashboardReportsHubContext({ orchestrator: { getWaterGroups: () => groups.water }, tbCustomerId: 'tb', getJwt: () => '' });
    expect(ctx.domains).toEqual(['water']);
    open({ context: ctx, enabledItems: { water_lojas: true } });
    expect([...document.querySelectorAll('.rh-tab')].map((t) => (t as HTMLElement).dataset.domain)).toEqual(['water']);
  });

  it('AllReport base read at call time with the ingestion customer id; three ids stay separate', () => {
    let token = 'tok-1';
    const orch = {
      getEnergyGroups: () => groups.energy,
      getCredentials: () => ({ CUSTOMER_ING_ID: 'ing-cust', CLIENT_ID: 'cid', CLIENT_SECRET: 'sec' }),
      tokenManager: { getToken: () => token },
      gcdrCustomerId: 'gcdr-cust', gcdrApiBaseUrl: 'https://gcdr', gcdrApiKey: 'k', gcdrTenantId: 't',
    };
    const ctx = createDashboardReportsHubContext({ orchestrator: orch, tbCustomerId: 'tb-cust', getJwt: () => jwt('u1', 'Ana'), getDataApiHost: () => 'https://data' });
    token = 'tok-2';
    const base = ctx.getAllReportBase();
    expect(base).toMatchObject({ customerId: 'ing-cust', api: { clientId: 'cid', clientSecret: 'sec', dataApiBaseUrl: 'https://data', ingestionToken: 'tok-2' }, ui: { theme: 'light' } });
    const dp = ctx.getDemandPanelParams!()!;
    expect(dp.customer).toMatchObject({ tbCustomerId: 'tb-cust', gcdrCustomerId: 'gcdr-cust' });
  });

  it('JWT changed between opening and selection → identity of the new JWT', () => {
    let current = jwt('u1', 'Ana');
    const ctx = createDashboardReportsHubContext({
      orchestrator: { getEnergyGroups: () => groups.energy, gcdrCustomerId: 'g', gcdrApiBaseUrl: 'https://gcdr' },
      tbCustomerId: 'tb',
      getJwt: () => current,
    });
    current = jwt('u2', 'Bia');
    expect(ctx.getDemandPanelParams!()!.user).toMatchObject({ tbUserId: 'u2', name: 'Bia' });
  });

  it('missing GCDR ids → demand params null (group reports unaffected)', () => {
    const ctx = createDashboardReportsHubContext({ orchestrator: { getEnergyGroups: () => groups.energy }, tbCustomerId: 'tb', getJwt: () => '' });
    expect(ctx.getDemandPanelParams!()).toBeNull();
    expect(ctx.domains).toEqual(['energy']);
  });

  it('hydration: settled domain skipped; not loaded → hydrateDomain; error / no period logged, not thrown (P-8)', async () => {
    const hydrateDomain = vi.fn(async () => undefined);
    const warn = vi.fn();
    let period: unknown = { start: 1 };
    let loaded = false;
    const ctx = createDashboardReportsHubContext({
      orchestrator: { getWaterGroups: () => groups.water, hydrateDomain, getCurrentPeriod: () => period },
      tbCustomerId: 'tb', getJwt: () => '', isDomainLoaded: () => loaded, log: { warn },
    });
    const sig = new AbortController().signal;
    await ctx.ensureDomainLoaded!('water', sig);
    expect(hydrateDomain).toHaveBeenCalledWith('water', { start: 1 });
    loaded = true;
    await ctx.ensureDomainLoaded!('water', sig);
    expect(hydrateDomain).toHaveBeenCalledTimes(1);
    loaded = false;
    hydrateDomain.mockRejectedValueOnce(new Error('down'));
    await expect(ctx.ensureDomainLoaded!('water', sig)).resolves.toBeUndefined();
    period = null;
    await ctx.ensureDomainLoaded!('water', sig);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('temperature ranges are converted to numbers', () => {
    const ctx = createDashboardReportsHubContext({
      orchestrator: { getTemperatureGroups: () => groups.temperature }, tbCustomerId: '', getJwt: () => '',
      temperatureClampRange: { min: '15', max: 40 }, temperatureLimits: { minTemperature: 20, maxTemperature: '24' },
    });
    expect(ctx.temperature).toEqual({ validRange: { min: 15, max: 40 }, idealRange: { min: 20, max: 24 } });
  });
});
