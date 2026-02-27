/**
 * RFC-0152 Phase 4: Alarm Card Component
 * Reusable alarm card rendering for the list view
 */

import type { Alarm } from '../../types/alarm';
import {
  SEVERITY_CONFIG,
  STATE_CONFIG,
  isAlarmActive,
} from '../../types/alarm';
import type { AlarmCardParams } from './types';
import type { AlarmAnnotation } from './AlarmAnnotations';
import { getAlarmAnnotations } from './AlarmAnnotations';
import { AnnotationTooltip } from '../../utils/AnnotationTooltip';

/**
 * Get initials from customer name for avatar
 */
function getCustomerInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * Format absolute date+time for card top-right: "dd/MM HH:mm"
 */
function formatAlarmDateTime(isoString: string | number | null | undefined): string {
  if (isoString === null || isoString === undefined || isoString === '') return '-';
  let date = new Date(isoString as string);
  if (isNaN(date.getTime())) {
    const ts = Number(isoString);
    if (!isNaN(ts)) date = new Date(ts);
  }
  if (isNaN(date.getTime())) return '-';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

/**
 * Format relative time for display (e.g., "6d ago", "just now")
 */
function formatRelativeTimeShort(isoString: string | number | null | undefined): string {
  try {
    if (isoString === null || isoString === undefined || isoString === '') return '-';
    let date = new Date(isoString as string);
    if (isNaN(date.getTime())) {
      const ts = Number(isoString);
      if (!isNaN(ts)) date = new Date(ts);
    }
    if (isNaN(date.getTime())) return '-';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d atrás`;
    if (diffHours > 0) return `${diffHours}h atrás`;
    if (diffMinutes > 0) return `${diffMinutes}m atrás`;
    return 'agora';
  } catch {
    return '-';
  }
}

/**
 * Render tags with overflow
 */
function renderTags(tags: Record<string, string>, maxVisible = 3): string {
  const entries = Object.entries(tags);
  if (entries.length === 0) return '';

  const visibleTags = entries.slice(0, maxVisible);
  const overflowCount = entries.length - maxVisible;

  const tagsHtml = visibleTags
    .map(([key, value]) => `<span class="alarm-tag">${key}: ${value}</span>`)
    .join('');

  const overflowHtml =
    overflowCount > 0
      ? `<span class="alarm-tag alarm-tag-overflow">+${overflowCount}</span>`
      : '';

  return `<div class="alarm-card-tags">${tagsHtml}${overflowHtml}</div>`;
}

/**
 * Building icon SVG for shopping badge
 */
const BUILDING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chip-icon"><path d="M4 22h16"/><path d="M7 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/><path d="M9 18h6"/><path d="M9 14h6"/><path d="M9 10h6"/><path d="M9 6h6"/></svg>`;

/**
 * Render an alarm card as HTML string
 */
export function renderAlarmCard(alarm: Alarm, _params?: AlarmCardParams): string {
  const severityConfig = SEVERITY_CONFIG[alarm.severity];
  const stateConfig = STATE_CONFIG[alarm.state];
  const isActive = isAlarmActive(alarm.state);
  const firstSeenRelative = formatRelativeTimeShort(alarm.firstOccurrence);
  const lastSeenRelative = formatRelativeTimeShort(alarm.lastOccurrence);
  const isSelected = _params?.selected ?? false;

  // Safely escape values — title truncated to 18 visible chars
  const rawTitle = alarm.title || 'Sem título';
  // CSS handles 2-line clamp; JS truncates only beyond 42 chars (21 per line × 2)
  const truncatedTitle = rawTitle.length > 42 ? rawTitle.substring(0, 42) + '…' : rawTitle;
  const safeTitle = escapeHtml(truncatedTitle);
  const safeTitleFull = escapeHtml(rawTitle); // used in title tooltip
  const safeCustomerName = escapeHtml(alarm.customerName || 'N/A');
  const safeOccurrences = alarm.occurrenceCount || 1;
  const showCustomer = _params?.showCustomerName ?? true;
  const showDeviceBadge = _params?.showDeviceBadge ?? false;
  const safeSource = escapeHtml(alarm.source || '');
  const alarmTypes = _params?.alarmTypes ?? [];
  const typeChipsHtml = alarmTypes.length > 0
    ? `<div class="alarm-card-type-scroll">
      <button class="alarm-type-scroll-btn alarm-type-scroll-btn--left" tabindex="-1" aria-hidden="true">&#8249;</button>
      <div class="alarm-card-type-list">${
        alarmTypes.map((t) =>
          `<span class="alarm-type-chip" title="${escapeHtml(t)}">${escapeHtml(t.length > 22 ? t.substring(0, 22) + '…' : t)}</span>`
        ).join('')
      }</div>
      <button class="alarm-type-scroll-btn alarm-type-scroll-btn--right" tabindex="-1" aria-hidden="true">&#8250;</button>
    </div>`
    : '';

  return `<article class="alarm-card${isSelected ? ' alarm-card--selected' : ''}" data-alarm-id="${alarm.id}" data-severity="${alarm.severity}" data-state="${alarm.state}">
  <header class="alarm-card-header">
    <label class="alarm-card-checkbox-wrap" title="Selecionar para ação em lote" onclick="event.stopPropagation()">
      <input type="checkbox" class="alarm-card-select" data-alarm-id="${alarm.id}" data-alarm-title="${escapeHtml(rawTitle)}"${isSelected ? ' checked' : ''}>
    </label>
    ${showDeviceBadge && safeSource ? `<span class="alarm-card-device-badge" title="${safeSource}"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M4 6h16v10H4zm8 12c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-4 0h8v-1H8v1z"/></svg>${safeSource}</span>` : ''}
    <div class="alarm-card-badges">
      <span class="alarm-severity-badge" data-severity="${alarm.severity}" title="${severityConfig.label}">${severityConfig.icon}</span>
      <span class="alarm-state-badge" data-state="${alarm.state}">${stateConfig.label}</span>
    </div>
  </header>
  <div class="alarm-card-body">
    <div class="alarm-card-title" title="${safeTitleFull}">${safeTitle}</div>
    ${typeChipsHtml}
    ${showCustomer ? `<span class="alarm-shopping-chip">${BUILDING_ICON}<span class="chip-text">${safeCustomerName}</span></span>` : ''}
    <div class="alarm-card-stats">
      <div class="alarm-stat">
        <span class="alarm-stat-value alarm-stat-value--large">${safeOccurrences}</span>
        <span class="alarm-stat-label">Qte.</span>
      </div>
      <div class="alarm-stat">
        <span class="alarm-stat-value">${firstSeenRelative}</span>
        <span class="alarm-stat-label">1a. Ocorrência</span>
      </div>
      <div class="alarm-stat">
        <span class="alarm-stat-value">${lastSeenRelative}</span>
        <span class="alarm-stat-label">Últ. Ocorrência</span>
      </div>
    </div>
  </div>
  <footer class="alarm-card-footer">
    ${!_params?.hideActions && isActive ? `<button class="btn btn-ack" data-action="acknowledge" data-alarm-id="${alarm.id}" title="Reconhecer"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>` : ''}
    ${!_params?.hideActions && alarm.state !== 'CLOSED' ? `<button class="btn btn-snooze" data-action="snooze" data-alarm-id="${alarm.id}" title="Adiar"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg></button>` : ''}
    ${!_params?.hideActions && alarm.state !== 'CLOSED' ? `<button class="btn btn-escalate" data-action="escalate" data-alarm-id="${alarm.id}" title="Escalar"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg></button>` : ''}
    <button class="btn btn-details" data-action="details" data-alarm-id="${alarm.id}" title="Detalhes"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></button>
  </footer>
</article>`;
}

/**
 * Create an alarm card as HTMLElement
 */
export function createAlarmCardElement(
  alarm: Alarm,
  params?: AlarmCardParams
): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = renderAlarmCard(alarm, params);
  const card = container.firstElementChild as HTMLElement;

  // Bind event handlers
  if (params?.onCardClick) {
    card.addEventListener('click', (e) => {
      // Don't trigger card click if a button, label or checkbox was clicked
      if ((e.target as HTMLElement).closest('button, label, input[type="checkbox"]')) return;
      params.onCardClick?.(alarm);
    });
  }

  // Checkbox for bulk selection
  const checkbox = card.querySelector('.alarm-card-select') as HTMLInputElement | null;
  if (checkbox && params?.onSelectChange) {
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      params.onSelectChange?.(alarm.id, (e.target as HTMLInputElement).checked);
      card.classList.toggle('alarm-card--selected', (e.target as HTMLInputElement).checked);
    });
  }

  // Bind button handlers
  const ackBtn = card.querySelector('[data-action="acknowledge"]');
  if (ackBtn && params?.onAcknowledge) {
    ackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      params.onAcknowledge?.(alarm.id);
    });
  }

  const detailsBtn = card.querySelector('[data-action="details"]');
  if (detailsBtn && params?.onDetails) {
    detailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      params.onDetails?.(alarm.id);
    });
  }

  const snoozeBtn = card.querySelector('[data-action="snooze"]');
  if (snoozeBtn) {
    snoozeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (params?.onSnooze) {
        params.onSnooze(alarm.id);
      } else {
        // Fallback: custom event for backward compatibility
        card.dispatchEvent(new CustomEvent('alarm-snooze', { bubbles: true, detail: { alarmId: alarm.id } }));
      }
    });
  }

  const escalateBtn = card.querySelector('[data-action="escalate"]');
  if (escalateBtn) {
    escalateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (params?.onEscalate) {
        params.onEscalate(alarm.id);
      } else {
        // Fallback: custom event for backward compatibility
        card.dispatchEvent(new CustomEvent('alarm-escalate', { bubbles: true, detail: { alarmId: alarm.id } }));
      }
    });
  }

  // Alarm type chips scroll arrows
  const typeList = card.querySelector('.alarm-card-type-list') as HTMLElement | null;
  const scrollLeft = card.querySelector('.alarm-type-scroll-btn--left') as HTMLButtonElement | null;
  const scrollRight = card.querySelector('.alarm-type-scroll-btn--right') as HTMLButtonElement | null;
  if (typeList && scrollLeft && scrollRight) {
    const updateArrows = () => {
      const canLeft = typeList.scrollLeft > 0;
      const canRight = typeList.scrollLeft < typeList.scrollWidth - typeList.clientWidth - 1;
      scrollLeft.style.opacity = canLeft ? '1' : '0';
      scrollLeft.style.pointerEvents = canLeft ? 'auto' : 'none';
      scrollRight.style.opacity = canRight ? '1' : '0';
      scrollRight.style.pointerEvents = canRight ? 'auto' : 'none';
    };
    scrollLeft.addEventListener('click', (e) => { e.stopPropagation(); typeList.scrollBy({ left: -80, behavior: 'smooth' }); });
    scrollRight.addEventListener('click', (e) => { e.stopPropagation(); typeList.scrollBy({ left: 80, behavior: 'smooth' }); });
    typeList.addEventListener('scroll', updateArrows);
    requestAnimationFrame(updateArrows);
  }

  // Annotation type badges — same pattern as TELEMETRY widget
  _attachAnnotationBadges(card, alarm.id);

  return card;
}

// -----------------------------------------------------------------------
// Annotation type badges — TELEMETRY pattern
// -----------------------------------------------------------------------

const ANNOT_TYPE_CFG = {
  pending:     { color: '#d63031', icon: '⚠️', label: 'Pendência' },
  maintenance: { color: '#e17055', icon: '🔧', label: 'Manutenção' },
  activity:    { color: '#00b894', icon: '✓',   label: 'Atividade' },
  observation: { color: '#0984e3', icon: '📝',  label: 'Observação' },
} as const;

const ANNOT_TYPE_ORDER = ['pending', 'maintenance', 'activity', 'observation'] as const;

/**
 * Add annotation type badges to an alarm card (same visual pattern as TELEMETRY widget).
 * Only called when annotations exist; appended directly to the card element.
 */
function _attachAnnotationBadges(card: HTMLElement, alarmId: string): void {
  const allAnnotations = getAlarmAnnotations(alarmId);
  const active = allAnnotations.filter((a) => !a.archived);
  if (active.length === 0) return;

  // Group by type
  const byType: Record<string, AlarmAnnotation[]> = {};
  active.forEach((a) => {
    (byType[a.type] ??= []).push(a);
  });

  const container = document.createElement('div');
  container.className = 'annotation-type-badges';

  let addedAny = false;
  ANNOT_TYPE_ORDER.forEach((type) => {
    const list = byType[type];
    if (!list || list.length === 0) return;
    const cfg = ANNOT_TYPE_CFG[type];

    const badge = document.createElement('div');
    badge.className = 'annotation-type-badge';
    badge.style.background = cfg.color;
    badge.title = `${cfg.label} (${list.length})`;
    badge.innerHTML = `<span>${cfg.icon}</span><span class="annotation-type-badge__count">${list.length}</span>`;

    const cleanup = AnnotationTooltip.attach(badge, () => list);
    const prev = (card as HTMLElement & { _annotCleanup?: () => void })._annotCleanup;
    (card as HTMLElement & { _annotCleanup?: () => void })._annotCleanup = prev
      ? () => { prev(); cleanup(); }
      : cleanup;

    container.appendChild(badge);
    addedAny = true;
  });

  if (!addedAny) return;
  card.appendChild(container);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render multiple alarm cards
 */
export function renderAlarmCards(
  alarms: Alarm[],
  params?: AlarmCardParams
): string {
  return alarms.map((alarm) => renderAlarmCard(alarm, params)).join('');
}

/**
 * Create multiple alarm card elements
 */
export function createAlarmCardElements(
  alarms: Alarm[],
  params?: AlarmCardParams
): HTMLElement[] {
  return alarms.map((alarm) => createAlarmCardElement(alarm, params));
}
