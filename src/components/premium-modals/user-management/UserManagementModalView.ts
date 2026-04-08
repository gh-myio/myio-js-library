import { UserManagementConfig, TBUser } from './types';
import { UserListTab } from './tabs/UserListTab';
import { NewUserTab } from './tabs/NewUserTab';
import { GroupManagementTab } from './tabs/GroupManagementTab';
import { UserDetailTab } from './tabs/UserDetailTab';
import { PoliciesTab } from './tabs/PoliciesTab';
import { RolesTab } from './tabs/RolesTab';
import { ModalHeader } from '../../../utils/ModalHeader';

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
  private headerController?: ReturnType<typeof ModalHeader.createController>;

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
    // MUST be after appendChild — createController uses document.getElementById internally
    this.headerController = ModalHeader.createController({
      modalId: 'um-modal',
      theme: this.themeMode,
      maximizeTarget: this.modalEl,
      maximizedClass: 'is-maximized',
      onThemeChange: (theme) => { this.backdrop.setAttribute('data-theme', theme); },
      onClose: () => this.close(),
    });
  }

  destroy(): void {
    this.headerController?.destroy();
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

    // Header — RFC-0121 ModalHeader standard
    const header = document.createElement('div');
    header.innerHTML = ModalHeader.generateHTML({
      icon: '👥',
      title: `Gestão de Usuários${customerName ? ` — ${customerName}` : ''}`,
      modalId: 'um-modal',
      theme: this.themeMode,
      showThemeToggle: true,
      showMaximize: true,
      showClose: true,
      draggable: false,
    });
    const headerEl = header.firstElementChild as HTMLElement;

    // Tab bar
    this.tabBarEl = document.createElement('div');
    this.tabBarEl.className = 'um-tab-bar';

    // Content area
    this.contentEl = document.createElement('div');
    this.contentEl.className = 'um-modal-content';

    // Toast
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'um-toast';

    this.modalEl.appendChild(headerEl);
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

    // Tab 4: Policies — RFC-0197 GCDR Permission Policies
    const policiesTab = new PoliciesTab(config, {
      showToast: (msg, type) => this.showToast(msg, type),
    });
    let policiesTabEl: HTMLElement | null = null;
    this.tabs.push({
      key: 'policies',
      label: 'Políticas',
      closeable: false,
      getEl: () => {
        if (!policiesTabEl) policiesTabEl = policiesTab.render();
        return policiesTabEl;
      },
    });

    // Tab 5: Roles — RFC-0197 GCDR Roles
    const rolesTab = new RolesTab(config, {
      showToast: (msg, type) => this.showToast(msg, type),
    });
    let rolesTabEl: HTMLElement | null = null;
    this.tabs.push({
      key: 'roles',
      label: 'Funções',
      closeable: false,
      getEl: () => {
        if (!rolesTabEl) rolesTabEl = rolesTab.render();
        return rolesTabEl;
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
      onClose: () => this.removeTab(existingKey),
      showToast: (msg, type) => this.showToast(msg, type),
    });

    let el: HTMLElement | null = null;
    this.tabs.push({
      key: existingKey,
      label: detailTab.tabLabel,
      closeable: true,
      userId: user.id.id,
      detailTab,
      getEl: () => {
        el = detailTab.render();
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
    if (!document.getElementById('um-font-nunito')) {
      const link = document.createElement('link');
      link.id = 'um-font-nunito';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
    if (document.getElementById('um-styles')) return;
    const style = document.createElement('style');
    style.id = 'um-styles';
    style.textContent = `
/* === UserManagement Modal — CSS custom properties === */

/* ── Light mode defaults ── */
.um-backdrop {
  --um-modal-bg:            #ffffff;
  --um-border:              #e2e8f0;
  --um-border-sub:          #f0f4f8;
  --um-bg-surface:          #f8fafc;
  --um-bg-input:            #f1f5f9;
  --um-bg-deep:             #f8fafc;
  --um-text-primary:        #1e293b;
  --um-text-secondary:      #374151;
  --um-text-muted:          #64748b;
  --um-text-faint:          #94a3b8;
  --um-accent:              #3f1a7d;
  --um-accent-hover:        #5a2bab;
  --um-btn-2-bg:            #f4effa;
  --um-btn-2-text:          #3f1a7d;
  --um-btn-2-border:        #c9a8e8;
  --um-btn-2-hover:         #e8d8f5;
  --um-btn-ghost-border:    #e2e8f0;
  --um-btn-ghost-hover:     #f1f5f9;
  --um-btn-ghost-text-hover:#475569;
  --um-btn-danger-bg:       #fee2e2;
  --um-btn-danger-text:     #dc2626;
  --um-btn-danger-border:   #fca5a5;
  --um-btn-danger-hover:    #fecaca;
  --um-badge-admin-bg:      #eff6ff;
  --um-badge-admin-text:    #3b5bdb;
  --um-badge-user-bg:       #f0fdf4;
  --um-badge-user-text:     #16a34a;
  --um-badge-active-bg:     #dcfce7;
  --um-badge-active-text:   #15803d;
  --um-badge-blocked-bg:    #fee2e2;
  --um-badge-blocked-text:  #b91c1c;
  --um-badge-pending-bg:    #fef9c3;
  --um-badge-pending-text:  #854d0e;
  --um-toast-ok-bg:         #f0fdf4;
  --um-toast-ok-border:     #22c55e;
  --um-toast-ok-text:       #16a34a;
  --um-toast-err-bg:        #fff5f5;
  --um-toast-err-border:    #ef4444;
  --um-toast-err-text:      #dc2626;
  --um-spinner-border:      #cbd5e1;
  --um-spinner-top:         #3f1a7d;
  --um-toggle-off:          #cbd5e1;
  --um-notice-bg:           #f4effa;
  --um-notice-border:       #c9a8e8;
  --um-shadow:              0 32px 80px rgba(0,0,0,0.15);
  --um-row-highlight:       #f0fdf4;
  --um-gm-badge-domain-bg:  #f4effa;
  --um-gm-badge-domain-txt: #3f1a7d;
  --um-gm-badge-count-bg:   #f1f5f9;
  --um-gm-badge-count-txt:  #64748b;
  --um-gm-form-card-bg:     #f8fafc;
  --um-gm-add-member-bg:    #f1f5f9;
  --um-gm-err-bg:           #fff5f5;
  --um-gm-err-border:       #fca5a5;
  --um-gm-err-text:         #dc2626;
  --um-icon-btn-hover-bg:   #eff6ff;

  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 99999; padding: 16px;
}

/* ── Dark mode overrides ── */
.um-backdrop[data-theme="dark"] {
  --um-modal-bg:            #131929;
  --um-border:              #2a3352;
  --um-border-sub:          #0f1829;
  --um-bg-surface:          #0f1829;
  --um-bg-input:            #1a2235;
  --um-bg-deep:             #0a0f1e;
  --um-text-primary:        #e2e8f0;
  --um-text-secondary:      #c4ccd9;
  --um-text-muted:          #64748b;
  --um-text-faint:          #475569;
  --um-accent:              #a78bdb;
  --um-accent-hover:        #c3a8f0;
  --um-btn-2-bg:            #2a1a45;
  --um-btn-2-text:          #c3a8f0;
  --um-btn-2-border:        #4a2a80;
  --um-btn-2-hover:         #3a2060;
  --um-btn-ghost-border:    #2a3352;
  --um-btn-ghost-hover:     #1a2235;
  --um-btn-ghost-text-hover:#94a3b8;
  --um-btn-danger-bg:       #7f1d1d;
  --um-btn-danger-text:     #fca5a5;
  --um-btn-danger-border:   #991b1b;
  --um-btn-danger-hover:    #991b1b;
  --um-badge-admin-bg:      #1e3a5f;
  --um-badge-admin-text:    #60a5fa;
  --um-badge-user-bg:       #1a2d24;
  --um-badge-user-text:     #4ade80;
  --um-badge-active-bg:     #14532d;
  --um-badge-active-text:   #86efac;
  --um-badge-blocked-bg:    #450a0a;
  --um-badge-blocked-text:  #fca5a5;
  --um-badge-pending-bg:    #422006;
  --um-badge-pending-text:  #fde68a;
  --um-toast-ok-bg:         #1e3a2e;
  --um-toast-ok-border:     #22c55e;
  --um-toast-ok-text:       #4ade80;
  --um-toast-err-bg:        #3b1a1a;
  --um-toast-err-border:    #ef4444;
  --um-toast-err-text:      #f87171;
  --um-spinner-border:      #2a3352;
  --um-spinner-top:         #a78bdb;
  --um-toggle-off:          #2a3352;
  --um-notice-bg:           #1e1235;
  --um-notice-border:       #4a2a80;
  --um-shadow:              0 32px 80px rgba(0,0,0,0.6);
  --um-row-highlight:       #0e2a1e;
  --um-gm-badge-domain-bg:  #2a1a45;
  --um-gm-badge-domain-txt: #c3a8f0;
  --um-gm-badge-count-bg:   #1e2d4a;
  --um-gm-badge-count-txt:  #94a3b8;
  --um-gm-form-card-bg:     #0f1829;
  --um-gm-add-member-bg:    #0a0f1e;
  --um-gm-err-bg:           #3b1a1a;
  --um-gm-err-border:       #991b1b;
  --um-gm-err-text:         #f87171;
  --um-icon-btn-hover-bg:   #1a2a45;
}

/* ── Component styles (theme-agnostic via variables) ── */
.um-modal {
  background: var(--um-modal-bg);
  font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  border-radius: 14px; width: 96vw; max-width: 1200px;
  --modal-header-radius: 14px 14px 0 0;
  height: 84vh; display: flex; flex-direction: column;
  box-shadow: var(--um-shadow); overflow: hidden; position: relative;
}
@media (max-height: 600px) { .um-modal { height: 96vh; } }

/* Header handled by ModalHeader (RFC-0121) */
.um-modal .myio-modal-header__title {
  font-size: 14px !important;
  font-weight: 600 !important;
}
.um-modal .myio-modal-header__icon {
  font-size: 15px !important;
}

/* Force MyIO purple header regardless of light/dark theme — overrides myio-modal-header--light */
.um-modal .myio-modal-header--light {
  background: #3f1a7d !important;
  border-bottom-color: #2e1260 !important;
}
.um-modal .myio-modal-header--light .myio-modal-header__title { color: #fff !important; }
.um-modal .myio-modal-header--light .myio-modal-header__btn { color: rgba(255,255,255,0.8) !important; }
.um-modal .myio-modal-header--light .myio-modal-header__btn:hover {
  background: rgba(255,255,255,0.15) !important; color: #fff !important;
}
.um-modal .myio-modal-header--light .myio-modal-header__btn--close:hover {
  background: rgba(239,68,68,0.3) !important; color: #fecaca !important;
}

/* Maximize button — CSS window icon (emoji renders as plain square on some platforms) */
#um-modal-maximize { font-size: 0 !important; position: relative; }
#um-modal-maximize::before {
  content: '';
  display: inline-block;
  width: 10px; height: 8px;
  border: 1.5px solid currentColor;
  border-top-width: 3px;
  border-radius: 1px;
  vertical-align: middle;
}

.um-modal.is-maximized {
  width: 100vw !important; max-width: 100vw !important;
  height: 100vh !important; max-height: 100vh !important;
  border-radius: 0; aspect-ratio: unset;
}

.um-tab-bar {
  display: flex; gap: 2px; padding: 0 16px;
  border-bottom: 1px solid var(--um-border); flex-shrink: 0;
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
.um-tab-btn:hover { color: var(--um-text-secondary); }
.um-tab-btn--active { color: var(--um-accent); border-bottom-color: var(--um-accent); }
.um-tab-close {
  font-size: 9px; color: var(--um-text-faint); padding: 2px 3px;
  border-radius: 3px; line-height: 1; cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.um-tab-close:hover { background: var(--um-bg-surface); color: var(--um-text-primary); }

.um-modal-content {
  flex: 1; overflow-y: auto; padding: 20px;
  scrollbar-width: thin; scrollbar-color: var(--um-border) transparent;
}
.um-modal-content::-webkit-scrollbar { width: 6px; }
.um-modal-content::-webkit-scrollbar-thumb { background: var(--um-border); border-radius: 3px; }

.um-toast {
  position: absolute; bottom: 16px; right: 16px;
  background: var(--um-toast-ok-bg); border: 1px solid var(--um-toast-ok-border);
  color: var(--um-toast-ok-text); font-size: 12px; font-weight: 500;
  padding: 10px 16px; border-radius: 8px;
  opacity: 0; transform: translateY(8px);
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none; z-index: 10; max-width: 300px;
}
.um-toast--error { background: var(--um-toast-err-bg); border-color: var(--um-toast-err-border); color: var(--um-toast-err-text); }
.um-toast--visible { opacity: 1; transform: translateY(0); }

.um-tab-content { min-height: 100%; }

.um-list-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 16px;
}
.um-search-wrap { position: relative; flex: 1; max-width: 360px; }
.um-search-icon {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  color: var(--um-text-faint); pointer-events: none;
}
.um-search-input {
  width: 100%; background: var(--um-bg-input); border: 1px solid var(--um-border);
  border-radius: 8px; padding: 7px 12px 7px 32px;
  color: var(--um-text-primary); font-size: 13px; outline: none;
  transition: border-color 0.15s;
}
.um-search-input:focus { border-color: var(--um-accent); }
.um-search-input::placeholder { color: var(--um-text-faint); }

.um-table-wrap { position: relative; overflow-x: auto; }
.um-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.um-table th {
  text-align: left; padding: 8px 12px;
  color: var(--um-text-muted); font-weight: 600; font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid var(--um-border);
}
.um-table td {
  padding: 10px 12px; color: var(--um-text-primary); font-weight: 500;
  border-bottom: 1px solid var(--um-border-sub);
}
.um-table tr:hover td { background: var(--um-bg-surface); }
.um-col-actions { width: 100px; text-align: center; }
.um-col-gcdr { width: 72px; text-align: center; }

/* Sync status dot */
.um-sync-icon { display: inline-flex; align-items: center; justify-content: center; }
.um-sync-dot {
  display: inline-block; width: 10px; height: 10px; border-radius: 50%;
  flex-shrink: 0;
}
.um-sync-dot--none   { background: var(--um-text-faint); opacity: 0.4; }
.um-sync-dot--ok,
.um-sync-dot--active { background: var(--um-badge-active-text); }
.um-sync-dot--warn   { background: var(--um-badge-pending-text); }
.um-sync-dot--err    { background: var(--um-badge-blocked-text); }

/* Premium sync tooltip */
.um-sync-tooltip {
  position: fixed; z-index: 100020;
  background: var(--um-modal-bg); border: 1px solid var(--um-border);
  border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  width: 260px; pointer-events: none;
  font-family: 'Nunito', -apple-system, sans-serif;
}
.um-sync-tooltip-header {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 12px; background: var(--um-accent);
  border-radius: 10px 10px 0 0;
  font-size: 11px; font-weight: 700; color: #fff;
}
.um-sync-tooltip-body {
  padding: 10px 12px; display: flex; flex-direction: column; gap: 4px;
}
.um-sync-tooltip-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  font-size: 11px; gap: 8px;
}
.um-sync-tooltip-row--muted { color: var(--um-text-faint); justify-content: center; padding: 4px 0; }
.um-sync-tooltip-row--error .um-sync-tooltip-value { color: var(--um-badge-blocked-text); word-break: break-all; }
.um-sync-tooltip-label { color: var(--um-text-muted); flex-shrink: 0; }
.um-sync-tooltip-value { color: var(--um-text-primary); font-weight: 600; text-align: right; }

/* Assignments quick-view popup */
.um-assign-popup {
  position: fixed; z-index: 100010;
  background: var(--um-modal-bg); border: 1px solid var(--um-border);
  border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  width: 320px; max-height: 340px; overflow-y: auto;
  font-family: 'Nunito', -apple-system, sans-serif;
}
.um-assign-popup-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: var(--um-accent);
  border-radius: 10px 10px 0 0;
}
.um-assign-popup-title { font-size: 12px; font-weight: 700; color: #fff; }
.um-assign-popup-close {
  background: none; border: none; color: rgba(255,255,255,0.8);
  font-size: 14px; cursor: pointer; padding: 0 4px; line-height: 1;
}
.um-assign-popup-body { padding: 10px 14px; }
.um-assign-row {
  display: flex; flex-direction: column; gap: 2px;
  padding: 7px 0; border-bottom: 1px solid var(--um-border-sub);
  font-size: 12px;
}
.um-assign-row:last-child { border-bottom: none; }
.um-assign-role { font-weight: 600; color: var(--um-text-primary); }
.um-assign-meta { color: var(--um-text-muted); font-size: 11px; }
.um-row--highlight td { background: var(--um-row-highlight) !important; }

.um-list-empty, .um-list-loading, .um-profiles-loading,
.um-profiles-empty, .um-profiles-error {
  text-align: center; padding: 32px 16px; color: var(--um-text-faint); font-size: 13px;
}
.um-pagination {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; margin-top: 16px; font-size: 12px; color: var(--um-text-muted);
}

.um-icon-btn {
  background: none; border: none; cursor: pointer;
  color: var(--um-text-faint); padding: 5px; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.um-icon-btn:hover { color: var(--um-accent); background: var(--um-icon-btn-hover-bg); }

.um-btn {
  border: none; cursor: pointer; font-size: 13px; font-weight: 500;
  padding: 8px 16px; border-radius: 8px; transition: opacity 0.15s, background 0.15s;
}
.um-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.um-btn--primary { background: var(--um-accent); color: #fff; }
.um-btn--primary:hover:not(:disabled) { background: var(--um-accent-hover); }
.um-btn--secondary { background: var(--um-btn-2-bg); color: var(--um-btn-2-text); border: 1px solid var(--um-btn-2-border); }
.um-btn--secondary:hover:not(:disabled) { background: var(--um-btn-2-hover); }
.um-btn--ghost { background: transparent; color: var(--um-text-muted); border: 1px solid var(--um-btn-ghost-border); }
.um-btn--ghost:hover:not(:disabled) { background: var(--um-btn-ghost-hover); color: var(--um-btn-ghost-text-hover); }
.um-btn--danger { background: var(--um-btn-danger-bg); color: var(--um-btn-danger-text); border: 1px solid var(--um-btn-danger-border); }
.um-btn--danger:hover:not(:disabled) { background: var(--um-btn-danger-hover); }
.um-btn--sm { padding: 6px 12px; font-size: 12px; }

.um-badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; }
.um-badge--admin   { background: var(--um-badge-admin-bg);   color: var(--um-badge-admin-text); }
.um-badge--user    { background: var(--um-badge-user-bg);    color: var(--um-badge-user-text); }
.um-badge--active  { background: var(--um-badge-active-bg);  color: var(--um-badge-active-text); }
.um-badge--blocked { background: var(--um-badge-blocked-bg); color: var(--um-badge-blocked-text); }
.um-badge--pending { background: var(--um-badge-pending-bg); color: var(--um-badge-pending-text); }

.um-form { display: flex; flex-direction: column; gap: 14px;}
.um-form-row { display: flex; gap: 12px; }
.um-form-row .um-form-group { flex: 1; }
.um-form-group { display: flex; flex-direction: column; gap: 5px; }
.um-form-group--check { flex-direction: row; align-items: center; }
.um-label { font-size: 12px; font-weight: 500; color: var(--um-text-secondary); }
.um-req { color: var(--um-toast-err-text); }
.um-input {
  background: var(--um-bg-input); border: 1px solid var(--um-border);
  border-radius: 8px; padding: 8px 12px;
  color: var(--um-text-primary); font-size: 13px; outline: none; width: 100%;
  transition: border-color 0.15s; box-sizing: border-box;
}
.um-input:focus { border-color: var(--um-accent); }
.um-textarea { resize: vertical; min-height: 64px; }
.um-field-error { font-size: 11px; color: var(--um-toast-err-text); min-height: 14px; }
.um-check-label { font-size: 13px; color: var(--um-text-secondary); cursor: pointer; display: flex; align-items: center; gap: 8px; }
.um-form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }

.um-detail-card { width: 100%; }
.um-detail-section { border: 1px solid var(--um-border); border-radius: 10px; overflow: hidden; margin-bottom: 20px; }
.um-detail-row {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 11px 16px; border-bottom: 1px solid var(--um-border-sub);
}
.um-detail-row:last-child { border-bottom: none; }
.um-detail-label { width: 100px; font-size: 12px; color: var(--um-text-faint); font-weight: 500; flex-shrink: 0; padding-top: 1px; }
.um-detail-value { font-size: 13px; color: var(--um-text-secondary); flex: 1; }
.um-detail-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.um-profiles-header { margin-bottom: 16px; }
.um-profiles-title { font-size: 14px; font-weight: 600; color: var(--um-text-secondary); margin: 0; }
.um-profiles-notice {
  display: flex; align-items: center; gap: 8px;
  margin-top: 16px; padding: 10px 14px;
  background: var(--um-notice-bg); border: 1px solid var(--um-notice-border); border-radius: 8px;
  font-size: 12px; color: var(--um-text-muted);
}

.um-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid var(--um-spinner-border); border-top-color: var(--um-spinner-top);
  border-radius: 50%; animation: um-spin 0.7s linear infinite;
}
@keyframes um-spin { to { transform: rotate(360deg); } }

/* === GroupManagementTab === */

/* toolbar + search */
.gm-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }

/* read-only notice */
.gm-readonly-notice {
  display: flex; align-items: center; gap: 8px; margin-bottom: 14px;
  padding: 10px 14px; background: var(--um-notice-bg); border: 1px solid var(--um-notice-border);
  border-radius: 8px; font-size: 12px; color: var(--um-text-muted);
}

/* new-group form area */
.gm-new-group-form { margin-bottom: 16px; }
.gm-purposes-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px; padding: 10px; background: var(--um-bg-surface);
  border: 1px solid var(--um-border); border-radius: 8px;
}

/* accordion */
.gm-groups-accordion { display: flex; flex-direction: column; gap: 6px; margin-bottom: 24px; }

.gm-accordion-item {
  border: 1px solid var(--um-border); border-radius: 10px; overflow: hidden;
  transition: border-color 0.15s;
}
.gm-accordion-item--open { border-color: var(--um-btn-2-border); }

.gm-accordion-header {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer;
  background: var(--um-bg-surface);
  transition: background 0.15s;
}
.gm-accordion-header:hover { background: var(--um-bg-input); }
.gm-accordion-item--open .gm-accordion-header { background: var(--um-bg-input); }

.gm-accordion-toggle {
  background: none; border: none; cursor: pointer; padding: 2px; flex-shrink: 0;
  color: var(--um-text-faint); display: flex; align-items: center;
}
.gm-accordion-arrow { transition: transform 0.2s; }
.gm-accordion-item--open .gm-accordion-arrow { transform: rotate(90deg); }

.gm-accordion-meta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.gm-group-name { font-size: 13px; font-weight: 600; color: var(--um-text-secondary); }
.gm-group-code { font-size: 10px; color: var(--um-text-faint); font-family: monospace; }

.gm-accordion-badges { display: flex; flex-wrap: wrap; gap: 4px; flex-shrink: 0; }
.gm-accordion-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.gm-accordion-panel {
  border-top: 1px solid var(--um-border);
  padding: 16px; display: flex; flex-direction: column; gap: 0;
}
.gm-panel-loading {
  text-align: center; padding: 20px; color: var(--um-text-faint); font-size: 13px;
  display: flex; align-items: center; gap: 8px; justify-content: center;
}

/* panel sections */
.gm-panel-section {
  padding: 14px 0; border-bottom: 1px solid var(--um-border-sub);
}
.gm-panel-section:last-child { border-bottom: none; padding-bottom: 0; }
.gm-panel-section-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
}
.gm-panel-section-title {
  font-size: 11px; font-weight: 600; color: var(--um-text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em;
}

/* members */
.gm-members-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.gm-member-chip {
  display: flex; align-items: center; gap: 6px;
  background: var(--um-bg-surface); border: 1px solid var(--um-border); border-radius: 8px;
  padding: 5px 8px;
}
.gm-member-icon { font-size: 12px; }
.gm-member-info { display: flex; flex-direction: column; }
.gm-member-name { font-size: 12px; color: var(--um-text-secondary); font-weight: 500; }
.gm-member-role { font-size: 10px; color: var(--um-text-faint); }
.gm-add-member-form {
  background: var(--um-gm-add-member-bg); border: 1px solid var(--um-border);
  border-radius: 8px; padding: 10px; display: flex; flex-direction: column;
  gap: 6px; max-width: 380px;
}

/* group channels list */
.gm-gchannels-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.gm-gchannel-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; background: var(--um-bg-surface);
  border: 1px solid var(--um-border); border-radius: 8px; font-size: 12px;
}
.gm-channel-target {
  flex: 1; color: var(--um-text-faint); font-size: 11px;
  font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* customer channels section divider */
.gm-customer-channels-section { margin-top: 24px; padding-top: 16px; }
.gm-section-divider {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px; gap: 10px;
}
.gm-section-divider-label {
  font-size: 11px; font-weight: 700; color: var(--um-text-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}

/* customer channel cards */
.gm-channels-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.gm-channel-card {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--um-bg-surface); border: 1px solid var(--um-border); border-radius: 10px;
  padding: 10px 14px; gap: 12px;
}
.gm-channel-card-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.gm-channel-card-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.gm-channel-icon { font-size: 16px; }
.gm-channel-info { display: flex; flex-direction: column; min-width: 0; }
.gm-channel-name { font-size: 13px; font-weight: 600; color: var(--um-text-secondary); }
.gm-channel-summary {
  font-size: 11px; color: var(--um-text-faint);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* toggle switch */
.gm-toggle { position: relative; display: inline-block; width: 34px; height: 18px; cursor: pointer; }
.gm-toggle-input { opacity: 0; width: 0; height: 0; position: absolute; }
.gm-toggle-slider {
  position: absolute; inset: 0; background: var(--um-toggle-off); border-radius: 9px;
  transition: background 0.2s;
}
.gm-toggle-slider::before {
  content: ''; position: absolute; width: 12px; height: 12px;
  left: 3px; top: 3px; background: #fff; border-radius: 50%;
  transition: transform 0.2s;
}
.gm-toggle-input:checked + .gm-toggle-slider { background: #22c55e; }
.gm-toggle-input:checked + .gm-toggle-slider::before { transform: translateX(16px); }

/* dispatch matrix */
.gm-dispatch-wrap { overflow-x: auto; }
.gm-dispatch-table { border-collapse: collapse; font-size: 12px; width: 100%; }
.gm-dispatch-table th {
  padding: 6px 10px; color: var(--um-text-muted); font-weight: 500; font-size: 10px;
  border-bottom: 1px solid var(--um-border); text-align: center;
}
.gm-dispatch-channel-col { text-align: left !important; min-width: 110px; }
.gm-dispatch-action-col  { min-width: 72px; }
.gm-dispatch-delay-col   { min-width: 90px; }
.gm-dispatch-table td {
  padding: 7px 10px; border-bottom: 1px solid var(--um-border-sub);
  color: var(--um-text-secondary);
}
.gm-dispatch-channel-name { font-size: 11px; font-weight: 500; }
.gm-dispatch-cell { text-align: center; }
.gm-dispatch-check { width: 14px; height: 14px; cursor: pointer; accent-color: var(--um-accent); }
.gm-delay-input { font-size: 11px !important; }

/* badges */
.gm-badge {
  display: inline-block; font-size: 9px; font-weight: 600;
  padding: 2px 6px; border-radius: 9999px;
}
.gm-badge--domain { background: var(--um-gm-badge-domain-bg); color: var(--um-gm-badge-domain-txt); }
.gm-badge--count  { background: var(--um-gm-badge-count-bg);  color: var(--um-gm-badge-count-txt); }
.gm-badge--on     { background: var(--um-badge-user-bg);       color: var(--um-badge-user-text); }
.gm-badge--off    { background: var(--um-bg-surface);           color: var(--um-text-faint); border: 1px solid var(--um-border); }

/* shared utility */
.gm-loading {
  text-align: center; padding: 20px; color: var(--um-text-faint); font-size: 13px;
  display: flex; align-items: center; gap: 8px; justify-content: center;
}
.gm-empty   { text-align: center; padding: 20px; color: var(--um-text-faint); font-size: 13px; }
.gm-error   {
  padding: 10px 14px; background: var(--um-gm-err-bg); border: 1px solid var(--um-gm-err-border);
  border-radius: 8px; color: var(--um-gm-err-text); font-size: 12px; margin-bottom: 12px;
}
.gm-empty-inline { font-size: 12px; color: var(--um-text-faint); padding: 4px 0; display: block; }
.gm-form-card {
  background: var(--um-gm-form-card-bg); border: 1px solid var(--um-border);
  border-radius: 10px; padding: 16px; max-width: 560px;
}
.gm-form-title { font-size: 14px; font-weight: 600; color: var(--um-text-secondary); margin: 0 0 14px; }
.gm-section-label { font-size: 12px; color: var(--um-text-muted); font-weight: 500; }
    `;
    document.head.appendChild(style);
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
