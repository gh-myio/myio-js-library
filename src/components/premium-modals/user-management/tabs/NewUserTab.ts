import { UserManagementConfig } from '../types';

export interface NewUserCallbacks {
  onCreated(userId: string): void;
  onCancel(): void;
  showToast(msg: string, type?: 'success' | 'error'): void;
}

export class NewUserTab {
  private config: UserManagementConfig;
  private callbacks: NewUserCallbacks;
  private el!: HTMLElement;
  private submitting = false;

  constructor(config: UserManagementConfig, callbacks: NewUserCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  render(): HTMLElement {
    this.el = document.createElement('div');
    this.el.className = 'um-tab-content um-new-user';
    this.el.innerHTML = `
      <form class="um-form" novalidate>
        <div class="um-form-row">
          <div class="um-form-group">
            <label class="um-label">Nome <span class="um-req">*</span></label>
            <input type="text" class="um-input" name="firstName" autocomplete="off" />
            <span class="um-field-error" data-for="firstName"></span>
          </div>
          <div class="um-form-group">
            <label class="um-label">Sobrenome <span class="um-req">*</span></label>
            <input type="text" class="um-input" name="lastName" autocomplete="off" />
            <span class="um-field-error" data-for="lastName"></span>
          </div>
        </div>
        <div class="um-form-group">
          <label class="um-label">E-mail <span class="um-req">*</span></label>
          <input type="email" class="um-input" name="email" autocomplete="off" />
          <span class="um-field-error" data-for="email"></span>
        </div>
        <div class="um-form-group">
          <label class="um-label">Telefone</label>
          <input type="text" class="um-input" name="phone" autocomplete="off" />
        </div>
        <div class="um-form-group">
          <label class="um-label">Descrição</label>
          <textarea class="um-input um-textarea" name="description" rows="2"></textarea>
        </div>
        <div class="um-form-group um-form-group--check">
          <label class="um-check-label">
            <input type="checkbox" name="sendActivationMail" checked />
            Enviar e-mail de ativação
          </label>
        </div>
        <div class="um-form-actions">
          <button type="button" class="um-btn um-btn--ghost um-cancel-btn">Cancelar</button>
          <button type="submit" class="um-btn um-btn--primary um-submit-btn">Criar Usuário</button>
        </div>
      </form>
    `;

    const form = this.el.querySelector<HTMLFormElement>('.um-form')!;
    form.addEventListener('submit', (e) => { e.preventDefault(); this.handleSubmit(); });
    this.el.querySelector('.um-cancel-btn')!.addEventListener('click', () => this.callbacks.onCancel());

    return this.el;
  }

  reset(): void {
    const form = this.el?.querySelector<HTMLFormElement>('.um-form');
    if (form) {
      form.reset();
      this.el.querySelectorAll<HTMLElement>('.um-field-error').forEach(el => el.textContent = '');
    }
  }

  private validate(data: Record<string, string>): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!data.firstName.trim()) errors.firstName = 'Nome é obrigatório.';
    if (!data.lastName.trim()) errors.lastName = 'Sobrenome é obrigatório.';
    if (!data.email.trim()) {
      errors.email = 'E-mail é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'E-mail inválido.';
    }
    return errors;
  }

  private showErrors(errors: Record<string, string>): void {
    this.el.querySelectorAll<HTMLElement>('[data-for]').forEach(el => {
      el.textContent = errors[el.dataset.for!] || '';
    });
  }

  private async handleSubmit(): Promise<void> {
    if (this.submitting) return;

    const form = this.el.querySelector<HTMLFormElement>('.um-form')!;
    const fd = new FormData(form);
    const data: Record<string, string> = {
      firstName: (fd.get('firstName') as string) || '',
      lastName: (fd.get('lastName') as string) || '',
      email: (fd.get('email') as string) || '',
      phone: (fd.get('phone') as string) || '',
      description: (fd.get('description') as string) || '',
    };
    const sendActivation = (fd.get('sendActivationMail') as string) === 'on';

    const errors = this.validate(data);
    this.showErrors(errors);
    if (Object.keys(errors).length > 0) return;

    this.submitting = true;
    const submitBtn = this.el.querySelector<HTMLButtonElement>('.um-submit-btn')!;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando...';

    try {
      const { tbBaseUrl, jwtToken, customerId, tenantId } = this.config;
      const url = `${tbBaseUrl}/api/user?sendActivationMail=${sendActivation}`;
      const body = {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || undefined,
        authority: 'CUSTOMER_USER',
        customerId: { id: customerId, entityType: 'CUSTOMER' },
        tenantId: { id: tenantId, entityType: 'TENANT' },
        additionalInfo: data.description ? { description: data.description } : undefined,
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${errText ? ': ' + errText.slice(0, 120) : ''}`);
      }
      const created = await res.json();
      this.callbacks.showToast(`Usuário ${data.firstName} ${data.lastName} criado com sucesso!`, 'success');
      this.reset();
      this.callbacks.onCreated(created?.id?.id || '');
    } catch (err: any) {
      console.error('[NewUserTab] create user error', err);
      this.callbacks.showToast('Erro ao criar usuário. Verifique os dados e tente novamente.', 'error');
    } finally {
      this.submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Criar Usuário';
    }
  }
}
