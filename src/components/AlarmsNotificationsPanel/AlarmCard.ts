/**
 * RFC-0152 Phase 4: Alarm Card Component
 * Reusable alarm card rendering for the list view
 */

import type { Alarm } from '../../types/alarm';
import {
  SEVERITY_CONFIG,
  STATE_CONFIG,
  formatAlarmRelativeTime,
  isAlarmActive,
} from '../../types/alarm';
import type { AlarmCardParams } from './types';
import { getActiveAnnotationCount, getAlarmAnnotations } from './AlarmAnnotations';
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
  const relativeTime = formatAlarmDateTime(alarm.lastOccurrence);
  const firstSeenRelative = formatRelativeTimeShort(alarm.firstOccurrence);
  const lastSeenRelative = formatRelativeTimeShort(alarm.lastOccurrence);

  // Safely escape values — title truncated to 18 visible chars
  const rawTitle = alarm.title || 'Sem título';
  const truncatedTitle = rawTitle.length > 18 ? rawTitle.substring(0, 18) + '…' : rawTitle;
  const safeTitle = escapeHtml(truncatedTitle);
  const safeTitleFull = escapeHtml(rawTitle); // used in title tooltip
  const safeCustomerName = escapeHtml(alarm.customerName || 'N/A');
  const safeOccurrences = alarm.occurrenceCount || 1;
  const showCustomer = _params?.showCustomerName ?? true;
  const annotCount = getActiveAnnotationCount(alarm.id);

  return `<article class="alarm-card" data-alarm-id="${alarm.id}" data-severity="${alarm.severity}" data-state="${alarm.state}">
  <header class="alarm-card-header">
    <div class="alarm-card-badges">
      <span class="alarm-severity-badge" data-severity="${alarm.severity}" title="${severityConfig.label}">${severityConfig.icon}</span>
      <span class="alarm-state-badge" data-state="${alarm.state}">${stateConfig.label}</span>
    </div>
    <span class="alarm-card-time">${relativeTime}</span>
  </header>
  <div class="alarm-card-body">
    <h3 class="alarm-card-title" title="${safeTitleFull}">${safeTitle}</h3>
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
    ${isActive ? `<button class="btn btn-ack" data-action="acknowledge" data-alarm-id="${alarm.id}" title="Reconhecer"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></button>` : ''}
    ${alarm.state !== 'CLOSED' ? `<button class="btn btn-snooze" data-action="snooze" data-alarm-id="${alarm.id}" title="Adiar"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg></button>` : ''}
    ${alarm.state !== 'CLOSED' ? `<button class="btn btn-escalate" data-action="escalate" data-alarm-id="${alarm.id}" title="Escalar"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg></button>` : ''}
    <button class="btn btn-details" data-action="details" data-alarm-id="${alarm.id}" title="Detalhes"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></button>
    <button class="btn btn-annot alarm-annot-trigger" data-action="annotations" data-alarm-id="${alarm.id}" title="Anotações">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 001 1h4"/><path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
      ${annotCount > 0 ? `<span class="alarm-annot-count">${annotCount}</span>` : ''}
    </button>
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
      // Don't trigger card click if a button was clicked
      if ((e.target as HTMLElement).closest('button')) return;
      params.onCardClick?.(alarm);
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
      // Emit custom event for snooze action
      card.dispatchEvent(new CustomEvent('alarm-snooze', { bubbles: true, detail: { alarmId: alarm.id } }));
    });
  }

  const escalateBtn = card.querySelector('[data-action="escalate"]');
  if (escalateBtn) {
    escalateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Emit custom event for escalate action
      card.dispatchEvent(new CustomEvent('alarm-escalate', { bubbles: true, detail: { alarmId: alarm.id } }));
    });
  }

  // Annotation tooltip — attach to the annotation trigger button
  const annotTrigger = card.querySelector<HTMLElement>('.alarm-annot-trigger');
  if (annotTrigger) {
    const cleanupAnnot = AnnotationTooltip.attach(annotTrigger, () => getAlarmAnnotations(alarm.id));
    (card as HTMLElement & { _annotCleanup?: () => void })._annotCleanup = cleanupAnnot;
    // Prevent annotation button click from bubbling as a card click
    annotTrigger.addEventListener('click', (e) => e.stopPropagation());
  }

  return card;
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
