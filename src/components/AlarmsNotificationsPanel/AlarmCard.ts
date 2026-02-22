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
 * Format relative time for display (e.g., "6d ago", "just now")
 */
function formatRelativeTimeShort(isoString: string | null | undefined): string {
  try {
    if (!isoString) return '-';
    const date = new Date(isoString);
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
  const relativeTime = formatAlarmRelativeTime(alarm.lastOccurrence);
  const firstSeenRelative = formatRelativeTimeShort(alarm.firstOccurrence);
  const lastSeenRelative = formatRelativeTimeShort(alarm.lastOccurrence);

  // Safely escape values
  const safeTitle = escapeHtml(alarm.title || 'Sem título');
  const safeCustomerName = escapeHtml(alarm.customerName || 'N/A');
  const safeSource = escapeHtml(alarm.source || 'N/A');
  const safeOccurrences = alarm.occurrenceCount || 1;

  return `<article class="alarm-card" data-alarm-id="${alarm.id}" data-severity="${alarm.severity}" data-state="${alarm.state}">
  <header class="alarm-card-header">
    <div class="alarm-card-badges">
      <span class="alarm-severity-badge" data-severity="${alarm.severity}">
        <span class="badge-icon">${severityConfig.icon}</span>
        <span class="badge-label">${severityConfig.label}</span>
      </span>
      <span class="alarm-state-badge" data-state="${alarm.state}">${stateConfig.label}</span>
    </div>
    <span class="alarm-card-time">${relativeTime}</span>
  </header>
  <div class="alarm-card-body">
    <h3 class="alarm-card-title">${safeTitle}</h3>
    <p class="alarm-card-id">${alarm.id}</p>
    <span class="alarm-shopping-chip">${BUILDING_ICON}<span class="chip-text">${safeCustomerName}</span></span>
    <div class="alarm-card-stats">
      <div class="alarm-stat">
        <span class="alarm-stat-value alarm-stat-value--large">${safeOccurrences}</span>
        <span class="alarm-stat-label">Ocorrências</span>
      </div>
      <div class="alarm-stat">
        <span class="alarm-stat-value">${firstSeenRelative}</span>
        <span class="alarm-stat-label">Primeira vez</span>
      </div>
      <div class="alarm-stat">
        <span class="alarm-stat-value">${lastSeenRelative}</span>
        <span class="alarm-stat-label">Última vez</span>
      </div>
    </div>
    ${renderTags(alarm.tags)}
  </div>
  <footer class="alarm-card-footer">
    ${isActive ? `<button class="btn btn-ack" data-action="acknowledge" data-alarm-id="${alarm.id}">Reconhecer</button>` : ''}
    ${alarm.state !== 'CLOSED' ? `<button class="btn btn-snooze" data-action="snooze" data-alarm-id="${alarm.id}">Adiar</button>` : ''}
    ${alarm.state !== 'CLOSED' ? `<button class="btn btn-escalate" data-action="escalate" data-alarm-id="${alarm.id}">Escalar</button>` : ''}
    <button class="btn btn-details" data-action="details" data-alarm-id="${alarm.id}">Detalhes</button>
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
