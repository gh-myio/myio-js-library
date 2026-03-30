import {
  UserManagementConfig, TBUser, TBUserPage,
  GCDRChannelType, AlarmAction,
  GCDRGroup, GCDRGroupMember, GCDRGroupChannel, GCDRDispatchEntry, CustomerChannel,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALARM_ACTIONS: AlarmAction[] = ['OPEN', 'ACK', 'ESCALATE', 'SNOOZE', 'CLOSE', 'STATE_HISTORY'];

const ACTION_LABELS: Record<AlarmAction, string> = {
  OPEN: 'Disparado', ACK: 'Reconhecido', ESCALATE: 'Escalado',
  SNOOZE: 'Sonecado', CLOSE: 'Fechado', STATE_HISTORY: 'Histórico',
};

const PURPOSE_LABELS: Record<string, string> = {
  ALARMS_NOTIFY:  'Alarmes - Notificação',
  ALARMS_REPORT:  'Alarmes - Relatório',
  ALARMS_INSIGHT: 'Alarmes - Insights',
  WELCOME_USER:   'Boas-vindas / Reset',
  RELEASE_NOTE:   'Comunicados',
  NOTIFICATION:   'Notificação',
  ESCALATION:     'Escalonamento',
  ACCESS_CONTROL: 'Controle de Acesso',
  REPORTING:      'Relatórios',
  MAINTENANCE:    'Manutenção',
  MONITORING:     'Monitoramento',
  CUSTOM:         'Personalizado',
};

const ALL_PURPOSES = Object.keys(PURPOSE_LABELS);

const CUSTOMER_CHANNEL_TYPES: GCDRChannelType[] = [
  'EMAIL_RELAY', 'TELEGRAM', 'WHATSAPP', 'WEBHOOK', 'SMS', 'SLACK', 'TEAMS',
];

const GROUP_CHANNEL_TYPES: GCDRChannelType[] = [
  'EMAIL', 'EMAIL_RELAY', 'TELEGRAM', 'WHATSAPP', 'WEBHOOK', 'SLACK', 'SMS', 'TEAMS',
];

// ── Callbacks ─────────────────────────────────────────────────────────────────

export interface GroupManagementCallbacks {
  showToast(msg: string, type?: 'success' | 'error'): void;
}

// ── Class ─────────────────────────────────────────────────────────────────────

export class GroupManagementTab {
  private config: UserManagementConfig;
  private callbacks: GroupManagementCallbacks;
  private el!: HTMLElement;
  private readonly isSuperAdmin: boolean;

  // Data
  private groups: GCDRGroup[] = [];
  private customerChannels: CustomerChannel[] = [];
  private tbUsers: TBUser[] = [];

  // Per-group lazy caches — invalidated on mutation
  private membersCache = new Map<string, GCDRGroupMember[]>();
  private groupChannelsCache = new Map<string, GCDRGroupChannel[]>();
  private dispatchCache = new Map<string, GCDRDispatchEntry[]>();

  // Accordion state
  private expandedGroupId: string | null = null;

  constructor(config: UserManagementConfig, callbacks: GroupManagementCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
    const email = config.currentUser.email.toLowerCase();
    this.isSuperAdmin = email.endsWith('@myio.com.br')
      && email !== 'alarme@myio.com.br'
      && email !== 'alarmes@myio.com.br';
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
      ${!this.isSuperAdmin
        ? '<div class="gm-readonly-notice">🔒 Modo somente leitura — apenas super-admins MyIO podem criar ou editar grupos.</div>'
        : ''}
      <div class="gm-toolbar">
        <div class="um-search-wrap">
          <svg class="um-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input type="text" class="um-search-input gm-search-input" placeholder="Buscar grupos..." />
        </div>
        ${this.isSuperAdmin
          ? '<button class="um-btn um-btn--primary um-btn--sm gm-add-group-btn">+ Novo Grupo</button>'
          : ''}
      </div>

      <div class="gm-new-group-form" style="display:none"></div>

      <div class="gm-groups-accordion">
        <div class="gm-loading gm-groups-loading"><span class="um-spinner"></span> Carregando grupos...</div>
        <div class="gm-empty gm-groups-empty" style="display:none">Nenhum grupo configurado.</div>
        <div class="gm-error gm-groups-error" style="display:none"></div>
      </div>

      <div class="gm-customer-channels-section">
        <div class="gm-section-divider">
          <span class="gm-section-divider-label">Canais do Cliente</span>
          ${this.isSuperAdmin
            ? '<button class="um-btn um-btn--ghost um-btn--sm gm-add-customer-channel-btn">+ Canal</button>'
            : ''}
        </div>
        <div class="gm-loading gm-cchannels-loading"><span class="um-spinner"></span> Carregando...</div>
        <div class="gm-channels-list gm-customer-channels-list"></div>
        <div class="gm-empty gm-cchannels-empty" style="display:none">Nenhum canal de cliente configurado.</div>
        <div class="gm-error gm-cchannels-error" style="display:none"></div>
        <div class="gm-channel-form" style="display:none"></div>
      </div>
    `;

    this.el.querySelector('.gm-search-input')!
      .addEventListener('input', (e) => this.filterGroups((e.target as HTMLInputElement).value.toLowerCase()));

    this.el.querySelector('.gm-add-group-btn')
      ?.addEventListener('click', () => this.showNewGroupForm());

    this.el.querySelector('.gm-add-customer-channel-btn')
      ?.addEventListener('click', () => this.showCustomerChannelForm());
  }

  // ── Load all ──────────────────────────────────────────────────────────────────

  private async loadAll(): Promise<void> {
    await Promise.all([
      this.loadGroups(),
      this.loadCustomerChannels(),
      this.loadTBUsers(),
    ]);
  }

  // ── GCDR helpers ──────────────────────────────────────────────────────────────

  private gcdrHeaders(): Record<string, string> {
    const orch = (window as any).MyIOOrchestrator;
    return {
      'Content-Type': 'application/json',
      'X-API-Key':    orch?.gcdrApiKey   || '',
      'X-Tenant-ID':  orch?.gcdrTenantId || '',
    };
  }

  private gcdrBase(): string {
    const orch = (window as any).MyIOOrchestrator;
    return (orch?.gcdrApiBaseUrl || 'https://gcdr-api.a.myio-bas.com').replace(/\/$/, '');
  }

  private gcdrCid(): string {
    return (window as any).MyIOOrchestrator?.gcdrCustomerId || '';
  }

  private unwrapList<T>(json: unknown): T[] {
    if (Array.isArray(json)) return json as T[];
    const j = json as any;
    return j?.data?.items ?? j?.data ?? j?.items ?? [];
  }

  // ── Groups list ───────────────────────────────────────────────────────────────

  private async loadGroups(): Promise<void> {
    const cid = this.gcdrCid();
    const loadingEl = this.el.querySelector<HTMLElement>('.gm-groups-loading')!;
    const emptyEl   = this.el.querySelector<HTMLElement>('.gm-groups-empty')!;
    const errorEl   = this.el.querySelector<HTMLElement>('.gm-groups-error')!;

    if (!cid) {
      loadingEl.style.display = 'none';
      errorEl.style.display = '';
      errorEl.textContent = 'gcdrCustomerId não configurado no orquestrador.';
      return;
    }

    loadingEl.style.display = '';
    emptyEl.style.display = 'none';
    errorEl.style.display = 'none';

    try {
      const res = await fetch(
        `${this.gcdrBase()}/groups?customerId=${encodeURIComponent(cid)}&limit=100`,
        { headers: this.gcdrHeaders() },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this.groups = this.unwrapList<GCDRGroup>(json);
      this.renderGroupsAccordion();
    } catch (err: any) {
      console.error('[GroupManagementTab] loadGroups', err);
      errorEl.style.display = '';
      errorEl.textContent = `Erro ao carregar grupos: ${err.message}`;
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  private renderGroupsAccordion(filter = ''): void {
    const accordion = this.el.querySelector<HTMLElement>('.gm-groups-accordion')!;
    const emptyEl   = this.el.querySelector<HTMLElement>('.gm-groups-empty')!;

    accordion.querySelectorAll('.gm-accordion-item').forEach(el => el.remove());

    const visible = filter
      ? this.groups.filter(g =>
          g.name.toLowerCase().includes(filter) || g.code.toLowerCase().includes(filter))
      : this.groups;

    if (visible.length === 0) { emptyEl.style.display = ''; return; }
    emptyEl.style.display = 'none';

    for (const group of visible) {
      accordion.appendChild(this.buildGroupAccordionItem(group));
    }
  }

  private buildGroupAccordionItem(group: GCDRGroup): HTMLElement {
    const item = document.createElement('div');
    item.className = 'gm-accordion-item';
    item.dataset.id = group.id;
    const isExpanded = this.expandedGroupId === group.id;

    const memberCount = group.memberCount ?? 0;
    const purposes = group.purposes || [];
    const purposeChips = purposes.slice(0, 2)
      .map(p => `<span class="gm-badge gm-badge--domain">${this.esc(PURPOSE_LABELS[p] || p)}</span>`)
      .join('');
    const morePurposes = purposes.length > 2
      ? `<span class="gm-badge gm-badge--count">+${purposes.length - 2}</span>` : '';

    item.innerHTML = `
      <div class="gm-accordion-header">
        <button class="gm-accordion-toggle" aria-expanded="${isExpanded}">
          <svg class="gm-accordion-arrow" width="12" height="12" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div class="gm-accordion-meta">
          <span class="gm-group-name">${this.esc(group.name)}</span>
          <span class="gm-group-code">${this.esc(group.code)}</span>
        </div>
        <div class="gm-accordion-badges">
          ${purposeChips}${morePurposes}
          <span class="gm-badge gm-badge--count">${memberCount} membro${memberCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="gm-accordion-actions">
          ${this.isSuperAdmin ? `
            <button class="um-icon-btn gm-delete-group-btn" title="Desativar grupo" data-id="${group.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>` : ''}
        </div>
      </div>
      <div class="gm-accordion-panel" style="display:${isExpanded ? '' : 'none'}">
        <div class="gm-panel-loading"><span class="um-spinner"></span> Carregando detalhes...</div>
      </div>
    `;

    item.querySelector('.gm-accordion-toggle')!
      .addEventListener('click', () => this.toggleGroup(group, item));

    item.querySelector('.gm-delete-group-btn')
      ?.addEventListener('click', (e) => { e.stopPropagation(); this.deleteGroup(group, item); });

    if (isExpanded) this.renderGroupPanel(group, item);

    return item;
  }

  private async toggleGroup(group: GCDRGroup, item: HTMLElement): Promise<void> {
    const panel  = item.querySelector<HTMLElement>('.gm-accordion-panel')!;
    const toggle = item.querySelector<HTMLElement>('.gm-accordion-toggle')!;
    const isOpen = this.expandedGroupId === group.id;

    if (isOpen) {
      this.expandedGroupId = null;
      panel.style.display = 'none';
      toggle.setAttribute('aria-expanded', 'false');
      item.classList.remove('gm-accordion-item--open');
      return;
    }

    // Close previously open item
    if (this.expandedGroupId) {
      const prev = this.el.querySelector<HTMLElement>(
        `.gm-accordion-item[data-id="${this.expandedGroupId}"]`,
      );
      if (prev) {
        prev.querySelector<HTMLElement>('.gm-accordion-panel')!.style.display = 'none';
        prev.querySelector<HTMLElement>('.gm-accordion-toggle')!.setAttribute('aria-expanded', 'false');
        prev.classList.remove('gm-accordion-item--open');
      }
    }

    this.expandedGroupId = group.id;
    panel.style.display = '';
    toggle.setAttribute('aria-expanded', 'true');
    item.classList.add('gm-accordion-item--open');
    await this.renderGroupPanel(group, item);
  }

  // ── Group panel ───────────────────────────────────────────────────────────────

  private async renderGroupPanel(group: GCDRGroup, item: HTMLElement): Promise<void> {
    const panel = item.querySelector<HTMLElement>('.gm-accordion-panel')!;
    panel.innerHTML = '<div class="gm-panel-loading"><span class="um-spinner"></span> Carregando detalhes...</div>';

    const [members, groupChannels, dispatch] = await Promise.all([
      this.fetchGroupMembers(group.id),
      this.fetchGroupChannels(group.id),
      this.fetchGroupDispatch(group.id),
    ]);

    panel.innerHTML = `
      ${this.buildMembersSection(group, members)}
      ${this.buildGroupChannelsSection(group, groupChannels)}
      ${this.buildDispatchSection(group, groupChannels, dispatch)}
    `;

    this.bindGroupPanelEvents(group, panel);
  }

  private buildMembersSection(group: GCDRGroup, members: GCDRGroupMember[]): string {
    return `
      <div class="gm-panel-section">
        <div class="gm-panel-section-header">
          <span class="gm-panel-section-title">Membros (${members.length})</span>
          ${this.isSuperAdmin
            ? '<button class="um-btn um-btn--ghost um-btn--sm gm-show-add-member">+ Membro</button>'
            : ''}
        </div>
        <div class="gm-members-list">
          ${members.length === 0
            ? '<span class="gm-empty-inline">Nenhum membro neste grupo.</span>'
            : members.map(m => `
                <div class="gm-member-chip" data-uid="${this.esc(m.id)}">
                  <span class="gm-member-icon">👤</span>
                  <div class="gm-member-info">
                    <span class="gm-member-name">${this.esc(m.name || m.email || m.id)}</span>
                    ${m.email ? `<span class="gm-member-role">${this.esc(m.email)}</span>` : ''}
                  </div>
                  ${this.isSuperAdmin ? `
                    <button class="um-icon-btn gm-remove-member-btn" data-uid="${this.esc(m.id)}" title="Remover membro">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>` : ''}
                </div>`).join('')}
        </div>
        ${this.isSuperAdmin ? `
          <div class="gm-add-member-form" style="display:none">
            <select class="um-input gm-member-user-select" style="font-size:12px;max-width:360px;">
              <option value="">— Selecionar usuário —</option>
              ${this.tbUsers.map(u => `
                <option value="${u.id.id}">
                  ${this.esc([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email)}
                  (${this.esc(u.email)})
                </option>`).join('')}
            </select>
            <div style="display:flex;gap:6px;margin-top:6px;">
              <button class="um-btn um-btn--ghost um-btn--sm gm-cancel-member">Cancelar</button>
              <button class="um-btn um-btn--primary um-btn--sm gm-confirm-member">Adicionar</button>
            </div>
          </div>` : ''}
      </div>
    `;
  }

  private buildGroupChannelsSection(group: GCDRGroup, channels: GCDRGroupChannel[]): string {
    return `
      <div class="gm-panel-section">
        <div class="gm-panel-section-header">
          <span class="gm-panel-section-title">Canais do Grupo</span>
          ${this.isSuperAdmin
            ? '<button class="um-btn um-btn--ghost um-btn--sm gm-show-add-gchannel">+ Canal</button>'
            : ''}
        </div>
        ${channels.length === 0
          ? '<span class="gm-empty-inline">Nenhum canal configurado para este grupo.</span>'
          : `<div class="gm-gchannels-list">
              ${channels.map(ch => `
                <div class="gm-gchannel-row" data-channel="${this.esc(ch.channel)}">
                  <span class="gm-channel-icon">${this.channelIcon(ch.channel)}</span>
                  <span class="gm-channel-name">${this.esc(ch.channel)}</span>
                  ${ch.target ? `<span class="gm-channel-target">${this.esc(ch.target)}</span>` : ''}
                  ${this.isSuperAdmin ? `
                    <label class="gm-toggle" title="${ch.active ? 'Ativo' : 'Inativo'}">
                      <input type="checkbox" class="gm-toggle-input gm-gchannel-toggle"
                        ${ch.active ? 'checked' : ''} data-channel="${this.esc(ch.channel)}" />
                      <span class="gm-toggle-slider"></span>
                    </label>
                    <button class="um-icon-btn gm-delete-gchannel-btn"
                        data-channel="${this.esc(ch.channel)}" title="Remover canal do grupo">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                      </svg>
                    </button>`
                    : `<span class="gm-badge ${ch.active ? 'gm-badge--on' : 'gm-badge--off'}">
                        ${ch.active ? 'Ativo' : 'Inativo'}
                       </span>`}
                </div>`).join('')}
            </div>`}
        <div class="gm-gchannel-form" style="display:none"></div>
      </div>
    `;
  }

  private buildDispatchSection(
    group: GCDRGroup,
    channels: GCDRGroupChannel[],
    dispatch: GCDRDispatchEntry[],
  ): string {
    const lookup: Record<string, Record<string, { active: boolean; delayMs: number }>> = {};
    for (const ch of channels) {
      lookup[ch.channel] = {};
      for (const act of ALARM_ACTIONS) {
        lookup[ch.channel][act] = { active: false, delayMs: 0 };
      }
    }
    for (const e of dispatch) {
      if (lookup[e.channel]) {
        lookup[e.channel][e.action] = {
          active: e.active,
          delayMs: e.escalationDelayMs ?? 0,
        };
      }
    }

    const ro = !this.isSuperAdmin;

    return `
      <div class="gm-panel-section">
        <div class="gm-panel-section-header">
          <span class="gm-panel-section-title">Matriz de Despacho</span>
          ${this.isSuperAdmin
            ? '<button class="um-btn um-btn--primary um-btn--sm gm-save-dispatch-btn">Salvar Matriz</button>'
            : ''}
        </div>
        ${channels.length === 0
          ? '<span class="gm-empty-inline">Configure canais do grupo antes de definir o despacho.</span>'
          : `<div class="gm-dispatch-wrap" data-group-id="${group.id}">
              <table class="gm-dispatch-table">
                <thead>
                  <tr>
                    <th class="gm-dispatch-channel-col">Canal</th>
                    ${ALARM_ACTIONS.map(a =>
                      `<th class="gm-dispatch-action-col" title="${ACTION_LABELS[a]}">${ACTION_LABELS[a]}</th>`,
                    ).join('')}
                    <th class="gm-dispatch-delay-col" title="Atraso antes de despachar (ms)">Atraso (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  ${channels.map(ch => `
                    <tr>
                      <td class="gm-dispatch-channel-name">
                        ${this.channelIcon(ch.channel)} ${this.esc(ch.channel)}
                      </td>
                      ${ALARM_ACTIONS.map(act => `
                        <td class="gm-dispatch-cell">
                          <input type="checkbox" class="gm-dispatch-check"
                            data-channel="${ch.channel}" data-action="${act}"
                            ${lookup[ch.channel]?.[act]?.active ? 'checked' : ''}
                            ${ro ? 'disabled' : ''} />
                        </td>`).join('')}
                      <td>
                        <input type="number" class="um-input gm-delay-input"
                          data-channel="${ch.channel}"
                          value="${lookup[ch.channel]?.['ESCALATE']?.delayMs ?? 0}"
                          min="0" step="1000"
                          style="width:80px;padding:4px 8px;font-size:11px;"
                          ${ro ? 'disabled' : ''} />
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
      </div>
    `;
  }

  // ── Group panel event binding ──────────────────────────────────────────────────

  private bindGroupPanelEvents(group: GCDRGroup, panel: HTMLElement): void {
    // Members
    panel.querySelector('.gm-show-add-member')
      ?.addEventListener('click', () => {
        panel.querySelector<HTMLElement>('.gm-add-member-form')!.style.display = '';
      });
    panel.querySelector('.gm-cancel-member')
      ?.addEventListener('click', () => {
        panel.querySelector<HTMLElement>('.gm-add-member-form')!.style.display = 'none';
      });
    panel.querySelector('.gm-confirm-member')
      ?.addEventListener('click', () => this.addMember(group, panel));
    panel.querySelectorAll('.gm-remove-member-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        this.removeMember(group, (btn as HTMLElement).dataset.uid!, panel));
    });

    // Group channels
    panel.querySelectorAll<HTMLInputElement>('.gm-gchannel-toggle').forEach(toggle => {
      toggle.addEventListener('change', () =>
        this.patchGroupChannel(group.id, toggle.dataset.channel as GCDRChannelType, toggle.checked, toggle));
    });
    panel.querySelectorAll('.gm-delete-gchannel-btn').forEach(btn => {
      btn.addEventListener('click', () =>
        this.deleteGroupChannel(group.id, (btn as HTMLElement).dataset.channel as GCDRChannelType, panel));
    });
    panel.querySelector('.gm-show-add-gchannel')
      ?.addEventListener('click', () => this.showGroupChannelForm(group.id, panel));

    // Dispatch
    panel.querySelector('.gm-save-dispatch-btn')
      ?.addEventListener('click', () => this.saveDispatch(group.id, panel));
  }

  // ── Group lazy loaders ────────────────────────────────────────────────────────

  private async fetchGroupMembers(groupId: string): Promise<GCDRGroupMember[]> {
    if (this.membersCache.has(groupId)) return this.membersCache.get(groupId)!;
    try {
      const res = await fetch(`${this.gcdrBase()}/groups/${groupId}/members`, { headers: this.gcdrHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const members = this.unwrapList<GCDRGroupMember>(json);
      this.membersCache.set(groupId, members);
      return members;
    } catch (err) {
      console.warn('[GroupManagementTab] fetchGroupMembers', err);
      return [];
    }
  }

  private async fetchGroupChannels(groupId: string): Promise<GCDRGroupChannel[]> {
    if (this.groupChannelsCache.has(groupId)) return this.groupChannelsCache.get(groupId)!;
    try {
      const res = await fetch(`${this.gcdrBase()}/groups/${groupId}/channels`, { headers: this.gcdrHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const channels = this.unwrapList<GCDRGroupChannel>(json);
      this.groupChannelsCache.set(groupId, channels);
      return channels;
    } catch (err) {
      console.warn('[GroupManagementTab] fetchGroupChannels', err);
      return [];
    }
  }

  private async fetchGroupDispatch(groupId: string): Promise<GCDRDispatchEntry[]> {
    if (this.dispatchCache.has(groupId)) return this.dispatchCache.get(groupId)!;
    try {
      const res = await fetch(`${this.gcdrBase()}/groups/${groupId}/dispatch`, { headers: this.gcdrHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const entries = this.unwrapList<GCDRDispatchEntry>(json);
      this.dispatchCache.set(groupId, entries);
      return entries;
    } catch (err) {
      console.warn('[GroupManagementTab] fetchGroupDispatch', err);
      return [];
    }
  }

  // ── Members ───────────────────────────────────────────────────────────────────

  private async addMember(group: GCDRGroup, panel: HTMLElement): Promise<void> {
    const select = panel.querySelector<HTMLSelectElement>('.gm-member-user-select')!;
    const userId = select.value;
    if (!userId) return;

    const btn = panel.querySelector<HTMLButtonElement>('.gm-confirm-member')!;
    btn.disabled = true;
    btn.textContent = 'Adicionando...';

    try {
      const res = await fetch(`${this.gcdrBase()}/groups/${group.id}/members`, {
        method: 'POST',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ members: [{ id: userId, type: 'USER' }] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.membersCache.delete(group.id);
      const item = this.el.querySelector<HTMLElement>(`.gm-accordion-item[data-id="${group.id}"]`)!;
      await this.renderGroupPanel(group, item);
      this.callbacks.showToast('Membro adicionado.', 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] addMember', err);
      this.callbacks.showToast(`Erro ao adicionar membro: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Adicionar';
    }
  }

  private async removeMember(group: GCDRGroup, memberId: string, panel: HTMLElement): Promise<void> {
    if (!confirm('Remover este membro do grupo?')) return;
    try {
      const res = await fetch(`${this.gcdrBase()}/groups/${group.id}/members`, {
        method: 'DELETE',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ memberIds: [memberId] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.membersCache.delete(group.id);
      const item = this.el.querySelector<HTMLElement>(`.gm-accordion-item[data-id="${group.id}"]`)!;
      await this.renderGroupPanel(group, item);
      this.callbacks.showToast('Membro removido.', 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] removeMember', err);
      this.callbacks.showToast(`Erro ao remover membro: ${err.message}`, 'error');
    }
  }

  // ── Group Channels ────────────────────────────────────────────────────────────

  private async patchGroupChannel(
    groupId: string, channel: GCDRChannelType, active: boolean, toggle: HTMLInputElement,
  ): Promise<void> {
    try {
      const res = await fetch(`${this.gcdrBase()}/groups/${groupId}/channels/${channel}`, {
        method: 'PATCH',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cached = this.groupChannelsCache.get(groupId);
      if (cached) { const ch = cached.find(c => c.channel === channel); if (ch) ch.active = active; }
      this.callbacks.showToast(`Canal ${channel} ${active ? 'ativado' : 'desativado'}.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] patchGroupChannel', err);
      toggle.checked = !active;
      this.callbacks.showToast('Erro ao atualizar canal.', 'error');
    }
  }

  private async deleteGroupChannel(groupId: string, channel: GCDRChannelType, panel: HTMLElement): Promise<void> {
    if (!confirm(`Remover canal ${channel} deste grupo?`)) return;
    try {
      const res = await fetch(`${this.gcdrBase()}/groups/${groupId}/channels/${channel}`, {
        method: 'DELETE',
        headers: this.gcdrHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.groupChannelsCache.delete(groupId);
      this.dispatchCache.delete(groupId);
      const group = this.groups.find(g => g.id === groupId)!;
      const item  = this.el.querySelector<HTMLElement>(`.gm-accordion-item[data-id="${groupId}"]`)!;
      await this.renderGroupPanel(group, item);
      this.callbacks.showToast(`Canal ${channel} removido.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] deleteGroupChannel', err);
      this.callbacks.showToast('Erro ao remover canal.', 'error');
    }
  }

  private showGroupChannelForm(groupId: string, panel: HTMLElement): void {
    const formEl = panel.querySelector<HTMLElement>('.gm-gchannel-form')!;
    formEl.style.display = '';
    formEl.innerHTML = `
      <div class="gm-form-card" style="margin-top:10px;">
        <h4 class="gm-form-title">Adicionar Canal ao Grupo</h4>
        <div class="um-form-row">
          <div class="um-form-group">
            <label class="um-label">Tipo</label>
            <select class="um-input gm-gchannel-type">
              ${GROUP_CHANNEL_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <div class="um-form-group">
            <label class="um-label">Target</label>
            <input class="um-input gm-gchannel-target" placeholder="ex: ops@empresa.com, -100123456789" />
          </div>
        </div>
        <div class="um-form-group um-form-group--check">
          <label class="um-check-label">
            <input type="checkbox" class="gm-gchannel-active" checked /> Canal ativo
          </label>
        </div>
        <div class="um-form-actions">
          <button class="um-btn um-btn--ghost um-btn--sm gm-cancel-gchannel">Cancelar</button>
          <button class="um-btn um-btn--primary um-btn--sm gm-save-gchannel">Adicionar</button>
        </div>
      </div>
    `;
    formEl.querySelector('.gm-cancel-gchannel')!
      .addEventListener('click', () => { formEl.style.display = 'none'; });
    formEl.querySelector('.gm-save-gchannel')!
      .addEventListener('click', () => this.saveGroupChannel(groupId, panel, formEl));
  }

  private async saveGroupChannel(
    groupId: string, panel: HTMLElement, formEl: HTMLElement,
  ): Promise<void> {
    const channel = formEl.querySelector<HTMLSelectElement>('.gm-gchannel-type')!.value as GCDRChannelType;
    const target  = formEl.querySelector<HTMLInputElement>('.gm-gchannel-target')!.value.trim();
    const active  = formEl.querySelector<HTMLInputElement>('.gm-gchannel-active')!.checked;

    const btn = formEl.querySelector<HTMLButtonElement>('.gm-save-gchannel')!;
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      const current = await this.fetchGroupChannels(groupId);
      const updated = [...current.filter(c => c.channel !== channel), { channel, active, target }];
      const res = await fetch(`${this.gcdrBase()}/groups/${groupId}/channels`, {
        method: 'PUT',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ channels: updated }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.groupChannelsCache.delete(groupId);
      this.dispatchCache.delete(groupId);
      const group = this.groups.find(g => g.id === groupId)!;
      const item  = this.el.querySelector<HTMLElement>(`.gm-accordion-item[data-id="${groupId}"]`)!;
      await this.renderGroupPanel(group, item);
      this.callbacks.showToast(`Canal ${channel} adicionado ao grupo.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] saveGroupChannel', err);
      this.callbacks.showToast(`Erro ao salvar canal: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Adicionar';
    }
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────────

  private async saveDispatch(groupId: string, panel: HTMLElement): Promise<void> {
    const btn = panel.querySelector<HTMLButtonElement>('.gm-save-dispatch-btn')!;
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    // Collect per-channel delay (applied to all actions in that row)
    const delayByChannel: Record<string, number> = {};
    panel.querySelectorAll<HTMLInputElement>('.gm-delay-input').forEach(inp => {
      delayByChannel[inp.dataset.channel!] = parseInt(inp.value, 10) || 0;
    });

    const entries: GCDRDispatchEntry[] = [];
    panel.querySelectorAll<HTMLInputElement>('.gm-dispatch-check').forEach(cb => {
      entries.push({
        channel:            cb.dataset.channel as GCDRChannelType,
        action:             cb.dataset.action  as AlarmAction,
        active:             cb.checked,
        escalationDelayMs:  delayByChannel[cb.dataset.channel!] ?? 0,
      });
    });

    try {
      const res = await fetch(`${this.gcdrBase()}/groups/${groupId}/dispatch`, {
        method: 'PUT',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.dispatchCache.set(groupId, entries);
      this.callbacks.showToast('Matriz de despacho salva!', 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] saveDispatch', err);
      this.callbacks.showToast('Erro ao salvar matriz.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar Matriz';
    }
  }

  // ── Delete group ──────────────────────────────────────────────────────────────

  private async deleteGroup(group: GCDRGroup, item: HTMLElement): Promise<void> {
    if (!confirm(
      `Desativar o grupo "${group.name}"?\n\nO grupo será marcado como inativo (dados preservados).`,
    )) return;

    try {
      const res = await fetch(`${this.gcdrBase()}/groups/${group.id}?soft=true`, {
        method: 'DELETE',
        headers: this.gcdrHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.groups = this.groups.filter(g => g.id !== group.id);
      if (this.expandedGroupId === group.id) this.expandedGroupId = null;
      item.remove();
      if (this.groups.length === 0) {
        this.el.querySelector<HTMLElement>('.gm-groups-empty')!.style.display = '';
      }
      this.callbacks.showToast(`Grupo "${group.name}" desativado.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] deleteGroup', err);
      this.callbacks.showToast(`Erro ao desativar grupo: ${err.message}`, 'error');
    }
  }

  // ── New Group Form ────────────────────────────────────────────────────────────

  private showNewGroupForm(): void {
    const formEl = this.el.querySelector<HTMLElement>('.gm-new-group-form')!;
    formEl.style.display = '';
    formEl.innerHTML = `
      <div class="gm-form-card">
        <h4 class="gm-form-title">Novo Grupo</h4>
        <div class="um-form-row">
          <div class="um-form-group">
            <label class="um-label">Nome <span class="um-req">*</span></label>
            <input class="um-input" id="gm-new-name" placeholder="Ex: Operações Noturnas" />
          </div>
          <div class="um-form-group">
            <label class="um-label">Código <span class="um-req">*</span>
              <span style="font-size:10px;font-weight:400;color:var(--um-text-faint)"> A-Z 0-9 -</span>
            </label>
            <input class="um-input" id="gm-new-code" placeholder="OPS-NOTURNO"
              style="text-transform:uppercase;" />
          </div>
        </div>
        <div class="um-form-group">
          <label class="um-label">Tipo <span class="um-req">*</span></label>
          <select class="um-input" id="gm-new-type">
            <option value="USER">USER — grupo de usuários</option>
            <option value="DEVICE">DEVICE — grupo de dispositivos</option>
            <option value="MIXED">MIXED — misto</option>
          </select>
        </div>
        <div class="um-form-group">
          <label class="um-label">Finalidades <span class="um-req">*</span></label>
          <div class="gm-purposes-grid">
            ${ALL_PURPOSES.map(p => `
              <label class="um-check-label" style="font-size:12px;">
                <input type="checkbox" class="gm-purpose-check" value="${p}" />
                ${this.esc(PURPOSE_LABELS[p] || p)}
              </label>`).join('')}
          </div>
        </div>
        <div class="um-form-actions">
          <button class="um-btn um-btn--ghost gm-cancel-new-group">Cancelar</button>
          <button class="um-btn um-btn--primary gm-create-group-btn">Criar Grupo</button>
        </div>
      </div>
    `;

    // Auto-generate code from name
    const nameInput = formEl.querySelector<HTMLInputElement>('#gm-new-name')!;
    const codeInput = formEl.querySelector<HTMLInputElement>('#gm-new-code')!;
    nameInput.addEventListener('input', () => {
      if (!codeInput.dataset.edited) {
        codeInput.value = nameInput.value
          .toUpperCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
    });
    codeInput.addEventListener('input', () => { codeInput.dataset.edited = '1'; });

    formEl.querySelector('.gm-cancel-new-group')!
      .addEventListener('click', () => { formEl.style.display = 'none'; });
    formEl.querySelector('.gm-create-group-btn')!
      .addEventListener('click', () => this.createGroup(formEl));
  }

  private async createGroup(formEl: HTMLElement): Promise<void> {
    const name     = formEl.querySelector<HTMLInputElement>('#gm-new-name')!.value.trim();
    const code     = formEl.querySelector<HTMLInputElement>('#gm-new-code')!.value.trim().toUpperCase();
    const type     = formEl.querySelector<HTMLSelectElement>('#gm-new-type')!.value;
    const purposes = Array.from(
      formEl.querySelectorAll<HTMLInputElement>('.gm-purpose-check:checked'),
    ).map(cb => cb.value);
    const cid = this.gcdrCid();

    if (!name)              { this.callbacks.showToast('Nome é obrigatório.', 'error'); return; }
    if (!code)              { this.callbacks.showToast('Código é obrigatório.', 'error'); return; }
    if (!purposes.length)   { this.callbacks.showToast('Selecione pelo menos uma finalidade.', 'error'); return; }

    const btn = formEl.querySelector<HTMLButtonElement>('.gm-create-group-btn')!;
    btn.disabled = true;
    btn.textContent = 'Criando...';

    try {
      const res = await fetch(`${this.gcdrBase()}/groups`, {
        method: 'POST',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ customerId: cid, name, code, type, purposes, members: [] }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${txt ? ': ' + txt.slice(0, 80) : ''}`);
      }
      formEl.style.display = 'none';
      this.callbacks.showToast(`Grupo "${name}" criado!`, 'success');
      await this.loadGroups();
    } catch (err: any) {
      console.error('[GroupManagementTab] createGroup', err);
      this.callbacks.showToast(`Erro ao criar grupo: ${err.message}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Criar Grupo';
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────────

  private filterGroups(q: string): void {
    this.renderGroupsAccordion(q);
    // Re-open previously expanded group if still visible
    if (this.expandedGroupId) {
      const item = this.el.querySelector<HTMLElement>(
        `.gm-accordion-item[data-id="${this.expandedGroupId}"]`,
      );
      if (item) {
        item.querySelector<HTMLElement>('.gm-accordion-panel')!.style.display = '';
        item.querySelector<HTMLElement>('.gm-accordion-toggle')!.setAttribute('aria-expanded', 'true');
        item.classList.add('gm-accordion-item--open');
        const group = this.groups.find(g => g.id === this.expandedGroupId);
        if (group) this.renderGroupPanel(group, item);
      }
    }
  }

  // ── Customer Channels ─────────────────────────────────────────────────────────

  private async loadCustomerChannels(): Promise<void> {
    const cid       = this.gcdrCid();
    const loadingEl = this.el.querySelector<HTMLElement>('.gm-cchannels-loading')!;
    const emptyEl   = this.el.querySelector<HTMLElement>('.gm-cchannels-empty')!;
    const errorEl   = this.el.querySelector<HTMLElement>('.gm-cchannels-error')!;

    if (!cid) { loadingEl.style.display = 'none'; return; }

    loadingEl.style.display = '';
    emptyEl.style.display = 'none';
    errorEl.style.display = 'none';

    try {
      const res = await fetch(`${this.gcdrBase()}/customers/${cid}/channels`, { headers: this.gcdrHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      this.customerChannels = this.unwrapList<CustomerChannel>(json);
      this.renderCustomerChannels();
    } catch (err: any) {
      console.error('[GroupManagementTab] loadCustomerChannels', err);
      errorEl.style.display = '';
      errorEl.textContent = `Erro ao carregar canais do cliente: ${err.message}`;
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  private renderCustomerChannels(): void {
    const listEl  = this.el.querySelector<HTMLElement>('.gm-customer-channels-list')!;
    const emptyEl = this.el.querySelector<HTMLElement>('.gm-cchannels-empty')!;
    listEl.innerHTML = '';

    if (this.customerChannels.length === 0) { emptyEl.style.display = ''; return; }
    emptyEl.style.display = 'none';

    for (const ch of this.customerChannels) {
      const card = document.createElement('div');
      card.className = 'gm-channel-card';
      const summary = this.customerChannelSummary(ch);
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
            <input type="checkbox" class="gm-toggle-input" ${ch.active ? 'checked' : ''}
              ${!this.isSuperAdmin ? 'disabled' : ''} />
            <span class="gm-toggle-slider"></span>
          </label>
          ${this.isSuperAdmin ? `
            <button class="um-icon-btn gm-edit-cchannel-btn" title="Editar credenciais" data-id="${ch.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
            <button class="um-icon-btn gm-delete-cchannel-btn" title="Remover canal" data-id="${ch.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
              </svg>
            </button>` : ''}
        </div>
      `;

      const toggle = card.querySelector<HTMLInputElement>('.gm-toggle-input');
      if (toggle && this.isSuperAdmin) {
        toggle.addEventListener('change', () => this.toggleCustomerChannel(ch, toggle.checked, toggle));
      }
      card.querySelector('.gm-edit-cchannel-btn')
        ?.addEventListener('click', () => this.showCustomerChannelForm(ch));
      card.querySelector('.gm-delete-cchannel-btn')
        ?.addEventListener('click', () => this.deleteCustomerChannel(ch));

      listEl.appendChild(card);
    }
  }

  private async toggleCustomerChannel(
    ch: CustomerChannel, active: boolean, toggle: HTMLInputElement,
  ): Promise<void> {
    const cid = this.gcdrCid();
    try {
      const res = await fetch(`${this.gcdrBase()}/customers/${cid}/channels/${ch.id}`, {
        method: 'PATCH',
        headers: this.gcdrHeaders(),
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ch.active = active;
      this.callbacks.showToast(`Canal ${ch.channel} ${active ? 'ativado' : 'desativado'}.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] toggleCustomerChannel', err);
      toggle.checked = !active;
      this.callbacks.showToast('Erro ao atualizar canal.', 'error');
    }
  }

  private async deleteCustomerChannel(ch: CustomerChannel): Promise<void> {
    if (!confirm(
      `Remover o canal ${ch.channel}?\n\nEsta ação afeta todos os grupos que utilizam este canal.`,
    )) return;
    const cid = this.gcdrCid();
    try {
      const res = await fetch(`${this.gcdrBase()}/customers/${cid}/channels/${ch.id}`, {
        method: 'DELETE',
        headers: this.gcdrHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.customerChannels = this.customerChannels.filter(c => c.id !== ch.id);
      this.renderCustomerChannels();
      this.callbacks.showToast(`Canal ${ch.channel} removido.`, 'success');
    } catch (err: any) {
      console.error('[GroupManagementTab] deleteCustomerChannel', err);
      this.callbacks.showToast('Erro ao remover canal.', 'error');
    }
  }

  private showCustomerChannelForm(existing?: CustomerChannel): void {
    const formEl = this.el.querySelector<HTMLElement>('.gm-channel-form')!;
    const channelType = existing?.channel || 'EMAIL_RELAY';

    formEl.style.display = '';
    formEl.innerHTML = `
      <div class="gm-form-card">
        <h4 class="gm-form-title">${existing ? 'Editar Canal' : 'Adicionar Canal'}</h4>
        <div class="um-form-group">
          <label class="um-label">Tipo</label>
          <select class="um-input gm-channel-type-select" ${existing ? 'disabled' : ''}>
            ${CUSTOMER_CHANNEL_TYPES.map(t =>
              `<option value="${t}" ${t === channelType ? 'selected' : ''}>${t}</option>`,
            ).join('')}
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
      formEl.querySelector<HTMLElement>('.gm-channel-config-fields')!.innerHTML =
        this.buildChannelConfigFields(type, existing?.config || {});
    };
    renderConfigFields(channelType);

    const typeSelect = formEl.querySelector<HTMLSelectElement>('.gm-channel-type-select')!;
    typeSelect.addEventListener('change', () => renderConfigFields(typeSelect.value));
    formEl.querySelector('.gm-cancel-channel-btn')!
      .addEventListener('click', () => { formEl.style.display = 'none'; });
    formEl.querySelector('.gm-save-channel-btn')!
      .addEventListener('click', () => this.saveCustomerChannel(formEl, existing));
  }

  private buildChannelConfigFields(type: string, existing: Record<string, unknown> = {}): string {
    const val = (k: string) => this.esc(String(existing[k] || ''));
    switch (type) {
      case 'EMAIL_RELAY': return `
        <div class="um-form-row">
          <div class="um-form-group">
            <label class="um-label">Host SMTP</label>
            <input class="um-input" name="host" value="${val('host')}" placeholder="smtp.office365.com" />
          </div>
          <div class="um-form-group">
            <label class="um-label">Porta</label>
            <input class="um-input" name="port" type="number" value="${val('port') || '587'}" />
          </div>
        </div>
        <div class="um-form-group">
          <label class="um-label">Usuário</label>
          <input class="um-input" name="user" value="${val('user')}" />
        </div>
        <div class="um-form-group">
          <label class="um-label">Senha</label>
          <input class="um-input" name="password" type="password" placeholder="(mantida se em branco)" />
        </div>
        <div class="um-form-group">
          <label class="um-label">From</label>
          <input class="um-input" name="from" value="${val('from')}"
            placeholder="Alertas MYIO &lt;alertas@empresa.com.br&gt;" />
        </div>`;
      case 'TELEGRAM': return `
        <div class="um-form-group">
          <label class="um-label">Bot Token</label>
          <input class="um-input" name="botToken" type="password" placeholder="7123456789:AAH... (mantido se em branco)" />
        </div>`;
      case 'WHATSAPP': return `
        <div class="um-form-group">
          <label class="um-label">Account SID</label>
          <input class="um-input" name="accountSid" value="${val('accountSid')}" />
        </div>
        <div class="um-form-group">
          <label class="um-label">Auth Token</label>
          <input class="um-input" name="authToken" type="password" placeholder="(mantido se em branco)" />
        </div>
        <div class="um-form-group">
          <label class="um-label">From</label>
          <input class="um-input" name="from" value="${val('from')}" placeholder="+5531900000000" />
        </div>`;
      case 'WEBHOOK': return `
        <div class="um-form-group">
          <label class="um-label">HMAC Secret</label>
          <input class="um-input" name="secret" type="password" placeholder="(mantido se em branco)" />
        </div>`;
      case 'SLACK': return `
        <div class="um-form-group">
          <label class="um-label">Bot Token</label>
          <input class="um-input" name="botToken" type="password" placeholder="xoxb-... (mantido se em branco)" />
        </div>`;
      case 'SMS': return `
        <div class="um-form-group">
          <label class="um-label">Provider</label>
          <input class="um-input" name="provider" value="${val('provider')}" />
        </div>
        <div class="um-form-group">
          <label class="um-label">API Key</label>
          <input class="um-input" name="apiKey" type="password" placeholder="(mantido se em branco)" />
        </div>
        <div class="um-form-group">
          <label class="um-label">From</label>
          <input class="um-input" name="from" value="${val('from')}" />
        </div>`;
      default: return `
        <div class="um-form-group">
          <label class="um-label">Config JSON</label>
          <textarea class="um-input um-textarea" name="_json" rows="3">${this.esc(JSON.stringify(existing, null, 2))}</textarea>
        </div>`;
    }
  }

  private async saveCustomerChannel(formEl: HTMLElement, existing?: CustomerChannel): Promise<void> {
    const cid    = this.gcdrCid();
    const type   = formEl.querySelector<HTMLSelectElement>('.gm-channel-type-select')!.value;
    const active = formEl.querySelector<HTMLInputElement>('.gm-channel-active')!.checked;

    const config: Record<string, unknown> = {};
    formEl.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]')
      .forEach(el => {
        if (el.name === '_json') {
          try { Object.assign(config, JSON.parse(el.value)); } catch { /* ignore */ }
        } else if (el.name && el.value) {
          config[el.name] = (el as HTMLInputElement).type === 'number'
            ? Number(el.value)
            : el.value;
        }
      });

    const btn = formEl.querySelector<HTMLButtonElement>('.gm-save-channel-btn')!;
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      let res: Response;
      if (existing) {
        res = await fetch(`${this.gcdrBase()}/customers/${cid}/channels/${existing.id}`, {
          method: 'PATCH',
          headers: this.gcdrHeaders(),
          body: JSON.stringify({ active, config }),
        });
      } else {
        res = await fetch(`${this.gcdrBase()}/customers/${cid}/channels`, {
          method: 'POST',
          headers: this.gcdrHeaders(),
          body: JSON.stringify({ channel: type, active, config }),
        });
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${txt ? ': ' + txt.slice(0, 80) : ''}`);
      }
      formEl.style.display = 'none';
      this.callbacks.showToast(`Canal ${type} ${existing ? 'atualizado' : 'adicionado'}!`, 'success');
      await this.loadCustomerChannels();
    } catch (err: any) {
      console.error('[GroupManagementTab] saveCustomerChannel', err);
      this.callbacks.showToast(`Erro: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = existing ? 'Salvar' : 'Adicionar';
    }
  }

  // ── TB Users ──────────────────────────────────────────────────────────────────

  private async loadTBUsers(): Promise<void> {
    try {
      const { tbBaseUrl, jwtToken, customerId } = this.config;
      const res = await fetch(
        `${tbBaseUrl}/api/customer/${customerId}/users?pageSize=100&page=0`,
        { headers: { 'X-Authorization': `Bearer ${jwtToken}` } },
      );
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
      EMAIL: '✉️', EMAIL_RELAY: '✉️', TELEGRAM: '✈️',
      WHATSAPP: '📱', WEBHOOK: '🔗', SMS: '💬', SLACK: '💼', TEAMS: '🖥️',
    };
    return icons[ch] || '📡';
  }

  private customerChannelSummary(ch: CustomerChannel): string {
    const cfg = ch.config || {};
    switch (ch.channel) {
      case 'EMAIL_RELAY': return `${cfg.host || ''}:${cfg.port || ''} · ${cfg.from || cfg.user || ''}`;
      case 'TELEGRAM':    return cfg.botToken ? '●●●●● bot token configurado' : '—';
      case 'WHATSAPP':    return String(cfg.from || cfg.accountSid || '—').slice(0, 30);
      case 'WEBHOOK':     return cfg.secret ? '●●● signing key configurado' : '—';
      case 'SLACK':       return cfg.botToken ? '●●●●● bot token configurado' : '—';
      case 'SMS':         return String(cfg.provider || '—');
      default:            return '';
    }
  }

  private esc(s: string): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
