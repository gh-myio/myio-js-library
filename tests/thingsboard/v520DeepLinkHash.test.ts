/**
 * ED-1400 — Dashboard Shopping v5.2.0: trilha no hash da URL.
 *   - aba do MENU          → #energy | #water | #temperature | #alarm | #manual
 *   - modal Configurações  → #<domain>&settings&<tbId>
 *
 * Executa o código REAL dos controllers (MAIN_VIEW / MENU / TELEMETRY) extraído do fonte
 * num sandbox com window/location/history falsos.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  readControllerSource,
  extractFunction,
  extractBlockAfter,
} from './helpers/extractControllerFunction';

const UUID = '0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0';
const LOG = { log: () => {}, warn: () => {}, error: () => {} };

function makeWindow(href: string) {
  const target = new EventTarget();
  const url = new URL(href);
  const win: any = {
    location: {
      get href() {
        return url.href;
      },
      get hash() {
        return url.hash;
      },
    },
    history: {
      state: { tb: 1 },
      replaceState: vi.fn((_state: unknown, _title: string, next: string) => {
        url.href = new URL(next, url.href).href;
      }),
    },
    MyIOUtils: {},
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  return win;
}

// ─────────────────────────────── MAIN_VIEW ───────────────────────────────
const MAIN_SRC = readControllerSource('MAIN_VIEW').replace(/\r\n/g, '\n');

function extractMainDeepLinkBlock(): string {
  const begin = MAIN_SRC.indexOf('// ===================== ED-1400 deep link (#<domain>');
  const end = MAIN_SRC.indexOf('// ===================== ED-1400 deep link — end');
  if (begin < 0 || end < 0 || end < begin) throw new Error('bloco ED-1400 da MAIN_VIEW não encontrado');
  return MAIN_SRC.slice(begin, end);
}

function loadMain(href: string) {
  const win = makeWindow(href);
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'window',
    'LogHelper',
    'CustomEvent',
    `${extractMainDeepLinkBlock()}\nreturn { parseDeepLinkHash, buildDeepLinkHash, setDeepLinkHash, tryDispatchDeepLinkSettings };`
  );
  const api = factory(win, LOG, CustomEvent);
  return { win, api };
}

describe('ED-1400 MAIN_VIEW — parseDeepLinkHash', () => {
  const { api } = loadMain('https://tb.local/dashboards/abc?state=xyz');
  const parse = api.parseDeepLinkHash;

  it('aceita os 5 domínios', () => {
    for (const d of ['energy', 'water', 'temperature', 'alarm', 'manual']) {
      expect(parse(`#${d}`)).toEqual({ domain: d, action: null, tbId: null });
    }
  });

  it('aceita os stateIds do TB como alias', () => {
    expect(parse('#telemetry_content')?.domain).toBe('energy');
    expect(parse('#water_content')?.domain).toBe('water');
    expect(parse('#temperature_content')?.domain).toBe('temperature');
    expect(parse('#alarm_content')?.domain).toBe('alarm');
    expect(parse('#devices_manuals')?.domain).toBe('manual');
  });

  it('settings + UUID válido', () => {
    expect(parse(`#water&settings&${UUID}`)).toEqual({ domain: 'water', action: 'settings', tbId: UUID });
    expect(parse(`#manual&settings&${UUID}`)?.action).toBe('settings');
  });

  it('case / espaços / encoding são normalizados', () => {
    expect(parse(` #ENERGY & Settings & ${UUID.toUpperCase()} `)).toEqual({
      domain: 'energy',
      action: 'settings',
      tbId: UUID,
    });
    expect(parse('#Water')?.domain).toBe('water');
    expect(parse(`#energy%26settings%26${UUID}`)?.action).toBe('settings');
  });

  it('segmentos depois da trilha de settings são ignorados', () => {
    expect(parse(`#energy&settings&${UUID}&foo&bar`)).toEqual({ domain: 'energy', action: 'settings', tbId: UUID });
  });

  it('trilha malformada → inválido (null): ação desconhecida / UUID inválido', () => {
    expect(parse('#energy&foo')).toBeNull();
    expect(parse('#energy&settings&not-a-uuid')).toBeNull();
    expect(parse('#energy&settings&')).toBeNull();
    expect(parse('#energy&settings')).toBeNull();
  });

  it('alarm não tem modal de Configurações → inválido', () => {
    expect(parse(`#alarm&settings&${UUID}`)).toBeNull();
  });

  it('domínio inválido / vazio / lixo → null', () => {
    for (const h of ['', '#', '#   ', '#foo', '#settings&' + UUID, '#%E0%A4%A', 'energy;alert(1)', '#' + 'x'.repeat(300)]) {
      expect(parse(h)).toBeNull();
    }
    expect(parse(undefined as any)).toBeNull();
    expect(parse(42 as any)).toBeNull();
  });
});

describe('ED-1400 MAIN_VIEW — setDeepLinkHash', () => {
  it('troca SÓ o hash via history.replaceState (path/query/state preservados)', () => {
    const { win, api } = loadMain('https://tb.local/dashboards/abc?state=xyz#energy');
    expect(api.setDeepLinkHash({ domain: 'water' })).toBe(true);
    expect(win.history.replaceState).toHaveBeenCalledTimes(1);
    expect(win.history.replaceState).toHaveBeenCalledWith(
      win.history.state,
      '',
      'https://tb.local/dashboards/abc?state=xyz#water'
    );

    api.setDeepLinkHash({ domain: 'water', action: 'settings', tbId: UUID.toUpperCase() });
    expect(win.history.replaceState).toHaveBeenLastCalledWith(
      win.history.state,
      '',
      `https://tb.local/dashboards/abc?state=xyz#water&settings&${UUID}`
    );
  });

  it('mesmo hash → não chama replaceState; inválido → false', () => {
    const { win, api } = loadMain('https://tb.local/d?x=1#water');
    expect(api.setDeepLinkHash({ domain: 'water' })).toBe(true);
    expect(api.setDeepLinkHash({ domain: 'nope' })).toBe(false);
    expect(win.history.replaceState).not.toHaveBeenCalled();
  });

  it('alias vira domínio canônico; settings sem UUID válido grava só a aba', () => {
    const { win, api } = loadMain('https://tb.local/d');
    api.setDeepLinkHash({ domain: 'water_content', action: 'settings', tbId: 'bad' });
    expect(win.history.replaceState).toHaveBeenLastCalledWith(win.history.state, '', 'https://tb.local/d#water');
  });

  it('expõe getDeepLink / setDeepLinkHash em MyIOUtils', () => {
    const { win } = loadMain(`https://tb.local/d#temperature&settings&${UUID}`);
    expect(win.MyIOUtils.getDeepLink()).toEqual({ domain: 'temperature', action: 'settings', tbId: UUID });
    expect(typeof win.MyIOUtils.setDeepLinkHash).toBe('function');
    expect(win.MyIOUtils.getDeepLinkActiveTab()).toBeNull();
  });

  it('sem hash → getDeepLink null, nenhuma pendência, URL intocada', () => {
    const { win } = loadMain('https://tb.local/d?x=1');
    expect(win.MyIOUtils.getDeepLink()).toBeNull();
    expect(win.__myioDeepLinkPending).toBeNull();
    expect(win.history.replaceState).not.toHaveBeenCalled();
  });

  it('hash inválido no carregamento → removido (sem modal), sem pendência', () => {
    for (const h of ['#foo', `#energy&settings&bad-uuid`, `#alarm&settings&${UUID}`, '#energy&xyz']) {
      const { win } = loadMain(`https://tb.local/dashboards/all/abc?x=1${h}`);
      expect(win.MyIOUtils.getDeepLink()).toBeNull();
      expect(win.__myioDeepLinkPending).toBeNull();
      expect(win.history.replaceState).toHaveBeenCalledWith(win.history.state, '', 'https://tb.local/dashboards/all/abc?x=1');
      expect(win.location.hash).toBe('');
    }
  });

  it('openMessageDialog (RFC-0205) exposto aos filhos pelo bridge LIB_SYMBOLS; detectSuperAdmin libera o deep link', () => {
    const libSymbols = MAIN_SRC.slice(
      MAIN_SRC.indexOf('const LIB_SYMBOLS = ['),
      MAIN_SRC.indexOf('for (const name of LIB_SYMBOLS)')
    );
    expect(libSymbols).toContain("'openMessageDialog'");
    expect(MAIN_SRC).toContain('detectSuperAdmin().finally(() => window.MyIOUtils.markDeepLinkVisibilityReady?.());');
  });

  it('clearDeepLinkHash remove a trilha (path/query preservados)', () => {
    const { win } = loadMain(`https://tb.local/dashboards/all/abc?x=1#water&settings&${UUID}`);
    expect(win.MyIOUtils.clearDeepLinkHash()).toBe(true);
    expect(win.history.replaceState).toHaveBeenLastCalledWith(win.history.state, '', 'https://tb.local/dashboards/all/abc?x=1');
  });
});

describe('ED-1400 MAIN_VIEW — myio:open-device-settings (one-shot)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const fire = (win: any, type: string, detail: unknown) => win.dispatchEvent(new CustomEvent(type, { detail }));

  it('espera o restrict_view resolver (feature-visibility-ready ou markDeepLinkVisibilityReady)', () => {
    const { win } = loadMain(`https://tb.local/d#water&settings&${UUID}`);
    const spy = vi.fn((ev: any) => (ev.detail.handled = true));
    win.addEventListener('myio:open-device-settings', spy);
    fire(win, 'myio:dashboard-state', { tab: 'water' });
    fire(win, 'myio:telemetry:provide-data', { domain: 'water' });
    vi.runAllTimers();
    expect(spy).not.toHaveBeenCalled();
    win.MyIOUtils.markDeepLinkVisibilityReady(); // ex.: detectSuperAdmin sem JWT / com erro
    vi.runAllTimers();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('restrict_view nega a aba no mesmo feature-visibility-ready → nada abre', () => {
    const { win } = loadMain(`https://tb.local/d#water&settings&${UUID}`);
    const spy = vi.fn();
    win.addEventListener('myio:open-device-settings', spy);
    fire(win, 'myio:dashboard-state', { tab: 'water' });
    // o MENU (listener posterior) nega a aba e limpa a pendência
    win.addEventListener('myio:feature-visibility-ready', () => (win.__myioDeepLinkPending = null));
    fire(win, 'myio:feature-visibility-ready', {});
    vi.runAllTimers();
    expect(spy).not.toHaveBeenCalled();
  });

  it('só dispara quando a aba do link é a visível; encerra quando um card trata', () => {
    const { win } = loadMain(`https://tb.local/d#water&settings&${UUID}`);
    const seen: any[] = [];
    win.addEventListener('myio:open-device-settings', (ev: any) => {
      seen.push({ ...ev.detail });
      ev.detail.handled = true;
    });
    fire(win, 'myio:feature-visibility-ready', {});
    vi.runAllTimers();

    fire(win, 'myio:telemetry:provide-data', { domain: 'water' }); // aba ainda não anunciada
    vi.runAllTimers();
    expect(seen).toHaveLength(0);

    fire(win, 'myio:dashboard-state', { tab: 'energy' }); // outra aba
    vi.runAllTimers();
    expect(seen).toHaveLength(0);

    fire(win, 'myio:dashboard-state', { tab: 'water' });
    vi.runAllTimers();
    expect(seen).toEqual([{ domain: 'water', tbId: UUID, handled: false }]);
    expect(win.__myioDeepLinkPending).toBeNull();

    fire(win, 'myio:telemetry:provide-data', { domain: 'water' });
    vi.runAllTimers();
    expect(seen).toHaveLength(1); // one-shot
  });

  it('tbId desconhecido → tenta nos provide-data seguintes e desiste no limite', () => {
    const { win } = loadMain(`https://tb.local/d#energy&settings&${UUID}`);
    const spy = vi.fn();
    win.addEventListener('myio:open-device-settings', spy);
    win.MyIOUtils.markDeepLinkVisibilityReady();
    fire(win, 'myio:dashboard-state', { tab: 'energy' });
    for (let i = 0; i < 15; i++) {
      fire(win, 'myio:telemetry:provide-data', { domain: 'energy' });
      vi.runAllTimers();
    }
    expect(spy).toHaveBeenCalledTimes(10);
    expect(win.__myioDeepLinkPending).toBeNull();
  });

  it('usuário sai da aba do link antes do card existir → desiste', () => {
    const { win } = loadMain(`https://tb.local/d#energy&settings&${UUID}`);
    const spy = vi.fn();
    win.addEventListener('myio:open-device-settings', spy);
    win.MyIOUtils.markDeepLinkVisibilityReady();
    vi.runAllTimers();
    fire(win, 'myio:dashboard-state', { tab: 'energy' });
    vi.runAllTimers();
    fire(win, 'myio:dashboard-state', { tab: 'water' });
    expect(win.__myioDeepLinkPending).toBeNull();
    fire(win, 'myio:dashboard-state', { tab: 'energy' });
    vi.runAllTimers();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('hash só de aba → nunca dispara', () => {
    const { win } = loadMain('https://tb.local/d#energy');
    const spy = vi.fn();
    win.addEventListener('myio:open-device-settings', spy);
    fire(win, 'myio:dashboard-state', { tab: 'energy' });
    fire(win, 'myio:telemetry:provide-data', { domain: 'energy' });
    vi.runAllTimers();
    expect(spy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────── MENU ───────────────────────────────
const MENU_SRC = readControllerSource('MENU').replace(/\r\n/g, '\n');

function loadMenu(opts: {
  links: any[];
  originalLinks?: any[];
  deepLink?: any;
  withHelper?: boolean;
  withDialog?: boolean;
  href?: string;
}) {
  const win = makeWindow(opts.href || 'https://tb.local/d?state=s');
  const setDeepLinkHash = vi.fn();
  const clearDeepLinkHash = vi.fn();
  const openMessageDialog = vi.fn(() => Promise.resolve());
  if (opts.withHelper !== false) {
    win.MyIOUtils = { getDeepLink: () => opts.deepLink ?? null, setDeepLinkHash, clearDeepLinkHash };
    if (opts.withDialog !== false) win.MyIOUtils.openMessageDialog = openMessageDialog;
  }
  win.__myioDeepLinkPending = opts.deepLink?.action === 'settings' ? { domain: opts.deepLink.domain } : null;
  const scope: any = { links: opts.links };
  const originalLinks = opts.originalLinks || opts.links;
  const self: any = { ctx: { detectChanges: vi.fn() } }; // sem ctx.dashboard → show/hide de containers
  const openReportsPickerModal = vi.fn();
  const openGoalsModal = vi.fn();

  document.body.innerHTML = `<main>
    <div data-content-state="telemetry_content" style="display:block"></div>
    <div data-content-state="water_content" style="display:none"></div>
    <div data-content-state="alarm_content" style="display:none"></div>
  </main>`;

  const code = [
    `const DOMAIN_BY_STATE = ${extractBlockAfter(MENU_SRC, 'const DOMAIN_BY_STATE =')};`,
    extractFunction(MENU_SRC, 'writeDomainDeepLinkHash'),
    extractFunction(MENU_SRC, 'isInterceptedMenuLink'),
    extractFunction(MENU_SRC, 'findDeepLinkMenuIndex'),
    'let _deepLinkAppliedDomain = null;',
    `const DEEP_LINK_TAB_LABELS = ${extractBlockAfter(MENU_SRC, 'const DEEP_LINK_TAB_LABELS =')};`,
    extractFunction(MENU_SRC, 'deepLinkTabName'),
    extractFunction(MENU_SRC, 'clearDeepLinkHashFromMenu'),
    extractFunction(MENU_SRC, 'selectDefaultMenuTab'),
    extractFunction(MENU_SRC, 'denyDeepLinkTab'),
    extractFunction(MENU_SRC, '_onDeepLinkFeatureVisibility'),
    `scope.changeDashboardState = function (e, stateId, index) ${extractBlockAfter(
      MENU_SRC,
      'scope.changeDashboardState = function'
    )};`,
    extractFunction(MENU_SRC, 'emitInitialDashboardState'),
    'return { emitInitialDashboardState, _onDeepLinkFeatureVisibility };',
  ].join('\n');
  // eslint-disable-next-line no-new-func
  const api = new Function(
    'window',
    'document',
    'self',
    'scope',
    '_originalMenuLinks',
    'LogHelper',
    'CustomEvent',
    'openReportsPickerModal',
    'openGoalsModal',
    code
  )(win, document, self, scope, originalLinks, LOG, CustomEvent, openReportsPickerModal, openGoalsModal);

  const states: any[] = [];
  win.addEventListener('myio:dashboard-state', (ev: any) => states.push(ev.detail.tab));
  const visible = () =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-content-state]'))
      .filter((el) => el.style.display === 'block')
      .map((el) => el.getAttribute('data-content-state'));
  return {
    win,
    scope,
    api,
    states,
    setDeepLinkHash,
    clearDeepLinkHash,
    openMessageDialog,
    openReportsPickerModal,
    openGoalsModal,
    visible,
  };
}

const DENY_MESSAGE =
  'Você não tem permissão para acessar a aba Água deste painel. Você será redirecionado para a página inicial do painel.';

const LINKS = () => [
  { stateId: 'telemetry_content', content: 'Energia', enableLink: true },
  { stateId: 'water_content', content: 'Água' },
  { stateId: 'alarm_content', content: 'Alarmes' },
  { stateId: 'reports', content: 'Relatórios' },
  { stateId: 'goals', content: 'Metas' },
];

describe('ED-1400 MENU — seleção inicial pelo deep link', () => {
  it('deep link → aba do link selecionada, dashboard-state inicial com o domínio e conteúdo trocado', () => {
    const m = loadMenu({ links: LINKS(), deepLink: { domain: 'water', action: null, tbId: null } });
    m.api.emitInitialDashboardState();
    expect(m.states).toEqual(['water']);
    expect(m.scope.links.map((l: any) => !!l.enableLink)).toEqual([false, true, false, false, false]);
    expect(m.visible()).toEqual(['water_content']);
    expect(m.setDeepLinkHash).toHaveBeenCalledWith({ domain: 'water' });
  });

  it('deep link de Configurações → seleciona a aba sem apagar o &settings&<tbId>', () => {
    const m = loadMenu({ links: LINKS(), deepLink: { domain: 'water', action: 'settings', tbId: UUID } });
    m.api.emitInitialDashboardState();
    expect(m.states).toEqual(['water']);
    expect(m.setDeepLinkHash).not.toHaveBeenCalled();
  });

  it('aba permitida → sem modal de permissão, hash não é limpo', () => {
    const m = loadMenu({ links: LINKS(), deepLink: { domain: 'water', action: 'settings', tbId: UUID } });
    m.api.emitInitialDashboardState();
    expect(m.openMessageDialog).not.toHaveBeenCalled();
    expect(m.clearDeepLinkHash).not.toHaveBeenCalled();
    expect(m.win.__myioDeepLinkPending).not.toBeNull();
  });

  it('aba restrita no load (restrict_view já filtrou) → modal + hash limpo + aba padrão + pendência cancelada', () => {
    const original = LINKS();
    const links = original.filter((l) => l.stateId !== 'water_content');
    const m = loadMenu({
      links,
      originalLinks: original,
      deepLink: { domain: 'water', action: 'settings', tbId: UUID },
    });
    m.api.emitInitialDashboardState();
    expect(m.openMessageDialog).toHaveBeenCalledTimes(1);
    expect(m.openMessageDialog).toHaveBeenCalledWith({
      title: 'Acesso não permitido',
      message: DENY_MESSAGE,
      severity: 'error',
      buttonLabel: 'OK',
    });
    expect(m.clearDeepLinkHash).toHaveBeenCalledTimes(1);
    expect(m.setDeepLinkHash).not.toHaveBeenCalled(); // redirect sem trilha
    expect(m.states).toEqual(['energy']); // orquestrador/HEADER na aba padrão
    expect(m.scope.links[0].enableLink).toBe(true);
    expect(m.visible()).toEqual(['telemetry_content']);
    expect(m.win.__myioDeepLinkPending).toBeNull();
  });

  it('aba restrita sem o diálogo da lib → sem alert nativo, segue o redirect', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const original = LINKS();
    const m = loadMenu({
      links: original.filter((l) => l.stateId !== 'water_content'),
      originalLinks: original,
      deepLink: { domain: 'water', action: null, tbId: null },
      withDialog: false,
    });
    m.api.emitInitialDashboardState();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(m.clearDeepLinkHash).toHaveBeenCalledTimes(1);
    expect(m.states).toEqual(['energy']);
    alertSpy.mockRestore();
  });

  it('aba restrita sem clearDeepLinkHash da MAIN → limpa o hash via replaceState local', () => {
    const original = LINKS();
    const m = loadMenu({
      links: original.filter((l) => l.stateId !== 'water_content'),
      originalLinks: original,
      deepLink: { domain: 'water', action: null, tbId: null },
      href: 'https://tb.local/dashboards/all/abc?x=1#water',
    });
    delete m.win.MyIOUtils.clearDeepLinkHash;
    m.api.emitInitialDashboardState();
    expect(m.win.history.replaceState).toHaveBeenCalledWith(
      m.win.history.state,
      '',
      'https://tb.local/dashboards/all/abc?x=1'
    );
    expect(m.win.location.hash).toBe('');
    expect(m.states).toEqual(['energy']);
  });

  it('sem deep link → 1ª aba, sem tocar no hash', () => {
    const m = loadMenu({ links: LINKS(), deepLink: null });
    m.api.emitInitialDashboardState();
    expect(m.states).toEqual(['energy']);
    expect(m.setDeepLinkHash).not.toHaveBeenCalled();
    expect(m.clearDeepLinkHash).not.toHaveBeenCalled();
    expect(m.openMessageDialog).not.toHaveBeenCalled();
  });

  it('domínio válido mas sem aba neste painel → limpa o hash, sem modal, 1ª aba', () => {
    const m = loadMenu({ links: LINKS(), deepLink: { domain: 'temperature', action: 'settings', tbId: UUID } });
    m.api.emitInitialDashboardState();
    expect(m.states).toEqual(['energy']);
    expect(m.clearDeepLinkHash).toHaveBeenCalledTimes(1);
    expect(m.openMessageDialog).not.toHaveBeenCalled();
    expect(m.win.__myioDeepLinkPending).toBeNull();
  });

  it('restrict_view chega depois e esconde a aba do link → modal + hash limpo + aba padrão', () => {
    const m = loadMenu({ links: LINKS(), deepLink: { domain: 'water', action: 'settings', tbId: UUID } });
    m.api.emitInitialDashboardState();
    expect(m.openMessageDialog).not.toHaveBeenCalled();
    m.scope.links = m.scope.links.filter((l: any) => l.stateId !== 'water_content'); // applyMenuFeatureVisibility
    m.api._onDeepLinkFeatureVisibility();
    expect(m.openMessageDialog).toHaveBeenCalledTimes(1);
    expect((m.openMessageDialog.mock.calls[0] as any[])[0].message).toBe(DENY_MESSAGE);
    expect(m.clearDeepLinkHash).toHaveBeenCalledTimes(1);
    expect(m.states).toEqual(['water', 'energy']);
    expect(m.visible()).toEqual(['telemetry_content']);
    expect(m.setDeepLinkHash).not.toHaveBeenCalled();
    expect(m.win.__myioDeepLinkPending).toBeNull();
  });

  it('restrict_view tardio sem restrição → nada muda', () => {
    const m = loadMenu({ links: LINKS(), deepLink: { domain: 'water', action: null, tbId: null } });
    m.api.emitInitialDashboardState();
    m.api._onDeepLinkFeatureVisibility();
    expect(m.openMessageDialog).not.toHaveBeenCalled();
    expect(m.states).toEqual(['water']);
  });

  it('restrict_view depois de um clique do usuário → não mexe', () => {
    const m = loadMenu({ links: LINKS(), deepLink: { domain: 'water', action: null, tbId: null } });
    m.api.emitInitialDashboardState();
    m.scope.changeDashboardState({ preventDefault() {} }, 'alarm_content', 2);
    m.scope.links = m.scope.links.filter((l: any) => l.stateId !== 'water_content');
    m.api._onDeepLinkFeatureVisibility();
    expect(m.states).toEqual(['water', 'alarm']);
  });
});

describe('ED-1400 MENU — troca de aba grava o hash', () => {
  it('abas com domínio gravam #<domain>', () => {
    const m = loadMenu({ links: LINKS() });
    m.scope.changeDashboardState({ preventDefault() {} }, 'alarm_content', 2);
    expect(m.setDeepLinkHash).toHaveBeenLastCalledWith({ domain: 'alarm' });
  });

  it('Relatórios / Metas abrem modais e nunca gravam hash', () => {
    const m = loadMenu({ links: LINKS() });
    m.scope.changeDashboardState({ preventDefault() {} }, 'reports', 3);
    m.scope.changeDashboardState({ preventDefault() {} }, 'goals', 4);
    expect(m.openReportsPickerModal).toHaveBeenCalledTimes(1);
    expect(m.openGoalsModal).toHaveBeenCalledTimes(1);
    expect(m.setDeepLinkHash).not.toHaveBeenCalled();
    expect(m.states).toEqual([]);
  });

  it('deep link nunca seleciona Relatórios/Metas', () => {
    const links = [
      { stateId: 'water_content', content: 'Relatórios de água' },
      { stateId: 'water_content', content: 'Água' },
    ];
    const m = loadMenu({ links, deepLink: { domain: 'water', action: null, tbId: null } });
    m.api.emitInitialDashboardState();
    expect(m.openReportsPickerModal).not.toHaveBeenCalled();
    expect(m.scope.links[1].enableLink).toBe(true);
  });

  it('sem o helper da MAIN → fallback local com replaceState (só o hash)', () => {
    const m = loadMenu({ links: LINKS(), withHelper: false, href: 'https://tb.local/d?state=s#energy' });
    m.scope.changeDashboardState({ preventDefault() {} }, 'water_content', 1);
    expect(m.win.history.replaceState).toHaveBeenCalledWith(m.win.history.state, '', 'https://tb.local/d?state=s#water');
  });
});

// ─────────────────────────────── TELEMETRY ───────────────────────────────
const TLM_SRC = readControllerSource('TELEMETRY').replace(/\r\n/g, '\n');

function loadTelemetry(widgetDomain: string, manual = false) {
  const win = makeWindow('https://tb.local/d');
  win.MyIOUtils = { setDeepLinkHash: vi.fn() };
  const code = [
    extractFunction(TLM_SRC, '_deepLinkTabDomain'),
    extractFunction(TLM_SRC, '_writeDeepLinkHash'),
    extractFunction(TLM_SRC, '_onOpenDeviceSettings'),
    'return { _onOpenDeviceSettings, _deepLinkTabDomain, _writeDeepLinkHash };',
  ].join('\n');
  const map = new Map<string, any>();
  // eslint-disable-next-line no-new-func
  const api = new Function('window', 'LogHelper', 'WIDGET_DOMAIN', '_isManualWidget', '_settingsOpenerByTbId', code)(
    win,
    LOG,
    widgetDomain,
    () => manual,
    map
  );
  win.addEventListener('myio:open-device-settings', api._onOpenDeviceSettings);
  const open = (detail: any) => {
    const d = { handled: false, ...detail };
    win.dispatchEvent(new CustomEvent('myio:open-device-settings', { detail: d }));
    return d;
  };
  return { win, api, map, open };
}

describe('ED-1400 TELEMETRY — myio:open-device-settings', () => {
  it('tbId conhecido (mesmo domínio) → chama o opener do card (mesmo caminho do clique)', async () => {
    const t = loadTelemetry('water');
    const opener = vi.fn(async () => {});
    t.map.set(UUID, opener);
    const d = t.open({ domain: 'water', tbId: UUID.toUpperCase() });
    expect(d.handled).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(opener).toHaveBeenCalledTimes(1);
  });

  it('tbId desconhecido → nada', async () => {
    const t = loadTelemetry('water');
    const opener = vi.fn();
    t.map.set(UUID, opener);
    const d = t.open({ domain: 'water', tbId: '11111111-2222-4333-8444-555555555555' });
    await Promise.resolve();
    expect(d.handled).toBe(false);
    expect(opener).not.toHaveBeenCalled();
  });

  it('outro domínio ou já tratado → nada', async () => {
    const t = loadTelemetry('energy');
    const opener = vi.fn();
    t.map.set(UUID, opener);
    expect(t.open({ domain: 'water', tbId: UUID }).handled).toBe(false);
    t.open({ domain: 'energy', tbId: UUID, handled: true });
    await Promise.resolve();
    expect(opener).not.toHaveBeenCalled();
  });

  it('domínio da aba: widget manual → manual; tank → water', () => {
    expect(loadTelemetry('energy', true).api._deepLinkTabDomain()).toBe('manual');
    expect(loadTelemetry('tank').api._deepLinkTabDomain()).toBe('water');
    expect(loadTelemetry('temperature').api._deepLinkTabDomain()).toBe('temperature');
  });

  it('_writeDeepLinkHash delega para MyIOUtils.setDeepLinkHash', () => {
    const t = loadTelemetry('energy');
    t.api._writeDeepLinkHash({ domain: 'energy', action: 'settings', tbId: UUID });
    expect(t.win.MyIOUtils.setDeepLinkHash).toHaveBeenCalledWith({ domain: 'energy', action: 'settings', tbId: UUID });
  });

  it('wiring no fonte: opener capturado do handleActionSettings + hash no abrir/fechar/salvar + cleanup', () => {
    expect(TLM_SRC).toContain('handleActionSettings: (_openSettingsForCard = async () => {');
    expect(TLM_SRC).toContain('_settingsOpenerByTbId.set(String(it.tbId).toLowerCase(), _openSettingsForCard)');
    expect(TLM_SRC).toContain("_writeDeepLinkHash({ domain: _dlTab, action: 'settings', tbId });");
    expect((TLM_SRC.match(/_restoreTabHash\(\);/g) || []).length).toBe(3); // onSaved + onClose + catch
    const destroy = extractBlockAfter(TLM_SRC, 'self.onDestroy = function');
    expect(destroy).toContain("window.removeEventListener('myio:open-device-settings', _onOpenDeviceSettings)");
  });
});
