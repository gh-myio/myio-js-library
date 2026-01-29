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
 * Format date for display
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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
 * Render an alarm card as HTML string
 */
export function renderAlarmCard(alarm: Alarm, _params?: AlarmCardParams): string {
  const severityConfig = SEVERITY_CONFIG[alarm.severity];
  const stateConfig = STATE_CONFIG[alarm.state];
  const isActive = isAlarmActive(alarm.state);
  const relativeTime = formatAlarmRelativeTime(alarm.lastOccurrence);

  return `
    <article
      class="alarm-card"
      data-alarm-id="${alarm.id}"
      data-severity="${alarm.severity}"
      data-state="${alarm.state}"
    >
      <header class="alarm-card-header">
        <div class="alarm-card-badges">
          <span class="alarm-severity-badge" data-severity="${alarm.severity}">
            <span class="badge-icon">${severityConfig.icon}</span>
            <span class="badge-label">${severityConfig.label}</span>
          </span>
          <span class="alarm-state-badge" data-state="${alarm.state}">
            ${stateConfig.label}
          </span>
        </div>
        <span class="alarm-card-time">${relativeTime}</span>
      </header>

      <div class="alarm-card-body">
        <h3 class="alarm-card-title">${escapeHtml(alarm.title)}</h3>
        <p class="alarm-card-id">${alarm.id}</p>

        <div class="alarm-card-customer">
          <div class="alarm-customer-avatar">
            ${getCustomerInitials(alarm.customerName)}
          </div>
          <div class="alarm-customer-info">
            <div class="alarm-customer-name">${escapeHtml(alarm.customerName)}</div>
            <div class="alarm-customer-source">${escapeHtml(alarm.source)}</div>
          </div>
        </div>

        <div class="alarm-card-stats">
          <div class="alarm-stat">
            <span class="alarm-stat-label">Ocorrencias</span>
            <span class="alarm-stat-value">${alarm.occurrenceCount}</span>
          </div>
          <div class="alarm-stat">
            <span class="alarm-stat-label">Primeira</span>
            <span class="alarm-stat-value">${formatDate(alarm.firstOccurrence)}</span>
          </div>
          <div class="alarm-stat">
            <span class="alarm-stat-label">Ultima</span>
            <span class="alarm-stat-value">${formatDate(alarm.lastOccurrence)}</span>
          </div>
        </div>

        ${renderTags(alarm.tags)}
      </div>

      <footer class="alarm-card-footer">
        ${
          isActive
            ? `<button class="btn btn-ack" data-action="acknowledge" data-alarm-id="${alarm.id}">
                Reconhecer
              </button>`
            : ''
        }
        <button class="btn btn-details" data-action="details" data-alarm-id="${alarm.id}">
          Detalhes
        </button>
        ${
          alarm.state !== 'CLOSED'
            ? `<button class="btn btn-more" data-action="more" data-alarm-id="${alarm.id}">
                &#8942;
              </button>`
            : ''
        }
      </footer>
    </article>
  `;
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

  const moreBtn = card.querySelector('[data-action="more"]');
  if (moreBtn && params?.onMore) {
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      params.onMore?.(alarm.id, e as MouseEvent);
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
