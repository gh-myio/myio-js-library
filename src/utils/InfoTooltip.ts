/**
 * InfoTooltip - Standardized Premium Tooltip Component
 * RFC-0105: Draggable tooltip with PIN, maximize, close and delayed hide
 *
 * Features:
 * - Draggable header
 * - PIN button (creates independent clone)
 * - Maximize/restore button
 * - Close button
 * - Delayed hide (2.5s) with hover detection
 * - Smooth animations
 *
 * Interaction model (hover = passive, click = interactive):
 * - A tooltip opened by hover (`attach` → mouseenter, or `show(..., { interactive: false })`)
 *   is PASSIVE: it only displays information and never captures the pointer
 *   (`pointer-events: none` even while visible). It hides on scroll and on mouseleave.
 * - A tooltip opened by click (`attach` → click, or `show(...)` with the default
 *   `interactive: true`) is INTERACTIVE: the user can enter it, pin, drag, maximize, copy.
 *
 * Why: a visible/closing tooltip with `pointer-events: auto` sat over neighbouring
 * triggers (e.g. the cells of an hour grid), swallowed their mouseenter and kept
 * itself alive via `isMouseOverTooltip` — "hover doesn't work".
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
  /**
   * `true` (default): interactive tooltip — the user can move the mouse into it,
   * pin, drag, maximize. `false`: passive tooltip — informational only, never
   * captures the pointer (`pointer-events: none`), hides on scroll.
   */
  interactive?: boolean;
}

export interface InfoTooltipAttachOptions {
  /**
   * `false` (default): hover opens a passive tooltip; click opens the interactive one.
   * `true`: legacy behaviour — hover opens the interactive tooltip (the user can
   * enter it). Only for callers that truly need hover-to-pin.
   */
  hoverInteractive?: boolean;
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
  z-index: 9999999;
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

/* While fading out the panel is invisible but must NOT block the pointer
   (measured ~410 ms of an invisible panel swallowing mouseenter on neighbours). */
.myio-info-tooltip.closing {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease, transform 0.4s ease;
  pointer-events: none;
}

/* Passive (hover-opened) tooltip: informational only, never captures the pointer.
   Declared after .visible so it wins at equal specificity. */
.myio-info-tooltip.passive {
  pointer-events: none;
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

/* Device list container - scrollable with max height */
.myio-info-tooltip__device-list {
  max-height: 200px;
  overflow-y: auto;
}

/* When tooltip is maximized, expand device list to fill available space */
.myio-info-tooltip.maximized .myio-info-tooltip__device-list {
  max-height: none;
  flex: 1;
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
  /** Timeout that finishes the closing animation (removes `visible`, clears innerHTML).
   *  Tracked so `clearAllTimers()` can cancel it — otherwise a `show()` issued during
   *  the 400 ms fade-out would be wiped by the stale callback. */
  closeTimer: ReturnType<typeof setTimeout> | null;
  isMouseOverTooltip: boolean;
  isMaximized: boolean;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  savedPosition: { left: string; top: string } | null;
  pinnedCounter: number;
  isPinned: boolean;
  /** Current tooltip is passive (hover-opened): never captures the pointer. */
  isPassive: boolean;
  /** Window scroll listener installed while a passive tooltip is visible. */
  scrollListener: (() => void) | null;
}

const HIDE_DELAY_MS = 2500; // 2.5 seconds
const SAFETY_TIMEOUT_MS = 15000; // 15 seconds max without interaction
const CLOSE_ANIMATION_MS = 400; // must match .myio-info-tooltip.closing transition

const state: TooltipState = {
  hideTimer: null,
  safetyTimer: null,
  closeTimer: null,
  isMouseOverTooltip: false,
  isMaximized: false,
  isDragging: false,
  dragOffset: { x: 0, y: 0 },
  savedPosition: null,
  pinnedCounter: 0,
  isPinned: false,
  isPassive: false,
  scrollListener: null,
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
  // The container is shared by every tooltip on the page: a passive tooltip
  // (pointer-events: none) must not keep handlers from a previous interactive one.
  if (state.isPassive) {
    container.onmouseenter = null;
    container.onmouseleave = null;
    return;
  }

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

  // Passive tooltip: the mouse can never be over it, nothing to drag.
  if (state.isPassive) {
    header.onmousedown = null;
    return;
  }

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
  // A pinned clone is always interactive — never inherit `passive`.
  clone.classList.remove('closing', 'passive');

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
  // A passive tooltip can never have the mouse over it (pointer-events: none),
  // so a stale isMouseOverTooltip must not keep it alive.
  if (state.isPinned) return;
  if (state.isMouseOverTooltip && !state.isPassive) return;
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
  if (state.closeTimer) {
    clearTimeout(state.closeTimer);
    state.closeTimer = null;
  }
}

/**
 * Passive tooltips use `position: fixed` and do not follow the page: after a
 * scroll they would sit over unrelated content. Hide them as soon as the
 * window scrolls (capture + passive listener so it costs nothing on scroll).
 */
function installScrollListener(): void {
  if (state.scrollListener || typeof window === 'undefined') return;
  const onScroll = () => {
    InfoTooltip.hide();
  };
  state.scrollListener = onScroll;
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
}

function removeScrollListener(): void {
  if (!state.scrollListener || typeof window === 'undefined') return;
  window.removeEventListener('scroll', state.scrollListener, { capture: true });
  state.scrollListener = null;
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
  removeScrollListener();

  const container = document.getElementById('myio-info-tooltip');
  if (container && container.classList.contains('visible')) {
    container.classList.add('closing');
    if (state.closeTimer) clearTimeout(state.closeTimer);
    // Tracked in state so a show() during the fade-out cancels it (clearAllTimers)
    // instead of having its fresh content wiped by this callback.
    state.closeTimer = setTimeout(() => {
      state.closeTimer = null;
      // Reset state and clear content to prevent invisible blocking divs
      container.classList.remove('visible', 'closing', 'pinned', 'maximized', 'dragging', 'passive');
      container.innerHTML = '';
    }, CLOSE_ANIMATION_MS);
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
   * Show tooltip.
   *
   * `options.interactive` defaults to `true` (explicit callers are click-driven):
   * the user can enter the tooltip, pin, drag, maximize. Pass `interactive: false`
   * for a passive tooltip that never captures the pointer and hides on scroll —
   * this is what `attach()` uses on hover.
   */
  show(triggerElement: HTMLElement, options: InfoTooltipOptions): void {
    // Cancel pending timers (including a closing animation still in flight)
    clearAllTimers();

    const container = this.getContainer();
    container.classList.remove('closing');
    state.isPinned = false;
    state.isMouseOverTooltip = false;
    state.isPassive = options.interactive === false;

    // The container is shared by every tooltip on the page: set/clear `passive`
    // on every show so the class never leaks from one tooltip to the next.
    container.classList.toggle('passive', state.isPassive);
    if (state.isPassive) {
      installScrollListener();
    } else {
      removeScrollListener();
    }

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
    removeScrollListener();
    state.isMouseOverTooltip = false;
    state.isPassive = false;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'closing', 'passive');
    }
  },

  /**
   * Close and reset all states
   */
  close(): void {
    clearAllTimers();
    removeScrollListener();
    state.isMaximized = false;
    state.isDragging = false;
    state.savedPosition = null;
    state.isMouseOverTooltip = false;
    state.isPinned = false;
    state.isPassive = false;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.classList.remove('visible', 'pinned', 'maximized', 'dragging', 'closing', 'passive');
    }
  },

  /**
   * Destroy tooltip completely - guaranteed cleanup
   * Removes from DOM and clears all timers/state
   */
  destroy(): void {
    clearAllTimers();
    removeScrollListener();
    state.isMaximized = false;
    state.isDragging = false;
    state.savedPosition = null;
    state.isMouseOverTooltip = false;
    state.isPinned = false;
    state.isPassive = false;

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
   * Attach tooltip to trigger element.
   *
   * - `mouseenter` → passive tooltip (informational, never captures the pointer,
   *   hides on scroll / after `mouseleave`).
   * - `click` → interactive tooltip (enter it, pin, drag, maximize), cancelling
   *   any pending hide.
   *
   * `attachOptions.hoverInteractive: true` restores the legacy behaviour where
   * hover already opens the interactive tooltip.
   *
   * Returns a cleanup function that removes all listeners and hides the tooltip.
   */
  attach(
    triggerElement: HTMLElement,
    getOptions: () => InfoTooltipOptions,
    attachOptions: InfoTooltipAttachOptions = {}
  ): () => void {
    const self = this;
    const hoverInteractive = attachOptions.hoverInteractive === true;

    const handleMouseEnter = () => {
      if (state.hideTimer) {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      self.show(triggerElement, { ...getOptions(), interactive: hoverInteractive });
    };

    const handleMouseLeave = () => {
      startDelayedHide();
    };

    const handleClick = () => {
      if (state.hideTimer) {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      self.show(triggerElement, { ...getOptions(), interactive: true });
    };

    triggerElement.addEventListener('mouseenter', handleMouseEnter);
    triggerElement.addEventListener('mouseleave', handleMouseLeave);
    triggerElement.addEventListener('click', handleClick);

    // Return cleanup function
    return () => {
      triggerElement.removeEventListener('mouseenter', handleMouseEnter);
      triggerElement.removeEventListener('mouseleave', handleMouseLeave);
      triggerElement.removeEventListener('click', handleClick);
      self.hide();
    };
  },
};

export default InfoTooltip;
