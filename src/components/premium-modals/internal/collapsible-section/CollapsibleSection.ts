// premium-modals/internal/collapsible-section/CollapsibleSection.ts
// RFC-0223: shared collapsible header-row renderer for GROUP and DEVICE
// sections in AllReportModal's sectioned (1d/1h) grid. A pure string builder —
// the whole grid is one innerHTML rebuild per render pass (matching
// AllReportModal's existing renderTable/renderGroupedRows convention).
// Collapse/expand AFTER the initial paint is a pure DOM show/hide
// (AllReportModal.toggleSection), never a re-invocation of this renderer.

export type CollapsibleSectionLevel = 0 | 1 | 2;

export interface CollapsibleSectionHeaderOptions {
  /** collapsedSections key this header controls, e.g. 'grp:Lojas' | 'dev:123'. */
  sectionKey: string;
  /** Ancestor keys (own key excluded) — drives this header's OWN visibility (hidden if any ancestor is collapsed). */
  ancestorKeys: string[];
  level: CollapsibleSectionLevel;
  title: string;
  /** e.g. "16 dias" — omitted for group headers. */
  meta?: string;
  /** e.g. "1.204,53 kWh" / "Média 22,4 °C". */
  totalLabel: string;
  collapsed: boolean;
  colSpan: number;
  /** AC19: this device's series fetch failed — render a distinct warning badge. */
  incomplete?: boolean;
}

export interface CollapsibleSectionLeafRowOptions {
  /** Ancestor keys (all sections this row is nested under) — hidden if ANY is collapsed. */
  ancestorKeys: string[];
  level: CollapsibleSectionLevel;
  /** Pre-built `<td>...</td>` markup — caller owns escaping/formatting of cell content. */
  cells: string[];
}

export const escapeHtml = (s: string): string =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

export function renderCollapsibleSectionHeader(opts: CollapsibleSectionHeaderOptions): string {
  const caret = opts.collapsed ? '▶' : '▼';
  const ancestors = escapeHtml(opts.ancestorKeys.join(' '));
  return `
    <tr class="rp-section-header rp-section-header--level-${opts.level}" data-section-toggle="${escapeHtml(opts.sectionKey)}" data-ancestors="${ancestors}" role="button" tabindex="0" aria-expanded="${!opts.collapsed}">
      <td colspan="${opts.colSpan}">
        <span class="rp-section-caret" aria-hidden="true">${caret}</span>
        <span class="rp-section-title">${escapeHtml(opts.title)}</span>
        ${opts.meta ? `<span class="rp-section-meta">${escapeHtml(opts.meta)}</span>` : ''}
        ${opts.incomplete ? `<span class="rp-section-badge">dados incompletos</span>` : ''}
        <span class="rp-section-total">${escapeHtml(opts.totalLabel)}</span>
      </td>
    </tr>`;
}

export function renderCollapsibleLeafRow(opts: CollapsibleSectionLeafRowOptions): string {
  const ancestors = escapeHtml(opts.ancestorKeys.join(' '));
  return `
    <tr class="rp-section-row rp-section-row--level-${opts.level}" data-ancestors="${ancestors}">
      ${opts.cells.join('')}
    </tr>`;
}

let stylesInjected = false;

/** Idempotent style injection — same pattern as granularity-selector/styles.ts. */
export function injectCollapsibleSectionStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return;
  if (document.getElementById('myio-collapsible-section-styles')) {
    stylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'myio-collapsible-section-styles';
  style.textContent = `
.rp-section-header {
  cursor: pointer;
  user-select: none;
}
.rp-section-header td {
  background: color-mix(in srgb, var(--myio-brand-700, #4A148C) 6%, var(--myio-bg, #f3f4f6));
  font-weight: 700;
  padding: 8px 12px !important;
  border-top: 2px solid color-mix(in srgb, var(--myio-brand-700, #4A148C) 25%, var(--myio-border, #e5e7eb));
}
.rp-section-header--level-0 td {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--myio-text-muted, #6b7280);
}
.rp-section-header--level-1 td {
  font-size: 13px;
  color: var(--myio-text, #1f2937);
  padding-left: 28px !important;
}
.rp-section-header--level-2 td {
  font-size: 12px;
  padding-left: 44px !important;
}
.rp-section-header:hover td {
  background: color-mix(in srgb, var(--myio-brand-700, #4A148C) 12%, var(--myio-bg, #f3f4f6));
}
.rp-section-header:focus-visible {
  outline: 2px solid var(--myio-brand-700, #4A148C);
  outline-offset: -2px;
}
.rp-section-caret {
  display: inline-block;
  width: 14px;
  margin-right: 6px;
  color: var(--myio-brand-700, #4A148C);
}
.rp-section-meta {
  font-size: 11px;
  font-weight: 500;
  color: var(--myio-text-muted, #6b7280);
  margin-left: 8px;
}
.rp-section-total {
  float: right;
  font-size: 12px;
  font-weight: 700;
  color: color-mix(in srgb, var(--myio-brand-700, #4A148C) 80%, var(--myio-primary, #1565c0));
}
/* Semantic status color (not brand-themed on purpose — matches the existing
   #error-container convention of a fixed, always-legible warning tone). */
.rp-section-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  background: #fef3c7;
  color: #b45309;
}
.rp-section-row--level-1 td:first-child,
.rp-section-row--level-2 td:first-child {
  position: relative;
}
.rp-section-row--level-1 td:first-child {
  padding-left: 32px !important;
}
.rp-section-row--level-2 td:first-child {
  padding-left: 48px !important;
}
.rp-section-row--level-1 td:first-child::before,
.rp-section-row--level-2 td:first-child::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 0;
  bottom: 0;
  border-left: 2px solid color-mix(in srgb, var(--myio-brand-700, #4A148C) 20%, var(--myio-border, #e5e7eb));
}
.rp-section-row--level-2 td:first-child::before {
  left: 32px;
}
`;
  document.head.appendChild(style);
  stylesInjected = true;
}
