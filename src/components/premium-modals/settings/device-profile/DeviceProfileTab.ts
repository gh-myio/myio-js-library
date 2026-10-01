/**
 * DeviceProfileTab
 *
 * MyIO-admin-only tab in SettingsModalView: ThingsBoard identity + SERVER_SCOPE
 * attribute dump for a device, with inline editing for the fields support
 * actually needs to fix ("force" in the GCDR-Upsell-Setup vocabulary):
 * Type (TB device profile entity), Label, Device Profile (app attribute),
 * Identifier, Ingestion ID (+ single-device sync), GCDR Device/Customer/Asset
 * ID, and Owner (customer reassignment).
 *
 * Every write mirrors the exact API call already used and proven in
 * `src/components/premium-modals/upsell/openUpsellModal.ts` (GCDR-Upsell-Setup's
 * bulk "Forçar Atributo" / "Forçar Device Profile" / "Atribuir Owner" / "Sync
 * Ingestion ID" tools) — just scoped to one device instead of a bulk selection:
 *   - SERVER_SCOPE attribute: `POST /api/plugins/telemetry/DEVICE/{id}/attributes/SERVER_SCOPE`
 *   - Label / Type (TB): fetch `GET /api/device/{id}`, patch the field, `POST /api/device`
 *   - Owner: `POST /api/owner/CUSTOMER/{customerId}/DEVICE/{id}` (falls back to
 *     `POST /api/customer/{customerId}/device/{id}` on CE instances, no /api/owner route)
 *   - Ingestion ID sync: same ingestion-API match-by-centralId+slaveId algorithm
 *     as the bulk tool's "Sync Ingestion ID", for this one device.
 *
 * Self-contained, same shape as ExclusionGroupsTab: constructor(config) ->
 * init() (fetch + render) -> destroy(). Gated to MyIO admins by the caller
 * (SettingsModalView only mounts/shows this tab when isSuperAdmin()).
 */

export interface DeviceProfileTabConfig {
  container: HTMLElement;
  /** ThingsBoard Device UUID */
  deviceId: string;
  jwtToken: string;
  tbBaseUrl: string;
}

interface TbEntityRef {
  id: string;
  entityType: string;
}

interface TbDeviceEntity {
  id?: TbEntityRef;
  name?: string;
  type?: string;
  label?: string;
  deviceProfileId?: TbEntityRef;
  deviceProfileName?: string;
  customerId?: TbEntityRef;
  createdTime?: number;
  [key: string]: unknown;
}

interface TbAttribute {
  key: string;
  value: unknown;
}

interface DeviceProfileOption {
  id: string;
  name: string;
}

interface CustomerOption {
  id: string;
  title: string;
}

// ThingsBoard's placeholder customerId for "no customer assigned" (public/tenant-owned devices).
const TB_NULL_CUSTOMER_ID = '13814000-1dd2-11b2-8080-808080808080';

const STYLES_ID = 'dpt-styles';

/** Plain SERVER_SCOPE attributes editable inline as free text. */
const EDITABLE_ATTRS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'deviceProfile', label: 'Device Profile' },
  { key: 'identifier', label: 'Identifier' },
  { key: 'gcdrDeviceId', label: 'GCDR Device ID' },
  { key: 'gcdrCustomerId', label: 'GCDR Customer ID' },
  { key: 'gcdrAssetId', label: 'GCDR Asset ID' },
];

/** Read-only classification attrs shown alongside the editable ones. */
const READONLY_ATTRS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'deviceType', label: 'Device Type' },
  { key: 'slaveId', label: 'Slave ID' },
  { key: 'centralId', label: 'Central ID' },
  { key: 'centralName', label: 'Central' },
];

export class DeviceProfileTab {
  private config: DeviceProfileTabConfig;
  private entity: TbDeviceEntity | null = null;
  private attributes: TbAttribute[] = [];
  private ownerName: string | null = null;
  private deviceProfileOptions: DeviceProfileOption[] | null = null;
  private customerOptions: CustomerOption[] | null = null;

  constructor(config: DeviceProfileTabConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    this.config.container.innerHTML = this.getLoadingHTML();
    this.injectStyles();
    await this.loadAll();
    this.renderAndAttach();
  }

  destroy(): void {
    // No external resources to clean up (no timers, no global listeners).
  }

  // --------------------------------------------------------------------------
  // Private — data
  // --------------------------------------------------------------------------

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { 'X-Authorization': `Bearer ${this.config.jwtToken}`, ...(extra || {}) };
  }

  private async loadAll(): Promise<void> {
    const [entity, attributes] = await Promise.all([this.fetchEntity(), this.fetchAttributes()]);
    this.entity = entity;
    this.attributes = attributes;

    const customerId = entity?.customerId?.id;
    this.ownerName =
      customerId && customerId !== TB_NULL_CUSTOMER_ID ? await this.fetchCustomerName(customerId) : null;
  }

  private async fetchEntity(): Promise<TbDeviceEntity | null> {
    try {
      const { tbBaseUrl, deviceId } = this.config;
      const res = await fetch(`${tbBaseUrl}/api/device/${deviceId}`, { headers: this.headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as TbDeviceEntity;
    } catch (e) {
      console.warn('[DeviceProfileTab] Failed to fetch device entity:', e);
      return null;
    }
  }

  private async fetchAttributes(): Promise<TbAttribute[]> {
    try {
      const { tbBaseUrl, deviceId } = this.config;
      const res = await fetch(
        `${tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE`,
        { headers: this.headers() },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      return Array.isArray(raw) ? (raw as TbAttribute[]) : [];
    } catch (e) {
      console.warn('[DeviceProfileTab] Failed to fetch device attributes:', e);
      return [];
    }
  }

  private async fetchCustomerName(customerId: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.config.tbBaseUrl}/api/customer/${customerId}`, {
        headers: this.headers(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const c = await res.json();
      return c?.title || c?.name || null;
    } catch (e) {
      console.warn('[DeviceProfileTab] Failed to fetch customer name:', e);
      return null;
    }
  }

  private async fetchDeviceProfileOptions(): Promise<DeviceProfileOption[]> {
    if (this.deviceProfileOptions) return this.deviceProfileOptions;
    try {
      const res = await fetch(`${this.config.tbBaseUrl}/api/deviceProfile/names?activeOnly=true`, {
        headers: this.headers(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as Array<{ id: { id: string }; name: string }>;
      this.deviceProfileOptions = raw.map((p) => ({ id: p.id.id, name: p.name }));
    } catch (e) {
      console.warn('[DeviceProfileTab] Failed to fetch device profiles:', e);
      this.deviceProfileOptions = [];
    }
    return this.deviceProfileOptions;
  }

  private async fetchCustomerOptions(): Promise<CustomerOption[]> {
    if (this.customerOptions) return this.customerOptions;
    try {
      const res = await fetch(
        `${this.config.tbBaseUrl}/api/customers?pageSize=200&page=0&sortProperty=title&sortOrder=ASC`,
        { headers: this.headers() },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = (json?.data || []) as Array<{ id: { id: string }; title: string }>;
      this.customerOptions = data.map((c) => ({ id: c.id.id, title: c.title }));
    } catch (e) {
      console.warn('[DeviceProfileTab] Failed to fetch customers:', e);
      this.customerOptions = [];
    }
    return this.customerOptions;
  }

  private attrValue(key: string): unknown {
    return this.attributes.find((a) => a.key === key)?.value;
  }

  // --------------------------------------------------------------------------
  // Private — writes (one call per field, mirroring openUpsellModal.ts 1:1)
  // --------------------------------------------------------------------------

  /** `POST .../attributes/SERVER_SCOPE` — same call as the bulk "Forçar Atributo" tool. */
  private async saveAttribute(key: string, value: string): Promise<void> {
    const { tbBaseUrl, deviceId } = this.config;
    const res = await fetch(`${tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const idx = this.attributes.findIndex((a) => a.key === key);
    if (idx >= 0) this.attributes[idx] = { key, value };
    else this.attributes.push({ key, value });
  }

  /** Fetch → patch one field → `POST /api/device` (same pattern as saveEntityLabel/changeDeviceProfile). */
  private async saveEntityField(patch: Partial<TbDeviceEntity>): Promise<void> {
    const { tbBaseUrl, deviceId } = this.config;
    const getRes = await fetch(`${tbBaseUrl}/api/device/${deviceId}`, { headers: this.headers() });
    if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`);
    const device = await getRes.json();
    const postRes = await fetch(`${tbBaseUrl}/api/device`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...device, ...patch }),
    });
    if (!postRes.ok) throw new Error(`HTTP ${postRes.status}`);
    this.entity = { ...this.entity, ...patch } as TbDeviceEntity;
  }

  /** `POST /api/owner/CUSTOMER/{id}/DEVICE/{id}` with CE fallback — same as changeDeviceOwner(). */
  private async saveOwner(newCustomerId: string): Promise<void> {
    const { tbBaseUrl, deviceId } = this.config;
    const peRes = await fetch(`${tbBaseUrl}/api/owner/CUSTOMER/${newCustomerId}/DEVICE/${deviceId}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify([]),
    });
    if (!peRes.ok) {
      if (peRes.status !== 404) throw new Error(`HTTP ${peRes.status}`);
      const ceRes = await fetch(`${tbBaseUrl}/api/customer/${newCustomerId}/device/${deviceId}`, {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });
      if (!ceRes.ok) throw new Error(`HTTP ${ceRes.status}`);
    }
    this.entity = { ...this.entity, customerId: { id: newCustomerId, entityType: 'CUSTOMER' } } as TbDeviceEntity;
    this.ownerName = await this.fetchCustomerName(newCustomerId);
  }

  /**
   * Single-device "Sync Ingestion ID" — identical match algorithm to the bulk
   * tool (customer's `ingestionId` attr → this device's centralId+slaveId →
   * paged ingestion-API device list → match by gateway hardwareUuid+slaveId),
   * scoped to one device. Reuses the same ingestion-API app credentials
   * already shipped in openUpsellModal.ts (not a new secret).
   */
  private async syncIngestionId(): Promise<{ ok: boolean; message: string }> {
    const INGESTION_AUTH_URL = 'https://api.data.apps.myio-bas.com/api/v1/auth';
    const INGESTION_API_BASE = 'https://api.data.apps.myio-bas.com/api/v1';
    const INGESTION_CLIENT_ID = 'myioadmi_mekj7xw7_sccibe';
    const INGESTION_CLIENT_SECRET = 'KmXhNZu0uydeWZ8scAi43h7P2pntGoWkdzNVMSjbVj3slEsZ5hGVXyayshgJAoqA';

    const centralId = this.attrValue('centralId') as string | undefined;
    const slaveId = this.attrValue('slaveId') as string | number | undefined;
    if (!centralId || slaveId === undefined || slaveId === null || slaveId === '') {
      return { ok: false, message: 'Device sem centralId/slaveId — não é possível localizar na Ingestion API.' };
    }

    const customerId = this.entity?.customerId?.id;
    if (!customerId || customerId === TB_NULL_CUSTOMER_ID) {
      return { ok: false, message: 'Device sem Owner (customer) — não é possível resolver o customer da Ingestion API.' };
    }
    const customerAttrs = await this.fetchCustomerAttrs(customerId);
    const ingestionCustomerId = customerAttrs.find((a) => a.key === 'ingestionId')?.value as string | undefined;
    if (!ingestionCustomerId) {
      return { ok: false, message: 'Customer não tem atributo ingestionId configurado no ThingsBoard.' };
    }

    const authRes = await fetch(INGESTION_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: INGESTION_CLIENT_ID, client_secret: INGESTION_CLIENT_SECRET }),
    });
    if (!authRes.ok) throw new Error(`Ingestion auth HTTP ${authRes.status}`);
    const authJson = await authRes.json();
    const token = authJson?.access_token;
    if (!token) throw new Error('Ingestion auth: access_token ausente na resposta.');

    const slaveIdNum = typeof slaveId === 'string' ? parseInt(slaveId, 10) : slaveId;
    let page = 1;
    let match: { id: string } | null = null;
    // Bounded to 50 pages (5000 devices) — matches the bulk tool's page=100/req ceiling in practice.
    for (; page <= 50 && !match; page++) {
      const res = await fetch(
        `${INGESTION_API_BASE}/management/devices?page=${page}&limit=100&customerId=${encodeURIComponent(
          ingestionCustomerId,
        )}&includeInactive=false&sortBy=name&sortOrder=asc`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Ingestion devices HTTP ${res.status}`);
      const json = await res.json();
      const list: Array<{ id: string; slaveId?: number; gatewayId?: string; gateway?: { hardwareUuid?: string; id?: string } }> =
        json?.data || [];
      for (const d of list) {
        const gwId = d.gateway?.hardwareUuid || d.gatewayId || d.gateway?.id;
        if (gwId === centralId && d.slaveId === slaveIdNum) {
          match = { id: d.id };
          break;
        }
      }
      const totalPages = json?.pagination?.pages || 1;
      if (page >= totalPages) break;
    }

    if (!match) {
      return { ok: false, message: `Nenhum device na Ingestion API com centralId=${centralId} e slaveId=${slaveIdNum}.` };
    }

    await this.saveAttribute('ingestionId', match.id);
    return { ok: true, message: `ingestionId atualizado: ${match.id}` };
  }

  private async fetchCustomerAttrs(customerId: string): Promise<TbAttribute[]> {
    const res = await fetch(
      `${this.config.tbBaseUrl}/api/plugins/telemetry/CUSTOMER/${customerId}/values/attributes/SERVER_SCOPE`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return Array.isArray(raw) ? (raw as TbAttribute[]) : [];
  }

  // --------------------------------------------------------------------------
  // Private — render
  // --------------------------------------------------------------------------

  private esc(s: string): string {
    return s.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
    );
  }

  private displayText(value: unknown): string {
    if (value === undefined || value === null || value === '') return '—';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  private formatDate(ts: number | undefined | null): string {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('pt-BR');
    } catch {
      return String(ts);
    }
  }

  private getLoadingHTML(): string {
    return `
      <div style="padding: 20px; text-align: center; color: #6c757d;">
        <div class="loading-spinner"></div>
        <p>Carregando perfil do dispositivo...</p>
      </div>`;
  }

  /** One editable/read-only key-value row. `kind` picks the edit widget. */
  private renderRow(
    field: string,
    label: string,
    value: unknown,
    kind: 'readonly' | 'attr-text' | 'entity-label' | 'entity-profile' | 'owner' | 'ingestion',
  ): string {
    const text = this.esc(this.displayText(value));
    if (kind === 'readonly') {
      return `
        <div class="dpt-row" data-field="${this.esc(field)}">
          <span class="dpt-label">${this.esc(label)}</span>
          <span class="dpt-value">${text}</span>
        </div>`;
    }

    const syncBtn =
      kind === 'ingestion'
        ? `<button type="button" class="dpt-icon-btn" data-action="sync-ingestion" title="Buscar ingestionId na Ingestion API">🔄</button>`
        : '';

    return `
      <div class="dpt-row dpt-row--editable" data-field="${this.esc(field)}" data-kind="${kind}">
        <span class="dpt-label">${this.esc(label)}</span>
        <span class="dpt-value-wrap">
          <span class="dpt-value" data-view>${text}</span>
          ${syncBtn}
          <button type="button" class="dpt-icon-btn" data-action="edit" title="Editar">✏️</button>
        </span>
      </div>`;
  }

  private renderTab(): string {
    const e = this.entity;
    const ownerId = e?.customerId?.id;
    const ownerDisplay =
      ownerId && ownerId !== TB_NULL_CUSTOMER_ID ? this.ownerName || ownerId : '— (sem customer)';

    const highlightedRows = [
      this.renderRow('type', 'Type (TB)', e?.type, 'entity-profile'),
      this.renderRow('label', 'Label', e?.label, 'entity-label'),
      this.renderRow('owner', 'Owner', ownerDisplay, 'owner'),
    ].join('');

    const editableAttrRows = EDITABLE_ATTRS.map(({ key, label }) =>
      key === 'ingestionId'
        ? ''
        : this.renderRow(key, label, this.attrValue(key), 'attr-text'),
    ).join('');
    const ingestionRow = this.renderRow('ingestionId', 'Ingestion ID', this.attrValue('ingestionId'), 'ingestion');

    const readonlyRows = READONLY_ATTRS.map(({ key, label }) =>
      this.renderRow(key, label, this.attrValue(key), 'readonly'),
    ).join('');

    const highlightedKeys = new Set([...EDITABLE_ATTRS.map((a) => a.key), ...READONLY_ATTRS.map((a) => a.key)]);
    const otherAttrs = this.attributes
      .filter((a) => !highlightedKeys.has(a.key))
      .sort((a, b) => a.key.localeCompare(b.key));
    const otherRows = otherAttrs.length
      ? otherAttrs.map((a) => this.renderRow(a.key, a.key, a.value, 'readonly')).join('')
      : `<div class="dpt-empty">Nenhum outro atributo SERVER_SCOPE.</div>`;

    return `
      <div class="dpt-tab">
        <div class="dpt-notice">🔒 Aba visível apenas para administradores MyIO — altera dados direto no ThingsBoard.</div>

        <div class="dpt-section">
          <div class="dpt-section-title">Identificação (ThingsBoard)</div>
          <div class="dpt-card">
            ${highlightedRows}
            <div class="dpt-row"><span class="dpt-label">Nome</span><span class="dpt-value">${this.esc(this.displayText(e?.name))}</span></div>
            <div class="dpt-row"><span class="dpt-label">Device Profile (TB)</span><span class="dpt-value">${this.esc(this.displayText(e?.deviceProfileName))}</span></div>
            <div class="dpt-row"><span class="dpt-label">ID</span><span class="dpt-value dpt-mono">${this.esc(this.displayText(e?.id?.id || this.config.deviceId))}</span></div>
            <div class="dpt-row"><span class="dpt-label">Criado em</span><span class="dpt-value">${this.formatDate(e?.createdTime)}</span></div>
          </div>
        </div>

        <div class="dpt-section">
          <div class="dpt-section-title">Classificação (atributos da aplicação)</div>
          <div class="dpt-card">
            ${editableAttrRows}
            ${ingestionRow}
            ${readonlyRows}
          </div>
        </div>

        <div class="dpt-section">
          <div class="dpt-section-title">Todos os atributos SERVER_SCOPE (${this.attributes.length})</div>
          <div class="dpt-card dpt-card--scroll">
            ${otherRows}
          </div>
        </div>
      </div>`;
  }

  private renderAndAttach(): void {
    this.config.container.innerHTML = this.renderTab();
    this.attachListeners();
  }

  // --------------------------------------------------------------------------
  // Private — interaction
  // --------------------------------------------------------------------------

  private attachListeners(): void {
    const root = this.config.container;
    root.addEventListener('click', (ev) => this.onClick(ev));
  }

  private async onClick(ev: MouseEvent): Promise<void> {
    const target = ev.target as HTMLElement;
    const btn = target.closest('button[data-action]') as HTMLButtonElement | null;
    if (!btn) return;
    const row = btn.closest('.dpt-row') as HTMLElement | null;
    if (!row) return;
    const field = row.dataset.field || '';
    const kind = row.dataset.kind || '';
    const action = btn.dataset.action;

    if (action === 'sync-ingestion') {
      await this.handleSyncIngestion(row, btn);
      return;
    }
    if (action === 'edit') {
      await this.beginEdit(row, field, kind);
      return;
    }
    if (action === 'save') {
      await this.commitEdit(row, field, kind);
      return;
    }
    if (action === 'cancel') {
      this.renderAndAttach();
    }
  }

  private async handleSyncIngestion(row: HTMLElement, btn: HTMLButtonElement): Promise<void> {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = '⏳';
    try {
      const result = await this.syncIngestionId();
      if (result.ok) {
        this.renderAndAttach();
      } else {
        alert(result.message);
      }
    } catch (e) {
      alert('Erro ao sincronizar ingestionId: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  private async beginEdit(row: HTMLElement, field: string, kind: string): Promise<void> {
    const wrap = row.querySelector('.dpt-value-wrap') as HTMLElement;
    if (!wrap) return;

    if (kind === 'entity-profile') {
      const options = await this.fetchDeviceProfileOptions();
      const currentId = this.entity?.deviceProfileId?.id || '';
      wrap.innerHTML = this.editorHtml(
        `<select class="dpt-input" data-edit>
          ${options
            .map((o) => `<option value="${this.esc(o.id)}" ${o.id === currentId ? 'selected' : ''}>${this.esc(o.name)}</option>`)
            .join('')}
        </select>`,
      );
    } else if (kind === 'owner') {
      const options = await this.fetchCustomerOptions();
      const currentId = this.entity?.customerId?.id || '';
      wrap.innerHTML = this.editorHtml(
        `<select class="dpt-input" data-edit>
          <option value="">— selecione —</option>
          ${options
            .map((o) => `<option value="${this.esc(o.id)}" ${o.id === currentId ? 'selected' : ''}>${this.esc(o.title)}</option>`)
            .join('')}
        </select>`,
      );
    } else {
      const currentValue =
        kind === 'entity-label' ? this.entity?.label || '' : (this.attrValue(field) as string | undefined) || '';
      wrap.innerHTML = this.editorHtml(
        `<input class="dpt-input" data-edit type="text" value="${this.esc(String(currentValue))}" />`,
      );
      const input = wrap.querySelector('input[data-edit]') as HTMLInputElement;
      input?.focus();
      input?.select();
    }
  }

  private editorHtml(inputHtml: string): string {
    return `
      ${inputHtml}
      <button type="button" class="dpt-icon-btn" data-action="save" title="Salvar">✔️</button>
      <button type="button" class="dpt-icon-btn" data-action="cancel" title="Cancelar">✖️</button>
    `;
  }

  private async commitEdit(row: HTMLElement, field: string, kind: string): Promise<void> {
    const editEl = row.querySelector('[data-edit]') as HTMLInputElement | HTMLSelectElement | null;
    if (!editEl) return;
    const value = editEl.value.trim();
    const saveBtn = row.querySelector('button[data-action="save"]') as HTMLButtonElement | null;
    if (saveBtn) saveBtn.disabled = true;

    try {
      if (kind === 'entity-label') {
        await this.saveEntityField({ label: value });
      } else if (kind === 'entity-profile') {
        if (!value) throw new Error('Selecione um Device Profile.');
        await this.saveEntityField({ deviceProfileId: { id: value, entityType: 'DEVICE_PROFILE' } });
      } else if (kind === 'owner') {
        if (!value) throw new Error('Selecione um Owner.');
        await this.saveOwner(value);
      } else {
        await this.saveAttribute(field, value);
      }
      this.renderAndAttach();
    } catch (e) {
      alert('Erro ao salvar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  private injectStyles(): void {
    if (document.getElementById(STYLES_ID)) return;
    const style = document.createElement('style');
    style.id = STYLES_ID;
    style.textContent = `
      .dpt-tab { padding: 4px 2px 20px; }
      .dpt-notice {
        background: #fef3c7; border: 1px solid #f59e0b; color: #92400e;
        border-radius: 8px; padding: 8px 12px; font-size: 12px; margin-bottom: 16px;
      }
      .dpt-section { margin-bottom: 20px; }
      .dpt-section-title {
        font-size: 12px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.6px; color: #6b7280; margin-bottom: 8px;
      }
      .dpt-card {
        background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
        padding: 4px 16px;
      }
      .dpt-card--scroll { max-height: 280px; overflow-y: auto; }
      .dpt-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; padding: 9px 0; border-bottom: 1px solid #f1f5f9;
      }
      .dpt-row:last-child { border-bottom: none; }
      .dpt-label { font-size: 12px; color: #6b7280; font-weight: 600; white-space: nowrap; }
      .dpt-value { font-size: 13px; color: #111827; text-align: right; word-break: break-word; }
      .dpt-value-wrap { display: flex; align-items: center; gap: 6px; }
      .dpt-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .dpt-empty { padding: 16px 0; text-align: center; color: #9ca3af; font-size: 13px; }
      .dpt-icon-btn {
        border: none; background: transparent; cursor: pointer; font-size: 13px;
        padding: 2px 4px; border-radius: 6px; line-height: 1;
      }
      .dpt-icon-btn:hover { background: #f3f4f6; }
      .dpt-input {
        font-size: 12px; padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 6px;
        max-width: 220px;
      }
    `;
    document.head.appendChild(style);
  }
}
