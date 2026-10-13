/**
 * RFC-0239 — DOM builders. Catalog data only reaches the DOM through textContent, dataset and
 * element.style (no innerHTML with catalog values).
 */
import type { ReportItemState, ReportsCatalogItem } from './types';

export const LOCKED_HINT = 'Indisponível para este cliente';

/** Accepts plain CSS colour values only (hex, rgb/hsl, named, var()). */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)|var\(--[a-z0-9-]+(,\s*#[0-9a-f]{3,8})?\)|[a-z]+)$/i;
const safeColor = (c: unknown): string => (typeof c === 'string' && SAFE_COLOR.test(c.trim()) ? c.trim() : '');

export interface CardRefs {
  cell: HTMLElement;
  card: HTMLButtonElement;
  text: HTMLElement;
  err: HTMLElement;
}

export function buildCard(
  doc: Document,
  domainId: string,
  item: ReportsCatalogItem,
  state: Exclude<ReportItemState, 'hidden'>,
): CardRefs {
  const cell = doc.createElement('div');
  cell.className = 'rh-cell';

  const card = doc.createElement('button');
  card.type = 'button';
  card.className = 'rh-card';
  card.dataset.domain = domainId;
  card.dataset.item = item.id;
  card.dataset.state = state;

  const ico = doc.createElement('span');
  ico.className = 'rh-ico';
  ico.setAttribute('aria-hidden', 'true');
  ico.textContent = item.icon || '';
  const bg = safeColor(item.tint?.bg);
  const fg = safeColor(item.tint?.fg);
  if (bg) ico.style.background = bg;
  if (fg) ico.style.color = fg;

  const text = doc.createElement('span');
  text.className = 'rh-text';
  const title = doc.createElement('span');
  title.className = 'rh-title';
  title.textContent = item.label;
  const desc = doc.createElement('span');
  desc.className = 'rh-desc';
  desc.textContent = item.description || '';
  text.append(title, desc);
  card.append(ico, text);

  if (state === 'locked') {
    card.setAttribute('aria-disabled', 'true');
    card.title = LOCKED_HINT;
    card.setAttribute('aria-label', `${item.label} — ${LOCKED_HINT}`);
    const lock = doc.createElement('span');
    lock.className = 'rh-lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.textContent = '🔒';
    const hint = doc.createElement('span');
    hint.className = 'rh-hint';
    hint.textContent = LOCKED_HINT;
    text.appendChild(hint);
    card.appendChild(lock);
  } else {
    card.setAttribute('aria-label', item.label);
  }

  const err = doc.createElement('div');
  err.className = 'rh-err';
  err.setAttribute('aria-live', 'polite');

  cell.append(card, err);
  return { cell, card, text, err };
}
