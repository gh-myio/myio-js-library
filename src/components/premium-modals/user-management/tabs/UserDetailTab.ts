import { UserManagementConfig, TBUser, buildUserTabLabel, GCDRAssignment, GCDRRole, GCDRPolicy, UserAssignmentsResponse, UserRoleAssignmentsSnapshot } from '../types';
import { MyIOToast } from '../../../../components/MyIOToast';

export interface UserDetailCallbacks {
  onDeleted(): void;
  onUpdated(user: TBUser): void;
  onClose(): void;
  showToast(msg: string, type?: 'success' | 'error'): void;
}

type DetailMode = 'view' | 'edit';

/**
 * RFC-0233: one node of the `restrict_view` tree. A bare boolean is the
 * Phase 1 shorthand; the `{enabled, features}` shape (Phase 2) additionally
 * carries nested sub-feature flags — currently only used for
 * `header.alarms.features.{mapEdit,acknowledge,snooze,escalate}`.
 */
type RestrictViewNode = boolean | { enabled: boolean; features?: Record<string, boolean> };

export class UserDetailTab {
  private config: UserManagementConfig;
  private callbacks: UserDetailCallbacks;
  private user: TBUser;
  private el!: HTMLElement;
  private mode: DetailMode = 'view';
  private saving = false;

  // RFC-0197: Assignments section state
  private assignments: GCDRAssignment[] = [];
  private availableRoles: GCDRRole[] = [];
  private availablePolicies: GCDRPolicy[] = [];
  private assignmentsEl: HTMLElement | null = null;
  private assignmentsVersion = 0;

  // RFC-0233: Feature access section state (restrict_view USER SERVER_SCOPE attribute)
  private restrictView: Record<string, Record<string, RestrictViewNode>> | null = null;
  private featureAccessEl: HTMLElement | null = null;
  private featureAccessSaveBtn: HTMLButtonElement | null = null;

  private static readonly FEATURE_GROUPS: Array<{
    group: 'menu' | 'header' | 'footer';
    groupLabel: string;
    features: Array<{ key: string; label: string; icon: string }>;
  }> = [
    {
      group: 'menu',
      groupLabel: 'Menu',
      features: [
        { key: 'energy', label: 'Energia', icon: '⚡' },
        { key: 'water', label: 'Água', icon: '💧' },
        { key: 'temperature', label: 'Temperatura', icon: '🌡️' },
        { key: 'alarms', label: 'Alarmes', icon: '🔔' },
        { key: 'reports', label: 'Relatórios', icon: '📊' },
        { key: 'goals', label: 'Metas', icon: '🎯' },
        { key: 'settings', label: 'Configurações', icon: '⚙️' },
      ],
    },
    {
      group: 'header',
      groupLabel: 'Cabeçalho',
      features: [
        { key: 'alarms', label: 'Notificação de Alarmes', icon: '🔔' },
        { key: 'annotations', label: 'Anotações', icon: '✏️' },
        { key: 'tickets', label: 'Chamados', icon: '🎧' },
      ],
    },
    {
      group: 'footer',
      groupLabel: 'Rodapé',
      features: [{ key: 'compare', label: 'Comparar', icon: '📊' }],
    },
  ];

  /** menu.* keys where at least one must stay enabled — a user must always see at least one content domain. */
  private static readonly MENU_MIN_ONE_KEYS = ['energy', 'water', 'temperature', 'alarms', 'reports', 'goals'];

  /** RFC-0233 Phase 2: nested sub-features under header.alarms.features — only meaningful while the parent "Notificação de Alarmes" toggle is on. */
  private static readonly ALARM_SUB_FEATURES: Array<{ key: string; label: string; icon: string }> = [
    { key: 'mapEdit', label: 'Editar Mapa de Alarmes GCDR', icon: '🗺️' },
    { key: 'acknowledge', label: 'Reconhecer alarmes', icon: '✅' },
    { key: 'snooze', label: 'Adiar alarmes', icon: '⏰' },
    { key: 'escalate', label: 'Escalar alarmes', icon: '📈' },
  ];

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

    // RFC-0197: Assignments section
    const assignmentsSection = this.buildAssignmentsSection();
    card.appendChild(assignmentsSection);

    // Special permissions (isUserAdmin / isHolding, USER SERVER_SCOPE)
    const specialPermissionsSection = this.buildSpecialPermissionsSection();
    card.appendChild(specialPermissionsSection);

    // RFC-0233: Feature access section
    const featureAccessSection = this.buildFeatureAccessSection();
    card.appendChild(featureAccessSection);

    return card;
  }

  // ── Special Permissions Section (isUserAdmin / isHolding) ─────────────────
  //
  // Both live on this USER's own SERVER_SCOPE (not the customer's) and are
  // read together in MAIN_VIEW's detectSuperAdmin():
  //   isHoldingAdmin = truthy('isHolding') && truthy('isUserAdmin')
  // Note the naming collision: MENU/controller.js separately reads a
  // DIFFERENT, CUSTOMER-scoped `isUserAdmin` attribute (RFC-0108) to decide
  // whether to show the Settings/shopping-selector buttons for non-tenant-
  // admin users of that customer — same attribute name, different scope,
  // different purpose. This section only edits the USER-scoped pair used for
  // Holding Admin detection.

  private specialPermissions: { isUserAdmin: boolean; isHolding: boolean } | null = null;
  private specialPermissionsEl: HTMLElement | null = null;
  private specialPermissionsSaveBtn: HTMLButtonElement | null = null;

  private buildSpecialPermissionsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top:20px;border:1px solid var(--um-border);border-radius:10px;overflow:hidden;';

    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--um-accent);border-bottom:1px solid var(--um-btn-2-border);';
    sectionHeader.innerHTML = `<span style="font-size:13px;font-weight:600;color:#fff;">🛡️ Permissões Especiais</span>`;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'um-btn um-btn--secondary um-btn--sm';
    saveBtn.textContent = 'Salvar';
    saveBtn.disabled = true;
    saveBtn.addEventListener('click', () => this.saveSpecialPermissions(saveBtn));
    sectionHeader.appendChild(saveBtn);
    section.appendChild(sectionHeader);

    const body = document.createElement('div');
    body.style.cssText = 'padding:14px 16px;';
    body.innerHTML = `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--um-text-faint);"><div class="um-spinner"></div> Carregando...</div>`;
    section.appendChild(body);
    this.specialPermissionsEl = body;
    this.specialPermissionsSaveBtn = saveBtn;

    this.loadSpecialPermissions();
    return section;
  }

  private async loadSpecialPermissions(): Promise<void> {
    const { tbBaseUrl, jwtToken } = this.config;
    try {
      const res = await fetch(
        `${tbBaseUrl}/api/plugins/telemetry/USER/${this.user.id.id}/values/attributes/SERVER_SCOPE?keys=isUserAdmin,isHolding`,
        { headers: { 'X-Authorization': `Bearer ${jwtToken}` } }
      );
      if (res.ok) {
        const attrs: Array<{ key: string; value: unknown }> = await res.json();
        this.specialPermissions = {
          isUserAdmin: attrs.find((a) => a.key === 'isUserAdmin')?.value === true,
          isHolding: attrs.find((a) => a.key === 'isHolding')?.value === true,
        };
      } else {
        this.specialPermissions = { isUserAdmin: false, isHolding: false };
      }
    } catch (err) {
      console.warn('[UserDetailTab] loadSpecialPermissions failed — defaulting to off:', err);
      this.specialPermissions = { isUserAdmin: false, isHolding: false };
    }
    this.renderSpecialPermissions();
  }

  private renderSpecialPermissions(): void {
    if (!this.specialPermissionsEl || !this.specialPermissions) return;
    const el = this.specialPermissionsEl;
    const rows: Array<{ key: 'isUserAdmin' | 'isHolding'; label: string; hint: string; icon: string }> = [
      { key: 'isUserAdmin', label: 'Usuário Administrador', hint: 'isUserAdmin — em conjunto com Holding Admin, concede acesso administrativo elevado a este usuário.', icon: '👤' },
      { key: 'isHolding', label: 'Holding Admin', hint: 'isHolding — em conjunto com Usuário Administrador, concede status de Holding Admin (acesso entre clientes).', icon: '🏢' },
    ];
    el.innerHTML = `
      <div style="font-size:12px;color:var(--um-text-faint);margin-bottom:12px;">
        Atributos de <code>SERVER_SCOPE</code> do próprio usuário. Ambos precisam estar ligados juntos para conceder status de Holding Admin.
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${rows
          .map(
            (r, idx) => `
          <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border-radius:6px;background:${
            idx % 2 === 1 ? 'var(--um-bg-input)' : 'transparent'
          };" title="${this.esc(r.hint)}">
            <span style="font-size:13px;color:var(--um-text-secondary);">${r.icon} ${this.esc(r.label)}</span>
            <span class="gm-toggle">
              <input type="checkbox" class="gm-toggle-input um-special-permission-toggle" data-key="${r.key}" ${
                this.specialPermissions![r.key] ? 'checked' : ''
              } />
              <span class="gm-toggle-slider"></span>
            </span>
          </label>`
          )
          .join('')}
      </div>
    `;

    el.querySelectorAll<HTMLInputElement>('.um-special-permission-toggle').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset.key as 'isUserAdmin' | 'isHolding';
        if (!this.specialPermissions) this.specialPermissions = { isUserAdmin: false, isHolding: false };
        this.specialPermissions[key] = input.checked;
        if (this.specialPermissionsSaveBtn) this.specialPermissionsSaveBtn.disabled = false;
      });
    });
  }

  private async saveSpecialPermissions(btn: HTMLButtonElement): Promise<void> {
    const { tbBaseUrl, jwtToken } = this.config;
    if (!this.specialPermissions) return;
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'Salvando...';
    try {
      const res = await fetch(`${tbBaseUrl}/api/plugins/telemetry/USER/${this.user.id.id}/SERVER_SCOPE`, {
        method: 'POST',
        headers: { 'X-Authorization': `Bearer ${jwtToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(this.specialPermissions),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      MyIOToast.success('Permissões especiais atualizadas!');
    } catch (err) {
      console.error('[UserDetailTab] saveSpecialPermissions error', err);
      MyIOToast.error('Erro ao salvar permissões especiais.');
      btn.disabled = false;
    } finally {
      btn.textContent = originalLabel || 'Salvar';
    }
  }

  // ── RFC-0197: Assignments Section ─────────────────────────────────────────

  private gcdrBase(): string {
    const url = (window as any).MyIOOrchestrator?.gcdrApiBaseUrl;
    if (!url) throw new Error('gcdrApiBaseUrl não configurado no orquestrador.');
    return url;
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

  private buildAssignmentsSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top:20px;border:1px solid var(--um-border);border-radius:10px;overflow:hidden;';

    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--um-accent);border-bottom:1px solid var(--um-btn-2-border);';
    sectionHeader.innerHTML = `<span style="font-size:13px;font-weight:600;color:#fff;">🔑 Funções / Papéis</span>`;

    const addBtn = document.createElement('button');
    addBtn.className = 'um-btn um-btn--secondary um-btn--sm';
    addBtn.textContent = '+ Adicionar';
    addBtn.addEventListener('click', () => this.showAssignForm());
    sectionHeader.appendChild(addBtn);
    section.appendChild(sectionHeader);

    const body = document.createElement('div');
    body.style.cssText = 'padding:14px 16px;';
    body.innerHTML = `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--um-text-faint);"><div class="um-spinner"></div> Carregando...</div>`;
    section.appendChild(body);
    this.assignmentsEl = body;

    this.loadAssignments();
    return section;
  }

  private async loadAssignments(): Promise<void> {
    const userId = this.user.id.id;
    try {
      const [assignRes, rolesRes, policiesRes] = await Promise.all([
        fetch(`${this.gcdrBase()}/authorization/users/${userId}/assignments`, { headers: this.gcdrHeaders() }),
        fetch(`${this.gcdrBase()}/roles?limit=100`, { headers: this.gcdrHeaders() }),
        fetch(`${this.gcdrBase()}/policies?limit=100`, { headers: this.gcdrHeaders() }),
      ]);
      if (assignRes.ok) {
        const assignJson = await assignRes.json() as UserAssignmentsResponse | GCDRAssignment[];
        this.assignments = Array.isArray(assignJson) ? assignJson : (assignJson.assignments ?? []);
      } else {
        this.assignments = [];
      }
      this.availableRoles = rolesRes.ok ? this.unwrapList<GCDRRole>(await rolesRes.json()) : [];
      this.availablePolicies = policiesRes.ok ? this.unwrapList<GCDRPolicy>(await policiesRes.json()) : [];
      this.renderAssignments();
    } catch (err) {
      console.error('[UserDetailTab] loadAssignments error', err);
      MyIOToast.error('Erro ao carregar atribuições. Verifique a conexão com o GCDR.');
      if (this.assignmentsEl) {
        this.assignmentsEl.innerHTML = `<div style="font-size:12px;color:var(--um-btn-danger-text);">Erro ao carregar atribuições.</div>`;
      }
    }
  }

  private renderAssignments(): void {
    if (!this.assignmentsEl) return;
    if (this.assignments.length === 0) {
      this.assignmentsEl.innerHTML = `<div style="font-size:13px;color:var(--um-text-faint);padding:8px 0;">Nenhuma função atribuída.</div>`;
      return;
    }

    const table = document.createElement('table');
    table.className = 'um-table';
    table.style.cssText = 'font-size:12px;';
    table.innerHTML = `<thead><tr>
      <th>Função</th><th>Escopo</th><th>Status</th><th>Expira em</th><th style="text-align:center;">Ação</th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');
    this.assignments.forEach(a => {
      const tr = document.createElement('tr');
      const statusColor = a.status === 'active' ? 'var(--um-badge-active-text)' : a.status === 'expired' ? 'var(--um-badge-blocked-text)' : 'var(--um-text-faint)';
      const expiresAt = a.expiresAt ? new Date(a.expiresAt).toLocaleDateString('pt-BR') : '—';
      const scopeLabel = a.scope === '*'
        ? '* (global)'
        : a.scope.startsWith('customer:')
          ? `Cliente (${a.scope.replace('customer:', '').slice(0, 8)}...)`
          : a.scope.startsWith('asset:')
            ? `Asset (${a.scope.replace('asset:', '').slice(0, 8)}...)`
            : a.scope;
      tr.innerHTML = `
        <td style="font-weight:500;">${this.esc(a.roleDisplayName || a.roleKey)}</td>
        <td style="font-size:12px;">${this.esc(scopeLabel)}</td>
        <td><span style="color:${statusColor};font-weight:600;">${a.status}</span></td>
        <td>${expiresAt}</td>
        <td style="text-align:center;"><button class="um-btn um-btn--danger um-btn--sm revoke-btn">Revogar</button></td>
      `;
      tr.querySelector('.revoke-btn')!.addEventListener('click', () => this.revokeAssignment(a));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    this.assignmentsEl.innerHTML = '';
    this.assignmentsEl.appendChild(table);
  }

  private showAssignForm(): void {
    const overlay = document.createElement('div');
    overlay.className = 'um-backdrop';
    overlay.setAttribute('data-theme', this.config.theme || 'light');
    overlay.style.zIndex = '100001';
    
    const modal = document.createElement('div');
    modal.className = 'um-modal';
    modal.style.cssText = 'width: min(820px, 92vw); max-height: 85vh; height: auto; aspect-ratio: unset; overflow: hidden; display: flex; flex-direction: column;';

    const gcdrCid = (window as any).MyIOOrchestrator?.gcdrCustomerId || '';
    const scopeOptions = [
      { value: '*', label: '* (global — todos os clientes)' },
      ...(gcdrCid ? [{ value: `customer:${gcdrCid}`, label: `Cliente atual (${gcdrCid.slice(0, 8)}...)` }] : []),
    ];

    modal.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:14px 20px;background:var(--um-accent);border-bottom:1px solid var(--um-btn-2-border);flex-shrink:0;">
        <span style="font-size:15px;">🔑</span>
        <span style="flex:1;font-size:14px;font-weight:600;color:#fff;">Atribuir Função / Papel</span>
        <button type="button" class="assign-close" style="background:none;border:none;color:rgba(255,255,255,0.8);font-size:18px;cursor:pointer;padding:2px 6px;border-radius:4px;line-height:1;">✕</button>
      </div>
      <div style="padding:20px 24px;overflow-y:auto;flex:1;">
      <div class="um-form" style="max-width:100%;">
        <div class="um-form-group">
          <label class="um-label">Função <span class="um-req">*</span></label>
          <select class="um-input" name="roleId">
            <option value="">Selecione...</option>
            ${this.availableRoles.map(r => `<option value="${this.esc(r.id)}">${this.esc(r.displayName)}</option>`).join('')}
          </select>
          <span class="um-field-error" data-for="roleId"></span>
        </div>
        <div class="um-assign-policies-preview" style="display:none;border:1px solid var(--um-border);border-radius:8px;padding:12px;background:var(--um-bg-surface);">
          <div style="font-size:11px;font-weight:600;color:var(--um-text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Políticas incluídas</div>
          <div class="um-assign-policies-list" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>
        <div class="um-form-group">
          <label class="um-label">Escopo <span class="um-req">*</span></label>
          <select class="um-input" name="scope">
            ${scopeOptions.map(o => `<option value="${this.esc(o.value)}">${this.esc(o.label)}</option>`).join('')}
          </select>
        </div>
        <div class="um-form-group">
          <label class="um-label">Expiração (opcional)</label>
          <input type="date" class="um-input" name="expiresAt" />
        </div>
        <div class="um-form-group">
          <label class="um-label">Motivo (opcional)</label>
          <input class="um-input" name="reason" placeholder="Ex: Acesso temporário para auditoria" autocomplete="off" />
        </div>
        <div class="um-form-actions">
          <button class="um-btn um-btn--ghost assign-cancel">Cancelar</button>
          <button class="um-btn um-btn--primary assign-save">Atribuir</button>
        </div>
      </div>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Policy preview on role change
    const roleSelect = modal.querySelector<HTMLSelectElement>('[name=roleId]')!;
    const policiesPreview = modal.querySelector<HTMLElement>('.um-assign-policies-preview')!;
    const policiesList = modal.querySelector<HTMLElement>('.um-assign-policies-list')!;
    roleSelect.addEventListener('change', () => {
      const role = this.availableRoles.find(r => r.id === roleSelect.value);
      const policyRefs = role?.policies ?? role?.policyIds ?? [];
      if (!role || policyRefs.length === 0) {
        policiesPreview.style.display = 'none';
        return;
      }
      // Match by key (e.g. "policy:alarm-management") or id
      const policyByKey = new Map(this.availablePolicies.flatMap(p => [
        [p.key || p.id, p],
        [p.id, p],
      ]));
      const matched = policyRefs
        .map(ref => policyByKey.get(ref))
        .filter(Boolean) as GCDRPolicy[];
      policiesList.innerHTML = matched.length > 0
        ? matched.map(p => `
            <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 8px;background:var(--um-bg-input);border-radius:6px;">
              <span style="font-size:11px;font-weight:600;background:var(--um-btn-2-bg);color:var(--um-btn-2-text);border:1px solid var(--um-btn-2-border);border-radius:9999px;padding:2px 8px;white-space:nowrap;">${this.esc(p.displayName)}</span>
              ${p.description ? `<span style="font-size:11px;color:var(--um-text-muted);padding-top:2px;">${this.esc(p.description)}</span>` : ''}
            </div>`).join('')
        : policyRefs.map(ref => `
            <span style="font-size:11px;font-family:monospace;background:var(--um-btn-2-bg);color:var(--um-btn-2-text);border:1px solid var(--um-btn-2-border);border-radius:9999px;padding:2px 8px;">${this.esc(ref)}</span>`).join('');
      policiesPreview.style.display = 'block';
    });

    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    modal.querySelector('.assign-close')!.addEventListener('click', close);
    modal.querySelector('.assign-cancel')!.addEventListener('click', close);
    modal.querySelector('.assign-save')!.addEventListener('click', async () => {
      const roleId = (modal.querySelector<HTMLSelectElement>('[name=roleId]')!.value).trim();
      const errEl = modal.querySelector<HTMLElement>('[data-for=roleId]')!;
      if (!roleId) { errEl.textContent = 'Selecione uma função.'; return; }
      errEl.textContent = '';

      const scope = (modal.querySelector<HTMLSelectElement>('[name=scope]')!.value) || '*';
      const expiresAtRaw = (modal.querySelector<HTMLInputElement>('[name=expiresAt]')!.value);
      const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;
      const reason = (modal.querySelector<HTMLInputElement>('[name=reason]')!.value).trim() || null;
      const role = this.availableRoles.find(r => r.id === roleId);
      const roleKey = role?.key || role?.id || roleId;

      const btn = modal.querySelector<HTMLButtonElement>('.assign-save')!;
      btn.disabled = true; btn.textContent = '...';
      try {
        const body = {
          userId: this.user.id.id,
          roleKey,
          scope,
          expiresAt,
          reason,
        };
        const res = await fetch(`${this.gcdrBase()}/authorization/assignments`, {
          method: 'POST', headers: this.gcdrHeaders(), body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const created: GCDRAssignment = await res.json();
        MyIOToast.success(`Função "${role?.displayName || roleId}" atribuída!`);
        close();
        this.assignments.push(created);
        this.renderAssignments();
        await this.writeTBSnapshot();
      } catch (err) {
        console.error('[UserDetailTab] assign error', err);
        MyIOToast.error('Erro ao atribuir função.');
        btn.disabled = false; btn.textContent = 'Atribuir';
      }
    });
  }

  private async revokeAssignment(a: GCDRAssignment): Promise<void> {
    const role = this.availableRoles.find(r => r.id === a.roleId);
    const label = role?.displayName || a.roleDisplayName || a.roleKey;
    if (!confirm(`Revogar a função "${label}"?`)) return;
    try {
      const res = await fetch(`${this.gcdrBase()}/authorization/assignments/${a.id}`, {
        method: 'DELETE', headers: this.gcdrHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.assignments = this.assignments.filter(x => x.id !== a.id);
      this.renderAssignments();
      MyIOToast.success(`Função "${label}" revogada.`);
      await this.writeTBSnapshot();
    } catch (err) {
      console.error('[UserDetailTab] revoke error', err);
      MyIOToast.error('Erro ao revogar função.');
    }
  }

  // ── RFC-0233: Feature Access Section ──────────────────────────────────────

  private buildFeatureAccessSection(): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top:20px;border:1px solid var(--um-border);border-radius:10px;overflow:hidden;';

    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--um-accent);border-bottom:1px solid var(--um-btn-2-border);';
    sectionHeader.innerHTML = `<span style="font-size:13px;font-weight:600;color:#fff;">🔓 Acesso em Funcionalidades</span>`;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'um-btn um-btn--secondary um-btn--sm';
    saveBtn.textContent = 'Salvar';
    saveBtn.disabled = true;
    saveBtn.addEventListener('click', () => this.saveFeatureAccess(saveBtn));
    sectionHeader.appendChild(saveBtn);
    section.appendChild(sectionHeader);

    const body = document.createElement('div');
    body.style.cssText = 'padding:14px 16px;';
    body.innerHTML = `<div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--um-text-faint);"><div class="um-spinner"></div> Carregando...</div>`;
    section.appendChild(body);
    this.featureAccessEl = body;
    this.featureAccessSaveBtn = saveBtn;

    this.loadFeatureAccess();
    return section;
  }

  /**
   * RFC-0233: reads the raw `restrict_view` USER SERVER_SCOPE attribute for
   * this user (same key/scope MAIN_VIEW reads at dashboard load). Absent or
   * malformed → fails open to "nothing restricted" (all toggles default on),
   * matching the RFC's own fail-open semantics.
   */
  private async loadFeatureAccess(): Promise<void> {
    const { tbBaseUrl, jwtToken } = this.config;
    try {
      const res = await fetch(
        `${tbBaseUrl}/api/plugins/telemetry/USER/${this.user.id.id}/values/attributes/SERVER_SCOPE?keys=restrict_view`,
        { headers: { 'X-Authorization': `Bearer ${jwtToken}` } }
      );
      if (res.ok) {
        const attrs: Array<{ key: string; value: unknown }> = await res.json();
        const raw = attrs.find((a) => a.key === 'restrict_view')?.value;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        this.restrictView = parsed && typeof parsed === 'object' ? (parsed as Record<string, Record<string, RestrictViewNode>>) : null;
      } else {
        this.restrictView = null;
      }
    } catch (err) {
      console.warn('[UserDetailTab] loadFeatureAccess failed — defaulting to fully enabled (fail-open):', err);
      this.restrictView = null;
    }
    this.renderFeatureAccess();
  }

  /** Same resolution rule as `isFeatureVisible` in MAIN_VIEW: absent/malformed → enabled; only an explicit `false` (or `{enabled:false}`) restricts. */
  private isFeatureEnabled(group: string, key: string): boolean {
    const node = this.restrictView?.[group]?.[key] as unknown;
    if (node == null) return true;
    if (typeof node === 'boolean') return node;
    if (typeof node === 'object') return (node as { enabled?: boolean }).enabled !== false;
    return true;
  }

  /**
   * RFC-0233 Phase 2: resolves one of header.alarms.features.{mapEdit,acknowledge,snooze,escalate}.
   * Mirrors isFeatureVisible's own nested resolution: absent parent → enabled;
   * a bare boolean parent applies to every sub-feature; an {enabled,features}
   * parent falls back to `enabled` for any sub-key not explicitly listed.
   */
  private isAlarmSubFeatureEnabled(subKey: string): boolean {
    const node = this.restrictView?.header?.alarms;
    if (node == null) return true;
    if (typeof node === 'boolean') return node;
    const features = node.features;
    if (features && subKey in features) return features[subKey] !== false;
    return node.enabled !== false;
  }

  /** RFC-0233 Phase 2: renders the 4 nested alarm sub-toggles under the "Notificação de Alarmes" row. */
  private renderAlarmSubFeatures(parentEnabled: boolean): string {
    return `
      <div style="margin:2px 0 4px 20px;padding-left:10px;border-left:2px solid var(--um-border);display:flex;flex-direction:column;gap:2px;${
        parentEnabled ? '' : 'opacity:0.45;'
      }">
        ${UserDetailTab.ALARM_SUB_FEATURES.map(
          (sf, idx) => `
          <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 8px;border-radius:6px;background:${
            idx % 2 === 1 ? 'var(--um-bg-input)' : 'transparent'
          };">
            <span style="font-size:12px;color:var(--um-text-muted);">${sf.icon} ${this.esc(sf.label)}</span>
            <span class="gm-toggle">
              <input type="checkbox" class="gm-toggle-input um-alarm-sub-toggle" data-subkey="${sf.key}" ${
                this.isAlarmSubFeatureEnabled(sf.key) ? 'checked' : ''
              } ${parentEnabled ? '' : 'disabled'} />
              <span class="gm-toggle-slider"></span>
            </span>
          </label>`
        ).join('')}
      </div>`;
  }

  private renderFeatureAccess(): void {
    if (!this.featureAccessEl) return;
    const el = this.featureAccessEl;
    const alarmsEnabled = this.isFeatureEnabled('header', 'alarms');
    el.innerHTML = `
      <div style="font-size:12px;color:var(--um-text-faint);margin-bottom:12px;">
        Controla quais itens de menu, botões do cabeçalho e recursos do rodapé este usuário específico enxerga no dashboard.
        Por padrão tudo está liberado — desative apenas o que este usuário não deve ver.
      </div>
      ${UserDetailTab.FEATURE_GROUPS.map(
        (g) => `
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;font-weight:600;color:var(--um-text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">${this.esc(g.groupLabel)}</div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            ${g.features
              .map(
                (f, idx) => `
              <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;border-radius:6px;background:${
                idx % 2 === 1 ? 'var(--um-bg-input)' : 'transparent'
              };">
                <span style="font-size:13px;color:var(--um-text-secondary);">${f.icon} ${this.esc(f.label)}</span>
                <span class="gm-toggle">
                  <input type="checkbox" class="gm-toggle-input um-feature-toggle" data-group="${g.group}" data-key="${f.key}" ${
                    this.isFeatureEnabled(g.group, f.key) ? 'checked' : ''
                  } />
                  <span class="gm-toggle-slider"></span>
                </span>
              </label>${g.group === 'header' && f.key === 'alarms' ? this.renderAlarmSubFeatures(alarmsEnabled) : ''}`
              )
              .join('')}
          </div>
        </div>`
      ).join('')}
    `;

    el.querySelectorAll<HTMLInputElement>('.um-feature-toggle').forEach((input) => {
      input.addEventListener('change', () => {
        const group = input.dataset.group!;
        const key = input.dataset.key!;

        // At least one of the 6 main menu domains must stay enabled — a user
        // must always be able to see at least one content domain.
        if (!input.checked && group === 'menu' && UserDetailTab.MENU_MIN_ONE_KEYS.includes(key)) {
          const wouldAllBeDisabled = UserDetailTab.MENU_MIN_ONE_KEYS.every((k) =>
            k === key ? false : !this.isFeatureEnabled('menu', k)
          );
          if (wouldAllBeDisabled) {
            input.checked = true;
            MyIOToast.error('Pelo menos uma funcionalidade entre Energia, Água, Temperatura, Alarmes, Relatórios ou Metas precisa ficar habilitada.');
            return;
          }
        }

        if (!this.restrictView) this.restrictView = {};
        if (!this.restrictView[group]) this.restrictView[group] = {};

        // header.alarms carries nested `features` (RFC-0233 Phase 2) —
        // preserve them across a plain enable/disable of the parent toggle
        // instead of clobbering the node with a bare boolean, then re-render
        // so the sub-toggles' enabled/disabled state follows the parent.
        if (group === 'header' && key === 'alarms') {
          const existing = this.restrictView.header.alarms;
          const existingFeatures = existing && typeof existing === 'object' ? existing.features : undefined;
          this.restrictView.header.alarms = existingFeatures
            ? { enabled: input.checked, features: existingFeatures }
            : input.checked;
          if (this.featureAccessSaveBtn) this.featureAccessSaveBtn.disabled = false;
          this.renderFeatureAccess();
          return;
        }

        this.restrictView[group][key] = input.checked;
        if (this.featureAccessSaveBtn) this.featureAccessSaveBtn.disabled = false;
      });
    });

    el.querySelectorAll<HTMLInputElement>('.um-alarm-sub-toggle').forEach((input) => {
      input.addEventListener('change', () => {
        const subKey = input.dataset.subkey!;
        if (!this.restrictView) this.restrictView = {};
        if (!this.restrictView.header) this.restrictView.header = {};
        const existing = this.restrictView.header.alarms;
        const parentEnabled = existing == null ? true : typeof existing === 'boolean' ? existing : existing.enabled !== false;
        const existingFeatures: Record<string, boolean> =
          existing && typeof existing === 'object' && existing.features
            ? { ...existing.features }
            : Object.fromEntries(UserDetailTab.ALARM_SUB_FEATURES.map((sf) => [sf.key, true]));
        existingFeatures[subKey] = input.checked;
        this.restrictView.header.alarms = { enabled: parentEnabled, features: existingFeatures };
        if (this.featureAccessSaveBtn) this.featureAccessSaveBtn.disabled = false;
      });
    });
  }

  /** Writes the full explicit true/false map back to `restrict_view` (USER SERVER_SCOPE). */
  private async saveFeatureAccess(btn: HTMLButtonElement): Promise<void> {
    // Belt-and-suspenders: the per-toggle `change` guard should already
    // prevent reaching this state via the UI, but Salvar must never persist
    // it regardless of how `this.restrictView` got here (stale data loaded
    // from a prior bad save, a re-render race, etc.) — a user must always be
    // able to see at least one content domain.
    const allMenuDisabled = UserDetailTab.MENU_MIN_ONE_KEYS.every((k) => !this.isFeatureEnabled('menu', k));
    if (allMenuDisabled) {
      MyIOToast.error('Pelo menos uma funcionalidade entre Energia, Água, Temperatura, Alarmes, Relatórios ou Metas precisa ficar habilitada.');
      return;
    }

    const { tbBaseUrl, jwtToken } = this.config;
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'Salvando...';
    try {
      const payload: Record<string, Record<string, RestrictViewNode>> = {};
      UserDetailTab.FEATURE_GROUPS.forEach((g) => {
        payload[g.group] = {};
        g.features.forEach((f) => {
          if (g.group === 'header' && f.key === 'alarms') {
            // RFC-0233 Phase 2: only emit the nested {enabled, features} shape
            // when at least one sub-feature is actually restricted — keeps the
            // stored JSON as the plain boolean everywhere else stays, and is
            // semantically identical either way per isFeatureVisible's resolver.
            const enabled = this.isFeatureEnabled('header', 'alarms');
            const features: Record<string, boolean> = {};
            let anyRestricted = false;
            UserDetailTab.ALARM_SUB_FEATURES.forEach((sf) => {
              const v = this.isAlarmSubFeatureEnabled(sf.key);
              features[sf.key] = v;
              if (!v) anyRestricted = true;
            });
            payload[g.group][f.key] = anyRestricted ? { enabled, features } : enabled;
            return;
          }
          payload[g.group][f.key] = this.isFeatureEnabled(g.group, f.key);
        });
      });
      const res = await fetch(`${tbBaseUrl}/api/plugins/telemetry/USER/${this.user.id.id}/SERVER_SCOPE`, {
        method: 'POST',
        headers: { 'X-Authorization': `Bearer ${jwtToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ restrict_view: payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.restrictView = payload;
      MyIOToast.success('Acesso em funcionalidades atualizado!');
    } catch (err) {
      console.error('[UserDetailTab] saveFeatureAccess error', err);
      MyIOToast.error('Erro ao salvar acesso em funcionalidades.');
      btn.disabled = false;
    } finally {
      btn.textContent = originalLabel || 'Salvar';
    }
  }

  /** Write user_role_assignments snapshot to ThingsBoard SERVER_SCOPE */
  private async writeTBSnapshot(): Promise<void> {
    const { tbBaseUrl, jwtToken } = this.config;
    this.assignmentsVersion += 1;
    const snapshot: UserRoleAssignmentsSnapshot = {
      updatedAt: new Date().toISOString(),
      version: this.assignmentsVersion,
      assignments: this.assignments
        .filter(a => a.status !== 'expired')
        .map(a => ({
          id: a.id,
          roleKey: a.roleKey,
          roleDisplayName: a.roleDisplayName,
          scope: a.scope,
          status: a.status,
          expiresAt: a.expiresAt,
          grantedAt: a.grantedAt,
          grantedBy: a.grantedBy,
          reason: a.reason,
        })),
    };
    try {
      await fetch(`${tbBaseUrl}/api/plugins/telemetry/USER/${this.user.id.id}/SERVER_SCOPE`, {
        method: 'POST',
        headers: { 'X-Authorization': `Bearer ${jwtToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_role_assignments: snapshot }),
      });
    } catch (err) {
      console.warn('[UserDetailTab] writeTBSnapshot failed (non-critical):', err);
    }
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
      MyIOToast.success('Usuário atualizado com sucesso!');
      this.callbacks.onUpdated(saved);
    } catch (err: any) {
      console.error('[UserDetailTab] handleSave error', err);
      MyIOToast.error('Erro ao salvar. Tente novamente.');
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
          MyIOToast.success('E-mail de redefinição de senha enviado!');
        } catch (err: any) {
          console.error('[UserDetailTab] resetPassword error', err);
          MyIOToast.error('Erro ao enviar e-mail de redefinição.');
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
          MyIOToast.success(`Usuário ${name} excluído.`);
          this.callbacks.onDeleted();
        } catch (err: any) {
          console.error('[UserDetailTab] delete error', err);
          MyIOToast.error('Erro ao excluir usuário. Verifique as permissões.');
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
