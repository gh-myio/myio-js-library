/* global self, window, document */

/* =========================================================================
 * ThingsBoard Widget: Device Cards with Totals & Percentages (MyIO)
 *
 * RFC-0106: Data fetching migrated to MAIN_VIEW orchestrator.
 * This widget NO LONGER makes direct API calls to /api/v1/telemetry/customers.
 * All data is received via 'myio:telemetry:provide-data' events from orchestrator.
 *
 * Architecture:
 * - MAIN_VIEW (orchestrator): Makes single API call, distributes to all widgets
 * - TELEMETRY (this widget): Receives data via events, renders cards
 *
 * Features:
 * - Datas obrigatórias: startDateISO / endDateISO
 * - Modal premium (busy) no widget durante carregamentos
 * - Evento (myio:update-date): mostra modal + atualiza
 * - Temperature domain: uses ctx.data directly (no API)
 * =========================================================================*/

/* eslint-disable no-undef, no-unused-vars */

// RFC-0091: Use LogHelper from MAIN via MyIOUtils (centralized logging)
if (!window.MyIOUtils?.LogHelper) {
  console.error('[TELEMETRY] window.MyIOUtils.LogHelper not found - MAIN_VIEW must load first');
}
const LogHelper = window.MyIOUtils?.LogHelper || {
  log: () => {},
  warn: () => {},
  error: (...args) => console.error('[TELEMETRY]', ...args),
};

// ===== INFOTOOLTIP FROM LIBRARY (RFC-0105) =====
/**
 * Get InfoTooltip from the library
 * @returns {object|null} InfoTooltip component or null if not available
 */
function getInfoTooltip() {
  return window.MyIOLibrary?.InfoTooltip || null;
}

LogHelper.log('🚀 [TELEMETRY] Controller loaded - VERSION WITH ORCHESTRATOR SUPPORT');

// ============================================================================
// RFC-0106: Device Classification - NOW USES MAIN_VIEW via window.MyIOUtils
// The classification config and functions have been moved to MAIN_VIEW orchestrator.
// TELEMETRY widgets should use window.MyIOUtils.classifyDevice() and related functions.
// ============================================================================

// RFC-0106: Get classification utilities from MAIN_VIEW (exposed via window.MyIOUtils)
const DEVICE_CLASSIFICATION_CONFIG = window.MyIOUtils?.DEVICE_CLASSIFICATION_CONFIG || {
  climatizacao: { deviceTypes: [], conditionalDeviceTypes: [], identifiers: [], identifierPrefixes: [] },
  elevadores: { deviceTypes: [], identifiers: [], identifierPrefixes: [] },
  escadas_rolantes: { deviceTypes: [], identifiers: [], identifierPrefixes: [] },
};

// Inject styles for type badges
function injectBadgeStyles() {
  if (document.getElementById('annotation-type-badges-styles')) return;

  const style = document.createElement('style');
  style.id = 'annotation-type-badges-styles';
  style.textContent = `
          .annotation-type-badges {
              position: absolute;
              top: 50%;
              right: 6px;
              transform: translateY(-50%);
              display: flex;
              flex-direction: column;
              gap: 4px;
              z-index: 10;
          }

          .annotation-type-badge {
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

          .annotation-type-badge:hover {
              transform: scale(1.15);
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          }

          .annotation-type-badge__count {
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
      `;
  document.head.appendChild(style);
}

// RFC-0183: Inject alarm badge CSS (once, idempotent)
function injectAlarmBadgeStyles() {
  if (document.getElementById('myio-alarm-badge-styles')) return;
  const s = document.createElement('style');
  s.id = 'myio-alarm-badge-styles';
  s.textContent = `
    .myio-alarm-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      background: #dc2626;
      color: #fff;
      border-radius: 10px;
      padding: 2px 5px;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 2px;
      z-index: 10;
      pointer-events: none;
      line-height: 1.3;
    }
  `;
  document.head.appendChild(s);
}

// RFC-0198: Inject ticket badge CSS (once, idempotent)
function injectTicketBadgeStyles() {
  if (document.getElementById('myio-ticket-badge-styles')) return;
  const s = document.createElement('style');
  s.id = 'myio-ticket-badge-styles';
  s.textContent = `
    .myio-ticket-badge {
      position: absolute;
      bottom: 6px;
      left: 6px;
      background: #f59e0b;
      color: #fff;
      border-radius: 10px;
      padding: 2px 5px;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 2px;
      z-index: 10;
      pointer-events: none;
      line-height: 1.3;
    }
  `;
  document.head.appendChild(s);
}

// RFC-0198: Append ticket badge to a card element if the device has open FreshDesk tickets.
// identifier comes from entityObject.identifier (device identifier, e.g. "MED-LOJA-01").
function addTicketBadge(cardElement, identifier) {
  if (!cardElement || !identifier) return;

  // Primary: use TicketServiceOrchestrator
  const tso = window.TicketServiceOrchestrator;
  let count = tso ? tso.getTicketCountForDevice(identifier) : 0;

  // Fallback: use freshdesk_tickets SERVER_SCOPE dataKey if available on item
  if (count === 0 && !tso) {
    const item = STATE.itemsBase?.find(i => i.identifier === identifier);
    const raw = item?.freshdeskTickets;
    if (raw) {
      try {
        // MAIN_VIEW already parses the JSON string; accept both object and string
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        // stored as { items: [...] }; legacy: bare array
        const summaries = Array.isArray(parsed) ? parsed : (parsed?.items ?? []);
        count = summaries.filter(t => [2, 3, 6].includes(t.status)).length;
      } catch (_e) { /* ignore parse errors */ }
    }
  }

  if (!count) return;

  injectTicketBadgeStyles();
  if (cardElement.style) cardElement.style.position = 'relative';

  const badge = document.createElement('div');
  badge.className = 'myio-ticket-badge';
  badge.setAttribute('data-ticket-identifier', identifier); // for live updates via myio:tickets-ready
  badge.title = count + ' chamado' + (count !== 1 ? 's' : '') + ' aberto' + (count !== 1 ? 's' : '');
  badge.innerHTML =
    '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
    '</svg>' +
    '<span>' +
    (count > 99 ? '99+' : count) +
    '</span>';
  cardElement.appendChild(badge);
}

/**
 * RFC-0198: Called on myio:tickets-ready: refreshes ticket badge counts on all visible cards.
 */
function refreshTicketBadges() {
  const tso = window.TicketServiceOrchestrator;
  if (!tso) return;

  document.querySelectorAll('.myio-ticket-badge[data-ticket-identifier]').forEach((badge) => {
    const identifier = badge.getAttribute('data-ticket-identifier');
    if (!identifier) return;
    const count = tso.getTicketCountForDevice(identifier);
    const span = badge.querySelector('span');
    if (count > 0) {
      badge.style.display = '';
      badge.title = count + ' chamado' + (count !== 1 ? 's' : '') + ' aberto' + (count !== 1 ? 's' : '');
      if (span) span.textContent = count > 99 ? '99+' : String(count);
    } else {
      badge.style.display = 'none';
    }
  });
}

// RFC-0184: Inject filter modal CSS into <head> to bypass ThingsBoard widget CSS scoping.
// The modal is portalled to document.body so TB-scoped styles.css rules won't reach it.
// Using .telemetry-filter-overlay as scoping class (present on #filterModal element).
function injectFilterModalStyles() {
  // Use ownerDocument so styles go to the correct document (iframe or main page)
  const doc = (_filterModalElement && _filterModalElement.ownerDocument) || document;
  if (doc.getElementById('telemetry-filter-modal-styles')) return;
  const style = doc.createElement('style');
  style.id = 'telemetry-filter-modal-styles';
  style.textContent = `
    .telemetry-filter-overlay.hidden { display: none !important; pointer-events: none !important; }
    .telemetry-filter-overlay {
      --ink-1: #1c2743; --ink-2: #6b7a90; --bd: #e8eef4; --bd-2: #d6e1ec;
      --brand: #1f6fb5; --bg-soft: #f7fbff;
      --font-ui: Inter,'Inter var','Plus Jakarta Sans',system-ui,-apple-system,sans-serif;
      position: fixed; inset: 0;
      background: rgba(17,24,39,0.35);
      z-index: 99999;
      display: flex; align-items: center; justify-content: center;
    }
    .telemetry-filter-overlay .shops-modal-card {
      max-width: 1006px; width: 100%; max-height: calc(100% - 48px);
      background: #fff; border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.2);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .telemetry-filter-overlay .shops-modal-header {
      position: sticky; top: 0; z-index: 2;
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border-bottom: 1px solid rgba(62,26,125,0.15);
      background: linear-gradient(135deg, #3e1a7d 0%, #5b2d9e 100%);
    }
    .telemetry-filter-overlay .shops-modal-header h3 {
      margin: 0; font: 900 14px/1 var(--font-ui);
      letter-spacing: 0.4px; color: #fff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .telemetry-filter-overlay .shops-modal-header .icon-btn {
      background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.3);
    }
    .telemetry-filter-overlay .shops-modal-header .icon-btn svg { fill: #fff; }
    .telemetry-filter-overlay .shops-modal-header .icon-btn:hover {
      background: rgba(255,255,255,0.25);
    }
    .telemetry-filter-overlay .shops-modal-body {
      flex: 1 1 auto; min-height: 0; overflow: auto; padding: 14px;
    }
    .telemetry-filter-overlay .shops-modal-footer {
      position: sticky; bottom: 0; z-index: 2;
      display: flex; gap: 8px; align-items: center; justify-content: flex-end;
      padding: 10px 12px; border-top: 1px solid var(--bd); background: #fff;
    }
    .telemetry-filter-overlay .btn.btn-device-map-download {
      margin-right: auto;
      background: #4a7c59; color: #fff; border-color: #3d6849;
      display: inline-flex; align-items: center;
      box-shadow: 0 2px 8px rgba(74,124,89,0.28);
      font: 700 10px var(--font-ui);
      padding: 8px 12px; border-radius: 10px; cursor: pointer;
      transition: background 0.15s ease;
    }
    .telemetry-filter-overlay .btn.btn-device-map-download:hover {
      background: #3d6849;
    }
    /* RFC-0195: Sync GCDR button */
    .telemetry-filter-overlay .btn.btn-sync-gcdr {
      background: linear-gradient(180deg, #0db89e, #0a6d5e); color: #fff; border-color: #0a6d5e;
      display: inline-flex; align-items: center; gap: 4px;
      box-shadow: 0 2px 8px rgba(10,109,94,0.28);
      font: 700 10px var(--font-ui);
      padding: 8px 12px; border-radius: 10px; cursor: pointer;
      transition: opacity 0.15s ease;
    }
    .telemetry-filter-overlay .btn.btn-sync-gcdr:hover { opacity: 0.88; }
    .telemetry-filter-overlay .btn.btn-sync-gcdr:disabled { opacity: 0.5; cursor: not-allowed; }
    /* RFC-0195: Sync GCDR job modal */
    .telemetry-sync-gcdr-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
    }
    .telemetry-sync-gcdr-card {
      background: #fff; border-radius: 12px; width: 1280px; max-width: 96vw;
      max-height: 98vh; display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      font-family: system-ui,sans-serif; font-size: 13px;
      transition: width 0.2s ease, max-height 0.2s ease, border-radius 0.2s ease;
    }
    .telemetry-sync-gcdr-card.sgj-expanded {
      width: 100vw !important; max-width: 100vw !important;
      height: 100vh !important; max-height: 100vh !important;
      border-radius: 0 !important;
    }
    .telemetry-sync-gcdr-overlay.sgj-overlay-expanded {
      align-items: stretch !important; justify-content: stretch !important;
    }
    .telemetry-sync-gcdr-header {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 18px; border-bottom: 1px solid #e5e7eb;
      font-weight: 700; font-size: 14px; color: #111827; flex-shrink: 0;
    }
    .telemetry-sync-gcdr-header-title { flex: 1; }
    .telemetry-sync-gcdr-close,
    .telemetry-sync-gcdr-expand,
    .telemetry-sync-gcdr-dl {
      background: none; border: 1px solid #e5e7eb; cursor: pointer;
      padding: 4px 8px; color: #6b7280; font-size: 13px; line-height: 1;
      border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;
      white-space: nowrap;
    }
    .telemetry-sync-gcdr-close:hover,
    .telemetry-sync-gcdr-expand:hover { background: #f3f4f6; color: #111827; }
    .telemetry-sync-gcdr-dl { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
    .telemetry-sync-gcdr-dl:hover { background: #dcfce7; }
    .telemetry-sync-gcdr-dl:disabled { opacity: 0.4; cursor: not-allowed; }
    .telemetry-sync-gcdr-body { flex: 1; overflow-y: auto; padding: 18px; }
    .telemetry-sync-gcdr-status { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
    .telemetry-sync-gcdr-badge {
      display: inline-block; padding: 3px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 700; letter-spacing: .3px;
    }
    .telemetry-sync-gcdr-badge.queued  { background: #f3f4f6; color: #6b7280; }
    .telemetry-sync-gcdr-badge.running { background: #dbeafe; color: #1e40af; }
    .telemetry-sync-gcdr-badge.done    { background: #d1fae5; color: #065f46; }
    .telemetry-sync-gcdr-badge.partial { background: #fef3c7; color: #92400e; }
    .telemetry-sync-gcdr-badge.failed  { background: #fee2e2; color: #991b1b; }
    .telemetry-sync-gcdr-progress-wrap {
      background: #f3f4f6; border-radius: 6px; height: 8px; overflow: hidden; margin-bottom: 8px;
    }
    .telemetry-sync-gcdr-progress-bar {
      height: 100%; border-radius: 6px; background: linear-gradient(90deg,#0db89e,#2563eb);
      transition: width 0.4s ease; width: 0%;
    }
    .telemetry-sync-gcdr-phase { font-size: 11px; color: #6b7280; margin-bottom: 14px; }
    .telemetry-sync-gcdr-summary {
      display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 16px;
    }
    .telemetry-sync-gcdr-kpi {
      background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
      padding: 10px; text-align: center;
    }
    .telemetry-sync-gcdr-kpi .kpi-val { font-size: 20px; font-weight: 700; color: #111827; }
    .telemetry-sync-gcdr-kpi .kpi-lbl { font-size: 10px; color: #6b7280; margin-top: 2px; }
    .telemetry-sync-gcdr-log-wrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .telemetry-sync-gcdr-log-title {
      padding: 8px 12px; background: #f9fafb; font-weight: 600;
      font-size: 11px; color: #374151; border-bottom: 1px solid #e5e7eb;
    }
    .telemetry-sync-gcdr-log-table {
      width: 100%; border-collapse: collapse; font-size: 11px;
      display: block; max-height: 200px; overflow-y: auto;
    }
    .telemetry-sync-gcdr-log-table tr { border-bottom: 1px solid #f3f4f6; }
    .telemetry-sync-gcdr-log-table tr:last-child { border-bottom: none; }
    .telemetry-sync-gcdr-log-table td { padding: 5px 10px; vertical-align: top; }
    .telemetry-sync-gcdr-log-table td:nth-child(1) { white-space:nowrap; color:#9ca3af; width:70px; }
    .telemetry-sync-gcdr-log-table td:nth-child(2) { white-space:nowrap; width:56px; font-weight:600; }
    .telemetry-sync-gcdr-log-table td:nth-child(3) { white-space:nowrap; width:120px; font-size:10px; color:#9ca3af; }
    .telemetry-sync-gcdr-log-table td:nth-child(4) { word-break:break-word; }
    .sgj-level-INFO  { color: #6b7280; }
    .sgj-level-WARN  { color: #d97706; }
    .sgj-level-OK    { color: #16a34a; }
    .sgj-level-FAIL  { color: #dc2626; }
    .sgj-level-ERROR { color: #991b1b; }
    .telemetry-filter-overlay .icon-btn {
      display: flex; align-items: center; justify-content: center;
      border: 1px solid var(--bd); background: #fff; border-radius: 10px;
      padding: 6px; cursor: pointer;
    }
    .telemetry-filter-overlay .icon-btn svg { fill: #44506b; display: block; width: 14px; height: 14px; }
    .telemetry-filter-overlay .btn,
    .telemetry-filter-overlay .tiny-btn {
      border: 1px solid var(--bd); background: #fff; cursor: pointer;
      border-radius: 10px;
    }
    .telemetry-filter-overlay .btn { padding: 8px 12px; font: 700 10px var(--font-ui); }
    .telemetry-filter-overlay .btn.primary {
      background: #3e1a7d; color: #fff; border-color: #3e1a7d;
      box-shadow: 0 4px 12px rgba(62,26,125,0.25); transition: all 0.15s ease;
    }
    .telemetry-filter-overlay .btn.primary:hover {
      background: #2f1460; border-color: #2f1460; transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(62,26,125,0.35);
    }
    .telemetry-filter-overlay .btn.primary:active {
      transform: translateY(0); box-shadow: 0 2px 8px rgba(62,26,125,0.25);
    }
    .telemetry-filter-overlay .tiny-btn {
      padding: 8px 12px; letter-spacing: 0.3px; font: 700 11px var(--font-ui);
      background: linear-gradient(135deg,rgba(62,26,125,0.05) 0%,rgba(62,26,125,0.08) 100%);
      border-color: rgba(62,26,125,0.2); color: #3e1a7d; transition: all 0.15s ease;
    }
    .telemetry-filter-overlay .tiny-btn:hover {
      background: linear-gradient(135deg,rgba(62,26,125,0.08) 0%,rgba(62,26,125,0.12) 100%);
      border-color: rgba(62,26,125,0.3); transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(62,26,125,0.15);
    }
    .telemetry-filter-overlay .filter-block { margin-bottom: 16px; }
    .telemetry-filter-overlay .filter-block:last-child { margin-bottom: 0; }
    .telemetry-filter-overlay .block-label {
      display: block; margin-bottom: 10px; font: 800 12px/1.2 var(--font-ui);
      letter-spacing: 0.3px; color: #3e1a7d;
      text-shadow: 0 1px 2px rgba(62,26,125,0.1);
    }
    .telemetry-filter-overlay .inline-actions { display: flex; gap: 8px; margin-bottom: 12px; }
    .telemetry-filter-overlay .filter-search { position: relative; margin: 8px 0 12px; }
    .telemetry-filter-overlay .filter-search input {
      width: 100%; border: 1px solid var(--bd-2); border-radius: 12px;
      padding: 10px 36px; outline: 0; font: 600 13px/1.2 var(--font-ui);
      letter-spacing: 0.2px; background: #fff;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .telemetry-filter-overlay .filter-search input:focus {
      border-color: var(--brand); box-shadow: 0 0 0 3px rgba(31,111,181,0.15);
    }
    .telemetry-filter-overlay .filter-search svg {
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      width: 16px; height: 16px; pointer-events: none; fill: #44506b;
    }
    .telemetry-filter-overlay .filter-search .clear-x {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      width: 26px; height: 26px; border: 0; background: transparent;
      cursor: pointer; border-radius: 8px;
    }
    .telemetry-filter-overlay .filter-search .clear-x:hover { background: rgba(0,0,0,0.06); }
    .telemetry-filter-overlay .radio-grid {
      display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px;
    }
    .telemetry-filter-overlay .alarm-filter-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .telemetry-filter-overlay .radio-grid label { font: 600 13px/1.2 var(--font-ui); color: var(--ink-1); }
    .telemetry-filter-overlay .muted { color: var(--ink-2); font: 500 12px/1.2 var(--font-ui); margin-top: 8px; }
    .telemetry-filter-overlay .checklist {
      display: grid; grid-template-columns: repeat(auto-fill,minmax(240px,1fr)); gap: 10px;
    }
    .telemetry-filter-overlay .check-item {
      position: relative; display: flex; align-items: center; gap: 10px;
      padding: 10px 12px 10px 44px; background: #fff; border: 2px solid var(--bd-2);
      border-radius: 12px; box-shadow: 0 6px 14px rgba(0,0,0,0.05); cursor: pointer;
    }
    .telemetry-filter-overlay .check-item:hover { border-color: var(--brand); background: var(--bg-soft); }
    .telemetry-filter-overlay .check-item:active { transform: translateY(1px); }
    .telemetry-filter-overlay .check-item input[type='checkbox'] {
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      width: 20px; height: 20px; margin: 0; opacity: 0; cursor: pointer;
    }
    .telemetry-filter-overlay .check-item::before {
      content: ''; position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      width: 20px; height: 20px; border: 2px solid var(--bd-2); border-radius: 6px;
      background: #fff; z-index: 1;
    }
    .telemetry-filter-overlay .check-item::after {
      content: '✓'; position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      width: 20px; height: 20px; opacity: 0; display: flex; align-items: center;
      justify-content: center; font-size: 14px; font-weight: 900; color: #fff; z-index: 2;
    }
    .telemetry-filter-overlay .check-item.selected,
    .telemetry-filter-overlay .check-item[data-checked='true'] {
      background: rgba(62,26,125,0.08); border-color: #3e1a7d;
      box-shadow: 0 8px 18px rgba(62,26,125,0.15);
    }
    .telemetry-filter-overlay .check-item.selected::before,
    .telemetry-filter-overlay .check-item[data-checked='true']::before {
      background: #3e1a7d; border-color: #3e1a7d;
    }
    .telemetry-filter-overlay .check-item.selected::after,
    .telemetry-filter-overlay .check-item[data-checked='true']::after { opacity: 1; }
    @supports selector(:has(*)) {
      .telemetry-filter-overlay .check-item:has(input[type='checkbox']:checked) {
        background: rgba(62,26,125,0.08); border-color: #3e1a7d;
        box-shadow: 0 8px 18px rgba(62,26,125,0.15);
      }
      .telemetry-filter-overlay .check-item:has(input[type='checkbox']:checked)::before {
        background: #3e1a7d; border-color: #3e1a7d;
      }
      .telemetry-filter-overlay .check-item:has(input[type='checkbox']:checked)::after { opacity: 1; }
    }
    .telemetry-filter-overlay .check-item span {
      font: 700 13.5px/1.25 var(--font-ui); letter-spacing: 0.15px; color: var(--ink-1);
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
    }
  `;
  doc.head.appendChild(style);
}

// RFC-0183: Append alarm badge to a card element if the device has active alarms.
// gcdrDeviceId comes from entityObject.gcdrDeviceId (set via RFC-0180).
function addAlarmBadge(cardElement, gcdrDeviceId) {
  if (!cardElement || !gcdrDeviceId) return;
  if (STATE.alarmFilter === 'desativado') return; // badge hidden when alarm display is off
  const aso = window.AlarmServiceOrchestrator;
  if (!aso) return;
  const count = aso.getAlarmCountForDevice(gcdrDeviceId);
  if (!count) return;

  injectAlarmBadgeStyles();
  if (cardElement.style) cardElement.style.position = 'relative';

  const badge = document.createElement('div');
  badge.className = 'myio-alarm-badge';
  badge.setAttribute('data-alarm-device-id', gcdrDeviceId); // for live updates via myio:alarms-updated
  badge.title = count + ' alarme' + (count !== 1 ? 's' : '') + ' ativo' + (count !== 1 ? 's' : '');
  badge.innerHTML =
    '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>' +
    '</svg>' +
    '<span>' +
    (count > 99 ? '99+' : count) +
    '</span>';
  cardElement.appendChild(badge);
}

/**
 * Called on myio:alarms-updated: refreshes alarm badge counts on all visible TELEMETRY cards
 * without re-rendering the entire grid.
 */
function refreshAlarmBadges() {
  const aso = window.AlarmServiceOrchestrator;
  if (!aso) return;

  document.querySelectorAll('.myio-alarm-badge[data-alarm-device-id]').forEach((badge) => {
    const gcdrDeviceId = badge.getAttribute('data-alarm-device-id');
    if (!gcdrDeviceId) return;
    const count = aso.getAlarmCountForDevice(gcdrDeviceId);
    const span = badge.querySelector('span');
    if (count > 0) {
      badge.style.display = '';
      badge.title = count + ' alarme' + (count !== 1 ? 's' : '') + ' ativo' + (count !== 1 ? 's' : '');
      if (span) span.textContent = count > 99 ? '99+' : String(count);
    } else {
      badge.style.display = 'none'; // alarm resolved — hide badge
    }
  });
}

/**
 * RFC-0196: Handle myio:group-filter-changed event from TELEMETRY_INFO.
 * Shows/hides device cards based on active groups.
 */
function _groupFilterChangedHandler(ev) {
  const { domain, groupFilter } = ev.detail || {};
  if (!domain || !groupFilter) return;
  const $container = $root();
  const attr = domain === 'water' ? 'data-water-group' : 'data-energy-group';

  // Toggle card visibility per group
  $container.find('[' + attr + ']').each(function () {
    const group = this.getAttribute(attr);
    const active = groupFilter[group] !== false; // undefined = active
    $(this).toggle(active);
  });

  // Recalculate header from items whose individual group is still active.
  // For water: all items in this widget share the same group key (from labelWidget).
  // For energy: each item has its own group key (from deviceType/profile/identifier).
  const allItems = STATE.lastVisible || [];
  const visibleItems = allItems.filter((item) => {
    const itemGroup = domain === 'water'
      ? _getWaterGroupKey(self.ctx.settings && self.ctx.settings.labelWidget)
      : _getEnergyGroupKey(item);
    // null group = untagged card, always shown
    return itemGroup === null || groupFilter[itemGroup] !== false;
  });
  const visibleSum = visibleItems.reduce((acc, x) => acc + (x.value || 0), 0);
  renderHeader(visibleItems.length, visibleSum);

  LogHelper.log(`[RFC-0196] Group filter applied for domain=${domain}:`, groupFilter);
}

/** RFC-0196: Map water widget labelWidget to water filter group key */
function _getWaterGroupKey(labelWidget) {
  const lw = (labelWidget || '').toLowerCase().trim();
  if (lw === 'lojas') return 'lojas';
  if (lw === 'banheiros' || lw === 'bathrooms') return 'banheiros';
  if (lw === 'área comum' || lw === 'area comum' || lw === 'areacomum') return 'areaComum';
  return null;
}

/**
 * RFC-0105: Build annotation type tooltip content using InfoTooltip classes
 * @param {string} type - Annotation type (pending, maintenance, activity, observation)
 * @param {Array} typeAnnotations - Annotations of this type
 * @param {Object} config - Type configuration (color, icon, label)
 * @returns {string} HTML content for the tooltip
 */
function buildAnnotationTypeTooltipContent(type, typeAnnotations, config) {
  const now = new Date();

  // Count overdue for this type
  const typeOverdueCount = typeAnnotations.filter((a) => a.dueDate && new Date(a.dueDate) < now).length;

  // Build overdue warning
  const overdueWarning =
    typeOverdueCount > 0
      ? `<div style="color:#d63031;padding:8px 12px;background:#fff5f5;border-radius:6px;margin-bottom:12px;font-size:11px;font-weight:500;">
         ⚠️ ${typeOverdueCount} anotação(ões) vencida(s)
       </div>`
      : '';

  // Build annotations list
  const annotationsList = typeAnnotations
    .slice(0, 5)
    .map(
      (a) => `
      <div class="myio-info-tooltip__row" style="flex-direction:column;align-items:flex-start;gap:4px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <div style="font-weight:500;color:#1a1a2e;font-size:12px;line-height:1.4;">"${a.text}"</div>
        <div style="font-size:10px;color:#868e96;">
          ${a.createdBy?.name || 'N/A'} • ${new Date(a.createdAt).toLocaleDateString('pt-BR')}
          ${a.dueDate ? ` • Vence: ${new Date(a.dueDate).toLocaleDateString('pt-BR')}` : ''}
        </div>
      </div>
    `
    )
    .join('');

  const moreCount = typeAnnotations.length > 5 ? typeAnnotations.length - 5 : 0;
  const moreSection =
    moreCount > 0
      ? `<div style="font-size:11px;color:#6c757d;margin-top:8px;text-align:center;">+ ${moreCount} mais...</div>`
      : '';

  return `
    <div class="myio-info-tooltip__section">
      <div class="myio-info-tooltip__section-title">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${config.color};"></span>
        ${config.label} (${typeAnnotations.length})
      </div>
      ${overdueWarning}
      ${annotationsList}
      ${moreSection}
    </div>
  `;
}

// Function to add annotation type badges to a card
function addAnnotationIndicator(cardElement, entityObject) {
  LogHelper.log(`[TELEMETRY] Adding annotation indicators for ${entityObject.labelOrName}`);

  // Safely extract annotations array from log_annotations
  // log_annotations can be: null, string (JSON), or object with annotations property
  let annotations = null;
  try {
    let logAnnotations = entityObject.log_annotations;

    // If it's a string, try to parse it as JSON
    if (typeof logAnnotations === 'string') {
      logAnnotations = JSON.parse(logAnnotations);
    }

    // Extract annotations array from parsed object
    if (logAnnotations && Array.isArray(logAnnotations.annotations)) {
      annotations = logAnnotations.annotations;
    } else if (Array.isArray(logAnnotations)) {
      // log_annotations might be the array directly
      annotations = logAnnotations;
    }
  } catch (err) {
    LogHelper.warn(
      `[TELEMETRY] Failed to parse log_annotations for ${entityObject.labelOrName}:`,
      err.message
    );
    return null;
  }

  // No valid annotations found
  if (!annotations || annotations.length === 0) {
    return null;
  }

  // Ensure badge styles are injected
  injectBadgeStyles();

  // Create wrapper for positioning
  if (cardElement && cardElement.style) {
    cardElement.style.position = 'relative';
  }

  // Filter active annotations
  const activeAnnotations = annotations.filter((a) => a.status !== 'archived');
  if (activeAnnotations.length === 0) return null;

  // Group annotations by type
  const annotationsByType = {
    pending: [],
    maintenance: [],
    activity: [],
    observation: [],
  };

  activeAnnotations.forEach((a) => {
    if (annotationsByType[a.type] !== undefined) {
      annotationsByType[a.type].push(a);
    }
  });

  // Create badges container
  const container = document.createElement('div');
  container.className = 'annotation-type-badges';

  // Priority order: pending, maintenance, activity, observation
  const typeOrder = ['pending', 'maintenance', 'activity', 'observation'];

  const TYPE_CONFIG = {
    pending: {
      color: '#d63031',
      icon: '⚠️',
      label: 'Pendência',
    },
    maintenance: {
      color: '#e17055',
      icon: '🔧',
      label: 'Manutenção',
    },
    activity: {
      color: '#00b894',
      icon: '✓',
      label: 'Atividade',
    },
    observation: {
      color: '#0984e3',
      icon: '📝',
      label: 'Observação',
    },
  };

  // RFC-0105: Get InfoTooltip from library
  const InfoTooltip = getInfoTooltip();

  // Create a badge for each type with annotations
  typeOrder.forEach((type) => {
    const typeAnnotations = annotationsByType[type];
    if (typeAnnotations.length === 0) return;

    const config = TYPE_CONFIG[type];
    const badge = document.createElement('div');
    badge.className = 'annotation-type-badge';
    badge.style.background = config.color;
    badge.innerHTML = `
      <span>${config.icon}</span>
      <span class="annotation-type-badge__count">${typeAnnotations.length}</span>
    `;

    // RFC-0105: Use InfoTooltip from library
    if (InfoTooltip) {
      badge.addEventListener('mouseenter', () => {
        const content = buildAnnotationTypeTooltipContent(type, typeAnnotations, config);
        InfoTooltip.show(badge, {
          icon: config.icon,
          title: `${config.label} - ${entityObject.labelOrName}`,
          content: content,
        });
      });

      badge.addEventListener('mouseleave', () => {
        InfoTooltip.startDelayedHide();
      });
    } else {
      console.error('[TELEMETRY] InfoTooltip not available - cannot show annotation tooltip');
    }

    container.appendChild(badge);
  });

  // Append badges to card
  cardElement.appendChild(container);

  return container;
}

// RFC-0106: Sets are now derived from DEVICE_CLASSIFICATION_CONFIG (from window.MyIOUtils)
// These are computed at load time based on the config
const CLIMATIZACAO_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes);
const CLIMATIZACAO_CONDITIONAL_TYPES_SET = new Set(
  DEVICE_CLASSIFICATION_CONFIG.climatizacao.conditionalDeviceTypes || []
);
const ELEVADORES_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.elevadores.deviceTypes);
const ESCADAS_DEVICE_TYPES_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.deviceTypes);

const CLIMATIZACAO_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifiers);
const ELEVADORES_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.elevadores.identifiers);
const ESCADAS_IDENTIFIERS_SET = new Set(DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.identifiers);

/**
 * RFC-0196: Classify an energy device into its GROUP_FILTER key.
 * Returns one of 'lojas', 'climatizacao', 'elevadores', 'escadasRolantes', 'outros',
 * or null for entrada/water/temperature devices that are not group-filterable.
 * @param {Object} it - Item from STATE.itemsBase
 * @returns {string|null}
 */
function _getEnergyGroupKey(it) {
  const dt = String(it.deviceType || '').toUpperCase();
  const dp = String(it.deviceProfile || '').toUpperCase();
  const id = String(it.identifier || '').toUpperCase();
  const entradaTypes = new Set(['ENTRADA', 'RELOGIO', 'TRAFO', 'SUBESTACAO']);
  if (entradaTypes.has(dt) || entradaTypes.has(dp)) return 'entrada';
  if (
    CLIMATIZACAO_DEVICE_TYPES_SET.has(dt) ||
    CLIMATIZACAO_CONDITIONAL_TYPES_SET.has(dt) ||
    CLIMATIZACAO_IDENTIFIERS_SET.has(id) ||
    id.startsWith('CAG-') ||
    id.startsWith('FANCOIL-') ||
    (DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceProfiles || []).includes(dp)
  ) return 'climatizacao';
  if (
    ELEVADORES_DEVICE_TYPES_SET.has(dt) ||
    ELEVADORES_IDENTIFIERS_SET.has(id) ||
    id.startsWith('ELV-')
  ) return 'elevadores';
  if (
    ESCADAS_DEVICE_TYPES_SET.has(dt) ||
    ESCADAS_IDENTIFIERS_SET.has(id) ||
    id.startsWith('ESC-')
  ) return 'escadasRolantes';
  if (dt === '3F_MEDIDOR' && (dp === '3F_MEDIDOR' || !dp)) return 'lojas';
  if (dt === '3F_MEDIDOR') return 'outros';
  return null;
}

// RFC-0106: Get EQUIPMENT_EXCLUSION_PATTERN from MAIN_VIEW if available
const EQUIPMENT_EXCLUSION_PATTERN =
  window.MyIOUtils?.EQUIPMENT_EXCLUSION_PATTERN ||
  new RegExp(
    [
      ...DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes,
      ...DEVICE_CLASSIFICATION_CONFIG.elevadores.deviceTypes,
      ...DEVICE_CLASSIFICATION_CONFIG.escadas_rolantes.deviceTypes,
      'bomba',
      'subesta',
      'entrada',
    ]
      .map((t) => t.toLowerCase())
      .join('|'),
    'i'
  );

/**
 * RFC-0097: Infere um identifier para exibição baseado no deviceType ou label
 * Usado quando o atributo identifier está ausente
 * @param {Object} item - Item com deviceType e/ou label
 * @returns {string} Identifier inferido ou 'N/A'
 */
function inferDisplayIdentifier(item) {
  if (!item) return 'N/A';

  // Primeiro, tentar usar deviceType
  const deviceType = String(item.deviceType || '').toUpperCase();
  if (deviceType && deviceType !== 'N/D' && deviceType !== '3F_MEDIDOR') {
    // Se for um deviceType conhecido, retornar o próprio deviceType ou abreviação
    if (CLIMATIZACAO_DEVICE_TYPES_SET.has(deviceType)) {
      return deviceType;
    }
    if (ELEVADORES_DEVICE_TYPES_SET.has(deviceType)) {
      return 'ELV';
    }
    if (ESCADAS_DEVICE_TYPES_SET.has(deviceType)) {
      return 'ESC';
    }
  }

  // Fallback: inferir do label usando deviceTypes do config
  const label = String(item.label || '').toLowerCase();

  // Verificar cada deviceType de climatização no label
  for (const dt of DEVICE_CLASSIFICATION_CONFIG.climatizacao.deviceTypes) {
    if (label.includes(dt.toLowerCase())) {
      return dt;
    }
  }
  // Verificar identifiers de climatização
  for (const id of DEVICE_CLASSIFICATION_CONFIG.climatizacao.identifiers) {
    if (label.includes(id.toLowerCase())) {
      return id;
    }
  }

  // Elevadores
  if (label.includes('elevador') || label.includes('elv')) return 'ELV';

  // Escadas
  if (label.includes('escada')) return 'ESC';

  return 'N/A';
}

// RFC-0091: DATA_API_HOST is read at call time via window.MyIOUtils.getDataApiHost()
// No module-scope snapshot — always gets the live value set by MAIN widget onInit.
const MAX_FIRST_HYDRATES = 1;
let MAP_INSTANTANEOUS_POWER;

/**
 * RFC-0078: Extract consumption ranges from unified JSON structure
 * @param {Object} powerLimitsJSON - The mapInstantaneousPower JSON object
 * @param {string} deviceType - Device type (e.g., 'ELEVADOR')
 * @param {string} telemetryType - Telemetry type (default: 'consumption')
 * @returns {Object|null} Range configuration or null
 */
/**
 * RFC-0078: Busca limites no JSON com "Funil" de fallback inteligente
 * Resolve inconsistências entre nomes do TB e chaves do JSON (incluindo Overrides)
 */
function extractLimitsFromJSON(powerLimitsJSON, deviceType, telemetryType = 'consumption') {
  if (!powerLimitsJSON || !powerLimitsJSON.limitsByInstantaneoustPowerType) {
    return null;
  }

  const telemetryConfig = powerLimitsJSON.limitsByInstantaneoustPowerType.find(
    (config) => config.telemetryType === telemetryType
  );

  if (!telemetryConfig) return null;

  // Normaliza o tipo para evitar problemas de espaço ou minúsculas
  const typeUpper = String(deviceType || '')
    .toUpperCase()
    .trim();

  // 1. TENTATIVA EXATA (O ideal)
  let deviceConfig = telemetryConfig.itemsByDeviceType.find(
    (item) => String(item.deviceType).toUpperCase().trim() === typeUpper
  );

  // 2. SE NÃO ACHOU, TENTA IDENTIFICAR PELO NOME (Apelidos)
  if (!deviceConfig) {
    if (typeUpper.includes('ESCADA') || typeUpper === 'ESCADASROLANTES' || typeUpper.includes('ER ')) {
      deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'ESCADA_ROLANTE');
    } else if (typeUpper.includes('ELEVADOR') || typeUpper.includes('ELV')) {
      deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'ELEVADOR');
    } else if (typeUpper.includes('BOMBA')) {
      deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'BOMBA');
    }
    // Chillers com override muitas vezes usam perfil de MOTOR
    else if (typeUpper.includes('CHILLER')) {
      deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'CHILLER');
      if (!deviceConfig)
        deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'MOTOR');
    }
    // Fancoil / HVAC
    else if (typeUpper.includes('FANCOIL'))
      deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'FANCOIL');
    else if (typeUpper.includes('HVAC'))
      deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'HVAC');
  }

  // 3. FALLBACK UNIVERSAL (CATCH-ALL)
  // Resolve Lojas ("102B", "L0L1"), Entradas ("TRAFO", "REDE") e qualquer outro desconhecido.
  if (!deviceConfig) {
    deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === '3F_MEDIDOR');
    // Se não tiver 3F_MEDIDOR (raro), tenta MOTOR como último recurso
    if (!deviceConfig) deviceConfig = telemetryConfig.itemsByDeviceType.find((i) => i.deviceType === 'MOTOR');
  }

  if (!deviceConfig) return null;

  // 4. Extrai os ranges
  const ranges = {
    standbyRange: { down: 0, up: 0 },
    normalRange: { down: 0, up: 0 },
    alertRange: { down: 0, up: 0 },
    failureRange: { down: 0, up: 0 },
  };

  if (deviceConfig.limitsByDeviceStatus) {
    deviceConfig.limitsByDeviceStatus.forEach((status) => {
      const vals = status.limitsValues || status.limitsVales || {};
      const baseValue = vals.baseValue ?? 0;
      const topValue = vals.topValue ?? 99999999;

      switch (status.deviceStatusName) {
        case 'standBy':
          ranges.standbyRange = { down: baseValue, up: topValue };
          break;
        case 'normal':
          ranges.normalRange = { down: baseValue, up: topValue };
          break;
        case 'alert':
          ranges.alertRange = { down: baseValue, up: topValue };
          break;
        case 'failure':
          ranges.failureRange = { down: baseValue, up: topValue };
          break;
      }
    });
  }

  return {
    ...ranges,
    source: 'json',
    metadata: {
      name: deviceConfig.name,
      matchedType: deviceConfig.deviceType,
    },
  };
}

let __deviceProfileSyncComplete = false;

async function fetchDeviceProfiles() {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('[RFC-0071] JWT token not found');

  const url = '/api/deviceProfile/names?activeOnly=true';

  console.log('[EQUIPMENTS] [RFC-0071] Fetching device profiles...');

  const response = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device profiles: ${response.status}`);
  }

  const profiles = await response.json();

  // Build Map: profileId -> profileName
  const profileMap = new Map();
  profiles.forEach((profile) => {
    const profileId = profile.id.id;
    const profileName = profile.name;
    profileMap.set(profileId, profileName);
  });

  console.log(
    `[EQUIPMENTS] [RFC-0071] Loaded ${profileMap.size} device profiles:`,
    Array.from(profileMap.entries())
      .map(([id, name]) => name)
      .join(', ')
  );

  return profileMap;
}

/**
 * Fetches device details including deviceProfileId
 * @param {string} deviceId - Device entity ID
 * @returns {Promise<Object>}
 */
async function fetchDeviceDetails(deviceId) {
  const token = localStorage.getItem('jwt_token');
  if (!token) throw new Error('[RFC-0071] JWT token not found');

  const url = `/api/device/${deviceId}`;

  const response = await fetch(url, {
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`[RFC-0071] Failed to fetch device ${deviceId}: ${response.status}`);
  }

  return await response.json();
}

/**
 * Saves deviceProfile as a server-scope attribute on the device
 * @param {string} deviceId - Device entity ID
 * @param {string} deviceProfile - Profile name (e.g., "MOTOR", "3F_MEDIDOR")
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function addDeviceProfileAttribute(deviceId, deviceProfile) {
  const t = Date.now();

  try {
    if (!deviceId) throw new Error('deviceId is required');
    if (deviceProfile == null || deviceProfile === '') {
      throw new Error('deviceProfile is required');
    }

    const token = localStorage.getItem('jwt_token');
    if (!token) throw new Error('jwt_token not found in localStorage');

    const url = `/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token}`,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ deviceProfile }),
    });

    const bodyText = await res.text().catch(() => '');

    if (!res.ok) {
      throw new Error(`[RFC-0071] HTTP ${res.status} ${res.statusText} - ${bodyText}`);
    }

    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // Response may not be JSON
    }

    const dt = Date.now() - t;
    console.log(
      `[EQUIPMENTS] [RFC-0071] ✅ Saved deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms`
    );

    return { ok: true, status: res.status, data };
  } catch (err) {
    const dt = Date.now() - t;
    console.error(
      `[EQUIPMENTS] [RFC-0071] ❌ Failed to save deviceProfile | device=${deviceId} | "${deviceProfile}" | ${dt}ms | error: ${
        err?.message || err
      }`
    );
    throw err;
  }
}

/**
 * Main synchronization function
 * Checks all devices and syncs missing deviceProfile attributes
 * @returns {Promise<{synced: number, skipped: number, errors: number}>}
 */
async function syncDeviceProfileAttributes() {
  console.log('[EQUIPMENTS] [RFC-0071] 🔄 Starting device profile synchronization...');

  try {
    // Step 1: Fetch all device profiles
    const profileMap = await fetchDeviceProfiles();

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Step 2: Build a map of devices that need sync
    const deviceMap = new Map();

    self.ctx.data.forEach((data) => {
      const entityId = data.datasource?.entity?.id?.id;
      const existingProfile = data.datasource?.deviceProfile;

      if (!entityId) return;

      // Skip if already has deviceProfile attribute
      if (existingProfile) {
        skipped++;
        return;
      }

      // Store for processing (deduplicate by entityId)
      if (!deviceMap.has(entityId)) {
        deviceMap.set(entityId, {
          entityLabel: data.datasource?.entityLabel,
          entityName: data.datasource?.entityName,
          name: data.datasource?.name,
        });
      }
    });

    console.log(`[EQUIPMENTS] [RFC-0071] Found ${deviceMap.size} devices without deviceProfile attribute`);
    console.log(`[EQUIPMENTS] [RFC-0071] Skipped ${skipped} devices that already have deviceProfile`);

    if (deviceMap.size === 0) {
      console.log('[EQUIPMENTS] [RFC-0071] ✅ All devices already synchronized!');
      return { synced: 0, skipped, errors: 0 };
    }

    // Step 3: Fetch device details and sync attributes
    let processed = 0;
    for (const [entityId, deviceInfo] of deviceMap) {
      processed++;
      const deviceLabel = deviceInfo.entityLabel || deviceInfo.entityName || deviceInfo.name || entityId;

      try {
        console.log(`[EQUIPMENTS] [RFC-0071] Processing ${processed}/${deviceMap.size}: ${deviceLabel}`);

        // Fetch device details to get deviceProfileId
        const deviceDetails = await fetchDeviceDetails(entityId);
        const deviceProfileId = deviceDetails.deviceProfileId?.id;

        if (!deviceProfileId) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Device ${deviceLabel} has no deviceProfileId`);
          errors++;
          continue;
        }

        // Look up profile name from map
        const profileName = profileMap.get(deviceProfileId);

        if (!profileName) {
          console.warn(`[EQUIPMENTS] [RFC-0071] ⚠️ Profile ID ${deviceProfileId} not found in map`);
          errors++;
          continue;
        }

        // Save attribute
        await addDeviceProfileAttribute(entityId, profileName);
        synced++;

        console.log(`[EQUIPMENTS] [RFC-0071] ✅ Synced ${deviceLabel} -> ${profileName}`);

        // Small delay to avoid overwhelming the API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[EQUIPMENTS] [RFC-0071] ❌ Failed to sync device ${deviceLabel}:`, error);
        errors++;
      }
    }

    console.log(
      `[EQUIPMENTS] [RFC-0071] 🎉 Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`
    );

    return { synced, skipped, errors };
  } catch (error) {
    console.error('[EQUIPMENTS] [RFC-0071] ❌ Fatal error during sync:', error);
    throw error;
  }
}

/**
 * Get telemetry data by dataKey name from self.ctx.data
 * @param {string} dataKeyName - The dataKey name to search for
 * @returns {*} The value of the data point, or null if not found
 */
function getData(dataKeyName) {
  if (!self?.ctx?.data) {
    LogHelper.warn('[getData] No ctx.data available');
    return null;
  }

  for (const device of self.ctx.data) {
    if (device.dataKey && device.dataKey.name === dataKeyName) {
      // Return the most recent value (last item in data array)
      if (device.data && device.data.length > 0) {
        const lastDataPoint = device.data[device.data.length - 1];
        return lastDataPoint[1]; // [timestamp, value]
      }
    }
  }

  LogHelper.warn(`[getData] DataKey "${dataKeyName}" not found in ctx.data`);
  return null;
}

/**
 * Get temperature offset for a specific device from ctx.data
 * Looks for a dataKey named "offSetTemperature" for the given device
 * @param {string} deviceId - The device TB ID to search for
 * @returns {number} The offset value (positive or negative), or 0 if not found
 */
function getTemperatureOffset(deviceId) {
  if (!self?.ctx?.data || !deviceId) {
    return 0;
  }

  for (const device of self.ctx.data) {
    const entityId = device.datasource?.entity?.id?.id;
    if (entityId === deviceId && device.dataKey?.name === 'offSetTemperature') {
      if (device.data && device.data.length > 0) {
        const lastDataPoint = device.data[device.data.length - 1];
        const offset = Number(lastDataPoint[1]) || 0;
        LogHelper.log(`[getTemperatureOffset] Found offset ${offset} for device ${deviceId}`);
        return offset;
      }
    }
  }

  return 0;
}

/**
 * Apply temperature offset to a value
 * @param {number} temperature - The original temperature value
 * @param {number} offset - The offset to apply (can be positive or negative)
 * @returns {number} The adjusted temperature
 */
function applyTemperatureOffset(temperature, offset) {
  if (offset === 0) return temperature;
  const adjusted = temperature + offset;
  LogHelper.log(`[applyTemperatureOffset] ${temperature} + ${offset} = ${adjusted}`);
  return adjusted;
}

let dateUpdateHandler = null;
let dataProvideHandler = null; // RFC-0042: Orchestrator data listener
//let DEVICE_TYPE = "energy";
let MyIO = null;

// RFC-0106: Map labelWidget to window.STATE group
// lojas = 'Lojas'
// entrada = 'Entrada'
// ocultos = 'Ocultos' (RFC-0142: archived/inactive devices)
// areacomum = everything else (Climatização, Elevadores, Escadas Rolantes, Área Comum, etc.)
function mapLabelWidgetToStateGroup(labelWidget) {
  if (!labelWidget) return null;
  const lw = labelWidget.toLowerCase().trim();
  if (lw === 'lojas') return 'lojas';
  if (lw === 'entrada') return 'entrada';
  // RFC-0142: Ocultos group for archived/inactive devices - should NOT be displayed
  if (lw === 'ocultos') return 'ocultos';
  // RFC-0107: Add caixadagua for water tanks
  if (lw === "caixa d'água" || lw === 'caixadagua' || lw === 'caixa dagua') return 'caixadagua';
  // Everything else maps to areacomum
  return 'areacomum';
}

// RFC-0106: Get items from window.STATE based on labelWidget
function getItemsFromState(domain, labelWidget) {
  // RFC-0106 FIX: Temperature domain ignores labelWidget filter - return all items directly
  // Temperature sensors don't use labelWidget categorization like energy does
  if (domain === 'temperature') {
    // First try window.STATE
    if (window.STATE?.isReady('temperature') && window.STATE.temperature?.items?.length > 0) {
      LogHelper.log(
        `[TELEMETRY] 🌡️ Temperature: returning ${window.STATE.temperature.items.length} items from window.STATE`
      );
      return window.STATE.temperature.items;
    }

    // Fallback to MyIOOrchestratorData - but validate customer first
    const orchestratorData = window.MyIOOrchestratorData;
    const currentCustomerId = window.MyIOUtils?.customerTB_ID;
    if (orchestratorData?.temperature?.items?.length > 0) {
      // HARD: Validate that cached data belongs to current customer
      const cachedPeriodKey = orchestratorData.temperature.periodKey || '';
      const cachedCustomerId = cachedPeriodKey.split(':')[0];
      if (currentCustomerId && cachedCustomerId && cachedCustomerId !== currentCustomerId) {
        LogHelper.warn(
          `[TELEMETRY] 🚫 MyIOOrchestratorData customer mismatch (cached: ${cachedCustomerId}, current: ${currentCustomerId}) - ignoring stale cache`
        );
        // Clear stale cache
        delete window.MyIOOrchestratorData.temperature;
      } else {
        LogHelper.log(
          `[TELEMETRY] 🌡️ Temperature: using MyIOOrchestratorData fallback (${orchestratorData.temperature.items.length} items)`
        );
        return orchestratorData.temperature.items;
      }
    }

    LogHelper.warn(`[TELEMETRY] 🌡️ Temperature: no items found in STATE or OrchestratorData`);
    return null;
  }

  if (!window.STATE?.isReady(domain)) {
    LogHelper.warn(`[TELEMETRY] window.STATE not ready for domain ${domain}`);
    return null;
  }

  const stateGroup = mapLabelWidgetToStateGroup(labelWidget);

  if (!stateGroup) {
    // No labelWidget filter - return all items
    LogHelper.log(`[TELEMETRY] No labelWidget filter - returning all items from _raw`);
    return window.STATE[domain]?._raw || [];
  }

  // For lojas, entrada, and caixadagua, return directly from STATE group
  if (stateGroup === 'lojas' || stateGroup === 'entrada' || stateGroup === 'caixadagua') {
    const groupData = window.STATE.get(domain, stateGroup);
    LogHelper.log(
      `[TELEMETRY] Getting items from STATE.${domain}.${stateGroup}: ${groupData?.count || 0} items`
    );
    return groupData?.items || [];
  }

  // For areacomum, we might need to filter further by labelWidget
  // since areacomum contains Climatização, Elevadores, Escadas Rolantes, Área Comum
  const areacomumData = window.STATE.get(domain, 'areacomum');
  if (!areacomumData) return [];

  // If labelWidget is specifically 'Área Comum' or 'areacomum', return all areacomum items
  const lwLower = labelWidget.toLowerCase().trim();
  if (lwLower === 'área comum' || lwLower === 'areacomum' || lwLower === 'area comum') {
    LogHelper.log(`[TELEMETRY] Getting all areacomum items: ${areacomumData.count} items`);
    return areacomumData.items;
  }

  // Otherwise, filter areacomum by specific labelWidget (Climatização, Elevadores, etc.)
  const filtered = areacomumData.items.filter((item) => {
    const itemLabel = (item.labelWidget || '').toLowerCase().trim();
    return itemLabel === lwLower;
  });

  LogHelper.log(`[TELEMETRY] Filtered areacomum by labelWidget="${labelWidget}": ${filtered.length} items`);
  return filtered;
}
let hasRequestedInitialData = false; // Flag to prevent duplicate initial requests
let lastProcessedPeriodKey = null; // Track last processed periodKey to prevent duplicate processing
let busyTimeoutId = null; // Timeout ID for busy fallback

// RFC-0042: Widget configuration (from settings)
let WIDGET_DOMAIN = 'energy'; // Will be set in onInit

// RFC-0152: Per-widget export key — isolates _deviceDataExport per TELEMETRY instance
// Set in onInit after WIDGET_DOMAIN + labelWidget are known.
// Pattern: _deviceDataExport_{domain}_{group} (e.g. _deviceDataExport_energy_lojas)
let _exportKey = '_deviceDataExport';

// RFC-0063: Classification mode configuration
let USE_IDENTIFIER_CLASSIFICATION = false; // Flag to enable identifier-based classification
let USE_HYBRID_CLASSIFICATION = false; // Flag to enable hybrid mode (identifier + labels)

/** ===================== STATE ===================== **/
let CLIENT_ID = '';
let CLIENT_SECRET = '';
let CUSTOMER_ING_ID = '';
let MyIOAuth = null;

const STATE = {
  itemsBase: [], // lista autoritativa (TB)
  itemsEnriched: [], // lista com totals + perc
  lastVisible: [], // último lote filtrado visível (para export)
  searchActive: false,
  searchTerm: '',
  selectedIds: /** @type {Set<string> | null} */ (null),
  sortMode: /** @type {'cons_desc'|'cons_asc'|'alpha_asc'|'alpha_desc'} */ ('cons_desc'),
  /** @type {'ativado'|'desativado'|'apenas_ativados'} */
  alarmFilter: 'ativado',
  firstHydrates: 0,
};

let hydrating = false;

/** ===================== HELPERS (DOM) ===================== **/
const $root = () => $(self.ctx.$container[0]);
const $list = () => $root().find('#shopsList');
const $count = () => $root().find('#shopsCount');
const $total = () => $root().find('#shopsTotal');
// Direct reference set during onInit (before portal). Always valid regardless of TB isolation.
let _filterModalElement = null;
// RFC-0195: Sync GCDR modal element and polling interval ref (for cleanup on destroy)
let _syncJobModalEl = null;
let _syncJobPollingId = null;
const $modal = () => $(_filterModalElement || $root()[0].querySelector('#filterModal'));

/** ===================== BUSY MODAL (no widget) ===================== **/
const BUSY_ID = 'myio-busy-modal';
function ensureBusyModalDOM() {
  let $m = $root().find(`#${BUSY_ID}`);
  if ($m.length) return $m;

  const html = `
  <div id="${BUSY_ID}" style="
      position:absolute; inset:0; display:none;
      background: rgba(150,132,181,0.45); /* #9684B5 com transparência */
      backdrop-filter: blur(5px);
      z-index:9999; align-items:center; justify-content:center;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;">
    <div style="
        background:#2d1458; color:#fff;
        border:1px solid rgba(255,255,255,0.10);
        box-shadow:0 12px 40px rgba(0,0,0,.35);
        border-radius:18px; padding:22px 26px; min-width:320px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="spinner" style="
            width:22px;height:22px;border-radius:50%;
            border:3px solid rgba(255,255,255,.25);
            border-top-color:#ffffff; animation:spin .9s linear infinite;"></div>
        <div id="${BUSY_ID}-msg" style="font-weight:600; font-size:14px; letter-spacing:.2px;">
          aguarde.. carregando os dados...
        </div>
      </div>
    </div>
  </div>
  <style>
    @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  </style>`;
  $root().css('position', 'relative'); // garante overlay correto
  $root().append(html);
  return $root().find(`#${BUSY_ID}`);
}
// RFC-0044: Use centralized busy management
function showBusy(message, timeoutMs = 35000) {
  LogHelper.log(`[TELEMETRY] 🔄 showBusy() called with message: "${message || 'default'}"`);

  // Prevent multiple simultaneous busy calls
  if (window.busyInProgress) {
    LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate showBusy() call`);
    return;
  }

  window.busyInProgress = true;

  // Centralized busy with enhanced synchronization
  const safeShowBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.showGlobalBusy === 'function') {
        const text = (message && String(message).trim()) || 'Carregando dados...';
        //window.MyIOOrchestrator.showGlobalBusy(WIDGET_DOMAIN, text, timeoutMs);
        LogHelper.log(`[TELEMETRY] ✅ Using centralized busy for domain: ${WIDGET_DOMAIN}`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback busy`);
        const $m = ensureBusyModalDOM();
        const text = (message && String(message).trim()) || 'aguarde.. carregando os dados...';
        $m.find(`#${BUSY_ID}-msg`).text(text);
        $m.css('display', 'flex');
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY] ❌ Error in showBusy:`, err);
    } finally {
      // Always reset busy flag after a short delay
      setTimeout(() => {
        window.busyInProgress = false;
      }, 500);
    }
  };

  // RFC-0051.3: Check if orchestrator exists and is ready
  const checkOrchestratorReady = async () => {
    // First, check if orchestrator exists and is ready
    if (window.MyIOOrchestrator?.isReady) {
      safeShowBusy();
      return;
    }

    // Wait for orchestrator ready event (with timeout)
    const ready = await new Promise((resolve) => {
      let timeout;
      let interval;

      // Listen for ready event
      const handler = () => {
        clearTimeout(timeout);
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        resolve(true);
      };

      window.addEventListener('myio:orchestrator:ready', handler);

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        LogHelper.warn('[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback');
        resolve(false);
      }, 5000);

      // Also poll isReady flag (fallback if event is missed)
      interval = setInterval(() => {
        if (window.MyIOOrchestrator?.isReady) {
          clearInterval(interval);
          clearTimeout(timeout);
          window.removeEventListener('myio:orchestrator:ready', handler);
          resolve(true);
        }
      }, 100);
    });

    safeShowBusy();
  };

  checkOrchestratorReady();
}

function hideBusy() {
  LogHelper.log(`[TELEMETRY] ⏸️ hideBusy() called`);

  const safeHideBusy = () => {
    try {
      if (window.MyIOOrchestrator && typeof window.MyIOOrchestrator.hideGlobalBusy === 'function') {
        window.MyIOOrchestrator.hideGlobalBusy();
        LogHelper.log(`[TELEMETRY] ✅ Using centralized hideBusy`);
      } else {
        LogHelper.warn(`[TELEMETRY] ⚠️ Orchestrator not available, using fallback hideBusy`);
        $root().find(`#${BUSY_ID}`).css('display', 'none');
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY] ❌ Error in hideBusy:`, err);
    } finally {
      window.busyInProgress = false;
    }
  };

  // RFC-0051.3: Check if orchestrator exists and is ready
  const checkOrchestratorReady = async () => {
    // First, check if orchestrator exists and is ready
    if (window.MyIOOrchestrator?.isReady) {
      safeHideBusy();
      return;
    }

    // Wait for orchestrator ready event (with timeout)
    const ready = await new Promise((resolve) => {
      let timeout;
      let interval;

      // Listen for ready event
      const handler = () => {
        clearTimeout(timeout);
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        resolve(true);
      };

      window.addEventListener('myio:orchestrator:ready', handler);

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        clearInterval(interval);
        window.removeEventListener('myio:orchestrator:ready', handler);
        LogHelper.warn('[TELEMETRY] ⚠️ Orchestrator ready timeout after 5s, using fallback');
        resolve(false);
      }, 5000);

      // Also poll isReady flag (fallback if event is missed)
      interval = setInterval(() => {
        if (window.MyIOOrchestrator?.isReady) {
          clearInterval(interval);
          clearTimeout(timeout);
          window.removeEventListener('myio:orchestrator:ready', handler);
          resolve(true);
        }
      }, 100);
    });

    safeHideBusy();
  };

  checkOrchestratorReady();
}

const findValue = (values, dataType, defaultValue = 'N/D') => {
  const item = values.find((v) => v.dataType === dataType);
  if (!item) return defaultValue;
  // Retorna a propriedade 'val' (da nossa API) ou 'value' (do ThingsBoard)
  return item.val !== undefined ? item.val : item.value;
};

/** ===================== GLOBAL SUCCESS MODAL (fora do widget) ===================== **/
const G_SUCCESS_ID = 'myio-global-success-modal';
let gSuccessTimer = null;

function ensureGlobalSuccessModalDOM() {
  let el = document.getElementById(G_SUCCESS_ID);
  if (el) return el;

  const wrapper = document.createElement('div');
  wrapper.id = G_SUCCESS_ID;
  wrapper.setAttribute(
    'style',
    `
    position: fixed; inset: 0; display: none;
    z-index: 999999; 
    background: rgba(150,132,181,0.45); /* #9684B5 com transparência */
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  `
  );

  // container central
  const center = document.createElement('div');
  center.setAttribute(
    'style',
    `
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: #2d1458; color: #fff;
    border-radius: 20px; padding: 26px 30px; min-width: 360px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 14px 44px rgba(0,0,0,.35);
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
    text-align: center;
  `
  );

  const icon = document.createElement('div');
  icon.innerHTML = `
    <div style="
      width:56px;height:56px;margin:0 auto 10px auto;border-radius:50%;
      background: rgba(255,255,255,.12); display:flex;align-items:center;justify-content:center;
      ">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17L4 12" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

  const title = document.createElement('div');
  title.id = `${G_SUCCESS_ID}-title`;
  title.textContent = 'os dados foram salvos com sucesso';
  title.setAttribute('style', `font-size:16px;font-weight:700;letter-spacing:.2px;margin-bottom:6px;`);

  const sub = document.createElement('div');
  sub.id = `${G_SUCCESS_ID}-sub`;
  sub.innerHTML = `recarregando em <b id="${G_SUCCESS_ID}-count">6</b>s...`;
  sub.setAttribute('style', `opacity:.9;font-size:13px;`);

  center.appendChild(icon);
  center.appendChild(title);
  center.appendChild(sub);
  wrapper.appendChild(center);
  document.body.appendChild(wrapper);
  return wrapper;
}

function showGlobalSuccessModal(seconds = 6) {
  const el = ensureGlobalSuccessModalDOM();
  // reset contador
  const countEl = el.querySelector(`#${G_SUCCESS_ID}-count`);
  if (countEl) countEl.textContent = String(seconds);

  el.style.display = 'block';

  if (gSuccessTimer) {
    clearInterval(gSuccessTimer);
    gSuccessTimer = null;
  }

  let left = seconds;
  gSuccessTimer = setInterval(() => {
    left -= 1;
    if (countEl) countEl.textContent = String(left);
    if (left <= 0) {
      clearInterval(gSuccessTimer);
      gSuccessTimer = null;
      try {
        window.location.reload();
      } catch {
        // Reload may fail in restricted contexts (iframe, etc.)
      }
    }
  }, 1000);
}

function hideGlobalSuccessModal() {
  const el = document.getElementById(G_SUCCESS_ID);
  if (el) el.style.display = 'none';
  if (gSuccessTimer) {
    clearInterval(gSuccessTimer);
    gSuccessTimer = null;
  }
}

/** ===================== UTILS ===================== **/
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isValidUUID(v) {
  if (!v || typeof v !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function toSpOffsetNoMs(dt, endOfDay = false) {
  const d = typeof dt === 'number' ? new Date(dt) : dt instanceof Date ? dt : new Date(String(dt));
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0'
  )}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
    d.getSeconds()
  ).padStart(2, '0')}-03:00`;
}

function mustGetDateRange() {
  const s = self.ctx?.scope?.startDateISO;
  const e = self.ctx?.scope?.endDateISO;
  if (s && e) return { startISO: s, endISO: e };
  throw new Error('DATE_RANGE_REQUIRED');
}

const isAuthReady = () => !!(MyIOAuth && typeof MyIOAuth.getToken === 'function');

async function ensureAuthReady(maxMs = 6000, stepMs = 150) {
  const start = Date.now();
  while (!isAuthReady()) {
    if (Date.now() - start > maxMs) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return true;
}

function buildTbIdIndexes() {
  const byIdentifier = new Map(); // identifier -> tbId
  const byIngestion = new Map(); // ingestionId -> tbId
  const rows = Array.isArray(self.ctx?.data) ? self.ctx.data : [];

  for (const row of rows) {
    const key = String(row?.dataKey?.name || '').toLowerCase();
    const tbId = row?.datasource?.entityId?.id || row?.datasource?.entityId || null;
    const val = row?.data?.[0]?.[1];

    if (!tbId || val == null) continue;

    if (key === 'identifier') byIdentifier.set(String(val), tbId);
    if (key === 'ingestionid') byIngestion.set(String(val), tbId);
  }
  return { byIdentifier, byIngestion };
}

/** ===================== FILTERS / SORT / PERC ===================== **/
function applyFilters(enriched, searchTerm, selectedIds, sortMode, alarmFilter) {
  let v = enriched.slice();

  if (selectedIds && selectedIds.size) {
    v = v.filter((x) => selectedIds.has(x.id));
  }

  // Alarm filter: 'apenas_ativados' → show only cards with active alarms
  if (alarmFilter === 'apenas_ativados') {
    const aso = window.AlarmServiceOrchestrator;
    if (aso) {
      v = v.filter((x) => x.gcdrDeviceId && aso.getAlarmCountForDevice(x.gcdrDeviceId) > 0);
    }
  }

  const q = (searchTerm || '').trim().toLowerCase();
  if (q) {
    v = v.filter(
      (x) =>
        (x.label || '').toLowerCase().includes(q) ||
        String(x.identifier || '')
          .toLowerCase()
          .includes(q)
    );
  }

  v.sort((a, b) => {
    if (sortMode === 'cons_desc') {
      if (a.value !== b.value) return b.value - a.value;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      });
    }
    if (sortMode === 'cons_asc') {
      if (a.value !== b.value) return a.value - b.value;
      return (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      });
    }
    if (sortMode === 'alpha_desc') {
      return (
        (b.label || '').localeCompare(a.label || '', 'pt-BR', {
          sensitivity: 'base',
        }) || b.value - a.value
      );
    }
    return (
      (a.label || '').localeCompare(b.label || '', 'pt-BR', {
        sensitivity: 'base',
      }) || a.value - b.value
    );
  });

  return v;
}

function recomputePercentages(visible) {
  const groupSum = visible.reduce((acc, x) => acc + (x.value || 0), 0);
  const updated = visible.map((x) => ({
    ...x,
    perc: groupSum > 0 ? (x.value / groupSum) * 100 : 0,
  }));
  return { visible: updated, groupSum };
}

/** ===================== TEMPERATURE INFO TOOLTIP ===================== **/
// Now uses TempSensorSummaryTooltip from myio-js-library (premium tooltip with drag, pin, maximize, close)

/**
 * Build temperature sensor data for the TempSensorSummaryTooltip
 * @returns {Object} Data object for TempSensorSummaryTooltip.show()
 */
function buildTempSensorSummaryData() {
  const tempMin = window.MyIOUtils?.temperatureLimits?.minTemperature;
  const tempMax = window.MyIOUtils?.temperatureLimits?.maxTemperature;
  const hasLimits = tempMin != null && tempMax != null;

  const devices = [];

  if (window._telemetryAuthoritativeItems) {
    window._telemetryAuthoritativeItems.forEach((item) => {
      // Skip offline devices - only count active sensors
      const isOffline =
        item.deviceStatus === 'power_off' ||
        item.deviceStatus === 'offline' ||
        item.deviceStatus === 'no_info';
      if (isOffline) {
        return; // Skip this device
      }

      const temp = Number(item.value) || 0;

      let status = 'unknown';
      if (hasLimits) {
        status = temp >= tempMin && temp <= tempMax ? 'ok' : 'warn';
      }

      devices.push({
        name: item.label || item.identifier || 'Sensor',
        temp: temp,
        status: status,
      });
    });
  }

  return {
    devices,
    temperatureMin: tempMin,
    temperatureMax: tempMax,
    title: 'Detalhes de Temperatura',
  };
}

// Cleanup function for tooltip (stored globally for widget destroy)
let _tempTooltipCleanup = null;

// ============================================
// LEGACY CODE BELOW - DEPRECATED (kept for reference)
// Use MyIO.TempSensorSummaryTooltip instead
// ============================================

const TEMP_INFO_TOOLTIP_CSS_LEGACY = `
  .temp-info-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
    border: 1px solid #fdba74;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-right: 8px;
    flex-shrink: 0;
  }
  .temp-info-trigger:hover {
    background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(251, 146, 60, 0.3);
  }
  .temp-info-trigger svg {
    color: #c2410c;
  }
  .temp-info-tooltip-container {
    position: fixed;
    z-index: 99999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.25s ease;
    transform: translateY(5px);
  }
  .temp-info-tooltip-container.visible {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }
  .temp-info-tooltip {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.08);
    min-width: 320px;
    max-width: 400px;
    font-size: 12px;
    color: #1e293b;
    overflow: hidden;
    font-family: Inter, system-ui, -apple-system, sans-serif;
  }
  .temp-info-tooltip__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 18px;
    background: linear-gradient(90deg, #fff7ed 0%, #fef3c7 100%);
    border-bottom: 1px solid #fed7aa;
  }
  .temp-info-tooltip__icon { font-size: 18px; }
  .temp-info-tooltip__title {
    font-weight: 700;
    font-size: 14px;
    color: #c2410c;
    letter-spacing: 0.3px;
  }
  .temp-info-tooltip__content {
    padding: 16px 18px;
    max-height: 500px;
    overflow-y: auto;
  }
  .temp-info-tooltip__section {
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
  }
  .temp-info-tooltip__section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  .temp-info-tooltip__section-title {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .temp-info-tooltip__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    gap: 12px;
  }
  .temp-info-tooltip__label {
    color: #64748b;
    font-size: 12px;
    flex-shrink: 0;
  }
  .temp-info-tooltip__value {
    color: #1e293b;
    font-weight: 600;
    text-align: right;
  }
  .temp-info-tooltip__value--highlight {
    color: #ea580c;
    font-weight: 700;
    font-size: 14px;
  }
  .temp-info-tooltip__badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }
  .temp-info-tooltip__badge--ok {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #bbf7d0;
  }
  .temp-info-tooltip__badge--warn {
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
  }
  .temp-info-tooltip__badge--info {
    background: #e0e7ff;
    color: #4338ca;
    border: 1px solid #c7d2fe;
  }
  .temp-info-tooltip__list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }
  .temp-info-tooltip__list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: #f8fafc;
    border-radius: 6px;
    font-size: 11px;
  }
  .temp-info-tooltip__list-item--ok { border-left: 3px solid #22c55e; background: #f0fdf4; }
  .temp-info-tooltip__list-item--warn { border-left: 3px solid #f59e0b; background: #fffbeb; }
  .temp-info-tooltip__list-item--unknown { border-left: 3px solid #6b7280; background: #f3f4f6; }
  .temp-info-tooltip__list-icon { font-size: 12px; flex-shrink: 0; }
  .temp-info-tooltip__list-name { flex: 1; color: #334155; font-weight: 500; }
  .temp-info-tooltip__list-value { color: #475569; font-size: 11px; font-weight: 500; }
  .temp-info-tooltip__list-range { color: #94a3b8; font-size: 10px; }
  .temp-info-tooltip__notice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    margin-top: 12px;
  }
  .temp-info-tooltip__notice-icon { font-size: 14px; flex-shrink: 0; }
  .temp-info-tooltip__notice-text { font-size: 10px; color: #1e40af; line-height: 1.5; }
`;

function ensureTempInfoTooltipCSS() {
  if (document.getElementById('temp-info-tooltip-styles')) return;
  const style = document.createElement('style');
  style.id = 'temp-info-tooltip-styles';
  style.textContent = TEMP_INFO_TOOLTIP_CSS;
  document.head.appendChild(style);
}

function createTempInfoTooltipContainer() {
  const existing = document.getElementById('temp-info-tooltip');
  if (existing) return existing;

  ensureTempInfoTooltipCSS();

  const container = document.createElement('div');
  container.id = 'temp-info-tooltip';
  container.className = 'temp-info-tooltip-container';
  document.body.appendChild(container);
  return container;
}

function showTempInfoTooltip(triggerElement) {
  const container = createTempInfoTooltipContainer();

  // Get temperature data from current visible items
  const tempMin = window.MyIOUtils?.temperatureLimits?.minTemperature;
  const tempMax = window.MyIOUtils?.temperatureLimits?.maxTemperature;
  const hasLimits = tempMin != null && tempMax != null;

  // Collect data from authoritativeItems (already filtered for TERMOSTATO)
  const tempDevices = [];
  let totalTemp = 0;
  let devicesInRange = 0;
  let devicesOutOfRange = 0;
  let devicesUnknown = 0;

  if (window._telemetryAuthoritativeItems) {
    window._telemetryAuthoritativeItems.forEach((item) => {
      if (item.deviceType === 'TERMOSTATO') {
        const temp = Number(item.value) || 0;
        totalTemp += temp;

        let status = 'unknown';
        if (hasLimits) {
          if (temp >= tempMin && temp <= tempMax) {
            status = 'ok';
            devicesInRange++;
          } else {
            status = 'warn';
            devicesOutOfRange++;
          }
        } else {
          devicesUnknown++;
        }

        tempDevices.push({
          name: item.label || item.identifier || 'Sensor',
          temp: temp,
          status: status,
        });
      }
    });
  }

  const avgTemp = tempDevices.length > 0 ? totalTemp / tempDevices.length : 0;

  // Build status badge
  let statusBadge = '';
  if (tempDevices.length === 0) {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--info">Aguardando dados</span>';
  } else if (!hasLimits) {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--info">Faixa nao configurada</span>';
  } else if (devicesOutOfRange === 0) {
    statusBadge = '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--ok">Todos na faixa</span>';
  } else if (devicesInRange === 0) {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--warn">Todos fora da faixa</span>';
  } else {
    statusBadge =
      '<span class="temp-info-tooltip__badge temp-info-tooltip__badge--warn">' +
      devicesOutOfRange +
      ' fora da faixa</span>';
  }

  // Build device list HTML
  let deviceListHtml = '';
  if (tempDevices.length > 0 && 3 > 2) {
    const sortedDevices = [...tempDevices].sort((a, b) => b.temp - a.temp);
    const displayDevices = sortedDevices.slice(0, 5); // Show max 8
    const hasMore = sortedDevices.length > 5;

    deviceListHtml = `
      <div class="temp-info-tooltip__section">
        <div class="temp-info-tooltip__section-title">
          <span>🌡️</span> Sensores (${tempDevices.length})
        </div>
        <div class="temp-info-tooltip__list">
          ${displayDevices
            .map((d) => {
              const statusClass = d.status === 'ok' ? 'ok' : d.status === 'warn' ? 'warn' : 'unknown';
              const icon = d.status === 'ok' ? '✔' : d.status === 'warn' ? '⚠' : '?';
              return `
              <div class="temp-info-tooltip__list-item temp-info-tooltip__list-item--${statusClass}">
                <span class="temp-info-tooltip__list-icon">${icon}</span>
                <span class="temp-info-tooltip__list-name">${d.name}</span>
                <span class="temp-info-tooltip__list-value">${d.temp.toFixed(1)}°C</span>
              </div>
            `;
            })
            .join('')}
          ${
            hasMore
              ? `<div style="text-align: center; color: #94a3b8; font-size: 10px; padding: 4px;">... e mais ${
                  sortedDevices.length - 5
                } sensores</div>`
              : ''
          }
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="temp-info-tooltip">
      <div class="temp-info-tooltip__header">
        <span class="temp-info-tooltip__icon">🌡️</span>
        <span class="temp-info-tooltip__title">Detalhes de Temperatura</span>
      </div>
      <div class="temp-info-tooltip__content">
        <div class="temp-info-tooltip__section">
          <div class="temp-info-tooltip__section-title">
            <span>📊</span> Resumo
          </div>
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Media Geral:</span>
            <span class="temp-info-tooltip__value temp-info-tooltip__value--highlight">${avgTemp.toFixed(
              1
            )}°C</span>
          </div>
          ${
            hasLimits
              ? `
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Faixa Ideal:</span>
            <span class="temp-info-tooltip__value">${tempMin}°C - ${tempMax}°C</span>
          </div>
          `
              : ''
          }
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Sensores Ativos:</span>
            <span class="temp-info-tooltip__value">${tempDevices.length}</span>
          </div>
          <div class="temp-info-tooltip__row">
            <span class="temp-info-tooltip__label">Status:</span>
            ${statusBadge}
          </div>
        </div>

        ${deviceListHtml}

        <div class="temp-info-tooltip__notice">
          <span class="temp-info-tooltip__notice-icon">ℹ️</span>
          <span class="temp-info-tooltip__notice-text">
            Considerados apenas sensores <strong>TERMOSTATO</strong> ativos.
          </span>
        </div>
      </div>
    </div>
  `;

  // Position tooltip
  const rect = triggerElement.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 8;

  // Adjust if goes off screen
  if (left + 340 > window.innerWidth - 10) left = window.innerWidth - 350;
  if (left < 10) left = 10;
  if (top + 400 > window.innerHeight) {
    top = rect.top - 8 - 400;
    if (top < 10) top = 10;
  }

  container.style.left = left + 'px';
  container.style.top = top + 'px';
  container.classList.add('visible');
}

function hideTempInfoTooltip() {
  const container = document.getElementById('temp-info-tooltip');
  if (container) {
    container.classList.remove('visible');
  }
}

/** ===================== RENDER ===================== **/
function renderHeader(count, groupSum) {
  $count().text(`(${count})`);

  // RFC-0108: Format based on widget domain using MyIOUtils measurement settings
  let formattedTotal = groupSum.toFixed(2);
  if (WIDGET_DOMAIN === 'energy') {
    // Use MyIOUtils formatting if available, fallback to legacy
    formattedTotal = window.MyIOUtils?.formatEnergyWithSettings
      ? window.MyIOUtils.formatEnergyWithSettings(groupSum)
      : MyIO.formatEnergy(groupSum);
  } else if (WIDGET_DOMAIN === 'water') {
    // Use MyIOUtils formatting if available, fallback to legacy
    formattedTotal = window.MyIOUtils?.formatWaterWithSettings
      ? window.MyIOUtils.formatWaterWithSettings(groupSum)
      : MyIO.formatWaterVolumeM3(groupSum);
  } else if (WIDGET_DOMAIN === 'tank') {
    formattedTotal = MyIO.formatTankHeadFromCm(groupSum);
  } else if (WIDGET_DOMAIN === 'temperature') {
    // For temperature, show count instead of sum (summing temperatures doesn't make sense)
    formattedTotal = `${count} sensor${count !== 1 ? 'es' : ''}`;
  }

  $total().text(formattedTotal);
}

function renderList(visible) {
  const $ul = $list().empty();
  // RFC-0152: Reset per-render device data export buffer
  window[_exportKey] = [];

  // Calculate average temperature for all temperature devices (for TempComparisonTooltip)
  // Only count active sensors, exclude offline devices
  let avgTemperature = null;
  let tempDeviceCount = 0;
  if (WIDGET_DOMAIN === 'temperature') {
    let totalTemp = 0;
    visible.forEach((item) => {
      // Skip offline devices
      const isOffline =
        item.deviceStatus === 'power_off' ||
        item.deviceStatus === 'offline' ||
        item.deviceStatus === 'no_info';
      if (!isOffline) {
        totalTemp += Number(item.value || 0);
        tempDeviceCount++;
      }
    });
    if (tempDeviceCount > 0) {
      avgTemperature = totalTemp / tempDeviceCount;
    }
  }

  visible.forEach((it) => {
    // For temperature domain, render all temperature-related devices
    // (deviceType can be TERMOSTATO, SENSOR_TEMP, or other temperature sensor types)
    // No filtering needed - temperature domain items are already filtered by orchestrator

    const valNum = Number(it.value || 0);

    // Note: deviceStatus comes from buildAuthoritativeItems (based on TB connectionStatus + telemetry)
    // Don't recalculate here - it would be incorrect for ENERGY devices

    // RFC-0097: Safe identifier handling with fallbacks using centralized function
    let deviceIdentifierToDisplay = 'N/A';
    if (it.identifier && !String(it.identifier).includes('Sem Identificador identificado')) {
      // Valid identifier attribute
      deviceIdentifierToDisplay = it.identifier;
    } else {
      // No valid identifier - infer from deviceType or label
      deviceIdentifierToDisplay = inferDisplayIdentifier(it);
    }

    // RFC-0106: Use effectiveDeviceType for card icon (deviceProfile > deviceType)
    // This ensures proper icon rendering based on actual device classification
    const cardDeviceType = it.effectiveDeviceType || it.deviceProfile || it.deviceType || 'N/A';

    const entityObject = {
      entityId: it.tbId || it.id, // preferir TB deviceId
      labelOrName: it.label.toUpperCase(),
      deviceType: cardDeviceType, // RFC-0106: Use effectiveDeviceType for proper icon
      val: valNum, // TODO verificar ESSE MULTIPLICADOR PQ PRECISA DELE ?
      perc: it.perc ?? 0,
      deviceStatus: it.deviceStatus || 'no_info', // Use from buildAuthoritativeItems (based on TB connectionStatus + telemetry)
      entityType: 'DEVICE',
      deviceIdentifier: deviceIdentifierToDisplay,
      slaveId: it.slaveId || 'N/A',
      ingestionId: it.ingestionId || 'N/A',
      centralId: it.centralId || 'N/A',
      centralName: it.centralName || '',
      customerName: it.customerName || null,
      updatedIdentifiers: it.updatedIdentifiers || {},
      // Connection timing fields (for Settings modal)
      connectionStatusTime: it.connectionStatusTime || it.lastConnectTime || null,
      timeVal: it.timeVal || it.lastActivityTime || null,
      lastDisconnectTime: it.lastDisconnectTime || null,
      powerRanges: it.powerRanges || null,
      instantaneousPower: it.instantaneousPower || 0,
      // Power limits for Settings modal
      mapInstantaneousPower: it.mapInstantaneousPower || null,
      deviceMapInstaneousPower: it.deviceMapInstaneousPower || null,
      // TANK/CAIXA_DAGUA specific fields
      waterLevel: it.waterLevel || null,
      waterPercentage: it.waterPercentage || null,
      // TERMOSTATO specific fields
      temperature: it.temperature || null,
      temperatureMin: it.temperatureMin || null,
      temperatureMax: it.temperatureMax || null,
      temperatureStatus: it.temperatureStatus || null,
      // Average temperature across all TERMOSTATO devices (for TempComparisonTooltip)
      averageTemperature: avgTemperature,
      temperatureDeviceCount: tempDeviceCount,
      log_annotations: it.log_annotations || null,
    };

    // DEBUG: Investigate why "Burguer king" card is rendering as offline
    if (it.label?.toUpperCase().includes('HEMOPA') || it.name?.includes('HIDR. SCMP110A')) {
      LogHelper.log('[DEBUG HIDR. SCMP110A] Raw item data:', {
        label: it.label,
        name: it.name,
        connectionStatus: it.connectionStatus,
        deviceStatus: it.deviceStatus,
        lastActivityTime: it.lastActivityTime,
        lastConnectTime: it.lastConnectTime,
        lastDisconnectTime: it.lastDisconnectTime,
        connectionStatusTime: it.connectionStatusTime,
        consumption: it.consumption,
        val: valNum,
        timeVal: it.timeVal,
      });
      LogHelper.log('[DEBUG HIDR. SCMP110A] entityObject.deviceStatus:', entityObject.deviceStatus);
    }

    const myTbToken = localStorage.getItem('jwt_token');
    let cachedIngestionToken = null;

    // RFC-0082 FIX: Check if MyIOAuth is initialized before calling getToken()
    if (MyIOAuth && typeof MyIOAuth.getToken === 'function') {
      MyIOAuth.getToken()
        .then((token) => {
          cachedIngestionToken = token;
        })
        .catch((err) => LogHelper.warn('Token cache failed:', err));
    } else {
      LogHelper.warn('[TELEMETRY] MyIOAuth not initialized yet, skipping token cache');
    }

    const $card = MyIO.renderCardComponentV5({
      entityObject,
      useNewComponents: true, // Habilitar novos componentes
      enableSelection: true, // Habilitar seleção
      enableDragDrop: true, // Habilitar drag and drop
      // RFC-0130: Disable all tooltips for now
      showEnergyRangeTooltip: false,
      showPercentageTooltip: false,
      showTempComparisonTooltip: false,
      showTempRangeTooltip: false,

      handleActionDashboard: async () => {
        const jwtToken = localStorage.getItem('jwt_token');
        const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;

        if (!jwtToken) {
          if (MyIOToast) {
            MyIOToast.error('Authentication required. Please login again.');
          } else {
            alert('Authentication required. Please login again.');
          }
          return;
        }

        // Get dates from MENU (startDateISO/endDateISO) and convert to timestamps
        const startDateISO = self.ctx?.scope?.startDateISO;
        const endDateISO = self.ctx?.scope?.endDateISO;
        const startTs = startDateISO ? new Date(startDateISO).getTime() : Date.now() - 86400000;
        const endTs = endDateISO ? new Date(endDateISO).getTime() : Date.now();
        const deviceType = it.deviceType || entityObject.deviceType;
        const isWaterTank = deviceType === 'TANK' || deviceType === 'CAIXA_DAGUA';
        const isTermostato = deviceType === 'TERMOSTATO';

        LogHelper.log(
          '[TELEMETRY v5] Opening dashboard for deviceType:',
          deviceType,
          'isWaterTank:',
          isWaterTank,
          'isTermostato:',
          isTermostato,
          'deviceId:',
          it.id,
          'tbId:',
          it.tbId,
          'startDateISO:',
          startDateISO,
          'endDateISO:',
          endDateISO,
          'startTs:',
          startTs,
          'endTs:',
          endTs
        );

        // Show loading toast
        let loadingToast = null;
        if (MyIOToast) {
          const loadingMsg = isTermostato
            ? 'Carregando dados de temperatura...'
            : isWaterTank
              ? 'Loading water tank data...'
              : 'Loading energy data...';
          loadingToast = MyIOToast.info(loadingMsg, 0);
        }

        try {
          if (isTermostato) {
            // Temperature/TERMOSTATO Modal Path - RFC-0085
            // Uses MyIOLibrary.openTemperatureModal instead of inline implementation
            LogHelper.log('[TELEMETRY v5] Entering TERMOSTATO device modal path (MyIOLibrary)...');

            const deviceId = it.tbId || it.id;

            // Get temperature-related properties from entity
            // Priority: device attributes > entity attributes > global customer limits (MyIOUtils)
            const currentTemp = it.temperature || entityObject.temperature;
            const tempMinRange =
              it.temperatureMin ??
              it.minTemperature ??
              entityObject.temperatureMin ??
              entityObject.minTemperature ??
              window.MyIOUtils?.temperatureLimits?.minTemperature ??
              null;
            const tempMaxRange =
              it.temperatureMax ??
              it.maxTemperature ??
              entityObject.temperatureMax ??
              entityObject.maxTemperature ??
              window.MyIOUtils?.temperatureLimits?.maxTemperature ??
              null;
            const tempStatus = it.temperatureStatus || entityObject.temperatureStatus;

            LogHelper.log('[TELEMETRY v5] Temperature range from entity/scope:', {
              tempMinRange,
              tempMaxRange,
            });

            // Check if MyIOLibrary.openTemperatureModal is available
            if (typeof MyIOLibrary?.openTemperatureModal !== 'function') {
              const errorMsg = 'Temperature modal not available. Please update MyIO library.';
              LogHelper.error('[TELEMETRY v5] ❌', errorMsg);
              throw new Error(errorMsg);
            }

            // Convert timestamps to ISO strings
            const startDateISO = new Date(startTs).toISOString();
            const endDateISO = new Date(endTs).toISOString();

            // RFC-0189: Build custom dataFetcher when ingestion API is enabled and device has ingestionId
            const ingestionId = it.ingestionId || null;
            const useIngestionApi = !!(window.MyIOUtils?.enableTemperatureApiDataFetch && ingestionId);
            let ingestionDataFetcher = null;

            if (useIngestionApi) {
              try {
                const creds = window.MyIOOrchestrator?.getCredentials?.();
                if (!creds?.CLIENT_ID || !creds?.CLIENT_SECRET) {
                  throw new Error('Missing credentials for ingestion API');
                }
                const dataApiHost = window.MyIOUtils?.getDataApiHost?.();
                const myIOAuth = MyIOLibrary.buildMyioIngestionAuth({
                  dataApiHost,
                  clientId: creds.CLIENT_ID,
                  clientSecret: creds.CLIENT_SECRET,
                });

                ingestionDataFetcher = async (fetchStartTs, fetchEndTs) => {
                  const token = await myIOAuth.getToken();
                  const url = new URL(`${dataApiHost}/telemetry/devices/${ingestionId}/temperature`);
                  url.searchParams.set('startTime', new Date(fetchStartTs).toISOString());
                  url.searchParams.set('endTime', new Date(fetchEndTs).toISOString());
                  url.searchParams.set('granularity', '1h');
                  url.searchParams.set('deep', '0');

                  const res = await fetch(url.toString(), {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!res.ok) throw new Error(`Ingestion API error: ${res.status}`);

                  const json = await res.json();
                  const rows = Array.isArray(json) ? json : [];
                  const row = rows.find((r) => r.id === ingestionId) || rows[0] || null;
                  if (!row || !Array.isArray(row.consumption)) return [];

                  // Transform to TemperatureTelemetry[] format: { ts: number, value: number }
                  return row.consumption
                    .filter((e) => e && e.timestamp !== undefined && e.value !== undefined)
                    .map((e) => ({ ts: new Date(e.timestamp).getTime(), value: Number(e.value) }));
                };

                LogHelper.log(`[TELEMETRY v5] 🌡️ RFC-0189: using ingestion API for modal (ingestionId: ${ingestionId})`);
              } catch (authErr) {
                LogHelper.warn('[TELEMETRY v5] 🌡️ RFC-0189: could not build ingestion fetcher, falling back to TB:', authErr.message);
              }
            }

            LogHelper.log('[TELEMETRY v5] Calling openTemperatureModal with params:', {
              deviceId: deviceId,
              startDate: startDateISO,
              endDate: endDateISO,
              label: it.label || it.name,
              currentTemperature: currentTemp,
              temperatureMin: tempMinRange,
              temperatureMax: tempMaxRange,
              temperatureStatus: tempStatus,
              useIngestionApi,
            });

            // RFC: use customer-level clamp range if configured, else library default
            const customerClampRange = window.MyIOUtils?.temperatureClampRange;
            const clampRange = (customerClampRange?.min !== undefined && customerClampRange?.max !== undefined)
              ? { min: customerClampRange.min, max: customerClampRange.max }
              : undefined;

            const modalHandle = MyIOLibrary.openTemperatureModal({
              token: jwtToken,
              deviceId: deviceId,
              startDate: startDateISO,
              endDate: endDateISO,
              label: it.label || it.name || 'Sensor de Temperatura',
              currentTemperature: currentTemp,
              temperatureMin: tempMinRange,
              temperatureMax: tempMaxRange,
              temperatureStatus: tempStatus,
              theme: 'dark',
              locale: 'pt-BR',
              granularity: 'hour',
              ...(clampRange ? { clampRange } : {}),
              ...(ingestionDataFetcher ? { dataFetcher: ingestionDataFetcher } : {}),
              onClose: () => {
                LogHelper.log('[TELEMETRY v5] Temperature modal closed via MyIOLibrary');
              },
            });

            // Hide loading toast and busy indicator AFTER modal is opened
            // Use setTimeout to ensure toast 'show' class has been applied before hiding
            // (MyIOToast adds 'show' class after 10ms delay)
            setTimeout(() => {
              if (loadingToast) loadingToast.hide();
              if (MyIOToast) MyIOToast.hide(); // Also call global hide as fallback
            }, 50);
            hideBusy();

            LogHelper.log('[TELEMETRY v5] ✅ Temperature modal opened via MyIOLibrary:', modalHandle);
            return; // Exit early - modal is now handling everything
          } else if (isWaterTank) {
            // Water Tank Modal Path
            LogHelper.log('[TELEMETRY v5] Entering TANK device modal path...');

            LogHelper.log(
              '[TELEMETRY v5] MyIOLibrary available:',
              typeof MyIOLibrary !== 'undefined',
              'openDashboardPopupWaterTank exists:',
              typeof MyIOLibrary?.openDashboardPopupWaterTank
            );

            if (typeof MyIOLibrary?.openDashboardPopupWaterTank !== 'function') {
              const errorMsg = 'Water tank modal not available. Please update MyIO library.';
              LogHelper.error('[TELEMETRY v5] ❌', errorMsg);
              throw new Error(errorMsg);
            }

            // RFC-0107: For TANK/CAIXA_DAGUA: get water level from item (built from ctx.data)
            // Note: getData() won't work here because the data is in the item, not ctx.data
            const waterLevel = it.waterLevel ?? entityObject.waterLevel ?? null;
            const waterPercentage = it.waterPercentage ?? entityObject.waterPercentage ?? null;

            // RFC-0107: waterPercentage is in 0-1 range (e.g., 0.21 = 21%)
            // Convert to 0-100 range for display, and clamp to 0-100 for visual display
            let currentLevelPercent = 0;
            if (waterPercentage !== null && waterPercentage !== undefined) {
              // waterPercentage is 0-1 range, convert to percentage
              currentLevelPercent = waterPercentage * 100;
            } else if (waterLevel !== null && waterLevel !== undefined) {
              // Fallback: if only waterLevel is available, use it as percentage (assume it's already %)
              currentLevelPercent = waterLevel;
            }

            // Clamp for display (can be >100% but visual indicator should cap at 100)
            const currentLevelClamped = Math.min(100, Math.max(0, currentLevelPercent));

            LogHelper.log('[TELEMETRY v5] Water tank telemetry data:', {
              water_level: waterLevel,
              water_percentage: waterPercentage,
              currentLevelPercent: currentLevelPercent,
              currentLevelClamped: currentLevelClamped,
              it_waterLevel: it.waterLevel,
              it_waterPercentage: it.waterPercentage,
            });

            LogHelper.log('[TELEMETRY v5] Calling openDashboardPopupWaterTank with params:', {
              deviceId: it.id,
              deviceType: deviceType,
              startTs: typeof startTs === 'number' ? startTs : new Date(startTs).getTime(),
              endTs: typeof endTs === 'number' ? endTs : new Date(endTs).getTime(),
              label: it.label || it.name || 'Water Tank',
              currentLevel: currentLevelPercent,
              currentLevelClamped: currentLevelClamped,
              waterLevel: waterLevel,
              waterPercentage: waterPercentage,
            });

            LogHelper.log('[TELEMETRY v5] ⏳ About to call openDashboardPopupWaterTank...');

            const modalHandle = await MyIOLibrary.openDashboardPopupWaterTank({
              deviceId: it.id,
              deviceType: deviceType,
              tbJwtToken: jwtToken,
              startTs: typeof startTs === 'number' ? startTs : new Date(startTs).getTime(),
              endTs: typeof endTs === 'number' ? endTs : new Date(endTs).getTime(),
              label: it.label || it.name || 'Water Tank',
              currentLevel: currentLevelPercent, // RFC-0107: Use converted percentage (0-100)
              currentLevelClamped: currentLevelClamped, // RFC-0107: Clamped for visual display
              waterLevel: waterLevel, // RFC-0107: Raw water_level value
              waterPercentage: waterPercentage, // RFC-0107: Raw water_percentage (0-1 range)
              slaveId: it.slaveId,
              centralId: it.centralId,
              timezone: self.ctx?.timeWindow?.timezone || 'America/Sao_Paulo',
              telemetryKeys: ['water_level', 'water_percentage', 'waterLevel', 'nivel', 'level'],
              onOpen: (context) => {
                LogHelper.log('[TELEMETRY v5] ✅ Water tank modal opened successfully!', context);
                if (loadingToast) loadingToast.hide();
                hideBusy();
              },
              onClose: () => {
                LogHelper.log('[TELEMETRY v5] 🚪 Water tank modal onClose callback triggered');
              },
              onError: (error) => {
                LogHelper.error('[TELEMETRY v5] ❌ Water tank modal error:', error);
                if (loadingToast) loadingToast.hide();
                hideBusy();
                if (MyIOToast) {
                  MyIOToast.error(`Error: ${error.message}`);
                } else {
                  alert(`Error: ${error.message}`);
                }
              },
            });

            LogHelper.log('[TELEMETRY v5] ✅ Water tank modal handle received:', modalHandle);
          } else {
            // Energy/Water/Temperature Modal Path (Ingestion API)
            LogHelper.log('[TELEMETRY v5] Opening energy modal...');
            const tokenIngestionDashBoard = await MyIOAuth.getToken();
            const modal = MyIO.openDashboardPopupEnergy({
              deviceId: it.id,
              readingType: WIDGET_DOMAIN, // 'energy', 'water', or 'tank'
              deviceProfile: it.deviceProfile || null,
              canShowDemandButtons: window.MyIOOrchestrator?.canShowDemandButtons,
              startDate: self.ctx.scope.startDateISO,
              endDate: self.ctx.scope.endDateISO,
              tbJwtToken: jwtToken,
              ingestionToken: tokenIngestionDashBoard,
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              onOpen: (context) => {
                LogHelper.log('[TELEMETRY v5] Energy modal opened:', context);
                if (loadingToast) loadingToast.hide();
                hideBusy();
              },
              onError: (error) => {
                LogHelper.error('[TELEMETRY v5] Energy modal error:', error);
                if (loadingToast) loadingToast.hide();
                hideBusy();
                if (MyIOToast) {
                  MyIOToast.error(`Erro: ${error.message}`);
                } else {
                  alert(`Erro: ${error.message}`);
                }
              },
              onClose: () => {
                LogHelper.log('[TELEMETRY v5] Energy modal closed');
              },
            });
          }
        } catch (err) {
          LogHelper.error('[TELEMETRY v5] Dashboard action failed:', err?.message || err, err);

          if (loadingToast) loadingToast.hide();
          hideBusy();

          if (MyIOToast) {
            MyIOToast.error(err?.message || 'Failed to open dashboard');
          } else {
            alert(err?.message || 'Failed to open dashboard');
          }
        }
      },

      handleActionReport: async () => {
        try {
          showBusy(); // mensagem fixa

          const deviceType = it.deviceType || entityObject.deviceType;
          const isTermostatoDevice = deviceType === 'TERMOSTATO';

          // For TERMOSTATO devices, reports use ThingsBoard API (no ingestion)
          if (isTermostatoDevice || WIDGET_DOMAIN === 'temperature') {
            LogHelper.log('[TELEMETRY v5] Temperature report - using ThingsBoard API');

            const jwtToken = localStorage.getItem('jwt_token');
            if (!jwtToken) {
              throw new Error('No JWT token available');
            }

            // Get device TB ID
            let tbId = it.tbId;
            if (!tbId || !isValidUUID(tbId)) {
              const idx = buildTbIdIndexes();
              tbId =
                (it.ingestionId && idx.byIngestion.get(it.ingestionId)) ||
                (it.identifier && idx.byIdentifier.get(it.identifier)) ||
                null;
            }

            if (!tbId) {
              LogHelper.warn('[TELEMETRY v5] No TB device ID for temperature report');
              const MyIOToast = MyIOLibrary?.MyIOToast || window.MyIOToast;
              if (MyIOToast) {
                MyIOToast.error('Nao foi possivel identificar o dispositivo.');
              }
              return;
            }

            LogHelper.log('[TELEMETRY v5] Opening temperature report for device:', {
              tbId,
              label: it.label,
              identifier: it.identifier,
            });

            // Get temperature offset for this device (will be applied to report values)
            const reportTempOffset = it.temperatureOffset || getTemperatureOffset(tbId) || 0;
            if (reportTempOffset !== 0) {
              LogHelper.log(`[TELEMETRY v5] Temperature report will apply offset: ${reportTempOffset}`);
            }

            // Create custom fetcher for ThingsBoard temperature data
            const temperatureFetcher = async ({ startISO, endISO }) => {
              const startTs = new Date(startISO).getTime();
              const endTs = new Date(endISO).getTime();

              LogHelper.log('[TELEMETRY v5] Fetching temperature data for report:', {
                startISO,
                endISO,
                startTs,
                endTs,
                tbId,
                temperatureOffset: reportTempOffset,
              });

              // Fetch temperature data from ThingsBoard with daily aggregation
              const url =
                `/api/plugins/telemetry/DEVICE/${tbId}/values/timeseries` +
                `?keys=temperature` +
                `&startTs=${encodeURIComponent(startTs)}` +
                `&endTs=${encodeURIComponent(endTs)}` +
                `&limit=50000` +
                `&intervalType=MILLISECONDS` +
                `&interval=86400000` + // 24 hours in ms (daily aggregation)
                `&agg=AVG`;

              const response = await fetch(url, {
                headers: {
                  'X-Authorization': `Bearer ${jwtToken}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                throw new Error(`ThingsBoard API error: ${response.status}`);
              }

              const data = await response.json();
              LogHelper.log('[TELEMETRY v5] ThingsBoard temperature response:', data);

              // Transform ThingsBoard response to match expected format for report modal
              const tempValues = data?.temperature || [];

              if (tempValues.length === 0) {
                LogHelper.warn('[TELEMETRY v5] No temperature data returned from ThingsBoard');
                return [];
              }

              // Helper function to apply offset and clamp temperature values (avoid outliers)
              // Offset is applied first, then values below 15°C are clamped to 15, above 40°C to 40
              const clampTemp = (v) => {
                let num = Number(v || 0);
                // Apply temperature offset before clamping
                if (reportTempOffset !== 0) {
                  num = num + reportTempOffset;
                }
                if (num < 15) return 15;
                if (num > 40) return 40;
                return num;
              };

              // Group by day and calculate average (ThingsBoard may return multiple points per day)
              const dailyMap = {};
              tempValues.forEach((item) => {
                const date = new Date(item.ts);
                const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
                if (!dailyMap[dateKey]) {
                  dailyMap[dateKey] = { sum: 0, count: 0 };
                }
                // Clamp each value before aggregating
                dailyMap[dateKey].sum += clampTemp(item.value);
                dailyMap[dateKey].count += 1;
              });

              // Convert to array format expected by DeviceReportModal
              const consumption = Object.entries(dailyMap).map(([date, stats]) => ({
                timestamp: date + 'T00:00:00.000Z',
                value: stats.sum / stats.count, // Average temperature for the day (already clamped)
              }));

              LogHelper.log('[TELEMETRY v5] Processed temperature data for report:', {
                daysCount: consumption.length,
                consumption,
              });

              // Return in the format expected by DeviceReportModal.processApiResponse
              return [
                {
                  deviceId: tbId,
                  consumption: consumption,
                },
              ];
            };

            // Open the report modal with custom temperature fetcher
            await MyIO.openDashboardPopupReport({
              ingestionId: it.ingestionId || tbId, // Use tbId as fallback
              deviceId: tbId,
              identifier: it.identifier,
              label: it.label,
              domain: 'temperature',
              fetcher: temperatureFetcher, // Custom fetcher for ThingsBoard data
              api: {
                // These are not used when custom fetcher is provided, but required by interface
                dataApiBaseUrl: '',
                clientId: '',
                clientSecret: '',
                ingestionToken: jwtToken,
              },
            });

            return;
          }

          if (!isAuthReady()) throw new Error('Auth not ready');

          const ingestionToken = await MyIOAuth.getToken();

          if (!ingestionToken) throw new Error('No ingestion token');

          await MyIO.openDashboardPopupReport({
            ingestionId: it.ingestionId, // sempre ingestionId
            identifier: it.identifier,
            label: it.label,
            domain: WIDGET_DOMAIN, // 'energy', 'water', or 'temperature'
            api: {
              dataApiBaseUrl: window.MyIOUtils?.getDataApiHost?.(),
              clientId: CLIENT_ID,
              clientSecret: CLIENT_SECRET,
              ingestionToken,
            },
          });
        } catch (err) {
          LogHelper.warn('[DeviceCards] Report open blocked:', err?.message || err);
          alert('Credenciais ainda carregando. Tente novamente em instantes.');
        } finally {
          hideBusy();
        }
      },

      handleActionSettings: async () => {
        showBusy(null, 3000); // mensagem fixa
        // resolve TB id “fresh”
        let tbId = it.tbId;

        if (!tbId || !isValidUUID(tbId)) {
          const idx = buildTbIdIndexes();
          tbId =
            (it.ingestionId && idx.byIngestion.get(it.ingestionId)) ||
            (it.identifier && idx.byIdentifier.get(it.identifier)) ||
            null;
        }

        if (!tbId || tbId === it.ingestionId) {
          LogHelper.warn('[DeviceCards] Missing/ambiguous TB id for Settings', {
            label: it.label,
            identifier: it.identifier,
            ingestionId: it.ingestionId,
            tbId,
          });
          hideBusy();
          const MyIOToast = window.MyIOLibrary?.MyIOToast;
          if (MyIOToast) {
            MyIOToast.error('Não foi possível identificar o deviceId do ThingsBoard para este card.', 5000);
          }
          return;
        }

        const jwt = localStorage.getItem('jwt_token');

        try {
          // RFC-0080 + RFC-0091: Get customerId from MAIN widget via window.MyIOUtils
          const customerTbId = window.MyIOUtils?.customerTB_ID || null;

          // RFC-XXXX: SuperAdmin flag from MAIN_VIEW
          const isSuperAdmin = window.MyIOUtils?.SuperAdmin || false;

          // RFC-0144: Annotations onboarding flag from MAIN_VIEW settings
          const enableAnnotationsOnboarding = window.MyIOUtils?.enableAnnotationsOnboarding ?? false;

          // Fetch master_admin_password from customer SERVER_SCOPE attributes
          let masterAdminPassword = null;
          if (customerTbId && jwt) {
            try {
              const pwdUrl = `/api/plugins/telemetry/CUSTOMER/${customerTbId}/values/attributes/SERVER_SCOPE?keys=master_admin_password`;
              const pwdResp = await fetch(pwdUrl, { headers: { 'X-Authorization': `Bearer ${jwt}` } });
              if (pwdResp.ok) {
                const pwdData = await pwdResp.json();
                const pwdAttr = Array.isArray(pwdData) ? pwdData.find(a => a.key === 'master_admin_password') : null;
                masterAdminPassword = pwdAttr?.value || null;
              }
            } catch (e) {
              console.warn('[TELEMETRY] Could not fetch master_admin_password:', e);
            }
          }

          console.log(`[TELEMETRY] openDashboardPopupSettings > isSuperAdmin: `, isSuperAdmin);
          console.log(
            `[TELEMETRY] openDashboardPopupSettings > enableAnnotationsOnboarding: `,
            enableAnnotationsOnboarding
          );

          await MyIO.openDashboardPopupSettings({
            deviceId: tbId, // TB deviceId
            label: it.label,
            deviceName: it.entityName || it.name || '', // Raw device name (shown as subtitle in identity card)
            jwtToken: jwt,
            domain: WIDGET_DOMAIN,
            deviceType: it.deviceType,
            deviceProfile: it.deviceProfile || null, // RFC-0086: needed for 3F_MEDIDOR detection
            customerId: customerTbId, // RFC-0080: Pass customerId for GLOBAL fetch
            superadmin: isSuperAdmin, // RFC-XXXX: SuperAdmin mode
            userEmail: window.MyIOUtils?.currentUserEmail || '', // RFC-0171: needed for offSetTemperature field visibility
            enableAnnotationsOnboarding: enableAnnotationsOnboarding, // RFC-0144: Annotations onboarding control
            createdTime: it.createdTime || null,
            lastActivityTime: it.lastActivityTime || null,
            connectionData: {
              centralName: it.centralName,
              connectionStatusTime: it.connectionStatusTime || null,
              lastDisconnectTime: it.lastDisconnectTime || null,
              timeVal: it.timeVal || null,
              deviceStatus: it.deviceStatus || 'no_info',
            },
            ui: { title: 'Configurações', width: 1100 },
            mapInstantaneousPower: it.mapInstantaneousPower, // RFC-0078: Pass existing map if available
            // RFC-0091: Pass device-specific power limits (TIER 0 - highest priority)
            deviceMapInstaneousPower: it.deviceMapInstaneousPower || null,
            // RFC-0180: GCDR params for Alarms tab
            gcdrDeviceId: it.gcdrDeviceId || null,
            prefetchedBundle: window.MyIOOrchestrator?.alarmBundle ?? null,
            prefetchedAlarms: window.MyIOOrchestrator?.customerAlarms ?? null,
            masterAdminPassword: masterAdminPassword || null,
            onSaved: (payload) => {
              LogHelper.log('[Settings Saved]', payload);
              //hideBusy();
              // Mostra modal global de sucesso com contador e reload
              // showGlobalSuccessModal(6);
            },
            onClose: () => {
              $('.myio-device-settings-overlay').remove();
              hideBusy();
            },
          });
        } catch (e) {
          hideBusy();
        }
      },

      handleClickCard: () => {
        //LogHelper.log("Card clicado:", entityObject);
      },

      handleSelect: (entityObj) => {
        // NOTE: This callback is called during card rendering, NOT during user selection
        // Entity registration is handled by the 'myio:device-params' event listener instead
        // which is only triggered when the user actually clicks the checkbox
        LogHelper.log('[TELEMETRY] handleSelect called (no-op):', entityObj.labelOrName);
      },
    });

    // Append the returned element to wrapper
    if ($card && $card[0] && entityObject.log_annotations) {
      addAnnotationIndicator($card[0], entityObject);
    }

    // RFC-0183: Alarm badge — red bell icon if device has active alarms in AlarmServiceOrchestrator
    if ($card && $card[0]) {
      addAlarmBadge($card[0], it.gcdrDeviceId || null);
    }

    // RFC-0198: Ticket badge — orange chat icon if device has open FreshDesk tickets
    if ($card && $card[0]) {
      addTicketBadge($card[0], it.identifier || null);
    }

    // RFC-0152: Collect TB↔GCDR mapping data for device export
    window[_exportKey].push({
      tbId: it.tbId || it.id || '',
      deviceName: it.entityName || '',
      label: it.label || '',
      identifier: it.identifier || '',
      deviceType: it.deviceType || '',
      deviceProfile: it.deviceProfile || '',
      slaveId: it.slaveId || '',
      centralId: it.centralId || '',
      gcdrCustomerId: it.gcdrCustomerId || '',
      gcdrAssetId: it.gcdrAssetId || '',
      gcdrDeviceId: it.gcdrDeviceId || '',
      gcdrSyncAt: it.gcdrSyncAt || '',
    });

    // RFC-0196: Tag card with group for group-filter hide/show
    const _cardEl = $card && $card[0];
    if (_cardEl) {
      if (WIDGET_DOMAIN === 'water') {
        const waterGroup = _getWaterGroupKey(self.ctx.settings && self.ctx.settings.labelWidget);
        if (waterGroup) _cardEl.setAttribute('data-water-group', waterGroup);
      } else {
        const energyGroup = _getEnergyGroupKey(it);
        if (energyGroup) _cardEl.setAttribute('data-energy-group', energyGroup);
      }
    }

    $ul.append($card);
  });

  // RFC-0152: Log device export data if enabled via settings
  if (window.MyIOUtils?.enableDeviceDataExport && window[_exportKey].length > 0) {
    const header =
      'tbId|deviceName|label|identifier|deviceType|deviceProfile|slaveId|centralId|gcdrCustomerId|gcdrAssetId|gcdrDeviceId|gcdrSyncAt';
    const rows = window[_exportKey].map((d) =>
      [
        d.tbId,
        d.deviceName,
        d.label,
        d.identifier,
        d.deviceType,
        d.deviceProfile,
        d.slaveId,
        d.centralId,
        d.gcdrCustomerId,
        d.gcdrAssetId,
        d.gcdrDeviceId,
        d.gcdrSyncAt,
      ].join('|')
    );
    console.log(
      `[RFC-0152] Device Data Export — ${window[_exportKey].length} devices (${WIDGET_DOMAIN}):\n` +
        header +
        '\n' +
        rows.join('\n')
    );
  }
}

/** ===================== EXPORT HELPERS ===================== **/

/**
 * Maps STATE items to TelemetryDevice-compatible objects for the export functions.
 * @param {Array} items
 * @returns {Array}
 */
function _buildExportDevices(items) {
  return (items || []).map((it) => ({
    entityId: it.id || '',
    ingestionId: it.ingestionId || '',
    labelOrName: it.label || it.identifier || '',
    deviceIdentifier: it.identifier || '',
    deviceType: it.deviceType || '',
    deviceProfile: it.deviceProfile || '',
    deviceStatus: it.deviceStatus || '',
    connectionStatus: it.connectionStatus || '',
    customerId: '',
    customerName: it.customerName || '',
    val: it.value ?? null,
    perc: it.perc,
  }));
}

function _getExportUnit() {
  if (WIDGET_DOMAIN === 'energy') return 'kWh';
  if (WIDGET_DOMAIN === 'water') return 'm³';
  if (WIDGET_DOMAIN === 'temperature') return '°C';
  return '';
}

function _getExportLabel() {
  return self.ctx.settings?.labelWidget || WIDGET_DOMAIN || 'Dispositivos';
}

function _getExportPeriod() {
  const s = self.ctx?.scope?.startDateISO;
  const e = self.ctx?.scope?.endDateISO;
  if (s || e) return { startISO: s || null, endISO: e || null };
  return null;
}

function _openPresetupModal() {
  const lib = window.MyIOLibrary;
  if (!lib?.createPresetupGateway) {
    LogHelper.warn('[TELEMETRY] createPresetupGateway não disponível em MyIOLibrary');
    return;
  }
  const s = self.ctx.settings || {};
  const gatewayId = s.presetupGatewayId || '';

  // Fallback: use credentials already loaded by MAIN_VIEW into MyIOOrchestrator
  const orchCreds = window.MyIOOrchestrator?.getCredentials?.() || {};
  const clientId = s.presetupClientId || orchCreds.CLIENT_ID || '';
  const clientSecret = s.presetupClientSecret || orchCreds.CLIENT_SECRET || '';

  if (!gatewayId || !clientId || !clientSecret) {
    _openPresetupConfigPrompt(s, clientId, clientSecret, (resolvedGatewayId, resolvedClientId, resolvedClientSecret) => {
      _launchPresetupGateway(lib, s, resolvedGatewayId, resolvedClientId, resolvedClientSecret);
    });
    return;
  }

  _launchPresetupGateway(lib, s, gatewayId, clientId, clientSecret);
}

function _launchPresetupGateway(lib, s, gatewayId, clientId, clientSecret) {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;';

  const container = document.createElement('div');
  container.style.cssText =
    'background:#fff;border-radius:14px;width:min(900px,95vw);height:min(700px,90vh);overflow:auto;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText =
    'position:absolute;top:10px;right:14px;background:none;border:none;font-size:22px;cursor:pointer;z-index:2;color:#555;line-height:1;';
  closeBtn.onclick = () => overlay.remove();

  container.appendChild(closeBtn);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  lib.createPresetupGateway({
    mount: container,
    gatewayId,
    clientId,
    clientSecret,
    ingestionApiUrl: s.presetupIngestionApiUrl || undefined,
    ingestionAuthUrl: s.presetupIngestionAuthUrl || undefined,
    provisioningApiUrl: s.presetupProvisioningApiUrl || undefined,
  });
}

function _openPresetupConfigPrompt(s, prefillClientId, prefillClientSecret, onConfirm) {
  // Collect unique centralIds: first from MAIN_VIEW orchestrator, fallback to local STATE
  const orchCentralIds = window.MyIOOrchestrator?.centralIds || [];
  const localCentralIds = STATE.itemsBase
    ? [...new Set(STATE.itemsBase.map(i => i.centralId).filter(Boolean))].sort()
    : [];
  const centralIds = orchCentralIds.length ? orchCentralIds : localCentralIds;

  const inputStyle = 'display:block;width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box;';
  const labelStyle = 'font-size:12px;color:#555;font-weight:600;';

  // Build Gateway ID field: select when centralIds available, plain input otherwise
  const gwPreset = (s.presetupGatewayId || '').replace(/"/g, '&quot;');
  const gwIsPreset = !!s.presetupGatewayId;

  let gatewayField;
  if (centralIds.length > 0) {
    const options = centralIds.map(id => {
      const sel = id === gwPreset ? ' selected' : '';
      return `<option value="${id}"${sel}>${id}</option>`;
    }).join('');
    gatewayField = `
      <label style="${labelStyle}">Gateway ID (Central)
        <select id="_psgw" style="${inputStyle}background:#fff;cursor:pointer;">
          <option value="">— selecione —</option>
          ${options}
          <option value="__outro__"${!gwIsPreset && gwPreset ? ' selected' : ''}>Outro…</option>
        </select>
      </label>
      <div id="_psgwCustomWrap" style="display:${!gwIsPreset && gwPreset ? 'block' : 'none'};">
        <label style="${labelStyle}">Gateway ID (manual)
          <input id="_psgwCustom" type="text" value="${!gwIsPreset ? gwPreset : ''}" placeholder="UUID do gateway" autocomplete="off"
            style="${inputStyle}" />
        </label>
      </div>`;
  } else {
    gatewayField = `
      <label style="${labelStyle}">Gateway ID
        <input id="_psgw" type="text" value="${gwPreset}" placeholder="UUID do gateway" autocomplete="off"
          style="${inputStyle}" />
      </label>`;
  }

  const ciVal = (prefillClientId || '').replace(/"/g, '&quot;');
  const csVal = (prefillClientSecret || '').replace(/"/g, '&quot;');
  const hasCredentials = !!(prefillClientId && prefillClientSecret);

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;';

  const card = document.createElement('div');
  card.style.cssText =
    'background:#fff;border-radius:12px;padding:28px 28px 24px;width:min(480px,92vw);box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:inherit;';

  card.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:20px;">
      <svg style="flex-shrink:0;margin-top:2px;" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#c0392b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill="#c0392b" stroke="none"/>
      </svg>
      <div>
        <p style="margin:0 0 4px;font-weight:600;color:#222;font-size:14px;">Configuração do Gateway</p>
        <p style="margin:0;font-size:12.5px;color:#666;line-height:1.5;">Selecione ou informe o Gateway ID para continuar.${hasCredentials ? ' Credenciais carregadas automaticamente.' : ''}</p>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${gatewayField}
      <label style="${labelStyle}">Client ID${hasCredentials ? ' <span style="color:#16a34a;font-weight:400;">(preenchido)</span>' : ''}
        <input id="_psci" type="text" value="${ciVal}" placeholder="client_id" autocomplete="off"
          style="${inputStyle}${hasCredentials ? 'background:#f0fdf4;border-color:#86efac;' : ''}" />
      </label>
      <label style="${labelStyle}">Client Secret${hasCredentials ? ' <span style="color:#16a34a;font-weight:400;">(preenchido)</span>' : ''}
        <input id="_pscs" type="password" value="${csVal}" placeholder="client_secret"
          style="${inputStyle}${hasCredentials ? 'background:#f0fdf4;border-color:#86efac;' : ''}" />
      </label>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:22px;">
      <button id="_psCancelBtn" style="padding:8px 18px;border:1px solid #ddd;border-radius:7px;background:#f5f5f5;color:#555;font-size:13px;cursor:pointer;">Cancelar</button>
      <button id="_psConfirmBtn" style="padding:8px 20px;border:none;border-radius:7px;background:#3e1a7d;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Continuar</button>
    </div>`;

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Show/hide custom input when "Outro…" selected
  const gwSelect = card.querySelector('#_psgw');
  if (gwSelect && gwSelect.tagName === 'SELECT') {
    gwSelect.addEventListener('change', () => {
      const wrap = card.querySelector('#_psgwCustomWrap');
      if (wrap) wrap.style.display = gwSelect.value === '__outro__' ? 'block' : 'none';
    });
  }

  card.querySelector('#_psCancelBtn').onclick = () => overlay.remove();
  card.querySelector('#_psConfirmBtn').onclick = () => {
    let gw;
    if (gwSelect && gwSelect.tagName === 'SELECT') {
      gw = gwSelect.value === '__outro__'
        ? (card.querySelector('#_psgwCustom')?.value.trim() || '')
        : gwSelect.value.trim();
    } else {
      gw = gwSelect?.value.trim() || '';
    }
    const ci = card.querySelector('#_psci').value.trim();
    const cs = card.querySelector('#_pscs').value.trim();
    if (!gw || !ci || !cs) {
      if (!gw) {
        if (gwSelect) gwSelect.style.borderColor = '#c0392b';
        const custom = card.querySelector('#_psgwCustom');
        if (custom && !custom.value.trim()) custom.style.borderColor = '#c0392b';
      }
      if (!ci) card.querySelector('#_psci').style.borderColor = '#c0392b';
      if (!cs) card.querySelector('#_pscs').style.borderColor = '#c0392b';
      return;
    }
    overlay.remove();
    onConfirm(gw, ci, cs);
  };

  // Focus first incomplete field
  setTimeout(() => {
    const firstEmpty = card.querySelector('select,input');
    if (firstEmpty) firstEmpty.focus();
  }, 50);
}

/** ===================== UI BINDINGS ===================== **/
function bindHeader() {
  $root().on('click', '#btnSearch', () => {
    STATE.searchActive = !STATE.searchActive;
    const $btns = $root().find('.shops-header-btns');
    const $wrap = $root().find('#searchWrap');

    $btns.toggleClass('search-mode', STATE.searchActive);
    $wrap.toggleClass('active', STATE.searchActive);

    if (STATE.searchActive) {
      setTimeout(() => $root().find('#shopsSearch').trigger('focus'), 50);
    } else {
      STATE.searchTerm = '';
      $root().find('#shopsSearch').val('');
      reflowFromState();
    }
  });

  $root().on('keydown', '#shopsSearch', (ev) => {
    if (ev.key === 'Escape') $root().find('#btnSearch').trigger('click');
  });

  $root().on('input', '#shopsSearch', (ev) => {
    STATE.searchTerm = ev.target.value || '';
    reflowFromState();
  });

  // Bind filter button — triple approach for maximum TB compatibility
  const _btnFilter = ($root()[0] || self.ctx.$container[0]).querySelector('#btnFilter');
  if (_btnFilter) {
    _btnFilter.onclick = openFilterModal; // inline property (visible in devtools)
    _btnFilter.addEventListener('click', openFilterModal); // native listener
  }
  $root().on('click', '#btnFilter', openFilterModal); // jQuery delegation (fallback)

  // Export buttons
  $root().on('click', '#btnExportPdf', () => {
    const lib = window.MyIOLibrary;
    if (!lib?.exportGridPdf) {
      LogHelper.warn('[TELEMETRY] exportGridPdf not available in MyIOLibrary');
      return;
    }
    lib.exportGridPdf(
      _buildExportDevices(STATE.lastVisible),
      _getExportLabel(),
      _getExportUnit(),
      _getExportPeriod()
    );
  });

  $root().on('click', '#btnExportXls', () => {
    const lib = window.MyIOLibrary;
    if (!lib?.exportGridXls) {
      LogHelper.warn('[TELEMETRY] exportGridXls not available in MyIOLibrary');
      return;
    }
    lib.exportGridXls(
      _buildExportDevices(STATE.lastVisible),
      _getExportLabel(),
      _getExportUnit(),
      _getExportPeriod()
    );
  });

  $root().on('click', '#btnExportCsv', () => {
    const lib = window.MyIOLibrary;
    if (!lib?.exportGridCsv) {
      LogHelper.warn('[TELEMETRY] exportGridCsv not available in MyIOLibrary');
      return;
    }
    lib.exportGridCsv(
      _buildExportDevices(STATE.lastVisible),
      _getExportLabel(),
      _getExportUnit(),
      _getExportPeriod()
    );
  });

  // Presetup button
  $root().on('click', '#btnPresetup', _openPresetupModal);
}

function openFilterModal() {
  const $m = $modal();
  const $cl = $m.find('#deviceChecklist').empty();

  const list = (STATE.itemsBase || []).slice().sort((a, b) =>
    (a.label || '').localeCompare(b.label || '', 'pt-BR', {
      sensitivity: 'base',
    })
  );

  if (!list.length) {
    $cl.html('<div class="muted">Nenhuma loja carregada.</div>');
    $m.removeClass('hidden');
    return;
  }

  const selected = STATE.selectedIds;
  const frag = document.createDocumentFragment();

  for (const it of list) {
    const safeId =
      String(it.id || '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 60) || 'id' + Math.random().toString(36).slice(2);
    const checked = !selected || !selected.size || selected.has(it.id);

    const label = document.createElement('label');
    label.className = 'check-item';
    label.setAttribute('role', 'option');
    label.innerHTML = `
      <input type="checkbox" id="chk-${safeId}" data-entity="${escapeHtml(it.id)}" ${
        checked ? 'checked' : ''
      }>
      <span>${escapeHtml(it.label || it.identifier || it.id)}</span>
    `;
    frag.appendChild(label);
  }

  $cl[0].appendChild(frag);
  $m.find(`input[name="sortMode"][value="${STATE.sortMode}"]`).prop('checked', true);
  $m.find(`input[name="alarmFilter"][value="${STATE.alarmFilter || 'ativado'}"]`).prop('checked', true);

  const $footer = $m.find('.shops-modal-footer');
  if ($footer.length) $footer.show().find('#applyFilters, #resetFilters').show();

  syncChecklistSelectionVisual();
  $m.removeClass('hidden');
}
// ============================================================
// RFC-0195: GCDR Device Sync Job
// ============================================================

const _GCDR_SYNC_BASE = 'https://gcdr-api.a.myio-bas.com';
const _GCDR_PHASE_PROGRESS = {
  QUEUED: 0, CHECK: 15, ACTION_PLAN: 30, DETECT_RELOCATIONS: 45,
  RELOCATE: 55, APPLY_UPDATES: 70, CONSOLIDATE_CREATES: 85, DONE: 100,
};
const _GCDR_PHASE_LABELS = {
  QUEUED: 'Aguardando na fila…', CHECK: 'Comparando devices com GCDR…',
  ACTION_PLAN: 'Classificando ações…', DETECT_RELOCATIONS: 'Detectando relocações…',
  RELOCATE: 'Movendo devices…', APPLY_UPDATES: 'Aplicando atualizações…',
  CONSOLIDATE_CREATES: 'Criando devices novos…', DONE: 'Concluído',
};
const _GCDR_DEVICE_MAP_HEADER =
  'tbId|deviceName|label|identifier|deviceType|deviceProfile|slaveId|centralId|gcdrCustomerId|gcdrAssetId|gcdrDeviceId|gcdrSyncAt';

/**
 * RFC-0195: Reads integration_setup.gcdr from CUSTOMER SERVER_SCOPE.
 * Returns { gcdrCustomerId, gcdrApiKey }.
 */
async function _fetchGcdrCredentials() {
  const tbToken = localStorage.getItem('jwt_token');
  const customerId = window.MyIOUtils?.customerTB_ID;
  if (!tbToken || !customerId) throw new Error('JWT ou customerTB_ID não disponíveis.');
  const url = `/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE?keys=integration_setup`;
  const res = await fetch(url, { headers: { 'X-Authorization': `Bearer ${tbToken}` } });
  if (!res.ok) throw new Error(`TB attrs HTTP ${res.status}`);
  const attrs = await res.json();
  const raw = Array.isArray(attrs)
    ? attrs.find((a) => a.key === 'integration_setup')?.value
    : attrs.integration_setup;
  if (!raw) throw new Error('Atributo integration_setup não encontrado no customer.\nConfigure-o via widget GCDR-Upsell-Setup.');
  const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const gcdr = cfg?.gcdr;
  if (!gcdr?.gcdrCustomerId || !gcdr?.gcdrApiKey) {
    throw new Error('integration_setup.gcdr incompleto — gcdrCustomerId e gcdrApiKey são obrigatórios.');
  }
  return { gcdrCustomerId: gcdr.gcdrCustomerId, gcdrApiKey: gcdr.gcdrApiKey };
}

/** RFC-0195: Builds pipe-delimited device-map content from _exportKey array. */
function _buildDeviceMapContent(data) {
  const rows = data.map((d) =>
    [d.tbId, d.deviceName, d.label, d.identifier,
     d.deviceType, d.deviceProfile, d.slaveId, d.centralId,
     d.gcdrCustomerId, d.gcdrAssetId, d.gcdrDeviceId, d.gcdrSyncAt].join('|')
  );
  return _GCDR_DEVICE_MAP_HEADER + '\n' + rows.join('\n');
}

/** RFC-0195: Entry point — validates data + credentials then opens job modal. */
async function _handleSyncGCDR() {
  const data = window[_exportKey];
  if (!data || data.length === 0) {
    alert('Nenhum dado disponível. Abra o painel de dados primeiro.');
    return;
  }
  let creds;
  try {
    creds = await _fetchGcdrCredentials();
  } catch (err) {
    alert(`Erro ao obter credenciais GCDR:\n${err.message}`);
    return;
  }
  _openSyncJobModal(data, creds);
}

/** RFC-0195: Renders sync job modal, creates job, polls status, shows log. */
function _openSyncJobModal(data, creds) {
  _destroySyncJobModal(); // ensure only one modal at a time

  const _groupSlugs = { lojas: 'stores', entrada: 'entry', areacomum: 'commonarea', caixadagua: 'tanks' };
  const _labelWidget = self.ctx?.settings?.labelWidget || '';
  const _stateGroup = mapLabelWidgetToStateGroup(_labelWidget) || WIDGET_DOMAIN;
  const fileName = `${WIDGET_DOMAIN}-${_groupSlugs[_stateGroup] || _stateGroup}`;

  const overlay = document.createElement('div');
  overlay.className = 'telemetry-sync-gcdr-overlay';
  _syncJobModalEl = overlay;

  overlay.innerHTML = `
    <div class="telemetry-sync-gcdr-card" id="sgj-card">
      <div class="telemetry-sync-gcdr-header">
        <span class="telemetry-sync-gcdr-header-title">🔗 Sync GCDR — ${fileName}</span>
        <button class="telemetry-sync-gcdr-dl" id="sgj-dl" title="Download relatório completo" disabled>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
            <path d="M12 16l-5-5 1.41-1.41L11 13.17V4h2v9.17l2.59-2.58L17 11l-5 5zm-7 4v-2h14v2H5z"/>
          </svg>
          Download log
        </button>
        <button class="telemetry-sync-gcdr-expand" id="sgj-expand" title="Expandir">
          <svg id="sgj-expand-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
        <button class="telemetry-sync-gcdr-close" id="sgj-close" title="Fechar">✕</button>
      </div>
      <div class="telemetry-sync-gcdr-body">
        <div class="telemetry-sync-gcdr-status">
          <span class="telemetry-sync-gcdr-badge queued" id="sgj-badge">⏳ Iniciando…</span>
          <span style="font-size:11px;color:#9ca3af" id="sgj-jobid"></span>
        </div>
        <div class="telemetry-sync-gcdr-progress-wrap">
          <div class="telemetry-sync-gcdr-progress-bar" id="sgj-bar"></div>
        </div>
        <div class="telemetry-sync-gcdr-phase" id="sgj-phase">Criando job…</div>
        <div id="sgj-summary"></div>
        <div id="sgj-log"></div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#sgj-close').addEventListener('click', _destroySyncJobModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _destroySyncJobModal(); });

  // Expand / collapse toggle
  let _sgjExpanded = false;
  overlay.querySelector('#sgj-expand').addEventListener('click', () => {
    _sgjExpanded = !_sgjExpanded;
    const card = _el('#sgj-card');
    const icon = _el('#sgj-expand-icon');
    if (card) card.classList.toggle('sgj-expanded', _sgjExpanded);
    overlay.classList.toggle('sgj-overlay-expanded', _sgjExpanded);
    if (icon) icon.innerHTML = _sgjExpanded
      ? '<polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="10" y1="14" x2="3" y2="21"></line><line x1="21" y1="3" x2="14" y2="10"></line>'
      : '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>';
  });

  // Closure state for download report
  let _sgjLogEntries = [];
  let _sgjJobResult = null;
  const _sgjDeviceMapContent = _buildDeviceMapContent(data);
  const _sgjStartedAt = new Date().toISOString();

  // Download report button
  overlay.querySelector('#sgj-dl').addEventListener('click', () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const lines = [];
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push('  GCDR DEVICE SYNC JOB — Relatório Completo');
    lines.push('═══════════════════════════════════════════════════════════════════');
    lines.push(`  Arquivo  : ${fileName}`);
    lines.push(`  Customer : ${creds.gcdrCustomerId}`);
    lines.push(`  Job ID   : ${_sgjJobResult?.jobId || '—'}`);
    lines.push(`  Status   : ${_sgjJobResult?.status || '—'}`);
    lines.push(`  DryRun   : ${_sgjJobResult?.dryRun ?? false}`);
    lines.push(`  Iniciado : ${_sgjStartedAt}`);
    lines.push(`  Duração  : ${_sgjJobResult?.durationMs != null ? (_sgjJobResult.durationMs / 1000).toFixed(1) + 's' : '—'}`);
    lines.push('');
    lines.push('── DEVICE-MAP ENVIADO ──────────────────────────────────────────────');
    lines.push(_sgjDeviceMapContent);
    lines.push('');
    if (_sgjJobResult?.summary) {
      const s = _sgjJobResult.summary;
      lines.push('── RESUMO ──────────────────────────────────────────────────────────');
      if (s.check)              lines.push(`  CHECK              conformant=${s.check.conformant}  divergent=${s.check.divergent}  notLinked=${s.check.notLinked}`);
      if (s.actionPlan)         lines.push(`  ACTION_PLAN        create=${s.actionPlan.create}  update=${s.actionPlan.update}  skip=${s.actionPlan.skip}`);
      if (s.detectRelocations)  lines.push(`  DETECT_RELOCATIONS relocate=${s.detectRelocations.relocate}  genuineCreates=${s.detectRelocations.genuineCreates}`);
      if (s.relocate)           lines.push(`  RELOCATE           ok=${s.relocate.ok}  fail=${s.relocate.fail}`);
      if (s.applyUpdates)       lines.push(`  APPLY_UPDATES      ok=${s.applyUpdates.ok}  fail=${s.applyUpdates.fail}`);
      if (s.consolidateCreates) lines.push(`  CONSOLIDATE        ok=${s.consolidateCreates.ok}  fail=${s.consolidateCreates.fail}`);
      lines.push('');
    }
    lines.push('── LOG DE OPERAÇÕES ────────────────────────────────────────────────');
    if (_sgjLogEntries.length) {
      _sgjLogEntries.forEach((e) => {
        lines.push(`  [${(e.ts || '').substring(11, 23)}] [${(e.level || '').padEnd(5)}] [${(e.phase || '').padEnd(22)}] ${e.message || ''}`);
      });
    } else {
      lines.push('  (sem entradas de log)');
    }
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════════');
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gcdr-sync-log_${fileName}_${ts}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Helpers that operate on overlay elements
  const _el = (id) => overlay.querySelector(id);
  const setProgress = (pct) => { const b = _el('#sgj-bar'); if (b) b.style.width = pct + '%'; };
  const setPhase = (t) => { const e = _el('#sgj-phase'); if (e) e.textContent = t; };
  const setBadge = (cls, t) => {
    const e = _el('#sgj-badge');
    if (e) { e.className = `telemetry-sync-gcdr-badge ${cls}`; e.textContent = t; }
  };

  const renderSummary = (summary) => {
    const c = summary?.check || {};
    const a = summary?.actionPlan || {};
    const u = summary?.applyUpdates || {};
    const cr = summary?.consolidateCreates || {};
    const el = _el('#sgj-summary');
    if (!el) return;
    el.innerHTML = `
      <div class="telemetry-sync-gcdr-summary">
        <div class="telemetry-sync-gcdr-kpi">
          <div class="kpi-val">${c.conformant ?? 0}</div>
          <div class="kpi-lbl">Conformantes</div>
        </div>
        <div class="telemetry-sync-gcdr-kpi">
          <div class="kpi-val" style="color:#d97706">${c.divergent ?? 0}</div>
          <div class="kpi-lbl">Divergentes</div>
        </div>
        <div class="telemetry-sync-gcdr-kpi">
          <div class="kpi-val" style="color:#2563eb">${(a.create ?? 0) + (cr.ok ?? 0)}</div>
          <div class="kpi-lbl">Criados</div>
        </div>
        <div class="telemetry-sync-gcdr-kpi">
          <div class="kpi-val" style="color:#16a34a">${u.ok ?? 0}</div>
          <div class="kpi-lbl">Atualizados</div>
        </div>
        <div class="telemetry-sync-gcdr-kpi">
          <div class="kpi-val" style="color:#9ca3af">${a.skip ?? 0}</div>
          <div class="kpi-lbl">Sem mudança</div>
        </div>
        <div class="telemetry-sync-gcdr-kpi">
          <div class="kpi-val" style="color:#dc2626">${(u.fail ?? 0) + (cr.fail ?? 0)}</div>
          <div class="kpi-lbl">Falhas</div>
        </div>
      </div>`;
  };

  const renderLog = (entries) => {
    if (!entries || !entries.length) return;
    _sgjLogEntries = entries; // store for download
    const failCount = entries.filter((e) => e.level === 'FAIL' || e.level === 'ERROR').length;
    const rows = entries.map((e) => {
      const ts = (e.ts || '').substring(11, 19);
      return `<tr>
        <td>${ts}</td>
        <td class="sgj-level-${e.level}">${e.level}</td>
        <td>${e.phase || ''}</td>
        <td>${e.message || ''}</td>
      </tr>`;
    }).join('');
    const el = _el('#sgj-log');
    if (!el) return;
    const failBadge = failCount > 0 ? ` <span style="background:#fee2e2;color:#991b1b;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:700">${failCount} falha${failCount !== 1 ? 's' : ''}</span>` : '';
    el.innerHTML = `
      <div class="telemetry-sync-gcdr-log-wrap">
        <div class="telemetry-sync-gcdr-log-title">Log de operações (${entries.length} entradas)${failBadge}</div>
        <table class="telemetry-sync-gcdr-log-table"><tbody>${rows}</tbody></table>
      </div>`;
    const tbl = el.querySelector('.telemetry-sync-gcdr-log-table');
    if (tbl) tbl.scrollTop = tbl.scrollHeight;
    // Enable download button now that we have full data
    const dlBtn = _el('#sgj-dl');
    if (dlBtn) dlBtn.disabled = false;
  };

  // ── Execute async flow ──────────────────────────────────────
  (async () => {
    const content = _buildDeviceMapContent(data);
    let jobId;

    // 1. Create job
    try {
      const res = await fetch(`${_GCDR_SYNC_BASE}/api/v1/device-sync/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': creds.gcdrApiKey },
        body: JSON.stringify({ customerId: creds.gcdrCustomerId, dryRun: false, files: [{ name: fileName, content }] }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBadge('failed', '❌ Falha ao criar job');
        setPhase(`Erro: ${json?.error?.message || 'HTTP ' + res.status}`);
        return;
      }
      jobId = json.data?.jobId;
      setBadge('queued', '⏳ Aguardando…');
      setPhase('Job criado — aguardando execução…');
      const jobIdEl = _el('#sgj-jobid');
      if (jobIdEl) jobIdEl.textContent = `Job: ${jobId}`;
    } catch (err) {
      setBadge('failed', '❌ Erro de rede');
      setPhase(`Erro: ${err.message}`);
      return;
    }

    // 2. Poll status
    const FINAL = new Set(['DONE', 'PARTIAL', 'FAILED']);
    _syncJobPollingId = setInterval(async () => {
      try {
        const res = await fetch(`${_GCDR_SYNC_BASE}/api/v1/device-sync/jobs/${jobId}`, {
          headers: { 'X-API-Key': creds.gcdrApiKey },
        });
        if (!res.ok) return;
        const json = await res.json();
        const job = json.data;
        const phase = job.currentPhase || 'QUEUED';
        setProgress(_GCDR_PHASE_PROGRESS[phase] ?? 0);
        setPhase(_GCDR_PHASE_LABELS[phase] || phase);
        if (job.status === 'RUNNING' || job.status === 'QUEUED') setBadge('running', `🔄 ${phase}`);

        if (FINAL.has(job.status)) {
          clearInterval(_syncJobPollingId);
          _syncJobPollingId = null;
          setProgress(100);
          _sgjJobResult = job; // store for download report
          if (job.status === 'DONE')         { setBadge('done',    '✅ Concluído');           setPhase('Sincronização concluída com sucesso.'); }
          else if (job.status === 'PARTIAL') { setBadge('partial', '⚠️ Concluído com erros'); setPhase('Concluído — veja o log abaixo.'); }
          else                               { setBadge('failed',  '❌ Falha fatal');          setPhase('Erro fatal durante execução.'); }
          renderSummary(job.summary);

          // 3. Fetch and render log
          try {
            const logRes = await fetch(`${_GCDR_SYNC_BASE}/api/v1/device-sync/jobs/${jobId}/log`, {
              headers: { 'X-API-Key': creds.gcdrApiKey },
            });
            if (logRes.ok) {
              const logJson = await logRes.json();
              renderLog(logJson.data?.entries || []);
            }
          } catch { /* non-critical */ }
        }
      } catch { /* network hiccup — retry next tick */ }
    }, 2000);
  })();
}

/** RFC-0195: Cancels polling and removes modal from DOM. */
function _destroySyncJobModal() {
  if (_syncJobPollingId) { clearInterval(_syncJobPollingId); _syncJobPollingId = null; }
  if (_syncJobModalEl && _syncJobModalEl.parentElement) {
    _syncJobModalEl.parentElement.removeChild(_syncJobModalEl);
  }
  _syncJobModalEl = null;
}

function closeFilterModal() {
  $modal().addClass('hidden');
}

function bindModal() {
  // $m uses the stored direct reference — valid before AND after portal
  const $m = $modal();

  $m.on('click', '#closeFilter', closeFilterModal);

  // RFC-0152: Device map download — @myio.com.br only
  $m.on('click', '#btnDownloadDeviceMap', (ev) => {
    ev.preventDefault();
    const data = window[_exportKey];
    if (!data || data.length === 0) {
      alert('Nenhum dado de dispositivo disponível. Abra o painel de dados primeiro.');
      return;
    }
    const header = 'tbId|deviceName|label|identifier|deviceType|deviceProfile|slaveId|centralId|gcdrCustomerId|gcdrAssetId|gcdrDeviceId|gcdrSyncAt';
    const rows = data.map((d) =>
      [d.tbId, d.deviceName, d.label, d.identifier, d.deviceType, d.deviceProfile,
       d.slaveId, d.centralId, d.gcdrCustomerId, d.gcdrAssetId, d.gcdrDeviceId, d.gcdrSyncAt].join('|')
    );
    const content = header + '\n' + rows.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const _groupSlugs = { lojas: 'stores', entrada: 'entry', areacomum: 'commonarea', caixadagua: 'tanks' };
    const _labelWidget = self.ctx?.settings?.labelWidget || '';
    const _stateGroup = mapLabelWidgetToStateGroup(_labelWidget) || WIDGET_DOMAIN;
    const _groupSlug = _groupSlugs[_stateGroup] || _stateGroup;
    a.download = `device-map-${WIDGET_DOMAIN}-${new Date().toISOString().slice(0, 10)}-${WIDGET_DOMAIN}-${_groupSlug}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // RFC-0195: GCDR Device Sync Job — @myio.com.br only
  $m.on('click', '#btnSyncGCDR', (ev) => {
    ev.preventDefault();
    _handleSyncGCDR();
  });

  $m.on('click', '#selectAll', (ev) => {
    ev.preventDefault();
    $m.find('.check-item input[type="checkbox"]').prop('checked', true);
    syncChecklistSelectionVisual();
  });

  $m.on('click', '#clearAll', (ev) => {
    ev.preventDefault();
    $m.find('.check-item input[type="checkbox"]').prop('checked', false);
    syncChecklistSelectionVisual();
  });

  $m.on('click', '#resetFilters', (ev) => {
    ev.preventDefault();
    STATE.selectedIds = null;
    STATE.sortMode = 'cons_desc';
    STATE.alarmFilter = 'ativado';
    $m.find('.check-item input[type="checkbox"]').prop('checked', true);
    $m.find('input[name="sortMode"][value="cons_desc"]').prop('checked', true);
    $m.find('input[name="alarmFilter"][value="ativado"]').prop('checked', true);
    syncChecklistSelectionVisual();
    reflowFromState();
  });

  $m.on('click', '#applyFilters', (ev) => {
    ev.preventDefault();
    const set = new Set();
    $m.find('.check-item input[type="checkbox"]:checked').each((_, el) => {
      const id = $(el).data('entity');
      if (id) set.add(id);
    });

    STATE.selectedIds = set.size === 0 || set.size === STATE.itemsBase.length ? null : set;
    STATE.sortMode = String($m.find('input[name="sortMode"]:checked').val() || 'cons_desc');
    STATE.alarmFilter = /** @type {'ativado'|'desativado'|'apenas_ativados'} */ (
      String($m.find('input[name="alarmFilter"]:checked').val() || 'ativado')
    );

    reflowFromState();
    closeFilterModal();
  });

  $m.on('input', '#filterDeviceSearch', (ev) => {
    const q = (ev.target.value || '').trim().toLowerCase();
    $m.find('.check-item').each((_, node) => {
      const txt = $(node).text().trim().toLowerCase();
      $(node).toggle(txt.includes(q));
    });
  });

  $m.on('click', '#filterDeviceClear', (ev) => {
    ev.preventDefault();
    const $inp = $m.find('#filterDeviceSearch');
    $inp.val('');
    $m.find('.check-item').show();
    $inp.trigger('focus');
  });

  $m.on('click', '#deviceChecklist .check-item', function (ev) {
    if (ev.target && ev.target.tagName && ev.target.tagName.toLowerCase() === 'input') return;
    ev.preventDefault();
    ev.stopPropagation();
    const $chk = $(this).find('input[type="checkbox"]');
    $chk.prop('checked', !$chk.prop('checked')).trigger('change');
  });

  $m.on('change', '#deviceChecklist input[type="checkbox"]', function () {
    const $wrap = $(this).closest('.check-item');
    const on = this.checked;
    $wrap.toggleClass('selected', on).attr('data-checked', on ? 'true' : 'false');
    $wrap.css(
      on
        ? {
            background: 'rgba(62,26,125,.08)',
            borderColor: '#3E1A7D',
            boxShadow: '0 8px 18px rgba(62,26,125,.15)',
          }
        : {
            background: '#fff',
            borderColor: '#D6E1EC',
            boxShadow: '0 6px 14px rgba(0,0,0,.05)',
          }
    );
  });
}

/**
 * RFC-0130: Robust widget registration
 * RFC-0136: Enhanced with widget:ready event for late-arriving widgets
 */
function registerWithOrchestrator() {
  const widgetId =
    self.ctx.widget?.id || `telemetry-${WIDGET_DOMAIN}-${Math.random().toString(36).slice(2, 7)}`;
  const labelWidget = self.ctx.settings?.labelWidget || '';
  LogHelper.log(
    `[TELEMETRY ${WIDGET_DOMAIN}] 📝 Registering widget ${widgetId} (labelWidget: ${labelWidget})...`
  );

  // Step 1: Register with orchestrator
  window.dispatchEvent(
    new CustomEvent('myio:widget:register', {
      detail: {
        widgetId: widgetId,
        domain: WIDGET_DOMAIN,
      },
    })
  );

  // Step 2: RFC-0136 - Signal that widget is ready to receive data
  // This triggers MAIN_VIEW to re-emit provide-data if cached data exists
  window.dispatchEvent(
    new CustomEvent('myio:widget:ready', {
      detail: {
        widgetId: widgetId,
        domain: WIDGET_DOMAIN,
        labelWidget: labelWidget,
        timestamp: Date.now(),
      },
    })
  );
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 RFC-0136: Emitted widget:ready for ${widgetId}`);
}

function syncChecklistSelectionVisual() {
  $modal()
    .find('.check-item')
    .each(function () {
      const $el = $(this);
      const on = $el.find('input[type="checkbox"]').prop('checked');
      $el.toggleClass('selected', on).attr('data-checked', on ? 'true' : 'false');
      $el.css(
        on
          ? {
              background: 'rgba(62,26,125,.08)',
              borderColor: '#3E1A7D',
              boxShadow: '0 8px 18px rgba(62,26,125,.15)',
            }
          : {
              background: '#fff',
              borderColor: '#D6E1EC',
              boxShadow: '0 6px 14px rgba(0,0,0,.05)',
            }
      );
    });
}

/** ===================== RFC-0056 FIX v1.1: EMISSION ===================== **/

/**
 * Normaliza valor de kWh para MWh com 2 decimais
 * @param {number} kWhValue - valor em kWh
 * @returns {number} valor em MWh arredondado
 */
function normalizeToMWh(kWhValue) {
  if (typeof kWhValue !== 'number' || isNaN(kWhValue)) return 0;
  return Math.round((kWhValue / 1000) * 100) / 100;
}

/**
 * Normaliza label de dispositivo para classificação consistente
 * @param {string} str - label do dispositivo
 * @returns {string} label normalizado
 */
function normalizeLabel(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Dispatcher: determina tipo de widget e emite evento apropriado
 * RFC-0056 FIX v1.1: Consolidação em myio:telemetry:update
 */
function emitTelemetryUpdate() {
  try {
    // Determinar tipo de widget pelo datasource alias
    const widgetType = detectWidgetType();

    if (!widgetType) {
      LogHelper.log('[RFC-0056] Widget type not detected - skipping emission');
      return;
    }

    // Construir periodKey a partir do filtro atual
    const periodKey = buildPeriodKey();

    // RFC-0002: Domain-specific emission
    if (WIDGET_DOMAIN === 'water') {
      emitWaterTelemetry(widgetType, periodKey);
    } else {
      // Default: energy domain
      if (widgetType === 'lojas') {
        emitLojasTotal(periodKey);
      } else if (widgetType === 'areacomum') {
        emitAreaComumBreakdown(periodKey);
      } else if (widgetType === 'entrada') {
        // RFC-0098: Emit entrada total for energy domain
        emitEntradaTotal(periodKey);
      }
    }
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitTelemetryUpdate:', err);
  }
}

/**
 * Detecta tipo de widget baseado no datasource alias
 * RFC-0002: Added 'entrada' detection for water domain
 * RFC-0107: Added 'temperature' detection for temperature sensors
 * @returns {'lojas'|'areacomum'|'entrada'|'temperature'|null}
 */
function detectWidgetType() {
  try {
    LogHelper.log('🔍 [detectWidgetType] Iniciando detecção de tipo de widget...');

    const datasources = ctx.datasources || [];
    LogHelper.log(`[detectWidgetType] Total de datasources detectados: ${datasources.length}`);

    if (!datasources.length) {
      LogHelper.warn('[detectWidgetType] Nenhum datasource encontrado em ctx.datasources!');
      return null;
    }

    // Percorrer todos os datasources
    for (let i = 0; i < datasources.length; i++) {
      const ds = datasources[i];
      const alias = (ds.aliasName || '').toString().toLowerCase().trim();

      LogHelper.log(`🔸 [detectWidgetType] Verificando datasource[${i}]`);
      LogHelper.log(`    ↳ aliasName:     ${ds.aliasName || '(vazio)'}`);
      LogHelper.log(`    ↳ entityName:    ${ds.entityName || '(vazio)'}`);
      LogHelper.log(`    ↳ alias normalizado: "${alias}"`);

      if (!alias) {
        LogHelper.warn(`[detectWidgetType] ⚠️ Alias vazio ou indefinido no datasource[${i}].`);
        continue;
      }

      // RFC-0002: Check for entrada (water domain)
      // Use word boundary matching to avoid false positives like "bomba entrada"
      if (/\bentrada\b/.test(alias) || alias === 'entrada' || alias.includes('entrada')) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "entrada" (com base no alias "${alias}")`);
        return 'entrada';
      }

      // Match "lojas" as standalone word or at end of alias
      // AVOID false positives like "Bomba Lojas", "Subestação Lojas"
      // ACCEPT: "lojas", "widget-lojas", "telemetry-lojas", "consumidores lojas"
      // RFC-0097: Usa EQUIPMENT_EXCLUSION_PATTERN construído do config
      if (/\blojas\b/.test(alias) && !EQUIPMENT_EXCLUSION_PATTERN.test(alias)) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "lojas" (com base no alias "${alias}")`);
        return 'lojas';
      }

      // Match area comum with flexible separators
      if (/\barea\s*comum\b/.test(alias) || alias.includes('areacomum') || alias.includes('area_comum')) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "areacomum" (com base no alias "${alias}")`);
        return 'areacomum';
      }

      // RFC-0107: Match temperature sensors - aliases like "devices temp1", "temp", "temperature", "alltempdevices"
      if (/\btemp\b/.test(alias) || alias.includes('temp') || alias.includes('temperature')) {
        LogHelper.log(`✅ [detectWidgetType] Tipo detectado: "temperature" (com base no alias "${alias}")`);
        return 'temperature';
      }
    }

    LogHelper.warn('[detectWidgetType] ⚠️ Nenhum tipo de widget correspondente encontrado.');
    return null;
  } catch (err) {
    LogHelper.error('[detectWidgetType] ❌ Erro durante detecção de tipo de widget:', err);
    return null;
  }
}

/**
 * Constrói periodKey do filtro atual
 * Formato: "YYYY-MM-DD_YYYY-MM-DD" ou "realtime"
 */
function buildPeriodKey() {
  const timewindow = ctx.defaultSubscription?.subscriptionTimewindow;

  if (!timewindow || timewindow.realtimeWindowMs) {
    return 'realtime';
  }

  const startMs = timewindow.fixedWindow?.startTimeMs || Date.now() - 86400000;
  const endMs = timewindow.fixedWindow?.endTimeMs || Date.now();

  const startDate = new Date(startMs).toISOString().split('T')[0];
  const endDate = new Date(endMs).toISOString().split('T')[0];

  return `${startDate}_${endDate}`;
}

/**
 * RFC-0098: Emite evento entrada_total
 * TELEMETRY (Entrada) → TELEMETRY_INFO
 */
function emitEntradaTotal(periodKey) {
  try {
    // Calcular total de Entrada a partir dos itens enriquecidos
    const entradaTotal = STATE.itemsEnriched.reduce((sum, item) => {
      return sum + (item.value || 0);
    }, 0);

    const totalMWh = normalizeToMWh(entradaTotal);

    const payload = {
      type: 'entrada_total',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_Entrada',
      data: {
        total_kWh: entradaTotal,
        total_MWh: totalMWh,
        device_count: STATE.itemsEnriched.length,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:entrada_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0098] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);
    LogHelper.log(
      `[RFC-0098] ✅ Emitted entrada_total: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices)`
    );
  } catch (err) {
    LogHelper.error('[RFC-0098] Error in emitEntradaTotal:', err);
  }
}

/**
 * Emite evento lojas_total
 * RFC-0056 FIX v1.1: TELEMETRY (Lojas) → TELEMETRY_INFO
 */
function emitLojasTotal(periodKey) {
  try {
    // Calcular total de Lojas a partir dos itens enriquecidos
    const lojasTotal = STATE.itemsEnriched.reduce((sum, item) => {
      return sum + (item.value || 0);
    }, 0);

    const totalMWh = normalizeToMWh(lojasTotal);

    const payload = {
      type: 'lojas_total',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_Lojas',
      data: {
        total_kWh: lojasTotal,
        total_MWh: totalMWh,
        device_count: STATE.itemsEnriched.length,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:lojas_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0056] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);
    LogHelper.log(
      `[RFC-0056] ✅ Emitted lojas_total: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices)`
    );
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitLojasTotal:', err);
  }
}

// ============================================================================
// RFC-0106: Classification functions - NOW DELEGATES TO MAIN_VIEW
// These functions now use window.MyIOUtils which is populated by MAIN_VIEW
// ============================================================================

/**
 * RFC-0106: Classify device using deviceType as primary method
 * DELEGATES TO window.MyIOUtils.classifyDevice
 * @param {Object} item - Device item with deviceType, deviceProfile, identifier, and label
 * @returns {'climatizacao'|'elevadores'|'escadas_rolantes'|'outros'}
 */
function classifyDevice(item) {
  // RFC-0106: Use MAIN_VIEW's classification function
  if (window.MyIOUtils?.classifyDevice) {
    return window.MyIOUtils.classifyDevice(item);
  }
  // Fallback if MAIN_VIEW not loaded yet
  LogHelper.warn('[RFC-0106] classifyDevice: window.MyIOUtils not available, returning outros');
  return 'outros';
}

/**
 * Emite evento areacomum_breakdown
 * RFC-0056 FIX v1.1: TELEMETRY (AreaComum) → TELEMETRY_INFO
 * RFC-0097: Classification by deviceType, subcategories by identifier
 */
function emitAreaComumBreakdown(periodKey) {
  try {
    LogHelper.log(`[RFC-0097] emitAreaComumBreakdown: classification by deviceType`);

    // Classificar dispositivos por categoria (consumo e contagem)
    const breakdown = {
      climatizacao: { total: 0, count: 0 },
      elevadores: { total: 0, count: 0 },
      escadas_rolantes: { total: 0, count: 0 },
      outros: { total: 0, count: 0 },
    };

    // RFC-0097: Subcategorias de climatização agrupadas por identifier (ou deviceType se identifier vazio)
    // Mapa dinâmico: key = identifier ou deviceType, value = { total, count, label }
    const climatizacaoSubcategories = new Map();

    // RFC-0097: Subcategorias de "outros" agrupadas por deviceType
    const outrosSubcategories = new Map();

    STATE.itemsEnriched.forEach((item) => {
      const energia = item.value || 0;
      const category = classifyDevice(item);

      breakdown[category].total += energia;
      breakdown[category].count += 1;

      // RFC-0097: Agrupar subcategorias de climatização por identifier (ou deviceType)
      if (category === 'climatizacao') {
        const identifier = String(item.identifier || '')
          .toUpperCase()
          .trim();
        const deviceType = String(item.deviceType || '').toUpperCase();

        // Usar identifier como chave de agrupamento, ou deviceType se identifier estiver vazio
        let groupKey = identifier;
        let groupLabel = identifier;

        if (!identifier || identifier === 'N/A' || identifier === 'NULL' || identifier === 'UNDEFINED') {
          groupKey = deviceType || 'OUTROS';
          groupLabel = deviceType || 'Outros';
        }

        // Inicializar grupo se não existir
        if (!climatizacaoSubcategories.has(groupKey)) {
          climatizacaoSubcategories.set(groupKey, {
            total: 0,
            count: 0,
            label: groupLabel,
          });
        }

        // Acumular valores
        const group = climatizacaoSubcategories.get(groupKey);
        group.total += energia;
        group.count += 1;

        // Debug: Log climatização devices
        /*
        LogHelper.log(
          `[RFC-0097] Climatização: deviceType="${deviceType}", identifier="${identifier}", group="${groupKey}", value=${energia.toFixed(
            2
          )} kWh`
        );
        */
      }

      // RFC-0097: Agrupar subcategorias de "outros" por deviceType (ou deviceProfile se 3F_MEDIDOR)
      if (category === 'outros') {
        let deviceType = String(item.deviceType || 'DESCONHECIDO')
          .toUpperCase()
          .trim();

        // Se deviceType é 3F_MEDIDOR, usar deviceProfile como tipo real
        if (deviceType === '3F_MEDIDOR' && item.deviceProfile) {
          deviceType = String(item.deviceProfile).toUpperCase().trim();
        }

        // Usar deviceType como chave de agrupamento
        const groupKey = deviceType || 'DESCONHECIDO';
        const groupLabel = deviceType || 'Desconhecido';

        // Inicializar grupo se não existir
        if (!outrosSubcategories.has(groupKey)) {
          outrosSubcategories.set(groupKey, {
            total: 0,
            count: 0,
            label: groupLabel,
          });
        }

        // Acumular valores
        const group = outrosSubcategories.get(groupKey);
        group.total += energia;
        group.count += 1;
      }

      // Debug log for first 5 items
      if (STATE.itemsEnriched.indexOf(item) < 5) {
        LogHelper.log(
          `[RFC-0097] Item: deviceType="${item.deviceType}", identifier="${item.identifier}", label="${
            item.label
          }" → ${category} (${energia.toFixed(2)} kWh)`
        );
      }
    });

    // Converter Map para objeto para serialização
    const climatizacaoSubcategoriesObj = {};
    climatizacaoSubcategories.forEach((value, key) => {
      climatizacaoSubcategoriesObj[key.toLowerCase()] = value;
    });

    // RFC-0097: Converter outros subcategories Map para objeto
    const outrosSubcategoriesObj = {};
    outrosSubcategories.forEach((value, key) => {
      outrosSubcategoriesObj[key.toLowerCase()] = value;
    });

    // RFC-0097: Log subcategory totals for debugging
    const subcatSummary = {};
    climatizacaoSubcategories.forEach((value, key) => {
      subcatSummary[key] = `${value.count} devices, ${normalizeToMWh(value.total)} MWh`;
    });
    LogHelper.log(`[RFC-0097] Climatização subcategories breakdown:`, subcatSummary);

    // RFC-0097: Log outros subcategory totals
    const outrosSubcatSummary = {};
    outrosSubcategories.forEach((value, key) => {
      outrosSubcatSummary[key] = `${value.count} devices, ${normalizeToMWh(value.total)} MWh`;
    });
    LogHelper.log(`[RFC-0097] Outros subcategories breakdown:`, outrosSubcatSummary);

    const payload = {
      type: 'areacomum_breakdown',
      domain: 'energy',
      periodKey: periodKey,
      timestamp: Date.now(),
      source: 'TELEMETRY_AreaComum',
      data: {
        climatizacao_kWh: breakdown.climatizacao.total,
        climatizacao_MWh: normalizeToMWh(breakdown.climatizacao.total),
        climatizacao_count: breakdown.climatizacao.count,
        elevadores_kWh: breakdown.elevadores.total,
        elevadores_MWh: normalizeToMWh(breakdown.elevadores.total),
        elevadores_count: breakdown.elevadores.count,
        escadas_rolantes_kWh: breakdown.escadas_rolantes.total,
        escadas_rolantes_MWh: normalizeToMWh(breakdown.escadas_rolantes.total),
        escadas_rolantes_count: breakdown.escadas_rolantes.count,
        outros_kWh: breakdown.outros.total,
        outros_MWh: normalizeToMWh(breakdown.outros.total),
        outros_count: breakdown.outros.count,
        device_count: STATE.itemsEnriched.length,
        // RFC-0097: Subcategorias de climatização (objeto para serialização)
        climatizacao_subcategories: climatizacaoSubcategoriesObj,
        // RFC-0097: Subcategorias de "outros" agrupadas por deviceType
        outros_subcategories: outrosSubcategoriesObj,
      },
    };

    // Cache em sessionStorage
    const cacheKey = `myio:telemetry:areacomum_${periodKey}`;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
      LogHelper.warn('[RFC-0056] sessionStorage write failed:', e);
    }

    // Dispatch consolidated event
    const event = new CustomEvent('myio:telemetry:update', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);

    const totalMWh = normalizeToMWh(
      breakdown.climatizacao.total +
        breakdown.elevadores.total +
        breakdown.escadas_rolantes.total +
        breakdown.outros.total
    );
    LogHelper.log(
      `[RFC-0056] ✅ Emitted areacomum_breakdown: ${totalMWh} MWh (${STATE.itemsEnriched.length} devices, climatizacao: ${breakdown.climatizacao.count})`
    );
  } catch (err) {
    LogHelper.error('[RFC-0056] Error in emitAreaComumBreakdown:', err);
  }
}

/**
 * RFC-0002: Emit water telemetry data
 * Emits myio:telemetry:provide-water for TELEMETRY_INFO to consume
 * @param {string} widgetType - 'entrada', 'lojas', or 'areacomum' (detected from alias)
 * @param {string} periodKey - Period identifier
 */
function emitWaterTelemetry(widgetType, periodKey) {
  try {
    // Check for waterContext override in settings
    const waterContextOverride = self.ctx.settings?.waterContext;
    let context = null;

    // Use override if set and not 'auto'
    if (waterContextOverride && waterContextOverride !== 'auto') {
      context = waterContextOverride;
      LogHelper.log(`[RFC-0002 Water] Using waterContext override: ${context}`);
    } else {
      // Map widgetType to water context (auto-detection from alias)
      if (widgetType === 'entrada') {
        context = 'entrada';
      } else if (widgetType === 'lojas') {
        context = 'lojas';
      } else if (widgetType === 'areacomum') {
        context = 'areaComum';
      }
    }

    if (!context) {
      LogHelper.warn(`[RFC-0002 Water] Unknown widget type: ${widgetType}`);
      return;
    }

    // Calculate total in m³
    const totalM3 = STATE.itemsEnriched.reduce((sum, item) => sum + (item.value || 0), 0);

    // Build device list
    const devices = STATE.itemsEnriched.map((item) => ({
      id: item.id || item.entityId || '',
      identifier: item.identifier || item.deviceIdentifier || '', // FIX: incluir identifier para classificação de banheiros
      label: item.label || item.name || '',
      value: item.value || 0,
      deviceType: item.deviceType || 'HIDROMETRO',
    }));

    // RFC-0002: For areaComum context, classify devices into banheiros vs outros
    // Banheiros are identified by bathroom patterns in label or identifier (case-insensitive)
    let banheirosBreakdown = null;
    if (context === 'areaComum') {
      const BANHEIRO_PATTERNS = ['banheiro', 'wc', 'sanitario', 'toalete', 'lavabo'];
      const banheirosDevices = [];
      const outrosDevices = [];

      devices.forEach((device) => {
        const labelLower = (device.label || '').toLowerCase();
        const identifierLower = (device.identifier || '').toLowerCase(); // FIX: usar identifier, não id
        const isBanheiro = BANHEIRO_PATTERNS.some(
          (p) => labelLower.includes(p) || identifierLower.includes(p)
        );

        if (isBanheiro) {
          banheirosDevices.push(device);
        } else {
          outrosDevices.push(device);
        }
      });

      const banheirosTotal = banheirosDevices.reduce((sum, d) => sum + (d.value || 0), 0);
      const outrosTotal = outrosDevices.reduce((sum, d) => sum + (d.value || 0), 0);

      banheirosBreakdown = {
        banheiros: {
          total: banheirosTotal,
          devices: banheirosDevices,
          count: banheirosDevices.length,
        },
        outros: {
          total: outrosTotal,
          devices: outrosDevices,
          count: outrosDevices.length,
        },
      };

      LogHelper.log(
        `[RFC-0002 Water] areaComum breakdown: banheiros=${banheirosTotal.toFixed(2)} m³ (${
          banheirosDevices.length
        } devices), outros=${outrosTotal.toFixed(2)} m³ (${outrosDevices.length} devices)`
      );
    }

    const payload = {
      context: context,
      domain: 'water',
      total: totalM3,
      devices: devices,
      periodKey: periodKey,
      timestamp: new Date().toISOString(),
      // RFC-0002: Include banheiros breakdown for areaComum context
      banheirosBreakdown: banheirosBreakdown,
    };

    // Dispatch water event
    const event = new CustomEvent('myio:telemetry:provide-water', {
      detail: payload,
      bubbles: true,
      cancelable: false,
    });

    window.dispatchEvent(event);

    LogHelper.log(
      `[RFC-0002 Water] ✅ Emitted water telemetry: context=${context}, total=${totalM3.toFixed(
        2
      )} m³, devices=${devices.length}`
    );
  } catch (err) {
    LogHelper.error('[RFC-0002 Water] Error in emitWaterTelemetry:', err);
  }
}

/** ===================== RECOMPUTE (local only) ===================== **/
function reflowFromState() {
  const visible = applyFilters(
    STATE.itemsEnriched,
    STATE.searchTerm,
    STATE.selectedIds,
    STATE.sortMode,
    STATE.alarmFilter
  );
  const { visible: withPerc, groupSum } = recomputePercentages(visible);
  STATE.lastVisible = withPerc;
  renderHeader(withPerc.length, groupSum);
  renderList(withPerc);
}

/** ===================== HYDRATE (end-to-end) ===================== **/
/**
 * RFC-0106: hydrateAndRender requests data from orchestrator (MAIN_VIEW).
 * No datasources, no ctx.data, no direct API calls.
 * All data comes from orchestrator via 'myio:telemetry:provide-data' event.
 */
async function hydrateAndRender() {
  if (hydrating) return;
  hydrating = true;

  showBusy();

  try {
    // Check for date range
    let hasDateRange = false;
    try {
      mustGetDateRange();
      hasDateRange = true;
    } catch (_e) {
      LogHelper.warn('[RFC-0106] No date range set, waiting for orchestrator...');
    }

    // RFC-0106: Request data from orchestrator for ALL domains
    // No local itemsBase building - orchestrator provides everything
    if (hasDateRange) {
      LogHelper.log(`[RFC-0106] Requesting ${WIDGET_DOMAIN} data from orchestrator`);

      const period = {
        startISO: self.ctx.scope?.startDateISO,
        endISO: self.ctx.scope?.endDateISO,
        granularity: window.calcGranularity
          ? window.calcGranularity(self.ctx.scope?.startDateISO, self.ctx.scope?.endDateISO)
          : 'day',
        tz: 'America/Sao_Paulo',
      };

      window.dispatchEvent(
        new CustomEvent('myio:telemetry:request-data', {
          detail: { domain: WIDGET_DOMAIN, period },
        })
      );

      // dataProvideHandler will handle the response and call hideBusy
      hydrating = false;
      return;
    }

    // No date range yet - just wait
    LogHelper.log('[RFC-0106] Waiting for date range and orchestrator data...');
  } finally {
    hydrating = false;
    // Don't hide busy here - dataProvideHandler will hide it
  }
}

/** ===================== TB LIFE CYCLE ===================== **/
self.onInit = async function () {
  $(self.ctx.$container).css({
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  });

  MyIO = (typeof MyIOLibrary !== 'undefined' && MyIOLibrary) ||
    (typeof window !== 'undefined' && window.MyIOLibrary) || {
      showAlert: function () {
        alert('A Bliblioteca Myio não foi carregada corretamente!');
      },
    };

  $root().find('#labelWidgetId').text(self.ctx.settings?.labelWidget);

  // RFC-0042: Set widget configuration from settings FIRST
  // CRITICAL: DOMAIN must be explicitly set in widget settings - no fallback to avoid water showing as energy
  const configuredDomain = self.ctx.settings?.DOMAIN;
  const validDomains = ['energy', 'water', 'temperature', 'tank'];

  if (!configuredDomain || !validDomains.includes(configuredDomain)) {
    LogHelper.error(
      `[TELEMETRY] ❌ CRITICAL: Invalid or missing DOMAIN in widget settings: "${configuredDomain}". Valid values: ${validDomains.join(
        ', '
      )}`
    );
    LogHelper.error(
      `[TELEMETRY] ❌ Widget labelWidget="${self.ctx.settings?.labelWidget}" must have DOMAIN configured correctly!`
    );
  }

  WIDGET_DOMAIN = configuredDomain || 'energy'; // Keep fallback for backwards compatibility but log error above
  // RFC-0152: Build per-widget export key so multiple TELEMETRY instances don't share the buffer
  const _lwGroup = mapLabelWidgetToStateGroup(self.ctx.settings?.labelWidget || '') || WIDGET_DOMAIN;
  _exportKey = `_deviceDataExport_${WIDGET_DOMAIN}_${_lwGroup}`;
  LogHelper.log(`[TELEMETRY] Configured EARLY: domain=${WIDGET_DOMAIN}, exportKey=${_exportKey}`);

  // Show temperature info icon for temperature domain
  if (WIDGET_DOMAIN === 'temperature') {
    const tempInfoTrigger = $root().find('#tempInfoTrigger');
    if (tempInfoTrigger.length) {
      tempInfoTrigger.css('display', 'inline-flex');

      // Use TempSensorSummaryTooltip from myio-js-library (premium tooltip with drag, pin, maximize, close)
      if (MyIO?.TempSensorSummaryTooltip) {
        // Attach using the library component
        _tempTooltipCleanup = MyIO.TempSensorSummaryTooltip.attach(
          tempInfoTrigger[0],
          buildTempSensorSummaryData
        );
        LogHelper.log(
          '[TELEMETRY] Temperature info icon initialized with TempSensorSummaryTooltip (library)'
        );
      } else {
        // Fallback to legacy tooltip if library not available
        tempInfoTrigger.on('mouseenter', function (e) {
          showTempInfoTooltip(this);
        });
        tempInfoTrigger.on('mouseleave', function () {
          hideTempInfoTooltip();
        });
        LogHelper.warn('[TELEMETRY] TempSensorSummaryTooltip not found in library, using legacy tooltip');
      }
    }
  }

  // RFC-0063: Load classification mode configuration
  USE_IDENTIFIER_CLASSIFICATION = self.ctx.settings?.USE_IDENTIFIER_CLASSIFICATION || false;
  USE_HYBRID_CLASSIFICATION = self.ctx.settings?.USE_HYBRID_CLASSIFICATION || false;
  LogHelper.log(
    `[RFC-0063] Classification mode: ${
      USE_IDENTIFIER_CLASSIFICATION
        ? USE_HYBRID_CLASSIFICATION
          ? 'HYBRID (identifier + label fallback)'
          : 'IDENTIFIER ONLY'
        : 'LEGACY (label only)'
    }`
  );

  // RFC-0042: Request data from orchestrator (defined early for use in handlers)
  function requestDataFromOrchestrator(isRetry = false) {
    const hasDateRange = self.ctx.scope?.startDateISO && self.ctx.scope?.endDateISO;

    if (!hasDateRange) {
      LogHelper.warn(`[TELEMETRY ${WIDGET_DOMAIN}] No date range set`);

      // For energy/water domains, still render UI to enable buttons (skip API call)
      if (WIDGET_DOMAIN === 'energy' || WIDGET_DOMAIN === 'water') {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Energy/Water domain - rendering UI without data fetch`);
        if (typeof hydrateAndRender === 'function') {
          hydrateAndRender();
        }
      }
      return;
    }

    const period = {
      startISO: self.ctx.scope.startDateISO,
      endISO: self.ctx.scope.endDateISO,
      granularity: window.calcGranularity
        ? window.calcGranularity(self.ctx.scope.startDateISO, self.ctx.scope.endDateISO)
        : 'day',
      tz: 'America/Sao_Paulo',
    };

    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Requesting data${isRetry ? ' (RETRY)' : ''} period:`, period);

    // RFC-0053: Single window context - emit to current window only
    window.dispatchEvent(
      new CustomEvent('myio:telemetry:request-data', {
        detail: {
          domain: WIDGET_DOMAIN,
          period,
          isRetry,
          widgetId: self.ctx.widget?.id,
        },
      })
    );

    // RFC-0130: Setup timeout fallback if data doesn't arrive in 8s
    if (busyTimeoutId) clearTimeout(busyTimeoutId);
    busyTimeoutId = setTimeout(() => {
      if (!STATE.itemsBase || STATE.itemsBase.length === 0) {
        // Check if busy is showing (either local or global)
        const isBusy =
          window.busyInProgress ||
          (window.MyIOOrchestrator?.getBusyState && window.MyIOOrchestrator.getBusyState().isVisible);

        if (isBusy) {
          LogHelper.warn(`[TELEMETRY ${WIDGET_DOMAIN}] 🕒 Timeout waiting for data, retrying request...`);
          // Somente tenta de novo se ainda estamos "busy" e sem dados
          requestDataFromOrchestrator(true);
        }
      }
    }, 8000);
  }

  // Listener com modal: evento externo de mudança de data
  dateUpdateHandler = function (ev) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ DATE UPDATE EVENT RECEIVED!`, ev.detail);

    try {
      // RFC-0042: Handle both old and new format
      let startISO, endISO;

      if (ev.detail?.period) {
        // New format from HEADER
        startISO = ev.detail.period.startISO;
        endISO = ev.detail.period.endISO;
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Using NEW format (period object)`);
      } else {
        // Old format (backward compatibility)
        const { startDate, endDate } = ev.detail || {};
        startISO = new Date(startDate).toISOString();
        endISO = new Date(endDate).toISOString();
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Using OLD format (startDate/endDate)`);
      }

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Date range updated:`, startISO, endISO);

      // Datas mandatórias salvas no scope
      self.ctx.scope = self.ctx.scope || {};
      self.ctx.scope.startDateISO = startISO;
      self.ctx.scope.endDateISO = endISO;

      // IMPORTANT: Reset lastProcessedPeriodKey when new date range is selected
      // This allows processing fresh data for the new period
      lastProcessedPeriodKey = null;
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔄 Reset lastProcessedPeriodKey for new date range`);

      // Exibe modal
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🔄 Calling showBusy()...`);
      showBusy();
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ showBusy() called`);

      // RFC-0045 FIX: Check if there's a pending provide-data event waiting for this period
      if (pendingProvideData) {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ Found pending provide-data event, processing now...`);
        const pending = pendingProvideData;
        pendingProvideData = null; // Clear pending event

        // Process the pending event immediately
        dataProvideHandler({ detail: pending });
        return; // Don't request data again, we already have it
      }

      // For temperature domain, use hydrateAndRender directly (no API needed, uses ctx.data only)
      if (WIDGET_DOMAIN === 'temperature') {
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] ✅ Temperature domain - using hydrateAndRender directly (no orchestrator)`
        );
        hasRequestedInitialData = true;

        if (typeof hydrateAndRender === 'function') {
          hydrateAndRender();
        } else {
          LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] hydrateAndRender não encontrada.`);
        }
      } else {
        // RFC-0053: Direct access to orchestrator (single window context)
        const orchestrator = window.MyIOOrchestrator;

        if (orchestrator) {
          LogHelper.log(
            `[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0053: Requesting data from orchestrator (single window)`
          );

          // IMPORTANT: Mark as requested BEFORE calling requestDataFromOrchestrator
          // This prevents the setTimeout(500ms) from making a duplicate request
          hasRequestedInitialData = true;

          requestDataFromOrchestrator();
        } else {
          // Fallback to old behavior
          LogHelper.warn(`[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ Orchestrator not available, using legacy fetch`);

          if (typeof hydrateAndRender === 'function') {
            hydrateAndRender();
          } else {
            LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] hydrateAndRender não encontrada.`);
          }
        }
      }
    } catch (err) {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] dateUpdateHandler error:`, err);
      hideBusy();
    }
  };

  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Registering myio:update-date listener...`);
  window.addEventListener('myio:update-date', dateUpdateHandler);
  LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ myio:update-date listener registered!`);

  // RFC-0130: Listen for dashboard state changes to react active visible domain
  const dashboardStateHandler = function (ev) {
    const { tab } = ev.detail;
    if (tab === WIDGET_DOMAIN) {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🎯 My tab became active!`);

      // Se estamos sem dados, tentar carregar do cache ou pedir nova carga
      if (!STATE.itemsBase || STATE.itemsBase.length === 0) {
        const cachedData = window.MyIOOrchestratorData?.[WIDGET_DOMAIN];
        if (cachedData && cachedData.items && cachedData.items.length > 0) {
          const age = Date.now() - cachedData.timestamp;
          if (age < 60000) {
            LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⚡ Found fresh data in cache on tab switch`);
            dataProvideHandler({ detail: cachedData });
            return;
          }
        }

        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Active but no data - requesting fresh dataset`);
        showBusy();
        requestDataFromOrchestrator();
      }
    }
  };
  window.addEventListener('myio:dashboard-state', dashboardStateHandler);

  // RFC-0042: Listen for clear event from HEADER (when user clicks "Limpar" button)
  window.addEventListener('myio:telemetry:clear', (ev) => {
    const { domain } = ev.detail;

    // Only clear if it's for my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Ignoring clear event for domain: ${domain}`);
      return;
    }

    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧹 Received clear event - clearing ALL state`);

    try {
      // HARD: Clear ALL state variables
      STATE.itemsBase = [];
      STATE.itemsEnriched = [];
      STATE.selectedIds = null;
      STATE.searchActive = false;
      STATE.searchTerm = '';
      STATE.firstHydrates = 0;
      hydrating = false;
      hasRequestedInitialData = false;
      lastProcessedPeriodKey = null;

      // IMPORTANT: Use $root() to get elements within THIS widget's scope
      const $widget = $root();

      // Clear the visual list
      const $shopsList = $widget.find('#shopsList');
      if ($shopsList.length > 0) {
        $shopsList.empty();
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsList cleared`);
      }

      // Reset counts to 0
      const $shopsCount = $widget.find('#shopsCount');
      const $shopsTotal = $widget.find('#shopsTotal');

      if ($shopsCount.length > 0) {
        $shopsCount.text('(0)');
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsCount reset to 0`);
      }

      if ($shopsTotal.length > 0) {
        $shopsTotal.text('0,00');
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ shopsTotal reset to 0,00`);
      }

      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧹 Clear completed successfully`);
    } catch (err) {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] ❌ Error during clear:`, err);
    }
  });

  // RFC-0108: Listen for measurement settings changes to re-render cards with new formatting
  window.addEventListener('myio:measurement-settings-updated', (ev) => {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📐 Measurement settings updated - re-rendering cards...`);
    try {
      // Re-render cards with new formatting (reflowFromState re-renders the list)
      if (STATE.itemsEnriched && STATE.itemsEnriched.length > 0) {
        reflowFromState();
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ Cards re-rendered with new measurement settings`);
      }
    } catch (err) {
      LogHelper.error(
        `[TELEMETRY ${WIDGET_DOMAIN}] ❌ Error re-rendering after measurement settings change:`,
        err
      );
    }
  });

  // Test if listener is working
  setTimeout(() => {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 🧪 Testing listener registration...`);
    const testEvent = new CustomEvent('myio:update-date', {
      detail: {
        period: {
          startISO: '2025-09-26T00:00:00-03:00',
          endISO: '2025-10-02T23:59:59-03:00',
          granularity: 'day',
          tz: 'America/Sao_Paulo',
        },
      },
    });
    // Don't dispatch, just check if handler exists
    if (typeof dateUpdateHandler === 'function') {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ✅ dateUpdateHandler is defined and ready`);
    } else {
      LogHelper.error(`[TELEMETRY ${WIDGET_DOMAIN}] ❌ dateUpdateHandler is NOT defined!`);
    }
  }, 100);

  // RFC-0045 FIX: Store pending provide-data events that arrive before update-date
  let pendingProvideData = null;

  /**
   * RFC-0106: Listen for data provision from orchestrator
   * Now reads directly from window.STATE instead of processing event items
   */
  dataProvideHandler = function (ev) {
    const { domain, periodKey } = ev.detail;

    LogHelper.log(
      `[TELEMETRY ${WIDGET_DOMAIN}] 📦 Received provide-data event for domain ${domain}, periodKey: ${periodKey}`
    );

    // Only process if it's for my domain
    if (domain !== WIDGET_DOMAIN) {
      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] ⏭️ Ignoring event for domain ${domain}, my domain is ${WIDGET_DOMAIN}`
      );
      return;
    }

    // Triple-check: Detect shopping change by comparing customerTB_ID in periodKey
    // periodKey format: "customerTB_ID:domain:startISO:endISO:granularity"
    const currentCustomerId = periodKey.split(':')[0];
    const lastCustomerId = lastProcessedPeriodKey?.split(':')[0];
    if (lastCustomerId && currentCustomerId !== lastCustomerId) {
      LogHelper.warn(
        `[TELEMETRY] 🔄 Shopping changed (${lastCustomerId} → ${currentCustomerId}) - resetting cache`
      );
      lastProcessedPeriodKey = null;
      STATE.itemsBase = [];
      STATE.itemsEnriched = [];
      STATE.searchActive = false;
      STATE.searchTerm = '';
      STATE.selectedIds = null;
      STATE.firstHydrates = 0;
      hydrating = false;
      hasRequestedInitialData = false;
    }

    // Prevent duplicate processing of the same periodKey
    if (lastProcessedPeriodKey === periodKey) {
      LogHelper.log(`[TELEMETRY] ⏭️ Skipping duplicate provide-data for periodKey: ${periodKey}`);
      return;
    }

    // Validate current period matches
    const myPeriod = {
      startISO: self.ctx.scope?.startDateISO,
      endISO: self.ctx.scope?.endDateISO,
    };

    // If period not set yet, store event for later processing
    // RFC-0106 FIX: Skip period check for temperature domain (uses real-time readings, no period needed)
    if (domain !== 'temperature' && (!myPeriod.startISO || !myPeriod.endISO)) {
      LogHelper.warn(`[TELEMETRY] ⏸️ Period not set yet, storing provide-data event...`);
      pendingProvideData = { domain, periodKey, items: ev.detail.items };

      // AUTO-PROCESS após 2 segundos se o período ainda não chegou
      setTimeout(() => {
        if (pendingProvideData && (!self.ctx.scope?.startDateISO || !self.ctx.scope?.endDateISO)) {
          LogHelper.log(`[TELEMETRY] 🔄 Auto-processing pending data (period still not set)`);
          const pending = pendingProvideData;
          pendingProvideData = null;
          // Process mesmo sem período (para water/lojas é aceitável)
          lastProcessedPeriodKey = pending.periodKey;
          const stateItems = getItemsFromState(pending.domain, self.ctx.settings?.labelWidget || '');

          if (stateItems && stateItems.length > 0) {
            // Build itemsBase from state items
            STATE.itemsBase = stateItems.map((item) => {
              const temp = Number(item.value || 0);
              const deviceStatus = item.deviceStatus || 'no_info';
              const connectionStatus = item.connectionStatus || 'unknown';

              return {
                id: item.tbId || item.id,
                tbId: item.tbId || item.id,
                ingestionId: item.ingestionId || null,
                identifier: item.identifier || item.id,
                label: item.label || item.name || item.identifier || item.id,
                entityLabel: item.entityLabel || item.label || item.name || '',
                value: temp,
                perc: 0,
                deviceType: item.deviceType || WIDGET_DOMAIN,
                deviceProfile: item.deviceProfile || null,
                effectiveDeviceType:
                  item.effectiveDeviceType || item.deviceProfile || item.deviceType || null,
                slaveId: item.slaveId || null,
                centralId: item.centralId || null,
                centralName: item.centralName || null,
                customerName: item.customerName || null,
                deviceStatus: deviceStatus,
                connectionStatus: connectionStatus,
                labelWidget: item.labelWidget || self.ctx.settings?.labelWidget,
                log_annotations: item.log_annotations || null,
                // RFC-0183: GCDR device UUID for AlarmServiceOrchestrator badge lookup
                gcdrDeviceId: item.gcdrDeviceId || null,
                // RFC-0198: freshdesk_tickets SERVER_SCOPE dataKey (fallback badge source)
                freshdeskTickets: item.freshdeskTickets || null,
                // RFC-0152: Per-device GCDR mapping fields (TB↔GCDR sync audit)
                entityName: item.entityName || '',
                gcdrCustomerId: item.gcdrCustomerId || null,
                gcdrAssetId: item.gcdrAssetId || null,
                gcdrSyncAt: item.gcdrSyncAt || null,
              };
            });

            window._telemetryAuthoritativeItems = STATE.itemsBase;
            STATE.itemsEnriched = STATE.itemsBase.map((item) => ({ ...item }));

            LogHelper.log(`[TELEMETRY] 📊 Auto-processed pending data: ${STATE.itemsEnriched.length} items`);

            emitTelemetryUpdate();
            reflowFromState();
            hideBusy();
          } else {
            LogHelper.warn(`[TELEMETRY] ⚠️ Auto-process failed: no state items found`);
          }
        }
      }, 2000);
      return;
    }

    // Mark this periodKey as processed
    lastProcessedPeriodKey = periodKey;

    // RFC-0106: Get items directly from window.STATE
    const myLabelWidget = self.ctx.settings?.labelWidget || '';
    const stateItems = getItemsFromState(domain, myLabelWidget);

    if (!stateItems) {
      LogHelper.warn(`[TELEMETRY] ⚠️ No items found in window.STATE for domain ${domain}`);
      return;
    }

    LogHelper.log(
      `[RFC-0106] Got ${stateItems.length} items from window.STATE for labelWidget="${myLabelWidget}"`
    );

    // RFC-0106: Convert STATE items to widget format
    // FIX: Don't use item.id as fallback for ingestionId - temperature sensors don't have ingestionId
    // Using item.id would make tbId === ingestionId which fails the Settings validation

    // Get global temperature limits from MyIOUtils (set by MAIN_VIEW from customer attributes)
    const globalTempMin = window.MyIOUtils?.temperatureLimits?.minTemperature ?? null;
    const globalTempMax = window.MyIOUtils?.temperatureLimits?.maxTemperature ?? null;

    if (domain === 'temperature') {
      LogHelper.log(
        `[RFC-0106] Temperature limits from MyIOUtils: min=${globalTempMin}, max=${globalTempMax}`
      );
    }

    STATE.itemsBase = stateItems.map((item) => {
      // Calculate temperatureStatus for temperature domain devices
      // (can be TERMOSTATO, SENSOR_TEMP, or other temperature-related deviceTypes)
      let temperatureStatus = null;
      const isTemperatureDomain = domain === 'temperature';
      const isEnergyDomain = domain === 'energy';
      const rawTemp = Number(item.value || 0);

      // Apply temperature offset if available (from dataKey "offSetTemperature")
      // The offset can be positive or negative and is added to the raw temperature
      const deviceTbId = item.tbId || item.id;
      const tempOffset = isTemperatureDomain
        ? (item.offSetTemperature ?? getTemperatureOffset(deviceTbId))
        : 0;
      const temp =
        isTemperatureDomain && tempOffset !== 0 ? applyTemperatureOffset(rawTemp, tempOffset) : rawTemp;

      if (isTemperatureDomain && temp && globalTempMin !== null && globalTempMax !== null) {
        if (temp > globalTempMax) {
          temperatureStatus = 'above';
        } else if (temp < globalTempMin) {
          temperatureStatus = 'below';
        } else {
          temperatureStatus = 'ok';
        }
      }

      // RFC-0130: Use deviceStatus from orchestrator (calculated in MAIN_VIEW createOrchestratorItem)
      // This centralizes all deviceStatus logic including power ranges calculation
      const deviceStatus = item.deviceStatus || 'no_info';
      const connectionStatus = item.connectionStatus || 'unknown';

      // RFC-0107: Calculate percentage and value for water tanks
      const isTankDevice =
        item._isTankDevice || item.deviceType === 'TANK' || item.deviceType === 'CAIXA_DAGUA';
      let itemPerc = 0;
      let itemValue = temp;

      if (isTankDevice) {
        // waterPercentage is 0-1 range, convert to 0-100 for display
        if (item.waterPercentage != null) {
          itemPerc = item.waterPercentage * 100;
        }
        // Use waterLevel as value (in liters/m³)
        if (item.waterLevel != null) {
          itemValue = item.waterLevel;
        }
      }

      return {
        id: item.tbId || item.id,
        tbId: item.tbId || item.id,
        ingestionId: item.ingestionId || null, // Don't fallback to item.id
        identifier: item.identifier || item.id,
        label: item.label || item.name || item.identifier || item.id,
        entityLabel: item.entityLabel || item.label || item.name || '',
        value: itemValue,
        perc: itemPerc,
        deviceType: item.deviceType || WIDGET_DOMAIN,
        deviceProfile: item.deviceProfile || null,
        effectiveDeviceType: item.effectiveDeviceType || item.deviceProfile || item.deviceType || null,
        slaveId: item.slaveId || null,
        centralId: item.centralId || null,
        centralName: item.centralName || null,
        customerName: item.customerName || null,
        deviceStatus: deviceStatus,
        connectionStatus: connectionStatus,
        labelWidget: item.labelWidget || myLabelWidget,
        updatedIdentifiers: {},
        // Connection timing fields (for Settings modal)
        connectionStatusTime: item.lastConnectTime || null,
        timeVal: item.lastActivityTime || null,
        lastConnectTime: item.lastConnectTime || null,
        lastActivityTime: item.lastActivityTime || null,
        lastDisconnectTime: item.lastDisconnectTime || null,
        // Annotations
        log_annotations: item.log_annotations || null,
        // Power limits and instantaneous power
        // RFC-0106: Prefer MyIOUtils (from MAIN_VIEW) over local MAP_INSTANTANEOUS_POWER
        mapInstantaneousPower:
          item.mapInstantaneousPower ||
          window.MyIOUtils?.mapInstantaneousPower ||
          MAP_INSTANTANEOUS_POWER ||
          null,
        deviceMapInstaneousPower: item.deviceMapInstaneousPower || null,
        consumptionPower: item.consumptionPower || null,
        // Temperature domain specific fields - use global limits from customer
        temperature: isTemperatureDomain ? temp : null,
        temperatureRaw: isTemperatureDomain ? rawTemp : null, // Original value before offset
        temperatureOffset: isTemperatureDomain ? tempOffset : null, // Offset applied (can be + or -)
        temperatureMin: isTemperatureDomain ? globalTempMin : null,
        temperatureMax: isTemperatureDomain ? globalTempMax : null,
        temperatureStatus: temperatureStatus,
        // RFC-0107: Water tank specific fields
        waterLevel: item.waterLevel ?? null,
        waterPercentage: item.waterPercentage ?? null,
        _isTankDevice: item._isTankDevice || false,
        _isHidrometerDevice: item._isHidrometerDevice || false,
        // RFC-0183: GCDR device UUID for AlarmServiceOrchestrator badge lookup
        gcdrDeviceId: item.gcdrDeviceId || null,
        // RFC-0198: freshdesk_tickets SERVER_SCOPE dataKey (fallback badge source)
        freshdeskTickets: item.freshdeskTickets || null,
        // RFC-0152: Per-device GCDR mapping fields (TB↔GCDR sync audit)
        entityName: item.entityName || '',
        gcdrCustomerId: item.gcdrCustomerId || null,
        gcdrAssetId: item.gcdrAssetId || null,
        gcdrSyncAt: item.gcdrSyncAt || null,
      };
    });

    window._telemetryAuthoritativeItems = STATE.itemsBase;

    // Items come enriched from orchestrator
    STATE.itemsEnriched = STATE.itemsBase.map((item) => ({ ...item }));

    LogHelper.log(`[RFC-0106] Final items: ${STATE.itemsEnriched.length}`);

    // RFC-0056 FIX v1.1: Emit telemetry update after enrichment
    emitTelemetryUpdate();

    // Sanitize selection
    if (STATE.selectedIds && STATE.selectedIds.size) {
      const valid = new Set(STATE.itemsBase.map((x) => x.id));
      const next = new Set([...STATE.selectedIds].filter((id) => valid.has(id)));
      STATE.selectedIds = next.size ? next : null;
    }

    reflowFromState();

    // RFC-0044: ALWAYS hide busy when data is provided, regardless of source
    LogHelper.log(`[TELEMETRY] 🏁 Data processed successfully - ensuring busy is hidden`);

    // Force hide busy with minimal delay to ensure UI update
    setTimeout(() => {
      hideBusy();
      // Double-check: if orchestrator busy is still showing, force hide it
      if (window.MyIOOrchestrator && window.MyIOOrchestrator.getBusyState) {
        const busyState = window.MyIOOrchestrator.getBusyState();
        if (busyState.isVisible) {
          LogHelper.warn(
            `[TELEMETRY] ⚠️ Orchestrator busy still visible after data processing - force hiding`
          );
          window.MyIOOrchestrator.hideGlobalBusy();
        }
      }
    }, 100);
  };

  window.addEventListener('myio:telemetry:provide-data', dataProvideHandler);

  // RFC-0130: Register widget with orchestrator
  registerWithOrchestrator();

  // RFC-0056 FIX v1.1: Listen for request_refresh from TELEMETRY_INFO
  let requestRefreshHandler = function (ev) {
    const { type, domain, periodKey } = ev.detail || {};

    if (type !== 'request_refresh') return;
    if (domain !== WIDGET_DOMAIN) return;

    LogHelper.log(`[RFC-0056] Received request_refresh for domain ${domain}, periodKey ${periodKey}`);

    // Re-emit telemetry data
    const currentPeriodKey = buildPeriodKey();
    if (currentPeriodKey === periodKey) {
      LogHelper.log(`[RFC-0056] Re-emitting data for current period`);
      emitTelemetryUpdate();
    } else {
      LogHelper.warn(`[RFC-0056] Period mismatch: requested ${periodKey}, current ${currentPeriodKey}`);
    }
  };

  window.addEventListener('myio:telemetry:update', requestRefreshHandler);

  // myio:alarms-updated — fired by MAIN_VIEW after each ASO rebuild.
  // Refreshes badge counts on all currently-rendered TELEMETRY cards without re-rendering.
  window.addEventListener('myio:alarms-updated', refreshAlarmBadges);

  // RFC-0198: myio:tickets-ready — fired by TicketServiceOrchestrator after each build/refresh.
  // Refreshes ticket badge counts on all currently-rendered TELEMETRY cards without re-rendering.
  window.addEventListener('myio:tickets-ready', refreshTicketBadges);

  // RFC-0196: Listen for group filter changes from TELEMETRY_INFO widget
  window.addEventListener('myio:group-filter-changed', _groupFilterChangedHandler);

  // Show #btnPresetup, #btnDownloadDeviceMap and #btnSyncGCDR only for MyIO users (@myio.com.br)
  function _applyPresetupVisibility(isSuperAdmin) {
    const btn = $root().find('#btnPresetup')[0];
    if (btn) btn.style.display = isSuperAdmin ? '' : 'none';
    // RFC-0152: Device map download button — visible only for @myio.com.br
    const btnDl = (_filterModalElement || $root()[0])?.querySelector('#btnDownloadDeviceMap');
    if (btnDl) btnDl.style.display = isSuperAdmin ? 'inline-flex' : 'none';
    // RFC-0195: Sync GCDR button — visible only for @myio.com.br
    const btnSync = (_filterModalElement || $root()[0])?.querySelector('#btnSyncGCDR');
    if (btnSync) btnSync.style.display = isSuperAdmin ? 'inline-flex' : 'none';
  }
  // Check immediately in case event already fired before this widget loaded
  _applyPresetupVisibility(window.MyIOUtils?.SuperAdmin === true);
  window.addEventListener('myio:user-info-ready', (ev) => {
    _applyPresetupVisibility(ev.detail?.isSuperAdmin === true);
  });

  // RFC-0136: Intelligent retry with backoff for late-arriving widgets
  // Instead of single 500ms timeout, use multiple retries with increasing delays
  const RETRY_INTERVALS = [500, 1000, 2000, 3000, 4000, 5000]; // Backoff: 500ms, 1s, 2s
  let retryIndex = 0;
  let dataLoadedSuccessfully = false;

  /**
   * RFC-0136: Check for stored data and attempt to load
   * Returns true if data was successfully loaded, false otherwise
   */
  function attemptDataLoad(attemptNumber) {
    if (dataLoadedSuccessfully || (STATE.itemsBase && STATE.itemsBase.length > 0)) {
      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0136: Data already loaded, skipping retry #${attemptNumber}`
      );
      return true;
    }

    const orchestratorData = window.MyIOOrchestratorData;
    const currentCustomerId = window.MyIOUtils?.customerTB_ID;

    LogHelper.log(
      `[TELEMETRY ${WIDGET_DOMAIN}] 🔍 RFC-0136: Retry #${attemptNumber} - Checking for stored orchestrator data...`
    );

    // First, try stored data
    if (orchestratorData && orchestratorData[WIDGET_DOMAIN]) {
      const storedData = orchestratorData[WIDGET_DOMAIN];
      const age = Date.now() - storedData.timestamp;

      // HARD: Validate that cached data belongs to current customer
      const cachedPeriodKey = storedData.periodKey || '';
      const cachedCustomerId = cachedPeriodKey.split(':')[0];
      if (currentCustomerId && cachedCustomerId && cachedCustomerId !== currentCustomerId) {
        LogHelper.warn(
          `[TELEMETRY ${WIDGET_DOMAIN}] 🚫 Stored data customer mismatch (cached: ${cachedCustomerId}, current: ${currentCustomerId}) - ignoring stale cache`
        );
        delete window.MyIOOrchestratorData[WIDGET_DOMAIN];
        return false;
      }

      LogHelper.log(
        `[TELEMETRY ${WIDGET_DOMAIN}] Found stored data: ${
          storedData.items?.length || 0
        } items, age: ${age}ms`
      );

      // Use stored data if it's less than 60 seconds old AND has items
      // RFC-0136: Increased from 30s to 60s to better handle tab switching
      if (age < 60000 && storedData.items && storedData.items.length > 0) {
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0136: Using stored orchestrator data (retry #${attemptNumber})`
        );
        dataProvideHandler({
          detail: {
            domain: WIDGET_DOMAIN,
            periodKey: storedData.periodKey,
            items: storedData.items,
          },
        });
        dataLoadedSuccessfully = true;
        return true;
      } else {
        LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ Stored data is too old or empty, ignoring`);
      }
    } else {
      LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] ℹ️ No stored data found for domain ${WIDGET_DOMAIN}`);
    }

    // RFC-0136: Also check window.STATE directly as additional fallback
    if (window.STATE?.isReady && window.STATE.isReady(WIDGET_DOMAIN)) {
      const myLabelWidget = self.ctx.settings?.labelWidget || '';
      const stateItems = getItemsFromState(WIDGET_DOMAIN, myLabelWidget);

      if (stateItems && stateItems.length > 0) {
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0136: Found ${stateItems.length} items directly in window.STATE (retry #${attemptNumber})`
        );
        // Build a synthetic provide-data event from STATE
        const periodKey = `${currentCustomerId || 'unknown'}:${WIDGET_DOMAIN}:state-fallback`;
        dataProvideHandler({
          detail: {
            domain: WIDGET_DOMAIN,
            periodKey: periodKey,
            items: stateItems,
          },
        });
        dataLoadedSuccessfully = true;
        return true;
      }
    }

    return false;
  }

  /**
   * RFC-0136: Execute retry with backoff
   */
  function executeRetryWithBackoff() {
    if (retryIndex >= RETRY_INTERVALS.length) {
      LogHelper.warn(
        `[TELEMETRY ${WIDGET_DOMAIN}] ⚠️ RFC-0136: All ${RETRY_INTERVALS.length} retries exhausted, requesting fresh data...`
      );

      // Final fallback: request fresh data if we still have nothing
      if (!hasRequestedInitialData && !dataLoadedSuccessfully) {
        if (WIDGET_DOMAIN === 'temperature') {
          LogHelper.log(
            `[TELEMETRY ${WIDGET_DOMAIN}] 📡 Temperature domain - calling hydrateAndRender directly...`
          );
          hasRequestedInitialData = true;
          hydrateAndRender();
        } else {
          LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] 📡 Requesting fresh data from orchestrator...`);
          requestDataFromOrchestrator();
        }
      }
      return;
    }

    const delay = RETRY_INTERVALS[retryIndex];
    const attemptNumber = retryIndex + 1;

    setTimeout(() => {
      // Check if data was loaded by another mechanism (e.g., widget:ready re-emit)
      if (dataLoadedSuccessfully || (STATE.itemsBase && STATE.itemsBase.length > 0)) {
        LogHelper.log(
          `[TELEMETRY ${WIDGET_DOMAIN}] ✅ RFC-0136: Data loaded externally, canceling remaining retries`
        );
        return;
      }

      const success = attemptDataLoad(attemptNumber);

      if (!success) {
        retryIndex++;
        executeRetryWithBackoff();
      }
    }, delay);
  }

  // Start the retry mechanism
  LogHelper.log(
    `[TELEMETRY ${WIDGET_DOMAIN}] 🔄 RFC-0136: Starting intelligent retry with backoff [${RETRY_INTERVALS.join(
      'ms, '
    )}ms]`
  );
  executeRetryWithBackoff();

  // Auth do cliente/ingestion
  // RFC-0091: Use shared customerTB_ID from MAIN widget via window.MyIOUtils
  const customerTB_ID = window.MyIOUtils?.customerTB_ID;
  if (!customerTB_ID) {
    console.error(
      '[TELEMETRY] customerTB_ID not available from window.MyIOUtils - MAIN widget must load first'
    );
  }
  //DEVICE_TYPE = self.ctx.settings?.DEVICE_TYPE || "energy";
  const jwt = localStorage.getItem('jwt_token');

  const boolExecSync = new URLSearchParams(window.location.search).get('boolExecSync') === 'true';

  // RFC-0071: Trigger device profile synchronization (runs once)
  if (!__deviceProfileSyncComplete && boolExecSync) {
    try {
      console.log('[EQUIPMENTS] [RFC-0071] Triggering device profile sync...');
      const syncResult = await syncDeviceProfileAttributes();
      __deviceProfileSyncComplete = true;

      if (syncResult.synced > 0) {
        console.log(
          '[EQUIPMENTS] [RFC-0071] ⚠️ Widget reload recommended to load new deviceProfile attributes'
        );
        console.log(
          '[EQUIPMENTS] [RFC-0071] You may need to refresh the dashboard to see deviceProfile in ctx.data'
        );
      }
    } catch (error) {
      console.error('[EQUIPMENTS] [RFC-0071] Sync failed, continuing without it:', error);
      // Don't block widget initialization if sync fails
    }
  }

  try {
    const attrs = await MyIO.fetchThingsboardCustomerAttrsFromStorage(customerTB_ID, jwt);
    CLIENT_ID = attrs?.client_id || '';
    CLIENT_SECRET = attrs?.client_secret || '';
    CUSTOMER_ING_ID = attrs?.ingestionId || '';
    // Carrega o mapa (pode ser string JSON ou objeto)
    if (attrs?.mapInstantaneousPower) {
      MAP_INSTANTANEOUS_POWER =
        typeof attrs.mapInstantaneousPower === 'string'
          ? JSON.parse(attrs.mapInstantaneousPower)
          : attrs.mapInstantaneousPower;
    } else {
      MAP_INSTANTANEOUS_POWER = null;
    }

    // [CORREÇÃO CRÍTICA]
    // Se o mapa chegou AGORA, precisamos re-executar a lógica de enriquecimento
    // RFC-0106: Power range updates now handled via orchestrator data
    // The orchestrator includes all device metadata including power ranges
    if (MAP_INSTANTANEOUS_POWER && STATE.itemsEnriched && STATE.itemsEnriched.length > 0) {
      LogHelper.log('[RFC-0106] Power map loaded - ranges will be applied from orchestrator data');
      reflowFromState();
    }

    // Expõe credenciais globalmente para uso no FOOTER (modal de comparação)
    window.__MYIO_CLIENT_ID__ = CLIENT_ID;
    window.__MYIO_CLIENT_SECRET__ = CLIENT_SECRET;
    window.__MYIO_CUSTOMER_ING_ID__ = CUSTOMER_ING_ID;

    MyIOAuth = MyIO.buildMyioIngestionAuth({
      dataApiHost: window.MyIOUtils?.getDataApiHost?.(),
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });

    LogHelper.log('[DeviceCards] Auth init OK');
    try {
      await MyIOAuth.getToken();
    } catch {
      // Pre-warming token fetch, failure is non-critical
    }
  } catch (err) {
    LogHelper.error('[DeviceCards] Auth init FAIL', err);
  }

  // Grab modal reference BEFORE portal (querySelector works inside widget root)
  _filterModalElement = $root()[0].querySelector('#filterModal');

  // Inject CSS into the widget's ownerDocument (correct for iframe OR main page)
  injectFilterModalStyles();

  // Portal: move modal to widget's body so position:fixed is relative to the viewport
  if (_filterModalElement) {
    const _widgetBody = (_filterModalElement.ownerDocument || document).body;
    if (_filterModalElement.parentElement !== _widgetBody) {
      _widgetBody.appendChild(_filterModalElement);
    }
  }

  // Bind UI
  bindHeader();
  bindModal();

  // ---------- Datas iniciais: "Current Month So Far" ----------
  if (!self.ctx?.scope?.startDateISO || !self.ctx?.scope?.endDateISO) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); // 1º dia 00:00
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 0); // hoje 23:59:59
    self.ctx.scope = self.ctx.scope || {};
    self.ctx.scope.startDateISO = start.toISOString();
    self.ctx.scope.endDateISO = end.toISOString();
  }
  // ------------------------------------------------------------

  // RFC-0106: No ctx.data, no datasources - all data comes from orchestrator
  LogHelper.log(`[RFC-0106] ${WIDGET_DOMAIN} widget waiting for orchestrator data...`);

  // RFC-0106 FIX: Temperature domain doesn't need period - check for stored data immediately
  if (WIDGET_DOMAIN === 'temperature') {
    const orchestratorData = window.MyIOOrchestratorData;
    const currentCustomerId = window.MyIOUtils?.customerTB_ID;
    if (orchestratorData && orchestratorData.temperature) {
      const storedData = orchestratorData.temperature;
      const age = Date.now() - storedData.timestamp;

      // HARD: Validate that cached data belongs to current customer
      const cachedPeriodKey = storedData.periodKey || '';
      const cachedCustomerId = cachedPeriodKey.split(':')[0];
      if (currentCustomerId && cachedCustomerId && cachedCustomerId !== currentCustomerId) {
        LogHelper.warn(`[TELEMETRY temperature] 🚫 Stored data customer mismatch - ignoring stale cache`);
        delete window.MyIOOrchestratorData.temperature;
      } else {
        LogHelper.log(
          `[TELEMETRY temperature] 🌡️ Found stored temperature data: ${
            storedData.items?.length || 0
          } items, age: ${age}ms`
        );

        // Use stored data if it's less than 60 seconds old AND has items
        if (age < 60000 && storedData.items && storedData.items.length > 0) {
          LogHelper.log(
            `[TELEMETRY temperature] ✅ Using stored temperature data directly (no period needed)`
          );
          dataProvideHandler({
            detail: {
              domain: 'temperature',
              periodKey: storedData.periodKey,
              items: storedData.items,
            },
          });
          return; // Don't proceed to showBusy
        }
      }
    }
  }

  // Only show busy if we have a date range defined
  if (self.ctx?.scope?.startDateISO && self.ctx?.scope?.endDateISO) {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] Initial period defined, showing busy...`);
    showBusy();
  } else {
    LogHelper.log(`[TELEMETRY ${WIDGET_DOMAIN}] No initial period, waiting for myio:update-date event...`);
  }
};

// onDataUpdated removido (no-op por ora)
self.onDataUpdated = function () {
  /* no-op */
};

self.onResize = function () {};
self.onDestroy = function () {
  if (dateUpdateHandler) {
    window.removeEventListener('myio:update-date', dateUpdateHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:update-date' removido.");
  }
  if (dataProvideHandler) {
    window.removeEventListener('myio:telemetry:provide-data', dataProvideHandler);
    LogHelper.log("[DeviceCards] Event listener 'myio:telemetry:provide-data' removido.");
  }
  if (dashboardStateHandler) {
    window.removeEventListener('myio:dashboard-state', dashboardStateHandler);
  }
  // RFC-0056 FIX v1.1: Remove request_refresh listener
  if (requestRefreshHandler) {
    window.removeEventListener('myio:telemetry:update', requestRefreshHandler);
    LogHelper.log("[RFC-0056] Event listener 'myio:telemetry:update' removido.");
  }
  window.removeEventListener('myio:alarms-updated', refreshAlarmBadges);
  window.removeEventListener('myio:group-filter-changed', _groupFilterChangedHandler);

  // Cleanup TempSensorSummaryTooltip if attached
  if (_tempTooltipCleanup) {
    _tempTooltipCleanup();
    _tempTooltipCleanup = null;
    LogHelper.log('[TELEMETRY] TempSensorSummaryTooltip cleanup executed.');
  }

  // RFC-0195: Cleanup sync job modal + polling
  try { _destroySyncJobModal(); } catch { /* non-critical */ }

  // Remove portalled filter modal from body
  try {
    if (_filterModalElement && _filterModalElement.parentElement) {
      _filterModalElement.parentElement.removeChild(_filterModalElement);
    }
    _filterModalElement = null;
  } catch {
    // non-critical cleanup
  }

  try {
    $root().off();
  } catch {
    // jQuery cleanup may fail if element no longer exists
  }

  hideBusy();
  hideGlobalSuccessModal();
};
