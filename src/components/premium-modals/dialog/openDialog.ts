/**
 * RFC-0205: Premium Dialog — exported confirm/message modal with
 * parameterizable buttons.
 *
 * Promise semantics: exactly one resolution per call. Button click resolves
 * with its `value`; dismissal (Esc/backdrop/×) resolves with `null`. The
 * promise never rejects from user interaction — programmer errors (empty
 * `buttons`) throw synchronously.
 */

import { injectDialogStyles } from './styles';
import type {
  ConfirmDialogParams,
  DialogButton,
  MessageDialogParams,
  MessageDialogSeverity,
} from './types';

// Stacks above the premium-modals baseline; bumped per dialog so concurrent
// dialogs layer in open order.
const BASE_Z_INDEX = 10500;
let openCount = 0;

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escaped text with newlines rendered as line breaks. */
function escapeMessage(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function cssWidth(width: ConfirmDialogParams['width']): string {
  if (width == null) return '420px';
  return typeof width === 'number' ? `${width}px` : width;
}

const SEVERITY_META: Record<MessageDialogSeverity, { title: string; icon: string }> = {
  info: { title: 'Informação', icon: 'ℹ️' },
  success: { title: 'Sucesso', icon: '✅' },
  warning: { title: 'Atenção', icon: '⚠️' },
  error: { title: 'Erro', icon: '❌' },
};

interface InternalDialogOptions extends ConfirmDialogParams {
  /** Modifier class for the dialog shell (severity accent). */
  modifier?: string;
  /** Icon shown before the title. */
  icon?: string;
  autoCloseMs?: number;
}

function openDialog(params: InternalDialogOptions): Promise<string | null> {
  if (!Array.isArray(params.buttons) || params.buttons.length === 0) {
    throw new Error('[openConfirmDialog] params.buttons must contain at least one button');
  }

  injectDialogStyles();

  const dismissible = params.dismissible ?? true;
  const theme = params.theme ?? 'light';
  const idBase = `myio-dialog-${++openCount}`;

  const overlay = document.createElement('div');
  overlay.className = `myio-dialog-overlay${theme === 'dark' ? ' myio-dialog-overlay--dark' : ''}`;
  overlay.style.zIndex = String(BASE_Z_INDEX + openCount);

  const buttonsHtml = params.buttons
    .map((btn, i) => {
      const variant = btn.variant ?? 'secondary';
      return `<button type="button" class="myio-dialog__btn myio-dialog__btn--${variant}" data-index="${i}">${escapeHtml(btn.label)}</button>`;
    })
    .join('');

  overlay.innerHTML = `
    <div class="myio-dialog${params.modifier ? ` ${params.modifier}` : ''}"
         role="dialog" aria-modal="true"
         aria-labelledby="${idBase}-title" aria-describedby="${idBase}-message"
         style="width:${cssWidth(params.width)}">
      <div class="myio-dialog__accent"></div>
      <div class="myio-dialog__header">
        ${params.icon ? `<span class="myio-dialog__icon" aria-hidden="true">${params.icon}</span>` : ''}
        <h3 class="myio-dialog__title" id="${idBase}-title">${escapeHtml(params.title)}</h3>
        ${dismissible ? `<button type="button" class="myio-dialog__close" aria-label="Fechar">✕</button>` : ''}
      </div>
      <p class="myio-dialog__message" id="${idBase}-message">${escapeMessage(params.message)}</p>
      <div class="myio-dialog__footer">${buttonsHtml}</div>
    </div>
  `;

  const previousFocus = document.activeElement as HTMLElement | null;
  const target = params.container ?? document.body;
  target.appendChild(overlay);

  // All lookups scoped to the overlay root — never document.getElementById
  // (shadow-DOM pitfall, see CLAUDE.md "Shadow DOM Button Binding").
  const root = overlay.querySelector<HTMLElement>('.myio-dialog')!;
  const buttonEls = Array.from(root.querySelectorAll<HTMLButtonElement>('.myio-dialog__btn'));

  return new Promise<string | null>((resolve) => {
    let settled = false;
    let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;

    const close = (result: string | null) => {
      if (settled) return;
      settled = true;
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      document.removeEventListener('keydown', onKeydown, true);
      overlay.remove();
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
      resolve(result);
    };

    const onKeydown = (e: KeyboardEvent) => {
      // Only react while this dialog is the topmost mounted overlay.
      if (!overlay.isConnected) return;
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        close(null);
        return;
      }
      if (e.key === 'Tab') {
        // Focus trap: cycle through the dialog's own focusable elements.
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>('button:not([disabled])'),
        );
        if (focusables.length === 0) return;
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

    buttonEls.forEach((el) => {
      el.addEventListener('click', () => {
        const index = Number(el.dataset.index);
        close(params.buttons[index].value);
      });
    });

    if (dismissible) {
      overlay
        .querySelector<HTMLButtonElement>('.myio-dialog__close')
        ?.addEventListener('click', () => close(null));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(null);
      });
    }

    document.addEventListener('keydown', onKeydown, true);

    const autoFocusIndex = params.buttons.findIndex((b: DialogButton) => b.autoFocus);
    (buttonEls[autoFocusIndex >= 0 ? autoFocusIndex : buttonEls.length - 1] ?? buttonEls[0]).focus();

    if (params.autoCloseMs && params.autoCloseMs > 0) {
      autoCloseTimer = setTimeout(() => close(null), params.autoCloseMs);
    }
  });
}

/**
 * Opens a premium confirmation dialog and resolves with the `value` of the
 * clicked button, or `null` when dismissed (Esc/backdrop/×).
 */
export function openConfirmDialog(params: ConfirmDialogParams): Promise<string | null> {
  return openDialog(params);
}

/**
 * Opens a premium single-button message dialog (acknowledgment). Resolves
 * when the user closes it — or automatically after `autoCloseMs`.
 */
export function openMessageDialog(params: MessageDialogParams): Promise<void> {
  const severity = params.severity ?? 'info';
  const meta = SEVERITY_META[severity];
  return openDialog({
    title: params.title ?? meta.title,
    message: params.message,
    buttons: [
      { label: params.buttonLabel ?? 'OK', variant: 'primary', value: 'ok', autoFocus: true },
    ],
    theme: params.theme,
    container: params.container,
    modifier: severity !== 'info' ? `myio-dialog--${severity}` : undefined,
    icon: meta.icon,
    autoCloseMs: params.autoCloseMs,
  }).then(() => undefined);
}
