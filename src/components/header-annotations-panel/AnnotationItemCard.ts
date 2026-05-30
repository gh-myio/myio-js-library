/**
 * RFC-0203 M4 — Annotation item card (pure HTML renderer).
 *
 * Renders a single annotation row inside a group. Pure string-building —
 * no DOM operations, no event binding. The parent panel handles all wiring.
 */

import type {
  AnnotatedDevice,
  Annotation,
  AnnotationDeviceDomain,
} from '../../services/annotations/types';
import { highlightMatches } from './searchSortFilter';

const DOMAIN_ICONS: Record<AnnotationDeviceDomain, string> = {
  energy: '⚡',
  water: '💧',
  temperature: '🌡️',
  unknown: '·',
};

const TYPE_ICONS: Record<Annotation['type'], string> = {
  observation: '📝',
  pending: '⚠️',
  maintenance: '🔧',
  activity: '✓',
};

// RFC-0203 follow-up — importance labels + colors mirror canonical RFC-0104
// (src/components/premium-modals/settings/annotations/types.ts).
const IMPORTANCE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Muito Baixa',
  2: 'Baixa',
  3: 'Normal',
  4: 'Alta',
  5: 'Muito Alta',
};

const IMPORTANCE_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '#9E9E9E', // gray
  2: '#64B5F6', // light blue
  3: '#2196F3', // blue
  4: '#FF9800', // orange
  5: '#F44336', // red
};

const ITEM_TEXT_MAX = 120;

/** Escape HTML special characters to prevent injection from annotation text. */
export function escapeHtml(input: string): string {
  if (input == null) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Truncate to max chars with ellipsis. */
export function truncate(input: string, max: number): string {
  const s = String(input ?? '');
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

/** Format an ISO timestamp as "há X minutos / horas / dias" (PT-BR). */
export function formatRelative(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diffMs = now - t;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'agora há pouco';
  const min = Math.round(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `há ${hr} h`;
  const day = Math.round(hr / 24);
  if (day < 30) return `há ${day} d`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `há ${mo} mês${mo > 1 ? 'es' : ''}`;
  const yr = Math.round(mo / 12);
  return `há ${yr} ano${yr > 1 ? 's' : ''}`;
}

/** Returns true when a pending annotation's dueDate is in the past. */
export function isOverdue(annotation: Annotation, now: number = Date.now()): boolean {
  if (annotation.type !== 'pending') return false;
  if (!annotation.dueDate) return false;
  const due = new Date(annotation.dueDate).getTime();
  if (isNaN(due)) return false;
  return due < now;
}

/**
 * Pure renderer for one annotation item. Generates the `<button>` HTML for
 * a clickable row. The button carries the data-* attributes used by the
 * parent panel to dispatch `myio:annotation-clicked`.
 *
 * @param searchTerm — optional; when present, matches are wrapped in <mark>
 *                     across the displayed text + identifier + label (AC-22).
 */
export function renderAnnotationItemCard(
  device: Pick<AnnotatedDevice, 'deviceId' | 'name' | 'label' | 'identifier' | 'domain'>,
  annotation: Annotation,
  searchTerm?: string
): string {
  const domainIcon = DOMAIN_ICONS[device.domain] ?? DOMAIN_ICONS.unknown;
  const typeIcon = TYPE_ICONS[annotation.type] ?? '·';
  const importance = Math.max(1, Math.min(5, annotation.importance || 1));
  const textEscaped = escapeHtml(truncate(annotation.text || '', ITEM_TEXT_MAX));
  const deviceLabelEscaped = escapeHtml(device.label || device.name || device.deviceId);
  const author = escapeHtml(annotation.createdBy?.name || 'sem autor');
  const when = escapeHtml(formatRelative(annotation.createdAt));
  const overdueTag = isOverdue(annotation)
    ? '<span class="myio-annotations-overdue">Vencida</span>'
    : '';

  // Highlight matched substrings (already-escaped) — AC-22.
  const text = searchTerm ? highlightMatches(textEscaped, searchTerm) : textEscaped;
  const deviceLabel = searchTerm
    ? highlightMatches(deviceLabelEscaped, searchTerm)
    : deviceLabelEscaped;
  const identifierEscaped = device.identifier ? escapeHtml(device.identifier) : '';
  const identifierHighlighted =
    searchTerm && identifierEscaped
      ? highlightMatches(identifierEscaped, searchTerm)
      : identifierEscaped;
  const identifierTag = device.identifier
    ? `<span class="myio-annotations-item-device">${identifierHighlighted}</span>`
    : '';

  return `
<button
  class="myio-annotations-item"
  type="button"
  data-device-id="${escapeHtml(device.deviceId)}"
  data-annotation-id="${escapeHtml(annotation.id)}"
  tabindex="0"
  aria-label="${escapeHtml(annotation.text)} — ${deviceLabel}"
>
  <span class="myio-annotations-item-icon" aria-hidden="true">${typeIcon}</span>
  <div class="myio-annotations-item-body">
    <p class="myio-annotations-item-text">${text}</p>
    <div class="myio-annotations-item-meta">
      <span aria-hidden="true">${domainIcon}</span>
      ${identifierTag}
      <span>${deviceLabel}</span>
      <span>·</span>
      <span>${author}</span>
      <span>·</span>
      <span>${when}</span>
    </div>
  </div>
  <div class="myio-annotations-item-side">
    <span
      class="myio-annotations-importance-badge"
      style="background:${IMPORTANCE_COLORS[importance as 1|2|3|4|5]}"
      title="Importância: ${IMPORTANCE_LABELS[importance as 1|2|3|4|5]}"
    >${IMPORTANCE_LABELS[importance as 1|2|3|4|5]}</span>
    ${overdueTag}
  </div>
</button>
`.trim();
}
