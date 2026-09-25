import { UserManagementConfig, TBUser, TBUserPage, buildUserTabLabel, GCDRAssignment, UserAssignmentsResponse, GCDRUser, GCDRUserConfigs, GCDRExternalLink } from '../types';
import { MyIOToast } from '../../../../components/MyIOToast';
import { openConfirmDialog, openGenericModal } from '../../dialog';

export interface UserListCallbacks {
  onOpenUserDetail(user: TBUser, editMode?: boolean): void;
  onSwitchToNewUser(): void;
  /** @deprecated superseded by MyIOToast — kept on the interface for callers that still reference it. */
  showToast(msg: string, type?: 'success' | 'error'): void;
}

interface SpecialAttrs {
  isUserAdmin: boolean;
  isHolding: boolean;
  /** Best-effort "last altered" proxy — the newest `lastUpdateTs` among the isUserAdmin/isHolding
   *  SERVER_SCOPE attribute values, since ThingsBoard's USER entity itself has no updatedTime field. */
  lastUpdateTs: number | null;
}

type BulkAction = 'sync-gcdr' | 'block' | 'unblock' | 'enable-admin' | 'enable-holding';

const BULK_ACTION_LABELS: Record<BulkAction, string> = {
  'sync-gcdr': 'Sync GCDR',
  block: 'Bloquear todos',
  unblock: 'Liberar todos',
  'enable-admin': 'Habilitar Admin User Attr. para todos',
  'enable-holding': 'Habilitar Holding User Attr. para todos',
};

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

  // Special attrs (isUserAdmin/isHolding) per user, batch-loaded like gcdrConfigs.
  private specialAttrs = new Map<string, SpecialAttrs>();

  // Row selection for bulk actions.
  private selectedIds = new Set<string>();

  // Client-side filter (applied over the already-fetched page — default: everything shown).
  private filterStatuses = new Set<'active' | 'blocked'>(['active', 'blocked']);
  private filterProfiles = new Set<'admin' | 'user'>(['admin', 'user']);

  // Client-side sort — re-applied on every render, independent of fetch order.
  private sortColumn: 'name' | 'createdTime' | 'updatedAt' = 'name';
  private sortDirection: 'asc' | 'desc' = 'asc';

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
        <button class="um-btn um-btn--ghost um-btn--sm um-filter-btn" title="Filtrar por status e perfil">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filtros
        </button>
        <button class="um-btn um-btn--secondary um-btn--sm um-bulk-actions-btn" style="display:none;">Ações em Lote</button>
        <button class="um-btn um-btn--primary um-btn--sm um-new-user-btn">+ Novo Usuário</button>
      </div>
      <div class="um-table-wrap">
        <table class="um-table">
          <thead>
            <tr>
              <th class="um-col-check"><input type="checkbox" class="um-select-all-chk" title="Selecionar todos" /></th>
              <th class="um-col-sortable" data-sort-key="name">Nome<span class="um-sort-arrow"></span></th>
              <th>PERFIL (TB)</th>
              <th>Status</th>
              <th>Adm User Attr.</th>
              <th>Holding User Attr.</th>
              <th class="um-col-sortable" data-sort-key="createdTime">Criado em<span class="um-sort-arrow"></span></th>
              <th class="um-col-sortable" data-sort-key="updatedAt">Alterado em<span class="um-sort-arrow"></span></th>
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

    this.el.querySelector('.um-filter-btn')!.addEventListener('click', () => this.openFilterModal());
    this.el.querySelector('.um-bulk-actions-btn')!.addEventListener('click', () => this.openBulkActionsModal());
    this.el.querySelector<HTMLInputElement>('.um-select-all-chk')!.addEventListener('change', (e) => {
      this.toggleSelectAll((e.currentTarget as HTMLInputElement).checked);
    });
    this.el.querySelectorAll<HTMLElement>('.um-col-sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sortKey as 'name' | 'createdTime' | 'updatedAt';
        if (this.sortColumn === key) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumn = key;
          this.sortDirection = 'asc';
        }
        this.renderRows();
      });
    });

    this.fetchUsers();
    return this.el;
  }

  /** Sorts (in place on a copy) by the current column/direction — re-applied on every render. */
  private sortUsers(list: TBUser[]): TBUser[] {
    const dir = this.sortDirection === 'asc' ? 1 : -1;
    return list.slice().sort((a, b) => {
      let cmp = 0;
      if (this.sortColumn === 'name') {
        cmp = this.displayName(a).localeCompare(this.displayName(b), 'pt-BR');
      } else if (this.sortColumn === 'createdTime') {
        cmp = (a.createdTime || 0) - (b.createdTime || 0);
      } else {
        const av = this.specialAttrs.get(a.id.id)?.lastUpdateTs || 0;
        const bv = this.specialAttrs.get(b.id.id)?.lastUpdateTs || 0;
        cmp = av - bv;
      }
      return cmp * dir;
    });
  }

  /** Reflects `sortColumn`/`sortDirection` as an arrow on the active header, clearing the others. */
  private updateSortArrows(): void {
    this.el.querySelectorAll<HTMLElement>('.um-col-sortable').forEach((th) => {
      const arrow = th.querySelector<HTMLElement>('.um-sort-arrow');
      if (!arrow) return;
      arrow.textContent = th.dataset.sortKey === this.sortColumn ? (this.sortDirection === 'asc' ? '▲' : '▼') : '';
    });
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
      this.selectedIds.clear();
      this.renderRows();
      this.renderPagination(page);
      this.fetchGcdrConfigsBatch();
      this.fetchSpecialAttrsBatch();
    } catch (err: any) {
      console.error('[UserListTab] fetchUsers error', err);
      MyIOToast.error('Erro ao carregar usuários. Tente novamente.');
    } finally {
      this.loading = false;
      this.setLoading(false);
    }
  }

  private displayName(user: TBUser): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  }

  private isUserEnabled(user: TBUser): boolean {
    return (user.additionalInfo as any)?.userCredentialsEnabled !== false;
  }

  /** Users matching the current client-side filter (default: everything), sorted by the active column. */
  private getFilteredUsers(): TBUser[] {
    const filtered = this.users.filter((u) => {
      const statusKey = this.isUserEnabled(u) ? 'active' : 'blocked';
      const profileKey = u.authority === 'TENANT_ADMIN' ? 'admin' : 'user';
      return this.filterStatuses.has(statusKey) && this.filterProfiles.has(profileKey);
    });
    return this.sortUsers(filtered);
  }

  private formatDate(ts: number | null | undefined): string {
    return ts ? new Date(ts).toLocaleString('pt-BR') : '—';
  }

  private renderRows(): void {
    const tbody = this.el.querySelector<HTMLElement>('.um-tbody')!;
    const empty = this.el.querySelector<HTMLElement>('.um-list-empty')!;
    tbody.innerHTML = '';
    this.updateSortArrows();

    const visibleUsers = this.getFilteredUsers();

    if (visibleUsers.length === 0) {
      empty.style.display = '';
      this.updateSelectAllCheckbox();
      return;
    }
    empty.style.display = 'none';

    for (const user of visibleUsers) {
      const tr = document.createElement('tr');
      tr.dataset.userId = user.id.id;
      if (this.highlightedUserId === user.id.id) {
        tr.classList.add('um-row--highlight');
        this.highlightedUserId = null;
      }
      const name = this.displayName(user);
      const role = user.authority === 'TENANT_ADMIN' ? 'Admin' : 'Usuário';
      const enabled = this.isUserEnabled(user);
      const uid = user.id.id;
      const special = this.specialAttrs.get(uid);
      tr.innerHTML = `
        <td class="um-col-check"><input type="checkbox" class="um-row-chk" ${this.selectedIds.has(uid) ? 'checked' : ''} /></td>
        <td>
          <div>${this.esc(name)}</div>
          <div style="font-size:11px;color:var(--um-text-faint);margin-top:2px;">${this.esc(user.email)}</div>
        </td>
        <td><span class="um-badge um-badge--${user.authority === 'TENANT_ADMIN' ? 'admin' : 'user'}">${role}</span></td>
        <td>
          <button type="button" class="um-badge um-badge--${enabled ? 'active' : 'blocked'} um-status-toggle-btn"
                  style="border:none;cursor:pointer;" title="Clique para ${enabled ? 'bloquear' : 'liberar'}">
            ${enabled ? 'Ativo' : 'Bloqueado'}
          </button>
        </td>
        <td>
          <span class="gm-toggle">
            <input type="checkbox" class="gm-toggle-input um-special-attr-toggle" data-attr="isUserAdmin" ${special?.isUserAdmin ? 'checked' : ''} ${special ? '' : 'disabled'} />
            <span class="gm-toggle-slider"></span>
          </span>
        </td>
        <td>
          <span class="gm-toggle">
            <input type="checkbox" class="gm-toggle-input um-special-attr-toggle" data-attr="isHolding" ${special?.isHolding ? 'checked' : ''} ${special ? '' : 'disabled'} />
            <span class="gm-toggle-slider"></span>
          </span>
        </td>
        <td style="font-size:12px;white-space:nowrap;">${user.createdTime ? this.formatDate(user.createdTime) : '—'}</td>
        <td style="font-size:12px;white-space:nowrap;" class="um-col-updated-at">${special ? this.formatDate(special.lastUpdateTs) : '—'}</td>
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
      tr.querySelector('.um-status-toggle-btn')!.addEventListener('click', (e) => this.toggleUserBlocked(user, e.currentTarget as HTMLElement));
      tr.querySelector<HTMLInputElement>('.um-row-chk')!.addEventListener('change', (e) => {
        this.toggleRowSelection(uid, (e.currentTarget as HTMLInputElement).checked);
      });
      tr.querySelectorAll<HTMLInputElement>('.um-special-attr-toggle').forEach((toggle) => {
        toggle.addEventListener('change', (e) => {
          const target = e.currentTarget as HTMLInputElement;
          const attr = target.dataset.attr as 'isUserAdmin' | 'isHolding';
          this.handleSpecialAttrChange(user, attr, target.checked, target);
        });
      });
      const syncIcon = tr.querySelector<HTMLElement>('.um-sync-icon')!;
      syncIcon.addEventListener('mouseenter', (e) => this.showSyncTooltip(user, e.currentTarget as HTMLElement));
      syncIcon.addEventListener('mouseleave', () => this.hideSyncTooltip());
      tbody.appendChild(tr);
    }

    this.updateSelectAllCheckbox();
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

  private async showAssignmentsPopup(user: TBUser, anchor: HTMLElement): Promise<void> {
    // Remove any existing popup
    document.querySelector('.um-assign-popup')?.remove();

    const popup = document.createElement('div');
    popup.className = 'um-assign-popup';
    popup.setAttribute('data-theme', this.config.theme || 'light');

    const displayName = this.displayName(user);
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
    const displayName = this.displayName(user);

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
      MyIOToast.error('GCDR não configurado.');
      return;
    }

    const gcdrCustomerId = (window as any).MyIOOrchestrator?.gcdrCustomerId || '';
    if (!gcdrCustomerId) {
      MyIOToast.error('GCDR customer ID não configurado. Tente novamente em instantes.');
      return;
    }

    const now = new Date().toISOString();
    this.gcdrSyncing.add(uid);
    this.updateSyncCell(uid, 'syncing');

    const prev = this.gcdrConfigs.get(uid) ?? null;
    const syncCount = (prev?.syncCount ?? 0) + 1;

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
          version: syncCount,
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
              displayName: this.displayName(user),
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
      MyIOToast.success(`Sync GCDR concluído — ${user.email}`);
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
      MyIOToast.error(`Erro sync GCDR: ${err?.message || 'Falha'}`);
      throw err; // re-thrown so bulk-action callers can count it as a failure
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

  // ── Special attrs column (isUserAdmin / isHolding) ────────────────────────

  private async fetchSpecialAttrsBatch(): Promise<void> {
    if (this.users.length === 0) return;
    const { tbBaseUrl, jwtToken } = this.config;

    await Promise.allSettled(this.users.map(async (user) => {
      const uid = user.id.id;
      try {
        const res = await fetch(
          `${tbBaseUrl}/api/plugins/telemetry/USER/${uid}/values/attributes/SERVER_SCOPE?keys=isUserAdmin,isHolding`,
          { headers: { 'X-Authorization': `Bearer ${jwtToken}` } },
        );
        let attrs: SpecialAttrs = { isUserAdmin: false, isHolding: false, lastUpdateTs: null };
        if (res.ok) {
          const raw: Array<{ key: string; value: unknown; lastUpdateTs?: number }> = await res.json();
          const adm = raw.find((a) => a.key === 'isUserAdmin');
          const hold = raw.find((a) => a.key === 'isHolding');
          attrs = {
            isUserAdmin: adm?.value === true,
            isHolding: hold?.value === true,
            lastUpdateTs: Math.max(adm?.lastUpdateTs ?? 0, hold?.lastUpdateTs ?? 0) || null,
          };
        }
        this.specialAttrs.set(uid, attrs);
        this.updateSpecialAttrCells(uid, attrs);
      } catch {
        // leave selects disabled/blank for this row — non-fatal
      }
    }));
  }

  private updateSpecialAttrCells(userId: string, attrs: SpecialAttrs): void {
    const tr = this.el?.querySelector<HTMLElement>(`tr[data-user-id="${userId}"]`);
    if (!tr) return;
    tr.querySelectorAll<HTMLSelectElement>('.um-special-attr-select').forEach((sel) => {
      const attr = sel.dataset.attr as 'isUserAdmin' | 'isHolding';
      sel.value = String(attrs[attr]);
      sel.disabled = false;
    });
    const updatedCell = tr.querySelector<HTMLElement>('.um-col-updated-at');
    if (updatedCell) updatedCell.textContent = this.formatDate(attrs.lastUpdateTs);
  }

  private async handleSpecialAttrChange(
    user: TBUser,
    attr: 'isUserAdmin' | 'isHolding',
    newValue: boolean,
    toggleEl: HTMLInputElement,
  ): Promise<void> {
    const prevValue = this.specialAttrs.get(user.id.id)?.[attr] ?? false;
    if (prevValue === newValue) return;

    const attrLabel = attr === 'isUserAdmin' ? 'Adm User Attr.' : 'Holding User Attr.';
    const confirmed = await openConfirmDialog({
      title: 'Confirmar alteração',
      message: `Definir "${attrLabel}" = ${newValue} para ${this.displayName(user)}?`,
      buttons: [
        { label: 'Cancelar', value: 'cancel', variant: 'secondary' },
        { label: 'Confirmar', value: 'confirm', variant: 'primary', autoFocus: true },
      ],
      theme: this.config.theme,
      container: this.dialogContainer(),
    });

    if (confirmed !== 'confirm') {
      toggleEl.checked = prevValue;
      return;
    }

    try {
      await this.saveSpecialAttrRaw(user.id.id, attr, newValue);
      const current = this.specialAttrs.get(user.id.id) ?? { isUserAdmin: false, isHolding: false, lastUpdateTs: null };
      current[attr] = newValue;
      current.lastUpdateTs = Date.now();
      this.specialAttrs.set(user.id.id, current);
      this.updateSpecialAttrCells(user.id.id, current);
      MyIOToast.success(`${attrLabel} atualizado para ${this.displayName(user)}.`);
    } catch (err: any) {
      toggleEl.checked = prevValue;
      MyIOToast.error(`Erro ao salvar ${attrLabel}: ${err?.message || 'falha'}`);
    }
  }

  /**
   * `.um-backdrop` renders at z-index 99999 — above openConfirmDialog/
   * openGenericModal's own baseline (10500/10600), so nested dialogs opened
   * with the default container (document.body) would paint BEHIND it.
   * Passing this modal's own backdrop as `container` makes the nested dialog
   * a descendant of the already-elevated stacking context instead, so it
   * naturally renders above the rest of `.um-modal` regardless of the
   * absolute z-index values involved.
   */
  private dialogContainer(): HTMLElement | undefined {
    return (this.el.closest('.um-backdrop') as HTMLElement | null) || undefined;
  }

  private async saveSpecialAttrRaw(userId: string, attr: 'isUserAdmin' | 'isHolding', value: boolean): Promise<void> {
    const { tbBaseUrl, jwtToken } = this.config;
    const res = await fetch(`${tbBaseUrl}/api/plugins/telemetry/USER/${userId}/SERVER_SCOPE`, {
      method: 'POST',
      headers: { 'X-Authorization': `Bearer ${jwtToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [attr]: value }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  // ── Block / unblock (ThingsBoard user credentials) ────────────────────────

  private async setUserEnabled(userId: string, enabled: boolean): Promise<void> {
    const { tbBaseUrl, jwtToken } = this.config;
    const headers = { 'X-Authorization': `Bearer ${jwtToken}` };
    const getRes = await fetch(`${tbBaseUrl}/api/user/${userId}/credentials`, { headers });
    if (!getRes.ok) throw new Error(`Buscar credenciais: HTTP ${getRes.status}`);
    const credentials = await getRes.json();
    credentials.enabled = enabled;
    const postRes = await fetch(`${tbBaseUrl}/api/user/credentials`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!postRes.ok) throw new Error(`Salvar credenciais: HTTP ${postRes.status}`);
  }

  private async toggleUserBlocked(user: TBUser, _btn: HTMLElement): Promise<void> {
    const enabled = this.isUserEnabled(user);
    const newEnabled = !enabled;
    const name = this.displayName(user);
    const confirmed = await openConfirmDialog({
      title: newEnabled ? 'Liberar usuário' : 'Bloquear usuário',
      message: `${newEnabled ? 'Liberar' : 'Bloquear'} o acesso de "${name}"?`,
      buttons: [
        { label: 'Cancelar', value: 'cancel', variant: 'secondary' },
        { label: newEnabled ? 'Liberar' : 'Bloquear', value: 'confirm', variant: newEnabled ? 'success' : 'danger', autoFocus: true },
      ],
      theme: this.config.theme,
      container: this.dialogContainer(),
    });
    if (confirmed !== 'confirm') return;

    try {
      await this.setUserEnabled(user.id.id, newEnabled);
      if (!user.additionalInfo) user.additionalInfo = {};
      (user.additionalInfo as any).userCredentialsEnabled = newEnabled;
      MyIOToast.success(`Usuário ${newEnabled ? 'liberado' : 'bloqueado'}.`);
      this.renderRows();
    } catch (err: any) {
      MyIOToast.error(`Erro ao ${newEnabled ? 'liberar' : 'bloquear'} usuário: ${err?.message || 'falha'}`);
    }
  }

  // ── Row selection & bulk actions ───────────────────────────────────────────

  private toggleRowSelection(userId: string, checked: boolean): void {
    if (checked) this.selectedIds.add(userId);
    else this.selectedIds.delete(userId);
    this.updateBulkActionsVisibility();
    this.updateSelectAllCheckbox();
  }

  private toggleSelectAll(checked: boolean): void {
    const visible = this.getFilteredUsers();
    if (checked) visible.forEach((u) => this.selectedIds.add(u.id.id));
    else visible.forEach((u) => this.selectedIds.delete(u.id.id));
    this.el.querySelectorAll<HTMLInputElement>('.um-row-chk').forEach((chk) => { chk.checked = checked; });
    this.updateBulkActionsVisibility();
  }

  private updateSelectAllCheckbox(): void {
    const selectAll = this.el?.querySelector<HTMLInputElement>('.um-select-all-chk');
    if (!selectAll) return;
    const visible = this.getFilteredUsers();
    const allSelected = visible.length > 0 && visible.every((u) => this.selectedIds.has(u.id.id));
    const someSelected = visible.some((u) => this.selectedIds.has(u.id.id));
    selectAll.checked = allSelected;
    selectAll.indeterminate = someSelected && !allSelected;
  }

  private updateBulkActionsVisibility(): void {
    const btn = this.el?.querySelector<HTMLButtonElement>('.um-bulk-actions-btn');
    if (!btn) return;
    if (this.selectedIds.size > 0) {
      btn.style.display = '';
      btn.textContent = `Ações em Lote (${this.selectedIds.size})`;
    } else {
      btn.style.display = 'none';
    }
  }

  private openBulkActionsModal(): void {
    if (this.selectedIds.size === 0) return;
    const count = this.selectedIds.size;
    const actions: BulkAction[] = ['sync-gcdr', 'block', 'unblock', 'enable-admin', 'enable-holding'];
    const bodyHtml = `
      <p style="margin:0 0 12px;font-size:13px;color:#374151;">${count} usuário(s) selecionado(s). Escolha uma ação:</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${actions.map((a) => `<button type="button" class="myio-genmodal__btn myio-genmodal__btn--secondary um-bulk-action-option" data-action="${a}" style="width:100%;text-align:left;">${BULK_ACTION_LABELS[a]}</button>`).join('')}
      </div>
    `;
    const modal = openGenericModal({
      title: 'Ações em Lote',
      icon: '⚡',
      bodyHtml,
      theme: this.config.theme,
      width: 420,
      container: this.dialogContainer(),
    });
    modal.getBodyEl().querySelectorAll<HTMLButtonElement>('.um-bulk-action-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action as BulkAction;
        modal.close();
        this.runBulkAction(action);
      });
    });
  }

  private async runBulkAction(action: BulkAction): Promise<void> {
    const users = this.users.filter((u) => this.selectedIds.has(u.id.id));
    if (users.length === 0) return;

    const confirmed = await openConfirmDialog({
      title: 'Confirmar ação em lote',
      message: `Aplicar "${BULK_ACTION_LABELS[action]}" a ${users.length} usuário(s) selecionado(s)?`,
      buttons: [
        { label: 'Cancelar', value: 'cancel', variant: 'secondary' },
        { label: 'Confirmar', value: 'confirm', variant: action === 'block' ? 'danger' : 'primary', autoFocus: true },
      ],
      theme: this.config.theme,
      container: this.dialogContainer(),
    });
    if (confirmed !== 'confirm') return;

    let okCount = 0;
    const errors: string[] = [];
    for (const user of users) {
      try {
        if (action === 'sync-gcdr') await this.syncUserToGCDR(user);
        else if (action === 'block') await this.setUserEnabled(user.id.id, false);
        else if (action === 'unblock') await this.setUserEnabled(user.id.id, true);
        else if (action === 'enable-admin') await this.saveSpecialAttrRaw(user.id.id, 'isUserAdmin', true);
        else if (action === 'enable-holding') await this.saveSpecialAttrRaw(user.id.id, 'isHolding', true);
        okCount++;
      } catch (err: any) {
        errors.push(`${user.email}: ${err?.message || 'erro'}`);
      }
    }

    if (errors.length === 0) {
      MyIOToast.success(`"${BULK_ACTION_LABELS[action]}" aplicada a ${okCount} usuário(s).`);
    } else {
      MyIOToast.error(`${okCount} de ${users.length} concluído(s). Falhas: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '…' : ''}`);
    }

    this.selectedIds.clear();
    this.fetchUsers();
  }

  // ── Filter modal ────────────────────────────────────────────────────────────

  private openFilterModal(): void {
    const statusOptions: Array<{ key: 'active' | 'blocked'; label: string }> = [
      { key: 'active', label: 'Ativo' },
      { key: 'blocked', label: 'Bloqueado' },
    ];
    const profileOptions: Array<{ key: 'admin' | 'user'; label: string }> = [
      { key: 'admin', label: 'Admin (TB)' },
      { key: 'user', label: 'Usuário (TB)' },
    ];

    const bodyHtml = `
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:8px;">Status</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${statusOptions.map((o) => `
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
              <input type="checkbox" class="um-filter-status-chk" value="${o.key}" ${this.filterStatuses.has(o.key) ? 'checked' : ''} />
              ${o.label}
            </label>`).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:8px;">PERFIL (TB)</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${profileOptions.map((o) => `
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
              <input type="checkbox" class="um-filter-profile-chk" value="${o.key}" ${this.filterProfiles.has(o.key) ? 'checked' : ''} />
              ${o.label}
            </label>`).join('')}
        </div>
      </div>
    `;

    const modal = openGenericModal({
      title: 'Filtros',
      icon: '🔽',
      bodyHtml,
      theme: this.config.theme,
      width: 320,
      container: this.dialogContainer(),
      buttons: [
        { label: 'Cancelar', value: 'cancel', variant: 'secondary' },
        { label: 'Aplicar', value: 'apply', variant: 'primary', autoFocus: true, closeOnClick: false },
      ],
      onButton: (value) => {
        if (value !== 'apply') { modal.close(); return; }
        const body = modal.getBodyEl();
        const statuses = Array.from(body.querySelectorAll<HTMLInputElement>('.um-filter-status-chk:checked')).map((c) => c.value as 'active' | 'blocked');
        const profiles = Array.from(body.querySelectorAll<HTMLInputElement>('.um-filter-profile-chk:checked')).map((c) => c.value as 'admin' | 'user');
        this.filterStatuses = new Set(statuses.length ? statuses : ['active', 'blocked']);
        this.filterProfiles = new Set(profiles.length ? profiles : ['admin', 'user']);
        this.renderRows();
        modal.close();
      },
    });
  }
}
