/**
 * RFC-0242 — thread pieces: message bubbles, the turn footer
 * (tier · provider · model · tokens, "memórias usadas"), the streaming bubble,
 * notices/errors and the proposals card (Aprovar / Descartar).
 */
import { h } from './dom';
import type { Translator } from './i18n';
import type { MyIOBotProposal } from '../contract';

export interface ViewMessage {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  tier?: string | null;
  provider?: string | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  memoryIds?: string[];
  degradedFrom?: string | null;
  cappedFrom?: string | null;
}

function footer(t: Translator, m: ViewMessage): HTMLElement | null {
  if (m.role !== 'assistant' || (!m.tier && !m.provider && !m.model)) return null;
  const meta = h('div', { class: 'meta', 'data-part': 'turn-meta' });
  if (m.tier) meta.appendChild(h('span', { class: 'tier' }, m.tier));
  if (m.provider) meta.appendChild(h('span', null, m.provider));
  if (m.model) meta.appendChild(h('span', null, m.model));
  if (m.tokensIn != null || m.tokensOut != null) {
    meta.appendChild(h('span', { title: 'tokens' }, t('tokens', { in: m.tokensIn ?? 0, out: m.tokensOut ?? 0 })));
  }
  if (m.degradedFrom && m.tier) meta.appendChild(h('span', null, t('degraded', { from: m.degradedFrom, to: m.tier })));
  if (m.cappedFrom && m.tier) meta.appendChild(h('span', null, t('capped', { from: m.cappedFrom, to: m.tier })));
  const ids = m.memoryIds || [];
  if (ids.length) {
    meta.appendChild(
      h('details', { 'data-part': 'memories-used' },
        h('summary', null, t('memoriesUsed', { count: ids.length })),
        h('ul', null, ...ids.map((id) => h('li', null, id))))
    );
  }
  return meta;
}

export function renderMessage(t: Translator, m: ViewMessage): HTMLElement {
  return h('div', { class: `msg ${m.role}`, 'data-role': m.role },
    h('div', { class: 'bubble' }, m.content, footer(t, m)));
}

export function renderStreaming(t: Translator, text: string): { el: HTMLElement; set(text: string): void } {
  const bubble = h('div', { class: 'bubble', 'data-part': 'streaming' });
  const set = (v: string) => {
    bubble.textContent = '';
    if (v) bubble.textContent = v;
    else bubble.append(h('span', { class: 'spin', 'aria-hidden': 'true' }), t('thinking'));
  };
  set(text);
  return { el: h('div', { class: 'msg assistant' }, bubble), set };
}

export function renderAlert(kind: 'error' | 'info' | 'warn', text: string, onDismiss?: () => void, dismissLabel?: string): HTMLElement {
  return h('div', { class: `alert ${kind}`, role: kind === 'error' ? 'alert' : 'status', 'data-part': `alert-${kind}` },
    h('span', null, text),
    onDismiss ? h('button', { type: 'button', 'aria-label': dismissLabel || '×', onclick: onDismiss }, '×') : null);
}

export function renderProposals(
  t: Translator,
  proposals: MyIOBotProposal[],
  canDecide: (p: MyIOBotProposal) => boolean,
  onDecide: (id: string, d: 'approve' | 'reject') => void,
  onDismiss: (id: string) => void,
  pending: Set<string>
): HTMLElement {
  const any = proposals.some(canDecide);
  const card = h('div', { class: 'card', 'data-part': 'proposals' },
    h('h4', null, t('proposalsTitle', { count: proposals.length })),
    h('p', null, any ? t('proposalsHint') : t('proposalsReadOnly')));
  for (const p of proposals) {
    const busy = pending.has(p.id);
    const acts = canDecide(p)
      ? h('div', { class: 'acts' },
          h('button', { type: 'button', class: 'btn primary', 'data-action': 'approve', disabled: busy, onclick: () => onDecide(p.id, 'approve') }, t('approve')),
          h('button', { type: 'button', class: 'btn', 'data-action': 'reject', disabled: busy, onclick: () => onDecide(p.id, 'reject') }, t('discard')))
      : h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn', 'data-action': 'dismiss', onclick: () => onDismiss(p.id) }, t('ok')));
    card.appendChild(h('div', { class: 'row', 'data-proposal': p.id },
      h('span', null, p.summary, ' ', h('span', { class: 'tag' }, [p.kind, p.scopeType].filter(Boolean).join(' · '))),
      acts));
  }
  return card;
}
