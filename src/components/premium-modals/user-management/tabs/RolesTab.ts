/**
 * RFC-0197: Roles tab for UserManagementModal.
 * Lists GCDR roles with their associated policies. Super-admins can create, edit and delete.
 */
import { UserManagementConfig, GCDRRole, GCDRPolicy } from '../types';

export interface RolesTabCallbacks {
  showToast(msg: string, type?: 'success' | 'error'): void;
}

export class RolesTab {
  private config: UserManagementConfig;
  private callbacks: RolesTabCallbacks;
  private el!: HTMLElement;
  private roles: GCDRRole[] = [];
  private policies: GCDRPolicy[] = [];
  private expandedId: string | null = null;

  constructor(config: UserManagementConfig, callbacks: RolesTabCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  private get isSuperAdmin(): boolean {
    const email = this.config.currentUser?.email || '';
    return email.endsWith('@myio.com.br') && !email.startsWith('alarme@') && !email.startsWith('alarmes@');
  }

  private gcdrBase(): string {
    return ((window as any).MyIOOrchestrator?.gcdrApiBaseUrl || 'https://gcdr-api.a.myio-bas.com').concat('/api/v1');
  }

  private gcdrHeaders(): Record<string, string> {
    const orch = (window as any).MyIOOrchestrator;
    return {
      'Content-Type': 'application/json',
      'X-API-Key': orch?.gcdrApiKey || '',
      'X-Tenant-ID': orch?.gcdrTenantId || '',
    };
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

  render(): HTMLElement {
    this.el = document.createElement('div');
    this.el.className = 'um-tab-content';
    this.el.innerHTML = `<div class="gm-loading"><div class="um-spinner"></div>&nbsp;Carregando funções...</div>`;
    this.loadAll();
    return this.el;
  }

  private async loadAll(): Promise<void> {
    try {
      const [rolesRes, policiesRes] = await Promise.all([
        fetch(`${this.gcdrBase()}/roles?limit=100`, { headers: this.gcdrHeaders() }),
        fetch(`${this.gcdrBase()}/policies?limit=100`, { headers: this.gcdrHeaders() }),
      ]);
      if (!rolesRes.ok) throw new Error(`roles HTTP ${rolesRes.status}`);
      this.roles = this.unwrapList<GCDRRole>(await rolesRes.json());
      if (policiesRes.ok) this.policies = this.unwrapList<GCDRPolicy>(await policiesRes.json());
      this.renderList();
    } catch (err) {
      console.error('[RolesTab] loadAll error', err);
      this.el.innerHTML = `<div class="gm-error">Erro ao carregar funções. Verifique a conexão com o GCDR.</div>`;
    }
  }

  private renderList(): void {
    this.el.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;';
    header.innerHTML = `<h3 style="margin:0;font-size:14px;font-weight:600;color:var(--um-text-secondary);">🎭 Funções (Roles)</h3>`;

    if (this.isSuperAdmin) {
      const btn = document.createElement('button');
      btn.className = 'um-btn um-btn--secondary um-btn--sm';
      btn.textContent = '+ Nova Função';
      btn.addEventListener('click', () => this.showRoleForm(null));
      header.appendChild(btn);
    } else {
      header.insertAdjacentHTML('beforeend',
        `<span style="font-size:11px;color:var(--um-text-muted);padding:4px 10px;background:var(--um-notice-bg);border:1px solid var(--um-notice-border);border-radius:6px;">👁️ Somente leitura</span>`);
    }
    this.el.appendChild(header);

    if (this.roles.length === 0) {
      this.el.insertAdjacentHTML('beforeend', `<div class="gm-empty">Nenhuma função encontrada.</div>`);
      return;
    }

    const accordion = document.createElement('div');
    accordion.className = 'gm-groups-accordion';
    this.roles.forEach(r => accordion.appendChild(this.buildRoleItem(r)));
    this.el.appendChild(accordion);
  }

  private buildRoleItem(r: GCDRRole): HTMLElement {
    const item = document.createElement('div');
    item.className = `gm-accordion-item${this.expandedId === r.id ? ' gm-accordion-item--open' : ''}`;

    const sysBadge = r.system ? `<span class="gm-badge gm-badge--count">SISTEMA</span>` : '';
    const policyCount = r.policyIds?.length || 0;
    const policyBadge = `<span class="gm-badge gm-badge--domain">${policyCount} políticas</span>`;

    item.innerHTML = `
      <div class="gm-accordion-header">
        <button class="gm-accordion-toggle"><span class="gm-accordion-arrow">▶</span></button>
        <div class="gm-accordion-meta">
          <div class="gm-group-name">${this.esc(r.name)}</div>
          ${r.description ? `<div class="gm-group-code">${this.esc(r.description)}</div>` : ''}
        </div>
        <div class="gm-accordion-badges">${policyBadge}${sysBadge}</div>
        ${this.isSuperAdmin && !r.system ? `<div class="gm-accordion-actions">
          <button class="um-icon-btn gm-edit-btn" title="Editar">✏️</button>
          <button class="um-icon-btn gm-delete-btn" title="Excluir">🗑️</button>
        </div>` : ''}
      </div>
      <div class="gm-accordion-panel" style="display:${this.expandedId === r.id ? '' : 'none'}">
        ${this.buildRolePoliciesHtml(r)}
      </div>
    `;

    const hdr = item.querySelector<HTMLElement>('.gm-accordion-header')!;
    const panel = item.querySelector<HTMLElement>('.gm-accordion-panel')!;
    hdr.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.gm-accordion-actions')) return;
      const open = item.classList.toggle('gm-accordion-item--open');
      panel.style.display = open ? '' : 'none';
      this.expandedId = open ? r.id : null;
    });

    if (this.isSuperAdmin && !r.system) {
      item.querySelector('.gm-edit-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showRoleForm(r);
      });
      item.querySelector('.gm-delete-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteRole(r);
      });
    }

    return item;
  }

  private buildRolePoliciesHtml(r: GCDRRole): string {
    if (!r.policyIds?.length) {
      return `<div class="gm-panel-section"><span class="gm-empty-inline">Nenhuma política associada.</span></div>`;
    }
    const policyMap = new Map(this.policies.map(p => [p.id, p]));
    const items = r.policyIds.map(pid => {
      const p = policyMap.get(pid);
      if (!p) return `<div style="font-size:12px;color:var(--um-text-faint);padding:3px 0;">ID: ${this.esc(pid)}</div>`;
      const allowStr = p.allow?.join(', ') || '—';
      return `<div style="padding:6px 0;border-bottom:1px solid var(--um-border-sub);">
        <div style="font-size:12px;font-weight:600;color:var(--um-text-secondary);">${this.esc(p.name)}</div>
        ${p.description ? `<div style="font-size:11px;color:var(--um-text-faint);">${this.esc(p.description)}</div>` : ''}
        <div style="font-size:11px;color:var(--um-badge-user-text);margin-top:2px;">allow: ${this.esc(allowStr)}</div>
      </div>`;
    }).join('');
    return `<div class="gm-panel-section">
      <div class="gm-panel-section-header"><span class="gm-panel-section-title">📋 Políticas</span></div>
      ${items}
    </div>`;
  }

  private showRoleForm(existing: GCDRRole | null): void {
    const isEdit = existing !== null;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:100001;';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--um-modal-bg,#131929);border:1px solid var(--um-border,#2a3352);border-radius:12px;padding:24px;width:min(520px,92vw);max-height:80vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.5);';

    const policiesCheckboxes = this.policies.map(p => {
      const checked = existing?.policyIds?.includes(p.id) ? ' checked' : '';
      return `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--um-text-secondary);cursor:pointer;">
        <input type="checkbox" class="um-role-policy-chk" value="${this.esc(p.id)}"${checked} />
        ${this.esc(p.name)}${p.description ? ` <span style="color:var(--um-text-faint);">— ${this.esc(p.description)}</span>` : ''}
      </label>`;
    }).join('');

    modal.innerHTML = `
      <h4 style="margin:0 0 16px;font-size:15px;font-weight:600;color:var(--um-text-primary,#e2e8f0);">${isEdit ? 'Editar' : 'Nova'} Função</h4>
      <div class="um-form" style="max-width:100%;">
        <div class="um-form-group">
          <label class="um-label">Nome <span class="um-req">*</span></label>
          <input class="um-input" name="name" value="${this.esc(existing?.name || '')}" autocomplete="off" />
          <span class="um-field-error" data-for="name"></span>
        </div>
        <div class="um-form-group">
          <label class="um-label">Descrição</label>
          <input class="um-input" name="description" value="${this.esc(existing?.description || '')}" autocomplete="off" />
        </div>
        ${this.policies.length ? `<div class="um-form-group">
          <label class="um-label">Políticas Associadas</label>
          <div style="background:var(--um-bg-surface);border:1px solid var(--um-border);border-radius:8px;padding:10px;max-height:200px;overflow-y:auto;">
            ${policiesCheckboxes || '<span style="font-size:12px;color:var(--um-text-faint);">Nenhuma política disponível.</span>'}
          </div>
        </div>` : ''}
        <div class="um-form-actions">
          <button class="um-btn um-btn--ghost role-cancel">Cancelar</button>
          <button class="um-btn um-btn--primary role-save">${isEdit ? 'Salvar' : 'Criar'}</button>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    modal.querySelector('.role-cancel')!.addEventListener('click', close);
    modal.querySelector('.role-save')!.addEventListener('click', async () => {
      const name = (modal.querySelector<HTMLInputElement>('[name=name]')!.value).trim();
      const errEl = modal.querySelector<HTMLElement>('[data-for=name]')!;
      if (!name) { errEl.textContent = 'Nome obrigatório.'; return; }
      errEl.textContent = '';

      const description = (modal.querySelector<HTMLInputElement>('[name=description]')!.value).trim();
      const policyIds = Array.from(modal.querySelectorAll<HTMLInputElement>('.um-role-policy-chk:checked')).map(c => c.value);

      const btn = modal.querySelector<HTMLButtonElement>('.role-save')!;
      btn.disabled = true; btn.textContent = '...';
      try {
        const body = { name, description: description || undefined, policyIds };
        const url = isEdit ? `${this.gcdrBase()}/roles/${existing!.id}` : `${this.gcdrBase()}/roles`;
        const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: this.gcdrHeaders(), body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.callbacks.showToast(isEdit ? 'Função atualizada!' : 'Função criada!', 'success');
        close();
        await this.loadAll();
      } catch (err) {
        console.error('[RolesTab] save error', err);
        this.callbacks.showToast('Erro ao salvar função.', 'error');
        btn.disabled = false; btn.textContent = isEdit ? 'Salvar' : 'Criar';
      }
    });
  }

  private async deleteRole(r: GCDRRole): Promise<void> {
    if (!confirm(`Excluir a função "${r.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`${this.gcdrBase()}/roles/${r.id}`, { method: 'DELETE', headers: this.gcdrHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.callbacks.showToast('Função excluída.', 'success');
      await this.loadAll();
    } catch (err) {
      console.error('[RolesTab] delete error', err);
      this.callbacks.showToast('Erro ao excluir função.', 'error');
    }
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
