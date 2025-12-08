/**
 * MyIO Modal Header Component
 *
 * A reusable header component for modals with:
 * - Title with optional icon (domain-specific)
 * - Export button with format options (CSV, XLS, PDF)
 * - Theme toggle (light/dark)
 * - Maximize/restore button
 * - Close button
 *
 * @example
 * ```typescript
 * import { createModalHeader } from 'myio-js-library';
 *
 * const header = createModalHeader({
 *   id: 'my-modal',
 *   title: 'My Modal Title',
 *   icon: '📊',
 *   theme: 'light',
 *   isMaximized: false,
 *   exportFormats: ['csv', 'xls', 'pdf'],
 *   onExport: (format) => console.log('Export:', format),
 *   onThemeToggle: (theme) => console.log('Theme:', theme),
 *   onMaximize: (maximized) => console.log('Maximized:', maximized),
 *   onClose: () => console.log('Close clicked'),
 * });
 *
 * container.innerHTML = header.render();
 * header.attachListeners();
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type ModalTheme = 'light' | 'dark';
export type ExportFormat = 'csv' | 'xls' | 'pdf';

export interface ModalHeaderConfig {
  /** Unique ID prefix for the modal elements */
  id: string;
  /** Modal title text */
  title: string;
  /** Optional icon (emoji or text) to display before title */
  icon?: string;
  /** Current theme */
  theme?: ModalTheme;
  /** Whether the modal is currently maximized */
  isMaximized?: boolean;
  /** Header background color (default: #3e1a7d - MyIO purple) */
  backgroundColor?: string;
  /** Header text color (default: white) */
  textColor?: string;
  /** Show theme toggle button (default: true) */
  showThemeToggle?: boolean;
  /** Show maximize button (default: true) */
  showMaximize?: boolean;
  /** Show close button (default: true) */
  showClose?: boolean;
  /** Border radius when not maximized (default: '10px 10px 0 0') */
  borderRadius?: string;
  /** Available export formats (shows dropdown if multiple) */
  exportFormats?: ExportFormat[];
  /** Callback when export is clicked with format */
  onExport?: (format: ExportFormat) => void;
  /** Callback when theme is toggled */
  onThemeToggle?: (theme: ModalTheme) => void;
  /** Callback when maximize/restore is clicked */
  onMaximize?: (isMaximized: boolean) => void;
  /** Callback when close is clicked */
  onClose?: () => void;
}

export interface ModalHeaderInstance {
  /** Renders the header HTML */
  render: () => string;
  /** Attaches event listeners (call after adding to DOM) */
  attachListeners: () => void;
  /** Updates the header state */
  update: (updates: Partial<Pick<ModalHeaderConfig, 'theme' | 'isMaximized' | 'title'>>) => void;
  /** Gets the current state */
  getState: () => { theme: ModalTheme; isMaximized: boolean };
  /** Removes event listeners */
  destroy: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BG_COLOR = '#3e1a7d'; // MyIO purple
const DEFAULT_TEXT_COLOR = 'white';
const DEFAULT_BORDER_RADIUS = '10px 10px 0 0';

const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  xls: 'Excel (XLS)',
  pdf: 'PDF',
};

const EXPORT_FORMAT_ICONS: Record<ExportFormat, string> = {
  csv: '📄',
  xls: '📊',
  pdf: '📑',
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Creates a modal header instance
 */
export function createModalHeader(config: ModalHeaderConfig): ModalHeaderInstance {
  // Internal state
  let currentTheme: ModalTheme = config.theme || 'light';
  let currentIsMaximized = config.isMaximized || false;
  let currentTitle = config.title;

  // Element references for event listener cleanup
  let themeBtn: HTMLElement | null = null;
  let maximizeBtn: HTMLElement | null = null;
  let closeBtn: HTMLElement | null = null;
  let exportBtn: HTMLElement | null = null;
  let exportDropdown: HTMLElement | null = null;

  // Cleanup handlers stored for removal
  const cleanupHandlers: Array<() => void> = [];

  // Event handler references
  const handleThemeClick = () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    config.onThemeToggle?.(currentTheme);
    updateButtonIcons();
  };

  const handleMaximizeClick = () => {
    currentIsMaximized = !currentIsMaximized;
    config.onMaximize?.(currentIsMaximized);
    updateButtonIcons();
  };

  const handleCloseClick = () => {
    config.onClose?.();
  };

  const handleExportClick = (format: ExportFormat) => {
    config.onExport?.(format);
    // Close dropdown after selection
    if (exportDropdown) {
      exportDropdown.style.display = 'none';
    }
  };

  // Update button icons based on current state
  function updateButtonIcons(): void {
    if (themeBtn) {
      themeBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
      themeBtn.title = currentTheme === 'dark' ? 'Modo claro' : 'Modo escuro';
    }
    if (maximizeBtn) {
      maximizeBtn.textContent = currentIsMaximized ? '🗗' : '🗖';
      maximizeBtn.title = currentIsMaximized ? 'Restaurar' : 'Maximizar';
    }
  }

  // Generate button style
  function getButtonStyle(): string {
    return `
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.8);
      transition: background-color 0.2s, color 0.2s;
    `.replace(/\s+/g, ' ').trim();
  }

  // Generate export dropdown HTML
  function renderExportDropdown(): string {
    const formats = config.exportFormats || [];
    if (formats.length === 0) return '';

    // Single format - just show button
    if (formats.length === 1) {
      return `
        <button id="${config.id}-export" title="Exportar ${EXPORT_FORMAT_LABELS[formats[0]]}" style="${getButtonStyle()}">
          📥
        </button>
      `;
    }

    // Multiple formats - show dropdown
    return `
      <div style="position: relative; display: inline-block;">
        <button id="${config.id}-export-btn" title="Exportar" style="${getButtonStyle()}">
          📥
        </button>
        <div id="${config.id}-export-dropdown" style="
          display: none;
          position: absolute;
          top: 100%;
          right: 0;
          background: white;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          min-width: 140px;
          z-index: 10001;
          margin-top: 4px;
          overflow: hidden;
        ">
          ${formats.map(format => `
            <button
              id="${config.id}-export-${format}"
              class="myio-export-option"
              data-format="${format}"
              style="
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                padding: 10px 14px;
                border: none;
                background: white;
                cursor: pointer;
                font-size: 13px;
                color: #333;
                text-align: left;
                transition: background-color 0.2s;
              "
            >
              ${EXPORT_FORMAT_ICONS[format]} ${EXPORT_FORMAT_LABELS[format]}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Instance methods
  const instance: ModalHeaderInstance = {
    render(): string {
      const bgColor = config.backgroundColor || DEFAULT_BG_COLOR;
      const textColor = config.textColor || DEFAULT_TEXT_COLOR;
      const borderRadius = currentIsMaximized ? '0' : (config.borderRadius || DEFAULT_BORDER_RADIUS);
      const showTheme = config.showThemeToggle !== false;
      const showMax = config.showMaximize !== false;
      const showClose = config.showClose !== false;
      const showExport = config.exportFormats && config.exportFormats.length > 0;

      const iconHtml = config.icon ? `<span style="margin-right: 8px;">${config.icon}</span>` : '';
      const buttonStyle = getButtonStyle();

      return `
        <div class="myio-modal-header" style="
          padding: 4px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: ${bgColor};
          color: ${textColor};
          border-radius: ${borderRadius};
          min-height: 20px;
          font-family: 'Roboto', Arial, sans-serif;
        ">
          <h2 id="${config.id}-header-title" style="
            margin: 6px;
            font-size: 18px;
            font-weight: 600;
            color: ${textColor};
            line-height: 2;
            display: flex;
            align-items: center;
          ">
            ${iconHtml}${currentTitle}
          </h2>
          <div style="display: flex; gap: 4px; align-items: center;">
            ${showExport ? renderExportDropdown() : ''}
            ${showTheme ? `
              <button id="${config.id}-theme-toggle" title="${currentTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}" style="${buttonStyle}">
                ${currentTheme === 'dark' ? '☀️' : '🌙'}
              </button>
            ` : ''}
            ${showMax ? `
              <button id="${config.id}-maximize" title="${currentIsMaximized ? 'Restaurar' : 'Maximizar'}" style="${buttonStyle}">
                ${currentIsMaximized ? '🗗' : '🗖'}
              </button>
            ` : ''}
            ${showClose ? `
              <button id="${config.id}-close" title="Fechar" style="${buttonStyle}; font-size: 20px;">
                ×
              </button>
            ` : ''}
          </div>
        </div>
      `;
    },

    attachListeners(): void {
      // Get button elements
      themeBtn = document.getElementById(`${config.id}-theme-toggle`);
      maximizeBtn = document.getElementById(`${config.id}-maximize`);
      closeBtn = document.getElementById(`${config.id}-close`);

      // Single export button (when only one format)
      const singleExportBtn = document.getElementById(`${config.id}-export`);
      if (singleExportBtn && config.exportFormats?.length === 1) {
        exportBtn = singleExportBtn;
        const format = config.exportFormats[0];
        const clickHandler = () => handleExportClick(format);
        exportBtn.addEventListener('click', clickHandler);
        cleanupHandlers.push(() => exportBtn?.removeEventListener('click', clickHandler));

        // Hover effect
        const enterHandler = () => { exportBtn!.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; };
        const leaveHandler = () => { exportBtn!.style.backgroundColor = 'transparent'; };
        exportBtn.addEventListener('mouseenter', enterHandler);
        exportBtn.addEventListener('mouseleave', leaveHandler);
        cleanupHandlers.push(() => {
          exportBtn?.removeEventListener('mouseenter', enterHandler);
          exportBtn?.removeEventListener('mouseleave', leaveHandler);
        });
      }

      // Export dropdown (when multiple formats)
      const exportDropdownBtn = document.getElementById(`${config.id}-export-btn`);
      exportDropdown = document.getElementById(`${config.id}-export-dropdown`);

      if (exportDropdownBtn && exportDropdown) {
        exportBtn = exportDropdownBtn;

        // Toggle dropdown
        const toggleHandler = (e: Event) => {
          e.stopPropagation();
          if (exportDropdown) {
            exportDropdown.style.display = exportDropdown.style.display === 'none' ? 'block' : 'none';
          }
        };
        exportDropdownBtn.addEventListener('click', toggleHandler);
        cleanupHandlers.push(() => exportDropdownBtn.removeEventListener('click', toggleHandler));

        // Close dropdown when clicking outside
        const outsideClickHandler = (e: Event) => {
          if (exportDropdown && !exportDropdown.contains(e.target as Node) && e.target !== exportDropdownBtn) {
            exportDropdown.style.display = 'none';
          }
        };
        document.addEventListener('click', outsideClickHandler);
        cleanupHandlers.push(() => document.removeEventListener('click', outsideClickHandler));

        // Export format buttons
        config.exportFormats?.forEach(format => {
          const btn = document.getElementById(`${config.id}-export-${format}`);
          if (btn) {
            const clickHandler = () => handleExportClick(format);
            btn.addEventListener('click', clickHandler);
            cleanupHandlers.push(() => btn.removeEventListener('click', clickHandler));

            // Hover effect
            const enterHandler = () => { btn.style.backgroundColor = '#f0f0f0'; };
            const leaveHandler = () => { btn.style.backgroundColor = 'white'; };
            btn.addEventListener('mouseenter', enterHandler);
            btn.addEventListener('mouseleave', leaveHandler);
            cleanupHandlers.push(() => {
              btn.removeEventListener('mouseenter', enterHandler);
              btn.removeEventListener('mouseleave', leaveHandler);
            });
          }
        });

        // Hover effect for dropdown button
        const enterHandler = () => { exportDropdownBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; };
        const leaveHandler = () => { exportDropdownBtn.style.backgroundColor = 'transparent'; };
        exportDropdownBtn.addEventListener('mouseenter', enterHandler);
        exportDropdownBtn.addEventListener('mouseleave', leaveHandler);
        cleanupHandlers.push(() => {
          exportDropdownBtn.removeEventListener('mouseenter', enterHandler);
          exportDropdownBtn.removeEventListener('mouseleave', leaveHandler);
        });
      }

      // Attach theme toggle listeners
      if (themeBtn && config.showThemeToggle !== false) {
        themeBtn.addEventListener('click', handleThemeClick);
        cleanupHandlers.push(() => themeBtn?.removeEventListener('click', handleThemeClick));

        // Hover effect
        const enterHandler = () => { themeBtn!.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; };
        const leaveHandler = () => { themeBtn!.style.backgroundColor = 'transparent'; };
        themeBtn.addEventListener('mouseenter', enterHandler);
        themeBtn.addEventListener('mouseleave', leaveHandler);
        cleanupHandlers.push(() => {
          themeBtn?.removeEventListener('mouseenter', enterHandler);
          themeBtn?.removeEventListener('mouseleave', leaveHandler);
        });
      }

      // Attach maximize listeners
      if (maximizeBtn && config.showMaximize !== false) {
        maximizeBtn.addEventListener('click', handleMaximizeClick);
        cleanupHandlers.push(() => maximizeBtn?.removeEventListener('click', handleMaximizeClick));

        const enterHandler = () => { maximizeBtn!.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; };
        const leaveHandler = () => { maximizeBtn!.style.backgroundColor = 'transparent'; };
        maximizeBtn.addEventListener('mouseenter', enterHandler);
        maximizeBtn.addEventListener('mouseleave', leaveHandler);
        cleanupHandlers.push(() => {
          maximizeBtn?.removeEventListener('mouseenter', enterHandler);
          maximizeBtn?.removeEventListener('mouseleave', leaveHandler);
        });
      }

      // Attach close listeners
      if (closeBtn && config.showClose !== false) {
        closeBtn.addEventListener('click', handleCloseClick);
        cleanupHandlers.push(() => closeBtn?.removeEventListener('click', handleCloseClick));

        const enterHandler = () => { closeBtn!.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; };
        const leaveHandler = () => { closeBtn!.style.backgroundColor = 'transparent'; };
        closeBtn.addEventListener('mouseenter', enterHandler);
        closeBtn.addEventListener('mouseleave', leaveHandler);
        cleanupHandlers.push(() => {
          closeBtn?.removeEventListener('mouseenter', enterHandler);
          closeBtn?.removeEventListener('mouseleave', leaveHandler);
        });
      }
    },

    update(updates): void {
      if (updates.theme !== undefined) {
        currentTheme = updates.theme;
        updateButtonIcons();
      }
      if (updates.isMaximized !== undefined) {
        currentIsMaximized = updates.isMaximized;
        updateButtonIcons();
      }
      if (updates.title !== undefined) {
        currentTitle = updates.title;
        const titleEl = document.getElementById(`${config.id}-header-title`);
        if (titleEl) {
          const iconHtml = config.icon ? `<span style="margin-right: 8px;">${config.icon}</span>` : '';
          titleEl.innerHTML = `${iconHtml}${currentTitle}`;
        }
      }
    },

    getState() {
      return {
        theme: currentTheme,
        isMaximized: currentIsMaximized,
      };
    },

    destroy(): void {
      // Run all cleanup handlers
      cleanupHandlers.forEach(handler => handler());
      cleanupHandlers.length = 0;

      themeBtn = null;
      maximizeBtn = null;
      closeBtn = null;
      exportBtn = null;
      exportDropdown = null;
    },
  };

  return instance;
}

// ============================================================================
// CSS Helper
// ============================================================================

/**
 * Returns CSS styles for the modal header component
 * Can be injected into page or used in CSS-in-JS
 */
export function getModalHeaderStyles(): string {
  return `
    .myio-modal-header button:hover {
      background-color: rgba(255, 255, 255, 0.2) !important;
    }
    .myio-modal-header button:active {
      background-color: rgba(255, 255, 255, 0.3) !important;
    }
    .myio-export-option:hover {
      background-color: #f0f0f0 !important;
    }
  `;
}

// ============================================================================
// Exports
// ============================================================================

export default createModalHeader;
