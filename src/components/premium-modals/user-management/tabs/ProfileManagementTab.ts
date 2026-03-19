import { UserManagementConfig } from '../types';

export class ProfileManagementTab {
  private config: UserManagementConfig;
  private el!: HTMLElement;

  constructor(config: UserManagementConfig) {
    this.config = config;
  }

  render(): HTMLElement {
    this.el = document.createElement('div');
    this.el.className = 'um-tab-content um-profiles';
    this.el.innerHTML = `
      <div class="um-profiles-header">
        <h3 class="um-profiles-title">Perfis configurados para este cliente</h3>
      </div>
      <div class="um-profiles-body">
        <div class="um-profiles-loading">
          <span class="um-spinner"></span> Carregando perfis...
        </div>
        <table class="um-table um-profiles-table" style="display:none">
          <thead>
            <tr>
              <th>Nome do Grupo</th>
              <th>Tipo</th>
              <th>Membros</th>
            </tr>
          </thead>
          <tbody class="um-profiles-tbody"></tbody>
        </table>
        <div class="um-profiles-empty" style="display:none">Nenhum perfil encontrado.</div>
        <div class="um-profiles-error" style="display:none"></div>
      </div>
      <div class="um-profiles-notice">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Edição de perfis estará disponível em versão futura.
      </div>
    `;

    this.loadGroups();
    return this.el;
  }

  private async loadGroups(): Promise<void> {
    const { tbBaseUrl, jwtToken, customerId } = this.config;
    const loadingEl = this.el.querySelector<HTMLElement>('.um-profiles-loading')!;
    const tableEl = this.el.querySelector<HTMLElement>('.um-profiles-table')!;
    const emptyEl = this.el.querySelector<HTMLElement>('.um-profiles-empty')!;
    const errorEl = this.el.querySelector<HTMLElement>('.um-profiles-error')!;
    const tbody = this.el.querySelector<HTMLElement>('.um-profiles-tbody')!;

    try {
      // Attempt to list entity groups of type USER for this customer
      const url = `${tbBaseUrl}/api/entityGroups/CUSTOMER/${customerId}/USER`;
      const res = await fetch(url, {
        headers: { 'X-Authorization': `Bearer ${jwtToken}` },
      });

      loadingEl.style.display = 'none';

      if (!res.ok) {
        // Groups API may not be available on all TB editions — show graceful message
        if (res.status === 403 || res.status === 404) {
          emptyEl.style.display = '';
          emptyEl.textContent = 'Gestão de grupos não disponível nesta edição do ThingsBoard.';
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const groups: any[] = await res.json();

      if (!groups || groups.length === 0) {
        emptyEl.style.display = '';
        return;
      }

      for (const g of groups) {
        const tr = document.createElement('tr');
        const memberCount = g.additionalInfo?.memberCount ?? '—';
        tr.innerHTML = `
          <td>${this.esc(g.name || '—')}</td>
          <td>USER_GROUP</td>
          <td>${memberCount}</td>
        `;
        tbody.appendChild(tr);
      }
      tableEl.style.display = '';
    } catch (err: any) {
      console.warn('[ProfileManagementTab] loadGroups error', err);
      loadingEl.style.display = 'none';
      errorEl.style.display = '';
      errorEl.textContent = 'Não foi possível carregar os perfis neste momento.';
    }
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
