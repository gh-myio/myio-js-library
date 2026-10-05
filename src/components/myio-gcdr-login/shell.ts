/**
 * RFC-0236 §2 — Layer 1: the screen skeleton (GCDR AuthSplitLayout +
 * wallpaper + AuthCardPanel + AuthBuildInfo + theme/language controls).
 * @experimental until a spike of GCDR's real /qr-code runs on it (R4-C3).
 */
import { renderAbout, renderSignedOutPrompt, type AboutOptions } from './about';
import { h, icon, prefersDark, safeCall, storageGet, storageSet } from './dom';
import { detectLocale, localize, translate, type Overrides } from './i18n';
import { ICONS } from './icons';
import { acquireStyles } from './styles';
import type {
  MyioGcdrBuiltInSlot,
  MyioGcdrLocale,
  MyioGcdrPanelOptions,
  MyioGcdrSetSlotOptions,
  MyioGcdrShellHandle,
  MyioGcdrShellOptions,
  MyioGcdrShellSize,
  MyioGcdrShellWidth,
  MyioGcdrSlotContext,
  MyioGcdrSlotName,
  MyioGcdrSlotRenderer,
  MyioGcdrTheme,
  MyioGcdrThemeSetting,
} from './types';

const SLOT_NAMES: MyioGcdrSlotName[] = ['top', 'topRight', 'aside', 'main', 'below'];

/** Extra wiring the login view passes to its own shell (not public). */
export interface ShellInternals {
  messages?: Overrides;
  logoUrl?: string;
  about?: Omit<AboutOptions, 'healthUrl'>;
}

interface SlotState {
  el: HTMLElement;
  kind: 'empty' | 'builtIn' | 'host';
  cleanup?: () => void;
  abort?: AbortController;
  busy: boolean;
  pending?: { content: MyioGcdrSlotRenderer | MyioGcdrBuiltInSlot | null; opts?: MyioGcdrSetSlotOptions };
}

export interface ShellImpl extends MyioGcdrShellHandle {
  /** Internal: translator bound to the current locale. */
  t(key: string, vars?: Record<string, string | number>): string;
  /** Internal: build a slot context for an arbitrary element (used by the view's card). */
  contextFor(el: HTMLElement, signal: AbortSignal): MyioGcdrSlotContext;
  /** Internal: emitter for theme/locale (view listens). */
  onChange(fn: (what: 'theme' | 'locale') => void): () => void;
  announce(text: string): void;
}

export function buildPanel(
  doc: Document,
  el: HTMLElement,
  opts: MyioGcdrPanelOptions,
  locale: MyioGcdrLocale,
  defaultLogoUrl?: string
): { root: HTMLElement; body: HTMLElement; footer?: HTMLElement; title?: HTMLElement } {
  const root = h(doc, 'section', { class: 'myio-gcdr-panel', 'data-fill': opts.fill ? 'true' : null });
  if (opts.accent) root.style.setProperty('--myio-gcdr-accent', opts.accent);
  if (opts.bandColor) root.style.setProperty('--myio-gcdr-band', opts.bandColor);
  if (opts.tint) root.style.setProperty('--myio-gcdr-tint', opts.tint);
  const band = h(doc, 'header', { class: 'myio-gcdr-panel__band' });
  if (opts.tint) band.appendChild(h(doc, 'span', { class: 'myio-gcdr-panel__tint', 'aria-hidden': 'true' }));
  band.appendChild(h(doc, 'span', { class: 'myio-gcdr-panel__eyebrow', text: localize(opts.eyebrow, locale) }));
  if (opts.logo !== false) {
    const url = opts.logoUrl ?? defaultLogoUrl;
    const wordmark = () => h(doc, 'span', { class: 'myio-gcdr-panel__wordmark', text: 'MYIO' });
    if (url) {
      const img = h(doc, 'img', { class: 'myio-gcdr-panel__logo', src: url, alt: 'MYIO' });
      img.addEventListener('error', () => img.replaceWith(wordmark()), { once: true });
      band.appendChild(img);
    } else band.appendChild(wordmark());
  }
  root.appendChild(band);
  const body = h(doc, 'div', { class: 'myio-gcdr-panel__body' });
  let title: HTMLElement | undefined;
  if (opts.title) {
    title = h(doc, 'h1', { class: 'myio-gcdr-panel__title', text: localize(opts.title, locale), tabindex: '-1' });
    body.appendChild(title);
  }
  root.appendChild(body);
  let footer: HTMLElement | undefined;
  if (opts.footer) {
    footer = h(doc, 'footer', { class: 'myio-gcdr-panel__footer' });
    root.appendChild(footer);
  }
  el.appendChild(root);
  return { root, body, footer, title };
}

export function createShellImpl(container: HTMLElement, options: MyioGcdrShellOptions = {}, internals: ShellInternals = {}): ShellImpl {
  if (!(container instanceof HTMLElement)) throw new TypeError('[MYIO Login] container must be an HTMLElement');
  const doc = container.ownerDocument;
  const prefix = options.storageKeyPrefix ?? 'myio.login.';
  const releaseStyles = acquireStyles(container, { nonce: options.cspNonce, loadFont: options.fonts?.load !== false });

  let themeSetting: MyioGcdrThemeSetting =
    options.theme ?? ((storageGet(`${prefix}theme`) as MyioGcdrTheme | null) || 'system');
  let locale: MyioGcdrLocale = options.locale ?? detectLocale(storageGet(`${prefix}locale`));
  let size: MyioGcdrShellSize = options.size ?? 'md';
  let width: MyioGcdrShellWidth = options.width ?? 'auto';
  const show = { themeToggle: options.show?.themeToggle !== false, languageSelector: options.show?.languageSelector !== false };
  const listeners = new Set<(w: 'theme' | 'locale') => void>();
  let destroyed = false;

  const resolvedTheme = (): MyioGcdrTheme => (themeSetting === 'system' ? (prefersDark() ? 'dark' : 'light') : themeSetting);
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars, internals.messages);

  container.textContent = '';
  const root = h(doc, 'div', {
    class: 'myio-gcdr-shell',
    'data-theme': resolvedTheme(),
    'data-size': size,
    'data-width': width,
    'data-aside-compact': options.asideCompact ?? 'hide',
    'data-has-aside': 'false',
    lang: locale,
  });
  const wallpaper = h(doc, 'div', { class: 'myio-gcdr-shell__wallpaper', 'aria-hidden': 'true' });
  const live = h(doc, 'div', { class: 'myio-gcdr-sr', 'aria-live': 'polite', role: 'status' });
  const top = h(doc, 'div', { class: 'myio-gcdr-shell__top myio-gcdr-shell__slot', hidden: true });
  const block = h(doc, 'div', { class: 'myio-gcdr-shell__block' });
  const toprow = h(doc, 'div', { class: 'myio-gcdr-shell__toprow' });
  const pill = h(doc, 'div', { class: 'myio-gcdr-shell__pill' });
  const langBtn = h(doc, 'button', { type: 'button', class: 'myio-gcdr-shell__iconbtn' });
  const themeBtn = h(doc, 'button', { type: 'button', class: 'myio-gcdr-shell__iconbtn' });
  const topRight = h(doc, 'div', { class: 'myio-gcdr-shell__slot', style: 'display:contents' });
  pill.append(langBtn, themeBtn, topRight);
  toprow.appendChild(pill);
  const split = h(doc, 'div', { class: 'myio-gcdr-shell__split' });
  const aside = h(doc, 'section', { class: 'myio-gcdr-shell__aside myio-gcdr-shell__slot', hidden: true, tabindex: '-1' });
  const main = h(doc, 'section', { class: 'myio-gcdr-shell__main myio-gcdr-shell__slot', tabindex: '-1' });
  split.append(aside, main);
  const below = h(doc, 'div', { class: 'myio-gcdr-shell__below myio-gcdr-shell__slot', hidden: true });
  block.append(toprow, split, below);
  root.append(wallpaper, live, top, block);
  container.appendChild(root);

  const applyWallpaper = () => {
    const wp = options.wallpaper;
    if (wp === false) { wallpaper.hidden = true; return; }
    wallpaper.hidden = false;
    const dark = resolvedTheme() === 'dark';
    let portrait = false;
    try { portrait = typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches; } catch { /* noop */ }
    const url = wp ? (dark ? (portrait ? wp.mobileDark ?? wp.dark : wp.dark) : (portrait ? wp.mobileLight ?? wp.light : wp.light)) : undefined;
    if (url) wallpaper.style.setProperty('--myio-gcdr-wp', `url("${url.replace(/"/g, '%22')}")`);
    else wallpaper.style.removeProperty('--myio-gcdr-wp');
  };

  const renderControls = () => {
    langBtn.hidden = !show.languageSelector;
    themeBtn.hidden = !show.themeToggle;
    langBtn.textContent = '';
    langBtn.append(icon(doc, ICONS.globe(16)), h(doc, 'span', { text: locale === 'en' ? 'EN' : 'PT' }));
    langBtn.setAttribute('aria-label', `${t('toolbar.language')}: ${locale === 'en' ? 'English' : 'Português'}`);
    const dark = resolvedTheme() === 'dark';
    themeBtn.textContent = '';
    themeBtn.append(icon(doc, dark ? ICONS.sun(16) : ICONS.moon(16)));
    const lbl = dark ? t('toolbar.toLight') : t('toolbar.toDark');
    themeBtn.setAttribute('aria-label', lbl);
    themeBtn.setAttribute('title', lbl);
  };

  const emit = (what: 'theme' | 'locale') => {
    for (const fn of Array.from(listeners)) safeCall('listener', fn, what);
  };

  const applyTheme = () => {
    root.setAttribute('data-theme', resolvedTheme());
    applyWallpaper();
    renderControls();
    emit('theme');
  };
  const applyLocale = () => {
    root.setAttribute('lang', locale);
    renderControls();
    emit('locale');
  };

  langBtn.addEventListener('click', () => {
    locale = locale === 'en' ? 'pt-BR' : 'en';
    storageSet(`${prefix}locale`, locale);
    applyLocale();
    safeCall('onLocaleChange', options.onLocaleChange, locale);
  });
  themeBtn.addEventListener('click', () => {
    themeSetting = resolvedTheme() === 'dark' ? 'light' : 'dark';
    storageSet(`${prefix}theme`, themeSetting);
    applyTheme();
    safeCall('onThemeChange', options.onThemeChange, themeSetting);
  });

  let mql: MediaQueryList | null = null;
  const onScheme = () => { if (themeSetting === 'system') applyTheme(); };
  try {
    if (typeof matchMedia === 'function') {
      mql = matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener?.('change', onScheme);
    }
  } catch { mql = null; }

  const contextFor = (el: HTMLElement, signal: AbortSignal): MyioGcdrSlotContext => ({
    get theme() { return resolvedTheme(); },
    get locale() { return locale; },
    signal,
    on(event, fn) {
      const l = (w: 'theme' | 'locale') => { if (w === event) fn(event === 'theme' ? resolvedTheme() : locale); };
      listeners.add(l);
      const off = () => listeners.delete(l);
      signal.addEventListener('abort', off, { once: true });
      return off;
    },
    panel: (opts) => buildPanel(doc, el, opts, locale, internals.logoUrl),
  });

  const slots = {} as Record<MyioGcdrSlotName, SlotState>;
  const slotEls: Record<MyioGcdrSlotName, HTMLElement> = { top, topRight, aside, main, below };
  for (const n of SLOT_NAMES) slots[n] = { el: slotEls[n], kind: 'empty', busy: false };

  const updateLayoutFlags = () => {
    root.setAttribute('data-has-aside', slots.aside.kind === 'empty' ? 'false' : 'true');
    aside.hidden = slots.aside.kind === 'empty';
    below.hidden = slots.below.kind === 'empty';
    top.hidden = slots.top.kind === 'empty';
  };

  const renderBuiltIn = (name: MyioGcdrSlotName, el: HTMLElement, ctx: MyioGcdrSlotContext, b: MyioGcdrBuiltInSlot): void | (() => void) => {
    if (b.kind === 'buildInfo') {
      if (name !== 'below') throw new TypeError('[MYIO Login] buildInfo is only valid in the below slot');
      el.appendChild(h(doc, 'p', { class: 'myio-gcdr-shell__build', text: b.text }));
      return;
    }
    if (name !== 'aside') throw new TypeError(`[MYIO Login] ${b.kind} is only valid in the aside slot`);
    if (b.kind === 'about') {
      const cleanupAbout = renderAbout(el, ctx, t, { ...internals.about, healthUrl: b.healthUrl ?? false });
      // re-render texts on locale change
      const off = ctx.on('locale', () => { cleanupAbout(); el.textContent = ''; renderAbout(el, ctx, t, { ...internals.about, healthUrl: b.healthUrl ?? false }); });
      return () => { off(); cleanupAbout(); };
    }
    const text = () => (b.text ? localize(b.text, locale) : t('aside.signedOutPrompt'));
    renderSignedOutPrompt(el, ctx, text());
    const off = ctx.on('locale', () => { el.textContent = ''; renderSignedOutPrompt(el, ctx, text()); });
    return off;
  };

  const setSlot = (name: MyioGcdrSlotName, content: MyioGcdrSlotRenderer | MyioGcdrBuiltInSlot | null, opts?: MyioGcdrSetSlotOptions) => {
    if (destroyed) return;
    if (!SLOT_NAMES.includes(name)) throw new TypeError(`[MYIO Login] unknown slot "${String(name)}"`);
    const s = slots[name];
    if (s.busy) {
      // Called from inside this slot's renderer/cleanup: defer to a microtask (R4-C1).
      s.pending = { content, opts };
      queueMicrotask(() => {
        const p = s.pending;
        s.pending = undefined;
        if (p) setSlot(name, p.content, p.opts);
      });
      return;
    }
    const hadFocus = !!doc.activeElement && s.el.contains(doc.activeElement);
    s.busy = true;
    try {
      s.abort?.abort();
      if (s.cleanup) safeCall('slot cleanup', s.cleanup);
      s.cleanup = undefined;
      s.el.textContent = '';
      s.kind = 'empty';
      if (content) {
        const ac = new AbortController();
        s.abort = ac;
        const ctx = contextFor(s.el, ac.signal);
        try {
          const r = typeof content === 'function' ? content(s.el, ctx) : renderBuiltIn(name, s.el, ctx, content);
          if (typeof r === 'function') s.cleanup = r;
          s.kind = typeof content === 'function' ? 'host' : 'builtIn';
        } catch (err) {
          if (err instanceof TypeError && String(err.message).startsWith('[MYIO Login]')) throw err;
          console.error(`[MYIO Login] slot "${name}" renderer failed`);
          s.el.textContent = '';
          s.kind = 'empty';
        }
      }
    } finally {
      s.busy = false;
      updateLayoutFlags();
    }
    const focus = opts?.focus ?? 'auto';
    if (focus instanceof HTMLElement) focus.focus();
    else if (focus === 'auto' && hadFocus && s.el.isConnected) {
      if (!s.el.hasAttribute('tabindex')) s.el.setAttribute('tabindex', '-1');
      s.el.focus();
    }
    if (opts?.announce) announce(localize(opts.announce, locale));
  };

  const announce = (text: string) => {
    live.textContent = '';
    setTimeout(() => { if (!destroyed) live.textContent = text; }, 30);
  };

  applyWallpaper();
  renderControls();
  if (options.buildInfo) setSlot('below', { kind: 'buildInfo', text: options.buildInfo });

  const handle: ShellImpl = {
    setSlot,
    setTheme(th) {
      if (destroyed) return;
      themeSetting = th;
      applyTheme();
    },
    setLocale(l) {
      if (destroyed || (l !== 'pt-BR' && l !== 'en')) return;
      locale = l;
      applyLocale();
    },
    setSize(sz, w) {
      if (destroyed) return;
      size = sz;
      if (w) width = w;
      root.setAttribute('data-size', size);
      root.setAttribute('data-width', width);
    },
    setShow(sh) {
      if (destroyed) return;
      if (sh.themeToggle !== undefined) show.themeToggle = sh.themeToggle;
      if (sh.languageSelector !== undefined) show.languageSelector = sh.languageSelector;
      renderControls();
    },
    getState() {
      const st = {} as Record<MyioGcdrSlotName, 'empty' | 'builtIn' | 'host'>;
      for (const n of SLOT_NAMES) st[n] = slots[n].kind;
      return { theme: resolvedTheme(), locale, size, width, slots: st };
    },
    get element() { return root; },
    destroy() {
      if (destroyed) return;
      for (const n of SLOT_NAMES) {
        const s = slots[n];
        s.abort?.abort();
        if (s.cleanup) safeCall('slot cleanup', s.cleanup);
        s.cleanup = undefined;
      }
      destroyed = true;
      listeners.clear();
      mql?.removeEventListener?.('change', onScheme);
      root.remove();
      releaseStyles();
    },
    t,
    contextFor,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    announce,
  };
  return handle;
}

/** @experimental RFC-0236 Layer 1 — the MYIO/GCDR screen skeleton with host-rendered slots. */
export function createMyioGcdrShell(container: HTMLElement, options: MyioGcdrShellOptions = {}): MyioGcdrShellHandle {
  const impl = createShellImpl(container, options);
  return {
    setSlot: impl.setSlot,
    setTheme: impl.setTheme,
    setLocale: impl.setLocale,
    setSize: impl.setSize,
    setShow: impl.setShow,
    getState: impl.getState,
    get element() { return impl.element; },
    destroy: impl.destroy,
  };
}
