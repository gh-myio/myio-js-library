/**
 * RFC-0197: Permission Policies tab for UserManagementModal.
 * Lists GCDR permission policies. Super-admins can create, edit and delete.
 */
import { UserManagementConfig, GCDRPolicy } from '../types';

export interface PoliciesTabCallbacks {
  showToast(msg: string, type?: 'success' | 'error'): void;
}

export class PoliciesTab {
  private config: UserManagementConfig;
  private callbacks: PoliciesTabCallbacks;
  private el!: HTMLElement;
  private policies: GCDRPolicy[] = [];
  private expandedId: string | null = null;

  constructor(config: UserManagementConfig, callbacks: PoliciesTabCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  private get isSuperAdmin(): boolean {
    const email = this.config.currentUser?.email || '';
    return email.endsWith('@myio.com.br') && !email.startsWith('alarme@') && !email.startsWith('alarmes@');
  }

  private gcdrBase(): string {
    return (window as any).MyIOOrchestrator?.gcdrApiBaseUrl || 'https://gcdr-api.a.myio-bas.com';
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
    this.el.innerHTML = `<div class="gm-loading"><div class="um-spinner"></div>&nbsp;Carregando políticas...</div>`;
    this.loadPolicies();
    return this.el;
  }

  private async loadPolicies(): Promise<void> {
    try {
      const res = await fetch(`${this.gcdrBase()}/policies?limit=100`, { headers: this.gcdrHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.policies = this.unwrapList<GCDRPolicy>(await res.json());
      this.renderList();
    } catch (err) {
      console.error('[PoliciesTab] loadPolicies error', err);
      this.el.innerHTML = `<div class="gm-error">Erro ao carregar políticas. Verifique a conexão com o GCDR.</div>`;
    }
  }

  private renderList(): void {
    this.el.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;';
    header.innerHTML = `<h3 style="margin:0;font-size:14px;font-weight:600;color:var(--um-text-secondary);">🔒 Políticas de Permissão</h3>`;

    if (this.isSuperAdmin) {
      const btn = document.createElement('button');
      btn.className = 'um-btn um-btn--secondary um-btn--sm';
      btn.textContent = '+ Nova Política';
      btn.addEventListener('click', () => this.showPolicyForm(null));
      header.appendChild(btn);
    } else {
      header.insertAdjacentHTML('beforeend',
        `<span style="font-size:11px;color:var(--um-text-muted);padding:4px 10px;background:var(--um-notice-bg);border:1px solid var(--um-notice-border);border-radius:6px;">👁️ Somente leitura</span>`);
    }
    this.el.appendChild(header);

    if (this.policies.length === 0) {
      this.el.insertAdjacentHTML('beforeend', `<div class="gm-empty">Nenhuma política encontrada.</div>`);
      return;
    }

    const accordion = document.createElement('div');
    accordion.className = 'gm-groups-accordion';
    this.policies.forEach(p => accordion.appendChild(this.buildPolicyItem(p)));
    this.el.appendChild(accordion);
  }

  private buildPolicyItem(p: GCDRPolicy): HTMLElement {
    const item = document.createElement('div');
    item.className = `gm-accordion-item${this.expandedId === p.id ? ' gm-accordion-item--open' : ''}`;

    const riskColor = p.riskLevel === 'HIGH'
      ? 'background:var(--um-btn-danger-bg);color:var(--um-btn-danger-text)'
      : p.riskLevel === 'MEDIUM'
        ? 'background:#fef3c7;color:#92400e'
        : 'background:var(--um-badge-user-bg);color:var(--um-badge-user-text)';
    const riskBadge = p.riskLevel
      ? `<span class="gm-badge" style="${riskColor}">${p.riskLevel}</span>`
      : '';
    const sysBadge = p.system ? `<span class="gm-badge gm-badge--count">SISTEMA</span>` : '';

    item.innerHTML = `
      <div class="gm-accordion-header">
        <button class="gm-accordion-toggle"><span class="gm-accordion-arrow">▶</span></button>
        <div class="gm-accordion-meta">
          <div class="gm-group-name">${this.esc(p.name)}</div>
          ${p.description ? `<div class="gm-group-code">${this.esc(p.description)}</div>` : ''}
        </div>
        <div class="gm-accordion-badges">${riskBadge}${sysBadge}</div>
        ${this.isSuperAdmin && !p.system ? `<div class="gm-accordion-actions">
          <button class="um-icon-btn gm-edit-btn" title="Editar">✏️</button>
          <button class="um-icon-btn gm-delete-btn" title="Excluir">🗑️</button>
        </div>` : ''}
      </div>
      <div class="gm-accordion-panel" style="display:${this.expandedId === p.id ? '' : 'none'}">
        <div class="gm-panel-section">
          <div class="gm-panel-section-header"><span class="gm-panel-section-title">✅ Permitidas</span></div>
          ${p.allow?.length
            ? p.allow.map(a => `<code style="display:block;font-size:11px;color:var(--um-badge-user-text);padding:2px 0;">${this.esc(a)}</code>`).join('')
            : '<span class="gm-empty-inline">Nenhuma.</span>'}
        </div>
        ${p.deny?.length ? `<div class="gm-panel-section">
          <div class="gm-panel-section-header"><span class="gm-panel-section-title">🚫 Negadas</span></div>
          ${p.deny.map(d => `<code style="display:block;font-size:11px;color:var(--um-btn-danger-text);padding:2px 0;">${this.esc(d)}</code>`).join('')}
        </div>` : ''}
      </div>
    `;

    const header = item.querySelector<HTMLElement>('.gm-accordion-header')!;
    const panel = item.querySelector<HTMLElement>('.gm-accordion-panel')!;
    header.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.gm-accordion-actions')) return;
      const open = item.classList.toggle('gm-accordion-item--open');
      panel.style.display = open ? '' : 'none';
      this.expandedId = open ? p.id : null;
    });

    if (this.isSuperAdmin && !p.system) {
      item.querySelector('.gm-edit-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showPolicyForm(p);
      });
      item.querySelector('.gm-delete-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deletePolicy(p);
      });
    }

    return item;
  }

  private showPolicyForm(existing: GCDRPolicy | null): void {
    const isEdit = existing !== null;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:100001;';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--um-modal-bg,#131929);border:1px solid var(--um-border,#2a3352);border-radius:12px;padding:24px;width:min(520px,92vw);max-height:80vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.5);';
    modal.innerHTML = `
      <h4 style="margin:0 0 16px;font-size:15px;font-weight:600;color:var(--um-text-primary,#e2e8f0);">${isEdit ? 'Editar' : 'Nova'} Política</h4>
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
        <div class="um-form-group">
          <label class="um-label">Nível de Risco</label>
          <select class="um-input" name="riskLevel">
            <option value="">—</option>
            ${['LOW','MEDIUM','HIGH'].map(r => `<option value="${r}"${existing?.riskLevel === r ? ' selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="um-form-group">
          <label class="um-label">Permitidas (uma por linha, ex: alarms.rules.*)</label>
          <textarea class="um-input um-textarea" name="allow" rows="4">${this.esc((existing?.allow || []).join('\n'))}</textarea>
        </div>
        <div class="um-form-group">
          <label class="um-label">Negadas (uma por linha)</label>
          <textarea class="um-input um-textarea" name="deny" rows="3">${this.esc((existing?.deny || []).join('\n'))}</textarea>
        </div>
        <div class="um-form-actions">
          <button class="um-btn um-btn--ghost pol-cancel">Cancelar</button>
          <button class="um-btn um-btn--primary pol-save">${isEdit ? 'Salvar' : 'Criar'}</button>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    modal.querySelector('.pol-cancel')!.addEventListener('click', close);
    modal.querySelector('.pol-save')!.addEventListener('click', async () => {
      const name = (modal.querySelector<HTMLInputElement>('[name=name]')!.value).trim();
      const errEl = modal.querySelector<HTMLElement>('[data-for=name]')!;
      if (!name) { errEl.textContent = 'Nome obrigatório.'; return; }
      errEl.textContent = '';

      const description = (modal.querySelector<HTMLInputElement>('[name=description]')!.value).trim();
      const riskLevel = (modal.querySelector<HTMLSelectElement>('[name=riskLevel]')!.value) || undefined;
      const allow = (modal.querySelector<HTMLTextAreaElement>('[name=allow]')!.value).split('\n').map(s => s.trim()).filter(Boolean);
      const deny  = (modal.querySelector<HTMLTextAreaElement>('[name=deny]')!.value).split('\n').map(s => s.trim()).filter(Boolean);

      const btn = modal.querySelector<HTMLButtonElement>('.pol-save')!;
      btn.disabled = true; btn.textContent = '...';
      try {
        const body = { name, description: description || undefined, riskLevel, allow, deny };
        const url = isEdit ? `${this.gcdrBase()}/policies/${existing!.id}` : `${this.gcdrBase()}/policies`;
        const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: this.gcdrHeaders(), body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.callbacks.showToast(isEdit ? 'Política atualizada!' : 'Política criada!', 'success');
        close();
        await this.loadPolicies();
      } catch (err) {
        console.error('[PoliciesTab] save error', err);
        this.callbacks.showToast('Erro ao salvar política.', 'error');
        btn.disabled = false; btn.textContent = isEdit ? 'Salvar' : 'Criar';
      }
    });
  }

  private async deletePolicy(p: GCDRPolicy): Promise<void> {
    if (!confirm(`Excluir a política "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`${this.gcdrBase()}/policies/${p.id}`, { method: 'DELETE', headers: this.gcdrHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.callbacks.showToast('Política excluída.', 'success');
      await this.loadPolicies();
    } catch (err) {
      console.error('[PoliciesTab] delete error', err);
      this.callbacks.showToast('Erro ao excluir política.', 'error');
    }
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
