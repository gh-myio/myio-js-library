import { UserManagementConfig, TBUser, TBUserPage } from '../types';

// ── GCDR types ────────────────────────────────────────────────────────────────

interface GCDRChannel {
  id: string;
  customerId: string;
  channel: string;
  active: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface GCDRGroupMember {
  userId: string;
  name: string;
  email: string;
  telegramChatId?: string;
  role: 'PRIMARY' | 'BACKUP' | 'ESCALATION';
}

interface GCDRGroup {
  id: string;
  customerId: string;
  name: string;
  domain?: string;
  severity?: string;
  members: GCDRGroupMember[];
  channels?: string[];
}

interface GCDRDispatchEntry {
  id?: string;
  groupId?: string;
  channel: string;
  action: string;
  active: boolean;
}

const ALARM_ACTIONS = ['OPEN', 'ACK', 'ESCALATE', 'SNOOZE', 'CLOSE', 'STATE_HISTORY'] as const;
const ACTION_LABELS: Record<string, string> = {
  OPEN: 'Disparado',
  ACK: 'Reconhecido',
  ESCALATE: 'Escalado',
  SNOOZE: 'Sonecado',
  CLOSE: 'Fechado',
  STATE_HISTORY: 'Histórico',
};

type AlarmAction = (typeof ALARM_ACTIONS)[number];

export interface GroupManagementCallbacks {
  showToast(msg: string, type?: 'success' | 'error'): void;
}

export class GroupManagementTab {
  private config: UserManagementConfig;
  private callbacks: GroupManagementCallbacks;
  private el!: HTMLElement;

  // Data
  private channels: GCDRChannel[] = [];
  private groups: GCDRGroup[] = [];
  private selectedGroupId: string | null = null;
  private dispatchMatrix: GCDRDispatchEntry[] = [];
  private tbUsers: TBUser[] = [];

  // Loading states
  private loadingChannels = false;
  private loadingGroups = false;
  private savingDispatch = false;

  // Sub-tab
  private activeSubTab: 'channels' | 'groups' = 'channels';

  constructor(config: UserManagementConfig, callbacks: GroupManagementCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  render(): HTMLElement {
    this.el = document.createElement('div');
    this.el.className = 'um-tab-content um-groups';
    this.buildDOM();
    this.loadAll();
    return this.el;
  }

  // ── DOM ───────────────────────────────────────────────────────────────────────

  private buildDOM(): void {
    this.el.innerHTML = `
      <div class="gm-subtabs">
        <button class="gm-subtab gm-subtab--active" data-sub="channels">📡 Canais de Despacho</button>
        <button class="gm-subtab" data-sub="groups">👥 Grupos de Notificação</button>
      </div>
      <div class="gm-subtab-content" id="gm-channels-pane">
        <div class="gm-section-toolbar">
          <span class="gm-section-label">Canais configurados para este cliente</span>
          <button class="um-btn um-btn--primary um-btn--sm gm-add-channel-btn">+ Canal</button>
        </div>
        <div class="gm-channels-list"></div>
        <div class="gm-empty gm-channels-empty" style="display:none">Nenhum canal configurado.</div>
        <div class="gm-loading gm-channels-loading" style="display:none"><span class="um-spinner"></span> Carregando...</div>
        <div class="gm-error gm-channels-error" style="display:none"></div>
        <div class="gm-channel-form" style="display:none"></div>
      </div>
      <div class="gm-subtab-content" id="gm-groups-pane" style="display:none">
        <div class="gm-groups-layout">
          <div class="gm-groups-sidebar">
            <div class="gm-sidebar-toolbar">
              <span class="gm-section-label">Grupos</span>
              <button class="um-btn um-btn--primary um-btn--sm gm-add-group-btn">+ Novo</button>
            </div>
            <div class="gm-groups-list"></div>
            <div class="gm-loading gm-groups-loading" style="display:none"><span class="um-spinner"></span></div>
            <div class="gm-empty gm-groups-empty" style="display:none">Nenhum grupo.</div>
          </div>
          <div class="gm-groups-detail">
            <div class="gm-detail-placeholder">
              <span>← Selecione um grupo para ver detalhes</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Sub-tab switcher
    this.el.querySelectorAll('.gm-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = (btn as HTMLElement).dataset.sub as 'channels' | 'groups';
        this.switchSubTab(sub);
      });
    });

    // Add channel
    this.el.querySelector('.gm-add-channel-btn')!.addEventListener('click', () => this.showChannelForm());

    // Add group
    this.el.querySelector('.gm-add-group-btn')!.addEventListener('click', () => this.showGroupForm());
  }

  private switchSubTab(sub: 'channels' | 'groups'): void {
    this.activeSubTab = sub;
    this.el.querySelectorAll('.gm-subtab').forEach(b => {
      b.classList.toggle('gm-subtab--active', (b as HTMLElement).dataset.sub === sub);
    });
    const channelPane = this.el.querySelector<HTMLElement>('#gm-channels-pane')!;
    const groupsPane = this.el.querySelector<HTMLElement>('#gm-groups-pane')!;
    channelPane.style.display = sub === 'channels' ? '' : 'none';
    groupsPane.style.display = sub === 'groups' ? '' : 'none';
  }

  // ── Load all ──────────────────────────────────────────────────────────────────

  private async loadAll(): Promise<void> {
    await Promise.all([
      this.loadChannels(),
      this.loadGroups(),
      this.loadTBUsers(),
    ]);
  }

  // ── GCDR helpers ─────────────────────────────────────────────────────────────

  private gcdrHeaders(): Record<string, string> {
    const orch = (window as any).MyIOOrchestrator;
    return {
      'Content-Type': 'application/json',
      'X-API-Key':   orch?.gcdrApiKey || '',
      'X-Tenant-ID': orch?.gcdrTenantId || '',
    };
  }

  private gcdrBaseUrl(): string {
    const orch = (window as any).MyIOOrchestrator;
    return (orch?.alarmsApiBaseUrl || 'https://alarms-api.a.myio-bas.com').replace(/\/$/, '');
  }

  private gcdrCustomerId(): string {
    return (window as any).MyIOOrchestrator?.gcdrCustomerId || '';
  }

  // ── Channels ─────────────────────────────────────────────────────────────────

  private async loadChannels(): Promise<void> {
    const cid = this.gcdrCustomerId();
    const loadingEl = this.el.querySelector<HTMLElement>('.gm-channels-loading')!;
    const errorEl = this.el.querySelector<HTMLElement>('.gm-channels-error')!;
    const emptyEl = this.el.querySelector<HTMLElement>('.gm-channels-empty')!;

    if (!cid) {
      errorEl.style.display = '';
      errorEl.textContent = 'gcdrCustomerId não configurado no orquestrador.';
      return;
    }

    this.loadingChannels = true;
    loadingEl.style.display = '';
    errorEl.style.display = 'none';
    emptyEl.style.display = 'none';

    try {
      const res = await fetch(`${this.gcdrBaseUrl()}/api/v1/customers/${cid}/channels`, {
        headers: this.gcdrHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this.channels = json?.data?.items || json?.items || json || [];
      this.renderChannels();
    } catch (err: any) {
      console.error('[GroupManagementTab] loadChannels', err);
      errorEl.style.display = '';
      errorEl.textContent = 'Erro ao carregar canais. Verifique a conectividade com a API GCDR.';
    } finally {
      this.loadingChannels = false;
      loadingEl.style.display = 'none';
    }
  }

  private renderChannels(): void {
    const listEl = this.el.querySelector<HTMLElement>('.gm-channels-list')!;
    const emptyEl = this.el.querySelector<HTMLElement>('.gm-channels-empty')!;
    listEl.innerHTML = '';

    if (this.channels.length === 0) {
      emptyEl.style.display = '';
      return;
    }
    emptyEl.style.display = 'none';

    for (const ch of this.channels) {
      const card = document.createElement('div');
      card.className = 'gm-channel-card';
      const summary = this.channelSummary(ch);
      card.innerHTML = `
        <div class="gm-channel-card-left">
          <span class="gm-channel-icon">${this.channelIcon(ch.channel)}</span>
          <div class="gm-channel-info">
            <span class="gm-channel-name">${this.esc(ch.channel)}</span>
            <span class="gm-channel-summary">${this.esc(summary)}</span>
          </div>
        </div>
        <div class="gm-channel-card-right">
          <label class="gm-toggle" title="${ch.active ? 'Ativo' : 'Inativo'}">
            <input type="checkbox" class="gm-toggle-input" ${ch.active ? 'checked' : ''} />
            <span class="gm-toggle-slider"></span>
          </label>
          <button class="um-icon-btn gm-edit-channel-btn" title="Configurar canal" data-id="${ch.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button class="um-icon-btn gm-delete-channel-btn" title="Remover canal" data-id="${ch.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      `;

      // Toggle active
      const toggle = card.querySelector<HTMLInputElement>('.gm-toggle-input')!;
      toggle.addEventListener('change', () => this.toggleChannel(ch, toggle.checked, toggle));

      // Edit
      card.querySelector('.gm-edit-channel-btn')!.addEventListener('click', () => this.showChannelForm(ch));

      // Delete
      card.querySelector('.gm-delete-channel-btn')!.addEventListener('click', () => this.deleteChannel(ch));

      listEl.appendChild(card);
    }
  }

  private async toggleChannel(ch: GCDRChannel, active: boolean, toggle: HTMLInputElement): Promise<void> {
    const cid = this.gcdrCustomerId();
    try {
      const res = await fetch(`${this.gcdrBaseUrl()}/api/v1/customers/${cid}/channels/${ch.id}`, {
        method: 'PATCH',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ch.active = active;
      this.callbacks.showToast(`Canal ${ch.channel} ${active ? 'ativado' : 'desativado'}.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] toggleChannel', err);
      toggle.checked = !active; // revert
      this.callbacks.showToast('Erro ao atualizar canal.', 'error');
    }
  }

  private async deleteChannel(ch: GCDRChannel): Promise<void> {
    if (!confirm(`Remover o canal ${ch.channel}? Esta ação não pode ser desfeita.`)) return;
    const cid = this.gcdrCustomerId();
    try {
      const res = await fetch(`${this.gcdrBaseUrl()}/api/v1/customers/${cid}/channels/${ch.id}`, {
        method: 'DELETE',
        headers: this.gcdrHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.channels = this.channels.filter(c => c.id !== ch.id);
      this.renderChannels();
      this.callbacks.showToast(`Canal ${ch.channel} removido.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] deleteChannel', err);
      this.callbacks.showToast('Erro ao remover canal.', 'error');
    }
  }

  private showChannelForm(existing?: GCDRChannel): void {
    const formEl = this.el.querySelector<HTMLElement>('.gm-channel-form')!;

    const CHANNEL_TYPES = ['EMAIL_RELAY', 'TELEGRAM', 'WHATSAPP', 'WEBHOOK', 'SMS', 'SLACK', 'TEAMS'];
    const channelType = existing?.channel || 'EMAIL_RELAY';

    formEl.style.display = '';
    formEl.innerHTML = `
      <div class="gm-form-card">
        <h4 class="gm-form-title">${existing ? 'Editar Canal' : 'Adicionar Canal'}</h4>
        <div class="um-form-group">
          <label class="um-label">Tipo de Canal</label>
          <select class="um-input gm-channel-type-select" ${existing ? 'disabled' : ''}>
            ${CHANNEL_TYPES.map(t => `<option value="${t}" ${t === channelType ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="gm-channel-config-fields"></div>
        <div class="um-form-group um-form-group--check">
          <label class="um-check-label">
            <input type="checkbox" class="gm-channel-active" ${existing?.active !== false ? 'checked' : ''} />
            Canal ativo
          </label>
        </div>
        <div class="um-form-actions">
          <button class="um-btn um-btn--ghost gm-cancel-channel-btn">Cancelar</button>
          <button class="um-btn um-btn--primary gm-save-channel-btn">${existing ? 'Salvar' : 'Adicionar'}</button>
        </div>
      </div>
    `;

    const renderConfigFields = (type: string) => {
      const fieldsEl = formEl.querySelector<HTMLElement>('.gm-channel-config-fields')!;
      const existingConfig = existing?.config || {};
      fieldsEl.innerHTML = this.buildChannelConfigFields(type, existingConfig);
    };
    renderConfigFields(channelType);

    const typeSelect = formEl.querySelector<HTMLSelectElement>('.gm-channel-type-select')!;
    typeSelect.addEventListener('change', () => renderConfigFields(typeSelect.value));

    formEl.querySelector('.gm-cancel-channel-btn')!.addEventListener('click', () => {
      formEl.style.display = 'none';
    });

    formEl.querySelector('.gm-save-channel-btn')!.addEventListener('click', () => {
      this.saveChannel(formEl, existing);
    });
  }

  private buildChannelConfigFields(type: string, existing: Record<string, unknown> = {}): string {
    const val = (k: string) => this.esc(String(existing[k] || ''));
    switch (type) {
      case 'EMAIL_RELAY': return `
        <div class="um-form-row">
          <div class="um-form-group"><label class="um-label">Host SMTP</label><input class="um-input" name="host" value="${val('host')}" placeholder="smtp.office365.com" /></div>
          <div class="um-form-group"><label class="um-label">Porta</label><input class="um-input" name="port" type="number" value="${val('port') || '587'}" /></div>
        </div>
        <div class="um-form-group"><label class="um-label">Usuário</label><input class="um-input" name="user" value="${val('user')}" placeholder="alertas@empresa.com.br" /></div>
        <div class="um-form-group"><label class="um-label">From</label><input class="um-input" name="from" value="${val('from')}" placeholder="Alertas MYIO &lt;alertas@empresa.com.br&gt;" /></div>
      `;
      case 'TELEGRAM': return `
        <div class="um-form-group"><label class="um-label">Bot Token</label><input class="um-input" name="botToken" value="${val('botToken')}" placeholder="7123456789:AAF..." /></div>
        <div class="um-form-group"><label class="um-label">Chat ID padrão</label><input class="um-input" name="defaultChatId" value="${val('defaultChatId')}" placeholder="-100123456789" /></div>
      `;
      case 'WHATSAPP': return `
        <div class="um-form-group"><label class="um-label">API URL</label><input class="um-input" name="apiUrl" value="${val('apiUrl')}" placeholder="https://api.z-api.io/..." /></div>
        <div class="um-form-group"><label class="um-label">API Token</label><input class="um-input" name="apiToken" value="${val('apiToken')}" /></div>
        <div class="um-form-group"><label class="um-label">Número remetente</label><input class="um-input" name="fromNumber" value="${val('fromNumber')}" placeholder="+5531900000000" /></div>
      `;
      case 'WEBHOOK': return `
        <div class="um-form-group"><label class="um-label">URL</label><input class="um-input" name="url" value="${val('url')}" /></div>
        <div class="um-form-group"><label class="um-label">Method</label>
          <select class="um-input" name="method"><option ${String(existing.method||'POST')==='POST'?'selected':''}>POST</option><option ${String(existing.method||'')==='PUT'?'selected':''}>PUT</option></select>
        </div>
      `;
      default: return `<div class="um-form-group"><label class="um-label">Config JSON</label><textarea class="um-input um-textarea" name="_json" rows="3">${this.esc(JSON.stringify(existing, null, 2))}</textarea></div>`;
    }
  }

  private async saveChannel(formEl: HTMLElement, existing?: GCDRChannel): Promise<void> {
    const cid = this.gcdrCustomerId();
    const type = formEl.querySelector<HTMLSelectElement>('.gm-channel-type-select')!.value;
    const active = formEl.querySelector<HTMLInputElement>('.gm-channel-active')!.checked;

    // Collect config fields
    const config: Record<string, unknown> = {};
    formEl.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]').forEach(el => {
      if (el.name === '_json') {
        try { Object.assign(config, JSON.parse(el.value)); } catch { /* ignore */ }
      } else if (!el.name.startsWith('_')) {
        if ((el as HTMLInputElement).type === 'number') {
          config[el.name] = Number(el.value);
        } else {
          config[el.name] = el.value;
        }
      }
    });

    const saveBtn = formEl.querySelector<HTMLButtonElement>('.gm-save-channel-btn')!;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    try {
      const body = { channel: type, active, config };
      let res: Response;
      if (existing) {
        res = await fetch(`${this.gcdrBaseUrl()}/api/v1/customers/${cid}/channels/${existing.id}`, {
          method: 'PATCH',
          headers: this.gcdrHeaders(),
          body: JSON.stringify({ active, config }),
        });
      } else {
        res = await fetch(`${this.gcdrBaseUrl()}/api/v1/customers/${cid}/channels`, {
          method: 'POST',
          headers: this.gcdrHeaders(),
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${errText ? ': ' + errText.slice(0, 80) : ''}`);
      }
      formEl.style.display = 'none';
      this.callbacks.showToast(`Canal ${type} ${existing ? 'atualizado' : 'adicionado'} com sucesso!`, 'success');
      await this.loadChannels();
    } catch (err: any) {
      console.error('[GroupManagementTab] saveChannel', err);
      this.callbacks.showToast(`Erro ao salvar canal: ${err.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = existing ? 'Salvar' : 'Adicionar';
    }
  }

  // ── Groups ────────────────────────────────────────────────────────────────────

  private async loadGroups(): Promise<void> {
    const cid = this.gcdrCustomerId();
    const loadingEl = this.el.querySelector<HTMLElement>('.gm-groups-loading')!;
    const emptyEl = this.el.querySelector<HTMLElement>('.gm-groups-empty')!;

    if (!cid) return;

    this.loadingGroups = true;
    loadingEl.style.display = '';
    emptyEl.style.display = 'none';

    try {
      const res = await fetch(`${this.gcdrBaseUrl()}/api/v1/customers/${cid}/groups`, {
        headers: this.gcdrHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this.groups = json?.data?.items || json?.items || json || [];
      this.renderGroupsList();
    } catch (err: any) {
      console.error('[GroupManagementTab] loadGroups', err);
      emptyEl.style.display = '';
      emptyEl.textContent = 'Erro ao carregar grupos.';
    } finally {
      this.loadingGroups = false;
      loadingEl.style.display = 'none';
    }
  }

  private renderGroupsList(): void {
    const listEl = this.el.querySelector<HTMLElement>('.gm-groups-list')!;
    const emptyEl = this.el.querySelector<HTMLElement>('.gm-groups-empty')!;
    listEl.innerHTML = '';

    if (this.groups.length === 0) {
      emptyEl.style.display = '';
      return;
    }
    emptyEl.style.display = 'none';

    for (const g of this.groups) {
      const item = document.createElement('div');
      item.className = `gm-group-item${this.selectedGroupId === g.id ? ' gm-group-item--active' : ''}`;
      item.dataset.id = g.id;
      const memberCount = g.members?.length ?? 0;
      item.innerHTML = `
        <div class="gm-group-item-name">${this.esc(g.name)}</div>
        <div class="gm-group-item-meta">
          ${g.domain ? `<span class="gm-badge gm-badge--domain">${this.esc(g.domain)}</span>` : ''}
          ${g.severity ? `<span class="gm-badge gm-badge--sev gm-badge--sev-${g.severity.toLowerCase()}">${this.esc(g.severity)}</span>` : ''}
          <span class="gm-badge gm-badge--count">${memberCount} membro${memberCount !== 1 ? 's' : ''}</span>
        </div>
      `;
      item.addEventListener('click', () => {
        this.selectedGroupId = g.id;
        this.renderGroupsList(); // update active state
        this.showGroupDetail(g);
      });
      listEl.appendChild(item);
    }
  }

  private async showGroupDetail(group: GCDRGroup): Promise<void> {
    const detailEl = this.el.querySelector<HTMLElement>('.gm-groups-detail')!;
    detailEl.innerHTML = `<div class="gm-loading"><span class="um-spinner"></span> Carregando dispatch...</div>`;

    try {
      const res = await fetch(`${this.gcdrBaseUrl()}/api/v1/groups/${group.id}/dispatch`, {
        headers: this.gcdrHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this.dispatchMatrix = json?.data?.items || json?.items || json || [];
      this.renderGroupDetail(group, detailEl);
    } catch (err: any) {
      console.error('[GroupManagementTab] showGroupDetail', err);
      this.dispatchMatrix = [];
      this.renderGroupDetail(group, detailEl);
    }
  }

  private renderGroupDetail(group: GCDRGroup, container: HTMLElement): void {
    const memberCount = group.members?.length ?? 0;

    // Channels available: from customer channels
    const availableChannels = this.channels.length > 0
      ? this.channels.map(c => c.channel)
      : ['EMAIL_RELAY', 'TELEGRAM', 'WHATSAPP'];

    // Build matrix: Map<channel, Map<action, active>>
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const ch of availableChannels) {
      matrix[ch] = {};
      for (const act of ALARM_ACTIONS) {
        matrix[ch][act] = false;
      }
    }
    for (const entry of this.dispatchMatrix) {
      if (matrix[entry.channel]) {
        matrix[entry.channel][entry.action] = entry.active;
      }
    }

    container.innerHTML = `
      <div class="gm-detail-header">
        <div>
          <span class="gm-detail-title">${this.esc(group.name)}</span>
          ${group.domain ? `<span class="gm-badge gm-badge--domain">${this.esc(group.domain)}</span>` : ''}
          ${group.severity ? `<span class="gm-badge gm-badge--sev gm-badge--sev-${group.severity.toLowerCase()}">${this.esc(group.severity)}</span>` : ''}
        </div>
        <button class="um-icon-btn gm-delete-group-btn" title="Excluir grupo" style="color:#ef4444">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>

      <!-- Members section -->
      <div class="gm-detail-section">
        <div class="gm-detail-section-header">
          <span class="gm-detail-section-title">Membros (${memberCount})</span>
          <button class="um-btn um-btn--ghost um-btn--sm gm-add-member-btn">+ Membro</button>
        </div>
        <div class="gm-members-list">
          ${memberCount === 0
            ? '<span class="gm-empty-inline">Nenhum membro neste grupo.</span>'
            : group.members.map(m => `
              <div class="gm-member-chip" data-uid="${m.userId}">
                <span class="gm-member-icon">${m.role === 'ESCALATION' ? '🔺' : m.role === 'BACKUP' ? '🔄' : '👤'}</span>
                <div class="gm-member-info">
                  <span class="gm-member-name">${this.esc(m.name)}</span>
                  <span class="gm-member-role">${m.role}</span>
                </div>
                <button class="um-icon-btn gm-remove-member-btn" data-uid="${m.userId}" title="Remover membro">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>`).join('')}
        </div>
        <div class="gm-add-member-form" style="display:none">
          <select class="um-input gm-member-user-select" style="font-size:12px;">
            <option value="">— Selecionar usuário —</option>
            ${this.tbUsers.map(u => `<option value="${u.id.id}">${this.esc([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email)} (${this.esc(u.email)})</option>`).join('')}
          </select>
          <select class="um-input gm-member-role-select" style="font-size:12px;">
            <option value="PRIMARY">PRIMARY — Principal</option>
            <option value="BACKUP">BACKUP — Reserva</option>
            <option value="ESCALATION">ESCALATION — Escalação</option>
          </select>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <button class="um-btn um-btn--ghost um-btn--sm gm-cancel-member-btn">Cancelar</button>
            <button class="um-btn um-btn--primary um-btn--sm gm-confirm-member-btn">Adicionar</button>
          </div>
        </div>
      </div>

      <!-- Dispatch matrix section -->
      <div class="gm-detail-section">
        <div class="gm-detail-section-header">
          <span class="gm-detail-section-title">Matriz de Despacho</span>
          <button class="um-btn um-btn--primary um-btn--sm gm-save-dispatch-btn">Salvar Matriz</button>
        </div>
        ${this.channels.length === 0
          ? '<div class="gm-empty-inline">Adicione canais primeiro na aba "Canais de Despacho".</div>'
          : `<div class="gm-dispatch-wrap">
              <table class="gm-dispatch-table" data-group-id="${group.id}">
                <thead>
                  <tr>
                    <th class="gm-dispatch-channel-col">Canal</th>
                    ${ALARM_ACTIONS.map(a => `<th class="gm-dispatch-action-col" title="${ACTION_LABELS[a]}">${ACTION_LABELS[a]}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${availableChannels.map(ch => `
                    <tr>
                      <td class="gm-dispatch-channel-name">
                        ${this.channelIcon(ch)} ${this.esc(ch)}
                      </td>
                      ${ALARM_ACTIONS.map(act => `
                        <td class="gm-dispatch-cell">
                          <input type="checkbox" class="gm-dispatch-check"
                            data-channel="${ch}" data-action="${act}"
                            ${matrix[ch]?.[act] ? 'checked' : ''} />
                        </td>`).join('')}
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
      </div>
    `;

    // Delete group
    container.querySelector('.gm-delete-group-btn')!.addEventListener('click', () => this.deleteGroup(group));

    // Members
    container.querySelector('.gm-add-member-btn')!.addEventListener('click', () => {
      container.querySelector<HTMLElement>('.gm-add-member-form')!.style.display = '';
    });
    container.querySelector('.gm-cancel-member-btn')!.addEventListener('click', () => {
      container.querySelector<HTMLElement>('.gm-add-member-form')!.style.display = 'none';
    });
    container.querySelector('.gm-confirm-member-btn')!.addEventListener('click', () => {
      this.addMemberToGroup(group, container);
    });
    container.querySelectorAll('.gm-remove-member-btn').forEach(btn => {
      const uid = (btn as HTMLElement).dataset.uid!;
      btn.addEventListener('click', () => this.removeMemberFromGroup(group, uid, container));
    });

    // Save dispatch
    container.querySelector('.gm-save-dispatch-btn')?.addEventListener('click', () => {
      this.saveDispatchMatrix(group, container);
    });
  }

  private async saveDispatchMatrix(group: GCDRGroup, container: HTMLElement): Promise<void> {
    if (this.savingDispatch) return;
    this.savingDispatch = true;
    const btn = container.querySelector<HTMLButtonElement>('.gm-save-dispatch-btn')!;
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const entries: Array<{ channel: string; action: string; active: boolean }> = [];
    container.querySelectorAll<HTMLInputElement>('.gm-dispatch-check').forEach(cb => {
      entries.push({
        channel: cb.dataset.channel!,
        action: cb.dataset.action!,
        active: cb.checked,
      });
    });

    try {
      const res = await fetch(`${this.gcdrBaseUrl()}/api/v1/groups/${group.id}/dispatch`, {
        method: 'PUT',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.callbacks.showToast('Matriz de despacho salva!', 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] saveDispatchMatrix', err);
      this.callbacks.showToast('Erro ao salvar matriz.', 'error');
    } finally {
      this.savingDispatch = false;
      btn.disabled = false;
      btn.textContent = 'Salvar Matriz';
    }
  }

  private async addMemberToGroup(group: GCDRGroup, container: HTMLElement): Promise<void> {
    const select = container.querySelector<HTMLSelectElement>('.gm-member-user-select')!;
    const roleSelect = container.querySelector<HTMLSelectElement>('.gm-member-role-select')!;
    const userId = select.value;
    if (!userId) return;

    const tbUser = this.tbUsers.find(u => u.id.id === userId);
    if (!tbUser) return;

    const newMember: GCDRGroupMember = {
      userId,
      name: [tbUser.firstName, tbUser.lastName].filter(Boolean).join(' ') || tbUser.email,
      email: tbUser.email,
      role: roleSelect.value as 'PRIMARY' | 'BACKUP' | 'ESCALATION',
    };

    const updatedMembers = [...(group.members || []), newMember];

    try {
      const res = await fetch(`${this.gcdrBaseUrl()}/api/v1/groups/${group.id}`, {
        method: 'PATCH',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ members: updatedMembers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      group.members = updatedMembers;
      this.renderGroupsList();
      this.renderGroupDetail(group, container);
      this.callbacks.showToast(`Membro ${newMember.name} adicionado.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] addMember', err);
      this.callbacks.showToast('Erro ao adicionar membro.', 'error');
    }
  }

  private async removeMemberFromGroup(group: GCDRGroup, userId: string, container: HTMLElement): Promise<void> {
    const member = group.members?.find(m => m.userId === userId);
    if (!member) return;
    if (!confirm(`Remover ${member.name} do grupo?`)) return;

    const updatedMembers = (group.members || []).filter(m => m.userId !== userId);

    try {
      const res = await fetch(`${this.gcdrBaseUrl()}/api/v1/groups/${group.id}`, {
        method: 'PATCH',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ members: updatedMembers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      group.members = updatedMembers;
      this.renderGroupsList();
      this.renderGroupDetail(group, container);
      this.callbacks.showToast(`Membro removido.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] removeMember', err);
      this.callbacks.showToast('Erro ao remover membro.', 'error');
    }
  }

  private async deleteGroup(group: GCDRGroup): Promise<void> {
    if (!confirm(`Excluir o grupo "${group.name}"? Esta ação não pode ser desfeita.`)) return;

    try {
      const res = await fetch(`${this.gcdrBaseUrl()}/api/v1/groups/${group.id}`, {
        method: 'DELETE',
        headers: this.gcdrHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.groups = this.groups.filter(g => g.id !== group.id);
      this.selectedGroupId = null;
      this.renderGroupsList();
      this.el.querySelector<HTMLElement>('.gm-groups-detail')!.innerHTML = `
        <div class="gm-detail-placeholder"><span>← Selecione um grupo para ver detalhes</span></div>
      `;
      this.callbacks.showToast(`Grupo ${group.name} excluído.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] deleteGroup', err);
      this.callbacks.showToast('Erro ao excluir grupo.', 'error');
    }
  }

  private showGroupForm(): void {
    // Inline form at top of detail panel
    const detailEl = this.el.querySelector<HTMLElement>('.gm-groups-detail')!;
    detailEl.innerHTML = `
      <div class="gm-form-card">
        <h4 class="gm-form-title">Novo Grupo</h4>
        <div class="um-form-group">
          <label class="um-label">Nome <span class="um-req">*</span></label>
          <input class="um-input" id="gm-new-group-name" placeholder="Ex: Operações Noturnas" />
        </div>
        <div class="um-form-row">
          <div class="um-form-group">
            <label class="um-label">Domínio</label>
            <select class="um-input" id="gm-new-group-domain">
              <option value="">— Qualquer —</option>
              <option value="energy">energy</option>
              <option value="water">water</option>
              <option value="temperature">temperature</option>
            </select>
          </div>
          <div class="um-form-group">
            <label class="um-label">Severidade</label>
            <select class="um-input" id="gm-new-group-severity">
              <option value="">— Qualquer —</option>
              <option value="critical">CRITICAL</option>
              <option value="high">HIGH</option>
              <option value="medium">MEDIUM</option>
              <option value="low">LOW</option>
            </select>
          </div>
        </div>
        <div class="um-form-actions">
          <button class="um-btn um-btn--ghost gm-cancel-group-btn">Cancelar</button>
          <button class="um-btn um-btn--primary gm-create-group-btn">Criar Grupo</button>
        </div>
      </div>
    `;

    detailEl.querySelector('.gm-cancel-group-btn')!.addEventListener('click', () => {
      detailEl.innerHTML = `<div class="gm-detail-placeholder"><span>← Selecione um grupo para ver detalhes</span></div>`;
    });

    detailEl.querySelector('.gm-create-group-btn')!.addEventListener('click', () => {
      this.createGroup(detailEl);
    });
  }

  private async createGroup(formContainer: HTMLElement): Promise<void> {
    const name = formContainer.querySelector<HTMLInputElement>('#gm-new-group-name')!.value.trim();
    if (!name) {
      this.callbacks.showToast('Nome do grupo é obrigatório.', 'error');
      return;
    }
    const domain = formContainer.querySelector<HTMLSelectElement>('#gm-new-group-domain')!.value;
    const severity = formContainer.querySelector<HTMLSelectElement>('#gm-new-group-severity')!.value;
    const cid = this.gcdrCustomerId();
    const btn = formContainer.querySelector<HTMLButtonElement>('.gm-create-group-btn')!;
    btn.disabled = true;
    btn.textContent = 'Criando...';

    try {
      const body: Record<string, unknown> = { name, customerId: cid, members: [] };
      if (domain) body.domain = domain;
      if (severity) body.severity = severity;

      const res = await fetch(`${this.gcdrBaseUrl()}/api/v1/customers/${cid}/groups`, {
        method: 'POST',
        headers: this.gcdrHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created: GCDRGroup = await res.json();
      this.groups.push(created.data ? (created as any).data : created);
      this.selectedGroupId = created.id || (created as any)?.data?.id;
      this.renderGroupsList();
      this.callbacks.showToast(`Grupo "${name}" criado!`, 'success');
      await this.loadGroups(); // refresh full list
    } catch (err: any) {
      console.error('[GroupManagementTab] createGroup', err);
      this.callbacks.showToast(`Erro ao criar grupo: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Criar Grupo';
    }
  }

  // ── TB Users (for member picker) ─────────────────────────────────────────────

  private async loadTBUsers(): Promise<void> {
    try {
      const { tbBaseUrl, jwtToken, customerId } = this.config;
      const res = await fetch(`${tbBaseUrl}/api/customer/${customerId}/users?pageSize=100&page=0`, {
        headers: { 'X-Authorization': `Bearer ${jwtToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page: TBUserPage = await res.json();
      this.tbUsers = page.data || [];
    } catch (err) {
      console.warn('[GroupManagementTab] loadTBUsers', err);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private channelIcon(ch: string): string {
    const icons: Record<string, string> = {
      EMAIL_RELAY: '✉️', TELEGRAM: '✈️', WHATSAPP: '📱',
      WEBHOOK: '🔗', SMS: '💬', SLACK: '💼', TEAMS: '🖥️',
    };
    return icons[ch] || '📡';
  }

  private channelSummary(ch: GCDRChannel): string {
    const cfg = ch.config || {};
    switch (ch.channel) {
      case 'EMAIL_RELAY': return `${cfg.host || ''}:${cfg.port || ''} · ${cfg.user || ''}`;
      case 'TELEGRAM': return `Chat: ${cfg.defaultChatId || '—'}`;
      case 'WHATSAPP': return `${cfg.fromNumber || '—'}`;
      case 'WEBHOOK': return String(cfg.url || '—').slice(0, 40);
      default: return '';
    }
  }

  private esc(s: string): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
