/**
 * RFC-0180: Alarms Tab Component
 *
 * Section 1 — Active alarms for this device, "separado" (Disp. + Tipo) view.
 *             GET /api/v1/alarms?deviceId={gcdrDeviceId}&state=OPEN,ACK,ESCALATED,SNOOZED&limit=100&page=1
 *             One alarm-card per individual alarm; ACK/Snooze/Escalate visible; Qte. hidden.
 *             Rendered via createAlarmCardElement (same card as AlarmsNotificationsPanel).
 *
 * Section 2 — Multi-select of all customer rules; Save updates scope.entityIds
 *              via PUT /rules/{id} (full array replacement — no granular API).
 */

import { createAlarmCardElement } from '../../../AlarmsNotificationsPanel/AlarmCard';
import { openAlarmDetailsModal } from '../../../AlarmsNotificationsPanel/AlarmDetailsModal';
import { ALARMS_NOTIFICATIONS_PANEL_STYLES } from '../../../AlarmsNotificationsPanel/styles';
import type { AlarmCardParams } from '../../../AlarmsNotificationsPanel/types';
import type { Alarm, AlarmSeverity, AlarmState } from '../../../../types/alarm';
import type { GCDRCustomerBundle } from '../../gcdr-sync/types';

// ============================================================================
// Constants
// ============================================================================

const GCDR_INTEGRATION_API_KEY = 'gcdr_cust_tb_integration_key_2026';
const GCDR_DEFAULT_BASE_URL    = 'https://gcdr-api.a.myio-bas.com';
const ALARMS_DEFAULT_BASE_URL  = 'https://alarms-api.a.myio-bas.com';

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH:     '#f59e0b',
  MEDIUM:   '#3b82f6',
  LOW:      '#6b7280',
};

const OPERATOR_LABELS: Record<string, string> = {
  LT: '<', GT: '>', LTE: '≤', GTE: '≥', EQ: '=',
};

// ============================================================================
// Types
// ============================================================================

export interface AlarmsTabConfig {
  container: HTMLElement;
  /** GCDR UUID of this device (SERVER_SCOPE attr `gcdrDeviceId` on TB device) */
  gcdrDeviceId: string;
  /** GCDR UUID of the customer (SERVER_SCOPE attr `gcdrCustomerId` on TB customer) */
  gcdrCustomerId: string;
  /** GCDR Tenant ID — X-Tenant-ID header */
  gcdrTenantId: string;
  /** GCDR API base URL. Defaults to https://gcdr-api.a.myio-bas.com */
  gcdrApiBaseUrl?: string;
  /** Alarms API base URL. Defaults to https://alarms-api.a.myio-bas.com */
  alarmsApiBaseUrl?: string;
  /** ThingsBoard device UUID */
  tbDeviceId: string;
  /** JWT token — available for future use */
  jwtToken: string;
  /** Pre-fetched bundle from MAIN_VIEW orchestrator (reserved) */
  prefetchedBundle?: GCDRCustomerBundle | null;
  /** Pre-fetched customer alarms from MAIN_VIEW orchestrator (raw GCDR API format, `unknown[]`).
   *  When provided, AlarmsTab casts to GCDRAlarm[], filters by gcdrDeviceId, and skips
   *  the per-device API call. */
  prefetchedAlarms?: unknown[] | null;
  /** Pre-fetched customer rules (GCDRCustomerRule[]).
   *  When provided, skips GET /customers/{id}/rules — useful for offline/showcase mode. */
  prefetchedRules?: unknown[] | null;
  /** API key used for rule-mutation calls (PATCH /rules/:id alarmConfig).
   *  Overrides the module-level GCDR_INTEGRATION_API_KEY when provided. */
  gcdrApiKey?: string;
}

/** Raw alarm returned by GET /api/v1/alarms */
interface GCDRAlarm {
  id: string;
  title: string;
  severity: string;
  state: string;
  alarmType?: string;
  description?: string;
  deviceId?: string;
  deviceName?: string;
  raisedAt?: string;
  lastUpdatedAt?: string;
  acknowledgedAt?: string;
  metadata?: {
    value?: number | string;
    threshold?: number | string;
    operator?: string;
    ruleId?: string;
    tbDeviceId?: string;
    [key: string]: unknown;
  };
}

/** Rule object returned by GET /customers/:gcdrCustomerId/rules */
interface GCDRCustomerRule {
  id: string;
  name: string;
  type: string;
  priority: string;
  enabled: boolean;
  scope: {
    type: string;
    entityIds: string[];
  };
  alarmConfig?: {
    metric: string;
    operator: string;
    value: number;
    valueHigh?: number | null;
  };
}

// ============================================================================
// AlarmsTab
// ============================================================================

export class AlarmsTab {
  private config: AlarmsTabConfig;
  private customerRules: GCDRCustomerRule[] = [];
  private activeAlarms: GCDRAlarm[] = [];
  private initialCheckedRuleIds = new Set<string>();
  private alarmsUpdatedHandler: (() => void) | null = null;

  constructor(config: AlarmsTabConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    const { container } = this.config;
    this.injectStyles();
    container.innerHTML = this.getLoadingHTML();

    try {
      const gcdrBaseUrl = this.config.gcdrApiBaseUrl || GCDR_DEFAULT_BASE_URL;

      // MAIN_VIEW is the single source of truth for alarm data.
      // AlarmServiceOrchestrator (ASO) is always built by MAIN before any Settings modal opens.
      // We read from ASO directly — no independent API call to alarms-api.
      const alarms = this.readAlarmsFromASO();

      const rules = this.config.prefetchedRules != null
        ? (this.config.prefetchedRules as GCDRCustomerRule[])
        : await this.fetchCustomerRules(gcdrBaseUrl);
      this.activeAlarms  = alarms;
      this.customerRules = rules;

      for (const rule of this.customerRules) {
        if (rule.scope?.entityIds?.includes(this.config.gcdrDeviceId)) {
          this.initialCheckedRuleIds.add(rule.id);
        }
      }

      container.innerHTML = this.renderTab();
      this.populateAlarmsGrid();
      this.attachTabListeners();

      // Re-read from ASO whenever MAIN refreshes alarm data (e.g. after ACK/snooze in ALARM widget)
      this.alarmsUpdatedHandler = () => {
        const fresh = this.readAlarmsFromASO();
        this.activeAlarms = fresh;
        this.refreshAlarmsGridFromCurrentData();
      };
      window.addEventListener('myio:alarms-updated', this.alarmsUpdatedHandler);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      container.innerHTML = this.getErrorHTML(msg);
    }
  }

  destroy(): void {
    if (this.alarmsUpdatedHandler) {
      window.removeEventListener('myio:alarms-updated', this.alarmsUpdatedHandler);
      this.alarmsUpdatedHandler = null;
    }
  }

  /**
   * Read device-specific alarms from AlarmServiceOrchestrator (built by MAIN_VIEW).
   * Falls back to prefetchedAlarms prop when ASO is not available (e.g. standalone showcase).
   */
  private readAlarmsFromASO(): GCDRAlarm[] {
    const aso = (window as unknown as {
      AlarmServiceOrchestrator?: { getAlarmsForDevice: (id: string) => GCDRAlarm[] };
    }).AlarmServiceOrchestrator;

    if (aso && this.config.gcdrDeviceId) {
      return aso.getAlarmsForDevice(this.config.gcdrDeviceId) as GCDRAlarm[];
    }

    // Fallback: prefetchedAlarms filtered by deviceId
    const prefetched = this.config.prefetchedAlarms;
    if (prefetched != null) {
      return (prefetched as GCDRAlarm[]).filter(
        (a) => a.deviceId === this.config.gcdrDeviceId,
      );
    }

    return [];
  }

  // ============================================================================
  // Card mapping — separado (Disp. + Tipo) view: one card per individual alarm
  // ============================================================================

  /**
   * Map a raw GCDRAlarm → Alarm for createAlarmCardElement.
   * Each alarm is its own card (no grouping by ruleId).
   */
  private mapAlarmToCard(alarm: GCDRAlarm): Alarm {
    return {
      id:              alarm.id,
      customerId:      this.config.gcdrCustomerId,
      customerName:    '',
      source:          alarm.deviceName || '',
      severity:        (alarm.severity || 'LOW') as AlarmSeverity,
      state:           (alarm.state    || 'OPEN') as AlarmState,
      title:           alarm.title || '',
      description:     alarm.description || '',
      tags:            {},
      firstOccurrence: alarm.raisedAt || '',
      lastOccurrence:  alarm.lastUpdatedAt || alarm.raisedAt || '',
      occurrenceCount: 1,
    };
  }

  // ============================================================================
  // Data fetching
  // ============================================================================

  private async fetchActiveAlarms(baseUrl: string): Promise<GCDRAlarm[]> {
    const url =
      `${baseUrl}/api/v1/alarms` +
      `?deviceId=${encodeURIComponent(this.config.gcdrDeviceId)}` +
      `&state=OPEN,ACK,ESCALATED,SNOOZED&limit=100&page=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': GCDR_INTEGRATION_API_KEY,
        'X-Tenant-ID': this.config.gcdrTenantId,
        Accept: 'application/json',
      },
    });

    if (response.status === 404) return [];
    if (!response.ok) {
      throw new Error(`Alarms API error (${response.status}): ${response.statusText}`);
    }

    const json = (await response.json()) as {
      items?: GCDRAlarm[];
      data?: GCDRAlarm[] | { items?: GCDRAlarm[] };
    };
    if (Array.isArray(json.data)) return json.data;
    return json.items ?? (json.data as { items?: GCDRAlarm[] } | undefined)?.items ?? [];
  }

  private async fetchCustomerRules(baseUrl: string): Promise<GCDRCustomerRule[]> {
    const url = `${baseUrl}/api/v1/customers/${encodeURIComponent(this.config.gcdrCustomerId)}/rules`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': GCDR_INTEGRATION_API_KEY,
        'X-Tenant-ID': this.config.gcdrTenantId,
        Accept: 'application/json',
      },
    });

    if (response.status === 404) return [];
    if (!response.ok) {
      throw new Error(`GCDR error fetching rules (${response.status}): ${response.statusText}`);
    }

    const json = (await response.json()) as {
      items?: GCDRCustomerRule[];
      data?: { items?: GCDRCustomerRule[] };
    };
    return json.items ?? json.data?.items ?? [];
  }

  private async postAlarmAction(baseUrl: string, alarmId: string, action: string): Promise<boolean> {
    try {
      const response = await fetch(`${baseUrl}/api/v1/alarms/${encodeURIComponent(alarmId)}/${action}`, {
        method: 'POST',
        headers: {
          'X-API-Key': GCDR_INTEGRATION_API_KEY,
          'X-Tenant-ID': this.config.gcdrTenantId,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async patchRuleScope(
    baseUrl: string,
    ruleId: string,
    entityIds: string[],
  ): Promise<boolean> {
    try {
      const url = `${baseUrl}/api/v1/rules/${encodeURIComponent(ruleId)}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'X-API-Key': GCDR_INTEGRATION_API_KEY,
          'X-Tenant-ID': this.config.gcdrTenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scope: { type: 'DEVICE', entityIds } }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async patchRuleValue(
    baseUrl: string,
    ruleId: string,
    alarmConfig: GCDRCustomerRule['alarmConfig'],
  ): Promise<boolean> {
    try {
      const url = `${baseUrl}/api/v1/rules/${encodeURIComponent(ruleId)}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'X-API-Key': this.config.gcdrApiKey ?? GCDR_INTEGRATION_API_KEY,
          'X-Tenant-ID': this.config.gcdrTenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alarmConfig }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Alarm grid population
  // ============================================================================

  private populateAlarmsGrid(): void {
    const grid = this.config.container.querySelector<HTMLElement>('#at-alarms-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const alarmsBaseUrl = this.config.alarmsApiBaseUrl || ALARMS_DEFAULT_BASE_URL;
    const AlarmService = (window as unknown as {
      MyIOLibrary?: {
        AlarmService?: {
          batchAcknowledge?: (ids: string[], email: string) => Promise<void>;
          batchSilence?:     (ids: string[], email: string, duration: string) => Promise<void>;
          batchEscalate?:    (ids: string[], email: string) => Promise<void>;
        };
      };
    }).MyIOLibrary?.AlarmService;
    const userEmail = (window as unknown as { MyIOUtils?: { currentUserEmail?: string } })
      .MyIOUtils?.currentUserEmail || '';

    // Separado view: one card per individual alarm (Disp. + Tipo unit)
    for (const rawAlarm of this.activeAlarms) {
      const alarm = this.mapAlarmToCard(rawAlarm);

      // onAction callback forwarded to AlarmDetailsModal → Timeline tab
      const onAction = (action: 'acknowledge' | 'snooze' | 'escalate', alarmId: string): void => {
        const doAction = async () => {
          if (action === 'acknowledge') {
            if (AlarmService?.batchAcknowledge) {
              await AlarmService.batchAcknowledge([alarmId], userEmail);
            } else {
              await this.postAlarmAction(alarmsBaseUrl, alarmId, 'acknowledge');
            }
          } else if (action === 'snooze') {
            if (AlarmService?.batchSilence) {
              await AlarmService.batchSilence([alarmId], userEmail, '4h');
            } else {
              await this.postAlarmAction(alarmsBaseUrl, alarmId, 'snooze');
            }
          } else if (action === 'escalate') {
            if (AlarmService?.batchEscalate) {
              await AlarmService.batchEscalate([alarmId], userEmail);
            } else {
              await this.postAlarmAction(alarmsBaseUrl, alarmId, 'escalate');
            }
          }
          await this.refreshAlarmsGrid(alarmsBaseUrl);
        };
        doAction().catch(() => { /* non-blocking */ });
      };

      const params: AlarmCardParams = {
        showCustomerName:    false,
        showDeviceBadge:     false,
        hideOccurrenceCount: true,  // always 1 in separado — not meaningful
        onAcknowledge: async () => {
          if (AlarmService?.batchAcknowledge) {
            await AlarmService.batchAcknowledge([rawAlarm.id], userEmail);
          } else {
            await this.postAlarmAction(alarmsBaseUrl, rawAlarm.id, 'acknowledge');
          }
          await this.refreshAlarmsGrid(alarmsBaseUrl);
        },
        onSnooze: async () => {
          if (AlarmService?.batchSilence) {
            await AlarmService.batchSilence([rawAlarm.id], userEmail, '4h');
          } else {
            await this.postAlarmAction(alarmsBaseUrl, rawAlarm.id, 'snooze');
          }
          await this.refreshAlarmsGrid(alarmsBaseUrl);
        },
        onEscalate: async () => {
          if (AlarmService?.batchEscalate) {
            await AlarmService.batchEscalate([rawAlarm.id], userEmail);
          } else {
            await this.postAlarmAction(alarmsBaseUrl, rawAlarm.id, 'escalate');
          }
          await this.refreshAlarmsGrid(alarmsBaseUrl);
        },
        onDetails: () => {
          openAlarmDetailsModal(alarm, 'light', 'separado', onAction);
        },
      };

      const el = createAlarmCardElement(alarm, params);
      grid.appendChild(el);
    }
  }

  /**
   * After an alarm action (ACK/snooze/escalate), trigger MAIN to refresh the ASO.
   * The myio:alarms-updated event will update this component automatically.
   * Also updates the grid immediately from the post-action ASO data.
   */
  private async refreshAlarmsGrid(_alarmsBaseUrl?: string): Promise<void> {
    const aso = (window as unknown as {
      AlarmServiceOrchestrator?: { refresh: () => Promise<void> };
    }).AlarmServiceOrchestrator;

    if (aso) {
      // Refresh MAIN source → fires myio:alarms-updated → our handler calls refreshAlarmsGridFromCurrentData
      await aso.refresh().catch(() => { /* non-blocking */ });
    } else {
      // Fallback: re-read from ASO directly (may not have new data yet)
      this.activeAlarms = this.readAlarmsFromASO();
      this.refreshAlarmsGridFromCurrentData();
    }
  }

  /** Update the alarm grid DOM from this.activeAlarms (no network call). */
  private refreshAlarmsGridFromCurrentData(): void {
    const count = this.activeAlarms.length;

    const badge = this.config.container.querySelector<HTMLElement>('#at-alarms-count');
    if (badge) {
      badge.textContent   = String(count);
      badge.style.display = count > 0 ? '' : 'none';
    }
    const sub = this.config.container.querySelector<HTMLElement>('#at-alarms-sub');
    if (sub) {
      sub.textContent = this.buildSectionSubtitle();
    }

    const grid  = this.config.container.querySelector<HTMLElement>('#at-alarms-grid');
    const empty = this.config.container.querySelector<HTMLElement>('#at-alarms-empty');

    if (count === 0) {
      if (grid)  grid.style.display  = 'none';
      if (empty) empty.style.display = '';
    } else {
      if (grid)  grid.style.display  = '';
      if (empty) empty.style.display = 'none';
      this.populateAlarmsGrid();
    }
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  private buildSectionSubtitle(): string {
    const total = this.activeAlarms.length;
    if (total === 0) return 'Nenhum alarme ativo para este dispositivo';
    return `${total} alarme${total !== 1 ? 's' : ''} ativo${total !== 1 ? 's' : ''} para este dispositivo`;
  }

  private renderTab(): string {
    return `
      <div class="alarms-tab">
        ${this.renderSection1()}
        ${this.renderSection2()}
      </div>
    `;
  }

  private renderSection1(): string {
    const count = this.activeAlarms.length;
    return `
      <div class="at-section">
        <div class="at-section-header">
          <span class="at-section-icon">🔔</span>
          <div>
            <div class="at-section-title">Alarmes Ativos</div>
            <div class="at-section-sub" id="at-alarms-sub">${this.buildSectionSubtitle()}</div>
          </div>
          <span class="at-count-badge" id="at-alarms-count"
                style="${count === 0 ? 'display:none;' : ''}">${count}</span>
        </div>
        <!-- .myio-alarms-panel wrapper so panel CSS variables / alarm-card styles apply -->
        <div class="myio-alarms-panel at-alarms-panel-host">
          <div class="at-empty" id="at-alarms-empty"
               style="${count > 0 ? 'display:none;' : ''}">
            Nenhum alarme ativo para este dispositivo.
          </div>
          <div class="alarms-grid" id="at-alarms-grid"
               style="${count === 0 ? 'display:none;' : ''}"></div>
        </div>
      </div>
    `;
  }

  // ---------- Section 2: Parametrize rules (multi-select + save) ----------

  private renderSection2(): string {
    const sorted = [...this.customerRules].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
    );

    return `
      <div class="at-section">
        <div class="at-section-header">
          <span class="at-section-icon">⚙️</span>
          <div>
            <div class="at-section-title">Parametrizar Regras de Alarme</div>
            <div class="at-section-sub">Selecione as regras de alarme aplicáveis a este dispositivo e salve</div>
          </div>
        </div>
        ${
          sorted.length === 0
            ? `<div class="at-empty">Nenhuma regra de alarme configurada para este cliente no GCDR.</div>`
            : `
              <div class="at-rule-list at-rule-list--selectable">
                ${sorted.map((r) => this.renderCustomerRuleSelectable(r)).join('')}
              </div>
              <div class="at-footer">
                <span class="at-save-msg" id="at-save-msg" style="display:none;"></span>
                <button type="button" class="at-btn-save" id="at-save-btn">Salvar Alarmes</button>
              </div>
            `
        }
      </div>
    `;
  }

  private renderCustomerRuleSelectable(rule: GCDRCustomerRule): string {
    const checked    = this.initialCheckedRuleIds.has(rule.id);
    const color      = PRIORITY_COLORS[rule.priority] ?? '#6b7280';
    const hasConfig  = !!rule.alarmConfig;
    const metric     = rule.alarmConfig?.metric ?? '';
    const op         = OPERATOR_LABELS[rule.alarmConfig?.operator ?? ''] ?? rule.alarmConfig?.operator ?? '';
    const val        = rule.alarmConfig?.value ?? '';
    const ruleIdEsc  = this.esc(rule.id);
    return `
      <div class="at-rule-row at-rule-row--selectable ${checked ? 'at-rule-row--checked' : ''}" data-rule-id="${ruleIdEsc}">
        <label class="at-rule-label">
          <input
            type="checkbox"
            class="at-rule-check"
            data-rule-id="${ruleIdEsc}"
            ${checked ? 'checked' : ''}
          >
          <div class="at-rule-info">
            <span class="at-rule-name">${this.esc(rule.name)}</span>
            ${metric
              ? `<div class="at-rule-chip-wrap" id="at-chip-wrap-${ruleIdEsc}">
                   <span class="at-rule-chip">${this.esc(metric)} ${this.esc(String(op))} ${val}</span>
                 </div>`
              : ''}
          </div>
        </label>
        <div class="at-rule-actions">
          ${hasConfig ? `
            <button type="button" class="at-rule-edit-btn" data-rule-id="${ruleIdEsc}" title="Editar valor da regra">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>` : ''}
          <span class="at-priority-badge" style="background:${color}20;color:${color};">${this.esc(rule.priority)}</span>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // Event handling
  // ============================================================================

  private attachTabListeners(): void {
    const container = this.config.container;

    const saveBtn = container.querySelector('#at-save-btn') as HTMLButtonElement | null;
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave());
    }

    container.querySelectorAll('.at-rule-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const row = (cb as HTMLElement).closest('.at-rule-row');
        row?.classList.toggle('at-rule-row--checked', (cb as HTMLInputElement).checked);
      });
    });

    // Pencil button — inline edit of alarmConfig.value
    container.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.at-rule-edit-btn') as HTMLElement | null;
      if (!btn) return;
      const ruleId = btn.dataset.ruleId;
      if (!ruleId) return;
      this.openInlineEdit(ruleId, btn);
    });
  }

  private openInlineEdit(ruleId: string, editBtn: HTMLElement): void {
    const rule = this.customerRules.find((r) => r.id === ruleId);
    if (!rule?.alarmConfig) return;

    const container = this.config.container;
    const chipWrap  = container.querySelector<HTMLElement>(`#at-chip-wrap-${ruleId}`);
    if (!chipWrap) return;

    // Already in edit mode — don't open twice
    if (chipWrap.querySelector('.at-rule-edit-inline')) return;

    const { metric, operator, value, valueHigh } = rule.alarmConfig;
    const opLabel  = OPERATOR_LABELS[operator] ?? operator;
    const baseUrl  = this.config.gcdrApiBaseUrl || GCDR_DEFAULT_BASE_URL;
    const statusId = `at-edit-status-${ruleId}`;

    chipWrap.innerHTML = `
      <div class="at-rule-edit-inline">
        <span class="at-rule-edit-ctx">${this.esc(metric)} ${this.esc(String(opLabel))}</span>
        <input class="at-rule-edit-input" type="number" step="any"
               value="${value}" aria-label="Valor da regra">
        ${valueHigh != null ? `
          <span class="at-rule-edit-ctx">até</span>
          <input class="at-rule-edit-input at-rule-edit-input--high" type="number" step="any"
                 value="${valueHigh}" aria-label="Valor alto">
        ` : ''}
        <button type="button" class="at-rule-edit-confirm" title="Confirmar">✓</button>
        <button type="button" class="at-rule-edit-cancel"  title="Cancelar">✗</button>
        <span class="at-rule-edit-status" id="${statusId}"></span>
      </div>
    `;
    editBtn.style.display = 'none';

    const confirmBtn = chipWrap.querySelector<HTMLButtonElement>('.at-rule-edit-confirm');
    const cancelBtn  = chipWrap.querySelector<HTMLButtonElement>('.at-rule-edit-cancel');
    const statusEl   = chipWrap.querySelector<HTMLElement>(`#${statusId}`);
    const inputLow   = chipWrap.querySelector<HTMLInputElement>('.at-rule-edit-input:not(.at-rule-edit-input--high)');
    const inputHigh  = chipWrap.querySelector<HTMLInputElement>('.at-rule-edit-input--high');

    const restoreChip = (v: number, vh: number | null | undefined) => {
      const vhStr = vh != null ? ` – ${vh}` : '';
      chipWrap.innerHTML =
        `<span class="at-rule-chip">${this.esc(metric)} ${this.esc(String(opLabel))} ${v}${vhStr}</span>`;
      editBtn.style.display = '';
    };

    cancelBtn?.addEventListener('click', () => restoreChip(value, valueHigh));

    confirmBtn?.addEventListener('click', async () => {
      const newVal     = parseFloat(inputLow?.value ?? '');
      const newValHigh = inputHigh ? parseFloat(inputHigh.value) : undefined;

      if (isNaN(newVal)) {
        if (statusEl) { statusEl.textContent = 'Valor inválido'; statusEl.style.color = '#dc2626'; }
        return;
      }

      if (confirmBtn) confirmBtn.disabled = true;
      if (statusEl)   { statusEl.textContent = '…'; statusEl.style.color = '#6b7280'; }

      const updatedConfig: GCDRCustomerRule['alarmConfig'] = {
        ...rule.alarmConfig!,
        value: newVal,
        ...(newValHigh !== undefined && !isNaN(newValHigh) ? { valueHigh: newValHigh } : {}),
      };

      const ok = await this.patchRuleValue(baseUrl, ruleId, updatedConfig);

      if (ok) {
        rule.alarmConfig = updatedConfig;
        restoreChip(newVal, updatedConfig.valueHigh ?? null);
      } else {
        if (statusEl) { statusEl.textContent = 'Erro ao salvar'; statusEl.style.color = '#dc2626'; }
        if (confirmBtn) confirmBtn.disabled = false;
      }
    });

    inputLow?.focus();
    inputLow?.select();
  }

  private async handleSave(): Promise<void> {
    const container = this.config.container;
    const saveBtn = container.querySelector('#at-save-btn') as HTMLButtonElement | null;
    const msgEl   = container.querySelector('#at-save-msg') as HTMLElement | null;
    const baseUrl = this.config.gcdrApiBaseUrl || GCDR_DEFAULT_BASE_URL;

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvando…'; }
    if (msgEl)   msgEl.style.display = 'none';

    const currentChecked = new Set<string>();
    container.querySelectorAll<HTMLInputElement>('.at-rule-check').forEach((cb) => {
      if (cb.checked && cb.dataset.ruleId) currentChecked.add(cb.dataset.ruleId);
    });

    const toAdd    = [...currentChecked].filter((id) => !this.initialCheckedRuleIds.has(id));
    const toRemove = [...this.initialCheckedRuleIds].filter((id) => !currentChecked.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      this.showMsg(msgEl, 'Nenhuma alteração para salvar.', '#6b7280');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salvar Alarmes'; }
      return;
    }

    const ruleMap = new Map(this.customerRules.map((r) => [r.id, r]));
    const errors: string[] = [];

    for (const ruleId of toAdd) {
      const rule = ruleMap.get(ruleId);
      if (!rule) continue;
      const ids = [...(rule.scope?.entityIds ?? [])];
      if (!ids.includes(this.config.gcdrDeviceId)) ids.push(this.config.gcdrDeviceId);
      const ok = await this.patchRuleScope(baseUrl, ruleId, ids);
      if (ok) { rule.scope = { ...rule.scope, entityIds: ids }; }
      else    { errors.push(rule.name); }
    }

    for (const ruleId of toRemove) {
      const rule = ruleMap.get(ruleId);
      if (!rule) continue;
      const ids = (rule.scope?.entityIds ?? []).filter((id) => id !== this.config.gcdrDeviceId);
      const ok = await this.patchRuleScope(baseUrl, ruleId, ids);
      if (ok) { rule.scope = { ...rule.scope, entityIds: ids }; }
      else    { errors.push(rule.name); }
    }

    if (errors.length === 0) {
      this.initialCheckedRuleIds = new Set(currentChecked);
      this.showMsg(msgEl, 'Alarmes salvos com sucesso.', '#16a34a');
    } else {
      this.showMsg(msgEl, `Erro ao salvar: ${errors.join(', ')}`, '#dc2626');
    }

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salvar Alarmes'; }
  }

  private showMsg(el: HTMLElement | null, text: string, color: string): void {
    if (!el) return;
    el.textContent   = text;
    el.style.color   = color;
    el.style.display = 'inline';
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private esc(str: string): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private getLoadingHTML(): string {
    return `
      <div style="padding:32px;text-align:center;color:#6c757d;">
        <div class="at-spinner"></div>
        <p>Carregando dados de alarme…</p>
      </div>
    `;
  }

  private getErrorHTML(msg: string): string {
    return `
      <div style="padding:20px;">
        <div style="background:#fff0f0;border:1px solid #ffb3b3;border-radius:8px;padding:14px;color:#b71c1c;font-size:14px;line-height:1.5;">
          ⚠️ ${this.esc(msg)}
        </div>
      </div>
    `;
  }

  private injectStyles(): void {
    // Panel card styles (alarm-card, severity/state badges, footer buttons, etc.)
    const PANEL_STYLE_ID = 'myio-alarms-panel-styles';
    if (!document.getElementById(PANEL_STYLE_ID)) {
      const s = document.createElement('style');
      s.id = PANEL_STYLE_ID;
      s.textContent = ALARMS_NOTIFICATIONS_PANEL_STYLES;
      document.head.appendChild(s);
    }

    // AlarmsTab-specific overrides
    const TAB_STYLE_ID = 'myio-alarms-tab-styles';
    if (document.getElementById(TAB_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = TAB_STYLE_ID;
    style.textContent = `
      /* ===== AlarmsTab layout ===== */
      .alarms-tab {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 4px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .at-section {
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        overflow: hidden;
      }
      .at-section-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        background: #f8f9fa;
        border-bottom: 1px solid #e9ecef;
      }
      .at-section-icon { font-size: 18px; }
      .at-section-title {
        font-size: 14px;
        font-weight: 600;
        color: #3e1a7d;
        margin: 0;
      }
      .at-section-sub {
        font-size: 12px;
        color: #6c757d;
        margin-top: 2px;
      }
      .at-count-badge {
        margin-left: auto;
        background: #3e1a7d;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 20px;
        flex-shrink: 0;
      }
      .at-empty {
        padding: 20px;
        text-align: center;
        color: #6c757d;
        font-size: 14px;
        font-style: italic;
      }

      /* ===== Panel host reset ===== */
      .at-alarms-panel-host {
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
        padding: 12px !important;
        min-height: unset !important;
        height: auto !important;
        display: block !important;
      }
      .at-alarms-panel-host .alarms-grid {
        padding: 0 !important;
      }

      /* ===== Rule list (Section 2) ===== */
      .at-rule-list { padding: 4px 0; }
      .at-rule-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 20px;
        border-bottom: 1px solid #f1f3f5;
        transition: background 0.1s;
      }
      .at-rule-row:last-child { border-bottom: none; }
      .at-rule-row--checked { background: #f0fdf4; }
      .at-rule-label {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        cursor: pointer;
        min-width: 0;
      }
      .at-rule-check {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        accent-color: #3e1a7d;
        cursor: pointer;
      }
      .at-rule-info {
        display: flex;
        flex-direction: column;
        gap: 3px;
        flex: 1;
        min-width: 0;
      }
      .at-rule-name {
        font-size: 13px;
        font-weight: 500;
        color: #1a1a1a;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .at-rule-chip {
        display: inline-block;
        font-size: 11px;
        background: #f0f4f3;
        border-radius: 4px;
        padding: 1px 7px;
        color: #444;
        width: fit-content;
      }
      .at-priority-badge {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        flex-shrink: 0;
        white-space: nowrap;
      }
      .at-rule-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .at-rule-chip-wrap { display: block; }
      .at-rule-edit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: #9ca3af;
        cursor: pointer;
        padding: 0;
        transition: background 0.12s, color 0.12s;
        flex-shrink: 0;
      }
      .at-rule-edit-btn:hover { background: #ede9ff; color: #3e1a7d; }
      .at-rule-edit-inline {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: nowrap;
      }
      .at-rule-edit-ctx {
        font-size: 11px;
        color: #6b7280;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .at-rule-edit-input {
        width: 216px;
        height: 26px;
        border: 1.5px solid #3e1a7d;
        border-radius: 4px;
        padding: 0 6px;
        font-size: 12px;
        font-weight: 600;
        color: #1a1a1a;
        outline: none;
        background: #faf9ff;
        flex-shrink: 0;
      }
      .at-rule-edit-input:focus { border-color: #2d1458; box-shadow: 0 0 0 2px rgba(62,26,125,0.12); }
      .at-rule-edit-confirm,
      .at-rule-edit-cancel {
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 0.1s;
        flex-shrink: 0;
      }
      .at-rule-edit-confirm { background: #d1fae5; color: #065f46; }
      .at-rule-edit-confirm:hover:not(:disabled) { background: #a7f3d0; }
      .at-rule-edit-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
      .at-rule-edit-cancel { background: #fee2e2; color: #991b1b; }
      .at-rule-edit-cancel:hover { background: #fecaca; }
      .at-rule-edit-status { font-size: 11px; white-space: nowrap; }

      /* ===== Footer / save ===== */
      .at-footer {
        padding: 12px 20px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        border-top: 1px solid #e9ecef;
        background: #fafafa;
      }
      .at-save-msg { font-size: 13px; }
      .at-btn-save {
        background: #3e1a7d;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 8px 18px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
      }
      .at-btn-save:hover:not(:disabled) { background: #2d1458; }
      .at-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

      /* ===== Spinner ===== */
      .at-spinner {
        width: 28px;
        height: 28px;
        border: 3px solid #e9ecef;
        border-top-color: #3e1a7d;
        border-radius: 50%;
        animation: at-spin 0.8s linear infinite;
        margin: 0 auto 12px;
      }
      @keyframes at-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }
}
