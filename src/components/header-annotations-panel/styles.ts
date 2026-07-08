/**
 * RFC-0203 M4 — Styles for HeaderAnnotationsPanel.
 *
 * Injected once per page via `injectStylesOnce()`. Variables use the amethyst
 * palette (#6c5ce7) established for the Annotations feature.
 */

export const HEADER_ANNOTATIONS_STYLES_ID = 'myio-annotations-panel-styles';

export const HEADER_ANNOTATIONS_STYLES = `
/* Container — anchored under the HEADER button by default */
.myio-annotations-panel {
  position: fixed;
  z-index: 99998;
  width: min(720px, 90vw);
  max-height: min(80vh, 720px);
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1e293b;
  overflow: hidden;
  animation: myio-anno-pop 0.16s ease-out;
}
@keyframes myio-anno-pop {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.myio-annotations-panel.maximized {
  width: 90vw !important;
  height: 90vh !important;
  max-height: 90vh !important;
  top: 5vh !important;
  left: 5vw !important;
}
.myio-annotations-panel.is-dragging {
  cursor: grabbing;
  user-select: none;
}
.myio-annotations-panel.is-dragging * {
  pointer-events: none;
}
.myio-annotations-panel-header[data-drag-handle] {
  cursor: grab;
}
.myio-annotations-panel-header[data-drag-handle]:active {
  cursor: grabbing;
}
.myio-annotations-panel-action.is-active {
  background: rgba(108, 92, 231, 0.18);
  color: #4c3aac;
}

/* Virtual list bookkeeping styles (RFC-0203 M6) */
.myio-vlist-container { /* container is .myio-annotations-body in practice */ }
.myio-vlist-viewport { will-change: transform; }

/* Header — subtle line in the InfoTooltip/EnergySummaryTooltip pattern.
   Soft amethyst gradient + thin border, compact padding. */
.myio-annotations-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #c4b5fd;
  background: linear-gradient(90deg, #faf9ff 0%, #ede9fe 100%);
  border-radius: 12px 12px 0 0;
  cursor: move;
  user-select: none;
}
.myio-annotations-icon {
  font-size: 16px;
  flex-shrink: 0;
}
.myio-annotations-panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #4c3aac;
  letter-spacing: 0.2px;
  flex-shrink: 0;
}
.myio-annotations-panel-meta {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
}
.myio-annotations-panel-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
/* Header action buttons — mirror src/utils/tooltips/InfoTooltip.ts pattern
   (24×24 button with white-ish bg, SVG 14×14, slate hover, emerald
   pinned state). RFC-0203 M7 follow-up: alignment with InfoTooltip. */
.myio-annotations-panel-action {
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
  color: #64748b;
  padding: 0;
}
.myio-annotations-panel-action:hover {
  background: rgba(255, 255, 255, 0.95);
  color: #1e293b;
}
.myio-annotations-panel-action:focus-visible {
  outline: 2px solid #6c5ce7;
  outline-offset: 2px;
}
/* Pinned state — emerald-700, matches InfoTooltip */
.myio-annotations-panel-action.pinned {
  background: #047857;
  color: #ffffff;
}
.myio-annotations-panel-action.pinned:hover {
  background: #065f46;
}
.myio-annotations-panel-action svg {
  width: 14px;
  height: 14px;
  display: block;
}

/* Tabs */
.myio-annotations-tabs {
  display: flex;
  gap: 0;
  padding: 0 8px;
  border-bottom: 1px solid #e2e8f0;
  background: #fafbff;
  flex-shrink: 0;
}
.myio-annotations-tab {
  flex: 1;
  padding: 10px 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.myio-annotations-tab:hover {
  color: #4c3aac;
}
.myio-annotations-tab[aria-selected="true"] {
  color: #4c3aac;
  border-bottom-color: #6c5ce7;
}
.myio-annotations-tab:focus-visible {
  outline: 2px solid #6c5ce7;
  outline-offset: -2px;
  border-radius: 4px;
}

/* Toolbar (RFC-0203 M5) */
.myio-annotations-toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px 0 12px;
  background: #fff;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}
.myio-annotations-toolbar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.myio-annotations-toolbar-meta {
  font-size: 11px;
  color: #64748b;
  padding-bottom: 6px;
}
.myio-annotations-toolbar-count { font-weight: 600; }
.myio-annotations-toolbar-spacer { flex: 1; }
.myio-annotations-toolbar-mini {
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 2px 8px;
  margin-left: 4px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.myio-annotations-toolbar-mini:hover {
  background: rgba(108, 92, 231, 0.08);
  color: #4c3aac;
  border-color: rgba(108, 92, 231, 0.3);
}

.myio-annotations-toolbar-search {
  flex: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
}
.myio-annotations-toolbar-search:focus-within {
  border-color: #6c5ce7;
  box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.15);
}
.myio-annotations-toolbar-search input {
  flex: 1;
  border: none;
  outline: none;
  font: inherit;
  font-size: 13px;
  color: #1e293b;
  background: transparent;
}
.myio-annotations-search-icon { font-size: 13px; color: #94a3b8; }

.myio-annotations-toolbar-sort {
  height: 32px;
  padding: 0 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  color: #1e293b;
  cursor: pointer;
}
.myio-annotations-toolbar-sort:focus-visible {
  border-color: #6c5ce7;
  outline: 2px solid rgba(108, 92, 231, 0.3);
  outline-offset: 1px;
}

.myio-annotations-toolbar-filter-btn {
  height: 32px;
  padding: 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: #4c3aac;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.myio-annotations-toolbar-filter-btn:hover {
  background: rgba(108, 92, 231, 0.06);
  border-color: rgba(108, 92, 231, 0.35);
}
.myio-annotations-toolbar-filter-btn[aria-expanded="true"] {
  background: rgba(108, 92, 231, 0.12);
  border-color: #6c5ce7;
}

/* Filter dropdown panel */
.myio-annotations-filters {
  padding: 8px 0 12px 0;
  border-top: 1px dashed #e2e8f0;
  margin-top: 6px;
}
.myio-annotations-filter-section { margin-bottom: 8px; }
.myio-annotations-filter-section-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}
.myio-annotations-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.myio-annotations-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #f8fafc;
  font-size: 12px;
  color: #334155;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s;
}
.myio-annotations-filter-chip:hover {
  border-color: rgba(108, 92, 231, 0.4);
}
.myio-annotations-filter-chip input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.myio-annotations-filter-chip.is-on {
  background: rgba(108, 92, 231, 0.12);
  border-color: #6c5ce7;
  color: #4c3aac;
  font-weight: 600;
}
.myio-annotations-filter-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}

/* Search highlight */
.myio-annotations-item mark {
  background: rgba(245, 158, 11, 0.35);
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
}

/* Body */
.myio-annotations-body {
  flex: 1;
  overflow: auto;
  padding: 8px 12px 12px 12px;
  background: #fff;
}

/* Group */
.myio-annotations-group {
  margin-top: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.myio-annotations-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}
.myio-annotations-group-header:hover {
  background: #f1f5f9;
}
.myio-annotations-group-header:focus-visible {
  outline: 2px solid #6c5ce7;
  outline-offset: -2px;
}
.myio-annotations-group-chevron {
  display: inline-block;
  width: 10px;
  font-size: 10px;
  color: #94a3b8;
  transition: transform 0.15s ease;
}
.myio-annotations-group.is-collapsed .myio-annotations-group-header {
  border-bottom-color: transparent;
}
.myio-annotations-group-icon { font-size: 14px; }
.myio-annotations-group-label { flex: 1; }
.myio-annotations-group-count {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  padding: 2px 8px;
  background: rgba(108, 92, 231, 0.1);
  border-radius: 10px;
}
.myio-annotations-group--no-id .myio-annotations-group-header {
  background: #fef3c7;
  color: #92400e;
  border-bottom-color: #fde68a;
}

/* Item — rendered as <button>, so must reset UA defaults
   (RFC-0203 M7 follow-up: black border + non-100% width came from
   browser default button styling). */
.myio-annotations-item {
  display: grid;
  grid-template-columns: 22px 1fr auto;
  gap: 10px;
  padding: 10px 12px;
  width: 100%;
  border: none;
  border-bottom: 1px solid #f1f5f9;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
}
.myio-annotations-item:last-child { border-bottom: none; }
.myio-annotations-item:hover { background: rgba(108, 92, 231, 0.05); }
.myio-annotations-item:focus-visible {
  outline: 2px solid #6c5ce7;
  outline-offset: -2px;
}

.myio-annotations-item-icon {
  font-size: 16px;
  line-height: 22px;
  text-align: center;
}
.myio-annotations-item-body { min-width: 0; }
.myio-annotations-item-text {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  margin: 0 0 4px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.myio-annotations-item-meta {
  font-size: 11px;
  color: #64748b;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
}
.myio-annotations-item-device {
  font-weight: 600;
  color: #4c3aac;
}

.myio-annotations-item-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
/* Importance badge — label + color come from inline style (RFC-0104
   canonical colors). Padding leaves room for "Muito Baixa"/"Muito Alta". */
.myio-annotations-importance-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  line-height: 1.3;
  white-space: nowrap;
}

.myio-annotations-overdue {
  font-size: 10px;
  font-weight: 700;
  color: #dc2626;
  text-transform: uppercase;
}

/* Empty state */
.myio-annotations-empty {
  padding: 32px 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.myio-annotations-empty-icon {
  font-size: 28px;
  margin-bottom: 8px;
  opacity: 0.5;
}

/* Loading state */
.myio-annotations-loading {
  padding: 24px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

/* Footer — modeled on the TELEMETRY_INFO climatização tooltip:
   icon-style buttons left + right, subtle meta in the middle. */
.myio-annotations-panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid #e2e8f0;
  background: #fafbff;
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}
.myio-annotations-panel-footer-tools {
  display: flex;
  align-items: center;
  gap: 4px;
}
.myio-annotations-panel-footer-meta {
  flex: 1;
  text-align: center;
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.myio-annotations-panel-footer-iconbtn {
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  color: #4c3aac;
  background: rgba(108, 92, 231, 0.06);
  border: 1px solid rgba(108, 92, 231, 0.2);
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.myio-annotations-panel-footer-iconbtn:hover {
  background: rgba(108, 92, 231, 0.14);
  border-color: rgba(108, 92, 231, 0.5);
  color: #3b2e8a;
}
.myio-annotations-panel-footer-iconbtn:focus-visible {
  outline: 2px solid #6c5ce7;
  outline-offset: 1px;
}
.myio-annotations-panel-footer-iconbtn svg {
  display: block;
}
`;

/**
 * Injects the panel stylesheet once per document. Idempotent.
 */
export function injectStylesOnce(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(HEADER_ANNOTATIONS_STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = HEADER_ANNOTATIONS_STYLES_ID;
  style.textContent = HEADER_ANNOTATIONS_STYLES;
  document.head.appendChild(style);
}
