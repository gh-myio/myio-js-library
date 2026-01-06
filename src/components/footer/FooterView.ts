/**
 * RFC-0115: Footer Component Library
 * View layer for the Footer Component
 */

import {
  FooterComponentParams,
  FooterThemeMode,
  FooterThemeConfig,
  FooterConfigTemplate,
  SelectedEntity,
  FooterEventType,
  FooterEventHandler,
  UnitType,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_CONFIG_TEMPLATE,
} from './types';
import { injectStyles } from './styles';
import { ChipRenderer } from './ChipRenderer';

/**
 * Trash icon SVG
 */
const TRASH_ICON_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  <line x1="10" y1="11" x2="10" y2="17"></line>
  <line x1="14" y1="11" x2="14" y2="17"></line>
</svg>
`;

/**
 * FooterView class - Handles rendering and DOM interactions
 */
export class FooterView {
  private container: HTMLElement;
  private footerEl: HTMLElement;
  private dockEl: HTMLElement | null = null;
  private totalsEl: HTMLElement | null = null;
  private compareBtnEl: HTMLButtonElement | null = null;
  private clearBtnEl: HTMLButtonElement | null = null;

  private theme: FooterThemeMode;
  private configTemplate: FooterConfigTemplate;
  private chipRenderer: ChipRenderer;
  private eventHandlers: Map<FooterEventType, FooterEventHandler[]> = new Map();

  private emptyMessage: string;
  private compareButtonLabel: string;

  constructor(private params: FooterComponentParams) {
    this.container = params.container;
    this.theme = params.theme ?? 'dark';
    this.configTemplate = params.configTemplate ?? DEFAULT_CONFIG_TEMPLATE;

    // Get labels from params or configTemplate
    this.emptyMessage = params.emptyMessage ?? this.configTemplate.emptyMessage ?? 'Selecione dispositivos para comparar';
    this.compareButtonLabel = params.compareButtonLabel ?? this.configTemplate.compareButtonLabel ?? 'Comparar';
    this.chipRenderer = new ChipRenderer();

    // Create main element
    this.footerEl = document.createElement('section');
    this.footerEl.className = this.getClassName();

    // Inject base styles
    injectStyles();

    // Apply theme colors
    this.applyThemeColors();
  }

  /**
   * Get the current theme config based on theme mode
   */
  private getThemeConfig(): FooterThemeConfig {
    const themeConfig = this.theme === 'dark'
      ? this.configTemplate.darkMode
      : this.configTemplate.lightMode;

    const defaults = this.theme === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;

    return { ...defaults, ...themeConfig };
  }

  /**
   * Apply theme colors as CSS custom properties
   */
  private applyThemeColors(): void {
    const config = this.getThemeConfig();

    // Apply CSS variables to the footer element
    const style = this.footerEl.style;

    // Main colors
    style.setProperty('--fc-primary', config.primaryColor ?? '');
    style.setProperty('--fc-primary-hover', config.primaryHoverColor ?? '');
    style.setProperty('--fc-primary-dark', config.primaryDarkColor ?? '');

    // Background
    style.setProperty('--fc-bg-gradient-start', config.backgroundGradientStart ?? '');
    style.setProperty('--fc-bg-gradient-end', config.backgroundGradientEnd ?? '');
    style.setProperty('--fc-border-top', config.borderTopColor ?? '');

    // Text
    style.setProperty('--fc-text', config.textColor ?? '');
    style.setProperty('--fc-text-muted', config.mutedTextColor ?? '');

    // Chip
    style.setProperty('--fc-chip-bg', config.chipBackgroundColor ?? '');
    style.setProperty('--fc-chip-border', config.chipBorderColor ?? '');
    style.setProperty('--fc-chip-text', config.chipTextColor ?? '');

    // Buttons
    style.setProperty('--fc-compare-btn', config.compareButtonColor ?? '');
    style.setProperty('--fc-compare-btn-hover', config.compareButtonHoverColor ?? '');
    style.setProperty('--fc-clear-btn', config.clearButtonColor ?? '');
    style.setProperty('--fc-clear-btn-text', config.clearButtonTextColor ?? '');

    // Meta
    style.setProperty('--fc-meta-bg', config.metaBackgroundColor ?? '');
    style.setProperty('--fc-meta-border', config.metaBorderColor ?? '');

    // Empty
    style.setProperty('--fc-empty-bg', config.emptyBackgroundColor ?? '');
    style.setProperty('--fc-empty-border', config.emptyBorderColor ?? '');
  }

  /**
   * Get the class name based on theme
   */
  private getClassName(): string {
    const base = 'myio-footer-component';
    return this.theme === 'light' ? `${base} ${base}--light` : base;
  }

  /**
   * Render the footer component
   */
  render(): HTMLElement {
    this.footerEl.innerHTML = this.buildHTML();
    this.queryElements();
    this.bindEvents();

    // Append to container
    this.container.appendChild(this.footerEl);

    return this.footerEl;
  }

  /**
   * Build the HTML structure
   */
  private buildHTML(): string {
    return `
      <div class="myio-footer-dock" id="footerDock" aria-live="polite">
        <span class="myio-footer-empty">${this.emptyMessage}</span>
      </div>
      <div class="myio-footer-right">
        <div class="myio-footer-meta">
          <div class="myio-footer-meta-title">SELECAO</div>
          <div class="myio-footer-totals" id="footerTotals">0 itens</div>
        </div>
        <button
          id="footerClear"
          class="myio-footer-clear-btn"
          title="Limpar selecao"
          type="button"
          disabled
        >
          ${TRASH_ICON_SVG}
        </button>
        <button
          id="footerCompare"
          class="myio-footer-compare"
          type="button"
          disabled
        >
          ${this.compareButtonLabel}
        </button>
      </div>
    `;
  }

  /**
   * Query DOM elements
   */
  private queryElements(): void {
    this.dockEl = this.footerEl.querySelector('#footerDock');
    this.totalsEl = this.footerEl.querySelector('#footerTotals');
    this.clearBtnEl = this.footerEl.querySelector('#footerClear');
    this.compareBtnEl = this.footerEl.querySelector('#footerCompare');
  }

  /**
   * Bind event listeners
   */
  private bindEvents(): void {
    // Compare button click
    if (this.compareBtnEl) {
      this.compareBtnEl.addEventListener('click', () => {
        this.emit('compare-click');
      });
    }

    // Clear button click
    if (this.clearBtnEl) {
      this.clearBtnEl.addEventListener('click', () => {
        this.emit('clear-click');
      });
    }

    // Delegate chip remove clicks
    if (this.dockEl) {
      this.dockEl.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const removeBtn = target.closest('.myio-footer-chip-remove') as HTMLElement;
        if (removeBtn && removeBtn.dataset.entityId) {
          this.emit('chip-remove', removeBtn.dataset.entityId);
        }
      });

      // Drag and drop support
      this.dockEl.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        this.emit('drag-over');
      });

      this.dockEl.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer?.getData('text/myio-id') || e.dataTransfer?.getData('text/plain');
        const entityJson = e.dataTransfer?.getData('application/json');
        if (id) {
          // Pass entity data if available for registration
          const dropData = { id, entityJson };
          this.emit('drop', dropData as unknown as string);
        }
      });
    }

    // Footer drag and drop
    this.footerEl.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
    });

    this.footerEl.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer?.getData('text/myio-id') || e.dataTransfer?.getData('text/plain');
      const entityJson = e.dataTransfer?.getData('application/json');
      if (id) {
        // Pass entity data if available for registration
        const dropData = { id, entityJson };
        this.emit('drop', dropData as unknown as string);
      }
    });
  }

  /**
   * Register event handler
   */
  on(event: FooterEventType, handler: FooterEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event handler
   */
  off(event: FooterEventType, handler: FooterEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all handlers
   */
  private emit(event: FooterEventType, data?: string | SelectedEntity): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Render the dock with entities or empty state
   */
  renderDock(entities: SelectedEntity[]): void {
    if (!this.dockEl) return;

    if (entities.length === 0) {
      // Show empty state
      const emptyEl = this.chipRenderer.createEmptyState(this.emptyMessage);
      this.dockEl.replaceChildren(emptyEl);
    } else {
      // Render chips
      const chips = entities.map(entity => this.chipRenderer.createChip(entity));
      this.dockEl.replaceChildren(...chips);
    }
  }

  /**
   * Update the totals display
   */
  updateTotals(count: number, totalValue: number, unitType: UnitType | null): void {
    if (!this.totalsEl) return;

    if (count === 0) {
      this.totalsEl.textContent = '0 itens';
    } else {
      const itemText = count === 1 ? 'item' : 'itens';
      const formattedValue = this.chipRenderer.formatNumber(totalValue);

      // For temperature, show average
      const prefix = unitType === 'temperature' ? 'Media: ' : '';
      this.totalsEl.textContent = `${count} ${itemText} (${prefix}${formattedValue})`;
    }
  }

  /**
   * Set compare button enabled state
   */
  setCompareEnabled(enabled: boolean): void {
    if (this.compareBtnEl) {
      this.compareBtnEl.disabled = !enabled;
    }
  }

  /**
   * Set clear button enabled state
   */
  setClearEnabled(enabled: boolean): void {
    if (this.clearBtnEl) {
      this.clearBtnEl.disabled = !enabled;
    }
  }

  /**
   * Set the theme mode
   */
  setTheme(theme: FooterThemeMode): void {
    this.theme = theme;
    this.footerEl.className = this.getClassName();
    this.applyThemeColors();
  }

  /**
   * Get the current theme mode
   */
  getTheme(): FooterThemeMode {
    return this.theme;
  }

  /**
   * Update config template and reapply theme
   */
  setConfigTemplate(configTemplate: FooterConfigTemplate): void {
    this.configTemplate = configTemplate;
    this.applyThemeColors();
  }

  /**
   * Get the root element
   */
  getElement(): HTMLElement {
    return this.footerEl;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Remove event handlers
    this.eventHandlers.clear();

    // Remove from DOM
    if (this.footerEl.parentNode) {
      this.footerEl.parentNode.removeChild(this.footerEl);
    }

    // Clear references
    this.dockEl = null;
    this.totalsEl = null;
    this.compareBtnEl = null;
    this.clearBtnEl = null;
  }
}
