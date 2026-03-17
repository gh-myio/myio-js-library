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

  private defaultDashboardId: string | null = null;
  private customerUsersGroupId: string | null = null;
  private prefetchPromise: Promise<void> | null = null;

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

    // Start pre-fetching dashboard ID and group ID in the background
    this.prefetchPromise = this.prefetch();

    return this.el;
  }

  reset(): void {
    const form = this.el?.querySelector<HTMLFormElement>('.um-form');
    if (form) {
      form.reset();
      this.el.querySelectorAll<HTMLElement>('.um-field-error').forEach(el => el.textContent = '');
    }
  }

  // ── Prefetch ──────────────────────────────────────────────────────────────────

  private async prefetch(): Promise<void> {
    // defaultDashboardId vem do orquestrador (RFC-0194), não de fetch
    this.defaultDashboardId = (window as any).MyIOOrchestrator?.defaultDashboardId ?? null;

    const { tbBaseUrl, jwtToken, customerId } = this.config;
    const headers = { 'X-Authorization': `Bearer ${jwtToken}` };

    try {
      const res = await fetch(
        `${tbBaseUrl}/api/entityGroups/CUSTOMER/${customerId}/USER`,
        { headers }
      );
      if (res.ok) {
        const raw = await res.json().catch(() => []);
        const groups: Array<{ id: { id: string }; name: string }> =
          Array.isArray(raw) ? raw : (raw?.data ?? []);
        this.customerUsersGroupId = groups.find(g => g.name === 'Customer Users')?.id?.id ?? null;
        if (!this.customerUsersGroupId) {
          console.warn('[NewUserTab] prefetch: grupo "Customer Users" não encontrado na resposta', groups);
        }
      } else {
        console.warn('[NewUserTab] prefetch: entityGroups fetch retornou', res.status);
      }
    } catch (err) {
      console.warn('[NewUserTab] prefetch: falha ao buscar entityGroups', err);
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────────

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

  // ── Submit ────────────────────────────────────────────────────────────────────

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

      if (this.prefetchPromise) await this.prefetchPromise;
      // RFC-0194: stable default dashboard from SERVER_SCOPE attribute (MyIOOrchestrator)
      const defaultDashboardId = (window as any).MyIOOrchestrator?.defaultDashboardId ?? null;
      const additionalInfo: Record<string, unknown> = {};
      if (data.description) additionalInfo.description = data.description;
      if (defaultDashboardId) additionalInfo.defaultDashboardId = defaultDashboardId;
      const body = {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        authority: 'CUSTOMER_USER',
        customerId: { id: customerId, entityType: 'CUSTOMER' },
        tenantId: { id: tenantId, entityType: 'TENANT' },
        additionalInfo: Object.keys(additionalInfo).length ? additionalInfo : undefined,
      };

      const createRes = await this.tbPost(
        `/api/user?sendActivationMail=${sendActivation}`,
        body
      );
      const created = await createRes.json();
      const newUserId: string = created?.id?.id;
      if (!newUserId) throw new Error('TB não retornou o ID do usuário criado.');

      // ── Step 2: Add to "Customer Users" group ────────────────────────────────
      // (owner is auto-assigned by TB when customerId is provided in the create body)
      if (this.customerUsersGroupId) {
        await this.tbPost(
          `/api/entityGroup/${this.customerUsersGroupId}/addEntities`,
          [newUserId]
        );
      }

      this.callbacks.showToast(`Usuário ${data.firstName} ${data.lastName} criado com sucesso!`, 'success');
      this.reset();
      this.callbacks.onCreated(newUserId);
    } catch (err: any) {
      console.error('[NewUserTab] create user error', err);
      this.callbacks.showToast('Erro ao criar usuário. Verifique os dados e tente novamente.', 'error');
    } finally {
      this.submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Criar Usuário';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private async tbPost(path: string, body?: unknown): Promise<Response> {
    const { tbBaseUrl, jwtToken } = this.config;
    const res = await fetch(`${tbBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'X-Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${text ? ': ' + text.slice(0, 120) : ''}`);
    }
    return res;
  }
}
