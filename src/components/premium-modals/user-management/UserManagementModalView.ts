import { UserManagementConfig, TBUser } from './types';
import { UserListTab } from './tabs/UserListTab';
import { NewUserTab } from './tabs/NewUserTab';
import { GroupManagementTab } from './tabs/GroupManagementTab';
import { UserDetailTab } from './tabs/UserDetailTab';

interface TabEntry {
  key: string;
  label: string;
  closeable: boolean;
  getEl(): HTMLElement;
  onActivate?(): void;
  /** For user-detail tabs */
  userId?: string;
  detailTab?: UserDetailTab;
}

export class UserManagementModalView {
  private config: UserManagementConfig;
  private themeMode: 'light' | 'dark';
  private backdrop!: HTMLElement;
  private modalEl!: HTMLElement;
  private tabBarEl!: HTMLElement;
  private contentEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private tabs: TabEntry[] = [];
  private activeTabKey = 'user-list';
  private userListTab!: UserListTab;
  private newUserTab!: NewUserTab;

  constructor(config: UserManagementConfig) {
    this.config = config;
    this.themeMode = config.theme ?? 'light';
  }

  render(): void {
    this.injectStyles();
    this.buildDOM();
    this.buildTabs();
    this.activateTab('user-list');
    document.body.appendChild(this.backdrop);
  }

  destroy(): void {
    this.backdrop?.remove();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.className = `um-toast um-toast--${type} um-toast--visible`;
    setTimeout(() => { this.toastEl.classList.remove('um-toast--visible'); }, 3500);
  }

  // ── DOM ──────────────────────────────────────────────────────────────────────

  private buildDOM(): void {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'um-backdrop';
    this.backdrop.setAttribute('data-theme', this.themeMode);

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'um-modal';

    const customerName = this.config.customerName || '';

    // Header
    const header = document.createElement('div');
    header.className = 'um-modal-header';
    header.innerHTML = `
      <div class="um-modal-header-left">
        <span class="um-modal-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </span>
        <span class="um-modal-title">Gestão de Usuários</span>
        ${customerName ? `<span class="um-modal-subtitle">· ${this.esc(customerName)}</span>` : ''}
      </div>
      <button class="um-modal-close" title="Fechar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    header.querySelector('.um-modal-close')!.addEventListener('click', () => this.close());

    // Tab bar
    this.tabBarEl = document.createElement('div');
    this.tabBarEl.className = 'um-tab-bar';

    // Content area
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'um-modal-content';

    // Toast
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'um-toast';

    this.modalEl.appendChild(header);
    this.modalEl.appendChild(this.tabBarEl);
    this.modalEl.appendChild(this.contentEl);
    this.modalEl.appendChild(this.toastEl);
    this.backdrop.appendChild(this.modalEl);

    // Close on backdrop click
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }

  private close(): void {
    this.config.onClose();
    this.destroy();
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  private buildTabs(): void {
    const config = this.config;

    // Tab 1: User List
    this.userListTab = new UserListTab(config, {
      onOpenUserDetail: (user, editMode) => this.openUserDetailTab(user, editMode),
      onSwitchToNewUser: () => this.activateTab('new-user'),
      showToast: (msg, type) => this.showToast(msg, type),
    });
    let userListEl: HTMLElement | null = null;
    this.tabs.push({
      key: 'user-list',
      label: 'Usuários',
      closeable: false,
      getEl: () => { if (!userListEl) userListEl = this.userListTab.render(); return userListEl; },
    });

    // Tab 2: New User
    this.newUserTab = new NewUserTab(config, {
      onCreated: (userId) => {
        this.activateTab('user-list');
        this.userListTab.refresh(userId);
      },
      onCancel: () => this.activateTab('user-list'),
      showToast: (msg, type) => this.showToast(msg, type),
    });
    let newUserEl: HTMLElement | null = null;
    this.tabs.push({
      key: 'new-user',
      label: 'Novo Usuário',
      closeable: false,
      getEl: () => { if (!newUserEl) newUserEl = this.newUserTab.render(); return newUserEl; },
      onActivate: () => this.newUserTab.reset(),
    });

    // Tab 3: Group Management — Channels + GCDR groups + dispatch matrix
    const groupTab = new GroupManagementTab(config, {
      showToast: (msg, type) => this.showToast(msg, type),
    });
    let groupTabEl: HTMLElement | null = null;
    this.tabs.push({
      key: 'groups',
      label: 'Grupos',
      closeable: false,
      getEl: () => {
        if (!groupTabEl) groupTabEl = groupTab.render();
        return groupTabEl;
      },
    });

    this.rebuildTabBar();
  }

  private openUserDetailTab(user: TBUser, editMode = false): void {
    const existingKey = `user-detail-${user.id.id}`;
    const existing = this.tabs.find(t => t.key === existingKey);

    if (existing) {
      this.activateTab(existingKey);
      existing.detailTab?.focus();
      return;
    }

    const detailTab = new UserDetailTab(this.config, user, {
      onDeleted: () => {
        this.removeTab(existingKey);
        this.userListTab.refresh();
      },
      onUpdated: (updated) => {
        this.userListTab.refresh(updated.id.id);
        // Update tab label in case name changed
        const entry = this.tabs.find(t => t.key === existingKey);
        if (entry) { entry.label = detailTab.tabLabel; this.rebuildTabBar(); }
      },
      showToast: (msg, type) => this.showToast(msg, type),
    });

    // If opening in edit mode, toggle immediately after render by simulating click
    let el: HTMLElement | null = null;
    this.tabs.push({
      key: existingKey,
      label: detailTab.tabLabel,
      closeable: true,
      userId: user.id.id,
      detailTab,
      getEl: () => {
        el = detailTab.render();
        if (editMode) {
          // Simulate click on edit button after render
          setTimeout(() => el?.querySelector<HTMLButtonElement>('.um-detail-edit-btn')?.click(), 0);
        }
        return el;
      },
    });

    this.rebuildTabBar();
    this.activateTab(existingKey);
  }

  private removeTab(key: string): void {
    const idx = this.tabs.findIndex(t => t.key === key);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);
    if (this.activeTabKey === key) {
      this.activateTab('user-list');
    } else {
      this.rebuildTabBar();
    }
  }

  private activateTab(key: string): void {
    const entry = this.tabs.find(t => t.key === key);
    if (!entry) return;

    this.activeTabKey = key;
    entry.onActivate?.();

    // Move tab element into content area (reuse cached DOM — no re-render)
    const tabEl = entry.getEl();
    if (tabEl.parentElement !== this.contentEl) {
      this.contentEl.innerHTML = '';
      this.contentEl.appendChild(tabEl);
    }

    this.rebuildTabBar();
  }

  private rebuildTabBar(): void {
    this.tabBarEl.innerHTML = '';
    for (const tab of this.tabs) {
      const btn = document.createElement('button');
      btn.className = `um-tab-btn${tab.key === this.activeTabKey ? ' um-tab-btn--active' : ''}`;
      btn.textContent = tab.label;
      btn.addEventListener('click', () => this.activateTab(tab.key));

      if (tab.closeable) {
        const close = document.createElement('span');
        close.className = 'um-tab-close';
        close.innerHTML = '✕';
        close.title = 'Fechar aba';
        close.addEventListener('click', (e) => { e.stopPropagation(); this.removeTab(tab.key); });
        btn.appendChild(close);
      }

      this.tabBarEl.appendChild(btn);
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  private injectStyles(): void {
    if (document.getElementById('um-styles')) return;
    const style = document.createElement('style');
    style.id = 'um-styles';
    style.textContent = `
/* === UserManagement Modal — CSS variables (light defaults, dark overrides) === */
.um-backdrop {
  /* Light theme defaults */
  --um-modal-bg: #ffffff;
  --um-modal-border: #e2e8f0;
  --um-header-border: #e2e8f0;
  --um-text: #1e293b;
  --um-text-muted: #64748b;
  --um-text-subtle: #94a3b8;
  --um-text-cell: #334155;
  --um-icon-color: #3b82f6;
  --um-close-hover-bg: #f1f5f9;
  --um-close-hover-text: #1e293b;
  --um-tab-active-color: #3b5bdb;
  --um-tab-close-hover: #f1f5f9;
  --um-input-bg: #f8fafc;
  --um-input-border: #e2e8f0;
  --um-input-focus: #3b5bdb;
  --um-input-text: #1e293b;
  --um-input-placeholder: #94a3b8;
  --um-search-icon: #94a3b8;
  --um-row-border: #e2e8f0;
  --um-row-hover: #f8fafc;
  --um-row-highlight: #f0fdf4;
  --um-btn-primary-bg: #3b5bdb;
  --um-btn-primary-hover: #4c6ef5;
  --um-btn-secondary-bg: #f1f5f9;
  --um-btn-secondary-text: #3b5bdb;
  --um-btn-secondary-border: #bfdbfe;
  --um-btn-secondary-hover: #e2e8f0;
  --um-btn-ghost-bg: transparent;
  --um-btn-ghost-border: #e2e8f0;
  --um-btn-ghost-text: #64748b;
  --um-btn-ghost-hover-bg: #f8fafc;
  --um-btn-ghost-hover-text: #334155;
  --um-btn-danger-bg: #fef2f2;
  --um-btn-danger-text: #ef4444;
  --um-btn-danger-border: #fecaca;
  --um-btn-danger-hover: #fee2e2;
  --um-badge-admin-bg: #dbeafe;
  --um-badge-admin-text: #1d4ed8;
  --um-badge-user-bg: #dcfce7;
  --um-badge-user-text: #15803d;
  --um-toast-success-bg: #f0fdf4;
  --um-toast-success-border: #86efac;
  --um-toast-success-text: #15803d;
  --um-toast-error-bg: #fef2f2;
  --um-toast-error-border: #fca5a5;
  --um-toast-error-text: #dc2626;
  --um-detail-section-border: #e2e8f0;
  --um-detail-row-border: #f1f5f9;
  --um-profiles-notice-bg: #f0f4ff;
  --um-profiles-notice-border: #c7d2fe;
  --um-scrollbar-thumb: #e2e8f0;
  --um-spinner-border: #e2e8f0;
  --um-spinner-top: #3b82f6;
  --um-icon-btn-hover-bg: #dbeafe;
  --um-icon-btn-hover-text: #3b82f6;
  --um-label-text: #64748b;
  --um-req-color: #ef4444;
  --um-field-error-color: #ef4444;
}

/* Dark theme overrides */
.um-backdrop[data-theme="dark"] {
  --um-modal-bg: #131929;
  --um-modal-border: #2a3352;
  --um-header-border: #1e2d4a;
  --um-text: #e2e8f0;
  --um-text-muted: #64748b;
  --um-text-subtle: #94a3b8;
  --um-text-cell: #c4ccd9;
  --um-icon-color: #60a5fa;
  --um-close-hover-bg: #1e2d4a;
  --um-close-hover-text: #e2e8f0;
  --um-tab-active-color: #60a5fa;
  --um-tab-close-hover: #3a4160;
  --um-input-bg: #1a2235;
  --um-input-border: #2a3352;
  --um-input-focus: #3b5bdb;
  --um-input-text: #e2e8f0;
  --um-input-placeholder: #475569;
  --um-search-icon: #475569;
  --um-row-border: #0f1829;
  --um-row-hover: #0f1829;
  --um-row-highlight: #0e2a1e;
  --um-btn-primary-bg: #3b5bdb;
  --um-btn-primary-hover: #4c6ef5;
  --um-btn-secondary-bg: #1e2d4a;
  --um-btn-secondary-text: #93c5fd;
  --um-btn-secondary-border: #2a3b60;
  --um-btn-secondary-hover: #253456;
  --um-btn-ghost-bg: transparent;
  --um-btn-ghost-border: #2a3352;
  --um-btn-ghost-text: #64748b;
  --um-btn-ghost-hover-bg: #1a2235;
  --um-btn-ghost-hover-text: #94a3b8;
  --um-btn-danger-bg: #7f1d1d;
  --um-btn-danger-text: #fca5a5;
  --um-btn-danger-border: #991b1b;
  --um-btn-danger-hover: #991b1b;
  --um-badge-admin-bg: #1e3a5f;
  --um-badge-admin-text: #60a5fa;
  --um-badge-user-bg: #1a2d24;
  --um-badge-user-text: #4ade80;
  --um-toast-success-bg: #1e3a2e;
  --um-toast-success-border: #22c55e;
  --um-toast-success-text: #4ade80;
  --um-toast-error-bg: #3b1a1a;
  --um-toast-error-border: #ef4444;
  --um-toast-error-text: #f87171;
  --um-detail-section-border: #1e2d4a;
  --um-detail-row-border: #0f1829;
  --um-profiles-notice-bg: #1a2537;
  --um-profiles-notice-border: #2a3b60;
  --um-scrollbar-thumb: #2a3352;
  --um-spinner-border: #2a3352;
  --um-spinner-top: #60a5fa;
  --um-icon-btn-hover-bg: #1a2a45;
  --um-icon-btn-hover-text: #60a5fa;
  --um-label-text: #94a3b8;
  --um-req-color: #f87171;
  --um-field-error-color: #f87171;
}

/* === Layout === */
.um-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 99999;
  padding: 16px;
}
.um-modal {
  background: var(--um-modal-bg);
  border: 1px solid var(--um-modal-border);
  border-radius: 14px;
  width: 92vw; max-width: 960px;
  aspect-ratio: 16/9;
  display: flex; flex-direction: column;
  box-shadow: 0 32px 80px rgba(0,0,0,0.6);
  overflow: hidden;
  position: relative;
}
@media (max-height: 600px) { .um-modal { aspect-ratio: unset; height: 90vh; } }

/* Header */
.um-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--um-header-border);
  flex-shrink: 0;
}
.um-modal-header-left { display: flex; align-items: center; gap: 10px; }
.um-modal-icon { color: var(--um-icon-color); display: flex; }
.um-modal-title { font-size: 15px; font-weight: 600; color: var(--um-text); }
.um-modal-subtitle { font-size: 13px; color: var(--um-text-muted); }
.um-modal-close {
  background: none; border: none; cursor: pointer;
  color: var(--um-text-muted); padding: 4px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.um-modal-close:hover { color: var(--um-close-hover-text); background: var(--um-close-hover-bg); }

/* Tab bar */
.um-tab-bar {
  display: flex; gap: 2px; padding: 0 16px;
  border-bottom: 1px solid var(--um-header-border); flex-shrink: 0;
  overflow-x: auto; scrollbar-width: none;
}
.um-tab-bar::-webkit-scrollbar { display: none; }
.um-tab-btn {
  background: none; border: none; cursor: pointer;
  color: var(--um-text-muted); font-size: 12px; font-weight: 500;
  padding: 10px 14px; border-bottom: 2px solid transparent;
  white-space: nowrap; display: flex; align-items: center; gap: 6px;
  transition: color 0.15s, border-color 0.15s;
}
.um-tab-btn:hover { color: var(--um-text-subtle); }
.um-tab-btn--active { color: var(--um-tab-active-color); border-bottom-color: var(--um-tab-active-color); }
.um-tab-close {
  font-size: 9px; color: var(--um-text-muted); padding: 2px 3px;
  border-radius: 3px; line-height: 1; cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.um-tab-close:hover { background: var(--um-tab-close-hover); color: var(--um-text); }

/* Content */
.um-modal-content {
  flex: 1; overflow-y: auto; padding: 20px;
  scrollbar-width: thin; scrollbar-color: var(--um-scrollbar-thumb) transparent;
}
.um-modal-content::-webkit-scrollbar { width: 6px; }
.um-modal-content::-webkit-scrollbar-thumb { background: var(--um-scrollbar-thumb); border-radius: 3px; }

/* Toast */
.um-toast {
  position: absolute; bottom: 16px; right: 16px;
  background: var(--um-toast-success-bg); border: 1px solid var(--um-toast-success-border);
  color: var(--um-toast-success-text); font-size: 12px; font-weight: 500;
  padding: 10px 16px; border-radius: 8px;
  opacity: 0; transform: translateY(8px);
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none; z-index: 10;
  max-width: 300px;
}
.um-toast--error { background: var(--um-toast-error-bg); border-color: var(--um-toast-error-border); color: var(--um-toast-error-text); }
.um-toast--visible { opacity: 1; transform: translateY(0); }

/* Tab content */
.um-tab-content { min-height: 100%; }

/* Toolbar */
.um-list-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 16px;
}
.um-search-wrap {
  position: relative; flex: 1; max-width: 360px;
}
.um-search-icon {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  color: var(--um-search-icon); pointer-events: none;
}
.um-search-input {
  width: 100%; background: var(--um-input-bg); border: 1px solid var(--um-input-border);
  border-radius: 8px; padding: 7px 12px 7px 32px;
  color: var(--um-input-text); font-size: 13px; outline: none;
  transition: border-color 0.15s;
}
.um-search-input:focus { border-color: var(--um-input-focus); }
.um-search-input::placeholder { color: var(--um-input-placeholder); }

/* Table */
.um-table-wrap { position: relative; overflow-x: auto; }
.um-table {
  width: 100%; border-collapse: collapse; font-size: 13px;
}
.um-table th {
  text-align: left; padding: 8px 12px;
  color: var(--um-text-muted); font-weight: 500; font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid var(--um-header-border);
}
.um-table td {
  padding: 10px 12px; color: var(--um-text-cell);
  border-bottom: 1px solid var(--um-row-border);
}
.um-table tr:hover td { background: var(--um-row-hover); }
.um-col-actions { width: 80px; text-align: center; }
.um-row--highlight td { background: var(--um-row-highlight) !important; }

/* List states */
.um-list-empty, .um-list-loading, .um-profiles-loading,
.um-profiles-empty, .um-profiles-error {
  text-align: center; padding: 32px 16px; color: var(--um-text-muted); font-size: 13px;
}

/* Pagination */
.um-pagination {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; margin-top: 16px; font-size: 12px; color: var(--um-text-muted);
}

/* Icon buttons */
.um-icon-btn {
  background: none; border: none; cursor: pointer;
  color: var(--um-text-muted); padding: 5px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.um-icon-btn:hover { color: var(--um-icon-btn-hover-text); background: var(--um-icon-btn-hover-bg); }

/* Buttons */
.um-btn {
  border: none; cursor: pointer; font-size: 13px; font-weight: 500;
  padding: 8px 16px; border-radius: 8px; transition: opacity 0.15s, background 0.15s;
}
.um-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.um-btn--primary { background: var(--um-btn-primary-bg); color: #fff; }
.um-btn--primary:hover:not(:disabled) { background: var(--um-btn-primary-hover); }
.um-btn--secondary { background: var(--um-btn-secondary-bg); color: var(--um-btn-secondary-text); border: 1px solid var(--um-btn-secondary-border); }
.um-btn--secondary:hover:not(:disabled) { background: var(--um-btn-secondary-hover); }
.um-btn--ghost { background: var(--um-btn-ghost-bg); color: var(--um-btn-ghost-text); border: 1px solid var(--um-btn-ghost-border); }
.um-btn--ghost:hover:not(:disabled) { background: var(--um-btn-ghost-hover-bg); color: var(--um-btn-ghost-hover-text); }
.um-btn--danger { background: var(--um-btn-danger-bg); color: var(--um-btn-danger-text); border: 1px solid var(--um-btn-danger-border); }
.um-btn--danger:hover:not(:disabled) { background: var(--um-btn-danger-hover); }
.um-btn--sm { padding: 6px 12px; font-size: 12px; }

/* Badges */
.um-badge {
  display: inline-block; font-size: 10px; font-weight: 600;
  padding: 2px 8px; border-radius: 9999px;
}
.um-badge--admin { background: var(--um-badge-admin-bg); color: var(--um-badge-admin-text); }
.um-badge--user  { background: var(--um-badge-user-bg); color: var(--um-badge-user-text); }

/* Forms */
.um-form { display: flex; flex-direction: column; gap: 14px; max-width: 560px; }
.um-form-row { display: flex; gap: 12px; }
.um-form-row .um-form-group { flex: 1; }
.um-form-group { display: flex; flex-direction: column; gap: 5px; }
.um-form-group--check { flex-direction: row; align-items: center; }
.um-label { font-size: 12px; font-weight: 500; color: var(--um-label-text); }
.um-req { color: var(--um-req-color); }
.um-input {
  background: var(--um-input-bg); border: 1px solid var(--um-input-border);
  border-radius: 8px; padding: 8px 12px;
  color: var(--um-input-text); font-size: 13px; outline: none; width: 100%;
  transition: border-color 0.15s; box-sizing: border-box;
}
.um-input:focus { border-color: var(--um-input-focus); }
.um-textarea { resize: vertical; min-height: 64px; }
.um-field-error { font-size: 11px; color: var(--um-field-error-color); min-height: 14px; }
.um-check-label { font-size: 13px; color: var(--um-label-text); cursor: pointer; display: flex; align-items: center; gap: 8px; }
.um-form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }

/* Detail card */
.um-detail-card { max-width: 560px; }
.um-detail-section { border: 1px solid var(--um-detail-section-border); border-radius: 10px; overflow: hidden; margin-bottom: 20px; }
.um-detail-row {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 11px 16px; border-bottom: 1px solid var(--um-detail-row-border);
}
.um-detail-row:last-child { border-bottom: none; }
.um-detail-label { width: 100px; font-size: 12px; color: var(--um-text-muted); font-weight: 500; flex-shrink: 0; padding-top: 1px; }
.um-detail-value { font-size: 13px; color: var(--um-text-cell); flex: 1; }
.um-detail-actions { display: flex; gap: 8px; flex-wrap: wrap; }

/* Profiles */
.um-profiles-header { margin-bottom: 16px; }
.um-profiles-title { font-size: 14px; font-weight: 600; color: var(--um-text); margin: 0; }
.um-profiles-notice {
  display: flex; align-items: center; gap: 8px;
  margin-top: 16px; padding: 10px 14px;
  background: var(--um-profiles-notice-bg); border: 1px solid var(--um-profiles-notice-border); border-radius: 8px;
  font-size: 12px; color: var(--um-text-muted);
}

/* Spinner */
.um-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid var(--um-spinner-border); border-top-color: var(--um-spinner-top);
  border-radius: 50%; animation: um-spin 0.7s linear infinite;
}
@keyframes um-spin { to { transform: rotate(360deg); } }

/* === GroupManagementTab === */
.gm-subtabs {
  display: flex; gap: 2px; margin-bottom: 16px;
  border-bottom: 1px solid #1e2d4a;
}
.gm-subtab {
  background: none; border: none; cursor: pointer;
  color: #64748b; font-size: 12px; font-weight: 500;
  padding: 8px 14px; border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.gm-subtab:hover { color: #94a3b8; }
.gm-subtab--active { color: #60a5fa; border-bottom-color: #60a5fa; }

.gm-section-toolbar, .gm-sidebar-toolbar {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
}
.gm-section-label { font-size: 12px; color: #64748b; font-weight: 500; }

/* Channels */
.gm-channels-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.gm-channel-card {
  display: flex; align-items: center; justify-content: space-between;
  background: #0f1829; border: 1px solid #1e2d4a; border-radius: 10px;
  padding: 10px 14px; gap: 12px;
}
.gm-channel-card-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.gm-channel-card-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.gm-channel-icon { font-size: 16px; }
.gm-channel-info { display: flex; flex-direction: column; min-width: 0; }
.gm-channel-name { font-size: 13px; font-weight: 600; color: #c4ccd9; }
.gm-channel-summary { font-size: 11px; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Toggle switch */
.gm-toggle { position: relative; display: inline-block; width: 34px; height: 18px; cursor: pointer; }
.gm-toggle-input { opacity: 0; width: 0; height: 0; position: absolute; }
.gm-toggle-slider {
  position: absolute; inset: 0; background: #2a3352; border-radius: 9px;
  transition: background 0.2s;
}
.gm-toggle-slider::before {
  content: ''; position: absolute; width: 12px; height: 12px;
  left: 3px; top: 3px; background: #fff; border-radius: 50%;
  transition: transform 0.2s;
}
.gm-toggle-input:checked + .gm-toggle-slider { background: #22c55e; }
.gm-toggle-input:checked + .gm-toggle-slider::before { transform: translateX(16px); }

/* Groups layout */
.gm-groups-layout { display: flex; gap: 16px; height: 100%; min-height: 0; }
.gm-groups-sidebar {
  width: 200px; flex-shrink: 0; border-right: 1px solid #1e2d4a; padding-right: 12px;
}
.gm-groups-detail { flex: 1; overflow-y: auto; min-width: 0; }
.gm-group-item {
  padding: 8px 10px; border-radius: 8px; cursor: pointer;
  transition: background 0.15s; margin-bottom: 4px;
}
.gm-group-item:hover { background: #0f1829; }
.gm-group-item--active { background: #0f1829; border: 1px solid #2a3b60; }
.gm-group-item-name { font-size: 13px; color: #c4ccd9; font-weight: 500; margin-bottom: 4px; }
.gm-group-item-meta { display: flex; flex-wrap: wrap; gap: 4px; }
.gm-detail-placeholder {
  display: flex; align-items: center; justify-content: center;
  height: 120px; color: #475569; font-size: 13px;
}

/* Badges */
.gm-badge {
  display: inline-block; font-size: 9px; font-weight: 600;
  padding: 2px 6px; border-radius: 9999px;
}
.gm-badge--domain { background: #1a2537; color: #60a5fa; }
.gm-badge--count { background: #1e2d4a; color: #94a3b8; }
.gm-badge--sev { text-transform: uppercase; }
.gm-badge--sev-critical { background: #3b1a1a; color: #f87171; }
.gm-badge--sev-high    { background: #3b2a0f; color: #fbbf24; }
.gm-badge--sev-medium  { background: #1a2a3b; color: #60a5fa; }
.gm-badge--sev-low     { background: #1a2a24; color: #4ade80; }

/* Detail */
.gm-detail-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px; gap: 8px;
}
.gm-detail-title { font-size: 15px; font-weight: 600; color: #e2e8f0; margin-right: 8px; }
.gm-detail-section { margin-bottom: 20px; }
.gm-detail-section-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.gm-detail-section-title { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }

/* Members */
.gm-members-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.gm-member-chip {
  display: flex; align-items: center; gap: 6px;
  background: #0f1829; border: 1px solid #1e2d4a; border-radius: 8px; padding: 5px 8px;
}
.gm-member-icon { font-size: 12px; }
.gm-member-info { display: flex; flex-direction: column; }
.gm-member-name { font-size: 12px; color: #c4ccd9; font-weight: 500; }
.gm-member-role { font-size: 10px; color: #475569; }
.gm-add-member-form {
  background: #0a0f1e; border: 1px solid #1e2d4a; border-radius: 8px;
  padding: 10px; display: flex; flex-direction: column; gap: 6px; max-width: 380px;
}

/* Dispatch matrix */
.gm-dispatch-wrap { overflow-x: auto; }
.gm-dispatch-table { border-collapse: collapse; font-size: 12px; width: 100%; }
.gm-dispatch-table th {
  padding: 6px 10px; color: #64748b; font-weight: 500; font-size: 10px;
  border-bottom: 1px solid #1e2d4a; text-align: center;
}
.gm-dispatch-channel-col { text-align: left !important; min-width: 110px; }
.gm-dispatch-action-col { min-width: 72px; }
.gm-dispatch-table td {
  padding: 7px 10px; border-bottom: 1px solid #0a0f1e; color: #c4ccd9;
}
.gm-dispatch-channel-name { font-size: 11px; font-weight: 500; }
.gm-dispatch-cell { text-align: center; }
.gm-dispatch-check { width: 14px; height: 14px; cursor: pointer; accent-color: #3b5bdb; }

/* Misc */
.gm-loading { text-align: center; padding: 20px; color: #475569; font-size: 13px; display: flex; align-items: center; gap: 8px; justify-content: center; }
.gm-empty  { text-align: center; padding: 20px; color: #475569; font-size: 13px; }
.gm-error  { padding: 10px 14px; background: #3b1a1a; border: 1px solid #991b1b; border-radius: 8px; color: #f87171; font-size: 12px; margin-bottom: 12px; }
.gm-empty-inline { font-size: 12px; color: #475569; padding: 4px 0; display: block; }
.gm-form-card {
  background: #0f1829; border: 1px solid #1e2d4a; border-radius: 10px;
  padding: 16px; max-width: 480px;
}
.gm-form-title { font-size: 14px; font-weight: 600; color: #c4ccd9; margin: 0 0 14px; }
    `;
    document.head.appendChild(style);
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
