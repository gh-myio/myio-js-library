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
   Filters Section
   ===================================================================== */
.alarms-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 8px;
  background: var(--alarms-bg-secondary);
  border-bottom: 1px solid var(--alarms-border);
  align-items: flex-end;
  flex-shrink: 0;
}

.alarms-filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 140px;
}

.alarms-filter-group.search {
  flex: 1;
  min-width: 200px;
}

.alarms-filter-group label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--alarms-text-muted);
}

.alarms-filter-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--alarms-input-bg);
  border: 1px solid var(--alarms-input-border);
  border-radius: var(--alarms-radius);
  transition: all 0.2s ease;
}

.alarms-filter-input:focus-within {
  border-color: var(--alarms-primary);
  box-shadow: 0 0 0 3px var(--alarms-primary-light);
}

.alarms-filter-input .search-icon {
  color: var(--alarms-text-muted);
  font-size: 14px;
}

.alarms-filter-input input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--alarms-text);
  font-size: 14px;
  outline: none;
}

.alarms-filter-input input::placeholder {
  color: var(--alarms-text-light);
}

/* Custom Dropdown Styles */
.alarms-filter-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding: 10px 36px 10px 14px;
  background: var(--alarms-input-bg);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  border: 1px solid var(--alarms-input-border);
  border-radius: var(--alarms-radius);
  color: var(--alarms-text);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  min-width: 150px;
}

.alarms-filter-select:hover {
  border-color: var(--alarms-text-light);
  background-color: var(--alarms-card-hover);
}

.alarms-filter-select:focus {
  border-color: var(--alarms-primary);
  box-shadow: 0 0 0 3px var(--alarms-primary-light);
}

.alarms-filter-select option {
  background: var(--alarms-card-bg);
  color: var(--alarms-text);
  padding: 10px;
}

.alarms-filter-select option:checked {
  background: var(--alarms-primary-light);
  color: var(--alarms-primary);
}

/* Date Filter Styles */
.alarms-filter-date {
  appearance: none;
  -webkit-appearance: none;
  padding: 10px 14px;
  background: var(--alarms-input-bg);
  border: 1px solid var(--alarms-input-border);
  border-radius: var(--alarms-radius);
  color: var(--alarms-text);
  font-size: 14px;
  font-weight: 500;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 140px;
}

.alarms-filter-date:hover {
  border-color: var(--alarms-text-light);
  background-color: var(--alarms-card-hover);
}

.alarms-filter-date:focus {
  border-color: var(--alarms-primary);
  box-shadow: 0 0 0 3px var(--alarms-primary-light);
}

.alarms-filter-date::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.6;
  filter: invert(0.5);
  transition: opacity 0.2s ease;
}

.alarms-filter-date:hover::-webkit-calendar-picker-indicator {
  opacity: 1;
}

.myio-alarms-panel[data-theme="dark"] .alarms-filter-date::-webkit-calendar-picker-indicator {
  filter: invert(0.8);
}

.alarms-clear-filters {
  align-self: flex-end;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--alarms-text-muted);
  background: transparent;
  border: 1px solid var(--alarms-border);
  border-radius: var(--alarms-radius);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.alarms-clear-filters:hover {
  color: var(--alarms-text);
  border-color: var(--alarms-text-muted);
  background: var(--alarms-card-hover);
}

/* Responsive Filters */
@media (max-width: 768px) {
  .alarms-filters {
    gap: 10px;
    padding: 12px;
  }

  .alarms-filter-group {
    min-width: calc(50% - 5px);
  }

  .alarms-filter-group.search {
    min-width: 100%;
    order: -1;
  }

  .alarms-clear-filters {
    width: 100%;
    justify-content: center;
  }
}

/* =====================================================================
   Alarms Grid (List Tab)
   ===================================================================== */
.alarms-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  padding: 6px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  align-content: start;
  align-items: start;
}

@media (max-width: 1400px) {
  .alarms-grid {
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  }
}

@media (max-width: 768px) {
  .alarms-grid {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 6px;
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
  gap: 4px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--alarms-border-light);
  flex-shrink: 0;
}

.alarm-card-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.alarm-severity-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 4px;
  white-space: nowrap;
}

.alarm-severity-badge[data-severity="CRITICAL"] {
  color: var(--severity-critical);
  background: var(--severity-critical-bg);
}
.alarm-severity-badge[data-severity="HIGH"] {
  color: var(--severity-high);
  background: var(--severity-high-bg);
}
.alarm-severity-badge[data-severity="MEDIUM"] {
  color: var(--severity-medium);
  background: var(--severity-medium-bg);
}
.alarm-severity-badge[data-severity="LOW"] {
  color: var(--severity-low);
  background: var(--severity-low-bg);
}
.alarm-severity-badge[data-severity="INFO"] {
  color: var(--severity-info);
  background: var(--severity-info-bg);
}

.alarm-state-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  background: var(--alarms-bg-secondary);
  white-space: nowrap;
}

.alarm-state-badge[data-state="OPEN"] { color: var(--state-open); }
.alarm-state-badge[data-state="ACK"] { color: var(--state-ack); }
.alarm-state-badge[data-state="SNOOZED"] { color: var(--state-snoozed); }
.alarm-state-badge[data-state="ESCALATED"] { color: var(--state-escalated); }
.alarm-state-badge[data-state="CLOSED"] { color: var(--state-closed); }

.alarm-card-time {
  font-size: 12px;
  color: var(--alarms-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Card Body */
.alarm-card-body {
  padding: 4px 6px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}

.alarm-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--alarms-text);
  margin: 0 0 2px 0;
  line-height: 1.3;
  word-break: break-word;
  max-width: 100%;
  overflow-wrap: break-word;
}

.alarm-card-id {
  font-size: 10px;
  color: var(--alarms-text-muted);
  font-family: 'SF Mono', Monaco, monospace;
  margin-bottom: 6px;
  flex-shrink: 0;
}

/* Customer Section */
.alarm-card-customer {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin: 6px 0;
  padding: 4px 6px;
  background: var(--alarms-bg-secondary);
  border-radius: var(--alarms-radius);
}

.alarm-customer-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  min-width: 22px;
  font-size: 10px;
  font-weight: 600;
  color: var(--alarms-primary);
  background: var(--alarms-primary-light);
  border-radius: 50%;
  flex-shrink: 0;
}

.alarm-customer-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.alarm-customer-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--alarms-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alarm-customer-source {
  font-size: 11px;
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
  gap: 4px;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 600;
  color: var(--alarms-text);
  background: var(--alarms-bg-secondary);
  border: 1px solid var(--alarms-border);
  border-radius: 20px;
  margin: 4px 0;
  flex-shrink: 0;
}

.alarm-shopping-chip .chip-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.alarm-shopping-chip .chip-text {
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Card Stats Row */
.alarm-card-stats {
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
  gap: 4px;
  padding: 4px 3px;
  margin: 3px 0;
  background: var(--alarms-bg-secondary);
  border-radius: var(--alarms-radius);
  width: 100%;
  flex-shrink: 0;
}

.alarm-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
  text-align: center;
}

.alarm-stat-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--alarms-text);
}

.alarm-stat-value--large {
  font-size: 14px;
  font-weight: 800;
}

.alarm-stat-label {
  font-size: 9px;
  font-weight: 500;
  text-transform: capitalize;
  color: var(--alarms-text-muted);
}

/* Card Tags */
.alarm-card-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  width: 100%;
}

.alarm-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--alarms-text-muted);
  background: var(--alarms-bg-secondary);
  border-radius: 4px;
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
  gap: 3px;
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
  gap: 4px;
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 600;
  border: none;
  border-radius: var(--alarms-radius);
  cursor: pointer;
  white-space: nowrap;
  flex: 1;
  max-width: 80px;
  transition: all 0.15s ease;
  user-select: none;
}

.alarm-card-footer .btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.alarm-card-footer .btn:active {
  filter: brightness(0.95);
  transform: translateY(0);
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

  .alarm-card-time {
    order: 2;
    width: 100%;
    margin-top: 4px;
    padding-top: 6px;
    border-top: 1px solid var(--alarms-border-light);
  }

  .alarm-card-body {
    padding: 12px;
    gap: 8px;
  }

  .alarm-card-title {
    font-size: 14px;
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

/* Large screens - ensure cards don't stretch too much */
@media (min-width: 1600px) {
  .alarms-grid {
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    max-width: 100%;
  }

  .alarm-card {
    max-width: 100%;
  }

  .alarm-card-title {
    font-size: 16px;
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
`;

/**
 * Inject styles into the document
 */
export function injectAlarmsNotificationsPanelStyles(): void {
  const styleId = 'alarms-notifications-panel-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = ALARMS_NOTIFICATIONS_PANEL_STYLES;
  document.head.appendChild(style);
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
