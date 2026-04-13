import { UserManagementConfig, TBUser, TBUserPage, buildUserTabLabel, GCDRAssignment, UserAssignmentsResponse, GCDRUser, GCDRUserConfigs, GCDRExternalLink } from '../types';

export interface UserListCallbacks {
  onOpenUserDetail(user: TBUser, editMode?: boolean): void;
  onSwitchToNewUser(): void;
  showToast(msg: string, type?: 'success' | 'error'): void;
}

export class UserListTab {
  private config: UserManagementConfig;
  private callbacks: UserListCallbacks;
  private el!: HTMLElement;
  private currentPage = 0;
  private totalPages = 0;
  private searchQuery = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private loading = false;
  private users: TBUser[] = [];
  private highlightedUserId: string | null = null;
  private gcdrConfigs = new Map<string, GCDRUserConfigs | null>();
  private gcdrSyncing = new Set<string>();
  private syncTooltipEl: HTMLElement | null = null;

  constructor(config: UserManagementConfig, callbacks: UserListCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  render(): HTMLElement {
    this.el = document.createElement('div');
    this.el.className = 'um-tab-content um-user-list';
    this.el.innerHTML = `
      <div class="um-list-toolbar">
        <div class="um-search-wrap">
          <svg class="um-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" class="um-search-input" placeholder="Buscar por nome ou e-mail..." />
        </div>
        <button class="um-btn um-btn--primary um-btn--sm um-new-user-btn">+ Novo Usuário</button>
      </div>
      <div class="um-table-wrap">
        <table class="um-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Status</th>
              <th class="um-col-gcdr">GCDR</th>
              <th class="um-col-actions">Ações</th>
            </tr>
          </thead>
          <tbody class="um-tbody"></tbody>
        </table>
        <div class="um-list-empty" style="display:none">Nenhum usuário encontrado.</div>
        <div class="um-list-loading" style="display:none">
          <span class="um-spinner"></span> Carregando...
        </div>
      </div>
      <div class="um-pagination" style="display:none">
        <button class="um-btn um-btn--ghost um-btn--sm um-prev-btn">← Anterior</button>
        <span class="um-page-info"></span>
        <button class="um-btn um-btn--ghost um-btn--sm um-next-btn">Próxima →</button>
      </div>
    `;

    const searchInput = this.el.querySelector<HTMLInputElement>('.um-search-input')!;
    searchInput.addEventListener('input', () => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.searchQuery = searchInput.value.trim();
        this.currentPage = 0;
        this.fetchUsers();
      }, 300);
    });

    this.el.querySelector('.um-new-user-btn')!.addEventListener('click', () => {
      this.callbacks.onSwitchToNewUser();
    });

    this.el.querySelector('.um-prev-btn')!.addEventListener('click', () => {
      if (this.currentPage > 0) { this.currentPage--; this.fetchUsers(); }
    });

    this.el.querySelector('.um-next-btn')!.addEventListener('click', () => {
      if (this.currentPage < this.totalPages - 1) { this.currentPage++; this.fetchUsers(); }
    });

    this.fetchUsers();
    return this.el;
  }

  /** Called by NewUserTab/UserDetailTab after a mutation so we refresh the list */
  refresh(highlightUserId?: string): void {
    if (highlightUserId) this.highlightedUserId = highlightUserId;
    this.fetchUsers();
  }

  private async fetchUsers(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.setLoading(true);

    try {
      const { tbBaseUrl, jwtToken, customerId } = this.config;
      const q = encodeURIComponent(this.searchQuery);
      const url = `${tbBaseUrl}/api/customer/${customerId}/users?pageSize=20&page=${this.currentPage}${q ? `&textSearch=${q}` : ''}`;
      const res = await fetch(url, {
        headers: { 'X-Authorization': `Bearer ${jwtToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page: TBUserPage = await res.json();
      this.users = page.data;
      this.totalPages = page.totalPages;
      this.renderRows();
      this.renderPagination(page);
      this.fetchGcdrConfigsBatch();
    } catch (err: any) {
      console.error('[UserListTab] fetchUsers error', err);
      this.callbacks.showToast('Erro ao carregar usuários. Tente novamente.', 'error');
    } finally {
      this.loading = false;
      this.setLoading(false);
    }
  }

  private renderRows(): void {
    const tbody = this.el.querySelector<HTMLElement>('.um-tbody')!;
    const empty = this.el.querySelector<HTMLElement>('.um-list-empty')!;
    tbody.innerHTML = '';

    if (this.users.length === 0) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    for (const user of this.users) {
      const tr = document.createElement('tr');
      tr.dataset.userId = user.id.id;
      if (this.highlightedUserId === user.id.id) {
        tr.classList.add('um-row--highlight');
        this.highlightedUserId = null;
      }
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
      const role = user.authority === 'TENANT_ADMIN' ? 'Admin' : 'Usuário';
      const statusBadge = this.buildStatusBadge(user);
      const uid = user.id.id;
      tr.innerHTML = `
        <td>${this.esc(name)}</td>
        <td>${this.esc(user.email)}</td>
        <td><span class="um-badge um-badge--${user.authority === 'TENANT_ADMIN' ? 'admin' : 'user'}">${role}</span></td>
        <td>${statusBadge}</td>
        <td class="um-col-gcdr">
          <span class="um-sync-icon um-sync-icon--loading" data-sync-uid="${uid}">
            <span class="um-spinner" style="width:12px;height:12px;border-width:1.5px;display:block;margin:0 auto;"></span>
          </span>
          <button class="um-icon-btn um-force-sync-btn" title="Sincronizar com GCDR" style="margin-left:2px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </td>
        <td class="um-col-actions">
          <button class="um-icon-btn um-assign-btn" title="Ver Funções / Papéis" style="margin-right:4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
          <button class="um-icon-btn um-detail-btn" title="Ver Detalhes">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </td>
      `;
      tr.querySelector('.um-detail-btn')!.addEventListener('click', () => this.callbacks.onOpenUserDetail(user, false));
      tr.querySelector('.um-assign-btn')!.addEventListener('click', (e) => this.showAssignmentsPopup(user, e.currentTarget as HTMLElement));
      tr.querySelector('.um-force-sync-btn')!.addEventListener('click', () => this.syncUserToGCDR(user));
      const syncIcon = tr.querySelector<HTMLElement>('.um-sync-icon')!;
      syncIcon.addEventListener('mouseenter', (e) => this.showSyncTooltip(user, e.currentTarget as HTMLElement));
      syncIcon.addEventListener('mouseleave', () => this.hideSyncTooltip());
      tbody.appendChild(tr);
    }
  }

  private renderPagination(page: TBUserPage): void {
    const pag = this.el.querySelector<HTMLElement>('.um-pagination')!;
    const info = this.el.querySelector<HTMLElement>('.um-page-info')!;
    const prevBtn = this.el.querySelector<HTMLButtonElement>('.um-prev-btn')!;
    const nextBtn = this.el.querySelector<HTMLButtonElement>('.um-next-btn')!;

    if (page.totalPages <= 1) { pag.style.display = 'none'; return; }
    pag.style.display = '';
    info.textContent = `Página ${this.currentPage + 1} de ${page.totalPages}`;
    prevBtn.disabled = this.currentPage === 0;
    nextBtn.disabled = !page.hasNext;
  }

  private setLoading(on: boolean): void {
    const loadEl = this.el?.querySelector<HTMLElement>('.um-list-loading');
    const tableWrap = this.el?.querySelector<HTMLElement>('.um-table-wrap');
    if (loadEl) loadEl.style.display = on ? '' : 'none';
    if (tableWrap) tableWrap.style.opacity = on ? '0.5' : '1';
  }

  private buildStatusBadge(user: TBUser): string {
    const enabled = (user.additionalInfo as any)?.userCredentialsEnabled;
    if (enabled === false) {
      return `<span class="um-badge um-badge--blocked">Bloqueado</span>`;
    }
    // TB returns userCredentialsEnabled=true for active, undefined means not explicitly set (treat as active)
    return `<span class="um-badge um-badge--active">Ativo</span>`;
  }

  private gcdrHeaders(): Record<string, string> {
    const orch = (window as any).MyIOOrchestrator;
    return {
      'Content-Type': 'application/json',
      'X-API-Key': orch?.gcdrApiKey || '',
      'X-Tenant-ID': orch?.gcdrTenantId || '',
    };
  }

  private gcdrBase(): string {
    return (window as any).MyIOOrchestrator?.gcdrApiBaseUrl || '';
  }

  private unwrapList<T>(json: unknown): T[] {
    if (Array.isArray(json)) return json as T[];
    const j = json as Record<string, unknown>;
    if (j?.data && typeof j.data === 'object') {
      const d = j.data as Record<string, unknown>;
      if (Array.isArray(d.items)) return d.items as T[];
      if (Array.isArray(d)) return (d as unknown) as T[];
    }
    if (Array.isArray(j?.items)) return j.items as T[];
    return [];
  }

  private async showAssignmentsPopup(user: TBUser, anchor: HTMLElement): Promise<void> {
    // Remove any existing popup
    document.querySelector('.um-assign-popup')?.remove();

    const popup = document.createElement('div');
    popup.className = 'um-assign-popup';
    popup.setAttribute('data-theme', this.config.theme || 'light');

    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    popup.innerHTML = `
      <div class="um-assign-popup-header">
        <span class="um-assign-popup-title">🔑 Funções — ${this.esc(displayName)}</span>
        <button class="um-assign-popup-close" type="button">✕</button>
      </div>
      <div class="um-assign-popup-body">
        <div class="um-assign-popup-loading" style="font-size:12px;color:var(--um-text-muted);padding:8px 0;">
          <span class="um-spinner" style="display:inline-block;"></span> Carregando...
        </div>
      </div>
    `;

    // Position near anchor
    document.body.appendChild(popup);
    const rect = anchor.getBoundingClientRect();
    const popupW = 320;
    const left = Math.min(rect.right + 8, window.innerWidth - popupW - 12);
    popup.style.top = `${Math.max(rect.top - 10, 8)}px`;
    popup.style.left = `${left}px`;

    const close = () => popup.remove();
    popup.querySelector('.um-assign-popup-close')!.addEventListener('click', close);

    // Close on outside click
    const outsideHandler = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node) && e.target !== anchor) {
        close();
        document.removeEventListener('click', outsideHandler, true);
      }
    };
    setTimeout(() => document.addEventListener('click', outsideHandler, true), 50);

    // Fetch assignments
    const body = popup.querySelector<HTMLElement>('.um-assign-popup-body')!;
    const base = this.gcdrBase();
    if (!base) {
      body.innerHTML = `<div style="font-size:12px;color:var(--um-toast-err-text);padding:8px 0;">GCDR não configurado.</div>`;
      return;
    }

    try {
      const res = await fetch(`${base}/authorization/users/${user.id.id}/assignments`, { headers: this.gcdrHeaders() });
      let assignments: GCDRAssignment[] = [];
      if (res.ok) {
        const json = await res.json() as UserAssignmentsResponse | GCDRAssignment[];
        assignments = Array.isArray(json) ? json : (json.assignments ?? []);
      }

      if (assignments.length === 0) {
        body.innerHTML = `<div style="font-size:12px;color:var(--um-text-faint);padding:8px 0;">Nenhuma função atribuída.</div>`;
        return;
      }

      const statusColors: Record<string, string> = {
        active: 'var(--um-badge-active-text)',
        expired: 'var(--um-badge-blocked-text)',
        inactive: 'var(--um-text-faint)',
      };

      body.innerHTML = assignments.map(a => {
        const scopeLabel = a.scope === '*'
          ? '* (global)'
          : a.scope.startsWith('customer:')
            ? `Cliente (${a.scope.replace('customer:', '').slice(0, 8)}...)`
            : a.scope.startsWith('asset:')
              ? `Asset (${a.scope.replace('asset:', '').slice(0, 8)}...)`
              : this.esc(a.scope);
        const expires = a.expiresAt ? new Date(a.expiresAt).toLocaleDateString('pt-BR') : null;
        const color = statusColors[a.status] || 'var(--um-text-faint)';
        return `
          <div class="um-assign-row">
            <span class="um-assign-role">${this.esc(a.roleDisplayName || a.roleKey)}</span>
            <span class="um-assign-meta">
              Escopo: ${scopeLabel}
              · <span style="color:${color};font-weight:600;">${a.status}</span>
              ${expires ? ` · Expira ${expires}` : ''}
            </span>
          </div>`;
      }).join('');
    } catch {
      body.innerHTML = `<div style="font-size:12px;color:var(--um-toast-err-text);padding:8px 0;">Erro ao carregar.</div>`;
    }
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── GCDR Sync Column ─────────────────────────────────────────────────────────

  private async fetchGcdrConfigsBatch(): Promise<void> {
    if (this.users.length === 0) return;
    const { tbBaseUrl, jwtToken } = this.config;

    await Promise.allSettled(this.users.map(async (user) => {
      const uid = user.id.id;
      try {
        const res = await fetch(
          `${tbBaseUrl}/api/plugins/telemetry/USER/${uid}/values/attributes/SERVER_SCOPE?keys=gcdrUserConfigs`,
          { headers: { 'X-Authorization': `Bearer ${jwtToken}` } },
        );
        let cfg: GCDRUserConfigs | null = null;
        if (res.ok) {
          const attrs: Array<{ key: string; value: unknown }> = await res.json();
          const entry = attrs.find(a => a.key === 'gcdrUserConfigs');
          if (entry?.value && typeof entry.value === 'object') {
            cfg = entry.value as GCDRUserConfigs;
          }
        }
        this.gcdrConfigs.set(uid, cfg);
        this.updateSyncCell(uid, cfg ? (cfg.lastSyncResult ?? 'none') : 'none', cfg);
      } catch {
        this.updateSyncCell(uid, 'none', null);
      }
    }));
  }

  private updateSyncCell(
    userId: string,
    state: 'loading' | 'none' | 'success' | 'error' | 'syncing',
    cfg: GCDRUserConfigs | null = null,
  ): void {
    const iconEl = this.el?.querySelector<HTMLElement>(`.um-sync-icon[data-sync-uid="${userId}"]`);
    if (!iconEl) return;

    iconEl.className = 'um-sync-icon';

    if (state === 'loading' || state === 'syncing') {
      iconEl.innerHTML = `<span class="um-spinner" style="width:12px;height:12px;border-width:1.5px;display:block;margin:0 auto;"></span>`;
      return;
    }

    const gcdrStatus = cfg?.gcdrStatus;
    let dotClass = 'um-sync-dot--none';
    let dotTitle = 'Nunca sincronizado';

    if (state === 'success') {
      dotClass = gcdrStatus === 'ACTIVE' ? 'um-sync-dot--active'
        : gcdrStatus === 'INACTIVE' || gcdrStatus === 'LOCKED' ? 'um-sync-dot--warn'
        : 'um-sync-dot--ok';
      dotTitle = `GCDR: ${gcdrStatus ?? 'OK'}`;
    } else if (state === 'error') {
      dotClass = 'um-sync-dot--err';
      dotTitle = cfg?.lastError ?? 'Erro';
    }

    iconEl.innerHTML = `<span class="um-sync-dot ${dotClass}" title="${this.esc(dotTitle)}"></span>`;
  }

  private showSyncTooltip(user: TBUser, anchor: HTMLElement): void {
    this.hideSyncTooltip();
    const uid = user.id.id;
    const cfg = this.gcdrConfigs.get(uid);

    const tooltip = document.createElement('div');
    tooltip.className = 'um-sync-tooltip';
    tooltip.setAttribute('data-theme', this.config.theme || 'light');
    this.syncTooltipEl = tooltip;

    const syncing = this.gcdrSyncing.has(uid);
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

    let bodyHtml: string;
    if (syncing) {
      bodyHtml = `<div class="um-sync-tooltip-row" style="justify-content:center;padding:8px 0;">
        <span class="um-spinner" style="width:13px;height:13px;"></span>&nbsp;Sincronizando...
      </div>`;
    } else if (!cfg) {
      bodyHtml = `<div class="um-sync-tooltip-row um-sync-tooltip-row--muted">Nunca sincronizado com GCDR.</div>`;
    } else {
      const syncedAt = cfg.syncedAt ? new Date(cfg.syncedAt).toLocaleString('pt-BR') : '—';
      const updatedAt = cfg.updatedAt ? new Date(cfg.updatedAt).toLocaleString('pt-BR') : '—';
      const resultColor = cfg.lastSyncResult === 'success'
        ? 'var(--um-badge-active-text)' : 'var(--um-badge-blocked-text)';
      bodyHtml = `
        <div class="um-sync-tooltip-row">
          <span class="um-sync-tooltip-label">GCDR ID</span>
          <span class="um-sync-tooltip-value" style="font-family:monospace;font-size:10px;">${cfg.gcdrUserId ? cfg.gcdrUserId.slice(0, 16) + '…' : '—'}</span>
        </div>
        <div class="um-sync-tooltip-row">
          <span class="um-sync-tooltip-label">Status GCDR</span>
          <span class="um-sync-tooltip-value">${cfg.gcdrStatus ?? '—'}</span>
        </div>
        <div class="um-sync-tooltip-row">
          <span class="um-sync-tooltip-label">Último sync</span>
          <span class="um-sync-tooltip-value">${syncedAt}</span>
        </div>
        <div class="um-sync-tooltip-row">
          <span class="um-sync-tooltip-label">Atualizado</span>
          <span class="um-sync-tooltip-value">${updatedAt}</span>
        </div>
        <div class="um-sync-tooltip-row">
          <span class="um-sync-tooltip-label">Qtd syncs</span>
          <span class="um-sync-tooltip-value">${cfg.syncCount ?? 0}</span>
        </div>
        <div class="um-sync-tooltip-row">
          <span class="um-sync-tooltip-label">Resultado</span>
          <span class="um-sync-tooltip-value" style="color:${resultColor};font-weight:700;">${cfg.lastSyncResult === 'success' ? '✓ Sucesso' : '✗ Erro'}</span>
        </div>
        ${cfg.lastError ? `<div class="um-sync-tooltip-row um-sync-tooltip-row--error">
          <span class="um-sync-tooltip-label">Erro</span>
          <span class="um-sync-tooltip-value">${this.esc(cfg.lastError)}</span>
        </div>` : ''}
      `;
    }

    tooltip.innerHTML = `
      <div class="um-sync-tooltip-header">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        <span>GCDR Sync — ${this.esc(displayName)}</span>
      </div>
      <div class="um-sync-tooltip-body">${bodyHtml}</div>
    `;

    // Append inside backdrop so CSS vars are available
    const backdrop = this.el.closest<HTMLElement>('.um-backdrop') ?? document.body;
    backdrop.appendChild(tooltip);

    // Position near anchor
    const rect = anchor.getBoundingClientRect();
    const ttW = 260;
    let left = rect.right + 8;
    if (left + ttW > window.innerWidth - 8) left = rect.left - ttW - 8;
    tooltip.style.left = `${Math.max(4, left)}px`;
    tooltip.style.top = `${Math.max(4, rect.top - 10)}px`;
  }

  private hideSyncTooltip(): void {
    this.syncTooltipEl?.remove();
    this.syncTooltipEl = null;
  }

  private async syncUserToGCDR(user: TBUser): Promise<void> {
    const uid = user.id.id;
    if (this.gcdrSyncing.has(uid)) return;

    const base = this.gcdrBase();
    if (!base) {
      this.callbacks.showToast('GCDR não configurado.', 'error');
      return;
    }

    const gcdrCustomerId = (window as any).MyIOOrchestrator?.gcdrCustomerId || '';

    this.gcdrSyncing.add(uid);
    this.updateSyncCell(uid, 'syncing');

    const prev = this.gcdrConfigs.get(uid) ?? null;
    const syncCount = (prev?.syncCount ?? 0) + 1;
    const now = new Date().toISOString();

    try {
      // 1. Search GCDR by email
      const searchRes = await fetch(
        `${base}/users?search=${encodeURIComponent(user.email)}&customerId=${encodeURIComponent(gcdrCustomerId)}&limit=10`,
        { headers: this.gcdrHeaders() },
      );

      let gcdrUser: GCDRUser | null = null;
      if (searchRes.ok) {
        const data = await searchRes.json();
        const items: GCDRUser[] = Array.isArray(data)
          ? data
          : (data?.data?.items ?? data?.items ?? []);
        gcdrUser = items.find(u => u.email?.toLowerCase() === user.email.toLowerCase()) ?? null;
      }

      // 2. Create if not found
      if (!gcdrUser) {
        const externalLink: GCDRExternalLink = {
          system: 'thingsboard',
          externalId: user.id.id,
          status: 'synced',
          syncedAt: now,
          createdAt: now,
          updatedAt: now,
          version: 1,
        };
        const createRes = await fetch(`${base}/users`, {
          method: 'POST',
          headers: this.gcdrHeaders(),
          body: JSON.stringify({
            email: user.email,
            type: 'CUSTOMER',
            customerId: gcdrCustomerId,
            profile: {
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
              ...(user.phone ? { phone: user.phone } : {}),
            },
            externalLinks: [externalLink],
          }),
        });
        if (!createRes.ok) throw new Error(`Criar usuário GCDR: HTTP ${createRes.status}`);
        gcdrUser = await createRes.json() as GCDRUser;
      }

      // 3. Build and save gcdrUserConfigs to TB
      const configs: GCDRUserConfigs = {
        gcdrUserId: gcdrUser.id,
        gcdrStatus: gcdrUser.status,
        gcdrType: gcdrUser.type,
        syncedAt: now,
        syncCount,
        lastSyncResult: 'success',
        lastError: null,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };

      await this.saveTBAttribute(uid, configs);
      this.gcdrConfigs.set(uid, configs);
      this.updateSyncCell(uid, 'success', configs);
      this.callbacks.showToast(`Sync GCDR concluído — ${user.email}`, 'success');
    } catch (err: any) {
      const configs: GCDRUserConfigs = {
        ...(prev ?? {}),
        syncedAt: now,
        syncCount,
        lastSyncResult: 'error',
        lastError: String(err?.message ?? 'Erro desconhecido'),
        updatedAt: now,
      };
      try { await this.saveTBAttribute(uid, configs); } catch { /* best-effort */ }
      this.gcdrConfigs.set(uid, configs);
      this.updateSyncCell(uid, 'error', configs);
      this.callbacks.showToast(`Erro sync GCDR: ${err?.message || 'Falha'}`, 'error');
    } finally {
      this.gcdrSyncing.delete(uid);
    }
  }

  private async saveTBAttribute(userId: string, configs: GCDRUserConfigs): Promise<void> {
    const { tbBaseUrl, jwtToken } = this.config;
    const res = await fetch(
      `${tbBaseUrl}/api/plugins/telemetry/USER/${userId}/attributes/SERVER_SCOPE`,
      {
        method: 'POST',
        headers: {
          'X-Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gcdrUserConfigs: configs }),
      },
    );
    if (!res.ok) throw new Error(`Salvar atributo TB: HTTP ${res.status}`);
  }
}
