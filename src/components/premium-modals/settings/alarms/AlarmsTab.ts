/**
 * RFC-0180: Alarms Tab Component
 *
 * Section 1 — Active alarms for this device, grouped by ruleId.
 *             GET /api/v1/alarms?deviceId={gcdrDeviceId}&state=OPEN,ACK,ESCALATED,SNOOZED&limit=100&page=1
 *             Each group = 1 alarm-card with occurrenceCount + state-count chips.
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

/** Most-critical first */
const STATE_PRIORITY: Record<string, number> = {
  OPEN: 0, ESCALATED: 1, SNOOZED: 2, ACK: 3, CLOSED: 4,
};

const SEVERITY_PRIORITY: Record<string, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4,
};

const STATE_LABELS: Record<string, string> = {
  OPEN:      'Aberto',
  ACK:       'Reconhecido',
  ESCALATED: 'Escalado',
  SNOOZED:   'Silenciado',
  CLOSED:    'Fechado',
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

/** Aggregated group of alarms sharing the same ruleId */
interface GCDRAlarmGroup {
  ruleId: string;
  title: string;
  alarmType?: string;
  /** Highest severity across group */
  severity: string;
  /** Most-critical state across group */
  dominantState: string;
  /** Count per state: { OPEN: 44, ACK: 2, ... } */
  stateCounts: Record<string, number>;
  totalCount: number;
  firstOccurrence: string;
  lastOccurrence: string;
  /** All raw alarm IDs in this group — used for bulk actions */
  alarmIds: string[];
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
  private alarmGroups: GCDRAlarmGroup[] = [];
  private initialCheckedRuleIds = new Set<string>();

  constructor(config: AlarmsTabConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    const { container } = this.config;
    this.injectStyles();
    container.innerHTML = this.getLoadingHTML();

    try {
      const gcdrBaseUrl   = this.config.gcdrApiBaseUrl   || GCDR_DEFAULT_BASE_URL;
      const alarmsBaseUrl = this.config.alarmsApiBaseUrl || ALARMS_DEFAULT_BASE_URL;

      // Prefer AlarmServiceOrchestrator (device-keyed map from MAIN_VIEW prefetch),
      // then fall back to prefetchedAlarms (filtered array), then per-device API call.
      const aso = (window as unknown as {
        AlarmServiceOrchestrator?: { getAlarmsForDevice: (id: string) => GCDRAlarm[] };
      }).AlarmServiceOrchestrator;
      const fromOrch = this.config.gcdrDeviceId ? aso?.getAlarmsForDevice(this.config.gcdrDeviceId) ?? null : null;
      const prefetched = this.config.prefetchedAlarms;
      const alarmsPromise = (fromOrch != null && fromOrch.length > 0)
        ? Promise.resolve(fromOrch)
        : prefetched != null
          ? Promise.resolve(
              (prefetched as GCDRAlarm[]).filter(
                (a) => a.deviceId === this.config.gcdrDeviceId,
              ),
            )
          : this.fetchActiveAlarms(alarmsBaseUrl);

      const [alarms, rules] = await Promise.all([
        alarmsPromise,
        this.fetchCustomerRules(gcdrBaseUrl),
      ]);
      this.activeAlarms  = alarms;
      this.customerRules = rules;
      this.alarmGroups   = this.groupAlarms(alarms);

      for (const rule of this.customerRules) {
        if (rule.scope?.entityIds?.includes(this.config.gcdrDeviceId)) {
          this.initialCheckedRuleIds.add(rule.id);
        }
      }

      container.innerHTML = this.renderTab();
      this.populateAlarmsGrid();
      this.attachTabListeners();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      container.innerHTML = this.getErrorHTML(msg);
    }
  }

  destroy(): void {
    // No persistent subscriptions
  }

  // ============================================================================
  // Grouping
  // ============================================================================

  /**
   * Group raw alarms by metadata.ruleId (fallback: title).
   * One card per group; occurrenceCount = total alarms in group.
   */
  private groupAlarms(alarms: GCDRAlarm[]): GCDRAlarmGroup[] {
    const map = new Map<string, GCDRAlarmGroup>();

    for (const alarm of alarms) {
      const key = alarm.metadata?.ruleId || alarm.title || alarm.id;

      if (!map.has(key)) {
        map.set(key, {
          ruleId:          key,
          title:           alarm.title    || '',
          alarmType:       alarm.alarmType,
          severity:        alarm.severity || 'LOW',
          dominantState:   alarm.state    || 'OPEN',
          stateCounts:     {},
          totalCount:      0,
          firstOccurrence: alarm.raisedAt      || '',
          lastOccurrence:  alarm.lastUpdatedAt || alarm.raisedAt || '',
          alarmIds:        [],
        });
      }

      const g = map.get(key)!;
      g.totalCount++;
      g.alarmIds.push(alarm.id);
      g.stateCounts[alarm.state] = (g.stateCounts[alarm.state] || 0) + 1;

      // Escalate dominant state to most-critical
      if ((STATE_PRIORITY[alarm.state] ?? 99) < (STATE_PRIORITY[g.dominantState] ?? 99)) {
        g.dominantState = alarm.state;
      }

      // Escalate severity to highest
      if ((SEVERITY_PRIORITY[alarm.severity] ?? 99) < (SEVERITY_PRIORITY[g.severity] ?? 99)) {
        g.severity = alarm.severity;
      }

      // Track earliest firstOccurrence
      if (alarm.raisedAt && (!g.firstOccurrence || alarm.raisedAt < g.firstOccurrence)) {
        g.firstOccurrence = alarm.raisedAt;
      }

      // Track latest lastOccurrence
      const lastTs = alarm.lastUpdatedAt || alarm.raisedAt || '';
      if (lastTs && lastTs > g.lastOccurrence) {
        g.lastOccurrence = lastTs;
      }
    }

    // Sort: most-critical dominant state first, then highest severity
    return [...map.values()].sort((a, b) => {
      const sd = (STATE_PRIORITY[a.dominantState] ?? 99) - (STATE_PRIORITY[b.dominantState] ?? 99);
      if (sd !== 0) return sd;
      return (SEVERITY_PRIORITY[a.severity] ?? 99) - (SEVERITY_PRIORITY[b.severity] ?? 99);
    });
  }

  /**
   * Map an aggregated GCDRAlarmGroup → Alarm so createAlarmCardElement can be used.
   * State-count chips go into _alarmTypes → rendered as type chips in the card body.
   */
  private mapGroupToAlarm(group: GCDRAlarmGroup): Alarm {
    // Build chips sorted most-critical first: "Aberto × 44", "Reconhecido × 2"
    const stateChips = Object.entries(group.stateCounts)
      .sort((a, b) => (STATE_PRIORITY[a[0]] ?? 99) - (STATE_PRIORITY[b[0]] ?? 99))
      .map(([state, count]) => `${STATE_LABELS[state] || state} × ${count}`);

    return {
      id:              group.ruleId,
      customerId:      this.config.gcdrCustomerId,
      customerName:    '',
      source:          '',
      severity:        group.severity      as AlarmSeverity,
      state:           group.dominantState as AlarmState,
      title:           group.title,
      description:     '',
      tags:            {},
      firstOccurrence: group.firstOccurrence,
      lastOccurrence:  group.lastOccurrence,
      occurrenceCount: group.totalCount,
      _alarmTypes:     stateChips,
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

  private async putRuleScope(
    baseUrl: string,
    ruleId: string,
    entityIds: string[],
  ): Promise<boolean> {
    try {
      const url = `${baseUrl}/api/v1/rules/${encodeURIComponent(ruleId)}`;
      const response = await fetch(url, {
        method: 'PUT',
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

    for (const group of this.alarmGroups) {
      const alarm = this.mapGroupToAlarm(group);

      const params: AlarmCardParams = {
        showCustomerName: false,
        showDeviceBadge:  false,
        alarmTypes:       alarm._alarmTypes,
        onAcknowledge: async () => {
          if (AlarmService?.batchAcknowledge) {
            await AlarmService.batchAcknowledge(group.alarmIds, userEmail);
          } else {
            await Promise.all(
              group.alarmIds.map((id) => this.postAlarmAction(alarmsBaseUrl, id, 'acknowledge')),
            );
          }
          await this.refreshAlarmsGrid(alarmsBaseUrl);
        },
        onSnooze: async () => {
          if (AlarmService?.batchSilence) {
            await AlarmService.batchSilence(group.alarmIds, userEmail, '4h');
          } else {
            await Promise.all(
              group.alarmIds.map((id) => this.postAlarmAction(alarmsBaseUrl, id, 'snooze')),
            );
          }
          await this.refreshAlarmsGrid(alarmsBaseUrl);
        },
        onEscalate: async () => {
          if (AlarmService?.batchEscalate) {
            await AlarmService.batchEscalate(group.alarmIds, userEmail);
          } else {
            await Promise.all(
              group.alarmIds.map((id) => this.postAlarmAction(alarmsBaseUrl, id, 'escalate')),
            );
          }
          await this.refreshAlarmsGrid(alarmsBaseUrl);
        },
        onDetails: () => {
          openAlarmDetailsModal(alarm);
        },
      };

      const el = createAlarmCardElement(alarm, params);
      grid.appendChild(el);
    }
  }

  private async refreshAlarmsGrid(alarmsBaseUrl: string): Promise<void> {
    this.activeAlarms = await this.fetchActiveAlarms(alarmsBaseUrl);
    this.alarmGroups  = this.groupAlarms(this.activeAlarms);

    // RFC-0183: Rebuild AlarmServiceOrchestrator maps after action
    const aso = (window as unknown as { AlarmServiceOrchestrator?: { refresh: () => Promise<void> } })
      .AlarmServiceOrchestrator;
    if (aso) {
      await aso.refresh().catch(() => { /* non-blocking */ });
    }

    // Update count badge (shows group count, not raw alarm count)
    const badge = this.config.container.querySelector<HTMLElement>('#at-alarms-count');
    if (badge) {
      badge.textContent    = String(this.alarmGroups.length);
      badge.style.display  = this.alarmGroups.length > 0 ? '' : 'none';
    }
    const sub = this.config.container.querySelector<HTMLElement>('#at-alarms-sub');
    if (sub) {
      sub.textContent = this.buildSectionSubtitle();
    }

    const grid  = this.config.container.querySelector<HTMLElement>('#at-alarms-grid');
    const empty = this.config.container.querySelector<HTMLElement>('#at-alarms-empty');

    if (this.alarmGroups.length === 0) {
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
    const groups = this.alarmGroups.length;
    if (total === 0) return 'Nenhum alarme ativo para este dispositivo';
    return `${total} ocorrência${total !== 1 ? 's' : ''} em ${groups} tipo${groups !== 1 ? 's' : ''}`;
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
    const groups = this.alarmGroups.length;
    return `
      <div class="at-section">
        <div class="at-section-header">
          <span class="at-section-icon">🔔</span>
          <div>
            <div class="at-section-title">Alarmes Ativos</div>
            <div class="at-section-sub" id="at-alarms-sub">${this.buildSectionSubtitle()}</div>
          </div>
          <span class="at-count-badge" id="at-alarms-count"
                style="${groups === 0 ? 'display:none;' : ''}">${groups}</span>
        </div>
        <!-- .myio-alarms-panel wrapper so panel CSS variables / alarm-card styles apply -->
        <div class="myio-alarms-panel at-alarms-panel-host">
          <div class="at-empty" id="at-alarms-empty"
               style="${groups > 0 ? 'display:none;' : ''}">
            Nenhum alarme ativo para este dispositivo.
          </div>
          <div class="alarms-grid" id="at-alarms-grid"
               style="${groups === 0 ? 'display:none;' : ''}"></div>
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
    const checked = this.initialCheckedRuleIds.has(rule.id);
    const color   = PRIORITY_COLORS[rule.priority] ?? '#6b7280';
    const metric  = rule.alarmConfig?.metric ?? '';
    const op      = OPERATOR_LABELS[rule.alarmConfig?.operator ?? ''] ?? rule.alarmConfig?.operator ?? '';
    const val     = rule.alarmConfig?.value ?? '';
    return `
      <div class="at-rule-row at-rule-row--selectable ${checked ? 'at-rule-row--checked' : ''}">
        <label class="at-rule-label">
          <input
            type="checkbox"
            class="at-rule-check"
            data-rule-id="${this.esc(rule.id)}"
            ${checked ? 'checked' : ''}
          >
          <div class="at-rule-info">
            <span class="at-rule-name">${this.esc(rule.name)}</span>
            ${metric ? `<span class="at-rule-chip">${this.esc(metric)} ${this.esc(String(op))} ${val}</span>` : ''}
          </div>
        </label>
        <span class="at-priority-badge" style="background:${color}20;color:${color};">${this.esc(rule.priority)}</span>
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
      const ok = await this.putRuleScope(baseUrl, ruleId, ids);
      if (ok) { rule.scope = { ...rule.scope, entityIds: ids }; }
      else    { errors.push(rule.name); }
    }

    for (const ruleId of toRemove) {
      const rule = ruleMap.get(ruleId);
      if (!rule) continue;
      const ids = (rule.scope?.entityIds ?? []).filter((id) => id !== this.config.gcdrDeviceId);
      const ok = await this.putRuleScope(baseUrl, ruleId, ids);
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
