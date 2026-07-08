/**
 * AlarmNotificationTooltip - Dashboard Alarm Notifications Tooltip Component
 * RFC-0193 / RFC-0214: Premium, draggable/pinnable/maximizable alarm notifications tooltip.
 *
 * Ported verbatim (behavior + styling) from the v-5.2.0 HEADER widget inline
 * `AlarmNotificationTooltip` object into a reusable library component, following the
 * `EnergySummaryTooltip.ts` pattern (single CSS injection, getContainer/renderHTML/show/hide,
 * drag + pin + maximize, `attach(element, getDataFn)` returning a cleanup function).
 *
 * Shows:
 * - "Ativos agora" / "Encerrados hoje" summary cards
 * - Active alarms breakdown by severity and by state
 * - First / last alarm of the day
 * - Collapsible "Ativos" and "Histórico do Dia" lists
 * - In-panel toggles (notifications, offline alarms, internal MyIO support rule)
 * - Footer button → "Regras de Alarmes" (alarm bundle map modal)
 * - Locked state when alarms are not configured for the customer
 *
 * Data is read, by default, from `window.MyIOOrchestrator` / `window.MyIOUtils` (same source
 * as the badge), but a custom data provider can be injected via `attach()` or `configure()`.
 *
 * @example
 * // Attach to an element (reads window.MyIOOrchestrator by default)
 * const cleanup = AlarmNotificationTooltip.attach(btnAlarmNotif);
 * // Later: cleanup();
 *
 * // Inject a custom data provider + wiring
 * AlarmNotificationTooltip.configure({ tbBaseUrl, onOpenAlarmMap });
 * AlarmNotificationTooltip.attach(btn, () => myAlarmData);
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================
// Types
// ============================================

export interface AlarmRecord {
  deviceId?: string;
  source?: string;
  deviceName?: string;
  title?: string;
  alarmType?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO' | string;
  state?: 'OPEN' | 'ACK' | 'ESCALATED' | 'SNOOZED' | 'CLOSED' | string;
  firstOccurrence?: string;
  lastOccurrence?: string;
  raisedAt?: string;
  lastUpdatedAt?: string;
}

/** Today's alarm map — typically `window.MyIOOrchestrator.alarmDayMap`. */
export interface AlarmDayMap {
  listAll(): AlarmRecord[];
  listByStatus(statusOrArray: string | string[]): AlarmRecord[];
}

/** Snapshot of the data needed to render the tooltip. */
export interface AlarmNotificationData {
  /** When false, the tooltip renders a "not configured / locked" state. */
  alarmsConfigured: boolean;
  /** Today's alarms map (listAll / listByStatus). */
  alarmDayMap: AlarmDayMap | null;
  /** Panel notifications toggle state. */
  alarmNotificationsEnabled: boolean;
  /** Offline-alarms toggle state. */
  showOfflineAlarms: boolean;
  /** Current user email — controls visibility of the internal MyIO rule toggle. */
  currentUserEmail: string;
  /** Internal MyIO support rule toggle state. */
  isInternalSupportRule: boolean;
  /** "Ativos agora" source — same as the badge (prefetched customer alarms). */
  customerAlarms: AlarmRecord[];
  /** Map of deviceId/source → friendly device label. */
  gcdrDeviceNameMap: Map<string, string> | null;
}

export interface AlarmNotificationToggleContext {
  /** The new toggle value. */
  value: boolean;
  /** Resolved tbBaseUrl + customerId for SERVER_SCOPE persistence convenience. */
  tbBaseUrl: string;
  customerTbId: string;
}

export interface AlarmNotificationTooltipConfig {
  /** Custom data provider; default reads window.MyIOOrchestrator / window.MyIOUtils. */
  getData?: () => AlarmNotificationData;
  /** ThingsBoard base URL for SERVER_SCOPE persistence (default: orchestrator.tbBaseUrl). */
  tbBaseUrl?: string;
  /** Customer TB id for SERVER_SCOPE persistence (default: orchestrator.customerTB_ID). */
  customerTbId?: string;
  /** Footer "Regras de Alarmes" button handler. Default opens the alarm bundle map modal. */
  onOpenAlarmMap?: () => void;
  /** Panel notifications toggle handler. Default updates orchestrator + persists. */
  onToggleNotifications?: (ctx: AlarmNotificationToggleContext) => void;
  /** Offline-alarms toggle handler. Default updates orchestrator, dispatches event + persists. */
  onToggleOffline?: (ctx: AlarmNotificationToggleContext) => void;
  /** Internal MyIO rule toggle handler. Default updates orchestrator, dispatches event + persists. */
  onToggleInternalRule?: (ctx: AlarmNotificationToggleContext) => void;
}

// ============================================
// CSS (ported verbatim from v-5.2.0 HEADER ALARM_NOTIF_CSS)
// ============================================

const ALARM_NOTIF_CSS = `
.ant-tooltip {
  position: fixed; z-index: 99999;
  pointer-events: none; opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(8px);
}
.ant-tooltip.visible  { opacity: 1; transform: translateY(0); pointer-events: auto; }
.ant-tooltip.closing  { opacity: 0; transform: translateY(8px); transition: opacity 0.4s ease, transform 0.4s ease; pointer-events: none; }
.ant-tooltip.dragging { transition: none !important; cursor: move; }
.ant-tooltip.maximized {
  top: 20px !important; left: 20px !important;
  right: 20px !important; bottom: 20px !important;
  width: auto !important; max-width: none !important;
}
.ant-tooltip.maximized .ant-content { width: 100%; height: 100%; max-width: none; max-height: none; display: flex; flex-direction: column; font-size: 14px; }
.ant-tooltip.maximized .ant-body    { flex: 1; overflow-y: auto; min-height: 0; }
.ant-tooltip.maximized .ant-header-title { font-size: 16px; }
.ant-tooltip.maximized .ant-toggle-label { font-size: 14px; }
.ant-tooltip.maximized .ant-toggle-sub  { font-size: 12px; }
.ant-tooltip.maximized .ant-summary-num { font-size: 22px; }
.ant-tooltip.maximized .ant-summary-label { font-size: 13px; }
.ant-tooltip.maximized .ant-section-hdr  { font-size: 13px; }
.ant-tooltip.maximized .ant-alarm-device { font-size: 13px; }
.ant-tooltip.maximized .ant-alarm-title  { font-size: 12px; }
.ant-tooltip.maximized .ant-alarm-time   { font-size: 11px; }
.ant-tooltip.maximized .ant-footer-label { font-size: 13px; }
.ant-tooltip.maximized .ant-footer-value { font-size: 20px; }
.ant-tooltip.pinned { box-shadow: 0 0 0 2px #0a6d5e, 0 10px 40px rgba(0,0,0,0.2); }
.ant-content {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 2px 10px rgba(0,0,0,0.08);
  width: 1008px; max-width: 95vw; max-height: 82vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px; color: #1e293b; overflow: hidden;
  display: flex; flex-direction: column;
}
.ant-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  background: linear-gradient(90deg, #e6f4f1 0%, #c3e6e2 100%);
  border-bottom: 1px solid #7ecfc8; border-radius: 12px 12px 0 0;
  cursor: move; user-select: none;
}
.ant-header-icon  { font-size: 18px; }
.ant-header-title { font-weight: 700; font-size: 14px; color: #0a4f45; flex: 1; }
.ant-header-ts    { font-size: 10px; color: #6b7280; margin-right: 8px; }
.ant-header-actions { display: flex; align-items: center; gap: 4px; }
.ant-hbtn {
  width: 24px; height: 24px; border: none; background: rgba(255,255,255,0.6);
  border-radius: 4px; cursor: pointer; display: flex; align-items: center;
  justify-content: center; transition: all 0.15s; color: #64748b;
}
.ant-hbtn:hover { background: rgba(255,255,255,0.9); color: #1e293b; }
.ant-hbtn.pinned { background: #0a6d5e; color: #fff; }
.ant-hbtn.pinned:hover { background: #084f44; color: #fff; }
.ant-hbtn svg { width: 14px; height: 14px; }
.ant-body { padding: 14px; overflow-y: auto; flex: 1; min-height: 0; }

/* Toggle row */
.ant-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; background: #f8faf9; border-radius: 8px;
  margin-bottom: 12px; border: 1px solid #e0eceb;
}
.ant-toggles-inline { display: flex; gap: 8px; margin-bottom: 12px; }
.ant-toggles-inline .ant-toggle-row { flex: 1; margin-bottom: 0; }
.ant-toggle-label { font-weight: 600; font-size: 12px; color: #1e293b; }
.ant-toggle-sub   { font-size: 10px; color: #64748b; margin-top: 1px; }
.ant-switch {
  position: relative; display: inline-block; width: 36px; height: 20px;
  cursor: pointer; flex-shrink: 0;
}
.ant-switch input { opacity: 0; width: 0; height: 0; }
.ant-switch-track {
  position: absolute; inset: 0; background: #cbd5e1; border-radius: 20px;
  transition: background 0.2s;
}
.ant-switch input:checked + .ant-switch-track { background: #0a6d5e; }
.ant-switch-thumb {
  position: absolute; top: 3px; left: 3px; width: 14px; height: 14px;
  background: #fff; border-radius: 50%; transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.ant-switch input:checked ~ .ant-switch-thumb { transform: translateX(16px); }

/* Summary bar */
.ant-summary {
  display: flex; gap: 8px; margin-bottom: 12px;
}
.ant-summary-item {
  flex: 1; text-align: center; padding: 8px 4px;
  background: #f8faf9; border: 1px solid #e0eceb; border-radius: 8px;
}
.ant-summary-num   { font-size: 20px; font-weight: 700; color: #0a6d5e; line-height: 1; }
.ant-summary-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }

/* Section headers */
.ant-section-hdr {
  font-size: 10px; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin: 12px 0 6px; padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
}

/* Summary cards row — primary */
.ant-summary-primary { display: flex; gap: 8px; margin-bottom: 10px; }
.ant-summary-card {
  flex: 1; text-align: center; padding: 10px 6px; border-radius: 10px;
  border: 1px solid #e0eceb;
}
.ant-summary-card.open   { background: #fff5f5; border-color: #fca5a5; }
.ant-summary-card.closed { background: #f0fdf4; border-color: #6ee7b7; }
.ant-summary-card-num   { font-size: 26px; font-weight: 800; line-height: 1; }
.ant-summary-card.open   .ant-summary-card-num { color: #dc2626; }
.ant-summary-card.closed .ant-summary-card-num { color: #059669; }
.ant-summary-card-lbl   { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 3px; }

/* Active breakdown grid */
.ant-breakdown { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
.ant-breakdown-item {
  padding: 7px 10px; border-radius: 8px; border: 1px solid #e2e8f0;
  background: #f8faf9; display: flex; align-items: center; gap: 8px;
}
.ant-breakdown-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
}
.ant-breakdown-dot.CRITICAL { background: #dc2626; }
.ant-breakdown-dot.HIGH     { background: #f59e0b; }
.ant-breakdown-dot.MEDIUM   { background: #3b82f6; }
.ant-breakdown-dot.LOW      { background: #6b7280; }
.ant-breakdown-dot.INFO     { background: #a78bfa; }
.ant-breakdown-dot.ACK      { background: #0891b2; }
.ant-breakdown-dot.SNOOZED  { background: #8b5cf6; }
.ant-breakdown-dot.ESCALATED{ background: #ea580c; }
.ant-breakdown-info { flex: 1; min-width: 0; }
.ant-breakdown-name { font-size: 11px; font-weight: 600; color: #374151; }
.ant-breakdown-count{ font-size: 16px; font-weight: 800; color: #1e293b; line-height: 1; }

/* First / last alarm highlight */
.ant-firstlast { display: flex; gap: 6px; margin-bottom: 10px; }
.ant-fl-card {
  flex: 1; padding: 8px 10px; border-radius: 8px;
  background: #f8faf9; border: 1px solid #e2e8f0;
}
.ant-fl-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
.ant-fl-title { font-size: 11px; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ant-fl-device{ font-size: 10px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ant-fl-time  { font-size: 10px; color: #94a3b8; margin-top: 2px; }

/* Severity chips */
.ant-sev-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.ant-sev-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 700;
}
.ant-sev-chip.CRITICAL { background: #fee2e2; color: #b91c1c; }
.ant-sev-chip.HIGH     { background: #fef3c7; color: #b45309; }
.ant-sev-chip.MEDIUM   { background: #dbeafe; color: #1d4ed8; }
.ant-sev-chip.LOW      { background: #f3f4f6; color: #6b7280; }

/* Alarm list */
.ant-alarm-list { display: flex; flex-direction: column; gap: 4px; }
.ant-alarm-row {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 6px 8px; border-radius: 6px; background: #f8faf9;
  border: 1px solid #f1f5f9; transition: background 0.12s;
}
.ant-alarm-row:hover { background: #f0f9f7; border-color: #c3e6e2; }
.ant-alarm-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 3px;
}
.ant-alarm-dot.CRITICAL { background: #dc2626; }
.ant-alarm-dot.HIGH     { background: #f59e0b; }
.ant-alarm-dot.MEDIUM   { background: #3b82f6; }
.ant-alarm-dot.LOW      { background: #6b7280; }
.ant-alarm-dot.CLOSED   { background: #10b981; }
.ant-alarm-info { flex: 1; min-width: 0; }
.ant-alarm-device {
  font-size: 12px; font-weight: 700; color: #1e293b;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ant-alarm-title {
  font-size: 11px; color: #64748b;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ant-alarm-time { font-size: 10px; color: #94a3b8; flex-shrink: 0; margin-top: 2px; }
.ant-empty { text-align: center; color: #94a3b8; font-size: 12px; padding: 12px 0; }
/* Collapsible sections */
.ant-collapse { margin-bottom: 10px; }
.ant-collapse summary {
  font-size: 10px; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.5px;
  padding: 6px 0 4px; border-bottom: 1px solid #e2e8f0;
  cursor: pointer; list-style: none; display: flex; align-items: center;
  justify-content: space-between; user-select: none;
}
.ant-collapse summary::-webkit-details-marker { display: none; }
.ant-collapse summary::after {
  content: '▸'; font-size: 12px; color: #94a3b8; transition: transform 0.2s;
}
.ant-collapse[open] summary::after { transform: rotate(90deg); }
.ant-collapse summary:hover { color: #0a4f45; }
.ant-collapse-body { padding-top: 8px; }
.ant-footer {
  padding: 10px 14px; border-top: 1px solid #e8ecef;
  background: linear-gradient(135deg, #0a6d5e 0%, #0d8570 100%);
  border-radius: 0 0 11px 11px;
  display: flex; align-items: center; justify-content: space-between;
}
.ant-footer-label { font-size: 11px; color: rgba(255,255,255,0.85); font-weight: 600; }
.ant-footer-value { font-size: 16px; font-weight: 700; color: #fff; }
.ant-footer-btn {
  padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.15); color: #fff; font-size: 11px; font-weight: 600;
  cursor: pointer; display: flex; align-items: center; gap: 5px;
  transition: background 0.15s;
}
.ant-footer-btn:hover { background: rgba(255,255,255,0.28); }
/* Locked / not-configured state */
.ant-locked {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 30px; gap: 14px; text-align: center;
}
.ant-locked-icon { font-size: 48px; line-height: 1; }
.ant-locked-title { font-size: 15px; font-weight: 700; color: #374151; }
.ant-locked-sub   { font-size: 12px; color: #6b7280; max-width: 260px; line-height: 1.5; }
`;

// ============================================
// Module state + helpers
// ============================================

let cssInjected = false;

function injectCSS(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;

  const styleId = 'myio-ant-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = ALARM_NOTIF_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

function fmtTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function fmtNow(): string {
  try {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const OFFLINE_TYPES = ['DEVICE OFFLINE', 'DISPOSITIVO OFFLINE'];
function isOfflineAlarm(a: AlarmRecord): boolean {
  const t = (a.title ?? '').toUpperCase();
  return OFFLINE_TYPES.some((ex) => t.startsWith(ex)) || a.alarmType === 'connectivity';
}

function getWin(): any {
  return typeof window !== 'undefined' ? (window as any) : {};
}

/** Default data provider — reads window.MyIOOrchestrator / window.MyIOUtils (same source as the badge). */
function defaultGetData(): AlarmNotificationData {
  const w = getWin();
  const orch = w.MyIOOrchestrator || {};
  const utils = w.MyIOUtils || {};
  return {
    alarmsConfigured: !!orch.alarmsConfigured,
    alarmDayMap: orch.alarmDayMap || null,
    alarmNotificationsEnabled: orch.alarmNotificationsEnabled !== false,
    showOfflineAlarms: orch.showOfflineAlarms === true,
    currentUserEmail: utils.currentUserEmail || '',
    isInternalSupportRule: orch.isInternalSupportRule !== false,
    customerAlarms: orch.customerAlarms || [],
    gcdrDeviceNameMap: orch.gcdrDeviceNameMap || null,
  };
}

function resolvePersistTarget(): { tbBaseUrl: string; customerTbId: string } {
  const w = getWin();
  const orch = w.MyIOOrchestrator || {};
  return {
    tbBaseUrl: config.tbBaseUrl || orch.tbBaseUrl || '',
    customerTbId: config.customerTbId || orch.customerTB_ID || '',
  };
}

/** Persist a SERVER_SCOPE attribute to ThingsBoard (best-effort, same as the v-5.2.0 toggles). */
async function persistServerScope(body: Record<string, unknown>): Promise<void> {
  try {
    const jwt = typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null;
    const { tbBaseUrl, customerTbId } = resolvePersistTarget();
    if (!jwt || !customerTbId || typeof fetch === 'undefined') return;
    await fetch(
      `${tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerTbId}/attributes/SERVER_SCOPE`,
      {
        method: 'POST',
        headers: { 'X-Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
  } catch (err) {
    console.warn('[AlarmNotificationTooltip] Failed to persist SERVER_SCOPE attribute:', err);
  }
}

/** Default footer "Regras de Alarmes" handler — opens the alarm bundle map modal. */
function defaultOpenAlarmMap(): void {
  const w = getWin();
  const orch = w.MyIOOrchestrator || {};
  if (!orch.alarmsConfigured) {
    console.warn('[AlarmNotificationTooltip] open-alarm-map: alarms not configured for this customer');
    return;
  }
  const openFn = w.MyIOUtils?.openAlarmBundleMapModal;
  if (typeof openFn !== 'function') {
    console.error('[AlarmNotificationTooltip] openAlarmBundleMapModal unavailable via MyIOUtils');
    return;
  }
  const customerTB_ID = orch.customerTB_ID || '';
  const gcdrTenantId = orch.gcdrTenantId || '';
  const gcdrApiBaseUrl = orch.gcdrApiBaseUrl || 'https://gcdr-api.a.myio-bas.com';
  if (!customerTB_ID) {
    console.warn('[AlarmNotificationTooltip] open-alarm-map: customerTB_ID not available');
    return;
  }
  openFn({ customerTB_ID, gcdrTenantId, gcdrApiBaseUrl });
}

// ============================================
// Config (overridable via configure())
// ============================================

let config: AlarmNotificationTooltipConfig = {};

// ============================================
// AlarmNotificationTooltip Object
// ============================================

export const AlarmNotificationTooltip = {
  containerId: 'myio-ant-tooltip',

  _dataProvider: null as (() => AlarmNotificationData) | null,
  _hideTimer: null as ReturnType<typeof setTimeout> | null,
  _forceHideTimer: null as ReturnType<typeof setTimeout> | null,
  _isMouseOver: false,
  _isPinned: false,
  _isMaximized: false,
  _isDragging: false,
  _dragOffset: { x: 0, y: 0 },
  _savedPosition: null as { top: string; left: string } | null,

  /** Override the default wiring (data provider, persistence target, button handlers). */
  configure(opts: AlarmNotificationTooltipConfig): void {
    config = { ...config, ...opts };
    if (opts.getData) this._dataProvider = opts.getData;
  },

  _getData(): AlarmNotificationData {
    const provider = this._dataProvider || config.getData || defaultGetData;
    return provider();
  },

  getContainer(): HTMLElement {
    injectCSS();
    let c = document.getElementById(this.containerId);
    if (!c) {
      c = document.createElement('div');
      c.id = this.containerId;
      c.className = 'ant-tooltip';
      document.body.appendChild(c);
    }
    return c;
  },

  renderHTML(): string {
    const data = this._getData();

    // Gate: if alarms API not configured for this customer, show locked state
    if (!data.alarmsConfigured) {
      return `
        <div class="ant-content">
          <div class="ant-header" data-drag-handle>
            <span class="ant-header-icon">🔔</span>
            <span class="ant-header-title">Notificações de Alarme</span>
            <div class="ant-header-actions">
              <button class="ant-hbtn" data-action="close" title="Fechar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="ant-locked">
            <div class="ant-locked-icon">🔒</div>
            <div class="ant-locked-title">Funcionalidade de Alarmes não está ativada</div>
            <div class="ant-locked-sub">Este cliente não possui a integração de alarmes configurada. Entre em contato com o suporte MYIO para habilitar.</div>
          </div>
        </div>`;
    }

    const adm = data.alarmDayMap;
    const enabled = data.alarmNotificationsEnabled;
    const showOffline = data.showOfflineAlarms;
    const _email = (data.currentUserEmail || '').toLowerCase();
    const isMyioUser =
      _email.endsWith('@myio.com.br') && !_email.startsWith('alarme@') && !_email.startsWith('alarmes@');
    const isInternalSupportRule = data.isInternalSupportRule;

    const _offlineFilter = (a: AlarmRecord) => showOffline || !isOfflineAlarm(a);

    const all = (adm ? adm.listAll() : []).filter(_offlineFilter);
    const closed = (adm ? adm.listByStatus('CLOSED') : []).filter(_offlineFilter);

    // "Ativos agora" = same source as the badge (customerAlarms = _prefetchCustomerAlarms result).
    // alarmDayMap only covers today's date range — would under-count older open alarms.
    const customerAlarms = data.customerAlarms || [];
    const active = (
      customerAlarms.length > 0
        ? customerAlarms
        : adm
          ? adm.listByStatus(['OPEN', 'ACK', 'ESCALATED', 'SNOOZED'])
          : []
    ).filter(_offlineFilter);

    // Severity breakdown of active alarms
    const sevCount: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    const stateCount: Record<string, number> = { ACK: 0, SNOOZED: 0, ESCALATED: 0 };
    for (const a of active) {
      const s = a.severity || 'LOW';
      if (s in sevCount) sevCount[s]++;
      const st = a.state || '';
      if (st in stateCount) stateCount[st]++;
    }

    const sevLabels: Record<string, string> = { CRITICAL: 'Crítico', HIGH: 'Alto', MEDIUM: 'Médio', LOW: 'Baixo', INFO: 'Info' };
    const stateLabels: Record<string, string> = { ACK: 'Reconhecido', SNOOZED: 'Adiado', ESCALATED: 'Escalado' };

    const mkBreakdown = (key: string, label: string, dotCls: string) => `
      <div class="ant-breakdown-item">
        <div class="ant-breakdown-dot ${dotCls}"></div>
        <div class="ant-breakdown-info">
          <div class="ant-breakdown-name">${label}</div>
          <div class="ant-breakdown-count">${sevCount[key] ?? stateCount[key] ?? 0}</div>
        </div>
      </div>`;

    const sevGrid = Object.keys(sevCount)
      .map((k) => mkBreakdown(k, sevLabels[k], k))
      .join('');
    const stateGrid = Object.keys(stateCount)
      .map((k) => mkBreakdown(k, stateLabels[k], k))
      .join('');

    // First and last alarm of the day
    const sortedAll = [...all].sort((a, b) => {
      const ta = new Date(a.firstOccurrence || a.raisedAt || 0).getTime();
      const tb = new Date(b.firstOccurrence || b.raisedAt || 0).getTime();
      return ta - tb;
    });
    const firstAlarm = sortedAll[0] || null;
    const lastAlarm = sortedAll[sortedAll.length - 1] || null;

    const gcdrMap = data.gcdrDeviceNameMap;
    const _resolveAlarmDeviceLabel = (alarm: AlarmRecord) => {
      const label = gcdrMap?.get(alarm.deviceId || alarm.source || '') || null;
      const rawName = alarm.deviceName || '';
      if (label && rawName && label !== rawName) return `${label} (${rawName})`;
      return label || rawName || alarm.source || '';
    };

    const mkFlCard = (label: string, alarm: AlarmRecord | null) => {
      if (!alarm)
        return `<div class="ant-fl-card"><div class="ant-fl-label">${label}</div><div class="ant-fl-title" style="color:#94a3b8">—</div></div>`;
      const title = alarm.title || alarm.alarmType || 'Alarme';
      const device = _resolveAlarmDeviceLabel(alarm);
      const ts =
        label === 'Primeiro'
          ? alarm.firstOccurrence || alarm.raisedAt
          : alarm.lastOccurrence || alarm.lastUpdatedAt || alarm.raisedAt;
      return `
        <div class="ant-fl-card">
          <div class="ant-fl-label">${label}</div>
          <div class="ant-fl-title">${title}</div>
          ${device ? `<div class="ant-fl-device">${device}</div>` : ''}
          <div class="ant-fl-time">${fmtTime(ts)}</div>
        </div>`;
    };

    // Row renderer shared by both lists
    const mkAlarmRow = (a: AlarmRecord) => {
      const sev = a.severity || 'LOW';
      const state = a.state || '';
      const dotCls = state === 'CLOSED' ? 'CLOSED' : sev;
      const device = _resolveAlarmDeviceLabel(a);
      const title = a.title || a.alarmType || 'Alarme';
      const time = fmtTime(a.lastOccurrence || a.lastUpdatedAt || a.raisedAt);
      return `
        <div class="ant-alarm-row">
          <div class="ant-alarm-dot ${dotCls}"></div>
          <div class="ant-alarm-info">
            ${device ? `<div class="ant-alarm-device">${device}</div>` : ''}
            <div class="ant-alarm-title">${title}</div>
          </div>
          ${time ? `<div class="ant-alarm-time">${time}</div>` : ''}
        </div>`;
    };

    // Active alarms list (Ativos do Dia)
    const activeSorted = [...active].sort((a, b) => {
      const ta = new Date(a.lastOccurrence || a.lastUpdatedAt || a.raisedAt || 0).getTime();
      const tb = new Date(b.lastOccurrence || b.lastUpdatedAt || b.raisedAt || 0).getTime();
      return tb - ta;
    });
    const activeSection =
      active.length > 0
        ? `
      <details class="ant-collapse">
        <summary>Ativos (${active.length})</summary>
        <div class="ant-collapse-body">
          <div class="ant-alarm-list">${activeSorted.map(mkAlarmRow).join('')}</div>
        </div>
      </details>`
        : '';

    // History list (Histórico do Dia — all, most recent first, max 40)
    const sorted = [...all]
      .sort((a, b) => {
        const ta = new Date(a.lastOccurrence || a.lastUpdatedAt || a.raisedAt || 0).getTime();
        const tb = new Date(b.lastOccurrence || b.lastUpdatedAt || b.raisedAt || 0).getTime();
        return tb - ta;
      })
      .slice(0, 40);
    const histSection =
      all.length > 0
        ? `
      <details class="ant-collapse">
        <summary>Histórico do Dia (${all.length})</summary>
        <div class="ant-collapse-body">
          <div class="ant-alarm-list">${sorted.map(mkAlarmRow).join('')}</div>
        </div>
      </details>`
        : '';

    return `
      <div class="ant-content">
        <div class="ant-header" data-drag-handle>
          <span class="ant-header-icon">🔔</span>
          <span class="ant-header-title">Notificações de Alarme</span>
          <span class="ant-header-ts">${fmtNow()}</span>
          <div class="ant-header-actions">
            <button class="ant-hbtn" data-action="pin" title="Fixar na tela">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
                <line x1="12" y1="16" x2="12" y2="21"/>
                <line x1="8" y1="4" x2="16" y2="4"/>
              </svg>
            </button>
            <button class="ant-hbtn" data-action="maximize" title="Maximizar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
            <button class="ant-hbtn" data-action="close" title="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="ant-body">
          <div class="ant-toggles-inline">
            <div class="ant-toggle-row">
              <div>
                <div class="ant-toggle-label">Notificações de Alarmes no Painel</div>
                <div class="ant-toggle-sub">Ativar/desativar notificações flutuantes</div>
              </div>
              <label class="ant-switch" title="Ativar/desativar notificações">
                <input type="checkbox" id="ant-notif-toggle" ${enabled ? 'checked' : ''}>
                <span class="ant-switch-track"></span>
                <span class="ant-switch-thumb"></span>
              </label>
            </div>
            <div class="ant-toggle-row">
              <div>
                <div class="ant-toggle-label">Alarmes de Dispositivos Offline</div>
                <div class="ant-toggle-sub">Ativar/desativar exibição de alarmes offline</div>
              </div>
              <label class="ant-switch" title="Ativar/desativar alarmes offline">
                <input type="checkbox" id="ant-offline-toggle" ${showOffline ? 'checked' : ''}>
                <span class="ant-switch-track"></span>
                <span class="ant-switch-thumb"></span>
              </label>
            </div>
            ${
              isMyioUser
                ? `
            <div class="ant-toggle-row">
              <div>
                <div class="ant-toggle-label">Regras Internas MyIO</div>
                <div class="ant-toggle-sub">Incluir regras de suporte interno nas consultas</div>
              </div>
              <label class="ant-switch" title="Regras internas MyIO (visível apenas @myio.com.br)">
                <input type="checkbox" id="ant-internal-rule-toggle" ${isInternalSupportRule ? 'checked' : ''}>
                <span class="ant-switch-track"></span>
                <span class="ant-switch-thumb"></span>
              </label>
            </div>`
                : ''
            }
          </div>

          <div class="ant-summary-primary">
            <div class="ant-summary-card open">
              <div class="ant-summary-card-num">${active.length}</div>
              <div class="ant-summary-card-lbl">Ativos agora</div>
            </div>
            <div class="ant-summary-card closed">
              <div class="ant-summary-card-num">${closed.length}</div>
              <div class="ant-summary-card-lbl">Encerrados hoje</div>
            </div>
          </div>

          <div class="ant-section-hdr">Ativos por Severidade</div>
          <div class="ant-breakdown">${sevGrid}</div>

          <div class="ant-section-hdr">Ativos por Estado</div>
          <div class="ant-breakdown">${stateGrid}</div>

          <details class="ant-collapse">
            <summary>Primeiro e Último Alarme do Dia</summary>
            <div class="ant-collapse-body">
              <div class="ant-firstlast">
                ${mkFlCard('Primeiro', firstAlarm)}
                ${mkFlCard('Último', lastAlarm)}
              </div>
            </div>
          </details>

          ${activeSection}
          ${histSection}
        </div>
        <div class="ant-footer">
          <span class="ant-footer-label">Alarmes hoje</span>
          <span class="ant-footer-value">${all.length}</span>
          <button class="ant-footer-btn" data-action="open-alarm-map">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
            Regras de Alarmes
          </button>
        </div>
      </div>`;
  },

  show(triggerElement: HTMLElement): void {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    if (this._forceHideTimer) {
      clearTimeout(this._forceHideTimer);
      this._forceHideTimer = null;
    }
    const container = this.getContainer();
    container.innerHTML = this.renderHTML();
    this._bindEvents(container);
    this._setupDrag(container);
    container.classList.remove('closing');
    // Position after layout so offsetWidth is available; then show
    setTimeout(() => {
      if (!this._isPinned) this._position(triggerElement);
      container.classList.add('visible');
    }, 0);

    container.addEventListener('mouseenter', () => {
      this._isMouseOver = true;
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
    });
    container.addEventListener('mouseleave', () => {
      this._isMouseOver = false;
      if (!this._isPinned) this.hide();
    });
  },

  hide(immediate?: boolean): void {
    if (this._isPinned && !immediate) return;
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    this._hideTimer = setTimeout(
      () => {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.classList.add('closing');
        container.classList.remove('visible');
        this._hideTimer = null;
      },
      immediate ? 0 : 300
    );
  },

  _position(triggerElement: HTMLElement): void {
    const container = document.getElementById(this.containerId);
    if (!container || !triggerElement) return;
    const rect = triggerElement.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    container.style.position = 'fixed';
    container.style.removeProperty('right');
    container.style.removeProperty('bottom');
    // Use actual rendered width so it works regardless of CSS changes
    const cw = container.offsetWidth || 720;
    let top = rect.bottom + 8;
    // Align right edge of tooltip to right edge of trigger, then clamp to viewport
    let left = rect.right - cw;
    if (left + cw > vw - 8) left = vw - cw - 8;
    if (left < 8) left = 8;
    if (top + 500 > vh) top = rect.top - 510;
    if (top < 8) top = 8;
    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
  },

  _bindEvents(container: HTMLElement): void {
    // Pin
    container.querySelector('[data-action="pin"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._isPinned = !this._isPinned;
      container.classList.toggle('pinned', this._isPinned);
      (e.currentTarget as HTMLElement).classList.toggle('pinned', this._isPinned);
    });
    // Maximize
    container.querySelector('[data-action="maximize"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._isMaximized = !this._isMaximized;
      container.classList.toggle('maximized', this._isMaximized);
    });
    // Close
    container.querySelector('[data-action="close"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._isPinned = false;
      this.hide(true);
    });
    // Open Alarm Bundle Map modal
    container.querySelector('[data-action="open-alarm-map"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      (config.onOpenAlarmMap || defaultOpenAlarmMap)();
    });

    // Notification toggle
    const toggle = container.querySelector('#ant-notif-toggle') as HTMLInputElement | null;
    if (toggle) {
      toggle.addEventListener('change', () => {
        const value = toggle.checked;
        const w = getWin();
        if (w.MyIOOrchestrator) w.MyIOOrchestrator.alarmNotificationsEnabled = value;
        const { tbBaseUrl, customerTbId } = resolvePersistTarget();
        if (config.onToggleNotifications) {
          config.onToggleNotifications({ value, tbBaseUrl, customerTbId });
        } else {
          void persistServerScope({ alarmNotificationsEnabled: value });
        }
      });
    }

    // Offline alarms toggle
    const offlineToggle = container.querySelector('#ant-offline-toggle') as HTMLInputElement | null;
    if (offlineToggle) {
      offlineToggle.addEventListener('change', () => {
        const value = offlineToggle.checked;
        const w = getWin();
        if (w.MyIOOrchestrator) w.MyIOOrchestrator.showOfflineAlarms = value;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('myio:offline-alarms-toggle', { detail: { show: value } }));
        }
        const { tbBaseUrl, customerTbId } = resolvePersistTarget();
        if (config.onToggleOffline) {
          config.onToggleOffline({ value, tbBaseUrl, customerTbId });
        } else {
          void persistServerScope({ showOfflineAlarms: value });
        }
      });
    }

    // Internal support rule toggle (only rendered for @myio.com.br users)
    const internalRuleToggle = container.querySelector('#ant-internal-rule-toggle') as HTMLInputElement | null;
    if (internalRuleToggle) {
      internalRuleToggle.addEventListener('change', () => {
        const value = internalRuleToggle.checked;
        const w = getWin();
        if (w.MyIOOrchestrator) w.MyIOOrchestrator.isInternalSupportRule = value;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('myio:internal-support-rule-changed', { detail: { value } }));
        }
        const { tbBaseUrl, customerTbId } = resolvePersistTarget();
        if (config.onToggleInternalRule) {
          config.onToggleInternalRule({ value, tbBaseUrl, customerTbId });
        } else {
          void persistServerScope({ isInternalSupportRule: value });
        }
      });
    }
  },

  _setupDrag(container: HTMLElement): void {
    const handle = container.querySelector('[data-drag-handle]');
    if (!handle) return;
    const onDown = (e: any) => {
      if (e.target.closest('[data-action]')) return; // don't drag when clicking buttons
      this._isDragging = true;
      const rect = container.getBoundingClientRect();
      this._dragOffset.x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
      this._dragOffset.y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
      container.classList.add('dragging');
      this._isPinned = true;
      container.classList.add('pinned');
      container.querySelector('[data-action="pin"]')?.classList.add('pinned');
    };
    const onMove = (e: any) => {
      if (!this._isDragging) return;
      const cx = e.clientX || e.touches?.[0]?.clientX;
      const cy = e.clientY || e.touches?.[0]?.clientY;
      container.style.left = `${cx - this._dragOffset.x}px`;
      container.style.top = `${cy - this._dragOffset.y}px`;
    };
    const onUp = () => {
      this._isDragging = false;
      container.classList.remove('dragging');
    };
    handle.addEventListener('mousedown', onDown as EventListener);
    handle.addEventListener('touchstart', onDown as EventListener, { passive: true });
    document.addEventListener('mousemove', onMove as EventListener);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove as EventListener, { passive: true });
    document.addEventListener('touchend', onUp);
  },

  /**
   * Attach the tooltip to a trigger element with hover show/hide.
   * @param element  the trigger (e.g. the header alarm button)
   * @param getDataFn optional data provider (default: window.MyIOOrchestrator / window.MyIOUtils)
   * @returns cleanup function removing the listeners
   */
  attach(element: HTMLElement, getDataFn?: () => AlarmNotificationData): () => void {
    if (getDataFn) this._dataProvider = getDataFn;
    const self = this;

    const handleMouseEnter = () => {
      if (self._hideTimer) {
        clearTimeout(self._hideTimer);
        self._hideTimer = null;
      }
      self.show(element);
    };
    const handleMouseLeave = () => {
      if (!self._isMouseOver && !self._isPinned) self.hide();
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      self.hide(true);
    };
  },
};

export default AlarmNotificationTooltip;
