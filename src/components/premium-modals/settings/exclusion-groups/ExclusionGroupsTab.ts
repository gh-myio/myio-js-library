/**
 * ExclusionGroupsTab
 *
 * 4th tab in SettingsModalView (energy domain only).
 * Allows operators to exclude entire equipment groups from the energy grand-total calculation.
 * Config is stored as `exclude_groups_totals` on the DEVICE SERVER_SCOPE.
 */

// ============================================================================
// Types
// ============================================================================

export interface ExclusionGroupsTabConfig {
  container: HTMLElement;
  /** ThingsBoard Device UUID — attribute is saved on DEVICE SERVER_SCOPE */
  deviceId: string;
  jwtToken: string;
  tbBaseUrl: string;
  /** Optional pre-loaded value; if null the tab fetches it from TB on init */
  initialData?: ExcludeGroupsTotals | null;
}

export interface ExcludeGroupsTotals {
  enabled: boolean;
  groups: Record<
    'entrada' | 'lojas' | 'climatizacao' | 'elevadores' | 'escadas_rolantes' | 'outros' | 'area_comum',
    boolean
  >;
}

// ============================================================================
// Constants
// ============================================================================

const GROUP_DEFINITIONS: ReadonlyArray<{ key: string; label: string; description: string }> = [
  { key: 'entrada',          label: 'Entrada',             description: 'Subestações, Transformadores, RELOGIO' },
  { key: 'lojas',            label: 'Lojas',               description: 'Medidores de loja (3F_MEDIDOR)' },
  { key: 'climatizacao',     label: 'Climatização',        description: 'HVAC, Chillers, Fancoils, CAG' },
  { key: 'elevadores',       label: 'Elevadores',          description: 'Elevadores (ELV-)' },
  { key: 'escadas_rolantes', label: 'Esc. Rolantes',       description: 'Escadas Rolantes (ESC-)' },
  { key: 'outros',           label: 'Outros Equipamentos', description: 'Geradores, Iluminação, Bombas' },
  { key: 'area_comum',       label: 'Área Comum',          description: 'Calculado residualmente' },
];

const STYLES_ID = 'egt-styles';

// ============================================================================
// Class
// ============================================================================

export class ExclusionGroupsTab {
  private config: ExclusionGroupsTabConfig;
  private currentState: ExcludeGroupsTotals;

  constructor(config: ExclusionGroupsTabConfig) {
    this.config = config;
    this.currentState = this.buildDefaultState();
  }

  async init(): Promise<void> {
    this.config.container.innerHTML = this.getLoadingHTML();

    let state = this.config.initialData ?? null;
    if (!state) {
      state = await this.fetchCurrentState();
    }
    this.currentState = state ?? this.buildDefaultState();

    this.injectStyles();
    this.config.container.innerHTML = this.renderTab();
    this.attachListeners();
  }

  destroy(): void {
    // No external resources to clean up
  }

  // --------------------------------------------------------------------------
  // Private — data
  // --------------------------------------------------------------------------

  private buildDefaultState(): ExcludeGroupsTotals {
    return {
      enabled: false,
      groups: {
        entrada: false,
        lojas: false,
        climatizacao: false,
        elevadores: false,
        escadas_rolantes: false,
        outros: false,
        area_comum: false,
      },
    };
  }

  private localStorageKey(): string {
    return `egt_exclude_groups_${this.config.deviceId}`;
  }

  private async fetchCurrentState(): Promise<ExcludeGroupsTotals | null> {
    try {
      const { tbBaseUrl, deviceId, jwtToken } = this.config;
      const url = `${tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/attributes/SERVER_SCOPE?keys=exclude_groups_totals`;
      const res = await fetch(url, {
        headers: { 'X-Authorization': `Bearer ${jwtToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const attrs: Array<{ key: string; value: unknown }> = await res.json();
      const attr = attrs.find((a) => a.key === 'exclude_groups_totals');
      if (!attr) return null;
      const val = typeof attr.value === 'string' ? JSON.parse(attr.value) : attr.value;
      return val as ExcludeGroupsTotals;
    } catch {
      // Fallback: read from localStorage (showcase / offline mode)
      try {
        const raw = localStorage.getItem(this.localStorageKey());
        if (raw) return JSON.parse(raw) as ExcludeGroupsTotals;
      } catch { /* ignore */ }
      return null;
    }
  }

  private collectState(): ExcludeGroupsTotals {
    const c = this.config.container;
    const enabled = (c.querySelector<HTMLInputElement>('#egt-enabled'))?.checked ?? false;
    const groups = {} as ExcludeGroupsTotals['groups'];
    c.querySelectorAll<HTMLInputElement>('.egt-group-check').forEach((cb) => {
      const key = cb.dataset.group as keyof ExcludeGroupsTotals['groups'];
      if (key) groups[key] = cb.checked;
    });
    return { enabled, groups };
  }

  private async handleSave(): Promise<void> {
    const c = this.config.container;
    const saveBtn = c.querySelector<HTMLButtonElement>('#egt-save-btn');
    const msgEl = c.querySelector<HTMLElement>('#egt-save-msg');

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvando…'; }
    if (msgEl) { msgEl.style.display = 'none'; }

    const newState = this.collectState();

    try {
      const { tbBaseUrl, deviceId, jwtToken } = this.config;
      const url = `${tbBaseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/attributes/SERVER_SCOPE`;
      let savedToTB = false;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'X-Authorization': `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exclude_groups_totals: { ...newState, lastUpdatedTime: Date.now() },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        savedToTB = true;
      } catch (tbErr) {
        console.warn('[ExclusionGroupsTab] TB save failed, using localStorage fallback:', tbErr);
      }

      // Always persist to localStorage as cache / showcase fallback
      try {
        localStorage.setItem(this.localStorageKey(), JSON.stringify(newState));
      } catch { /* ignore quota/private-mode errors */ }

      this.currentState = newState;
      this.showMsg(
        msgEl,
        savedToTB ? 'Exclusões salvas com sucesso.' : 'Salvo localmente (TB indisponível).',
        savedToTB ? '#16a34a' : '#d97706'
      );

      window.dispatchEvent(
        new CustomEvent('myio:device-exclusion-updated', {
          detail: { 
            deviceId: this.config.deviceId,
            exclude_groups_totals: newState 
          },
        })
      );
    } catch (err) {
      this.showMsg(msgEl, 'Erro ao salvar. Tente novamente.', '#dc2626');
      console.error('[ExclusionGroupsTab] Save failed:', err);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; }
    }
  }

  // --------------------------------------------------------------------------
  // Private — render
  // --------------------------------------------------------------------------

  private getLoadingHTML(): string {
    return `
      <div style="padding: 20px; text-align: center; color: #6c757d;">
        <div class="loading-spinner"></div>
        <p>Carregando configurações de exclusão...</p>
      </div>`;
  }

  private renderTab(): string {
    const s = this.currentState;
    const gridDisabled = !s.enabled;

    return `
      <div class="egt-tab">

        <!-- Master toggle section -->
        <div class="egt-section egt-section--master">
          <div class="egt-section-header">
            <svg class="egt-section-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
            <div>
              <div class="egt-section-title">Exclusão de Grupos de Cálculo</div>
              <div class="egt-section-sub">
                Habilite para excluir grupos específicos do total geral de energia.
                Os grupos marcados não serão somados ao total, mas permanecem visíveis no painel.
              </div>
            </div>
          </div>
          <label class="egt-master-toggle" for="egt-enabled">
            <input type="checkbox" id="egt-enabled" ${s.enabled ? 'checked' : ''}>
            <span class="egt-toggle-track"></span>
            <span class="egt-toggle-label">Ativar exclusão de grupos</span>
          </label>
        </div>

        <!-- Groups grid section -->
        <div class="egt-section egt-section--groups" id="egt-groups-section"
             style="${gridDisabled ? 'opacity:0.45;pointer-events:none;' : ''}">
          <div class="egt-section-header">
            <svg class="egt-section-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <div>
              <div class="egt-section-title">Grupos de Equipamentos</div>
              <div class="egt-section-sub">
                Marque os grupos a serem excluídos do total de energia.
              </div>
            </div>
          </div>
          <div class="egt-group-list">
            ${GROUP_DEFINITIONS.map((g) =>
              this.renderGroupRow(g.key, g.label, g.description, !!(s.groups as Record<string, boolean>)[g.key], gridDisabled)
            ).join('')}
          </div>
          <div class="egt-info-banner">
            <strong>Área Comum</strong> é calculada residualmente (Entrada − subcategorias).
            Excluí-la remove sua parcela residual do total, sem alterar os demais grupos.
          </div>
        </div>

        <!-- Footer -->
        <div class="egt-footer">
          <span class="egt-save-msg" id="egt-save-msg" style="display:none;"></span>
          <button type="button" class="egt-btn-save" id="egt-save-btn">
            Salvar
          </button>
        </div>

      </div>`;
  }

  private renderGroupRow(key: string, label: string, description: string, excluded: boolean, disabled: boolean): string {
    const isAreaComum = key === 'area_comum';
    return `
      <div class="egt-group-row${excluded ? ' egt-group-row--checked' : ''}" data-group="${this.esc(key)}">
        <label class="egt-group-label">
          <input type="checkbox" class="egt-group-check" data-group="${this.esc(key)}" ${excluded ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
          <div class="egt-group-info">
            <span class="egt-group-name">${this.esc(label)}</span>
            <span class="egt-group-desc">${this.esc(description)}</span>
            ${isAreaComum ? '<span class="egt-group-badge egt-group-badge--residual">Residual</span>' : ''}
          </div>
        </label>
        <span class="egt-group-status">${excluded ? 'Excluído' : 'Incluído'}</span>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // Private — event listeners
  // --------------------------------------------------------------------------

  private attachListeners(): void {
    const c = this.config.container;

    // Master toggle — enable/disable the groups grid
    const enabledCb = c.querySelector<HTMLInputElement>('#egt-enabled');
    const groupsSection = c.querySelector<HTMLElement>('#egt-groups-section');
    const groupCheckboxes = c.querySelectorAll<HTMLInputElement>('.egt-group-check');
    enabledCb?.addEventListener('change', () => {
      const on = enabledCb.checked;
      if (groupsSection) {
        groupsSection.style.opacity = on ? '1' : '0.45';
        groupsSection.style.pointerEvents = on ? '' : 'none';
      }
      groupCheckboxes.forEach((cb) => { cb.disabled = !on; });
    });

    // Group checkboxes — visual feedback on rows
    c.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.classList.contains('egt-group-check')) return;
      const row = target.closest<HTMLElement>('.egt-group-row');
      if (!row) return;
      row.classList.toggle('egt-group-row--checked', target.checked);
      const statusEl = row.querySelector<HTMLElement>('.egt-group-status');
      if (statusEl) statusEl.textContent = target.checked ? 'Excluído' : 'Incluído';
    });

    // Save button
    c.querySelector<HTMLButtonElement>('#egt-save-btn')?.addEventListener('click', () => {
      this.handleSave();
    });
  }

  // --------------------------------------------------------------------------
  // Private — utilities
  // --------------------------------------------------------------------------

  private showMsg(el: HTMLElement | null, text: string, color: string): void {
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
    el.style.display = 'inline';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  private esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private injectStyles(): void {
    if (document.getElementById(STYLES_ID)) return;
    const style = document.createElement('style');
    style.id = STYLES_ID;
    style.textContent = `
      /* ExclusionGroupsTab styles */
      .egt-tab {
        display: flex;
        flex-direction: column;
        background: #fff;
        border-radius: 8px;
        overflow: hidden;
      }

      .egt-section {
        padding: 20px 24px;
        border-bottom: 1px solid #e5e7eb;
        transition: opacity 0.2s;
      }

      .egt-section--groups {
        /* no overflow — modal-body handles scrolling */
      }

      .egt-section-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
      }

      .egt-section-icon {
        flex-shrink: 0;
        margin-top: 1px;
      }

      .egt-section-title {
        font-size: 14px;
        font-weight: 600;
        color: #111827;
        margin-bottom: 3px;
      }

      .egt-section-sub {
        font-size: 12px;
        color: #6b7280;
        line-height: 1.5;
      }

      /* Master toggle */
      .egt-master-toggle {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        user-select: none;
        font-size: 13px;
        color: #374151;
        font-weight: 500;
        padding: 8px 14px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        transition: background 0.15s, border-color 0.15s;
      }

      .egt-master-toggle:hover {
        background: #f3f4f6;
        border-color: #d1d5db;
      }

      .egt-master-toggle input[type="checkbox"] {
        display: none;
      }

      .egt-toggle-track {
        width: 38px;
        height: 22px;
        border-radius: 11px;
        background: #d1d5db;
        transition: background 0.2s;
        flex-shrink: 0;
        position: relative;
      }

      .egt-master-toggle input:checked ~ .egt-toggle-track,
      .egt-master-toggle input:checked + .egt-toggle-track {
        background: #2563eb;
      }

      .egt-toggle-track::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,.2);
      }

      .egt-master-toggle input:checked ~ .egt-toggle-track::after,
      .egt-master-toggle input:checked + .egt-toggle-track::after {
        transform: translateX(16px);
      }

      /* Group list */
      .egt-group-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 12px;
      }

      .egt-group-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
      }

      .egt-group-row:hover {
        border-color: #d1d5db;
        background: #f3f4f6;
      }

      .egt-group-row--checked {
        border-color: #fca5a5;
        background: #fef2f2;
      }

      .egt-group-row--checked:hover {
        border-color: #f87171;
      }

      .egt-group-label {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        flex: 1;
        user-select: none;
      }

      .egt-group-check {
        width: 15px;
        height: 15px;
        accent-color: #dc2626;
        flex-shrink: 0;
        cursor: pointer;
      }

      .egt-group-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .egt-group-name {
        font-size: 13px;
        font-weight: 500;
        color: #111827;
      }

      .egt-group-desc {
        font-size: 11px;
        color: #9ca3af;
      }

      .egt-group-badge {
        display: inline-block;
        font-size: 10px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 4px;
        margin-top: 2px;
        width: fit-content;
      }

      .egt-group-badge--residual {
        background: #eff6ff;
        color: #3b82f6;
        border: 1px solid #bfdbfe;
      }

      .egt-group-status {
        font-size: 11px;
        font-weight: 500;
        color: #9ca3af;
        flex-shrink: 0;
        margin-left: 8px;
      }

      .egt-group-row--checked .egt-group-status {
        color: #dc2626;
      }

      .egt-info-banner {
        padding: 10px 14px;
        background: #fffbeb;
        border: 1px solid #fcd34d;
        border-radius: 6px;
        font-size: 12px;
        color: #92400e;
        line-height: 1.5;
      }

      /* Footer */
      .egt-footer {
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        border-top: 1px solid #e5e7eb;
        background: #fff;
        flex-shrink: 0;
      }

      .egt-save-msg {
        font-size: 13px;
      }

      .egt-btn-save {
        padding: 8px 20px;
        border-radius: 6px;
        border: none;
        background: #2563eb;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
      }

      .egt-btn-save:hover:not(:disabled) {
        background: #1d4ed8;
      }

      .egt-btn-save:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }
}
