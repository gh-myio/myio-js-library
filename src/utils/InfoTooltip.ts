/**
 * InfoTooltip - Standardized Premium Tooltip Component
 * RFC-0105: Draggable tooltip with PIN, maximize, close and delayed hide
 *
 * Features:
 * - Draggable header
 * - PIN button (creates independent clone)
 * - Maximize/restore button
 * - Close button
 * - Delayed hide (1.5s) with hover detection
 * - Smooth animations
 *
 * @example
 * // Create and show tooltip
 * InfoTooltip.show(triggerElement, {
 *   icon: '❄️',
 *   title: 'Climatização - Detalhes',
 *   content: '<div>...</div>'
 * });
 *
 * // Hide tooltip
 * InfoTooltip.hide();
 */

// ============================================
// Types
// ============================================

export interface InfoTooltipOptions {
  icon: string;
  title: string;
  content: string;
  containerId?: string;
}

// ============================================
// CSS Styles
// ============================================

const INFO_TOOLTIP_CSS = `
/* ============================================
   Info Tooltip (RFC-0105)
   Premium draggable tooltip with actions
   ============================================ */

.myio-info-tooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.25s ease;
  transform: translateY(5px);
}

.myio-info-tooltip.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.myio-info-tooltip.closing {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.myio-info-tooltip.pinned {
  box-shadow: 0 0 0 2px #047857, 0 10px 40px rgba(0, 0, 0, 0.2);
  border-radius: 12px;
}

.myio-info-tooltip.dragging {
  transition: none !important;
  cursor: move;
}

.myio-info-tooltip.maximized {
  top: 20px !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 20px !important;
  width: auto !important;
  max-width: none !important;
}

.myio-info-tooltip.maximized .myio-info-tooltip__panel {
  width: 100%;
  height: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
}

.myio-info-tooltip.maximized .myio-info-tooltip__content {
  flex: 1;
  overflow-y: auto;
}

.myio-info-tooltip__panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.08);
  min-width: 320px;
  max-width: 400px;
  font-size: 12px;
  color: #1e293b;
  overflow: hidden;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}

.myio-info-tooltip__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%);
  border-bottom: 1px solid #cbd5e1;
  cursor: move;
  user-select: none;
}

.myio-info-tooltip__icon {
  font-size: 18px;
}

.myio-info-tooltip__title {
  font-weight: 700;
  font-size: 14px;
  color: #475569;
  letter-spacing: 0.3px;
  flex: 1;
}

.myio-info-tooltip__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.myio-info-tooltip__header-btn {
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

.myio-info-tooltip__header-btn:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #1e293b;
}

.myio-info-tooltip__header-btn.pinned {
  background: #047857;
  color: white;
}

.myio-info-tooltip__header-btn.pinned:hover {
  background: #065f46;
  color: white;
}

.myio-info-tooltip__header-btn svg {
  width: 14px;
  height: 14px;
}

.myio-info-tooltip__content {
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}

/* Content styles */
.myio-info-tooltip__section {
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.myio-info-tooltip__section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.myio-info-tooltip__section-title {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.myio-info-tooltip__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  gap: 12px;
}

.myio-info-tooltip__label {
  color: #64748b;
  font-size: 12px;
  flex-shrink: 0;
}

.myio-info-tooltip__value {
  color: #1e293b;
  font-weight: 600;
  text-align: right;
}

.myio-info-tooltip__value--highlight {
  color: #10b981;
  font-weight: 700;
  font-size: 14px;
}

.myio-info-tooltip__notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  margin-top: 12px;
}

.myio-info-tooltip__notice-icon {
  font-size: 14px;
  flex-shrink: 0;
  margin-top: 1px;
}

.myio-info-tooltip__notice-text {
  font-size: 11px;
  color: #475569;
  line-height: 1.5;
}

.myio-info-tooltip__notice-text strong {
  font-weight: 700;
  color: #334155;
}

.myio-info-tooltip__category {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 6px;
  border-left: 3px solid #94a3b8;
}

.myio-info-tooltip__category:last-child {
  margin-bottom: 0;
}

.myio-info-tooltip__category--climatizacao {
  border-left-color: #00C896;
  background: #ecfdf5;
}

.myio-info-tooltip__category--outros {
  border-left-color: #9C27B0;
  background: #fdf4ff;
}

.myio-info-tooltip__category-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.myio-info-tooltip__category-info {
  flex: 1;
}

.myio-info-tooltip__category-name {
  font-weight: 600;
  color: #334155;
  font-size: 12px;
}

.myio-info-tooltip__category-desc {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}

.myio-info-tooltip__category-value {
  font-weight: 700;
  color: #334155;
  font-size: 13px;
}
`;

// ============================================
// CSS Injection
// ============================================

let cssInjected = false;

function injectCSS(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;

  const styleId = 'myio-info-tooltip-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = INFO_TOOLTIP_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ============================================
// State Management
// ============================================

interface TooltipState {
  hideTimer: ReturnType<typeof setTimeout> | null;
  safetyTimer: ReturnType<typeof setTimeout> | null;
  isMouseOverTooltip: boolean;
  isMaximized: boolean;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  savedPosition: { left: string; top: string } | null;
  pinnedCounter: number;
  isPinned: boolean;
}

const HIDE_DELAY_MS = 2500; // 1.5 seconds
const SAFETY_TIMEOUT_MS = 15000; // 15 seconds max without interaction

const state: TooltipState = {
  hideTimer: null,
  safetyTimer: null,
  isMouseOverTooltip: false,
  isMaximized: false,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  savedPosition: null,
  pinnedCounter: 0,
  isPinned: false,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Generate header HTML with action buttons
 */
function generateHeaderHTML(icon: string, title: string): string {
  return `
    <div class="myio-info-tooltip__header" data-drag-handle>
      <span class="myio-info-tooltip__icon">${icon}</span>
      <span class="myio-info-tooltip__title">${title}</span>
      <div class="myio-info-tooltip__header-actions">
        <button class="myio-info-tooltip__header-btn" data-action="pin" title="Fixar na tela">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 4v6l-2 4v2h10v-2l-2-4V4"/>
            <line x1="12" y1="16" x2="12" y2="21"/>
            <line x1="8" y1="4" x2="16" y2="4"/>
          </svg>
        </button>
        <button class="myio-info-tooltip__header-btn" data-action="maximize" title="Maximizar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
        </button>
        <button class="myio-info-tooltip__header-btn" data-action="close" title="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Setup hover listeners on tooltip container
 */
function setupHoverListeners(container: HTMLElement): void {
  container.onmouseenter = () => {
    state.isMouseOverTooltip = true;
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
    // Reset safety timer on interaction
    resetSafetyTimer();
  };

  container.onmouseleave = () => {
    state.isMouseOverTooltip = false;
    startDelayedHide();
  };
}

/**
 * Setup button click listeners
 */
function setupButtonListeners(container: HTMLElement): void {
  const buttons = container.querySelectorAll('[data-action]');
  buttons.forEach((btn) => {
    (btn as HTMLElement).onclick = (e: MouseEvent) => {
      e.stopPropagation();
      const action = (btn as HTMLElement).dataset.action;
      switch (action) {
        case 'pin':
          createPinnedClone(container);
          break;
        case 'maximize':
          toggleMaximize(container);
          break;
        case 'close':
          InfoTooltip.close();
          break;
      }
    };
  });
}

/**
 * Setup drag listeners
 */
function setupDragListeners(container: HTMLElement): void {
  const header = container.querySelector('[data-drag-handle]') as HTMLElement;
  if (!header) return;

  header.onmousedown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return;
    if (state.isMaximized) return;

    state.isDragging = true;
    container.classList.add('dragging');

    const rect = container.getBoundingClientRect();
    state.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!state.isDragging) return;
      const newLeft = e.clientX - state.dragOffset.x;
      const newTop = e.clientY - state.dragOffset.y;
      const maxLeft = window.innerWidth - container.offsetWidth;
      const maxTop = window.innerHeight - container.offsetHeight;
      container.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
      container.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
    };

    const onMouseUp = () => {
      state.isDragging = false;
      container.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
}

/**
 * Create pinned clone
 */
function createPinnedClone(container: HTMLElement): void {
  state.pinnedCounter++;
  const pinnedId = `myio-info-tooltip-pinned-${state.pinnedCounter}`;

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
  setupPinnedCloneListeners(clone, pinnedId);
  InfoTooltip.hide();
}

/**
 * Setup listeners for pinned clone
 */
function setupPinnedCloneListeners(clone: HTMLElement, cloneId: string): void {
  let isMaximized = false;
  let savedPosition: { left: string; top: string } | null = null;

  const pinBtn = clone.querySelector('[data-action="pin"]');
  if (pinBtn) {
    (pinBtn as HTMLElement).onclick = (e: MouseEvent) => {
      e.stopPropagation();
      closePinnedClone(cloneId);
    };
  }

  const closeBtn = clone.querySelector('[data-action="close"]');
  if (closeBtn) {
    (closeBtn as HTMLElement).onclick = (e: MouseEvent) => {
      e.stopPropagation();
      closePinnedClone(cloneId);
    };
  }

  const maxBtn = clone.querySelector('[data-action="maximize"]');
  if (maxBtn) {
    (maxBtn as HTMLElement).onclick = (e: MouseEvent) => {
      e.stopPropagation();
      isMaximized = !isMaximized;
      if (isMaximized) {
        savedPosition = { left: clone.style.left, top: clone.style.top };
        maxBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 5V3h12v12h-2"/></svg>`;
        maxBtn.setAttribute('title', 'Restaurar');
      } else {
        maxBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
        maxBtn.setAttribute('title', 'Maximizar');
        if (savedPosition) {
          clone.style.left = savedPosition.left;
          clone.style.top = savedPosition.top;
        }
      }
      clone.classList.toggle('maximized', isMaximized);
    };
  }

  // Drag for clone
  const header = clone.querySelector('[data-drag-handle]') as HTMLElement;
  if (header) {
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    header.onmousedown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-action]')) return;
      if (isMaximized) return;

      isDragging = true;
      clone.classList.add('dragging');
      const rect = clone.getBoundingClientRect();
      dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

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

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  }
}

/**
 * Close pinned clone
 */
function closePinnedClone(cloneId: string): void {
  const clone = document.getElementById(cloneId);
  if (clone) {
    clone.classList.add('closing');
    setTimeout(() => clone.remove(), 400);
  }
}

/**
 * Toggle maximize
 */
function toggleMaximize(container: HTMLElement): void {
  state.isMaximized = !state.isMaximized;

  if (state.isMaximized) {
    state.savedPosition = {
      left: container.style.left,
      top: container.style.top,
    };
  }

  container.classList.toggle('maximized', state.isMaximized);

  const maxBtn = container.querySelector('[data-action="maximize"]');
  if (maxBtn) {
    if (state.isMaximized) {
      maxBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 5V3h12v12h-2"/></svg>`;
      maxBtn.setAttribute('title', 'Restaurar');
    } else {
      maxBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
      maxBtn.setAttribute('title', 'Maximizar');
      if (state.savedPosition) {
        container.style.left = state.savedPosition.left;
        container.style.top = state.savedPosition.top;
      }
    }
  }
}

/**
 * Start delayed hide (uses HIDE_DELAY_MS constant)
 */
function startDelayedHide(): void {
  if (state.isMouseOverTooltip || state.isPinned) return;
  if (state.hideTimer) {
    clearTimeout(state.hideTimer);
  }
  state.hideTimer = setTimeout(() => {
    hideWithAnimation();
  }, HIDE_DELAY_MS);
}

/**
 * Reset safety timer - called on any user interaction
 */
function resetSafetyTimer(): void {
  if (state.safetyTimer) {
    clearTimeout(state.safetyTimer);
    state.safetyTimer = null;
  }
  // Only set safety timer if tooltip is visible and not pinned
  const container = document.getElementById('myio-info-tooltip');
  if (container && container.classList.contains('visible') && !state.isPinned) {
    state.safetyTimer = setTimeout(() => {
      console.log('[InfoTooltip] Safety timeout reached - forcing hide');
      InfoTooltip.destroy();
    }, SAFETY_TIMEOUT_MS);
  }
}

/**
 * Clear all timers
 */
function clearAllTimers(): void {
  if (state.hideTimer) {
    clearTimeout(state.hideTimer);
    state.hideTimer = null;
  }
  if (state.safetyTimer) {
    clearTimeout(state.safetyTimer);
    state.safetyTimer = null;
  }
}

/**
 * Hide with animation
 */
function hideWithAnimation(): void {
  // Clear safety timer when hiding
  if (state.safetyTimer) {
    clearTimeout(state.safetyTimer);
    state.safetyTimer = null;
  }

  const container = document.getElementById('myio-info-tooltip');
  if (container && container.classList.contains('visible')) {
    container.classList.add('closing');
    setTimeout(() => {
      container.classList.remove('visible', 'closing');
    }, 400);
  }
}

/**
 * Position tooltip near trigger element
 */
function positionTooltip(container: HTMLElement, triggerElement: HTMLElement): void {
  const rect = triggerElement.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 8;

  const tooltipWidth = 380;
  if (left + tooltipWidth > window.innerWidth - 20) {
    left = window.innerWidth - tooltipWidth - 20;
  }
  if (left < 10) left = 10;

  if (top + 400 > window.innerHeight) {
    top = rect.top - 8 - 400;
    if (top < 10) top = 10;
  }

  container.style.left = left + 'px';
  container.style.top = top + 'px';
}

// ============================================
// InfoTooltip Object
// ============================================

export const InfoTooltip = {
  containerId: 'myio-info-tooltip',

  /**
   * Get or create container
   */
  getContainer(): HTMLElement {
    injectCSS();

    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'myio-info-tooltip';
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Show tooltip
   */
  show(triggerElement: HTMLElement, options: InfoTooltipOptions): void {
    // Cancel pending timers
    clearAllTimers();

    const container = this.getContainer();
    container.classList.remove('closing');
    state.isPinned = false;

    // Build HTML
    container.innerHTML = `
      <div class="myio-info-tooltip__panel">
        ${generateHeaderHTML(options.icon, options.title)}
        <div class="myio-info-tooltip__content">
          ${options.content}
        </div>
      </div>
    `;

    // Position and show
    positionTooltip(container, triggerElement);
    container.classList.add('visible');

    // Setup listeners
    setupHoverListeners(container);
    setupButtonListeners(container);
    setupDragListeners(container);

    // Start safety timer to guarantee cleanup
    resetSafetyTimer();
  },

  /**
   * Start delayed hide
   */
  startDelayedHide(): void {
    startDelayedHide();
  },

  /**
   * Hide immediately
   */
  hide(): void {
    clearAllTimers();
    state.isMouseOverTooltip = false;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'closing');
    }
  },

  /**
   * Close and reset all states
   */
  close(): void {
    clearAllTimers();
    state.isMaximized = false;
    state.isDragging = false;
    state.savedPosition = null;
    state.isMouseOverTooltip = false;
    state.isPinned = false;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'pinned', 'maximized', 'dragging', 'closing');
    }
  },

  /**
   * Destroy tooltip completely - guaranteed cleanup
   * Removes from DOM and clears all timers/state
   */
  destroy(): void {
    clearAllTimers();
    state.isMaximized = false;
    state.isDragging = false;
    state.savedPosition = null;
    state.isMouseOverTooltip = false;
    state.isPinned = false;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.remove();
    }

    // Also remove any pinned clones
    const pinnedClones = document.querySelectorAll('[id^="myio-info-tooltip-pinned-"]');
    pinnedClones.forEach((clone) => clone.remove());

    console.log('[InfoTooltip] Destroyed - all tooltips removed');
  },

  /**
   * Attach tooltip to trigger element with hover behavior
   */
  attach(triggerElement: HTMLElement, getOptions: () => InfoTooltipOptions): () => void {
    const self = this;

    const handleMouseEnter = () => {
      if (state.hideTimer) {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      const options = getOptions();
      self.show(triggerElement, options);
    };

    const handleMouseLeave = () => {
      startDelayedHide();
    };

    triggerElement.addEventListener('mouseenter', handleMouseEnter);
    triggerElement.addEventListener('mouseleave', handleMouseLeave);

    // Return cleanup function
    return () => {
      triggerElement.removeEventListener('mouseenter', handleMouseEnter);
      triggerElement.removeEventListener('mouseleave', handleMouseLeave);
      self.hide();
    };
  },
};

export default InfoTooltip;
