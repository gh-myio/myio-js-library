/**
 * RFC-0236 §5 — the modal presentation: an overlay composing the login view.
 * State shared with other copies of the library lives in DOM attributes.
 */
import { h, icon, safeCall } from './dom';
import { localize } from './i18n';
import { ICONS } from './icons';
import { createLoginViewImpl } from './loginView';
import { acquireStyles } from './styles';
import type { MyioGcdrLoginModalHandle, MyioGcdrLoginModalOptions } from './types';

const MODAL_ATTR = 'data-myio-gcdr-modal';
const LOCK_ATTR = 'data-myio-gcdr-scroll-lock';
const INERT_PREV = 'data-myio-gcdr-inert-prev';

export function isMyioGcdrLoginModalOpen(target?: Document | HTMLElement): boolean {
  if (target instanceof HTMLElement) return !!target.querySelector(`:scope > [${MODAL_ATTR}]`);
  const doc = target ?? (typeof document !== 'undefined' ? document : undefined);
  return !!doc?.querySelector(`[${MODAL_ATTR}]`);
}

function conflict(): never {
  const e = new Error('[MYIO Login] a login modal is already open here');
  (e as Error & { code: string }).code = 'LOGIN_MODAL_ALREADY_OPEN';
  throw e;
}

export function openMyioGcdrLoginModal(options: MyioGcdrLoginModalOptions): MyioGcdrLoginModalHandle {
  const ov = options.overlay ?? {};
  const scopeEl = typeof ov.scope === 'object' && ov.scope ? ov.scope.element : null;
  const doc = scopeEl?.ownerDocument ?? document;
  const viewport = !scopeEl;
  const dismissible = ov.dismissible === true;
  if (viewport && !dismissible && !ov.exit) {
    throw new TypeError('[MYIO Login] a viewport modal that is not dismissible needs overlay.exit (a way out)');
  }
  if (ov.exit && (!ov.exit.href || typeof ov.exit.href !== 'string')) throw new TypeError('[MYIO Login] overlay.exit.href is required');
  if ((ov as { secondaryAction?: unknown }).secondaryAction) {
    const e = new TypeError('[MYIO Login] overlay.secondaryAction is not available in this version (RFC-0236 PR 4)');
    (e as TypeError & { code: string }).code = 'MYIO_GCDR_SECONDARY_UNSUPPORTED';
    throw e;
  }
  if (viewport ? isMyioGcdrLoginModalOpen(doc) : isMyioGcdrLoginModalOpen(scopeEl!)) conflict();

  const backdrop = ov.backdrop ?? 'solid';
  const opacity = typeof ov.opacity === 'number' ? Math.min(1, Math.max(0, ov.opacity)) : 0.5;
  const blur = typeof ov.blur === 'number' ? ov.blur : backdrop === 'blur' ? 8 : 4;
  const previouslyFocused = doc.activeElement as HTMLElement | null;
  const releaseStyles = acquireStyles(viewport ? doc.body : scopeEl!, { nonce: options.cspNonce, loadFont: options.fonts?.load !== false });

  // ── Overlay (reserved synchronously) ─────────────────────────────────────
  const overlay = h(doc, 'div', {
    class: 'myio-gcdr-overlay', [MODAL_ATTR]: '1', role: 'dialog', 'aria-modal': viewport ? 'true' : null,
    'data-scope': viewport ? 'viewport' : 'element', 'data-backdrop': backdrop,
  });
  overlay.style.zIndex = String(ov.zIndex ?? 10000);
  const layers: HTMLElement[] = [];
  const layer = (bg: string, extra = '') => {
    const l = h(doc, 'div', { class: 'myio-gcdr-overlay__layer', 'aria-hidden': 'true' });
    l.setAttribute('style', `background:${bg};${extra}`);
    layers.push(l);
    overlay.appendChild(l);
    return l;
  };
  const paintBackdrop = (dark: boolean) => {
    layers.splice(0).forEach((l) => l.remove());
    const blurCss = `-webkit-backdrop-filter:blur(${blur}px);backdrop-filter:blur(${blur}px)`;
    if (backdrop === 'blur') {
      layer(`rgba(20,12,40,${opacity})`, blurCss);
    } else {
      layer(dark ? 'linear-gradient(180deg,#1B1530 0%,#15121F 45%,#111827 100%)' : 'linear-gradient(180deg,#DCD2F3 0%,#EEEAF8 45%,#F7F5FC 100%)');
      if (backdrop === 'image' && options.assets?.wallpaper) {
        const wp = options.assets.wallpaper;
        let portrait = false;
        try { portrait = matchMedia('(orientation: portrait)').matches; } catch { /* noop */ }
        const url = dark ? (portrait ? wp.mobileDark ?? wp.dark : wp.dark) : (portrait ? wp.mobileLight ?? wp.light : wp.light);
        if (url) layer(`url("${url.replace(/"/g, '%22')}") center/cover no-repeat`);
      }
      layer(`rgba(255,255,255,${(dark ? 0.1 : 0.44) * opacity})`, blurCss);
      layer(dark
        ? 'linear-gradient(135deg,rgba(45,22,105,.55) 0%,rgba(27,21,48,.30) 50%,rgba(45,22,105,.55) 100%)'
        : 'linear-gradient(135deg,rgba(107,74,191,.34) 0%,rgba(107,74,191,.14) 50%,rgba(107,74,191,.34) 100%)');
    }
    layers.forEach((l) => overlay.insertBefore(l, content));
  };
  const content = h(doc, 'div', { class: 'myio-gcdr-overlay__content' });
  overlay.appendChild(content);

  let restoreStatic: (() => void) | null = null;
  if (viewport) doc.body.appendChild(overlay);
  else {
    const el = scopeEl!;
    if (getComputedStyle(el).position === 'static') {
      const prev = el.style.position;
      el.style.position = 'relative';
      restoreStatic = () => { el.style.position = prev; };
    }
    el.appendChild(overlay);
  }

  // ── State ────────────────────────────────────────────────────────────────
  let open = true;
  let closing = false;
  let exitTimer: ReturnType<typeof setTimeout> | undefined;

  const close = (reason: 'success' | 'dismiss' | 'api' | 'exit') => {
    if (!open || closing) return;
    closing = true;
    if (exitTimer) clearTimeout(exitTimer);
    mo?.disconnect();
    try { view.destroy(); } catch { /* keep closing */ }
    doc.removeEventListener('keydown', onKey, true);
    overlay.removeEventListener('keydown', onKey, true);
    if (viewport) { releaseInert(); releaseScroll(); }
    overlay.remove();
    restoreStatic?.();
    releaseStyles();
    open = false;
    if (previouslyFocused && previouslyFocused.isConnected && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    else if (viewport) doc.body.focus?.();
    safeCall('onClose', options.onClose, reason);
  };

  // ── The view ─────────────────────────────────────────────────────────────
  const { overlay: _o, onOpen, onClose, ...viewOpts } = options;
  void _o; void onClose;
  const view = createLoginViewImpl(content, { ...viewOpts, aside: options.aside ?? { kind: 'none' }, autoFocus: false }, {
    presentation: 'modal',
    shellWallpaper: false,
    afterSuccess: () => { if (ov.closeOnSuccess !== false) close('success'); },
    decorateFooter: (footer, api) => {
      if (!ov.exit) return;
      const label = localize(ov.exit.label, api.locale());
      const a = h(doc, 'a', { class: 'myio-gcdr-login__link', href: ov.exit.href, style: 'display:inline-block;margin-left:12px' }, label);
      a.addEventListener('click', () => {
        if (api.phase() === 'success') return;
        api.abortAttempt();
        api.clearPassword();
        a.textContent = api.t('login.leaving');
        a.setAttribute('aria-busy', 'true');
        // Navigation normally unloads the page. If it is still alive after 2 s it was
        // blocked: keep the cover, say so, let the user try again (R4-C5).
        exitTimer = setTimeout(() => {
          if (!open) return;
          a.textContent = label;
          a.removeAttribute('aria-busy');
          api.showLeaveFailed();
          a.focus();
        }, 2000);
      });
      footer.appendChild(a);
    },
  });
  const shellRoot = content.querySelector('.myio-gcdr-shell') as HTMLElement | null;
  const syncTheme = () => {
    const dark = view.getState().theme === 'dark';
    overlay.setAttribute('data-theme', dark ? 'dark' : 'light');
    paintBackdrop(dark);
  };
  syncTheme();
  const mo = shellRoot ? new MutationObserver(syncTheme) : null;
  mo?.observe(shellRoot!, { attributes: true, attributeFilter: ['data-theme'] });

  if (backdrop === 'blur' && options.show?.themeToggle === undefined) view.shell?.setShow({ themeToggle: false });
  const title = content.querySelector('.myio-gcdr-panel__title') as HTMLElement | null;
  if (title) {
    if (!title.id) title.id = `myio-gcdr-title-${Math.random().toString(36).slice(2, 8)}`;
    overlay.setAttribute('aria-labelledby', title.id);
  }

  if (dismissible) {
    const x = h(doc, 'button', { type: 'button', class: 'myio-gcdr-shell__iconbtn myio-gcdr-overlay__close', 'aria-label': view._api.t('modal.close') });
    x.appendChild(icon(doc, ICONS.x(18)));
    x.addEventListener('click', () => { const p = view.getState().phase; if (p !== 'submitting' && p !== 'success') close('dismiss'); });
    content.appendChild(x);
  }

  // ── Viewport-only: inert, scroll lock, focus trap ─────────────────────────
  const inerted: HTMLElement[] = [];
  const releaseInert = () => {
    for (const el of inerted) {
      const prev = el.getAttribute(INERT_PREV);
      if (prev === 'true') el.setAttribute('inert', '');
      else el.removeAttribute('inert');
      el.removeAttribute(INERT_PREV);
    }
    inerted.length = 0;
  };
  let scrollPrev: { html: string; body: string } | null = null;
  const releaseScroll = () => {
    const html = doc.documentElement;
    const n = Math.max(0, (parseInt(html.getAttribute(LOCK_ATTR) || '1', 10) || 1) - 1);
    if (n === 0) {
      html.removeAttribute(LOCK_ATTR);
      if (scrollPrev) { html.style.overflow = scrollPrev.html; doc.body.style.overflow = scrollPrev.body; }
    } else html.setAttribute(LOCK_ATTR, String(n));
  };
  if (viewport) {
    for (const el of Array.from(doc.body.children) as HTMLElement[]) {
      if (el === overlay || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      el.setAttribute(INERT_PREV, el.hasAttribute('inert') ? 'true' : 'false');
      el.setAttribute('inert', '');
      inerted.push(el);
    }
    const html = doc.documentElement;
    const n = parseInt(html.getAttribute(LOCK_ATTR) || '0', 10) || 0;
    if (n === 0) scrollPrev = { html: html.style.overflow, body: doc.body.style.overflow };
    html.setAttribute(LOCK_ATTR, String(n + 1));
    html.style.overflow = 'hidden';
    doc.body.style.overflow = 'hidden';
  }

  const focusables = () =>
    Array.from(overlay.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.hidden && el.offsetParent !== null);
  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape' && dismissible) {
      const p = view.getState().phase;
      if (p !== 'submitting' && p !== 'success') { e.preventDefault(); close('dismiss'); }
      return;
    }
    if (e.key === 'Tab' && viewport) {
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = doc.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !overlay.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !overlay.contains(active))) { e.preventDefault(); first.focus(); }
    }
  };
  if (viewport) doc.addEventListener('keydown', onKey, true);
  else overlay.addEventListener('keydown', onKey, true);

  // Initial focus: e-mail (password with initialEmail); never left on the inert body.
  const emailInput = content.querySelector('[data-k="email"]') as HTMLElement | null;
  const passInput = content.querySelector('[data-k="password"]') as HTMLElement | null;
  const coarse = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
  const wantInput = options.autoFocus ?? !coarse;
  ((wantInput ? (options.initialEmail ? passInput : emailInput) : title) ?? title)?.focus();

  safeCall('onOpen', onOpen);

  const handle: MyioGcdrLoginModalHandle = {
    getState: () => view.getState(),
    setLocale: (l) => view.setLocale(l),
    setTheme: (th) => view.setTheme(th),
    showError: (c, x) => view.showError(c, x),
    clearError: () => view.clearError(),
    setNotice: (n) => view.setNotice(n),
    reset: () => view.reset(),
    focus: () => view.focus(),
    close: () => close('api'),
    destroy: () => close('api'),
    get isOpen() { return open; },
  };
  return handle;
}
