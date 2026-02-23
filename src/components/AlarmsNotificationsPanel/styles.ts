/**
 * RFC-0152 Phase 4: Alarms Notifications Panel Styles
 * CSS-in-JS styles with theme support
 */

export const ALARMS_NOTIFICATIONS_PANEL_STYLES = `
/* =====================================================================
   CSS Variables - Light Theme (default)
   ===================================================================== */
.myio-alarms-panel {
  --alarms-bg: #ffffff;
  --alarms-bg-secondary: #f8fafc;
  --alarms-text: #1e293b;
  --alarms-text-muted: #64748b;
  --alarms-text-light: #94a3b8;
  --alarms-border: #e2e8f0;
  --alarms-border-light: #f1f5f9;
  --alarms-card-bg: #ffffff;
  --alarms-card-hover: #f8fafc;
  --alarms-input-bg: #f8fafc;
  --alarms-input-border: #e2e8f0;
  --alarms-primary: #8b5cf6;
  --alarms-primary-light: rgba(139, 92, 246, 0.1);
  --alarms-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --alarms-shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.08);
  --alarms-radius: 8px;
  --alarms-radius-lg: 12px;
}

/* =====================================================================
   Dark Theme
   ===================================================================== */
.myio-alarms-panel[data-theme="dark"] {
  --alarms-bg: #0f172a;
  --alarms-bg-secondary: #1e293b;
  --alarms-text: #f1f5f9;
  --alarms-text-muted: #94a3b8;
  --alarms-text-light: #64748b;
  --alarms-border: #334155;
  --alarms-border-light: #1e293b;
  --alarms-card-bg: #1e293b;
  --alarms-card-hover: #334155;
  --alarms-input-bg: #1e293b;
  --alarms-input-border: #334155;
  --alarms-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  --alarms-shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* =====================================================================
   Severity Colors
   ===================================================================== */
.myio-alarms-panel {
  --severity-critical: #ef4444;
  --severity-critical-bg: rgba(239, 68, 68, 0.1);
  --severity-high: #f97316;
  --severity-high-bg: rgba(249, 115, 22, 0.1);
  --severity-medium: #eab308;
  --severity-medium-bg: rgba(234, 179, 8, 0.1);
  --severity-low: #3b82f6;
  --severity-low-bg: rgba(59, 130, 246, 0.1);
  --severity-info: #6b7280;
  --severity-info-bg: rgba(107, 114, 128, 0.1);
}

/* =====================================================================
   State Colors
   ===================================================================== */
.myio-alarms-panel {
  --state-open: #ef4444;
  --state-ack: #f59e0b;
  --state-snoozed: #8b5cf6;
  --state-escalated: #dc2626;
  --state-closed: #6b7280;
}

/* =====================================================================
   Container
   ===================================================================== */
.myio-alarms-panel {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: var(--alarms-text);
  background: var(--alarms-bg);
  border-radius: var(--alarms-radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* =====================================================================
   Tab Navigation
   ===================================================================== */
.myio-alarms-tabs {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  background: var(--alarms-bg-secondary);
  border-bottom: 1px solid var(--alarms-border);
  flex-shrink: 0;
}

.myio-alarms-tabs .tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--alarms-text-muted);
  background: transparent;
  border: none;
  border-radius: var(--alarms-radius);
  cursor: pointer;
  transition: all 0.2s ease;
}

.myio-alarms-tabs .tab-btn:hover {
  color: var(--alarms-text);
  background: var(--alarms-card-hover);
}

.myio-alarms-tabs .tab-btn.active {
  color: var(--alarms-primary);
  background: var(--alarms-primary-light);
}

.myio-alarms-tabs .tab-btn .tab-icon {
  font-size: 16px;
}

.myio-alarms-tabs .tab-btn .tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--alarms-text-muted);
  background: var(--alarms-border);
  border-radius: 10px;
}

.myio-alarms-tabs .tab-btn.active .tab-count {
  color: var(--alarms-primary);
  background: rgba(139, 92, 246, 0.2);
}

/* Bundle map button — direita da tab bar (margin-left:auto empurra ele + badge) */
.myio-alarms-tabs .alarms-tab-map-btn {
  margin-left: auto;
  flex-shrink: 0;
  align-self: center;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* Alarm count badge — imediatamente à direita do botão, margem direita de 10px */
.myio-alarms-tabs .alarms-tab-count-badge {
  align-self: center;
  flex-shrink: 0;
  margin-right: 15px;
}

/* Quando badge está oculto (display:none), o botão fica como último elemento */
.myio-alarms-tabs .alarms-tab-map-btn:last-child {
  margin-right: 15px;
}

/* =====================================================================
   Tab Content
   ===================================================================== */
.myio-alarms-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
}

.myio-alarms-content .tab-content {
  display: none;
  height: 100%;
  overflow: hidden;
}

.myio-alarms-content .tab-content.active {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* =====================================================================
   List Header — compact inline (filters + bulk actions)
   ===================================================================== */
.alarms-list-header {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  background: var(--alarms-bg-secondary);
  border-bottom: 1px solid var(--alarms-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.alarms-search-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  background: var(--alarms-input-bg);
  border: 1px solid var(--alarms-input-border);
  border-radius: var(--alarms-radius);
  flex: 1;
  min-width: 100px;
  transition: border-color 0.2s;
}

.alarms-search-wrap:focus-within {
  border-color: var(--alarms-primary);
}

.alarms-search-icon {
  color: var(--alarms-text-muted);
  font-size: 11px;
  flex-shrink: 0;
}

.alarms-search-wrap input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--alarms-text);
  font-size: 11px;
  outline: none;
  min-width: 0;
}

.alarms-search-wrap input::placeholder {
  color: var(--alarms-text-light);
}

/* Filter button (opens modal) */
.alarms-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--alarms-text-muted);
  background: var(--alarms-input-bg);
  border: 1px solid var(--alarms-input-border);
  border-radius: var(--alarms-radius);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.alarms-filter-btn:hover {
  border-color: var(--alarms-primary);
  color: var(--alarms-primary);
}

.alarms-filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  background: var(--alarms-primary);
  border-radius: 8px;
}

.alarms-clear-filters {
  flex-shrink: 0;
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--alarms-text-muted);
  background: transparent;
  border: 1px solid var(--alarms-border);
  border-radius: var(--alarms-radius);
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1;
}

.alarms-clear-filters:hover {
  color: var(--alarms-text);
  border-color: var(--alarms-text-muted);
  background: var(--alarms-card-hover);
}

/* Bulk actions button */
.alarms-bulk-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--alarms-primary);
  background: var(--alarms-primary-light);
  border: 1px solid var(--alarms-primary);
  border-radius: var(--alarms-radius);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.alarms-bulk-btn:hover:not(:disabled) {
  background: var(--alarms-primary);
  color: #fff;
}

.alarms-bulk-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.alarms-bulk-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  font-size: 9px;
  font-weight: 700;
  color: var(--alarms-primary);
  background: rgba(139, 92, 246, 0.2);
  border-radius: 8px;
}

.alarms-bulk-btn:hover:not(:disabled) .alarms-bulk-count {
  color: #fff;
  background: rgba(255, 255, 255, 0.25);
}

/* =====================================================================
   Advanced Filter Modal (afm-*)
   ===================================================================== */
.afm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.afm-modal {
  background: var(--alarms-card-bg);
  border: 1px solid var(--alarms-border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
  width: 640px;
  max-width: calc(100% - 16px);
  max-height: calc(100% - 16px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.afm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--alarms-border);
  flex-shrink: 0;
}

.afm-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--alarms-text);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.afm-close {
  background: transparent;
  border: none;
  color: var(--alarms-text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
  transition: background 0.15s;
}

.afm-close:hover { background: var(--alarms-card-hover); }

.afm-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.afm-section-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--alarms-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.afm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.afm-chips--scroll {
  max-height: 160px;
  overflow-y: auto;
  padding-right: 2px;
}

.afm-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 500;
  color: var(--alarms-text-muted);
  background: var(--alarms-input-bg);
  border: 1px solid var(--alarms-input-border);
  border-radius: 12px;
  cursor: pointer;
  user-select: none;
  transition: all 0.12s;
  white-space: nowrap;
}

.afm-chip:hover {
  border-color: var(--alarms-primary);
  color: var(--alarms-primary);
}

.afm-chip.is-checked {
  background: var(--alarms-primary-light);
  border-color: var(--alarms-primary);
  color: var(--alarms-primary);
  font-weight: 600;
}

.afm-empty {
  font-size: 11px;
  color: var(--alarms-text-light);
  font-style: italic;
}

.afm-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--alarms-border);
  flex-shrink: 0;
}

.afm-btn-clear {
  background: transparent;
  border: 1px solid var(--alarms-border);
  border-radius: var(--alarms-radius);
  color: var(--alarms-text-muted);
  font-size: 11px;
  font-weight: 600;
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.afm-btn-clear:hover {
  border-color: var(--alarms-text-muted);
  color: var(--alarms-text);
}

.afm-btn-apply {
  background: var(--alarms-primary);
  border: 1px solid var(--alarms-primary);
  border-radius: var(--alarms-radius);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 5px 16px;
  cursor: pointer;
  transition: opacity 0.15s;
}

.afm-btn-apply:hover { opacity: 0.85; }

/* =====================================================================
   Alarms Grid (List Tab)
   ===================================================================== */
.alarms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px 36px;
  padding: 12px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  align-content: start;
  /* align-items: stretch (default) — all cards in a row share the same height,
     which gives clean visual row boundaries and prevents the "row-bleed" effect */
}

@media (max-width: 1400px) {
  .alarms-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 14px 28px;
  }
}

@media (max-width: 768px) {
  .alarms-grid {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 8px;
  }
}

/* =====================================================================
   Alarm Card
   ===================================================================== */
.alarm-card {
  display: flex;
  flex-direction: column;
  background: var(--alarms-card-bg);
  border: 1px solid var(--alarms-border);
  border-left: 4px solid var(--alarms-border);
  border-radius: var(--alarms-radius);
  box-shadow: var(--alarms-shadow);
  overflow: hidden;
  transition: all 0.2s ease;
  cursor: pointer;
  min-height: 144px;
  position: relative;
}

.alarm-card:hover {
  background: var(--alarms-card-hover);
}

/* Severity border colors */
.alarm-card[data-severity="CRITICAL"] {
  border-left-color: var(--severity-critical);
}
.alarm-card[data-severity="HIGH"] {
  border-left-color: var(--severity-high);
}
.alarm-card[data-severity="MEDIUM"] {
  border-left-color: var(--severity-medium);
}
.alarm-card[data-severity="LOW"] {
  border-left-color: var(--severity-low);
}
.alarm-card[data-severity="INFO"] {
  border-left-color: var(--severity-info);
}

/* Critical + Open pulse animation */
.alarm-card[data-severity="CRITICAL"][data-state="OPEN"] {
  animation: alarmPulse 2s infinite;
}

@keyframes alarmPulse {
  0%, 100% {
    box-shadow: var(--alarms-shadow), 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: var(--alarms-shadow), 0 0 0 4px rgba(239, 68, 68, 0.1);
  }
}

/* Card Header */
.alarm-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--alarms-border-light);
  flex-shrink: 0;
}

.alarm-card-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.alarm-severity-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  line-height: 1;
  background: none;
  border: none;
  padding: 0;
  cursor: default;
}

.alarm-state-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 500;
  border-radius: 3px;
  background: var(--alarms-bg-secondary);
  white-space: nowrap;
}

.alarm-state-badge[data-state="OPEN"] { color: var(--state-open); }
.alarm-state-badge[data-state="ACK"] { color: var(--state-ack); }
.alarm-state-badge[data-state="SNOOZED"] { color: var(--state-snoozed); }
.alarm-state-badge[data-state="ESCALATED"] { color: var(--state-escalated); }
.alarm-state-badge[data-state="CLOSED"] { color: var(--state-closed); }

/* Card checkbox (bulk selection) */
.alarm-card-checkbox-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  cursor: pointer;
  padding: 2px;
}

.alarm-card-select {
  width: 13px;
  height: 13px;
  cursor: pointer;
  accent-color: var(--alarms-primary);
  flex-shrink: 0;
}

/* Selected state */
.alarm-card--selected {
  border-left-width: 4px;
  background: var(--alarms-primary-light) !important;
  border-color: var(--alarms-primary) !important;
}

/* Card Body */
.alarm-card-body {
  padding: 5px 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 4px;
}

.alarm-card-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--alarms-text);
  margin: 0;
  line-height: 1.3;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.alarm-card-id {
  font-size: 9px;
  color: var(--alarms-text-muted);
  font-family: 'SF Mono', Monaco, monospace;
  margin-bottom: 3px;
  flex-shrink: 0;
}

/* Customer Section */
.alarm-card-customer {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  margin: 3px 0;
  padding: 3px 5px;
  background: var(--alarms-bg-secondary);
  border-radius: var(--alarms-radius);
}

.alarm-customer-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  min-width: 18px;
  font-size: 9px;
  font-weight: 600;
  color: var(--alarms-primary);
  background: var(--alarms-primary-light);
  border-radius: 50%;
  flex-shrink: 0;
}

.alarm-customer-details {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.alarm-customer-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--alarms-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alarm-customer-source {
  font-size: 9px;
  color: var(--alarms-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Shopping Chip Badge */
.alarm-shopping-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 600;
  color: var(--alarms-text);
  background: var(--alarms-bg-secondary);
  border: 1px solid var(--alarms-border);
  border-radius: 20px;
  margin: 2px 0;
  flex-shrink: 0;
}

.alarm-shopping-chip .chip-icon {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
}

.alarm-shopping-chip .chip-text {
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Card Stats Row */
.alarm-card-stats {
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
  gap: 3px;
  padding: 3px 2px;
  margin: 2px 0;
  background: var(--alarms-bg-secondary);
  border-radius: var(--alarms-radius);
  width: 100%;
  flex-shrink: 0;
}

.alarm-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  flex: 1;
  text-align: center;
}

.alarm-stat-value {
  font-size: 10px;
  font-weight: 700;
  color: var(--alarms-text);
}

.alarm-stat-value--large {
  font-size: 12px;
  font-weight: 800;
}

.alarm-stat-label {
  font-size: 8px;
  font-weight: 500;
  text-transform: capitalize;
  color: var(--alarms-text-muted);
}

/* Card Tags */
.alarm-card-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin-top: 4px;
  width: 100%;
}

.alarm-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 5px;
  font-size: 9px;
  color: var(--alarms-text-muted);
  background: var(--alarms-bg-secondary);
  border-radius: 3px;
}

.alarm-tag-overflow {
  font-weight: 500;
  color: var(--alarms-primary);
}

/* Card Footer */
.alarm-card-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px 6px;
  border-top: 1px solid var(--alarms-border-light);
  background: var(--alarms-bg-secondary);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.alarm-card-footer .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, transform 0.1s ease;
  user-select: none;
}

.alarm-card-footer .btn:hover {
  filter: brightness(1.12);
  transform: scale(1.08);
}

.alarm-card-footer .btn:active {
  filter: brightness(0.95);
  transform: scale(1);
}

.alarm-card-footer .btn-ack {
  color: #fff;
  background: #1d4ed8;
}

.alarm-card-footer .btn-ack:hover {
  background: #2563eb;
}

.alarm-card-footer .btn-ack:active {
  background: #1e40af;
}

.alarm-card-footer .btn-details {
  color: var(--alarms-text);
  background: var(--alarms-border);
}

.alarm-card-footer .btn-details:hover {
  background: var(--alarms-text-light);
}

.alarm-card-footer .btn-details:active {
  background: var(--alarms-border);
}

.alarm-card-footer .btn-snooze {
  color: #fff;
  background: var(--state-snoozed);
}

.alarm-card-footer .btn-snooze:hover {
  background: #7c3aed;
}

.alarm-card-footer .btn-snooze:active {
  background: #6d28d9;
}

.alarm-card-footer .btn-escalate {
  color: #fff;
  background: var(--state-escalated);
}

.alarm-card-footer .btn-escalate:hover {
  background: #ef4444;
}

.alarm-card-footer .btn-escalate:active {
  background: #b91c1c;
}

.alarm-card-footer .btn-more {
  flex: 0;
  max-width: 26px;
  min-width: 26px;
  padding: 5px;
  color: var(--alarms-text-muted);
  background: var(--alarms-border);
  border-radius: var(--alarms-radius);
}

/* =====================================================================
   Annotation type badges — same visual pattern as TELEMETRY widget
   Positioned absolute on the card (right side, vertically centered)
   ===================================================================== */
.alarm-card .annotation-type-badges {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 10;
}

.alarm-card .annotation-type-badge {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.alarm-card .annotation-type-badge:hover {
  transform: scale(1.15);
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}

.alarm-card .annotation-type-badge__count {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  background: #1a1a2e;
  color: white;
  border-radius: 7px;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* =====================================================================
   Responsive Card Adjustments
   ===================================================================== */
@media (max-width: 480px) {
  .alarm-card-header {
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
  }

  .alarm-card-badges {
    order: 1;
  }

  .alarm-card-body {
    padding: 12px;
    gap: 8px;
  }

  .alarm-card-title {
    font-size: 11px;
  }

  .alarm-card-customer {
    gap: 8px;
    padding: 6px 10px;
  }

  .alarm-customer-avatar {
    width: 30px;
    height: 30px;
    min-width: 30px;
    font-size: 11px;
  }

  .alarm-customer-name {
    font-size: 12px;
  }

  .alarm-customer-source {
    font-size: 10px;
  }

  .alarm-shopping-chip {
    padding: 6px 12px;
    font-size: 12px;
  }

  .alarm-shopping-chip .chip-text {
    max-width: 150px;
  }

  .alarm-card-stats {
    gap: 10px;
    padding: 12px 8px;
  }

  .alarm-stat-value {
    font-size: 14px;
  }

  .alarm-stat-value--large {
    font-size: 18px;
  }

  .alarm-stat-label {
    font-size: 9px;
  }

  .alarm-card-tags {
    gap: 4px;
  }

  .alarm-tag {
    font-size: 10px;
    padding: 2px 6px;
  }

  .alarm-card-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 10px 12px;
  }

  .alarm-card-footer .btn {
    max-width: none;
    padding: 8px 12px;
    font-size: 12px;
  }

  .alarm-card-footer .btn-more {
    flex: 0 0 36px;
    min-width: 36px;
    max-width: 36px;
  }

  /* Make last button span full width if odd count (1 or 3 buttons) */
  .alarm-card-footer .btn:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
}

/* Large screens */
@media (min-width: 1600px) {
  .alarms-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px 44px;
    max-width: 100%;
  }
}

/* =====================================================================
   Dashboard Tab
   ===================================================================== */
.alarms-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
  overflow-y: auto;
}

/* KPI Cards Row */
.alarms-kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.alarms-kpi-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  background: var(--alarms-card-bg);
  border: 1px solid var(--alarms-border);
  border-radius: var(--alarms-radius-lg);
  box-shadow: var(--alarms-shadow);
}

.alarms-kpi-card.critical {
  border-left: 4px solid var(--severity-critical);
}

.alarms-kpi-card.warning {
  border-left: 4px solid var(--severity-high);
}

.alarms-kpi-card.info {
  border-left: 4px solid var(--alarms-primary);
}

.alarms-kpi-label {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--alarms-text-muted);
}

.alarms-kpi-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--alarms-text);
  line-height: 1;
}

.alarms-kpi-card.critical .alarms-kpi-value {
  color: var(--severity-critical);
}

.alarms-kpi-card.warning .alarms-kpi-value {
  color: var(--severity-high);
}

/* Charts Row */
.alarms-charts-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 16px;
}

@media (max-width: 1200px) {
  .alarms-charts-row {
    grid-template-columns: 1fr;
  }
}

.alarms-chart-card {
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--alarms-card-bg);
  border: 1px solid var(--alarms-border);
  border-radius: var(--alarms-radius-lg);
  box-shadow: var(--alarms-shadow);
}

.alarms-chart-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--alarms-text);
  margin-bottom: 16px;
}

.alarms-chart-area {
  flex: 1;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* SVG Charts */
.alarms-trend-chart {
  width: 100%;
  height: 100%;
}

.alarms-trend-chart .chart-line {
  fill: none;
  stroke: var(--alarms-primary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.alarms-trend-chart .chart-area {
  fill: url(#trendGradient);
  opacity: 0.3;
}

.alarms-trend-chart .chart-point {
  fill: var(--alarms-primary);
}

.alarms-trend-chart .chart-grid {
  stroke: var(--alarms-border);
  stroke-dasharray: 2, 4;
}

.alarms-trend-chart .chart-label {
  font-size: 10px;
  fill: var(--alarms-text-muted);
}

.alarms-donut-chart {
  width: 100%;
  height: 100%;
}

.alarms-donut-chart .donut-segment {
  fill: none;
  stroke-width: 24;
  stroke-linecap: round;
}

.alarms-donut-chart .donut-center-text {
  font-size: 24px;
  font-weight: 700;
  fill: var(--alarms-text);
  text-anchor: middle;
  dominant-baseline: middle;
}

.alarms-donut-chart .donut-center-label {
  font-size: 11px;
  fill: var(--alarms-text-muted);
  text-anchor: middle;
}

.alarms-bar-chart {
  width: 100%;
}

.alarms-bar-chart .bar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.alarms-bar-chart .bar-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--alarms-text);
  min-width: 80px;
}

.alarms-bar-chart .bar-track {
  flex: 1;
  height: 24px;
  background: var(--alarms-bg-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.alarms-bar-chart .bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.alarms-bar-chart .bar-fill[data-severity="CRITICAL"] { background: var(--severity-critical); }
.alarms-bar-chart .bar-fill[data-severity="HIGH"] { background: var(--severity-high); }
.alarms-bar-chart .bar-fill[data-severity="MEDIUM"] { background: var(--severity-medium); }
.alarms-bar-chart .bar-fill[data-severity="LOW"] { background: var(--severity-low); }
.alarms-bar-chart .bar-fill[data-severity="INFO"] { background: var(--severity-info); }

.alarms-bar-chart .bar-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--alarms-text);
  min-width: 40px;
  text-align: right;
}

/* Chart Legend */
.alarms-chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--alarms-border-light);
}

.alarms-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--alarms-text-muted);
}

.alarms-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

/* =====================================================================
   Empty State
   ===================================================================== */
.alarms-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 24px;
  text-align: center;
  flex: 1;
}

.alarms-empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.alarms-empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--alarms-text);
  margin: 0;
}

.alarms-empty-text {
  font-size: 14px;
  color: var(--alarms-text-muted);
  margin: 0;
  max-width: 400px;
}

/* =====================================================================
   Loading Overlay
   ===================================================================== */
.alarms-loading-overlay {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--alarms-bg);
  opacity: 0.9;
  z-index: 100;
}

.alarms-loading-overlay.active {
  display: flex;
}

.alarms-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--alarms-border);
  border-top-color: var(--alarms-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.alarms-loading-text {
  font-size: 14px;
  color: var(--alarms-text-muted);
}

/* =====================================================================
   Scrollbar Styling
   ===================================================================== */
.myio-alarms-panel ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.myio-alarms-panel ::-webkit-scrollbar-track {
  background: var(--alarms-bg-secondary);
  border-radius: 4px;
}

.myio-alarms-panel ::-webkit-scrollbar-thumb {
  background: var(--alarms-border);
  border-radius: 4px;
}

.myio-alarms-panel ::-webkit-scrollbar-thumb:hover {
  background: var(--alarms-text-light);
}

/* =====================================================================
   Alarm Action Modal (Acknowledge / Snooze / Escalate)
   ===================================================================== */
.alarm-action-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100002;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.alarm-action-modal-overlay--visible {
  opacity: 1;
}

.alarm-action-modal {
  background: #fff;
  border-radius: 16px;
  width: 92%;
  max-width: 520px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  transform: translateY(-16px) scale(0.96);
  transition: transform 0.2s ease;
  overflow: hidden;
}

.alarm-action-modal-overlay--visible .alarm-action-modal {
  transform: translateY(0) scale(1);
}

.alarm-action-modal__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.alarm-action-modal__icon {
  font-size: 20px;
  flex-shrink: 0;
}

.alarm-action-modal__title {
  font-size: 15px;
  font-weight: 600;
}

.alarm-action-modal__body {
  padding: 18px 20px 12px;
}

.alarm-action-modal__label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.alarm-action-modal__label--required::after {
  content: ' *';
  color: #dc2626;
}

.alarm-action-modal__textarea {
  width: 100%;
  min-height: 90px;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
  color: #1f2937;
  box-sizing: border-box;
}

.alarm-action-modal__textarea:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}

.alarm-action-modal__select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  color: #1f2937;
  background: #fff;
  cursor: pointer;
  box-sizing: border-box;
}

.alarm-action-modal__select:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}

.alarm-action-modal__char-count {
  font-size: 10px;
  color: #9ca3af;
  text-align: right;
  margin-top: 4px;
}

.alarm-action-modal__char-count--warning { color: #f59e0b; }
.alarm-action-modal__char-count--error   { color: #dc2626; }

.alarm-action-modal__footer {
  padding: 12px 20px 16px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.alarm-action-modal__btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease;
  border: none;
}

.alarm-action-modal__btn:hover { filter: brightness(1.08); }
.alarm-action-modal__btn:active { filter: brightness(0.95); }

.alarm-action-modal__btn--cancel {
  background: #e5e7eb;
  color: #4b5563;
}

.alarm-action-modal__btn--cancel:hover {
  background: #d1d5db;
  filter: none;
}

.alarm-action-modal__btn--confirm {
  color: #fff;
}

.alarm-action-modal__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: none;
}

/* ---- Alarm summary card inside action modal (aam-*) ---- */
.aam-summary {
  margin: 0 20px 4px;
  padding: 10px 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.aam-summary-header-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #9ca3af;
  margin-bottom: 6px;
}

.aam-summary-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.aam-summary-sev {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.aam-summary-state {
  font-size: 11px;
  font-weight: 600;
}

.aam-summary-title {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
  margin-bottom: 6px;
  word-break: break-word;
}

.aam-summary-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 5px;
}

.aam-summary-source {
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 10px;
}

.aam-summary-dates {
  display: flex;
  gap: 16px;
  font-size: 10px;
  color: #9ca3af;
  margin-bottom: 5px;
}

.aam-summary-dates strong {
  color: #374151;
}

.aam-summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 5px;
}

.aam-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  background: #ede9fe;
  border-radius: 4px;
  font-size: 10px;
  color: #4b5563;
  font-family: 'SF Mono', Monaco, monospace;
}

.aam-tag-key {
  color: #7c3aed;
  font-weight: 700;
}

.aam-tag-more {
  background: #e5e7eb;
  color: #6b7280;
  font-family: inherit;
}

.aam-field-group {
  margin-bottom: 12px;
}

.aam-field-group:last-child {
  margin-bottom: 0;
}

/* =====================================================================
   Alarm Details Modal — Right Drawer (adm-*)
   ===================================================================== */
.adm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.52);
  backdrop-filter: blur(4px);
  z-index: 100004;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  opacity: 0;
  transition: opacity 0.22s ease;
}

.adm-overlay--visible {
  opacity: 1;
}

.adm-drawer {
  width: 880px;
  max-width: 96vw;
  max-height: 92vh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
  transform: translateY(-18px) scale(0.96);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.adm-overlay--visible .adm-drawer {
  transform: translateY(0) scale(1);
}

/* ---- Header ---- */
.adm-header {
  padding: 14px 18px 12px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.adm-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.adm-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
  flex: 1;
  word-break: break-word;
}

.adm-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: #f3f4f6;
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
  color: #6b7280;
  transition: background 0.15s, color 0.15s;
}

.adm-close:hover {
  background: #e5e7eb;
  color: #111827;
}

.adm-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.adm-badge-severity {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.adm-badge-state {
  padding: 3px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.adm-badge-source {
  font-size: 10px;
  color: #6b7280;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  padding: 2px 6px;
  border-radius: 4px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Tabs ---- */
.adm-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.adm-tabs::-webkit-scrollbar { display: none; }

.adm-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 9px 14px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.adm-tab:hover { color: #111827; }

.adm-tab.is-active {
  color: #7c3aed;
  border-bottom-color: #7c3aed;
  font-weight: 700;
}

.adm-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 10px;
  font-weight: 700;
}

/* ---- Body ---- */
.adm-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: #e5e7eb transparent;
}

.adm-body::-webkit-scrollbar { width: 5px; }
.adm-body::-webkit-scrollbar-track { background: transparent; }
.adm-body::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 3px; }

.adm-panel {
  display: none;
  padding: 18px;
}

.adm-panel.is-active {
  display: block;
}

/* ---- KPI grid ---- */
.adm-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.adm-kpi {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
}

.adm-kpi-value {
  font-size: 20px;
  font-weight: 800;
  color: #111827;
  line-height: 1;
}

.adm-kpi-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #9ca3af;
  margin-top: 4px;
}

/* ---- Description ---- */
.adm-description {
  font-size: 13px;
  color: #374151;
  line-height: 1.6;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

/* ---- Section ---- */
.adm-section {
  margin-bottom: 18px;
}

.adm-section-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #9ca3af;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f3f4f6;
}

.adm-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 6px;
  font-size: 12px;
}

.adm-row-label {
  color: #6b7280;
  font-weight: 500;
  min-width: 120px;
  flex-shrink: 0;
}

.adm-row-value {
  color: #111827;
  word-break: break-word;
}

/* ---- Tags ---- */
.adm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.adm-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 7px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 10px;
  color: #374151;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
}

.adm-tag-key {
  color: #7c3aed;
  font-weight: 700;
}

.adm-empty-inline {
  font-size: 12px;
  color: #9ca3af;
  font-style: italic;
}

/* ---- Timeline ---- */
.adm-timeline {
  position: relative;
  padding-left: 28px;
  max-height: 340px;
  overflow-y: auto;
  overflow-x: hidden;
}

.adm-timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 12px;
  bottom: 12px;
  width: 2px;
  background: linear-gradient(to bottom, #ef4444, #e5e7eb 40%, #e5e7eb 60%, #3b82f6);
}

.adm-timeline-item {
  position: relative;
  margin-bottom: 16px;
}

.adm-timeline-dot {
  position: absolute;
  left: -23px;
  top: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #8b5cf6;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px #8b5cf6;
}

.adm-timeline-item.is-last  .adm-timeline-dot { background: #3b82f6; box-shadow: 0 0 0 2px #3b82f6; }
.adm-timeline-item.is-first .adm-timeline-dot { background: #ef4444; box-shadow: 0 0 0 2px #ef4444; }
.adm-timeline-item.is-single .adm-timeline-dot { background: #7c3aed; box-shadow: 0 0 0 2px #7c3aed; }

.adm-timeline-content { }

.adm-timeline-num {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #9ca3af;
  margin-bottom: 2px;
}

.adm-timeline-time {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.adm-timeline-meta {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

.adm-timeline-ellipsis {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 12px;
  padding-left: 2px;
}

.adm-timeline-ellipsis-dots {
  font-size: 16px;
  letter-spacing: 3px;
  color: #d1d5db;
}

.adm-timeline-ellipsis-label {
  font-size: 11px;
  color: #9ca3af;
  font-style: italic;
}

/* ---- Device list ---- */
.adm-devices-list {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 200px;
}

.adm-device-row {
  display: grid;
  grid-template-columns: 24px 22px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 12px;
}

.adm-device-row:last-child { border-bottom: none; }

.adm-device-row:nth-child(odd) { background: #fafafa; }

.adm-device-row-index {
  font-size: 10px;
  font-weight: 700;
  color: #9ca3af;
  text-align: center;
}

.adm-device-icon-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: #ede9fe;
  border-radius: 5px;
  flex-shrink: 0;
}

.adm-device-row-name {
  font-weight: 600;
  color: #111827;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adm-device-row-sub {
  font-size: 10px;
  color: #9ca3af;
  white-space: nowrap;
}

/* ---- Occurrence matrix ---- */
.adm-matrix {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 280px;
  font-size: 11px;
}

.adm-matrix-header {
  display: grid;
  grid-template-columns: 52px 1fr 1fr;
  gap: 0;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 7px 10px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #9ca3af;
  position: sticky;
  top: 0;
  z-index: 1;
}

.adm-matrix-row {
  display: grid;
  grid-template-columns: 52px 1fr 1fr;
  gap: 0;
  padding: 7px 10px;
  border-bottom: 1px solid #f3f4f6;
  align-items: center;
}

.adm-matrix-row:last-child { border-bottom: none; }

.adm-matrix-ellipsis {
  display: block;
  text-align: center;
  color: #9ca3af;
  padding: 6px;
  font-style: italic;
  font-size: 11px;
  background: #fafafa;
  border-bottom: 1px solid #f3f4f6;
  grid-column: 1 / -1;
}

.adm-matrix-n {
  font-weight: 700;
  color: #7c3aed;
}

.adm-matrix-ts {
  color: #374151;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 10px;
}

.adm-matrix-ts sup {
  color: #9ca3af;
  font-size: 9px;
  cursor: help;
}

.adm-device-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: #ede9fe;
  color: #6d28d9;
  border-radius: 4px;
  font-size: 10px;
  font-family: 'SF Mono', Monaco, monospace;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Relatório tab ---- */
.adm-report-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.adm-report-date-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.adm-report-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
}

.adm-report-date-input {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  font-size: 12px;
  color: #111827;
  background: #fff;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}

.adm-report-date-input:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
}

.adm-report-emit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  align-self: flex-start;
}

.adm-report-emit-btn:hover { background: #6d28d9; }
.adm-report-emit-btn:active { background: #5b21b6; }

.adm-report-empty-hint {
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
  padding: 28px 16px;
  font-style: italic;
}

.adm-report-empty-hint strong { color: #7c3aed; font-style: normal; }

.adm-rpt-table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 10px;
}

.adm-rpt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.adm-rpt-th {
  padding: 7px 10px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #9ca3af;
  text-align: left;
  white-space: nowrap;
}

.adm-rpt-th--num { text-align: right; }

.adm-rpt-cell {
  padding: 7px 10px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  vertical-align: middle;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 11px;
}

.adm-rpt-cell--num { text-align: right; font-weight: 700; color: #7c3aed; }

.adm-rpt-cell--dev {
  font-family: inherit;
  font-size: 11px;
  color: #6b7280;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adm-rpt-cell--total {
  font-weight: 700;
  color: #111827;
  background: #ede9fe;
}

.adm-rpt-table tbody tr:nth-child(even) td { background: #fafafa; }
.adm-rpt-table tbody tr:last-child td { border-bottom: none; }

.adm-report-export {
  display: flex;
  gap: 8px;
}

.adm-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  background: #fff;
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.adm-export-btn:hover { background: #f3f4f6; border-color: #9ca3af; }

.adm-export-btn--pdf {
  border-color: #dc2626;
  color: #dc2626;
}

.adm-export-btn--pdf:hover { background: #fef2f2; }

/* ---- Gráfico tab — chart toggle controls ---- */
.adm-chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.adm-chart-ctrl-group {
  display: inline-flex;
  border: 1px solid #e5e7eb;
  border-radius: 7px;
  overflow: hidden;
  background: #f9fafb;
}

.adm-chart-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.adm-chart-btn + .adm-chart-btn {
  border-left: 1px solid #e5e7eb;
}

.adm-chart-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.adm-chart-btn.is-active {
  background: #7c3aed;
  color: #fff;
}

/* Chart wrapper + variants */
.adm-chart-wrapper {
  position: relative;
  min-height: 80px;
}

.adm-chart-variant {
  display: none;
}

.adm-chart-variant.is-active {
  display: block;
}

/* Legend */
.adm-chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 8px;
}

.adm-chart-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #6b7280;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
}

.adm-chart-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Secondary charts side-by-side grid (DOW + HOD) */
.adm-chart-secondary-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0 18px;
  margin-top: 4px;
}

@media (max-width: 520px) {
  .adm-chart-secondary-grid {
    grid-template-columns: 1fr;
  }
}

/* DOW horizontal bar chart */
.adm-dow-chart {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.adm-dow-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.adm-dow-label {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  min-width: 26px;
  text-align: right;
  flex-shrink: 0;
}

.adm-dow-track {
  width: 200px;
  height: 10px;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}

.adm-dow-bar {
  height: 100%;
  background: #7c3aed;
  border-radius: 3px;
}

.adm-dow-val {
  font-size: 10px;
  font-weight: 600;
  color: #374151;
  min-width: 22px;
}

/* HOD column heatmap */
.adm-hod-chart {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 60px;
}

.adm-hod-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  flex: 1;
  min-width: 0;
  cursor: default;
}

.adm-hod-bar {
  width: 100%;
  background: #7c3aed;
  border-radius: 2px 2px 0 0;
  min-height: 4px;
}

.adm-hod-label {
  font-size: 7px;
  color: #9ca3af;
  font-weight: 500;
  line-height: 1;
}

/* ---- Anotações tab (adm-annot-*) ---- */
.adm-annot-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.adm-annot-count {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
}

.adm-annot-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.adm-annot-create-btn:hover { background: #6d28d9; }
.adm-annot-create-btn:active { background: #5b21b6; }

.adm-annot-form-wrap { margin-bottom: 14px; }

.adm-annot-form {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px;
}

.adm-annot-form-title {
  font-size: 12px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 10px;
}

.adm-annot-textarea {
  width: 100%;
  min-height: 70px;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  color: #111827;
  resize: vertical;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s;
}
.adm-annot-textarea:focus {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
}

.adm-annot-char-count {
  font-size: 10px;
  color: #9ca3af;
  text-align: right;
  margin: 3px 0 10px;
}

.adm-annot-form-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.adm-annot-form-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 0;
}
.adm-annot-form-field--narrow { flex: 0 0 auto; }

.adm-annot-form-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #9ca3af;
}

/* Type selector pills */
.adm-annot-type-sel { display: flex; gap: 4px; flex-wrap: wrap; }

.adm-annot-type-opt {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  color: var(--tc);
  background: transparent;
  transition: background 0.15s, color 0.15s;
}
.adm-annot-type-opt:hover { opacity: 0.85; }
.adm-annot-type-opt.is-active {
  background: var(--tc);
  color: #fff;
}

/* Importance star buttons */
.adm-annot-imp-sel { display: flex; gap: 3px; }

.adm-annot-imp-opt {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  background: #f3f4f6;
  color: #555;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.adm-annot-imp-opt.is-active { opacity: 1; border-color: transparent; background: var(--ic, #f3f4f6); }

/* Date input in form */
.adm-annot-date-input {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  color: #111827;
  background: #fff;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}
.adm-annot-date-input:focus { border-color: #7c3aed; }

/* Form action buttons */
.adm-annot-form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 10px;
}

.adm-annot-form-btn {
  padding: 7px 14px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}
.adm-annot-form-btn--cancel { background: #e5e7eb; color: #374151; }
.adm-annot-form-btn--cancel:hover { background: #d1d5db; }
.adm-annot-form-btn--save { background: #7c3aed; color: #fff; }
.adm-annot-form-btn--save:hover { background: #6d28d9; }
.adm-annot-form-btn--save:disabled { opacity: 0.4; cursor: not-allowed; }

/* Empty state */
.adm-annot-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 12px;
}
.adm-annot-empty-icon { font-size: 28px; opacity: 0.5; }

/* Annotation cards */
.adm-annot-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 8px;
  transition: border-color 0.15s;
}
.adm-annot-card:hover { border-color: #c4b5fd; }
.adm-annot-card--archived { opacity: 0.65; background: #fafafa; }

.adm-annot-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.adm-annot-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}

.adm-annot-imp-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 1px;
}

.adm-annot-archived-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: #f3f4f6;
  color: #9ca3af;
  margin-left: auto;
}

.adm-annot-card-text {
  font-size: 12px;
  color: #374151;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 8px;
}

.adm-annot-due {
  font-size: 10px;
  color: #d97706;
  margin-bottom: 6px;
  font-weight: 600;
}

.adm-annot-card-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10px;
  color: #9ca3af;
}

.adm-annot-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 8px;
  font-weight: 700;
  flex-shrink: 0;
}
.adm-annot-author { color: #374151; font-weight: 600; }
.adm-annot-date { margin-left: auto; }

.adm-annot-actions {
  display: flex;
  gap: 5px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.adm-annot-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  transition: background 0.15s;
}
.adm-annot-btn:hover { background: #f3f4f6; }
.adm-annot-btn--archive { color: #d97706; border-color: #fde68a; }
.adm-annot-btn--archive:hover { background: #fffbeb; }

/* Archived section */
.adm-annot-archived-section { margin-top: 12px; }

.adm-annot-archived-summary {
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  padding: 6px 0;
  user-select: none;
}
.adm-annot-archived-summary:hover { color: #6b7280; }

.adm-annot-archived-list { margin-top: 8px; }

/* =====================================================================
   Bulk Action Picker Modal (abm-*)
   ===================================================================== */
.abm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100003;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.abm-overlay--visible { opacity: 1; }

.abm-modal {
  background: #fff;
  border-radius: 14px;
  width: 92%;
  max-width: 380px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  transform: translateY(-12px) scale(0.97);
  transition: transform 0.2s ease;
  overflow: hidden;
}

.abm-overlay--visible .abm-modal { transform: translateY(0) scale(1); }

.abm-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
}

.abm-icon { font-size: 18px; flex-shrink: 0; }

.abm-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.abm-body { padding: 14px 18px; }

.abm-count {
  font-size: 12px;
  font-weight: 600;
  color: #7c3aed;
  margin-bottom: 8px;
}

.abm-alarm-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.abm-alarm-item {
  padding: 5px 10px;
  font-size: 11px;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.abm-alarm-item:last-child { border-bottom: none; }

.abm-alarm-more {
  font-style: italic;
  color: #9ca3af;
  font-size: 10px;
}

.abm-action-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.abm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.abm-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  background: #f9fafb;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  transition: all 0.15s;
}

.abm-action-btn:hover { background: #f3f4f6; border-color: #9ca3af; }

.abm-action-btn--ack:hover  { border-color: #16a34a; color: #16a34a; }
.abm-action-btn--snooze:hover  { border-color: #d97706; color: #d97706; }
.abm-action-btn--escalate:hover { border-color: #dc2626; color: #dc2626; }

.abm-action-icon { font-size: 20px; }

.abm-footer {
  padding: 10px 18px 14px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #e5e7eb;
}

.abm-cancel {
  padding: 7px 16px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
  background: #e5e7eb;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.abm-cancel:hover { background: #d1d5db; }

/* =====================================================================
   View Toggle (CARD | LIST)
   ===================================================================== */
.alarms-view-toggle {
  display: inline-flex;
  border: 1px solid var(--alarms-border);
  border-radius: var(--alarms-radius);
  overflow: hidden;
  flex-shrink: 0;
}

.alarms-view-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  border: none;
  background: var(--alarms-input-bg);
  color: var(--alarms-text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.alarms-view-btn + .alarms-view-btn {
  border-left: 1px solid var(--alarms-border);
}

.alarms-view-btn:hover {
  background: var(--alarms-card-hover);
  color: var(--alarms-text);
}

.alarms-view-btn.is-active {
  background: var(--alarms-primary-light);
  color: var(--alarms-primary);
  box-shadow: inset 0 0 0 2px rgba(139, 92, 246, 0.2);
}

/* =====================================================================
   Group Toggle (CONSOLIDADO | SEPARADO)
   ===================================================================== */
.alarms-group-toggle {
  display: inline-flex;
  border: 1px solid var(--alarms-border);
  border-radius: var(--alarms-radius);
  overflow: hidden;
  flex-shrink: 0;
}

.alarms-group-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  height: 28px;
  font-size: 10px;
  font-weight: 600;
  color: var(--alarms-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.alarms-group-btn + .alarms-group-btn {
  border-left: 1px solid var(--alarms-border);
}

.alarms-group-btn:hover {
  background: var(--alarms-card-hover);
  color: var(--alarms-text);
}

.alarms-group-btn.is-active {
  background: var(--alarms-primary-light);
  color: var(--alarms-primary);
  box-shadow: inset 0 0 0 2px rgba(139, 92, 246, 0.2);
}

/* =====================================================================
   Export Button
   ===================================================================== */
.alarms-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 600;
  color: var(--alarms-text-muted);
  background: var(--alarms-input-bg);
  border: 1px solid var(--alarms-border);
  border-radius: var(--alarms-radius);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.alarms-export-btn:hover {
  border-color: var(--alarms-text-muted);
  color: var(--alarms-text);
  background: var(--alarms-card-hover);
}

/* =====================================================================
   Alarms Table View
   ===================================================================== */
.alarms-table-container {
  flex: 1;
  overflow: auto;
  min-height: 0;
  padding: 0;
}

.alarms-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  color: var(--alarms-text);
}

.atbl-head-row {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--alarms-bg-secondary);
}

.atbl-th {
  padding: 7px 10px;
  background: var(--alarms-bg-secondary);
  border-bottom: 2px solid var(--alarms-border);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--alarms-text-muted);
  text-align: left;
  white-space: nowrap;
  user-select: none;
}

.atbl-th--sel { width: 28px; text-align: center; }
.atbl-th--num { width: 48px; text-align: center; }
.atbl-th--date { width: 90px; }
.atbl-th--actions { width: 100px; }

.atbl-row {
  border-bottom: 1px solid var(--alarms-border-light);
  cursor: pointer;
  transition: background 0.12s;
}

.atbl-row:hover { background: var(--alarms-card-hover); }

.atbl-row--selected { background: var(--alarms-primary-light) !important; }

.atbl-cell {
  padding: 6px 10px;
  vertical-align: middle;
}

.atbl-cell--sel { text-align: center; width: 28px; }
.atbl-cell--num { text-align: center; font-weight: 700; }
.atbl-cell--date { font-size: 10px; white-space: nowrap; color: var(--alarms-text-muted); }

.atbl-cell--title {
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}

.atbl-cell--customer {
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  color: var(--alarms-text-muted);
}

.atbl-sev-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.atbl-cell--actions {
  white-space: nowrap;
}

.atbl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s;
  flex-shrink: 0;
}

.atbl-btn--ack    { background: #dbeafe; color: #1d4ed8; }
.atbl-btn--snooze { background: #ede9fe; color: var(--state-snoozed); }
.atbl-btn--escalate { background: #fee2e2; color: #dc2626; }
.atbl-btn--details  { background: var(--alarms-border); color: var(--alarms-text-muted); }

.atbl-btn:hover { filter: brightness(0.92); }

/* =====================================================================
   Export Modal (aex-*)
   ===================================================================== */
.aex-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100005;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.aex-overlay--visible { opacity: 1; }

.aex-modal {
  background: #fff;
  border-radius: 14px;
  width: 92%;
  max-width: 360px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  transform: translateY(-10px) scale(0.97);
  transition: transform 0.2s ease;
  overflow: hidden;
}

.aex-overlay--visible .aex-modal { transform: translateY(0) scale(1); }

.aex-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
  color: #7c3aed;
}

.aex-icon { flex-shrink: 0; }

.aex-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.aex-body { padding: 14px 18px; }

.aex-info {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 12px;
}

.aex-formats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.aex-fmt-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  background: #f9fafb;
  cursor: pointer;
  transition: all 0.15s;
}

.aex-fmt-btn:hover { border-color: #7c3aed; background: #f5f3ff; }

.aex-fmt-icon { font-size: 22px; }

.aex-fmt-label {
  font-size: 12px;
  font-weight: 700;
  color: #111827;
}

.aex-fmt-desc {
  font-size: 9px;
  color: #9ca3af;
  text-align: center;
}

.aex-footer {
  padding: 10px 18px 14px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #e5e7eb;
}

.aex-cancel {
  padding: 7px 16px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
  background: #e5e7eb;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.aex-cancel:hover { background: #d1d5db; }

/* Bulk alarm list inside action modal (aam-alarm-*) */
.aam-alarm-list-bulk {
  margin: 6px 0 0;
}

.aam-alarm-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 11px;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
}

.aam-alarm-item:last-child { border-bottom: none; }

.aam-alarm-sev {
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.aam-alarm-more {
  font-size: 10px;
  color: #9ca3af;
  font-style: italic;
  padding-top: 4px;
}

`;

/**
 * Inject styles into the document
 */
export function injectAlarmsNotificationsPanelStyles(): void {
  const styleId = 'alarms-notifications-panel-styles';
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  // Always overwrite — ensures updated CSS takes effect without hard refresh
  style.textContent = ALARMS_NOTIFICATIONS_PANEL_STYLES;
}

/**
 * Remove styles from the document
 */
export function removeAlarmsNotificationsPanelStyles(): void {
  const style = document.getElementById('alarms-notifications-panel-styles');
  if (style) {
    style.remove();
  }
}
