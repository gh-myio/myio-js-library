/**
 * RFC-0139: HeaderShopping View
 * UI rendering and DOM management for the Shopping Dashboard header toolbar
 */

import {
  DomainType,
  ContractState,
  HeaderShoppingConfigTemplate,
  DEFAULT_HEADER_SHOPPING_CONFIG,
  ThemeMode,
} from './types';
import { injectHeaderShoppingStyles } from './styles';

type ViewEventType =
  | 'load-click'
  | 'force-refresh-click'
  | 'report-click'
  | 'date-change'
  | 'contract-click'
  | 'theme-change';

type ViewEventHandler = (...args: unknown[]) => void;

export class HeaderShoppingView {
  private root: HTMLElement;
  private config: Required<HeaderShoppingConfigTemplate>;
  private eventHandlers = new Map<ViewEventType, Set<ViewEventHandler>>();
  private themeMode: ThemeMode = 'light';

  // DOM elements
  private contractStatusEl: HTMLElement | null = null;
  private contractIconEl: HTMLElement | null = null;
  private contractCountEl: HTMLElement | null = null;
  private dateRangeInput: HTMLInputElement | null = null;
  private btnLoad: HTMLButtonElement | null = null;
  private btnForceRefresh: HTMLButtonElement | null = null;
  private btnReport: HTMLButtonElement | null = null;
  private btnReportText: HTMLSpanElement | null = null;
  private themeSelectorEl: HTMLElement | null = null;
  private btnThemeLight: HTMLButtonElement | null = null;
  private btnThemeDark: HTMLButtonElement | null = null;

  constructor(configTemplate?: HeaderShoppingConfigTemplate, themeMode?: ThemeMode) {
    this.config = { ...DEFAULT_HEADER_SHOPPING_CONFIG, ...configTemplate };
    this.themeMode = themeMode || 'light';

    // Inject styles
    injectHeaderShoppingStyles();

    // Create root element
    this.root = document.createElement('section');
    this.root.className = 'tbx-toolbar';
    this.root.setAttribute('aria-label', 'Filtros e acoes');
    this.root.setAttribute('data-theme', this.themeMode);
  }

  /**
   * Set theme mode (light/dark)
   */
  setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
    this.root.setAttribute('data-theme', mode);
    this.updateThemeSelector();
  }

  /**
   * Select a specific theme
   */
  selectTheme(mode: ThemeMode): void {
    if (mode === this.themeMode) return;

    this.setThemeMode(mode);
    this.emit('theme-change', mode);

    // Dispatch global event for other components
    window.dispatchEvent(
      new CustomEvent('myio:theme-change', {
        detail: { mode },
      })
    );
  }

  /**
   * Update theme selector active state
   */
  private updateThemeSelector(): void {
    if (this.btnThemeLight && this.btnThemeDark) {
      this.btnThemeLight.classList.toggle('active', this.themeMode === 'light');
      this.btnThemeDark.classList.toggle('active', this.themeMode === 'dark');
    }
  }

  /**
   * Get current theme mode
   */
  getThemeMode(): ThemeMode {
    return this.themeMode;
  }

  /**
   * Render the header toolbar HTML
   */
  render(): HTMLElement {
    const showContract = this.config.showContractStatus;
    const showReport = this.config.showReportButton;
    const showForceRefresh = this.config.showForceRefreshButton;

    this.root.innerHTML = `
      <div class="tbx-row">
        <div class="tbx-col tbx-col-left">
          ${
            showContract
              ? `
          <div id="tbx-contract-status" class="tbx-contract-status">
            <span class="tbx-contract-icon"></span>
            <span class="tbx-contract-count">--</span>
          </div>
          `
              : ''
          }

          <!-- Hidden date inputs for compatibility -->
          <label class="tbx-field" style="display: none">
            <input id="tbx-date-start" type="date" />
          </label>
          <span class="tbx-ate" style="display: none">ate</span>
          <label class="tbx-field" style="display: none">
            <input id="tbx-date-end" type="date" />
          </label>

          <!-- Date range picker input -->
          <label aria-label="Periodo" class="tbx-field">
            <span class="tbx-ico tbx-ico-cal"></span>
            <input
              type="text"
              name="startDatetimes"
              placeholder="Digite a data ou periodo"
              readonly
              title="Clique aqui para alterar o intervalo de datas"
            />
          </label>

          <!-- Load button -->
          <button
            class="tbx-btn tbx-btn-primary"
            id="tbx-btn-load"
            title="Carregar"
          >
            <span class="tbx-ico rotate"></span>
            <span>Carregar</span>
          </button>

          ${
            showForceRefresh
              ? `
          <!-- Force refresh button -->
          <button
            class="tbx-btn tbx-btn-secondary"
            id="tbx-btn-force-refresh"
            title="Limpar cache e recarregar (use se os dados ficarem travados)"
          >
            <span class="tbx-ico"></span>
            <span>Limpar</span>
          </button>
          `
              : ''
          }

          ${
            showReport
              ? `
          <!-- Report button -->
          <button
            class="tbx-btn tbx-btn-primary"
            id="tbx-btn-report-general"
            title="Relatorio Consumo Geral"
            disabled
          >
            <span class="tbx-ico"></span>
            <span id="tbx-btn-report-general-text">Relatorio Consumo Geral</span>
          </button>
          `
              : ''
          }

          <!-- Theme selector tabs -->
          <div class="tbx-theme-selector" id="tbx-theme-selector">
            <button
              class="tbx-theme-tab ${this.themeMode === 'light' ? 'active' : ''}"
              id="tbx-theme-light"
              title="Tema claro"
              data-theme="light"
            >
              <span class="tbx-theme-icon">☀️</span>
            </button>
            <button
              class="tbx-theme-tab ${this.themeMode === 'dark' ? 'active' : ''}"
              id="tbx-theme-dark"
              title="Tema escuro"
              data-theme="dark"
            >
              <span class="tbx-theme-icon">🌙</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.cacheElements();
    this.bindEvents();

    return this.root;
  }

  /**
   * Cache DOM element references
   */
  private cacheElements(): void {
    this.contractStatusEl = this.root.querySelector('#tbx-contract-status');
    this.contractIconEl = this.root.querySelector('.tbx-contract-icon');
    this.contractCountEl = this.root.querySelector('.tbx-contract-count');
    this.dateRangeInput = this.root.querySelector('input[name="startDatetimes"]');
    this.btnLoad = this.root.querySelector('#tbx-btn-load');
    this.btnForceRefresh = this.root.querySelector('#tbx-btn-force-refresh');
    this.btnReport = this.root.querySelector('#tbx-btn-report-general');
    this.btnReportText = this.root.querySelector('#tbx-btn-report-general-text');
    this.themeSelectorEl = this.root.querySelector('#tbx-theme-selector');
    this.btnThemeLight = this.root.querySelector('#tbx-theme-light');
    this.btnThemeDark = this.root.querySelector('#tbx-theme-dark');
  }

  /**
   * Bind DOM event handlers
   */
  private bindEvents(): void {
    // Load button
    this.btnLoad?.addEventListener('click', () => {
      this.emit('load-click');
    });

    // Force refresh button
    this.btnForceRefresh?.addEventListener('click', () => {
      this.emit('force-refresh-click');
    });

    // Report button
    this.btnReport?.addEventListener('click', () => {
      this.emit('report-click');
    });

    // Contract status click
    this.contractStatusEl?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.emit('contract-click');
    });

    // Theme selector tabs
    this.btnThemeLight?.addEventListener('click', () => {
      this.selectTheme('light');
    });

    this.btnThemeDark?.addEventListener('click', () => {
      this.selectTheme('dark');
    });

    // Setup tooltip for date range input
    this.setupTooltip(this.dateRangeInput, 'Clique para alterar o intervalo de datas');
  }

  /**
   * Setup premium tooltip for an element
   */
  private setupTooltip(target: HTMLElement | null, text: string): void {
    if (!target) return;

    let tip = document.getElementById('tbx-global-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'tbx-global-tooltip';
      document.body.appendChild(tip);
    }

    const pad = 10;

    const position = (ev: MouseEvent) => {
      if (!tip) return;
      tip.textContent = text;

      let x = ev.clientX + 12;
      let y = ev.clientY - 36;
      const vw = window.innerWidth;
      const rect = tip.getBoundingClientRect();

      if (x + rect.width + pad > vw) x = vw - rect.width - pad;
      if (y < pad) y = ev.clientY + 18;

      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    };

    const show = (ev?: MouseEvent) => {
      if (ev) position(ev);
      tip?.classList.add('show');
    };

    const hide = () => {
      tip?.classList.remove('show');
    };

    target.addEventListener('mouseenter', show as EventListener);
    target.addEventListener('mousemove', position as EventListener);
    target.addEventListener('mouseleave', hide);
    target.addEventListener('focus', (e) => {
      const r = (e.target as HTMLElement).getBoundingClientRect();
      show({ clientX: r.left + 20, clientY: r.top - 8 } as MouseEvent);
    });
    target.addEventListener('blur', hide);
  }

  /**
   * Get the date range input element (for DateRangePicker integration)
   */
  getDateRangeInput(): HTMLInputElement | null {
    return this.dateRangeInput;
  }

  /**
   * Update the date range display
   */
  setDateRangeDisplay(display: string): void {
    if (this.dateRangeInput) {
      this.dateRangeInput.value = display;
    }
  }

  /**
   * Update contract status display
   */
  updateContractStatus(state: ContractState): void {
    if (!this.contractStatusEl || !this.contractIconEl || !this.contractCountEl) {
      return;
    }

    if (!state || !state.isLoaded) {
      this.contractStatusEl.style.display = 'none';
      return;
    }

    const totalDevices =
      (state.energy?.total || 0) + (state.water?.total || 0) + (state.temperature?.total || 0);

    // Update icon
    if (state.isValid) {
      this.contractIconEl.textContent = '\u2713'; // checkmark
      this.contractIconEl.className = 'tbx-contract-icon tbx-contract-icon--valid';
    } else {
      this.contractIconEl.textContent = '!';
      this.contractIconEl.className = 'tbx-contract-icon tbx-contract-icon--invalid';
    }

    // Update count
    this.contractCountEl.textContent = `${totalDevices} disp.`;
    this.contractCountEl.style.color = state.isValid ? '#81c784' : '#ef5350';

    // Show container
    this.contractStatusEl.style.display = 'flex';
  }

  /**
   * Update controls state based on current domain
   */
  updateControlsForDomain(domain: DomainType): void {
    const domainLabels: Record<string, string> = {
      energy: 'Relatorio Consumo Geral de Energia por Loja',
      water: 'Relatorio Consumo Geral de Agua por Loja',
    };

    const isSupported = domain === 'energy' || domain === 'water';

    // Update report button
    if (this.btnReport && this.btnReportText) {
      if (domain && domainLabels[domain]) {
        this.btnReportText.textContent = domainLabels[domain];
        this.btnReport.title = domainLabels[domain];
      } else {
        this.btnReportText.textContent = 'Relatorio Consumo Geral';
        this.btnReport.title = 'Relatorio Consumo Geral';
      }
      this.btnReport.disabled = !isSupported;
    }

    // Update date range input
    if (this.dateRangeInput) {
      this.dateRangeInput.disabled = !isSupported;
    }

    // Update load button
    if (this.btnLoad) {
      this.btnLoad.disabled = !isSupported;
    }

    // Update force refresh button
    if (this.btnForceRefresh) {
      this.btnForceRefresh.disabled = !isSupported;
    }
  }

  /**
   * Enable or disable all controls
   */
  setControlsEnabled(enabled: boolean): void {
    if (this.dateRangeInput) this.dateRangeInput.disabled = !enabled;
    if (this.btnLoad) this.btnLoad.disabled = !enabled;
    if (this.btnForceRefresh) this.btnForceRefresh.disabled = !enabled;
    if (this.btnReport) this.btnReport.disabled = !enabled;
  }

  /**
   * Programmatically click load button
   */
  clickLoad(): void {
    this.btnLoad?.click();
  }

  /**
   * Programmatically click force refresh button
   */
  clickForceRefresh(): void {
    this.btnForceRefresh?.click();
  }

  /**
   * Event emission
   */
  private emit(event: ViewEventType, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((h) => h(...args));
    }
  }

  /**
   * Register event handler
   */
  on(event: ViewEventType, handler: ViewEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event handler
   */
  off(event: ViewEventType, handler: ViewEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Destroy the view
   */
  destroy(): void {
    this.eventHandlers.clear();
    this.root.remove();
  }

  /**
   * Get root element
   */
  getElement(): HTMLElement {
    return this.root;
  }
}
