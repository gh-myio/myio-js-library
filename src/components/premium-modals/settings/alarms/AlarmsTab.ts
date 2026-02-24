/**
 * RFC-0180: Alarms Tab Component
 *
 * Section 1 — Active alarm rules for this device (from GCDR bundle).
 * Section 2 — Multi-select of all customer rules; Save updates scope.entityIds
 *              via PUT /rules/{id} (full array replacement — no granular API).
 */

import type { GCDRCustomerBundle, GCDRBundleDevice, GCDRBundleRule } from '../../gcdr-sync/types';

// ============================================================================
// Constants
// ============================================================================

const GCDR_INTEGRATION_API_KEY = 'gcdr_cust_tb_integration_key_2026';
const GCDR_DEFAULT_BASE_URL = 'https://gcdr-api.a.myio-bas.com';

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#f59e0b',
  MEDIUM: '#3b82f6',
  LOW: '#6b7280',
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
  /** ThingsBoard device UUID — used to match device in bundle */
  tbDeviceId: string;
  /** JWT token — available for future use */
  jwtToken: string;
  /** Pre-fetched bundle from MAIN_VIEW orchestrator. May be null if not yet loaded. */
  prefetchedBundle?: GCDRCustomerBundle | null;
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
    /** Device UUIDs (GCDR) associated with this rule */
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
  /** Rule IDs checked at init — used to detect changes on Save */
  private initialCheckedRuleIds = new Set<string>();
  private bundle: GCDRCustomerBundle | null = null;

  constructor(config: AlarmsTabConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    const { container } = this.config;
    this.injectStyles();
    container.innerHTML = this.getLoadingHTML();

    try {
      const baseUrl = this.config.gcdrApiBaseUrl || GCDR_DEFAULT_BASE_URL;

      // 1. Use pre-fetched bundle or skip bundle (customerTB_ID not available here)
      this.bundle = this.config.prefetchedBundle ?? null;

      // 2. Fetch all customer rules (needed for Section 2)
      this.customerRules = await this.fetchCustomerRules(baseUrl);

      // 3. Determine which rules are already associated with this device
      for (const rule of this.customerRules) {
        if (rule.scope?.entityIds?.includes(this.config.gcdrDeviceId)) {
          this.initialCheckedRuleIds.add(rule.id);
        }
      }

      // 4. Render
      container.innerHTML = this.renderTab();
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
  // Data fetching
  // ============================================================================

  private async fetchCustomerRules(baseUrl: string): Promise<GCDRCustomerRule[]> {
    const url = `${baseUrl}/customers/${encodeURIComponent(this.config.gcdrCustomerId)}/rules`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': GCDR_INTEGRATION_API_KEY,
        'X-Tenant-ID': this.config.gcdrTenantId,
        Accept: 'application/json',
      },
    });

    if (response.status === 404) {
      // No rules configured — not an error
      return [];
    }

    if (!response.ok) {
      throw new Error(`GCDR error fetching rules (${response.status}): ${response.statusText}`);
    }

    const json = (await response.json()) as {
      items?: GCDRCustomerRule[];
      data?: { items?: GCDRCustomerRule[] };
    };
    return json.items ?? json.data?.items ?? [];
  }

  private async putRuleScope(
    baseUrl: string,
    ruleId: string,
    entityIds: string[],
  ): Promise<boolean> {
    try {
      const url = `${baseUrl}/rules/${encodeURIComponent(ruleId)}`;
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
  // Bundle helpers
  // ============================================================================

  private matchDeviceInBundle(): GCDRBundleDevice | null {
    if (!this.bundle) return null;
    return (
      this.bundle.devices.find(
        (d) =>
          d.externalId === this.config.tbDeviceId ||
          d.metadata?.tbId === this.config.tbDeviceId,
      ) ?? null
    );
  }

  private getActiveRulesFromBundle(): GCDRBundleRule[] {
    const device = this.matchDeviceInBundle();
    if (!device?.ruleIds?.length) return [];
    return device.ruleIds
      .map((id) => this.bundle!.rules[id])
      .filter(Boolean) as GCDRBundleRule[];
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  private renderTab(): string {
    return `
      <div class="alarms-tab">
        ${this.renderSection1()}
        ${this.renderSection2()}
      </div>
    `;
  }

  private renderSection1(): string {
    // Prefer bundle for active rules; fall back to customer rules list
    const bundleRules = this.getActiveRulesFromBundle();
    const hasBundleData = this.bundle !== null;

    // Fallback: filter customer rules where gcdrDeviceId is in entityIds
    const fallbackRules = hasBundleData
      ? null
      : this.customerRules.filter((r) => r.scope?.entityIds?.includes(this.config.gcdrDeviceId));

    const isEmpty = hasBundleData ? bundleRules.length === 0 : (fallbackRules?.length ?? 0) === 0;

    return `
      <div class="at-section">
        <div class="at-section-header">
          <span class="at-section-icon">🔔</span>
          <div>
            <div class="at-section-title">Active Alarm Rules</div>
            <div class="at-section-sub">Rules currently associated with this device</div>
          </div>
        </div>
        ${
          isEmpty
            ? `<div class="at-empty">No alarm rules are currently associated with this device.</div>`
            : hasBundleData
              ? `<div class="at-rule-list">${bundleRules.map((r) => this.renderBundleRule(r)).join('')}</div>`
              : `<div class="at-rule-list">${(fallbackRules ?? []).map((r) => this.renderCustomerRuleReadonly(r)).join('')}</div>`
        }
      </div>
    `;
  }

  private renderSection2(): string {
    const sorted = [...this.customerRules].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
    );

    return `
      <div class="at-section">
        <div class="at-section-header">
          <span class="at-section-icon">⚙️</span>
          <div>
            <div class="at-section-title">Parametrize Alarm Rules</div>
            <div class="at-section-sub">Select which alarm rules apply to this device, then save</div>
          </div>
        </div>
        ${
          sorted.length === 0
            ? `<div class="at-empty">No alarm rules configured for this customer in GCDR.</div>`
            : `
              <div class="at-rule-list at-rule-list--selectable">
                ${sorted.map((r) => this.renderCustomerRuleSelectable(r)).join('')}
              </div>
              <div class="at-footer">
                <span class="at-save-msg" id="at-save-msg" style="display:none;"></span>
                <button type="button" class="at-btn-save" id="at-save-btn">Save Alarms</button>
              </div>
            `
        }
      </div>
    `;
  }

  private renderBundleRule(rule: GCDRBundleRule): string {
    const op = OPERATOR_LABELS[rule.operator] ?? rule.operator;
    return `
      <div class="at-rule-row">
        <div class="at-rule-info">
          <span class="at-rule-name">${this.esc(rule.name)}</span>
          <span class="at-rule-chip">📊 ${this.esc(rule.metric)} ${this.esc(op)} ${rule.value}</span>
        </div>
        <span class="at-priority-badge at-priority--active">active</span>
      </div>
    `;
  }

  private renderCustomerRuleReadonly(rule: GCDRCustomerRule): string {
    const color = PRIORITY_COLORS[rule.priority] ?? '#6b7280';
    const metric = rule.alarmConfig?.metric ?? '';
    const op = OPERATOR_LABELS[rule.alarmConfig?.operator ?? ''] ?? rule.alarmConfig?.operator ?? '';
    const val = rule.alarmConfig?.value ?? '';
    return `
      <div class="at-rule-row">
        <div class="at-rule-info">
          <span class="at-rule-name">${this.esc(rule.name)}</span>
          ${metric ? `<span class="at-rule-chip">${this.esc(metric)} ${this.esc(String(op))} ${val}</span>` : ''}
        </div>
        <span class="at-priority-badge" style="background:${color}20;color:${color};">${this.esc(rule.priority)}</span>
      </div>
    `;
  }

  private renderCustomerRuleSelectable(rule: GCDRCustomerRule): string {
    const checked = this.initialCheckedRuleIds.has(rule.id);
    const color = PRIORITY_COLORS[rule.priority] ?? '#6b7280';
    const metric = rule.alarmConfig?.metric ?? '';
    const op = OPERATOR_LABELS[rule.alarmConfig?.operator ?? ''] ?? rule.alarmConfig?.operator ?? '';
    const val = rule.alarmConfig?.value ?? '';
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

    // Highlight row when checkbox changes
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
    const msgEl = container.querySelector('#at-save-msg') as HTMLElement | null;
    const baseUrl = this.config.gcdrApiBaseUrl || GCDR_DEFAULT_BASE_URL;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
    }
    if (msgEl) msgEl.style.display = 'none';

    // Collect current state
    const currentChecked = new Set<string>();
    container.querySelectorAll<HTMLInputElement>('.at-rule-check').forEach((cb) => {
      if (cb.checked && cb.dataset.ruleId) currentChecked.add(cb.dataset.ruleId);
    });

    const toAdd = [...currentChecked].filter((id) => !this.initialCheckedRuleIds.has(id));
    const toRemove = [...this.initialCheckedRuleIds].filter((id) => !currentChecked.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      this.showMsg(msgEl, 'No changes to save.', '#6b7280');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Alarms'; }
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
      if (ok) {
        // Update in-memory rule so future saves are accurate
        rule.scope = { ...rule.scope, entityIds: ids };
      } else {
        errors.push(rule.name);
      }
    }

    for (const ruleId of toRemove) {
      const rule = ruleMap.get(ruleId);
      if (!rule) continue;
      const ids = (rule.scope?.entityIds ?? []).filter((id) => id !== this.config.gcdrDeviceId);
      const ok = await this.putRuleScope(baseUrl, ruleId, ids);
      if (ok) {
        rule.scope = { ...rule.scope, entityIds: ids };
      } else {
        errors.push(rule.name);
      }
    }

    if (errors.length === 0) {
      this.initialCheckedRuleIds = new Set(currentChecked);
      this.showMsg(msgEl, 'Alarms saved successfully.', '#16a34a');
    } else {
      this.showMsg(msgEl, `Errors saving: ${errors.join(', ')}`, '#dc2626');
    }

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Alarms'; }
  }

  private showMsg(el: HTMLElement | null, text: string, color: string): void {
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
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
        <p>Loading alarm data…</p>
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
    const STYLE_ID = 'myio-alarms-tab-styles';
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
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
      .at-empty {
        padding: 20px;
        text-align: center;
        color: #6c757d;
        font-size: 14px;
        font-style: italic;
      }
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
      .at-rule-row--selectable { }
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
      .at-priority--active {
        background: #e6f9f0;
        color: #16a34a;
      }
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
