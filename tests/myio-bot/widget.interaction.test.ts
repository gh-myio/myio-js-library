// RFC-0242 — widget interaction: keyboard/focus safety (regression for the 2026-11-25 report:
// typing "clicked" the header `+` / `–`), draggable panel and maximize/restore. jsdom, fake key only.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMyIOBotClient } from '../../src/components/myio-bot';
import { createMyIOBotWidget, type MyIOBotWidgetHandle } from '../../src/components/myio-bot/widget';
import { BASE, conv, fakeResponse, flush, ok, routedFetch, sse, statusData, turn } from './helpers';

let handles: MyIOBotWidgetHandle[] = [];

function mount(routes: Parameters<typeof routedFetch>[0], extra: Record<string, unknown> = {}) {
  const r = routedFetch(routes);
  const client = createMyIOBotClient({ gcdrApiBaseUrl: BASE, auth: { apiKey: 'test-key' }, fetch: r.fetch });
  const w = createMyIOBotWidget({ client, host: { app: 'tests', customerId: 'cust-1' }, ...extra });
  handles.push(w);
  const shadow = () => (document.querySelector('div[data-myio-bot-widget]') as HTMLElement).shadowRoot as ShadowRoot;
  const $ = (sel: string) => shadow().querySelector(sel) as HTMLElement | null;
  return { w, ...r, shadow, $ };
}

const baseRoutes = (over: Parameters<typeof routedFetch>[0] = {}) => ({
  'GET /bot/status': () => ok(statusData()),
  'GET /bot/conversations': () => ok({ items: [] }),
  'POST /bot/conversations': () => ok(conv({ clientThreadKey: 'tests:cust-1:api_key' }), 201),
  'POST /bot/conversations/{id}/messages': () => fakeResponse({ chunks: [sse(['delta', { text: 'Olá' }]), sse(['done', turn()])] }),
  ...over,
});

function typeAndSend(input: HTMLTextAreaElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
}

const posts = (calls: Array<{ method: string; path: string }>, path: string) => calls.filter((c) => c.method === 'POST' && c.path === path).length;

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

const pointer = (type: string, x: number, y: number, target: EventTarget, button = 0) =>
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true, composed: true, cancelable: true }));

beforeEach(() => {
  localStorage.clear();
  setViewport(1024, 768);
});

afterEach(() => {
  handles.forEach((h) => h.destroy());
  handles = [];
  document.body.innerHTML = '';
});

describe('focus and keyboard safety (regression)', () => {
  it('two consecutive sends from the composer both hit /messages', async () => {
    const { w, $, calls, shadow } = mount(baseRoutes());
    w.open();
    await flush();
    const ta = $('[data-part="input"]') as HTMLTextAreaElement;
    typeAndSend(ta, 'quais centrais estão offline?');
    await flush(20);
    typeAndSend(ta, 'inativar elevadores do Moxuara');
    await flush(20);
    expect(calls.filter((c) => c.path.endsWith('/messages'))).toHaveLength(2);
    expect(posts(calls, '/bot/conversations')).toBe(1);
    expect(shadow().querySelectorAll('.msg')).toHaveLength(4);
    expect(localStorage.getItem('myio:bot:launcherHidden')).toBeNull();
  });

  it('focus returns to the composer after a turn', async () => {
    const { w, $, shadow } = mount(baseRoutes());
    w.open();
    await flush();
    const ta = $('[data-part="input"]') as HTMLTextAreaElement;
    ta.focus();
    typeAndSend(ta, 'oi');
    ta.blur(); // focus wandered off while the answer streamed
    await flush(20);
    expect(shadow().activeElement).toBe(ta);
  });

  it('does not steal focus from a host page field after a turn', async () => {
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    const { w, $ } = mount(baseRoutes());
    w.open();
    await flush();
    typeAndSend($('[data-part="input"]') as HTMLTextAreaElement, 'oi');
    outside.focus();
    await flush(20);
    expect(document.activeElement).toBe(outside);
  });

  it('typing while a header button has focus goes to the composer and never activates it', async () => {
    const { w, $, calls, shadow } = mount(baseRoutes());
    await w.ask('primeira');
    const before = posts(calls, '/bot/conversations');
    for (const part of ['new', 'hide', 'maximize', 'close']) {
      const btn = $(`[data-part="${part}"]`) as HTMLButtonElement;
      btn.focus();
      const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true, cancelable: true });
      btn.dispatchEvent(down);
      expect(down.defaultPrevented, part).toBe(true);
      $('[data-part="input"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true, cancelable: true }));
    }
    await flush();
    const ta = $('[data-part="input"]') as HTMLTextAreaElement;
    expect(shadow().activeElement).toBe(ta);
    expect(ta.value).toBe('    '); // the four spaces went to the composer (the 'a' keydowns on the textarea are native typing)
    expect(posts(calls, '/bot/conversations')).toBe(before);
    expect(localStorage.getItem('myio:bot:launcherHidden')).toBeNull();
    expect(w.isMaximized).toBe(false);
    expect($('[data-part="panel"]')!.style.display).toBe('');
    expect(shadow().querySelectorAll('.msg')).toHaveLength(2);
  });

  it('printable keys typed on a focused button are inserted at the caret', async () => {
    const { w, $ } = mount(baseRoutes());
    await w.ask('oi');
    const plus = $('[data-part="new"]') as HTMLButtonElement;
    plus.focus();
    for (const key of ['o', 'k', ' ', '!']) {
      const target = (plus.getRootNode() as ShadowRoot).activeElement || plus;
      if (target !== $('[data-part="input"]')) target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
      else (target as HTMLTextAreaElement).value += key; // the browser would type it natively
    }
    expect(($('[data-part="input"]') as HTMLTextAreaElement).value).toBe('ok !');
  });

  it('Space keyup on a focused header button is swallowed (no activation)', async () => {
    const { w, $ } = mount(baseRoutes());
    await w.ask('oi');
    const up = new KeyboardEvent('keyup', { key: ' ', bubbles: true, composed: true, cancelable: true });
    $('[data-part="new"]')!.dispatchEvent(up);
    expect(up.defaultPrevented).toBe(true);
  });

  it('pressing a header button with the mouse does not take the focus', async () => {
    const { w, $ } = mount(baseRoutes());
    await w.ask('oi');
    for (const part of ['new', 'hide', 'maximize', 'close']) {
      const md = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      $(`[data-part="${part}"]`)!.dispatchEvent(md);
      expect(md.defaultPrevented, part).toBe(true);
    }
  });

  it('modifier shortcuts and Escape are not redirected; Escape still closes', async () => {
    const { w, $ } = mount(baseRoutes());
    await w.ask('oi');
    const plus = $('[data-part="new"]')!;
    const ctrl = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, composed: true, cancelable: true });
    plus.dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).toBe(false);
    plus.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
    expect($('[data-part="panel"]')!.style.display).toBe('none');
  });

  it('the + button never fires while streaming', async () => {
    let release!: () => void;
    let gated = false;
    const { w, $, calls } = mount(baseRoutes({
      'POST /bot/conversations/{id}/messages': async () => {
        if (gated) await new Promise<void>((r) => { release = r; });
        return fakeResponse({ chunks: [sse(['done', turn()])] });
      },
    }));
    await w.ask('primeira');
    gated = true;
    const p = w.ask('segunda');
    await flush();
    const plus = $('[data-part="new"]') as HTMLButtonElement;
    expect(plus.disabled).toBe(true);
    plus.click();
    plus.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    expect(posts(calls, '/bot/conversations')).toBe(1);
    release();
    await p;
    expect(calls.filter((c) => c.path.endsWith('/messages'))).toHaveLength(2);
    expect(plus.disabled).toBe(false);
  });

  it('repeated activation of + creates a single new thread', async () => {
    const { w, $, calls } = mount(baseRoutes());
    await w.ask('oi');
    const plus = $('[data-part="new"]') as HTMLButtonElement;
    plus.click();
    plus.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    plus.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush(10);
    expect(posts(calls, '/bot/conversations')).toBe(2); // the first thread + exactly one new one
    expect($('[data-part="thread-empty"]')).not.toBeNull();
  });
});

describe('draggable panel', () => {
  it('drags by the header, clamps to the viewport and persists per host', async () => {
    const { w, $ } = mount(baseRoutes());
    w.open();
    await flush();
    const head = $('[data-part="head"]')!;
    const panelEl = $('[data-part="panel"]')!;
    pointer('pointerdown', 10, 10, head);
    expect(panelEl.classList.contains('dragging')).toBe(true);
    pointer('pointermove', 210, 110, document);
    expect(panelEl.style.left).toBe('200px');
    expect(panelEl.style.top).toBe('100px');
    expect(panelEl.classList.contains('moved')).toBe(true); // (jsdom's cssstyle drops `right/bottom: auto`)
    pointer('pointermove', -500, 5000, document); // clamped (jsdom panel size is 0×0)
    expect(panelEl.style.left).toBe('0px');
    expect(panelEl.style.top).toBe('768px');
    pointer('pointermove', 310, 210, document);
    pointer('pointerup', 310, 210, document);
    expect(panelEl.classList.contains('dragging')).toBe(false);
    expect(JSON.parse(localStorage.getItem('myio:bot:panelPos:tests')!)).toEqual({ left: 300, top: 200 });
    pointer('pointermove', 900, 700, document); // no longer dragging
    expect(panelEl.style.left).toBe('300px');
    expect($('[data-part="launcher"]')!.style.left).toBe(''); // the launcher stays at its corner
  });

  it('does not start a drag from header buttons, nor with a non-primary button', async () => {
    const { w, $ } = mount(baseRoutes());
    await w.ask('oi');
    const panelEl = $('[data-part="panel"]')!;
    for (const part of ['new', 'hide', 'maximize', 'close']) {
      pointer('pointerdown', 10, 10, $(`[data-part="${part}"]`)!);
      pointer('pointermove', 200, 200, document);
      pointer('pointerup', 200, 200, document);
    }
    expect(panelEl.style.left).toBe('');
    pointer('pointerdown', 10, 10, $('[data-part="head"]')!, 2);
    pointer('pointermove', 200, 200, document);
    expect(panelEl.style.left).toBe('');
  });

  it('restores the stored position (clamped) on the next mount and re-clamps on resize', async () => {
    localStorage.setItem('myio:bot:panelPos:tests', JSON.stringify({ left: 900, top: 700 }));
    const { w, $ } = mount(baseRoutes());
    w.open();
    await flush();
    const panelEl = $('[data-part="panel"]')!;
    expect(panelEl.style.left).toBe('900px');
    expect(panelEl.style.top).toBe('700px');
    setViewport(800, 600);
    window.dispatchEvent(new Event('resize'));
    expect(panelEl.style.left).toBe('800px');
    expect(panelEl.style.top).toBe('600px');
  });

  it('the position is per host (another host.app keeps its own)', async () => {
    localStorage.setItem('myio:bot:panelPos:tests', JSON.stringify({ left: 123, top: 45 }));
    const { w, $ } = mount(baseRoutes(), { host: { app: 'other-host' } });
    w.open();
    await flush();
    expect($('[data-part="panel"]')!.style.left).toBe('');
  });

  it('resetPosition() and a double-click on the header return the panel to its corner', async () => {
    const { w, $ } = mount(baseRoutes());
    w.open();
    await flush();
    const head = $('[data-part="head"]')!;
    const panelEl = $('[data-part="panel"]')!;
    pointer('pointerdown', 0, 0, head);
    pointer('pointermove', 50, 60, document);
    pointer('pointerup', 50, 60, document);
    expect(localStorage.getItem('myio:bot:panelPos:tests')).not.toBeNull();
    w.resetPosition();
    expect(panelEl.style.left).toBe('');
    expect(localStorage.getItem('myio:bot:panelPos:tests')).toBeNull();
    pointer('pointerdown', 0, 0, head);
    pointer('pointermove', 70, 80, document);
    pointer('pointerup', 70, 80, document);
    head.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(panelEl.style.left).toBe('');
    expect(localStorage.getItem('myio:bot:panelPos:tests')).toBeNull();
  });

  it('draggable: false disables it; small viewports never drag', async () => {
    const a = mount(baseRoutes(), { draggable: false });
    a.w.open();
    await flush();
    pointer('pointerdown', 0, 0, a.$('[data-part="head"]')!);
    pointer('pointermove', 100, 100, document);
    expect(a.$('[data-part="panel"]')!.style.left).toBe('');
    a.w.destroy();
    setViewport(400, 700);
    const b = mount(baseRoutes());
    b.w.open();
    await flush();
    pointer('pointerdown', 0, 0, b.$('[data-part="head"]')!);
    pointer('pointermove', 100, 100, document);
    expect(b.$('[data-part="panel"]')!.style.left).toBe('');
  });

  it('panelPositionKey: null drags without persisting; destroy() removes the listeners', async () => {
    const { w, $ } = mount(baseRoutes(), { panelPositionKey: null });
    w.open();
    await flush();
    const head = $('[data-part="head"]')!;
    const panelEl = $('[data-part="panel"]')!;
    pointer('pointerdown', 0, 0, head);
    pointer('pointermove', 40, 40, document);
    pointer('pointerup', 40, 40, document);
    expect(panelEl.style.left).toBe('40px');
    expect(Object.keys(localStorage).filter((k) => k.startsWith('myio:bot:panelPos:'))).toHaveLength(0);
    pointer('pointerdown', 0, 0, head);
    w.destroy();
    pointer('pointermove', 400, 400, document);
    expect(panelEl.style.left).toBe('40px');
  });
});

describe('maximize / restore', () => {
  it('header button toggles maximize/restore with InfoTooltip-style icons and pt-BR labels; emits events', async () => {
    const { w, $ } = mount(baseRoutes());
    const evs: string[] = [];
    w.on('maximize', () => evs.push('maximize'));
    w.on('restore', () => evs.push('restore'));
    w.open();
    await flush();
    const btn = $('[data-part="maximize"]') as HTMLButtonElement;
    const panelEl = $('[data-part="panel"]')!;
    expect(btn.title).toBe('Maximizar');
    expect(btn.querySelector('svg rect')).not.toBeNull();
    btn.click();
    expect(w.isMaximized).toBe(true);
    expect(panelEl.classList.contains('maximized')).toBe(true);
    expect(btn.title).toBe('Restaurar');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.querySelector('svg path')).not.toBeNull();
    btn.click();
    expect(w.isMaximized).toBe(false);
    expect(panelEl.classList.contains('maximized')).toBe(false);
    expect(btn.title).toBe('Maximizar');
    expect(evs).toEqual(['maximize', 'restore']);
  });

  it('en locale labels', async () => {
    const { w, $ } = mount(baseRoutes(), { locale: 'en' });
    w.open();
    await flush();
    const btn = $('[data-part="maximize"]') as HTMLButtonElement;
    expect(btn.title).toBe('Maximize');
    w.maximize();
    expect(btn.title).toBe('Restore');
  });

  it('dragging is disabled while maximized; restore returns to the previous position', async () => {
    const { w, $ } = mount(baseRoutes());
    w.open();
    await flush();
    const head = $('[data-part="head"]')!;
    const panelEl = $('[data-part="panel"]')!;
    pointer('pointerdown', 0, 0, head);
    pointer('pointermove', 150, 120, document);
    pointer('pointerup', 150, 120, document);
    expect(panelEl.style.left).toBe('150px');
    w.maximize();
    pointer('pointerdown', 0, 0, head);
    pointer('pointermove', 600, 500, document);
    pointer('pointerup', 600, 500, document);
    expect(panelEl.style.left).toBe('150px'); // untouched while maximized (CSS insets win)
    head.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); // no reset while maximized
    expect(localStorage.getItem('myio:bot:panelPos:tests')).not.toBeNull();
    w.restore();
    expect(panelEl.classList.contains('maximized')).toBe(false);
    expect(panelEl.style.left).toBe('150px');
    expect(panelEl.style.top).toBe('120px');
  });

  it('maximize()/restore() are idempotent; Esc still closes a maximized panel', async () => {
    const { w, $ } = mount(baseRoutes());
    const evs: string[] = [];
    w.on('maximize', () => evs.push('m'));
    w.on('restore', () => evs.push('r'));
    w.open();
    await flush();
    w.maximize();
    w.maximize();
    w.restore();
    w.restore();
    expect(evs).toEqual(['m', 'r']);
    w.maximize();
    $('[data-part="input"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect($('[data-part="panel"]')!.style.display).toBe('none');
  });
});

describe('draggable launcher (snaps to corners / edge midpoints)', () => {
  it('nearestAnchor picks the closest of the 8 slots', async () => {
    const { nearestAnchor, anchorPoint } = await import('../../src/components/myio-bot/widget/drag');
    const [vw, vh, w, h] = [1000, 800, 100, 40];
    expect(nearestAnchor(10, 10, w, h, vw, vh)).toBe('tl');
    expect(nearestAnchor(500, 30, w, h, vw, vh)).toBe('tc');
    expect(nearestAnchor(990, 5, w, h, vw, vh)).toBe('tr');
    expect(nearestAnchor(20, 420, w, h, vw, vh)).toBe('ml');
    expect(nearestAnchor(980, 380, w, h, vw, vh)).toBe('mr');
    expect(nearestAnchor(30, 790, w, h, vw, vh)).toBe('bl');
    expect(nearestAnchor(520, 760, w, h, vw, vh)).toBe('bc');
    expect(nearestAnchor(999, 799, w, h, vw, vh)).toBe('br');
    expect(anchorPoint('tc', w, h, vw, vh)).toEqual({ left: 450, top: 24 });
    expect(anchorPoint('mr', w, h, vw, vh)).toEqual({ left: 876, top: 380 });
  });

  it('drags the pill, snaps on release, persists per host and does not toggle the panel', async () => {
    const { w, $ } = mount(baseRoutes());
    const launcher = $('[data-part="launcher"]')!;
    expect(launcher.style.left).toBe(''); // default corner = CSS
    pointer('pointerdown', 1000, 740, launcher);
    pointer('pointermove', 1003, 742, document); // within the click slop → not a drag yet
    expect(launcher.classList.contains('dragging')).toBe(false);
    pointer('pointermove', 30, 40, document);
    expect(launcher.classList.contains('dragging')).toBe(true);
    pointer('pointerup', 30, 40, document);
    launcher.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true })); // the click after a drag
    expect(launcher.getAttribute('data-anchor')).toBe('tl');
    expect(launcher.style.left).toBe('24px');
    expect(launcher.style.top).toBe('24px');
    expect(localStorage.getItem('myio:bot:launcherPos:tests')).toBe('tl');
    expect($('[data-part="panel"]')!.style.display).toBe('none'); // the drag did not open the panel
    launcher.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true })); // a real click still toggles
    expect($('[data-part="panel"]')!.style.display).toBe('');
    w.close();
  });

  it('restores the stored anchor on mount and resetPosition() returns it to the default corner', async () => {
    localStorage.setItem('myio:bot:launcherPos:tests', 'mr');
    const { w, $ } = mount(baseRoutes());
    const launcher = $('[data-part="launcher"]')!;
    expect(launcher.getAttribute('data-anchor')).toBe('mr');
    expect(launcher.style.left).toBe('1000px'); // 1024 − 0 (jsdom width) − 24
    expect(launcher.style.top).toBe('384px');
    w.resetPosition();
    expect(launcher.getAttribute('data-anchor')).toBe('br');
    expect(launcher.style.left).toBe('');
    expect(localStorage.getItem('myio:bot:launcherPos:tests')).toBeNull();
  });

  it('a pill off its default corner places the (not dragged) panel next to it', async () => {
    localStorage.setItem('myio:bot:launcherPos:tests', 'tl');
    const { w, $ } = mount(baseRoutes());
    w.open();
    await flush();
    const panelEl = $('[data-part="panel"]')!;
    expect(panelEl.style.left).toBe('24px');
    expect(panelEl.classList.contains('moved')).toBe(false); // still "default", not a custom drag position
  });

  it('draggable:false keeps the pill fixed', async () => {
    const { $ } = mount(baseRoutes(), { draggable: false });
    const launcher = $('[data-part="launcher"]')!;
    pointer('pointerdown', 1000, 740, launcher);
    pointer('pointermove', 30, 40, document);
    pointer('pointerup', 30, 40, document);
    expect(launcher.style.left).toBe('');
    expect(launcher.hasAttribute('data-anchor')).toBe(false);
  });
});
