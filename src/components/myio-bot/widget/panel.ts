/**
 * RFC-0242 — the panel skeleton inside the Shadow DOM: header ("MYIO Bot",
 * conversation title, Nova conversa / Abrir no GCDR / Ocultar / Fechar), the
 * scrollable body and the composer slot; plus the full-card access states.
 */
import { h } from './dom';
import type { Translator } from './i18n';

export type AccessPhase = 'restricted' | 'disabled' | 'off' | 'offline' | 'error';

export interface PanelView {
  el: HTMLElement;
  body: HTMLElement;
  /** Drag handle (the header). */
  head: HTMLElement;
  setSubtitle(text: string): void;
  setGcdrHref(href: string | null): void;
  setNewEnabled(on: boolean, busy?: boolean): void;
  /** Swaps the maximize/restore icon and label (InfoTooltip's icons). */
  setMaximized(on: boolean): void;
}

const ICON_MAXIMIZE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
const ICON_RESTORE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 5V3h12v12h-2"/></svg>';

export function createPanel(
  t: Translator,
  opts: { side: 'right' | 'left'; solo: boolean; canHide: boolean },
  actions: { onNew(): void; onHide(): void; onClose(): void; onMaximize(): void }
): PanelView {
  const subtitle = h('div', { class: 's', 'data-part': 'subtitle' }, t('subtitle'));
  const btnNew = h('button', { type: 'button', class: 'icon', 'data-part': 'new', title: t('newConversation'), 'aria-label': t('newConversation'), onclick: actions.onNew }, '+');
  const link = h('a', { class: 'icon', 'data-part': 'open-gcdr', target: '_blank', rel: 'noopener noreferrer', title: t('openInGcdr'), 'aria-label': t('openInGcdr') }, '↗');
  const btnMax = h('button', { type: 'button', class: 'icon', 'data-part': 'maximize', title: t('maximize'), 'aria-label': t('maximize'), 'aria-pressed': 'false', onclick: actions.onMaximize });
  btnMax.innerHTML = ICON_MAXIMIZE; // static, trusted markup
  const tools = h('div', { class: 'tools' }, btnNew, link,
    opts.canHide ? h('button', { type: 'button', class: 'icon', 'data-part': 'hide', title: t('hideLauncher'), 'aria-label': t('hideLauncher'), onclick: actions.onHide }, '–') : null,
    btnMax,
    h('button', { type: 'button', class: 'icon', 'data-part': 'close', title: t('close'), 'aria-label': t('close'), onclick: actions.onClose }, '×'));
  const body = h('div', { class: 'body', 'data-part': 'body', 'aria-live': 'polite' });
  const head = h('div', { class: 'head', 'data-part': 'head', 'data-drag-handle': '' },
    h('div', { style: 'min-width:0' }, h('div', { class: 't' }, t('title')), subtitle), tools);
  const el = h('div', { class: `panel ${opts.side}${opts.solo ? ' solo' : ''}`, role: 'dialog', 'aria-label': t('title'), 'data-part': 'panel' }, head, body);
  link.style.display = 'none';
  // Header controls must never keep keyboard focus after a mouse/touch press: a focused
  // `+` / `–` would be "clicked" by the next Space the user types (RFC-0242 bugfix).
  // preventDefault on pointer/mouse down keeps the focus where it was (the composer); the click still fires.
  tools.querySelectorAll('button, a').forEach((b) => {
    const keep = (e: Event) => e.preventDefault();
    b.addEventListener('mousedown', keep);
    b.addEventListener('pointerdown', keep);
  });
  return {
    el,
    body,
    head,
    setSubtitle(text) { subtitle.textContent = text; subtitle.title = text; },
    setGcdrHref(href) {
      if (href) { link.setAttribute('href', href); link.style.display = ''; } else { link.removeAttribute('href'); link.style.display = 'none'; }
    },
    setMaximized(on) {
      btnMax.innerHTML = on ? ICON_RESTORE : ICON_MAXIMIZE;
      const label = on ? t('restore') : t('maximize');
      btnMax.title = label;
      btnMax.setAttribute('aria-label', label);
      btnMax.setAttribute('aria-pressed', on ? 'true' : 'false');
      btnMax.setAttribute('data-state', on ? 'maximized' : 'normal');
      el.classList.toggle('maximized', on);
    },
    setNewEnabled(on, busy = false) {
      btnNew.style.display = on ? '' : 'none';
      btnNew.disabled = !on || busy;
    },
  };
}

const TITLES: Record<AccessPhase, ['restrictedTitle' | 'disabledTitle' | 'offTitle' | 'offlineTitle' | 'errorTitle', 'restrictedText' | 'disabledText' | 'offText' | 'offlineText' | 'errorText']> = {
  restricted: ['restrictedTitle', 'restrictedText'],
  disabled: ['disabledTitle', 'disabledText'],
  off: ['offTitle', 'offText'],
  offline: ['offlineTitle', 'offlineText'],
  error: ['errorTitle', 'errorText'],
};

/** Full-card state for 403 / 404 / 503 / offline / hard errors, with the API message when there is one. */
export function renderState(t: Translator, phase: AccessPhase, message: string | null, onRetry: () => void): HTMLElement {
  const [title, text] = TITLES[phase];
  return h('div', { class: 'state', 'data-state': phase },
    h('h3', null, t(title)),
    h('p', null, t(text)),
    message ? h('p', { 'data-part': 'state-message' }, message) : null,
    h('button', { type: 'button', class: 'btn', 'data-action': 'retry', onclick: onRetry }, t('retry')));
}
