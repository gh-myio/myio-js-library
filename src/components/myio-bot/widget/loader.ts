/**
 * RFC-0242 — `loadBotWidget()`: the UMD core does not bundle the widget UI;
 * this injects `myio-bot-widget.umd.min.js` from the SAME base URL as the core
 * (so `…@0.1.600/dist/myio-js-library.umd.min.js` loads the widget `@0.1.600`,
 * never `@latest`), once, and resolves `window.MyIOBotWidget`.
 *
 * The core's own `<script src>` is captured at module load through
 * `document.currentScript` (only meaningful in the UMD build; ESM/CJS hosts
 * import the widget directly or pass `src` / `baseUrl`).
 */
import { MyIOBotError } from '../errors';

export const BOT_WIDGET_FILE = 'myio-bot-widget.umd.min.js';
const LOAD_TIMEOUT_MS = 10_000;

/** The core script URL, captured while the UMD factory runs. */
const CORE_SCRIPT_SRC: string = (() => {
  try {
    const cs = typeof document !== 'undefined' ? (document.currentScript as HTMLScriptElement | null) : null;
    return cs && cs.src ? cs.src : '';
  } catch {
    return '';
  }
})();

export interface MyIOBotWidgetGlobal {
  createMyIOBotWidget: typeof import('./index').createMyIOBotWidget;
  openMyIOBotPanel: typeof import('./index').openMyIOBotPanel;
  [k: string]: unknown;
}

export interface LoadBotWidgetOptions {
  /** Full URL of the widget bundle (overrides everything). */
  src?: string;
  /** Directory URL holding the widget bundle (defaults to the core's own directory). */
  baseUrl?: string;
  /** Default 10 000 ms. */
  timeoutMs?: number;
}

let pending: Promise<MyIOBotWidgetGlobal> | null = null;

function globalWidget(): MyIOBotWidgetGlobal | null {
  const w = typeof window !== 'undefined' ? (window as unknown as { MyIOBotWidget?: MyIOBotWidgetGlobal }).MyIOBotWidget : undefined;
  return w && typeof w.createMyIOBotWidget === 'function' ? w : null;
}

function coreSrcFallback(): string {
  if (typeof document === 'undefined') return '';
  const s = document.querySelector('script[src*="myio-js-library"][src*=".umd"]') as HTMLScriptElement | null;
  return s ? s.src : '';
}

/** Resolves the widget bundle URL: `src` > `baseUrl` > the core script's directory. */
export function resolveBotWidgetUrl(opts: LoadBotWidgetOptions = {}, coreSrc: string = CORE_SCRIPT_SRC || coreSrcFallback()): string | null {
  if (opts.src) return opts.src;
  const here = typeof location !== 'undefined' ? location.href : undefined;
  try {
    if (opts.baseUrl) return new URL(BOT_WIDGET_FILE, opts.baseUrl.replace(/\/?$/, '/')).href;
    if (!coreSrc) return null;
    // Keep the core's flavour: the unminified core loads the unminified widget.
    const file = /\.umd\.js(?:[?#].*)?$/.test(coreSrc) ? BOT_WIDGET_FILE.replace('.umd.min.js', '.umd.js') : BOT_WIDGET_FILE;
    return new URL(file, here ? new URL(coreSrc, here) : coreSrc).href;
  } catch {
    return null;
  }
}

export function loadBotWidget(opts: LoadBotWidgetOptions = {}): Promise<MyIOBotWidgetGlobal> {
  const ready = globalWidget();
  if (ready) return Promise.resolve(ready);
  if (pending) return pending;
  if (typeof document === 'undefined') {
    return Promise.reject(new MyIOBotError('WIDGET_LOAD_FAILED', 'MyIO Bot: loadBotWidget() needs a browser document.'));
  }
  const url = resolveBotWidgetUrl(opts);
  if (!url) {
    return Promise.reject(new MyIOBotError('WIDGET_LOAD_FAILED', 'MyIO Bot: cannot derive the widget URL (pass { src } or { baseUrl }).'));
  }
  const p = new Promise<MyIOBotWidgetGlobal>((resolve, reject) => {
    let script = document.querySelector('script[data-myio-bot-widget-script]') as HTMLScriptElement | null;
    const created = !script;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      script?.removeEventListener('load', onLoad);
      script?.removeEventListener('error', onError);
    };
    const fail = (why: string) => {
      cleanup();
      if (created && script?.parentNode) script.parentNode.removeChild(script);
      pending = null;
      reject(new MyIOBotError('WIDGET_LOAD_FAILED', `MyIO Bot: widget bundle ${why} (${url}).`));
    };
    const onLoad = () => {
      const g = globalWidget();
      if (g) { cleanup(); resolve(g); } else fail('loaded but window.MyIOBotWidget is missing');
    };
    const onError = () => fail('failed to load');
    if (!script) {
      script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.setAttribute('data-myio-bot-widget-script', '');
    }
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    timer = setTimeout(() => fail(`did not load within ${opts.timeoutMs ?? LOAD_TIMEOUT_MS} ms`), opts.timeoutMs ?? LOAD_TIMEOUT_MS);
    if (created) (document.head || document.documentElement).appendChild(script);
  });
  pending = p;
  return p;
}

/** Test hook: forget a pending load. */
export function _resetBotWidgetLoader(): void {
  pending = null;
}
