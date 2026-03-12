import { UserManagementConfig, TBUser, TBUserPage, buildUserTabLabel } from '../types';

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
      tr.innerHTML = `
        <td>${this.esc(name)}</td>
        <td>${this.esc(user.email)}</td>
        <td><span class="um-badge um-badge--${user.authority === 'TENANT_ADMIN' ? 'admin' : 'user'}">${role}</span></td>
        <td class="um-col-actions">
          <button class="um-icon-btn um-edit-btn" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="um-icon-btn um-view-btn" title="Ver Detalhes">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </td>
      `;
      tr.querySelector('.um-edit-btn')!.addEventListener('click', () => this.callbacks.onOpenUserDetail(user, true));
      tr.querySelector('.um-view-btn')!.addEventListener('click', () => this.callbacks.onOpenUserDetail(user, false));
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

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
