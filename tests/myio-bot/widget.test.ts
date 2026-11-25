// RFC-0242 — floating widget (jsdom): launcher, resume, send→stream→footer, access states,
// proposals card, action card, destroy, loader. Fake credentials only.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMyIOBotClient } from '../../src/components/myio-bot';
import { createMyIOBotWidget, openMyIOBotPanel, loadBotWidget, resolveBotWidgetUrl, type MyIOBotWidgetHandle } from '../../src/components/myio-bot/widget';
import { _resetBotWidgetLoader } from '../../src/components/myio-bot/widget/loader';
import { createMyIOBotWidget as shimCreate } from '../../src/components/myio-bot/widget/umdCoreShim';
import { BASE, conv, fail, fakeResponse, flush, ok, routedFetch, sse, statusData, turn } from './helpers';

const CID = '11111111-1111-1111-1111-111111111111';
let handles: MyIOBotWidgetHandle[] = [];

function mount(routes: Parameters<typeof routedFetch>[0], extra: Record<string, unknown> = {}) {
  const r = routedFetch(routes);
  const client = createMyIOBotClient({ gcdrApiBaseUrl: BASE, auth: { apiKey: 'test-key' }, fetch: r.fetch });
  const w = createMyIOBotWidget({ client, host: { app: 'tests', customerId: 'cust-1' }, ...extra });
  handles.push(w);
  const shadow = () => (document.querySelector('[data-myio-bot-widget]') as HTMLElement).shadowRoot as ShadowRoot;
  const $ = (sel: string) => shadow().querySelector(sel) as HTMLElement | null;
  return { w, ...r, shadow, $ };
}

const baseRoutes = (over: Parameters<typeof routedFetch>[0] = {}) => ({
  'GET /bot/status': () => ok(statusData()),
  'GET /bot/conversations': () => ok({ items: [] }),
  'POST /bot/conversations': () => ok(conv({ clientThreadKey: 'tests:cust-1:api_key' }), 201),
  'POST /bot/conversations/{id}/messages': () => fakeResponse({ chunks: [sse(['delta', { text: 'Olá' }]), sse(['delta', { text: ', tudo certo.' }], ['done', turn()])] }),
  ...over,
});

function typeAndSend(input: HTMLTextAreaElement, text: string) {
  input.value = text;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

beforeEach(() => {
  localStorage.clear();
  document.head.querySelectorAll('link[data-myio-bot-font]').forEach((l) => l.remove());
});

afterEach(() => {
  handles.forEach((h) => h.destroy());
  handles = [];
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('launcher', () => {
  it('mounts a "MYIO Bot" pill in a shadow root and adds the Nunito link once', () => {
    const { $ } = mount(baseRoutes());
    const pill = $('[data-part="launcher"]') as HTMLButtonElement;
    expect(pill.textContent).toContain('MYIO Bot');
    expect(pill.classList.contains('right')).toBe(true);
    expect(document.querySelectorAll('link[data-myio-bot-font]')).toHaveLength(1);
    // no global CSS leaks into the page
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('theme.fontLink === false adds no font link; bottom-left positions left', () => {
    const { $ } = mount(baseRoutes(), { theme: { fontLink: false, accent: '#123456' }, position: 'bottom-left' });
    expect(document.querySelector('link[data-myio-bot-font]')).toBeNull();
    expect($('[data-part="launcher"]')!.classList.contains('left')).toBe(true);
  });

  it('hide persists in localStorage and survives a re-mount; open() un-hides', async () => {
    const a = mount(baseRoutes());
    a.$('[data-part="launcher"]')!.click();
    await flush();
    a.$('[data-part="hide"]')!.click();
    expect(localStorage.getItem('myio:bot:launcherHidden')).toBe('1');
    a.w.destroy();
    const b = mount(baseRoutes());
    expect(b.$('[data-part="launcher"]')!.style.display).toBe('none');
    b.w.open();
    expect(localStorage.getItem('myio:bot:launcherHidden')).toBeNull();
    expect(b.$('[data-part="launcher"]')!.style.display).toBe('');
  });

  it('does not call the API before the first open', () => {
    const { calls } = mount(baseRoutes());
    expect(calls).toHaveLength(0);
  });
});

describe('conversation flow', () => {
  it('open → status → empty state; send → stream → footer; resolves the thread by key', async () => {
    const { w, $, calls, shadow } = mount(baseRoutes());
    const turns: unknown[] = [];
    w.on('turn', (t) => turns.push(t));
    w.open();
    await flush();
    expect($('[data-part="empty"]')).not.toBeNull();
    typeAndSend($('[data-part="input"]') as HTMLTextAreaElement, 'oi bot');
    await flush(20);
    const bubbles = Array.from(shadow().querySelectorAll('.msg'));
    expect(bubbles.map((b) => b.getAttribute('data-role'))).toEqual(['user', 'assistant']);
    expect(bubbles[1].textContent).toContain('Olá, tudo certo.');
    const meta = $('[data-part="turn-meta"]')!.textContent!;
    expect(meta).toContain('T1');
    expect(meta).toContain('anthropic');
    expect(meta).toContain('claude-test');
    expect(meta).toContain('10 in / 5 out');
    expect(turns).toHaveLength(1);
    const create = calls.find((c) => c.method === 'POST' && c.path === '/bot/conversations')!;
    expect(create.body).toMatchObject({ clientThreadKey: 'tests:cust-1:api_key' });
    expect(localStorage.getItem('myio:bot:thread:tests:cust-1:api_key')).toBe(CID);
  });

  it('streaming: the launcher pulses and the composer turns into a cancel button', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const { w, $ } = mount(baseRoutes({
      'POST /bot/conversations/{id}/messages': async () => {
        await gate;
        return fakeResponse({ chunks: [sse(['done', turn()])] });
      },
    }));
    w.open();
    await flush();
    typeAndSend($('[data-part="input"]') as HTMLTextAreaElement, 'demora');
    await flush();
    expect($('[data-part="launcher"]')!.classList.contains('streaming')).toBe(true);
    expect($('[data-part="cancel"]')).not.toBeNull();
    expect($('[data-part="streaming"]')).not.toBeNull();
    release();
    await flush(20);
    expect($('[data-part="launcher"]')!.classList.contains('streaming')).toBe(false);
    expect($('[data-part="send"]')).not.toBeNull();
  });

  it('resumes a stored conversation id and strips the context prefix from user messages', async () => {
    localStorage.setItem('myio:bot:thread:tests:cust-1:api_key', CID);
    const { w, shadow, calls } = mount(baseRoutes({
      'GET /bot/conversations/{id}': () => ok({ ...conv({ title: 'Moxuara' }), messages: [
        { id: 1, seq: 1, role: 'user', content: '[Contexto: cliente Moxuara]\nquais centrais?' },
        { id: 2, seq: 2, role: 'assistant', content: 'Todas online.', tier: 'T0', provider: 'local', model: 'm' },
      ] }),
    }));
    w.open();
    await flush();
    const bubbles = Array.from(shadow().querySelectorAll('.msg .bubble'));
    expect(bubbles[0].textContent).toBe('quais centrais?');
    expect(bubbles[1].textContent).toContain('Todas online.');
    expect(shadow().querySelector('[data-part="subtitle"]')!.textContent).toBe('Moxuara');
    expect(calls.some((c) => c.method === 'GET' && c.path === '/bot/conversations')).toBe(false);
  });

  it('resumes by key (list match) when nothing is stored', async () => {
    const { w, shadow } = mount(baseRoutes({
      'GET /bot/conversations': () => ok({ items: [conv({ id: 'k-conv', clientThreadKey: 'host-key' })] }),
      'GET /bot/conversations/{id}': () => ok({ ...conv({ id: 'k-conv' }), messages: [{ id: 1, seq: 1, role: 'user', content: 'antes' }] }),
    }), { thread: { key: 'host-key' } });
    w.open();
    await flush();
    expect(shadow().querySelector('.msg .bubble')!.textContent).toBe('antes');
    expect(localStorage.getItem('myio:bot:thread:host-key')).toBe('k-conv');
  });

  it('ask(): opens, sends and resolves with the turn; sends the host context', async () => {
    const { w, calls } = mount(baseRoutes(), { context: { customerName: 'Moxuara', page: 'telemetry' } });
    const t = await w.ask('status das centrais');
    expect(t.answer).toBe('Olá, tudo certo.');
    const post = calls.find((c) => c.path.endsWith('/messages'))!;
    expect((post.body as { message: string }).message).toBe('[Contexto: cliente Moxuara · página telemetry]\nstatus das centrais');
  });

  it('a failed turn rejects ask(), removes the optimistic message and shows the API message', async () => {
    const { w, shadow, $ } = mount(baseRoutes({ 'POST /bot/conversations/{id}/messages': () => fail(429, 'BOT_BUDGET_EXCEEDED') }));
    const errors: unknown[] = [];
    w.on('error', (e) => errors.push(e));
    await expect(w.ask('caro')).rejects.toMatchObject({ code: 'BOT_BUDGET_EXCEEDED' });
    expect(shadow().querySelectorAll('.msg')).toHaveLength(0);
    expect($('[data-part="alert-error"]')!.textContent).toContain('Orçamento diário excedido');
    expect(errors).toHaveLength(1);
  });

  it('shows the data-policy notice of the turn', async () => {
    const { w, $ } = mount(baseRoutes({ 'POST /bot/conversations/{id}/messages': () => ok(turn({ notice: 'Esta conversa usa um provedor em nuvem.' })) }));
    await w.ask('oi');
    expect($('[data-part="alert-info"]')!.textContent).toContain('provedor em nuvem');
  });

  it('read-only when the conversation is CLOSED', async () => {
    const { w, $ } = mount(baseRoutes({ 'GET /bot/conversations/{id}': () => ok({ ...conv({ status: 'CLOSED' }), messages: [] }) }), { thread: { conversationId: CID } });
    w.open();
    await flush();
    expect($('[data-part="readonly"]')).not.toBeNull();
  });
});

describe('access states', () => {
  const cases: Array<[string, () => unknown, string]> = [
    ['403', () => fail(403, 'FORBIDDEN', 'Sem permissão para esta operação do bot'), 'restricted'],
    ['404', () => fail(404, 'NOT_FOUND', 'Route not found'), 'disabled'],
    ['503', () => fail(503, 'BOT_DISABLED', 'O bot da MYIO está desligado'), 'off'],
  ];
  for (const [label, route, state] of cases) {
    it(`${label} → ${state} card with the API message, muted pill, no composer`, async () => {
      const { w, $ } = mount(baseRoutes({ 'GET /bot/status': route }));
      w.open();
      await flush();
      expect($(`[data-state="${state}"]`)).not.toBeNull();
      expect($('[data-part="state-message"]')!.textContent!.length).toBeGreaterThan(0);
      expect($('[data-part="launcher"]')!.classList.contains('muted')).toBe(true);
      expect($('[data-part="composer"]')!.style.display).toBe('none');
    });
  }

  it('offline (fetch rejects) → offline card; retry recovers', async () => {
    let down = true;
    const { w, $ } = mount(baseRoutes({ 'GET /bot/status': () => { if (down) throw new TypeError('Failed to fetch'); return ok(statusData()); } }));
    w.open();
    await flush();
    expect($('[data-state="offline"]')!.textContent).toContain('Sem conexão com o GCDR');
    down = false;
    $('[data-action="retry"]')!.click();
    await flush();
    expect($('[data-state="offline"]')).toBeNull();
    expect($('[data-part="empty"]')).not.toBeNull();
  });

  it('status without permissions.use → restricted; master off → off', async () => {
    const a = mount(baseRoutes({ 'GET /bot/status': () => ok(statusData({ permissions: { use: false } })) }));
    a.w.open();
    await flush();
    expect(a.$('[data-state="restricted"]')).not.toBeNull();
    a.w.destroy();
    const b = mount(baseRoutes({ 'GET /bot/status': () => ok(statusData({ master: false })) }));
    b.w.open();
    await flush();
    expect(b.$('[data-state="off"]')).not.toBeNull();
  });
});

describe('proposals card', () => {
  const proposals = [
    { id: 'p1', summary: 'Moxuara tem 2 centrais', kind: 'FACT', scopeType: 'CUSTOMER', status: 'DRAFT' },
    { id: 'p2', summary: 'Prefiro kWh', kind: 'PREFERENCE', scopeType: 'USER', status: 'DRAFT' },
  ];

  it('curator: Aprovar / Descartar call PATCH /bot/memories/{id}', async () => {
    const { w, $, calls } = mount(baseRoutes({
      'GET /bot/status': () => ok(statusData({ kind: 'USER', permissions: { use: true, curate: true, curateAll: false, operate: false } })),
      'POST /bot/conversations/{id}/messages': () => ok(turn({ proposals })),
      'PATCH /bot/memories/{id}': () => ok({ id: 'x' }),
    }));
    await w.ask('lembra disso');
    expect($('[data-part="proposals"]')!.textContent).toContain('O bot propôs 2 memórias');
    ($('[data-proposal="p1"] [data-action="approve"]') as HTMLButtonElement).click();
    await flush();
    ($('[data-proposal="p2"] [data-action="reject"]') as HTMLButtonElement).click();
    await flush();
    const patches = calls.filter((c) => c.method === 'PATCH');
    expect(patches.map((c) => [c.path, (c.body as { action: string }).action])).toEqual([
      ['/bot/memories/p1', 'approve'],
      ['/bot/memories/p2', 'reject'],
    ]);
    expect($('[data-part="proposals"]')).toBeNull();
  });

  it('non-curator: shared-scope proposals only get OK (dismiss), no API call', async () => {
    const { w, $, calls } = mount(baseRoutes({ 'POST /bot/conversations/{id}/messages': () => ok(turn({ proposals: [proposals[0]] })) }));
    await w.ask('lembra');
    expect($('[data-action="approve"]')).toBeNull();
    ($('[data-action="dismiss"]') as HTMLButtonElement).click();
    expect($('[data-part="proposals"]')).toBeNull();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });
});

describe('action card (D-20)', () => {
  const pendingAction = {
    id: 'act-1', tool: 'devices.deactivate', summary: 'Inativar 3 elevadores do Moxuara',
    arguments: { customer: 'Moxuara', category: 'ELEVADOR' }, affectedCount: 3,
    expiresAt: new Date(Date.now() + 90_000).toISOString(),
  };

  it('is not rendered when the turn has no pendingAction', async () => {
    const { w, $ } = mount(baseRoutes());
    await w.ask('oi');
    expect($('[data-part="action-card"]')).toBeNull();
  });

  it('renders summary, arguments, count, countdown and badge; Confirmar calls the API', async () => {
    const { w, $, calls } = mount(baseRoutes({
      'POST /bot/conversations/{id}/messages': () => ok(turn({ pendingAction })),
      'POST /bot/actions/{id}/confirm': () => ok({ id: 'act-1', summary: '3 elevadores inativados.' }),
    }));
    const actions: unknown[] = [];
    w.on('action', (a) => actions.push(a));
    await w.ask('inativa os elevadores');
    const card = $('[data-part="action-card"]')!;
    expect(card.textContent).toContain('Inativar 3 elevadores do Moxuara');
    expect(card.textContent).toContain('ELEVADOR');
    expect($('[data-part="action-affected"]')!.textContent).toContain('3');
    expect($('[data-part="action-countdown"]')!.textContent).toMatch(/Expira em/);
    expect($('[data-part="launcher"]')!.textContent).toContain('1 ação aguardando');
    ($('[data-action="confirm"]') as HTMLButtonElement).click();
    await flush();
    expect(calls.some((c) => c.path === '/bot/actions/act-1/confirm')).toBe(true);
    expect($('[data-part="action-card"]')).toBeNull();
    expect(actions[0]).toMatchObject({ type: 'confirmed' });
  });

  it('Cancelar calls cancel; a 404 (GCDR without D-20) shows an error and keeps the card', async () => {
    const { w, $, calls } = mount(baseRoutes({ 'POST /bot/conversations/{id}/messages': () => ok(turn({ pendingAction })) }));
    await w.ask('inativa');
    ($('[data-action="cancel"]') as HTMLButtonElement).click();
    await flush();
    expect(calls.some((c) => c.path === '/bot/actions/act-1/cancel')).toBe(true);
    expect($('[data-part="alert-error"]')).not.toBeNull();
    expect($('[data-part="action-card"]')).not.toBeNull();
  });

  it('expired actions disable Confirmar', async () => {
    const { w, $ } = mount(baseRoutes({ 'POST /bot/conversations/{id}/messages': () => ok(turn({ pendingAction: { ...pendingAction, expiresAt: new Date(Date.now() - 1000).toISOString() } })) }));
    await w.ask('inativa');
    expect(($('[data-action="confirm"]') as HTMLButtonElement).disabled).toBe(true);
    expect($('[data-part="action-countdown"]')!.textContent).toContain('Expirada');
  });
});

describe('lifecycle', () => {
  it('destroy() leaves no node (widget host and font link removed)', async () => {
    const { w } = mount(baseRoutes());
    w.open();
    await flush();
    w.destroy();
    expect(document.querySelector('[data-myio-bot-widget]')).toBeNull();
    expect(document.querySelector('link[data-myio-bot-font]')).toBeNull();
    expect(document.body.children).toHaveLength(0);
  });

  it('openMyIOBotPanel: no launcher, starts open, close destroys it', async () => {
    const r = routedFetch(baseRoutes());
    const client = createMyIOBotClient({ gcdrApiBaseUrl: BASE, auth: { apiKey: 'test-key' }, fetch: r.fetch });
    const p = openMyIOBotPanel({ client, host: { app: 'tests' }, locale: 'en' });
    handles.push(p);
    await flush();
    const shadow = (document.querySelector('[data-myio-bot-widget]') as HTMLElement).shadowRoot!;
    expect(shadow.querySelector('[data-part="launcher"]')).toBeNull();
    expect(shadow.querySelector('[data-part="panel"]')!.style.display).toBe('');
    expect(shadow.querySelector('[data-part="empty"]')!.textContent).toContain('How can I help?');
    p.close();
    expect(document.querySelector('[data-myio-bot-widget]')).toBeNull();
  });

  it('Escape closes the panel and emits close', async () => {
    const { w, $ } = mount(baseRoutes());
    const evs: string[] = [];
    w.on('open', () => evs.push('open'));
    w.on('close', () => evs.push('close'));
    w.open();
    await flush();
    $('[data-part="panel"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(evs).toEqual(['open', 'close']);
    expect($('[data-part="panel"]')!.style.display).toBe('none');
  });

  it('gcdrWebUrl enables "Abrir no GCDR" with the conversation id', async () => {
    const { w, $ } = mount(baseRoutes(), { gcdrWebUrl: 'https://gcdr-web.test/' });
    await w.ask('oi');
    expect($('[data-part="open-gcdr"]')!.getAttribute('href')).toBe(`https://gcdr-web.test/bot#chat?c=${CID}`);
  });
});

describe('loadBotWidget / UMD core shim', () => {
  beforeEach(() => {
    _resetBotWidgetLoader();
    delete (window as unknown as { MyIOBotWidget?: unknown }).MyIOBotWidget;
    document.head.querySelectorAll('script[data-myio-bot-widget-script]').forEach((s) => s.remove());
  });

  it('derives the widget URL from the core script (same version, same flavour)', () => {
    expect(resolveBotWidgetUrl({}, 'https://unpkg.com/myio-js-library@0.1.600/dist/myio-js-library.umd.min.js'))
      .toBe('https://unpkg.com/myio-js-library@0.1.600/dist/myio-bot-widget.umd.min.js');
    expect(resolveBotWidgetUrl({}, 'https://cdn.test/lib/myio-js-library.umd.js?v=3'))
      .toBe('https://cdn.test/lib/myio-bot-widget.umd.js');
    expect(resolveBotWidgetUrl({ baseUrl: 'https://x.test/dist' }, '')).toBe('https://x.test/dist/myio-bot-widget.umd.min.js');
    expect(resolveBotWidgetUrl({ src: 'https://y.test/w.js' }, '')).toBe('https://y.test/w.js');
    expect(resolveBotWidgetUrl({}, '')).toBeNull();
  });

  it('resolves immediately when window.MyIOBotWidget exists', async () => {
    const g = { createMyIOBotWidget: vi.fn(), openMyIOBotPanel: vi.fn() };
    (window as unknown as { MyIOBotWidget: unknown }).MyIOBotWidget = g;
    await expect(loadBotWidget()).resolves.toBe(g);
  });

  it('injects the script once and resolves the global on load', async () => {
    const p1 = loadBotWidget({ baseUrl: 'https://cdn.test/dist/' });
    const p2 = loadBotWidget({ baseUrl: 'https://cdn.test/dist/' });
    expect(p1).toBe(p2);
    const scripts = document.querySelectorAll('script[data-myio-bot-widget-script]');
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe('https://cdn.test/dist/myio-bot-widget.umd.min.js');
    const g = { createMyIOBotWidget: vi.fn(), openMyIOBotPanel: vi.fn() };
    (window as unknown as { MyIOBotWidget: unknown }).MyIOBotWidget = g;
    scripts[0].dispatchEvent(new Event('load'));
    await expect(p1).resolves.toBe(g);
  });

  it('rejects with WIDGET_LOAD_FAILED after 10 s', async () => {
    vi.useFakeTimers();
    const p = loadBotWidget({ baseUrl: 'https://cdn.test/dist/' });
    const assertion = expect(p).rejects.toMatchObject({ code: 'WIDGET_LOAD_FAILED' });
    vi.advanceTimersByTime(10_001);
    await assertion;
    expect(document.querySelector('script[data-myio-bot-widget-script]')).toBeNull();
  });

  it('rejects with WIDGET_LOAD_FAILED on script error and when no URL can be derived', async () => {
    const p = loadBotWidget({ baseUrl: 'https://cdn.test/dist/' });
    document.querySelector('script[data-myio-bot-widget-script]')!.dispatchEvent(new Event('error'));
    await expect(p).rejects.toMatchObject({ code: 'WIDGET_LOAD_FAILED' });
    await expect(loadBotWidget()).rejects.toMatchObject({ code: 'WIDGET_LOAD_FAILED' });
  });

  it('UMD core shim: WIDGET_NOT_LOADED before loadBotWidget, delegates after', () => {
    expect(() => shimCreate({ host: { app: 'x' } })).toThrow(/loadBotWidget/);
    const handle = { open: vi.fn() };
    (window as unknown as { MyIOBotWidget: unknown }).MyIOBotWidget = { createMyIOBotWidget: vi.fn(() => handle), openMyIOBotPanel: vi.fn() };
    expect(shimCreate({ host: { app: 'x' } })).toBe(handle);
  });
});
