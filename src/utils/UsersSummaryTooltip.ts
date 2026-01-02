/**
 * UsersSummaryTooltip - Users Summary Tooltip Component
 * RFC-0112 Rev-001: Premium tooltip showing users summary per customer/shopping
 *
 * Shows:
 * - Total users with access
 * - Users by role (admin, operator, viewer)
 * - Active vs inactive users
 * - Last login summary
 *
 * @example
 * // Attach to an element
 * const cleanup = UsersSummaryTooltip.attach(triggerElement, getDataFn);
 * // Later: cleanup();
 *
 * // Or manual control
 * UsersSummaryTooltip.show(element, summaryData, event);
 * UsersSummaryTooltip.hide();
 */

// ============================================
// Types
// ============================================

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  lastLogin?: string;
  isActive: boolean;
}

export interface UsersByRole {
  admin: number;
  operator: number;
  viewer: number;
  adminUsers?: UserInfo[];
  operatorUsers?: UserInfo[];
  viewerUsers?: UserInfo[];
}

export interface UsersSummaryData {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  byRole: UsersByRole;
  lastUpdated: string;
  customerName?: string;
}

// ============================================
// CSS Styles (injected once)
// ============================================

const USERS_SUMMARY_TOOLTIP_CSS = `
/* ============================================
   Users Summary Tooltip (RFC-0112 Rev-001)
   Premium dashboard summary on hover
   Purple theme for users
   ============================================ */
.users-summary-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  transform: translateY(8px);
}

.users-summary-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.users-summary-tooltip.closing {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
  pointer-events: none;
}

.users-summary-tooltip__content {
  background: #ffffff;
  border: 1px solid #e9d5ff;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.08);
  min-width: 320px;
  width: max-content;
  max-width: 90vw;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
}

.users-summary-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: linear-gradient(90deg, #faf5ff 0%, #e9d5ff 100%);
  border-bottom: 1px solid #c4b5fd;
  border-radius: 12px 12px 0 0;
  cursor: move;
  user-select: none;
}

.users-summary-tooltip__icon {
  font-size: 18px;
}

.users-summary-tooltip__title {
  font-weight: 700;
  font-size: 14px;
  color: #7c3aed;
  flex: 1;
}

.users-summary-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.users-summary-tooltip__header-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  color: #64748b;
}

.users-summary-tooltip__header-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #1e293b;
}

.users-summary-tooltip__header-btn.pinned {
  background: #7c3aed;
  color: white;
}

.users-summary-tooltip__header-btn.pinned:hover {
  background: #6d28d9;
  color: white;
}

.users-summary-tooltip__header-btn svg {
  width: 14px;
  height: 14px;
}

.users-summary-tooltip__timestamp {
  font-size: 10px;
  color: #6b7280;
  margin-right: 8px;
}

.users-summary-tooltip__body {
  padding: 14px;
}

/* Maximized state */
.users-summary-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}

.users-summary-tooltip.maximized .users-summary-tooltip__content {
  width: 100%;
  height: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
}

.users-summary-tooltip.maximized .users-summary-tooltip__body {
  flex: 1;
  overflow-y: auto;
}

/* Pinned state indicator */
.users-summary-tooltip.pinned {
  box-shadow: 0 0 0 2px #7c3aed, 0 10px 40px rgba(0, 0, 0, 0.2);
}

/* Dragging state */
.users-summary-tooltip.dragging {
  transition: none !important;
  cursor: move;
}

/* Total Users Banner */
.users-summary-tooltip__total-users {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid #e9d5ff;
}

.users-summary-tooltip__total-users-label {
  font-weight: 600;
  color: #475569;
  font-size: 12px;
}

.users-summary-tooltip__total-users-value {
  font-weight: 700;
  font-size: 20px;
  color: #7c3aed;
}

/* Section Title */
.users-summary-tooltip__section-title {
  font-weight: 700;
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 12px 0 6px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
}

/* Role Grid */
.users-summary-tooltip__role-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 6px 0 12px 0;
}

.users-summary-tooltip__role-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  border-radius: 8px;
  transition: background-color 0.15s ease;
}

.users-summary-tooltip__role-item.admin {
  background: #fef3c7;
  border: 1px solid #fcd34d;
}

.users-summary-tooltip__role-item.operator {
  background: #dbeafe;
  border: 1px solid #93c5fd;
}

.users-summary-tooltip__role-item.viewer {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.users-summary-tooltip__role-icon {
  font-size: 18px;
}

.users-summary-tooltip__role-count {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

.users-summary-tooltip__role-label {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
}

/* Status Grid */
.users-summary-tooltip__status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin: 6px 0 12px 0;
}

.users-summary-tooltip__status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.users-summary-tooltip__status-item.active {
  background: #dcfce7;
  color: #15803d;
}

.users-summary-tooltip__status-item.inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.users-summary-tooltip__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.users-summary-tooltip__status-dot.active { background: #22c55e; }
.users-summary-tooltip__status-dot.inactive { background: #9ca3af; }

.users-summary-tooltip__status-count {
  font-size: 14px;
  font-weight: 700;
}

.users-summary-tooltip__status-label {
  font-size: 11px;
  opacity: 0.85;
}

/* Footer */
.users-summary-tooltip__footer {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
  border-radius: 0 0 11px 11px;
}

.users-summary-tooltip__footer-text {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .users-summary-tooltip__content {
    min-width: 280px;
    max-width: 95vw;
  }

  .users-summary-tooltip__role-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
`;

// ============================================
// CSS Injection Helper
// ============================================

let cssInjected = false;

function injectCSS(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;

  const styleId = 'myio-users-summary-tooltip-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = USERS_SUMMARY_TOOLTIP_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format timestamp for display (date and time)
 */
function formatTimestamp(isoString: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  } catch {
    return '';
  }
}

// ============================================
// UsersSummaryTooltip Object
// ============================================

export const UsersSummaryTooltip = {
  containerId: 'myio-users-summary-tooltip',

  /**
   * Create or get the tooltip container
   */
  getContainer(): HTMLElement {
    injectCSS();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'users-summary-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Render role grid
   */
  renderRoleGrid(byRole: UsersByRole): string {
    return `
      <div class="users-summary-tooltip__role-item admin">
        <span class="users-summary-tooltip__role-icon">👑</span>
        <span class="users-summary-tooltip__role-count">${byRole.admin}</span>
        <span class="users-summary-tooltip__role-label">Admin</span>
      </div>
      <div class="users-summary-tooltip__role-item operator">
        <span class="users-summary-tooltip__role-icon">🔧</span>
        <span class="users-summary-tooltip__role-count">${byRole.operator}</span>
        <span class="users-summary-tooltip__role-label">Operador</span>
      </div>
      <div class="users-summary-tooltip__role-item viewer">
        <span class="users-summary-tooltip__role-icon">👁️</span>
        <span class="users-summary-tooltip__role-count">${byRole.viewer}</span>
        <span class="users-summary-tooltip__role-label">Visualizador</span>
      </div>
    `;
  },

  /**
   * Render status grid (active/inactive)
   */
  renderStatusGrid(active: number, inactive: number): string {
    return `
      <div class="users-summary-tooltip__status-item active">
        <span class="users-summary-tooltip__status-dot active"></span>
        <span class="users-summary-tooltip__status-count">${active}</span>
        <span class="users-summary-tooltip__status-label">Ativos</span>
      </div>
      <div class="users-summary-tooltip__status-item inactive">
        <span class="users-summary-tooltip__status-dot inactive"></span>
        <span class="users-summary-tooltip__status-count">${inactive}</span>
        <span class="users-summary-tooltip__status-label">Inativos</span>
      </div>
    `;
  },

  /**
   * Render full tooltip HTML
   */
  renderHTML(summary: UsersSummaryData): string {
    const roleGrid = this.renderRoleGrid(summary.byRole);
    const statusGrid = this.renderStatusGrid(summary.activeUsers, summary.inactiveUsers);
    const timestamp = formatTimestamp(summary.lastUpdated);
    const titleSuffix = summary.customerName ? ` (${summary.customerName})` : '';

    return `
      <div class="users-summary-tooltip__content">
        <div class="users-summary-tooltip__header" data-drag-handle>
          <span class="users-summary-tooltip__icon">👥</span>
          <span class="users-summary-tooltip__title">Resumo de Usuarios${titleSuffix}</span>
          ${timestamp ? `<span class="users-summary-tooltip__timestamp">${timestamp}</span>` : ''}
          <div class="users-summary-tooltip__header-actions">
            <button class="users-summary-tooltip__header-btn" data-action="pin" title="Fixar na tela">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
                <line x1="12" y1="16" x2="12" y2="21"/>
                <line x1="8" y1="4" x2="16" y2="4"/>
              </svg>
            </button>
            <button class="users-summary-tooltip__header-btn" data-action="maximize" title="Maximizar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>
            <button class="users-summary-tooltip__header-btn" data-action="close" title="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="users-summary-tooltip__body">
          <div class="users-summary-tooltip__total-users">
            <span class="users-summary-tooltip__total-users-label">Total de Usuarios</span>
            <span class="users-summary-tooltip__total-users-value">${summary.totalUsers}</span>
          </div>

          <div class="users-summary-tooltip__section-title">Por Perfil</div>
          <div class="users-summary-tooltip__role-grid">
            ${roleGrid}
          </div>

          <div class="users-summary-tooltip__section-title">Status</div>
          <div class="users-summary-tooltip__status-grid">
            ${statusGrid}
          </div>
        </div>
        <div class="users-summary-tooltip__footer">
          <span class="users-summary-tooltip__footer-text">Gestao de Usuarios MYIO</span>
        </div>
      </div>
    `;
  },

  // Timer for delayed hide
  _hideTimer: null as ReturnType<typeof setTimeout> | null,
  _isMouseOverTooltip: false,

  // State for maximize and drag
  _isMaximized: false,
  _isDragging: false,
  _dragOffset: { x: 0, y: 0 },
  _savedPosition: null as { left: string; top: string } | null,

  // Counter for unique pinned clone IDs
  _pinnedCounter: 0,

  /**
   * Show tooltip for an element
   */
  show(triggerElement: HTMLElement, summary: UsersSummaryData, event?: MouseEvent): void {
    // Cancel any pending hide
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }

    const container = this.getContainer();
    container.classList.remove('closing');
    container.innerHTML = this.renderHTML(summary);

    // Position tooltip near the trigger element
    const rect = triggerElement.getBoundingClientRect();
    let left = rect.right + 12;
    let top = rect.top;

    // Adjust for viewport bounds
    const tooltipWidth = 340;
    const tooltipHeight = 350;

    if (left + tooltipWidth > window.innerWidth - 16) {
      left = rect.left - tooltipWidth - 12;
    }
    if (left < 16) {
      left = Math.max(16, (window.innerWidth - tooltipWidth) / 2);
    }

    if (top + tooltipHeight > window.innerHeight - 16) {
      top = window.innerHeight - tooltipHeight - 16;
    }
    if (top < 16) top = 16;

    container.style.left = left + 'px';
    container.style.top = top + 'px';
    container.classList.add('visible');

    // Setup tooltip hover listeners
    this._setupTooltipHoverListeners(container);

    // Setup button click handlers and drag functionality
    this._setupButtonListeners(container);
    this._setupDragListeners(container);
  },

  /**
   * Setup button click listeners (pin, maximize, close)
   */
  _setupButtonListeners(container: HTMLElement): void {
    const buttons = container.querySelectorAll('[data-action]');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;

        switch (action) {
          case 'pin':
            this.togglePin();
            break;
          case 'maximize':
            this.toggleMaximize();
            break;
          case 'close':
            this.close();
            break;
        }
      });
    });
  },

  /**
   * Setup drag listeners on the header
   */
  _setupDragListeners(container: HTMLElement): void {
    const header = container.querySelector('[data-drag-handle]') as HTMLElement;
    if (!header) return;

    const self = this;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-action]')) return;
      if (self._isMaximized) return;

      self._isDragging = true;
      container.classList.add('dragging');

      const rect = container.getBoundingClientRect();
      self._dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!self._isDragging) return;

      const newLeft = e.clientX - self._dragOffset.x;
      const newTop = e.clientY - self._dragOffset.y;

      const maxLeft = window.innerWidth - container.offsetWidth;
      const maxTop = window.innerHeight - container.offsetHeight;

      container.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
      container.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
    };

    const onMouseUp = () => {
      self._isDragging = false;
      container.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    header.addEventListener('mousedown', onMouseDown);
  },

  /**
   * Create a pinned clone of the tooltip
   */
  togglePin(): void {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    this._pinnedCounter++;
    const pinnedId = `${this.containerId}-pinned-${this._pinnedCounter}`;

    const clone = container.cloneNode(true) as HTMLElement;
    clone.id = pinnedId;
    clone.classList.add('pinned');
    clone.classList.remove('closing');

    const pinBtn = clone.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.classList.add('pinned');
      pinBtn.setAttribute('title', 'Desafixar');
      pinBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
          <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
          <line x1="12" y1="16" x2="12" y2="21"/>
          <line x1="8" y1="4" x2="16" y2="4"/>
        </svg>
      `;
    }

    document.body.appendChild(clone);
    this._setupPinnedCloneListeners(clone, pinnedId);
    this.hide();
  },

  /**
   * Setup event listeners for a pinned clone
   */
  _setupPinnedCloneListeners(clone: HTMLElement, cloneId: string): void {
    const pinBtn = clone.querySelector('[data-action="pin"]');
    if (pinBtn) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._closePinnedClone(cloneId);
      });
    }

    const closeBtn = clone.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._closePinnedClone(cloneId);
      });
    }

    let isMaximized = false;
    let savedPosition: { left: string; top: string } | null = null;
    const maxBtn = clone.querySelector('[data-action="maximize"]');
    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isMaximized = !isMaximized;

        if (isMaximized) {
          savedPosition = { left: clone.style.left, top: clone.style.top };
        }
        clone.classList.toggle('maximized', isMaximized);

        if (isMaximized) {
          maxBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="5" y="5" width="14" height="14" rx="2"/>
              <path d="M9 5V3h12v12h-2"/>
            </svg>
          `;
          maxBtn.setAttribute('title', 'Restaurar');
        } else {
          maxBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          `;
          maxBtn.setAttribute('title', 'Maximizar');
          if (savedPosition) {
            clone.style.left = savedPosition.left;
            clone.style.top = savedPosition.top;
          }
        }
      });
    }

    // Setup drag for the clone
    const header = clone.querySelector('[data-drag-handle]') as HTMLElement;
    if (header) {
      let isDragging = false;
      let dragOffset = { x: 0, y: 0 };

      const onMouseDown = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('[data-action]')) return;
        if (isMaximized) return;

        isDragging = true;
        clone.classList.add('dragging');

        const rect = clone.getBoundingClientRect();
        dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const newLeft = e.clientX - dragOffset.x;
        const newTop = e.clientY - dragOffset.y;
        const maxLeft = window.innerWidth - clone.offsetWidth;
        const maxTop = window.innerHeight - clone.offsetHeight;
        clone.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
        clone.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
      };

      const onMouseUp = () => {
        isDragging = false;
        clone.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      header.addEventListener('mousedown', onMouseDown);
    }
  },

  /**
   * Close and remove a pinned clone
   */
  _closePinnedClone(cloneId: string): void {
    const clone = document.getElementById(cloneId);
    if (clone) {
      clone.classList.add('closing');
      setTimeout(() => {
        clone.remove();
      }, 400);
    }
  },

  /**
   * Toggle maximized state
   */
  toggleMaximize(): void {
    this._isMaximized = !this._isMaximized;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    if (this._isMaximized) {
      this._savedPosition = {
        left: container.style.left,
        top: container.style.top
      };
    }

    container.classList.toggle('maximized', this._isMaximized);

    const maxBtn = container.querySelector('[data-action="maximize"]');
    if (maxBtn) {
      if (this._isMaximized) {
        maxBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="5" width="14" height="14" rx="2"/>
            <path d="M9 5V3h12v12h-2"/>
          </svg>
        `;
        maxBtn.setAttribute('title', 'Restaurar');
      } else {
        maxBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        `;
        maxBtn.setAttribute('title', 'Maximizar');
        if (this._savedPosition) {
          container.style.left = this._savedPosition.left;
          container.style.top = this._savedPosition.top;
        }
      }
    }
  },

  /**
   * Close tooltip (reset all states)
   */
  close(): void {
    this._isMaximized = false;
    this._isDragging = false;
    this._savedPosition = null;

    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'pinned', 'maximized', 'dragging', 'closing');
    }
  },

  /**
   * Setup hover listeners on the tooltip itself
   */
  _setupTooltipHoverListeners(container: HTMLElement): void {
    container.onmouseenter = null;
    container.onmouseleave = null;

    container.onmouseenter = () => {
      this._isMouseOverTooltip = true;
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
    };

    container.onmouseleave = () => {
      this._isMouseOverTooltip = false;
      this._startDelayedHide();
    };
  },

  /**
   * Start delayed hide with animation
   */
  _startDelayedHide(): void {
    if (this._isMouseOverTooltip) return;

    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
    }

    this._hideTimer = setTimeout(() => {
      this.hideWithAnimation();
    }, 1500);
  },

  /**
   * Hide tooltip with fade animation
   */
  hideWithAnimation(): void {
    const container = document.getElementById(this.containerId);
    if (container && container.classList.contains('visible')) {
      container.classList.add('closing');
      setTimeout(() => {
        this._isMouseOverTooltip = false;
        this._isMaximized = false;
        this._isDragging = false;
        this._savedPosition = null;

        container.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging');
        container.innerHTML = '';
      }, 400);
    }
  },

  /**
   * Hide tooltip immediately
   */
  hide(): void {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    this._isMouseOverTooltip = false;
    this._isMaximized = false;
    this._isDragging = false;
    this._savedPosition = null;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging');
    }
  },

  /**
   * Attach tooltip to an element with automatic show/hide on hover
   */
  attach(element: HTMLElement, getDataFn: () => UsersSummaryData): () => void {
    const self = this;

    const handleMouseEnter = (e: MouseEvent) => {
      if (self._hideTimer) {
        clearTimeout(self._hideTimer);
        self._hideTimer = null;
      }
      const summary = getDataFn();
      if (summary && summary.totalUsers > 0) {
        self.show(element, summary, e);
      }
    };

    const handleMouseLeave = () => {
      self._startDelayedHide();
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      self.hide();
    };
  },

  /**
   * Build mock summary data for testing
   */
  buildMockData(customerName?: string): UsersSummaryData {
    return {
      totalUsers: 12,
      activeUsers: 10,
      inactiveUsers: 2,
      byRole: {
        admin: 2,
        operator: 5,
        viewer: 5,
      },
      lastUpdated: new Date().toISOString(),
      customerName: customerName || 'Shopping',
    };
  },
};

// Default export
export default UsersSummaryTooltip;
