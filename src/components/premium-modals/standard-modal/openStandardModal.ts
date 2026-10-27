/**
 * Shell de modal no padrão do SettingsModalView: header RFC-0121 (`ModalHeader` — barra roxa
 * #3e1a7d, ícone, título, ✕) + corpo livre + footer (`Fechar/Cancelar` cinza à esquerda do
 * botão primário roxo). Para formulários curtos (ex.: "Novo dispositivo manual",
 * "Configuração do Gateway") que antes montavam overlay/card próprios.
 *
 * ⚠️ `bodyHtml` é injetado como HTML — o chamador é responsável por escapar dados do usuário.
 */

import { ModalHeader } from '../../../utils/ModalHeader';

export type StandardModalButtonVariant = 'primary' | 'secondary' | 'danger';

export interface StandardModalButton {
  label: string;
  value: string;
  /** 'secondary' = cinza (Cancelar/Fechar); 'primary' = roxo MyIO. Default 'secondary'. */
  variant?: StandardModalButtonVariant;
  /** false = só dispara onButton (não fecha). Default true. */
  closeOnClick?: boolean;
}

export interface StandardModalParams {
  icon: string;
  title: string;
  bodyHtml: string;
  buttons?: StandardModalButton[];
  /** Largura do card (px ou CSS). Default 480. */
  width?: number | string;
  /** Esc / clique fora / ✕ fecham. Default true. */
  dismissible?: boolean;
  container?: HTMLElement;
  onButton?: (value: string) => void;
  onClose?: () => void;
}

export interface StandardModalInstance {
  close: () => void;
  getRoot: () => HTMLElement;
  getBodyEl: () => HTMLElement;
  setBodyHtml: (html: string) => void;
  /** Altera um botão do footer pelo `value` */
  setButton: (value: string, patch: { label?: string; disabled?: boolean; hidden?: boolean }) => void;
}

const STYLE_ID = 'myio-stdmodal-styles';
const FONT_LINK_ID = 'myio-dialog-font-nunito';
const BASE_Z_INDEX = 10700;
let openCount = 0;

function escapeHtml(v: string): string {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function injectStyles(): void {
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
.myio-stdmodal-overlay {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.5); font-family: 'Nunito', system-ui, sans-serif;
}
.myio-stdmodal {
  background: #fff; color: #1f2937; border-radius: 10px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  max-width: 94vw; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;
}
.myio-stdmodal__body { padding: 20px 24px; overflow-y: auto; font-size: 14px; color: #374151; }
.myio-stdmodal__footer {
  display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px;
  border-top: 1px solid #e0e0e0; background: #fff;
}
.myio-stdmodal__btn {
  font-family: inherit; padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px;
  font-weight: 500; cursor: pointer; transition: all 0.2s; color: #fff;
}
.myio-stdmodal__btn--secondary { background: #6c757d; }
.myio-stdmodal__btn--secondary:hover:not(:disabled) { background: #545b62; }
.myio-stdmodal__btn--primary { background: var(--myio-brand-700, #3e1a7d); }
.myio-stdmodal__btn--primary:hover:not(:disabled) { background: var(--myio-brand-600, #2d1458); }
.myio-stdmodal__btn--danger { background: #dc3545; }
.myio-stdmodal__btn--danger:hover:not(:disabled) { background: #b02a37; }
.myio-stdmodal__btn:disabled { opacity: 0.6; cursor: not-allowed; }
.myio-stdmodal__btn:focus-visible { outline: 2px solid #7c3aed; outline-offset: 2px; }
`;
  document.head.appendChild(style);
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openStandardModal(params: StandardModalParams): StandardModalInstance {
  injectStyles();
  const dismissible = params.dismissible ?? true;
  const buttons = params.buttons ?? [];
  const modalId = `myio-stdmodal-${++openCount}`;
  const width = params.width == null ? '480px' : typeof params.width === 'number' ? `${params.width}px` : params.width;

  const overlay = document.createElement('div');
  overlay.className = 'myio-stdmodal-overlay';
  overlay.style.zIndex = String(BASE_Z_INDEX + openCount);
  overlay.innerHTML = `
    <div class="myio-stdmodal" role="dialog" aria-modal="true" aria-label="${escapeHtml(params.title)}" style="width:${width}">
      ${ModalHeader.generateHTML({
        icon: params.icon,
        title: escapeHtml(params.title),
        modalId,
        showThemeToggle: false,
        showMaximize: false,
        showClose: dismissible,
        draggable: false,
      })}
      <div class="myio-stdmodal__body"></div>
      ${
        buttons.length
          ? `<div class="myio-stdmodal__footer">${buttons
              .map(
                (b, i) =>
                  `<button type="button" class="myio-stdmodal__btn myio-stdmodal__btn--${b.variant ?? 'secondary'}" data-index="${i}" data-value="${escapeHtml(b.value)}">${escapeHtml(b.label)}</button>`
              )
              .join('')}</div>`
          : ''
      }
    </div>`;

  const root = overlay.querySelector<HTMLElement>('.myio-stdmodal')!;
  const bodyEl = root.querySelector<HTMLElement>('.myio-stdmodal__body')!;
  bodyEl.innerHTML = params.bodyHtml;
  const previousFocus = document.activeElement as HTMLElement | null;
  (params.container ?? document.body).appendChild(overlay);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown, true);
    overlay.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
    params.onClose?.();
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (!overlay.isConnected) return;
    if (e.key === 'Escape' && dismissible) {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const f = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', onKeydown, true);

  // ✕ do ModalHeader — busca dentro do próprio modal (getElementById falha em shadow DOM)
  root.querySelector<HTMLButtonElement>(`#${modalId}-close`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  if (dismissible) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  root.querySelectorAll<HTMLButtonElement>('.myio-stdmodal__btn').forEach((el) => {
    el.addEventListener('click', () => {
      const b = buttons[Number(el.dataset.index)];
      if (!b || el.disabled) return;
      params.onButton?.(b.value);
      if (b.closeOnClick !== false) close();
    });
  });

  (root.querySelector<HTMLElement>(`.myio-stdmodal__body ${FOCUSABLE}`) ??
    root.querySelector<HTMLElement>('.myio-stdmodal__btn--primary') ??
    root)?.focus?.();

  return {
    close,
    getRoot: () => root,
    getBodyEl: () => bodyEl,
    setBodyHtml: (html: string) => {
      bodyEl.innerHTML = html;
    },
    setButton: (value, patch) => {
      const el = Array.from(root.querySelectorAll<HTMLButtonElement>('.myio-stdmodal__btn')).find(
        (b) => b.dataset.value === value
      );
      if (!el) return;
      if (patch.label !== undefined) el.textContent = patch.label;
      if (patch.disabled !== undefined) el.disabled = patch.disabled;
      if (patch.hidden !== undefined) el.style.display = patch.hidden ? 'none' : '';
    },
  };
}
