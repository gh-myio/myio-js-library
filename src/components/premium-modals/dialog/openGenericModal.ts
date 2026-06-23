/**
 * RFC-0205 (extension): Generic Modal — a premium modal shell that renders
 * ARBITRARY HTML body content (`bodyHtml`).
 *
 * Unlike `openConfirmDialog`/`openMessageDialog` (which render plain,
 * HTML-escaped text only), this modal injects `bodyHtml` verbatim — so it can
 * show real `<hr>`, `<img>`, larger fonts, tables, etc. It reuses the same
 * overlay/focus-trap/ARIA/Esc/dismissible/theme conventions as the premium
 * dialog, with its own scoped CSS (`myio-genmodal-*`) so the body is NOT
 * constrained to the small dialog message font.
 *
 * ⚠️ SECURITY: `bodyHtml` is inserted as-is. It is the CALLER's responsibility
 * to ensure the content is trusted/sanitized — never pass unsanitized user input.
 *
 * Returns a controller (not a Promise): generic modals are interactive panels
 * you close imperatively. Footer buttons (optional) fire `onButton(value)` and,
 * unless `closeOnClick:false`, also close the modal.
 */

import type { DialogButtonVariant } from './types';

const STYLE_ID = 'myio-genmodal-styles';
const FONT_LINK_ID = 'myio-dialog-font-nunito'; // shared with the premium dialog
const BASE_Z_INDEX = 10600; // above the confirm/message dialogs (10500 baseline)
let openCount = 0;

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cssSize(v: number | string | undefined, fallback: string): string {
  if (v == null) return fallback;
  return typeof v === 'number' ? `${v}px` : v;
}

/** A footer button for the generic modal. */
export interface GenericModalButton {
  /** Visible label (rendered HTML-escaped). */
  label: string;
  /** Visual style. Default: 'secondary'. */
  variant?: DialogButtonVariant;
  /** Value passed to `onButton` when clicked. */
  value: string;
  /** Receives initial focus. At most one. */
  autoFocus?: boolean;
  /** When false, clicking fires `onButton` but does NOT close. Default: true. */
  closeOnClick?: boolean;
}

export interface GenericModalParams {
  /** Header title (rendered HTML-escaped). */
  title: string;
  /**
   * Body content, injected as RAW HTML (NOT escaped). Caller-trusted — supports
   * `<hr>`, `<img>`, tables, larger fonts, etc.
   */
  bodyHtml: string;
  /** Optional icon/emoji shown before the title. */
  icon?: string;
  /** Optional footer buttons. Omit for a body-only modal (× / Esc to close). */
  buttons?: GenericModalButton[];
  /** Default: 'light'. */
  theme?: 'light' | 'dark';
  /**
   * Dismissal policy. When true (default), Esc/backdrop/× close the modal.
   * When false, the user must click a footer button.
   */
  dismissible?: boolean;
  /** Width override, e.g. 560 or '40rem'. Default: 560px (max 90vw). */
  width?: number | string;
  /** Max height of the scrollable body. Default: '70vh'. */
  bodyMaxHeight?: number | string;
  /** Extra class added to the modal shell (for custom styling hooks). */
  className?: string;
  /** Mount target. Default: document.body. Required for shadow-DOM hosts. */
  container?: HTMLElement;
  /** Called with a button's `value` when it is clicked. */
  onButton?: (value: string) => void;
  /** Called once when the modal closes (any reason). */
  onClose?: () => void;
}

/** Imperative controller returned by `openGenericModal`. */
export interface GenericModalInstance {
  /** Close and remove the modal (idempotent). */
  close: () => void;
  /** Replace the body content (raw HTML). */
  setBodyHtml: (html: string) => void;
  /** Replace the header title (escaped). */
  setTitle: (title: string) => void;
  /** The body container element (for direct DOM manipulation). */
  getBodyEl: () => HTMLElement;
  /** The modal shell element. */
  getRoot: () => HTMLElement;
}

function injectGenericModalStyles(): void {
  if (!document.getElementById(FONT_LINK_ID)) {
    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.myio-genmodal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 24, 39, 0.55);
  font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.myio-genmodal {
  background: #ffffff;
  color: #1f2937;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.myio-genmodal__accent { height: 4px; background: #7C3AED; flex-shrink: 0; }
.myio-genmodal__header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid #eef0f3;
  flex-shrink: 0;
}
.myio-genmodal__icon { font-size: 22px; line-height: 1.3; }
.myio-genmodal__title {
  flex: 1;
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
}
.myio-genmodal__close {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 18px;
  line-height: 1;
  padding: 2px 6px;
  margin: -2px -8px 0 0;
  border-radius: 6px;
  cursor: pointer;
}
.myio-genmodal__close:hover { background: rgba(0, 0, 0, 0.06); color: #4b5563; }
.myio-genmodal__body {
  padding: 18px 20px;
  font-size: 15px;
  line-height: 1.6;
  color: #374151;
  overflow-y: auto;
}
/* Sensible defaults for arbitrary body HTML */
.myio-genmodal__body img { max-width: 100%; height: auto; border-radius: 8px; }
.myio-genmodal__body hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
.myio-genmodal__body h1, .myio-genmodal__body h2, .myio-genmodal__body h3, .myio-genmodal__body h4 {
  margin: 0 0 8px; line-height: 1.3; color: #1f2937;
}
.myio-genmodal__body p { margin: 0 0 10px; }
.myio-genmodal__body ul, .myio-genmodal__body ol { margin: 0 0 10px; padding-left: 22px; }
.myio-genmodal__body table { border-collapse: collapse; width: 100%; }
.myio-genmodal__body th, .myio-genmodal__body td {
  border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; font-size: 14px;
}
.myio-genmodal__body a { color: #7C3AED; }
.myio-genmodal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #eef0f3;
  flex-shrink: 0;
}
.myio-genmodal__btn {
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: filter 0.15s ease, background 0.15s ease;
}
.myio-genmodal__btn:hover { filter: brightness(0.94); }
.myio-genmodal__btn:focus-visible { outline: 2px solid #7C3AED; outline-offset: 2px; }
.myio-genmodal__btn--primary { background: #7C3AED; color: #ffffff; }
.myio-genmodal__btn--secondary { background: #ffffff; color: #374151; border-color: #d1d5db; }
.myio-genmodal__btn--danger { background: #dc2626; color: #ffffff; }
.myio-genmodal__btn--success { background: #16a34a; color: #ffffff; }

/* ── Dark theme ── */
.myio-genmodal-overlay--dark .myio-genmodal { background: #1f2937; color: #f3f4f6; }
.myio-genmodal-overlay--dark .myio-genmodal__header,
.myio-genmodal-overlay--dark .myio-genmodal__footer { border-color: #374151; }
.myio-genmodal-overlay--dark .myio-genmodal__title { color: #f3f4f6; }
.myio-genmodal-overlay--dark .myio-genmodal__body { color: #d1d5db; }
.myio-genmodal-overlay--dark .myio-genmodal__body h1,
.myio-genmodal-overlay--dark .myio-genmodal__body h2,
.myio-genmodal-overlay--dark .myio-genmodal__body h3,
.myio-genmodal-overlay--dark .myio-genmodal__body h4 { color: #f3f4f6; }
.myio-genmodal-overlay--dark .myio-genmodal__body hr { border-color: #374151; }
.myio-genmodal-overlay--dark .myio-genmodal__body th,
.myio-genmodal-overlay--dark .myio-genmodal__body td { border-color: #374151; }
.myio-genmodal-overlay--dark .myio-genmodal__close { color: #9ca3af; }
.myio-genmodal-overlay--dark .myio-genmodal__close:hover { background: rgba(255,255,255,0.08); color: #e5e7eb; }
.myio-genmodal-overlay--dark .myio-genmodal__btn--secondary { background: #1f2937; color: #e5e7eb; border-color: #4b5563; }
`;
  document.head.appendChild(style);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Opens a generic premium modal rendering arbitrary `bodyHtml`. Returns a
 * controller to close/update it imperatively.
 */
export function openGenericModal(params: GenericModalParams): GenericModalInstance {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('[openGenericModal] requires a browser environment');
  }
  if (typeof params.bodyHtml !== 'string') {
    throw new Error('[openGenericModal] params.bodyHtml must be a string');
  }

  injectGenericModalStyles();

  const dismissible = params.dismissible ?? true;
  const theme = params.theme ?? 'light';
  const buttons = params.buttons ?? [];
  const idBase = `myio-genmodal-${++openCount}`;

  const overlay = document.createElement('div');
  overlay.className = `myio-genmodal-overlay${theme === 'dark' ? ' myio-genmodal-overlay--dark' : ''}`;
  overlay.style.zIndex = String(BASE_Z_INDEX + openCount);

  const buttonsHtml = buttons
    .map((btn, i) => {
      const variant = btn.variant ?? 'secondary';
      return `<button type="button" class="myio-genmodal__btn myio-genmodal__btn--${variant}" data-index="${i}">${escapeHtml(btn.label)}</button>`;
    })
    .join('');

  overlay.innerHTML = `
    <div class="myio-genmodal${params.className ? ` ${escapeHtml(params.className)}` : ''}"
         role="dialog" aria-modal="true"
         aria-labelledby="${idBase}-title"
         style="width:${cssSize(params.width, '560px')}">
      <div class="myio-genmodal__accent"></div>
      <div class="myio-genmodal__header">
        ${params.icon ? `<span class="myio-genmodal__icon" aria-hidden="true">${params.icon}</span>` : ''}
        <h3 class="myio-genmodal__title" id="${idBase}-title">${escapeHtml(params.title)}</h3>
        ${dismissible ? `<button type="button" class="myio-genmodal__close" aria-label="Fechar">✕</button>` : ''}
      </div>
      <div class="myio-genmodal__body" id="${idBase}-body" style="max-height:${cssSize(params.bodyMaxHeight, '70vh')}"></div>
      ${buttons.length ? `<div class="myio-genmodal__footer">${buttonsHtml}</div>` : ''}
    </div>
  `;

  const root = overlay.querySelector<HTMLElement>('.myio-genmodal')!;
  const bodyEl = root.querySelector<HTMLElement>('.myio-genmodal__body')!;
  const titleEl = root.querySelector<HTMLElement>('.myio-genmodal__title')!;
  // Body is set via innerHTML AFTER construction so the raw HTML is never part
  // of the template string (keeps the escaping boundary explicit).
  bodyEl.innerHTML = params.bodyHtml;

  const previousFocus = document.activeElement as HTMLElement | null;
  const target = params.container ?? document.body;
  target.appendChild(overlay);

  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown, true);
    overlay.remove();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    if (params.onClose) params.onClose();
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (!overlay.isConnected) return;
    if (e.key === 'Escape' && dismissible) {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  root.querySelectorAll<HTMLButtonElement>('.myio-genmodal__btn').forEach((el) => {
    el.addEventListener('click', () => {
      const btn = buttons[Number(el.dataset.index)];
      if (!btn) return;
      if (params.onButton) params.onButton(btn.value);
      if (btn.closeOnClick !== false) close();
    });
  });

  if (dismissible) {
    overlay
      .querySelector<HTMLButtonElement>('.myio-genmodal__close')
      ?.addEventListener('click', () => close());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  document.addEventListener('keydown', onKeydown, true);

  // Initial focus: autoFocus button → first footer button → first focusable in
  // the body → the close button → the modal shell.
  const autoFocusIdx = buttons.findIndex((b) => b.autoFocus);
  const footerEls = Array.from(root.querySelectorAll<HTMLButtonElement>('.myio-genmodal__btn'));
  const initialFocus =
    (autoFocusIdx >= 0 ? footerEls[autoFocusIdx] : undefined) ??
    footerEls[footerEls.length - 1] ??
    root.querySelector<HTMLElement>(`.myio-genmodal__body ${FOCUSABLE}`) ??
    overlay.querySelector<HTMLElement>('.myio-genmodal__close') ??
    root;
  (initialFocus as HTMLElement).focus?.();

  return {
    close,
    setBodyHtml: (html: string) => {
      bodyEl.innerHTML = html;
    },
    setTitle: (title: string) => {
      titleEl.textContent = title;
    },
    getBodyEl: () => bodyEl,
    getRoot: () => root,
  };
}
