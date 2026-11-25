/**
 * RFC-0242 / gcdr RFC-0087 D-20 — the pending write action of a turn: the
 * server's own summary and affected count, the exact arguments, a countdown to
 * the server TTL and Confirmar / Cancelar. Rendered only when a turn carries
 * `pendingAction`; the widget never confirms without a click.
 */
import { h } from './dom';
import type { Translator } from './i18n';
import type { MyIOBotPendingAction } from '../contract';

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

export interface ActionCardView {
  el: HTMLElement;
  /** Updates the countdown; returns false once expired. */
  tick(now?: number): boolean;
}

export function renderActionCard(
  t: Translator,
  action: MyIOBotPendingAction,
  busy: boolean,
  onConfirm: () => void,
  onCancel: () => void
): ActionCardView {
  const expiresAt = action.expiresAt ? Date.parse(action.expiresAt) : NaN;
  const countdown = h('p', { 'data-part': 'action-countdown' });
  const confirm = h('button', { type: 'button', class: 'btn primary', 'data-action': 'confirm', disabled: busy, onclick: onConfirm }, t('confirm'));
  const cancel = h('button', { type: 'button', class: 'btn danger', 'data-action': 'cancel', disabled: busy, onclick: onCancel }, t('cancelAction'));
  const args = action.arguments && typeof action.arguments === 'object' ? Object.keys(action.arguments) : [];
  const el = h('div', { class: 'card action', 'data-part': 'action-card', 'data-action-id': action.id },
    h('h4', null, t('actionTitle')),
    h('div', null, action.summary || action.tool),
    action.tool ? h('span', { class: 'tag' }, action.tool) : null,
    args.length
      ? h('table', null, h('tbody', null, ...args.map((k) => h('tr', null, h('td', null, k), h('td', null, fmtValue(action.arguments[k]))))))
      : null,
    typeof action.affectedCount === 'number' ? h('p', { 'data-part': 'action-affected' }, t('affected', { count: action.affectedCount })) : null,
    Number.isFinite(expiresAt) ? countdown : null,
    h('div', { class: 'acts' }, confirm, cancel));

  const tick = (now = Date.now()) => {
    if (!Number.isFinite(expiresAt)) return true;
    const left = expiresAt - now;
    if (left <= 0) {
      countdown.textContent = t('expired');
      confirm.disabled = true;
      return false;
    }
    countdown.textContent = t('expiresIn', { time: fmtLeft(left) });
    return true;
  };
  tick();
  return { el, tick };
}
