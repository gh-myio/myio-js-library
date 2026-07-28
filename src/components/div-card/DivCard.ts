/**
 * DivCard — reusable vanilla TS/DOM collapsible card.
 *
 * Faithfully inspired by the gcdr-frontend React `SectionCard`
 * (src/components/ui/SectionCard.tsx): a card with an accent-colored header band
 * + border, collapse/expand on header click (chevron), a premium (i) InfoTooltip
 * (the same `myio-js-library` InfoTooltip), and a maximize/restore toggle.
 *
 * Framework-agnostic: returns a `{ element, body, ... }` handle. Write your
 * content into `handle.body`. Maximize portals the card to <body> as a
 * full-screen overlay (escapes any ancestor stacking context), with a backdrop
 * and ESC-to-restore.
 *
 * @example
 *   const card = createDivCard({ title: 'Climatização', accent: 'violet',
 *     infoHtml: '<b>Regras</b> de climatização…' });
 *   card.body.innerHTML = '…';
 *   container.appendChild(card.element);
 */
import { InfoTooltip } from '../../utils/tooltips/InfoTooltip';

export type DivCardAccent =
  | 'rose'
  | 'amber'
  | 'blue'
  | 'sky'
  | 'emerald'
  | 'violet'
  | 'slate'
  | 'none';

const STYLE_ID = 'myio-divcard-styles';

const ACCENTS: Record<Exclude<DivCardAccent, 'none'>, { band: string; border: string; title: string }> = {
  rose: { band: '#fff1f2', border: '#fecdd3', title: '#9f1239' },
  amber: { band: '#fffbeb', border: '#fde68a', title: '#92400e' },
  blue: { band: '#eff6ff', border: '#bfdbfe', title: '#1e3a8a' },
  sky: { band: '#f0f9ff', border: '#bae6fd', title: '#075985' },
  emerald: { band: '#ecfdf5', border: '#a7f3d0', title: '#065f46' },
  violet: { band: '#f5f3ff', border: '#ddd6fe', title: '#5b21b6' },
  slate: { band: '#f8fafc', border: '#e2e8f0', title: '#475569' },
};

export interface CreateDivCardOptions {
  /** Header title text. */
  title: string;
  /** Header band accent color (default 'blue'). */
  accent?: DivCardAccent;
  /** HTML rendered inside the premium InfoTooltip on hover of the (i) icon. */
  infoHtml?: string;
  /** Emoji shown in the tooltip header (default 'ℹ️'). */
  infoIcon?: string;
  /** Whether the header click toggles collapse (default true). */
  collapsible?: boolean;
  /** Whether to show the maximize/restore button (default true). */
  maximizable?: boolean;
  /** Initial collapsed state (default false). */
  collapsed?: boolean;
  /** Muted body styling (for residual/read-only sections). */
  muted?: boolean;
  /** Extra class(es) on the root <section>. */
  className?: string;
  /** Notified whenever the user collapses/expands. */
  onToggle?: (collapsed: boolean) => void;
  /** Notified whenever the user maximizes/restores. */
  onMaximize?: (maximized: boolean) => void;
}

export interface DivCardHandle {
  /** The card root element (<section>). Append it where you want the card. */
  element: HTMLElement;
  /** The content slot — write your content here. */
  body: HTMLElement;
  setCollapsed(collapsed: boolean): void;
  isCollapsed(): boolean;
  setMaximized(maximized: boolean): void;
  isMaximized(): boolean;
  /** Restores (un-maximizes) and removes listeners/backdrop. Call before discarding. */
  destroy(): void;
}

function escAttr(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

function injectStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
  .myio-divcard { box-sizing: border-box; font-family: 'Nunito', system-ui, sans-serif; border: 1px solid #e2e8f0;
    border-radius: 10px; overflow: hidden; margin-bottom: 10px; background: #fff; }
  .myio-divcard * { box-sizing: border-box; }
  .myio-divcard__head { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    border-bottom: 1px solid #e2e8f0; cursor: pointer; user-select: none; }
  .myio-divcard.is-collapsed .myio-divcard__head { border-bottom: none; }
  .myio-divcard:not(.is-collapsible) .myio-divcard__head { cursor: default; }
  .myio-divcard__chevron { font-size: 10px; color: #64748b; transition: transform .15s; flex-shrink: 0; }
  .myio-divcard.is-collapsed .myio-divcard__chevron { transform: rotate(-90deg); }
  .myio-divcard__title { font-size: 13px; font-weight: 800; flex: 1; min-width: 0; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; }
  .myio-divcard__actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
  .myio-divcard__btn { background: none; border: none; cursor: pointer; font-size: 14px; line-height: 1;
    padding: 3px 5px; color: #64748b; border-radius: 6px; }
  .myio-divcard__btn:hover { color: #2563eb; background: rgba(37,99,235,.08); }
  .myio-divcard__body { padding: 10px 12px; }
  .myio-divcard.is-collapsed .myio-divcard__body { display: none; }
  .myio-divcard.is-muted .myio-divcard__body { color: #94a3b8; font-size: 12px; }
  .myio-divcard.is-maximized { position: fixed; inset: 24px; z-index: 2147483001; margin: 0;
    overflow: auto; box-shadow: 0 24px 70px rgba(0,0,0,.35); }
  .myio-divcard.is-maximized .myio-divcard__body { max-height: calc(100vh - 120px); overflow: auto; }
  .myio-divcard__backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 2147483000; }
  `;
  document.head.appendChild(s);
}

let _openBackdrop: HTMLElement | null = null;

export function createDivCard(opts: CreateDivCardOptions): DivCardHandle {
  injectStyles();

  const accent = opts.accent ?? 'blue';
  const collapsible = opts.collapsible !== false;
  const maximizable = opts.maximizable !== false;
  const infoIcon = opts.infoIcon || 'ℹ️';
  const a = accent !== 'none' ? ACCENTS[accent] : null;

  let collapsed = !!opts.collapsed;
  let maximized = false;
  let origParent: Node | null = null;
  let origNext: Node | null = null;
  let detachInfo: (() => void) | null = null;

  const section = document.createElement('section');
  section.className = `myio-divcard${collapsible ? ' is-collapsible' : ''}${opts.muted ? ' is-muted' : ''}${
    collapsed ? ' is-collapsed' : ''
  }${opts.className ? ' ' + opts.className : ''}`;
  if (a) section.style.borderColor = a.border;

  const infoBtnHtml = opts.infoHtml
    ? `<button type="button" class="myio-divcard__btn myio-divcard__info" aria-label="info" title="info">ⓘ</button>`
    : '';
  const maxBtnHtml = maximizable
    ? `<button type="button" class="myio-divcard__btn myio-divcard__max" aria-label="maximizar" title="maximizar">⛶</button>`
    : '';

  section.innerHTML = `
    <div class="myio-divcard__head"${a ? ` style="background:${a.band};border-bottom-color:${a.border}"` : ''}>
      <span class="myio-divcard__chevron"${collapsible ? '' : ' style="visibility:hidden"'}>▾</span>
      <span class="myio-divcard__title"${a ? ` style="color:${a.title}"` : ''}>${escAttr(opts.title)}</span>
      <span class="myio-divcard__actions">${infoBtnHtml}${maxBtnHtml}</span>
    </div>
    <div class="myio-divcard__body"></div>`;

  const head = section.querySelector('.myio-divcard__head') as HTMLElement;
  const body = section.querySelector('.myio-divcard__body') as HTMLElement;
  const infoBtn = section.querySelector('.myio-divcard__info') as HTMLElement | null;
  const maxBtn = section.querySelector('.myio-divcard__max') as HTMLElement | null;

  function applyCollapsed(): void {
    section.classList.toggle('is-collapsed', collapsed);
  }

  function setCollapsed(next: boolean): void {
    if (next === collapsed) return;
    collapsed = next;
    applyCollapsed();
    opts.onToggle?.(collapsed);
  }

  function removeBackdrop(): void {
    if (_openBackdrop) {
      _openBackdrop.remove();
      _openBackdrop = null;
    }
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && maximized) setMaximized(false);
  }

  function setMaximized(next: boolean): void {
    if (next === maximized) return;
    maximized = next;
    if (next) {
      if (collapsed) setCollapsed(false);
      origParent = section.parentNode;
      origNext = section.nextSibling;
      removeBackdrop();
      _openBackdrop = document.createElement('div');
      _openBackdrop.className = 'myio-divcard__backdrop';
      _openBackdrop.addEventListener('click', () => setMaximized(false));
      document.body.appendChild(_openBackdrop);
      document.body.appendChild(section); // portal out of any stacking context
      section.classList.add('is-maximized');
      document.addEventListener('keydown', onKey);
      if (maxBtn) {
        maxBtn.textContent = '🗗';
        maxBtn.setAttribute('aria-label', 'restaurar');
        maxBtn.setAttribute('title', 'restaurar');
      }
    } else {
      section.classList.remove('is-maximized');
      removeBackdrop();
      document.removeEventListener('keydown', onKey);
      if (origParent) origParent.insertBefore(section, origNext);
      if (maxBtn) {
        maxBtn.textContent = '⛶';
        maxBtn.setAttribute('aria-label', 'maximizar');
        maxBtn.setAttribute('title', 'maximizar');
      }
    }
    opts.onMaximize?.(maximized);
  }

  if (collapsible) {
    head.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.myio-divcard__actions')) return;
      setCollapsed(!collapsed);
    });
  }

  if (infoBtn && opts.infoHtml) {
    detachInfo = InfoTooltip.attach(infoBtn, () => ({
      icon: infoIcon,
      title: opts.title,
      content: opts.infoHtml ?? '',
    }));
  }

  if (maxBtn) {
    maxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMaximized(!maximized);
    });
  }

  return {
    element: section,
    body,
    setCollapsed,
    isCollapsed: () => collapsed,
    setMaximized,
    isMaximized: () => maximized,
    destroy() {
      if (maximized) setMaximized(false);
      detachInfo?.();
      detachInfo = null;
      section.remove();
    },
  };
}

export default createDivCard;
