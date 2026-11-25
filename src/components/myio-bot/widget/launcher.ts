/**
 * RFC-0242 — the floating "MYIO Bot" pill. Muted on 403/404/503/offline,
 * pulsing dot while streaming, badge while a D-20 action waits.
 * The hidden state persists in localStorage (`myio:bot:launcherHidden` by default).
 */
import { h } from './dom';

export const DEFAULT_LAUNCHER_HIDDEN_KEY = 'myio:bot:launcherHidden';

export interface LauncherView {
  el: HTMLButtonElement;
  update(s: { open: boolean; muted: boolean; streaming: boolean; badge: string | null; hidden: boolean }): void;
}

export function createLauncher(label: string, side: 'right' | 'left', onClick: () => void): LauncherView {
  const text = h('span', null, label);
  const badge = h('span', { class: 'badge' });
  const el = h('button', { type: 'button', class: `launcher ${side}`, 'aria-label': label, title: label, 'aria-expanded': 'false', 'data-part': 'launcher', onclick: onClick },
    h('span', { class: 'dot', 'aria-hidden': 'true' }), text);
  return {
    el,
    update(s) {
      el.style.display = s.hidden ? 'none' : '';
      el.setAttribute('aria-expanded', s.open ? 'true' : 'false');
      el.classList.toggle('muted', s.muted);
      el.classList.toggle('streaming', s.streaming);
      if (s.badge) {
        badge.textContent = s.badge;
        if (!badge.parentNode) el.appendChild(badge);
      } else if (badge.parentNode) {
        badge.parentNode.removeChild(badge);
      }
    },
  };
}
