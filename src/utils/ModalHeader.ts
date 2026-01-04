/**
 * ModalHeader - Standardized Premium Modal Header Component
 * RFC-0121: Reusable modal header with MyIO Premium Style
 *
 * Features:
 * - Icon + Title on the left
 * - Action buttons on the right (Theme toggle, Maximize, Close)
 * - Draggable header support
 * - Dark/Light theme support
 * - Consistent styling across all modals
 *
 * @example
 * // Generate header HTML
 * const headerHtml = ModalHeader.generateHTML({
 *   icon: '🌡️',
 *   title: 'Historico de Temperatura',
 *   modalId: 'temp-modal',
 *   theme: 'dark',
 *   isMaximized: false,
 *   showThemeToggle: true,
 *   showMaximize: true,
 *   showClose: true,
 * });
 *
 * // Setup event handlers
 * ModalHeader.setupHandlers({
 *   modalId: 'temp-modal',
 *   onThemeToggle: () => { ... },
 *   onMaximize: () => { ... },
 *   onClose: () => { ... },
 * });
 */

// ============================================
// Types
// ============================================

export interface ModalHeaderOptions {
  /** Icon emoji or HTML */
  icon: string;
  /** Modal title */
  title: string;
  /** Unique modal ID for button identification */
  modalId: string;
  /** Current theme mode */
  theme?: 'dark' | 'light';
  /** Whether modal is currently maximized */
  isMaximized?: boolean;
  /** Show theme toggle button */
  showThemeToggle?: boolean;
  /** Show maximize button */
  showMaximize?: boolean;
  /** Show close button */
  showClose?: boolean;
  /** Custom primary color (default: #3e1a7d - MyIO Purple) */
  primaryColor?: string;
  /** Border radius when not maximized */
  borderRadius?: string;
}

export interface ModalHeaderHandlers {
  /** Unique modal ID */
  modalId: string;
  /** Theme toggle callback */
  onThemeToggle?: () => void;
  /** Maximize callback */
  onMaximize?: () => void;
  /** Close callback */
  onClose?: () => void;
  /** Drag start callback */
  onDragStart?: (e: MouseEvent) => void;
}

export interface ModalHeaderControllerOptions {
  /** Unique modal ID */
  modalId: string;
  /** Initial theme */
  theme?: 'dark' | 'light';
  /** Callback when theme changes */
  onThemeChange?: (theme: 'dark' | 'light') => void;
  /** Callback when maximize state changes */
  onMaximizeChange?: (isMaximized: boolean) => void;
  /** Callback when close is clicked */
  onClose?: () => void;
  /** Element to toggle 'maximized' class on (e.g., modal card) */
  maximizeTarget?: HTMLElement | string;
  /** Element to toggle light theme class on (e.g., header) */
  themeTarget?: HTMLElement | string;
  /** CSS class to add when light theme */
  lightThemeClass?: string;
  /** CSS class to add when maximized */
  maximizedClass?: string;
}

export interface ModalHeaderController {
  /** Current theme */
  getTheme(): 'dark' | 'light';
  /** Current maximized state */
  isMaximized(): boolean;
  /** Toggle theme */
  toggleTheme(): void;
  /** Set theme */
  setTheme(theme: 'dark' | 'light'): void;
  /** Toggle maximize */
  toggleMaximize(): void;
  /** Set maximize state */
  setMaximized(maximized: boolean): void;
  /** Reset state (useful when closing modal) */
  reset(): void;
  /** Destroy controller and remove event listeners */
  destroy(): void;
}

// ============================================
// CSS Styles
// ============================================

const MODAL_HEADER_CSS = `
/* ============================================
   Modal Header - MyIO Premium Style
   RFC-0121: Standardized modal header
   ============================================ */

.myio-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--modal-header-bg, #3e1a7d);
  color: white;
  min-height: 32px;
  user-select: none;
  cursor: move;
}

.myio-modal-header--not-maximized {
  border-radius: var(--modal-header-radius, 10px 10px 0 0);
}

.myio-modal-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.myio-modal-header__icon {
  font-size: 18px;
  flex-shrink: 0;
}

.myio-modal-header__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: white;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.myio-modal-header__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.myio-modal-header__btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  transition: background-color 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 28px;
  line-height: 1;
  vertical-align: middle;
}

.myio-modal-header__btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.myio-modal-header__btn:active {
  background: rgba(255, 255, 255, 0.25);
}

.myio-modal-header__btn--close {
  font-weight: bold;
}

.myio-modal-header__btn--close:hover {
  background: rgba(239, 68, 68, 0.3);
  color: #fecaca;
}

/* Light Theme Override */
.myio-modal-header--light {
  background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%);
  color: #1e293b;
  border-bottom: 1px solid #cbd5e1;
}

.myio-modal-header--light .myio-modal-header__title {
  color: #475569;
}

.myio-modal-header--light .myio-modal-header__btn {
  color: rgba(71, 85, 105, 0.8);
}

.myio-modal-header--light .myio-modal-header__btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #1e293b;
}

.myio-modal-header--light .myio-modal-header__btn--close:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}
`;

// ============================================
// CSS Injection
// ============================================

let cssInjected = false;

function injectCSS(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return;

  const styleId = 'myio-modal-header-styles';
  if (document.getElementById(styleId)) {
    cssInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = MODAL_HEADER_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ============================================
// ModalHeader Object
// ============================================

export const ModalHeader = {
  /**
   * Generate modal header HTML
   */
  generateHTML(options: ModalHeaderOptions): string {
    injectCSS();

    const {
      icon,
      title,
      modalId,
      theme = 'dark',
      isMaximized = false,
      showThemeToggle = true,
      showMaximize = true,
      showClose = true,
      primaryColor = '#3e1a7d',
      borderRadius = '10px 10px 0 0',
    } = options;

    const themeClass = theme === 'light' ? 'myio-modal-header--light' : '';
    const maximizedClass = isMaximized ? '' : 'myio-modal-header--not-maximized';

    // Theme toggle button
    const themeToggleBtn = showThemeToggle
      ? `<button
          id="${modalId}-theme-toggle"
          class="myio-modal-header__btn"
          title="Alternar tema"
        >${theme === 'dark' ? '☀️' : '🌙'}</button>`
      : '';

    // Maximize button
    const maximizeBtn = showMaximize
      ? `<button
          id="${modalId}-maximize"
          class="myio-modal-header__btn"
          title="${isMaximized ? 'Restaurar' : 'Maximizar'}"
        >${isMaximized ? '🗗' : '🗖'}</button>`
      : '';

    // Close button
    const closeBtn = showClose
      ? `<button
          id="${modalId}-close"
          class="myio-modal-header__btn myio-modal-header__btn--close"
          title="Fechar"
        >&times;</button>`
      : '';

    return `
      <div
        class="myio-modal-header ${themeClass} ${maximizedClass}"
        id="${modalId}-header"
        style="--modal-header-bg: ${primaryColor}; --modal-header-radius: ${borderRadius};"
        data-drag-handle
      >
        <div class="myio-modal-header__left">
          <span class="myio-modal-header__icon">${icon}</span>
          <h2 class="myio-modal-header__title">${title}</h2>
        </div>
        <div class="myio-modal-header__actions">
          ${themeToggleBtn}
          ${maximizeBtn}
          ${closeBtn}
        </div>
      </div>
    `;
  },

  /**
   * Generate inline style header HTML (for modals that don't use CSS classes)
   * More compatible with existing modal implementations
   */
  generateInlineHTML(options: ModalHeaderOptions): string {
    const {
      icon,
      title,
      modalId,
      theme = 'dark',
      isMaximized = false,
      showThemeToggle = true,
      showMaximize = true,
      showClose = true,
      primaryColor = '#3e1a7d',
      borderRadius = '10px 10px 0 0',
    } = options;

    const isDark = theme === 'dark';
    const bgColor = isDark ? primaryColor : 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%)';
    const textColor = isDark ? 'white' : '#475569';
    const btnColor = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(71,85,105,0.8)';

    const headerStyle = `
      padding: 8px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${bgColor};
      color: ${textColor};
      border-radius: ${isMaximized ? '0' : borderRadius};
      min-height: 32px;
      user-select: none;
      cursor: move;
    `
      .replace(/\s+/g, ' ')
      .trim();

    const btnStyle = `
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      color: ${btnColor};
      transition: background-color 0.2s;
    `
      .replace(/\s+/g, ' ')
      .trim();

    const closeBtnStyle = `${btnStyle} font-weight: bold; line-height: 1; vertical-align: middle;`;

    // Theme toggle button
    const themeToggleBtn = showThemeToggle
      ? `<button id="${modalId}-theme-toggle" title="Alternar tema" style="${btnStyle} line-height: 1; vertical-align: middle;">${
          theme === 'dark' ? '☀️' : '🌙'
        }</button>`
      : '';

    // Maximize button
    const maximizeBtn = showMaximize
      ? `<button id="${modalId}-maximize" title="${
          isMaximized ? 'Restaurar' : 'Maximizar'
        }" style="${btnStyle} line-height: 1; vertical-align: middle;">${isMaximized ? '🗗' : '🗖'}</button>`
      : '';

    // Close button
    const closeBtn = showClose
      ? `<button id="${modalId}-close" title="Fechar" style="${closeBtnStyle}">&times;</button>`
      : '';

    return `
      <div id="${modalId}-header" style="${headerStyle}" data-drag-handle>
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
          <span style="font-size: 18px;">${icon}</span>
          <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: ${textColor}; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${title}
          </h2>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          ${themeToggleBtn}
          ${maximizeBtn}
          ${closeBtn}
        </div>
      </div>
    `;
  },

  /**
   * Setup event handlers for modal header buttons
   */
  setupHandlers(handlers: ModalHeaderHandlers): void {
    const { modalId, onThemeToggle, onMaximize, onClose, onDragStart } = handlers;

    // Theme toggle
    if (onThemeToggle) {
      const themeBtn = document.getElementById(`${modalId}-theme-toggle`);
      if (themeBtn) {
        themeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onThemeToggle();
        });
      }
    }

    // Maximize
    if (onMaximize) {
      const maxBtn = document.getElementById(`${modalId}-maximize`);
      if (maxBtn) {
        maxBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onMaximize();
        });
      }
    }

    // Close
    if (onClose) {
      const closeBtn = document.getElementById(`${modalId}-close`);
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onClose();
        });
      }
    }

    // Drag
    if (onDragStart) {
      const header = document.getElementById(`${modalId}-header`);
      if (header) {
        header.addEventListener('mousedown', (e: MouseEvent) => {
          // Don't start drag if clicking on a button
          if ((e.target as HTMLElement).closest('button')) return;
          onDragStart(e);
        });
      }
    }
  },

  /**
   * Update header button states (theme icon, maximize icon)
   */
  updateState(modalId: string, state: { theme?: 'dark' | 'light'; isMaximized?: boolean }): void {
    if (state.theme !== undefined) {
      const themeBtn = document.getElementById(`${modalId}-theme-toggle`);
      if (themeBtn) {
        themeBtn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
      }
    }

    if (state.isMaximized !== undefined) {
      const maxBtn = document.getElementById(`${modalId}-maximize`);
      if (maxBtn) {
        maxBtn.textContent = state.isMaximized ? '🗗' : '🗖';
        maxBtn.title = state.isMaximized ? 'Restaurar' : 'Maximizar';
      }
    }
  },

  /**
   * Inject CSS (useful if you need to manually inject styles)
   */
  injectCSS,

  /**
   * Create a controller that manages header state (theme, maximize)
   * Encapsulates all toggle logic and updates button states automatically
   *
   * @example
   * const headerController = ModalHeader.createController({
   *   modalId: 'my-modal',
   *   theme: 'dark',
   *   maximizeTarget: '.fm-card',
   *   maximizedClass: 'maximized',
   *   themeTarget: '.fm-header',
   *   lightThemeClass: 'fm-header--light',
   *   onClose: () => modal.close(),
   * });
   *
   * // Later: headerController.reset() when closing modal
   */
  createController(options: ModalHeaderControllerOptions): ModalHeaderController {
    const {
      modalId,
      theme: initialTheme = 'dark',
      onThemeChange,
      onMaximizeChange,
      onClose,
      maximizeTarget,
      themeTarget,
      lightThemeClass = 'fm-header--light',
      maximizedClass = 'maximized',
    } = options;

    // State
    let currentTheme: 'dark' | 'light' = initialTheme;
    let currentMaximized = false;

    // Get elements
    const getElement = (target: HTMLElement | string | undefined): HTMLElement | null => {
      if (!target) return null;
      if (typeof target === 'string') return document.querySelector(target);
      return target;
    };

    const themeBtn = document.getElementById(`${modalId}-theme-toggle`);
    const maxBtn = document.getElementById(`${modalId}-maximize`);
    const closeBtn = document.getElementById(`${modalId}-close`);

    // Update UI
    const updateThemeUI = () => {
      if (themeBtn) {
        themeBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
      }
      const themeEl = getElement(themeTarget);
      if (themeEl) {
        themeEl.classList.toggle(lightThemeClass, currentTheme === 'light');
      }
    };

    const updateMaximizeUI = () => {
      if (maxBtn) {
        maxBtn.textContent = currentMaximized ? '🗗' : '🗖';
        maxBtn.title = currentMaximized ? 'Restaurar' : 'Maximizar';
      }
      const maxEl = getElement(maximizeTarget);
      if (maxEl) {
        maxEl.classList.toggle(maximizedClass, currentMaximized);
      }
    };

    // Event handlers
    const handleThemeClick = (e: Event) => {
      e.stopPropagation();
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      updateThemeUI();
      onThemeChange?.(currentTheme);
    };

    const handleMaximizeClick = (e: Event) => {
      e.stopPropagation();
      currentMaximized = !currentMaximized;
      updateMaximizeUI();
      onMaximizeChange?.(currentMaximized);
    };

    const handleCloseClick = (e: Event) => {
      e.stopPropagation();
      onClose?.();
    };

    // Attach listeners
    if (themeBtn) themeBtn.addEventListener('click', handleThemeClick);
    if (maxBtn) maxBtn.addEventListener('click', handleMaximizeClick);
    if (closeBtn) closeBtn.addEventListener('click', handleCloseClick);

    // Controller object
    const controller: ModalHeaderController = {
      getTheme: () => currentTheme,
      isMaximized: () => currentMaximized,

      toggleTheme() {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        updateThemeUI();
        onThemeChange?.(currentTheme);
      },

      setTheme(theme: 'dark' | 'light') {
        if (currentTheme !== theme) {
          currentTheme = theme;
          updateThemeUI();
          onThemeChange?.(currentTheme);
        }
      },

      toggleMaximize() {
        currentMaximized = !currentMaximized;
        updateMaximizeUI();
        onMaximizeChange?.(currentMaximized);
      },

      setMaximized(maximized: boolean) {
        if (currentMaximized !== maximized) {
          currentMaximized = maximized;
          updateMaximizeUI();
          onMaximizeChange?.(currentMaximized);
        }
      },

      reset() {
        currentTheme = initialTheme;
        currentMaximized = false;
        updateThemeUI();
        updateMaximizeUI();
      },

      destroy() {
        if (themeBtn) themeBtn.removeEventListener('click', handleThemeClick);
        if (maxBtn) maxBtn.removeEventListener('click', handleMaximizeClick);
        if (closeBtn) closeBtn.removeEventListener('click', handleCloseClick);
      },
    };

    return controller;
  },
};

export default ModalHeader;
