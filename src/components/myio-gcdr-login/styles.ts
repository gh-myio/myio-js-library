/**
 * RFC-0236 — scoped CSS, injected once per root node (document.head or a
 * shadow root). Reference-counted through a DOM attribute so two copies of
 * the library on one page never remove each other's style.
 * Token values: gcdr-frontend AuthCard.tsx / index.css at d71179b.
 */

export const STYLE_VERSION = '1';
const STYLE_ATTR = 'data-myio-gcdr-version';
const REFS_ATTR = 'data-myio-gcdr-refs';
const FONT_ID = 'myio-gcdr-font-nunito';

const CSS = `
.myio-gcdr-shell, .myio-gcdr-overlay {
  --myio-gcdr-accent: #6B4ABF;
  --myio-gcdr-accent-hover: #5A3CA8;
  --myio-gcdr-card: #FBFAFE;
  --myio-gcdr-ring: #E1DAF4;
  --myio-gcdr-title: #1E1B2E;
  --myio-gcdr-text: #55506A;
  --myio-gcdr-footer: #F0ECFA;
  --myio-gcdr-input: #FFFFFF;
  --myio-gcdr-input-border: #D1D5DB;
  --myio-gcdr-link: #6B4ABF;
  --myio-gcdr-pill: rgba(255,255,255,0.70);
  --myio-gcdr-aside-band: #2E8B57;
  box-sizing: border-box;
  font-family: 'Nunito', ui-sans-serif, system-ui, sans-serif;
  line-height: 1.5;
  color: var(--myio-gcdr-title);
  -webkit-font-smoothing: antialiased;
}
.myio-gcdr-shell[data-theme="dark"], .myio-gcdr-overlay[data-theme="dark"] {
  --myio-gcdr-card: #1E1A2E;
  --myio-gcdr-ring: #3A3158;
  --myio-gcdr-title: #FFFFFF;
  --myio-gcdr-text: #D1D5DB;
  --myio-gcdr-footer: #251F3A;
  --myio-gcdr-input: #2B2440;
  --myio-gcdr-input-border: #3A3158;
  --myio-gcdr-link: #B9A5F0;
  --myio-gcdr-pill: rgba(43,36,64,0.80);
}
.myio-gcdr-shell [hidden], .myio-gcdr-overlay [hidden] { display: none !important; }
.myio-gcdr-shell *, .myio-gcdr-shell *::before, .myio-gcdr-shell *::after,
.myio-gcdr-overlay *, .myio-gcdr-overlay *::before, .myio-gcdr-overlay *::after { box-sizing: border-box; }

/* ── Shell ───────────────────────────────────────────────────────────── */
.myio-gcdr-shell {
  position: relative; min-height: 100%; width: 100%;
  display: flex; flex-direction: column; align-items: center;
  padding: 16px; isolation: isolate;
}
.myio-gcdr-shell__wallpaper {
  position: absolute; inset: 0; z-index: -1; overflow: hidden;
  background-color: #EEEAF8;
  background-image: var(--myio-gcdr-wp, none), linear-gradient(180deg, #DCD2F3 0%, #EEEAF8 45%, #F7F5FC 100%);
  background-position: center; background-size: cover; background-repeat: no-repeat;
}
.myio-gcdr-shell[data-theme="dark"] .myio-gcdr-shell__wallpaper {
  background-color: #15121F;
  background-image: var(--myio-gcdr-wp, none), linear-gradient(180deg, #1B1530 0%, #15121F 45%, #111827 100%);
}
.myio-gcdr-shell__wallpaper::before { content: ''; position: absolute; inset: 0;
  background: rgba(255,255,255,0.22); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
.myio-gcdr-shell__wallpaper::after { content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(107,74,191,0.34) 0%, rgba(107,74,191,0.14) 50%, rgba(107,74,191,0.34) 100%); }
.myio-gcdr-shell[data-theme="dark"] .myio-gcdr-shell__wallpaper::before { background: rgba(255,255,255,0.05); }
.myio-gcdr-shell[data-theme="dark"] .myio-gcdr-shell__wallpaper::after {
  background: linear-gradient(135deg, rgba(45,22,105,0.55) 0%, rgba(27,21,48,0.30) 50%, rgba(45,22,105,0.55) 100%); }

.myio-gcdr-shell__top { width: 100%; }
.myio-gcdr-shell__block { width: 100%; max-width: 28rem; margin: auto 0; display: flex; flex-direction: column; }
.myio-gcdr-shell[data-size="lg"] .myio-gcdr-shell__block { max-width: 32rem; }
.myio-gcdr-shell[data-size="xl"] .myio-gcdr-shell__block { max-width: 37rem; }
@media (min-width: 1024px) {
  .myio-gcdr-shell[data-has-aside="true"] .myio-gcdr-shell__block { max-width: 72rem; }
}
.myio-gcdr-shell[data-width="cockpit"] .myio-gcdr-shell__block { max-width: 28rem; }
@media (min-width: 640px) { .myio-gcdr-shell[data-width="cockpit"] .myio-gcdr-shell__block { max-width: 42rem; } }
@media (min-width: 1024px) { .myio-gcdr-shell[data-width="cockpit"] .myio-gcdr-shell__block { max-width: 1800px; padding: 0 12px; } }

.myio-gcdr-shell__toprow { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.myio-gcdr-shell__pill {
  display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; justify-content: flex-end;
  border-radius: 9999px; background: var(--myio-gcdr-pill); padding: 4px 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.myio-gcdr-shell__iconbtn {
  display: inline-flex; align-items: center; gap: 6px; min-height: 36px; min-width: 36px; justify-content: center;
  border: 0; background: transparent; color: var(--myio-gcdr-text); border-radius: 8px; padding: 6px 10px;
  font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
}
.myio-gcdr-shell__iconbtn:hover { background: rgba(107,74,191,0.10); color: var(--myio-gcdr-title); }
.myio-gcdr-shell__iconbtn:focus-visible { outline: 2px solid var(--myio-gcdr-accent); outline-offset: 2px; }

.myio-gcdr-shell__split { display: flex; flex-direction: column; gap: 24px; }
@media (min-width: 1024px) {
  .myio-gcdr-shell__split { flex-direction: row; align-items: stretch; }
  .myio-gcdr-shell[data-has-aside="true"] .myio-gcdr-shell__split { height: clamp(600px, calc(100vh - 10rem), 880px); }
  .myio-gcdr-shell__aside { flex: 1 1 0; min-width: 0; display: flex; }
  .myio-gcdr-shell[data-has-aside="true"] .myio-gcdr-shell__main { flex: 0 0 28rem; }
  .myio-gcdr-shell[data-width="cockpit"][data-has-aside="true"] .myio-gcdr-shell__main { flex: 1 1 0; }
}
.myio-gcdr-shell__main { display: flex; min-width: 0; min-height: 0; }
.myio-gcdr-shell__main > * { flex: 1 1 auto; min-width: 0; }
@media (max-width: 1023.98px) {
  .myio-gcdr-shell[data-aside-compact="hide"] .myio-gcdr-shell__aside { display: none; }
  .myio-gcdr-shell[data-aside-compact="stack"] .myio-gcdr-shell__aside { order: 2; display: flex; }
}
.myio-gcdr-shell__aside[hidden], .myio-gcdr-shell__below[hidden], .myio-gcdr-shell__top[hidden] { display: none !important; }
.myio-gcdr-shell__below { margin-top: 16px; text-align: center; }
.myio-gcdr-shell__build { display: inline-block; font-size: 12px; color: #55506A; border-radius: 9999px;
  background: var(--myio-gcdr-pill); padding: 4px 12px; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.myio-gcdr-shell[data-theme="dark"] .myio-gcdr-shell__build { color: #E5E7EB; }
.myio-gcdr-shell__slot:focus { outline: none; }
.myio-gcdr-sr { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

/* ── Card panel ──────────────────────────────────────────────────────── */
.myio-gcdr-panel {
  display: flex; flex-direction: column; overflow: hidden; width: 100%;
  border-radius: 16px; background: var(--myio-gcdr-card);
  box-shadow: 0 18px 50px rgba(40,20,90,0.30), 0 0 0 1px var(--myio-gcdr-ring);
}
.myio-gcdr-panel[data-fill="true"] { height: 100%; }
.myio-gcdr-panel__band {
  position: relative; display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 16px;
  height: 68px; padding: 0 32px; background: var(--myio-gcdr-band, var(--myio-gcdr-accent));
}
.myio-gcdr-panel__tint { position: absolute; inset: 0; background: var(--myio-gcdr-tint, transparent); pointer-events: none; }
.myio-gcdr-panel__eyebrow { position: relative; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #FFFFFF; }
.myio-gcdr-panel__logo { position: relative; height: 28px; width: auto; display: block; }
.myio-gcdr-panel__wordmark { position: relative; color: #fff; font-weight: 900; font-size: 20px; letter-spacing: 0.04em; }
.myio-gcdr-panel__body { padding: 28px 32px 32px; flex: 1 1 auto; overflow-y: auto; min-height: 0; }
.myio-gcdr-panel__title { margin: 0 0 20px; font-size: 26px; font-weight: 800; line-height: 1.2; color: var(--myio-gcdr-title); }
.myio-gcdr-panel__footer { padding: 16px 32px; text-align: center; font-size: 14px; color: var(--myio-gcdr-text);
  background: var(--myio-gcdr-footer); border-top: 1px solid var(--myio-gcdr-ring); }

/* ── Form ────────────────────────────────────────────────────────────── */
.myio-gcdr-login__form { display: flex; flex-direction: column; gap: 20px; margin: 0; }
.myio-gcdr-login__field { display: flex; flex-direction: column; gap: 6px; }
.myio-gcdr-login__label { font-size: 14px; font-weight: 700; color: var(--myio-gcdr-title); }
.myio-gcdr-login__control { position: relative; display: flex; }
.myio-gcdr-login__input {
  width: 100%; font: inherit; font-size: 16px; color: var(--myio-gcdr-title);
  background: var(--myio-gcdr-input); border: 1px solid var(--myio-gcdr-input-border);
  border-radius: 12px; padding: 10px 14px; outline: none; transition: border-color .15s, box-shadow .15s;
}
.myio-gcdr-login__input::placeholder { color: #9CA3AF; }
.myio-gcdr-login__input:focus { border-color: var(--myio-gcdr-accent); box-shadow: 0 0 0 3px rgba(107,74,191,0.30); }
.myio-gcdr-login__input[aria-invalid="true"] { border-color: #FCA5A5; }
.myio-gcdr-login__input[readonly] { opacity: .75; }
.myio-gcdr-login__input--password { padding-right: 48px; }
.myio-gcdr-login__eye {
  position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px;
  display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent;
  color: var(--myio-gcdr-text); border-radius: 8px; cursor: pointer;
}
.myio-gcdr-login__eye:focus-visible { outline: 2px solid var(--myio-gcdr-accent); }
.myio-gcdr-login__fielderror { font-size: 13px; color: #DC2626; }
.myio-gcdr-shell[data-theme="dark"] .myio-gcdr-login__fielderror { color: #FCA5A5; }
.myio-gcdr-login__hint { font-size: 12px; color: #B45309; }
.myio-gcdr-login__row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.myio-gcdr-login__remember { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--myio-gcdr-text); cursor: pointer; min-height: 32px; }
.myio-gcdr-login__remember input { width: 16px; height: 16px; accent-color: var(--myio-gcdr-accent); }
.myio-gcdr-login__link { font-size: 14px; font-weight: 600; color: var(--myio-gcdr-link); text-decoration: none; background: none; border: 0; padding: 0; cursor: pointer; font-family: inherit; }
.myio-gcdr-login__link:hover { color: var(--myio-gcdr-accent-hover); text-decoration: underline; }
.myio-gcdr-login__submit {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 48px;
  border: 0; border-radius: 12px; padding: 12px 24px; font: inherit; font-size: 16px; font-weight: 700;
  color: #fff; background: var(--myio-gcdr-accent); cursor: pointer; transition: background .15s, opacity .15s;
}
.myio-gcdr-login__submit:hover { background: var(--myio-gcdr-accent-hover); }
.myio-gcdr-login__submit[aria-disabled="true"], .myio-gcdr-login__submit:disabled { opacity: .55; cursor: not-allowed; }
.myio-gcdr-login__submit:focus-visible { outline: 2px solid var(--myio-gcdr-accent); outline-offset: 2px; }
.myio-gcdr-login__submit[data-style="hotPage"] { border-radius: 10px; min-height: 52px; font-size: 17px; letter-spacing: .01em; box-shadow: 0 6px 16px rgba(107,74,191,0.35); }
.myio-gcdr-login__spin { display: inline-flex; animation: myio-gcdr-spin 0.9s linear infinite; }
@keyframes myio-gcdr-spin { to { transform: rotate(360deg); } }

/* ── Banners ─────────────────────────────────────────────────────────── */
.myio-gcdr-login__alerts { display: flex; flex-direction: column; gap: 12px; }
.myio-gcdr-login__alerts:empty { display: none; }
.myio-gcdr-login__alerts:not(:empty) { margin-bottom: 20px; }
.myio-gcdr-login__field > .myio-gcdr-login__link { align-self: flex-start; }
.myio-gcdr-banner { display: flex; gap: 10px; align-items: flex-start; border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.45; border: 1px solid; }
.myio-gcdr-banner:focus { outline: 2px solid var(--myio-gcdr-accent); outline-offset: 2px; }
.myio-gcdr-banner__icon { flex-shrink: 0; margin-top: 2px; }
.myio-gcdr-banner__body { display: flex; flex-direction: column; gap: 6px; }
.myio-gcdr-banner__title { font-weight: 800; }
.myio-gcdr-banner--error { background: #FEF2F2; border-color: #FECACA; color: #991B1B; }
.myio-gcdr-banner--warning { background: #FFFBEB; border-color: #FDE68A; color: #92400E; }
.myio-gcdr-banner--info { background: #F5F3FF; border-color: #DDD6FE; color: #4C1D95; }
.myio-gcdr-shell[data-theme="dark"] .myio-gcdr-banner--error { background: rgba(127,29,29,0.35); border-color: rgba(248,113,113,0.45); color: #FECACA; }
.myio-gcdr-shell[data-theme="dark"] .myio-gcdr-banner--warning { background: rgba(120,53,15,0.35); border-color: rgba(251,191,36,0.45); color: #FDE68A; }
.myio-gcdr-shell[data-theme="dark"] .myio-gcdr-banner--info { background: rgba(76,29,149,0.35); border-color: rgba(167,139,250,0.45); color: #DDD6FE; }
.myio-gcdr-banner a, .myio-gcdr-banner button { color: inherit; font-weight: 700; text-decoration: underline; background: none; border: 0; padding: 0; font: inherit; cursor: pointer; text-align: left; }

/* ── Aside: about / signed-out prompt ─────────────────────────────────── */
.myio-gcdr-about__intro { color: var(--myio-gcdr-text); font-size: 14px; margin: 0 0 16px; }
.myio-gcdr-about__title { font-size: 24px; font-weight: 800; margin: 0 0 6px; color: var(--myio-gcdr-title); }
.myio-gcdr-about__title em { font-style: normal; color: var(--myio-gcdr-aside-band); }
.myio-gcdr-about__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.myio-gcdr-about__tile {
  display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 14px; border-radius: 12px; min-height: 110px;
  border: 1px solid var(--myio-gcdr-ring); background: var(--myio-gcdr-input); color: var(--myio-gcdr-title);
  font: inherit; cursor: pointer; text-decoration: none; transition: transform .15s, box-shadow .15s;
}
.myio-gcdr-about__tile:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(40,20,90,0.12); }
.myio-gcdr-about__tile:focus-visible { outline: 2px solid var(--myio-gcdr-accent); outline-offset: 2px; }
.myio-gcdr-about__tile[aria-disabled="true"] { opacity: .6; cursor: default; }
.myio-gcdr-about__tileicon { color: var(--myio-gcdr-aside-band); }
.myio-gcdr-about__tiletitle { font-weight: 800; font-size: 15px; }
.myio-gcdr-about__tiletext { font-size: 13px; color: var(--myio-gcdr-text); }
.myio-gcdr-about__back { margin-bottom: 12px; }
.myio-gcdr-about__tagline { margin-top: 16px; font-size: 13px; font-weight: 700; color: var(--myio-gcdr-text); text-align: center; }
.myio-gcdr-about__health { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }
.myio-gcdr-about__dot { width: 8px; height: 8px; border-radius: 50%; background: #9CA3AF; }
.myio-gcdr-about__dot[data-state="online"] { background: #16A34A; }
.myio-gcdr-about__dot[data-state="offline"] { background: #DC2626; }
.myio-gcdr-prompt { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 32px 20px; text-align: center; height: 100%; }
.myio-gcdr-prompt__icon { display: inline-flex; width: 56px; height: 56px; align-items: center; justify-content: center; border-radius: 50%; background: #6B4ABF; color: #fff; }
.myio-gcdr-prompt__text { margin: 0; font-size: 22px; font-weight: 800; line-height: 1.35; color: var(--myio-gcdr-title); }

/* ── Modal ───────────────────────────────────────────────────────────── */
.myio-gcdr-overlay { position: fixed; inset: 0; overflow-y: auto; display: flex; }
.myio-gcdr-overlay[data-scope="element"] { position: absolute; }
.myio-gcdr-overlay__layer { position: fixed; inset: 0; pointer-events: none; }
.myio-gcdr-overlay[data-scope="element"] .myio-gcdr-overlay__layer { position: absolute; }
.myio-gcdr-overlay__content { position: relative; width: 100%; min-height: 100%; display: flex; }
.myio-gcdr-overlay__content > .myio-gcdr-shell { min-height: 100%; background: transparent; }
.myio-gcdr-overlay__close { position: absolute; top: 12px; right: 12px; z-index: 2; }
@media (prefers-reduced-motion: reduce) {
  .myio-gcdr-shell *, .myio-gcdr-overlay * { transition: none !important; animation: none !important; }
}
`;

function rootTarget(container: Node): { head: ParentNode; doc: Document } {
  const root = container.getRootNode ? container.getRootNode() : document;
  const doc = container.ownerDocument || document;
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) return { head: root, doc };
  return { head: doc.head || doc.documentElement, doc };
}

/** Inject (or reference) the stylesheet for `container`'s root node. Returns a release function. */
export function acquireStyles(container: Node, opts: { nonce?: string; loadFont?: boolean } = {}): () => void {
  const { head, doc } = rootTarget(container);
  if (opts.loadFont !== false && !doc.getElementById(FONT_ID)) {
    const link = doc.createElement('link');
    link.id = FONT_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap';
    doc.head?.appendChild(link);
  }
  let style = head.querySelector<HTMLStyleElement>(`style[${STYLE_ATTR}="${STYLE_VERSION}"]`);
  if (!style) {
    style = doc.createElement('style');
    style.setAttribute(STYLE_ATTR, STYLE_VERSION);
    style.setAttribute(REFS_ATTR, '0');
    if (opts.nonce) style.setAttribute('nonce', opts.nonce);
    style.textContent = CSS;
    head.appendChild(style);
  }
  const el = style;
  el.setAttribute(REFS_ATTR, String((parseInt(el.getAttribute(REFS_ATTR) || '0', 10) || 0) + 1));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const n = (parseInt(el.getAttribute(REFS_ATTR) || '1', 10) || 1) - 1;
    if (n <= 0) el.remove();
    else el.setAttribute(REFS_ATTR, String(n));
  };
}
