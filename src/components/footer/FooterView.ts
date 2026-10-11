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
    this.theme = params.theme ?? 'light';
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

    return { ...defaults, ...themeConfig, ...this.getBrandOverrides() };
  }

  /** Accent do tema do dashboard (createMyIOTheme → window.MyIOUtils.theme), se houver. */
  private getDashboardAccent(): { accent: string; accentText: string } | null {
    const theme = (window as unknown as { MyIOUtils?: { theme?: { accent?: string; accentText?: string } } })
      .MyIOUtils?.theme;
    if (!theme?.accent) return null;
    return { accent: theme.accent, accentText: theme.accentText || '#ffffff' };
  }

  /**
   * Com paleta do dashboard o footer segue o padrão do dashboard de shopping: fundo sólido na cor
   * do tema e conteúdo branco (mesma identidade do header/tabs).
   */
  private getBrandOverrides(): Partial<FooterThemeConfig> {
    const brand = this.getDashboardAccent();
    if (!brand) return {};
    const a = brand.accent;
    return {
      primaryColor: a,
      primaryHoverColor: `color-mix(in srgb, ${a} 85%, #fff)`,
      primaryDarkColor: `color-mix(in srgb, ${a} 70%, #000)`,
      backgroundGradientStart: a,
      backgroundGradientEnd: a,
      borderTopColor: 'rgba(255, 255, 255, 0.18)',
      textColor: brand.accentText,
      mutedTextColor: 'rgba(255, 255, 255, 0.75)',
      chipBackgroundColor: 'rgba(255, 255, 255, 0.12)',
      chipBorderColor: 'rgba(255, 255, 255, 0.24)',
      chipTextColor: brand.accentText,
      compareButtonColor: `color-mix(in srgb, ${a} 55%, #0f172a)`,
      compareButtonHoverColor: `color-mix(in srgb, ${a} 70%, #0f172a)`,
      clearButtonColor: 'rgba(255, 255, 255, 0.12)',
      clearButtonTextColor: brand.accentText,
      metaBackgroundColor: 'rgba(255, 255, 255, 0.10)',
      metaBorderColor: 'rgba(255, 255, 255, 0.24)',
      emptyBackgroundColor: 'rgba(255, 255, 255, 0.06)',
      emptyBorderColor: 'rgba(255, 255, 255, 0.35)',
    };
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
    const brand = this.getDashboardAccent() ? ` ${base}--brand` : '';
    return (this.theme === 'light' ? `${base} ${base}--light` : base) + brand;
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
    // Zoom no hover: versão ampliada flutuante (o dock tem rolagem e cortaria um scale no chip)
    this.footerEl.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.myio-footer-chip-remove')) return hideFooterZoom();
      const chip = target.closest<HTMLElement>('.myio-footer-chip');
      if (chip) {
        const name =
          chip.dataset.fullName || chip.querySelector('.myio-footer-chip-name')?.textContent || '';
        const value = chip.querySelector('.myio-footer-chip-value')?.textContent || '';
        showFooterZoom(chip, name, value);
        return;
      }
      const meta = target.closest<HTMLElement>('.myio-footer-meta');
      if (meta) {
        showFooterZoom(meta, 'Seleção', this.totalsEl?.textContent || '');
      }
    });
    this.footerEl.addEventListener('mouseout', (e) => {
      const to = (e as MouseEvent).relatedTarget as HTMLElement | null;
      const from = (e.target as HTMLElement).closest('.myio-footer-chip, .myio-footer-meta');
      if (from && to && from.contains(to)) return;
      hideFooterZoom();
    });

    // Listen for global theme changes
    window.addEventListener('myio:theme-change', ((e: CustomEvent<{ mode: 'light' | 'dark' }>) => {
      this.setTheme(e.detail.mode);
    }) as EventListener);

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
    // chips são recriados: o chip sob o mouse some sem disparar mouseout → fecha o zoom aqui
    hideFooterZoom();

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
    hideFooterZoom();

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

// =====================================================================
// Zoom do chip / card de seleção no hover (mesmo efeito do footer do dashboard de shopping)
// =====================================================================

const FOOTER_ZOOM_ID = 'myio-footer-chip-zoom';

function ensureFooterZoomEl(): HTMLElement {
  if (!document.getElementById('myio-footer-chip-zoom-styles')) {
    const st = document.createElement('style');
    st.id = 'myio-footer-chip-zoom-styles';
    st.textContent = `
      #${FOOTER_ZOOM_ID} {
        position: fixed; z-index: 2147483000; pointer-events: none;
        display: flex; flex-direction: column; gap: 2px;
        min-width: 140px; max-width: 360px; padding: 10px 14px;
        background: var(--myio-brand-700, #3e1a7d); color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.28); border-radius: 10px;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.35);
        font-family: 'Nunito', system-ui, sans-serif;
        transform: translate(-50%, 6px) scale(0.92); transform-origin: 50% 100%;
        opacity: 0; transition: opacity 0.12s ease, transform 0.12s ease;
      }
      #${FOOTER_ZOOM_ID}.show { opacity: 1; transform: translate(-50%, 0) scale(1); }
      #${FOOTER_ZOOM_ID} .zoom-name {
        font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.01em;
        white-space: normal; word-break: break-word; line-height: 1.2;
      }
      #${FOOTER_ZOOM_ID} .zoom-value {
        font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.15;
      }
    `;
    document.head.appendChild(st);
  }
  let el = document.getElementById(FOOTER_ZOOM_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = FOOTER_ZOOM_ID;
    el.setAttribute('role', 'tooltip');
    el.innerHTML = '<span class="zoom-name"></span><span class="zoom-value"></span>';
    document.body.appendChild(el);
  }
  return el;
}

function showFooterZoom(anchor: HTMLElement, name: string, value: string): void {
  const el = ensureFooterZoomEl();
  (el.querySelector('.zoom-name') as HTMLElement).textContent = name || '';
  (el.querySelector('.zoom-value') as HTMLElement).textContent = value || '';
  const r = anchor.getBoundingClientRect();
  const half = 75; // metade do min-width — mantém dentro da tela nas pontas
  const left = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8);
  el.style.left = `${left}px`;
  el.style.bottom = `${window.innerHeight - r.top + 8}px`;
  el.classList.add('show');
}

function hideFooterZoom(): void {
  document.getElementById(FOOTER_ZOOM_ID)?.classList.remove('show');
}
