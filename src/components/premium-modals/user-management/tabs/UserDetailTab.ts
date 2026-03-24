import { UserManagementConfig, TBUser, buildUserTabLabel } from '../types';

export interface UserDetailCallbacks {
  onDeleted(): void;
  onUpdated(user: TBUser): void;
  onClose(): void;
  showToast(msg: string, type?: 'success' | 'error'): void;
}

type DetailMode = 'view' | 'edit';

export class UserDetailTab {
  private config: UserManagementConfig;
  private callbacks: UserDetailCallbacks;
  private user: TBUser;
  private el!: HTMLElement;
  private mode: DetailMode = 'view';
  private saving = false;

  constructor(config: UserManagementConfig, user: TBUser, callbacks: UserDetailCallbacks) {
    this.config = config;
    this.user = user;
    this.callbacks = callbacks;
  }

  get tabLabel(): string {
    return buildUserTabLabel(this.user);
  }

  render(): HTMLElement {
    this.el = document.createElement('div');
    this.el.className = 'um-tab-content um-user-detail';
    this.renderContent();
    return this.el;
  }

  /** Called after tab is re-activated when user already has an open tab */
  focus(): void {
    this.el?.querySelector<HTMLElement>('.um-detail-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private renderContent(): void {
    this.el.innerHTML = '';
    if (this.mode === 'view') {
      this.el.appendChild(this.buildViewMode());
    } else {
      this.el.appendChild(this.buildEditMode());
    }
  }

  private buildViewMode(): HTMLElement {
    const u = this.user;
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
    const role = u.authority === 'TENANT_ADMIN' ? 'Admin' : 'Usuário';
    const createdAt = u.createdTime ? new Date(u.createdTime).toLocaleDateString('pt-BR') : '—';

    const card = document.createElement('div');
    card.className = 'um-detail-card';
    card.innerHTML = `
      <div class="um-detail-section">
        <div class="um-detail-row"><span class="um-detail-label">Nome</span><span class="um-detail-value">${this.esc(name)}</span></div>
        <div class="um-detail-row"><span class="um-detail-label">E-mail</span><span class="um-detail-value">${this.esc(u.email)}</span></div>
        <div class="um-detail-row"><span class="um-detail-label">Telefone</span><span class="um-detail-value">${this.esc(u.phone || '—')}</span></div>
        <div class="um-detail-row"><span class="um-detail-label">Perfil</span><span class="um-detail-value">
          <span class="um-badge um-badge--${u.authority === 'TENANT_ADMIN' ? 'admin' : 'user'}">${role}</span>
        </span></div>
        <div class="um-detail-row"><span class="um-detail-label">Criado em</span><span class="um-detail-value">${createdAt}</span></div>
        ${u.additionalInfo?.description ? `<div class="um-detail-row"><span class="um-detail-label">Descrição</span><span class="um-detail-value">${this.esc(String(u.additionalInfo.description))}</span></div>` : ''}
      </div>
      <div class="um-detail-actions">
        <button class="um-btn um-btn--ghost um-detail-cancel-btn">Cancelar</button>
        <button class="um-btn um-btn--secondary um-detail-edit-btn">Habilitar Edição</button>
        <button class="um-btn um-btn--ghost um-detail-reset-btn">Redefinir Senha</button>
        <button class="um-btn um-btn--danger um-detail-delete-btn">Excluir</button>
      </div>
    `;

    card.querySelector('.um-detail-cancel-btn')!.addEventListener('click', () => this.callbacks.onClose());
    card.querySelector('.um-detail-edit-btn')!.addEventListener('click', () => {
      this.mode = 'edit';
      this.renderContent();
    });
    card.querySelector('.um-detail-reset-btn')!.addEventListener('click', () => this.handleResetPassword());
    card.querySelector('.um-detail-delete-btn')!.addEventListener('click', () => this.handleDelete());

    return card;
  }

  private buildEditMode(): HTMLElement {
    const u = this.user;
    const card = document.createElement('div');
    card.className = 'um-detail-card um-detail-card--edit';
    card.innerHTML = `
      <form class="um-form" novalidate>
        <div class="um-form-row">
          <div class="um-form-group">
            <label class="um-label">Nome <span class="um-req">*</span></label>
            <input type="text" class="um-input" name="firstName" value="${this.esc(u.firstName || '')}" autocomplete="off" />
            <span class="um-field-error" data-for="firstName"></span>
          </div>
          <div class="um-form-group">
            <label class="um-label">Sobrenome</label>
            <input type="text" class="um-input" name="lastName" value="${this.esc(u.lastName || '')}" autocomplete="off" />
          </div>
        </div>
        <div class="um-form-group">
          <label class="um-label">E-mail <span class="um-req">*</span></label>
          <input type="email" class="um-input" name="email" value="${this.esc(u.email)}" autocomplete="off" />
          <span class="um-field-error" data-for="email"></span>
        </div>
        <div class="um-form-group">
          <label class="um-label">Telefone</label>
          <input type="text" class="um-input" name="phone" value="${this.esc(u.phone || '')}" autocomplete="off" />
        </div>
        <div class="um-form-group">
          <label class="um-label">Descrição</label>
          <textarea class="um-input um-textarea" name="description" rows="2">${this.esc(String(u.additionalInfo?.description || ''))}</textarea>
        </div>
        <div class="um-form-actions">
          <button type="button" class="um-btn um-btn--ghost um-cancel-edit-btn">Cancelar</button>
          <button type="submit" class="um-btn um-btn--primary um-save-btn">Salvar Alterações</button>
        </div>
      </form>
    `;

    card.querySelector<HTMLFormElement>('.um-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave(card);
    });
    card.querySelector('.um-cancel-edit-btn')!.addEventListener('click', () => {
      this.mode = 'view';
      this.renderContent();
    });

    return card;
  }

  private async handleSave(card: HTMLElement): Promise<void> {
    if (this.saving) return;

    const form = card.querySelector<HTMLFormElement>('.um-form')!;
    const fd = new FormData(form);
    const firstName = (fd.get('firstName') as string || '').trim();
    const email = (fd.get('email') as string || '').trim();

    // Basic validation
    const errors: Record<string, string> = {};
    if (!firstName) errors.firstName = 'Nome é obrigatório.';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'E-mail inválido.';
    card.querySelectorAll<HTMLElement>('[data-for]').forEach(el => {
      el.textContent = errors[el.dataset.for!] || '';
    });
    if (Object.keys(errors).length > 0) return;

    this.saving = true;
    const saveBtn = card.querySelector<HTMLButtonElement>('.um-save-btn')!;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';

    try {
      const { tbBaseUrl, jwtToken } = this.config;
      const description = (fd.get('description') as string || '').trim();
      const updatedUser: TBUser = {
        ...this.user,
        firstName,
        lastName: (fd.get('lastName') as string || '').trim() || undefined,
        email,
        phone: (fd.get('phone') as string || '').trim() || undefined,
        additionalInfo: {
          ...this.user.additionalInfo,
          description: description || undefined,
        },
      };

      const res = await fetch(`${tbBaseUrl}/api/user`, {
        method: 'POST',
        headers: {
          'X-Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedUser),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved: TBUser = await res.json();
      this.user = saved;
      this.mode = 'view';
      this.renderContent();
      this.callbacks.showToast('Usuário atualizado com sucesso!', 'success');
      this.callbacks.onUpdated(saved);
    } catch (err: any) {
      console.error('[UserDetailTab] handleSave error', err);
      this.callbacks.showToast('Erro ao salvar. Tente novamente.', 'error');
    } finally {
      this.saving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Salvar Alterações';
    }
  }

  private handleResetPassword(): void {
    this.showConfirmDialog({
      title: 'Redefinir Senha',
      message: `Enviar e-mail de redefinição de senha para <strong>${this.esc(this.user.email)}</strong>?`,
      confirmLabel: 'Enviar E-mail',
      confirmClass: 'um-btn--secondary',
      onConfirm: async () => {
        try {
          const { tbBaseUrl, jwtToken } = this.config;
          const res = await fetch(`${tbBaseUrl}/api/noauth/resetPasswordByEmail`, {
            method: 'POST',
            headers: {
              'X-Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: this.user.email }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          this.callbacks.showToast('E-mail de redefinição de senha enviado!', 'success');
        } catch (err: any) {
          console.error('[UserDetailTab] resetPassword error', err);
          this.callbacks.showToast('Erro ao enviar e-mail de redefinição.', 'error');
        }
      },
    });
  }

  private handleDelete(): void {
    const name = [this.user.firstName, this.user.lastName].filter(Boolean).join(' ') || this.user.email;
    this.showConfirmDialog({
      title: 'Excluir Usuário',
      message: `Tem certeza que deseja excluir o usuário <strong>${this.esc(name)}</strong>? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      confirmClass: 'um-btn--danger',
      onConfirm: async () => {
        try {
          const { tbBaseUrl, jwtToken } = this.config;
          const res = await fetch(`${tbBaseUrl}/api/user/${this.user.id.id}`, {
            method: 'DELETE',
            headers: { 'X-Authorization': `Bearer ${jwtToken}` },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          this.callbacks.showToast(`Usuário ${name} excluído.`, 'success');
          this.callbacks.onDeleted();
        } catch (err: any) {
          console.error('[UserDetailTab] delete error', err);
          this.callbacks.showToast('Erro ao excluir usuário. Verifique as permissões.', 'error');
        }
      },
    });
  }

  private showConfirmDialog(opts: {
    title: string;
    message: string;
    confirmLabel: string;
    confirmClass: string;
    onConfirm: () => Promise<void>;
  }): void {
    const overlay = document.createElement('div');
    overlay.className = 'um-confirm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:100001;';

    const modal = document.createElement('div');
    modal.className = 'um-confirm-modal';
    modal.style.cssText = 'background:#1e2433;border:1px solid #3a4160;border-radius:12px;padding:24px;max-width:440px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,0.5);';
    modal.innerHTML = `
      <h4 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#e2e8f0;">${opts.title}</h4>
      <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.5;">${opts.message}</p>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="um-btn um-btn--ghost um-confirm-cancel">Cancelar</button>
        <button class="um-btn ${opts.confirmClass} um-confirm-ok">${opts.confirmLabel}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    modal.querySelector('.um-confirm-cancel')!.addEventListener('click', close);
    modal.querySelector('.um-confirm-ok')!.addEventListener('click', async () => {
      const btn = modal.querySelector<HTMLButtonElement>('.um-confirm-ok')!;
      btn.disabled = true;
      btn.textContent = '...';
      close();
      await opts.onConfirm();
    });
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
