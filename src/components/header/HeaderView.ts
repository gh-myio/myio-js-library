/**
 * RFC-0113: Header Component Library
 * View layer implementation for the Header Component
 */

import {
  HeaderComponentParams,
  HeaderConfigTemplate,
  CardKPIs,
  EquipmentKPI,
  EnergyKPI,
  TemperatureKPI,
  WaterKPI,
  CardType,
  HeaderEventType,
  HeaderEventHandler,
  HeaderThemeMode,
  HEADER_DEFAULT_CONFIG_TEMPLATE,
  HEADER_CSS_PREFIX,
} from './types';

/**
 * HeaderView class - renders the header component HTML/CSS
 */
export class HeaderView {
  private container: HTMLElement;
  private element: HTMLElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private config: HeaderConfigTemplate;
  private eventHandlers: Map<HeaderEventType, Set<HeaderEventHandler>> = new Map();
  private themeMode: HeaderThemeMode = 'light';

  // DOM element references
  private equipKpiEl: HTMLElement | null = null;
  private equipSubEl: HTMLElement | null = null;
  private energyKpiEl: HTMLElement | null = null;
  private energyTrendEl: HTMLElement | null = null;
  private tempKpiEl: HTMLElement | null = null;
  private tempTrendEl: HTMLElement | null = null;
  private tempChipEl: HTMLElement | null = null;
  private waterKpiEl: HTMLElement | null = null;
  private waterTrendEl: HTMLElement | null = null;

  constructor(private params: HeaderComponentParams) {
    this.container = params.container;
    this.themeMode = params.configTemplate?.themeMode ?? 'light';
    this.config = this.mergeConfig(params.configTemplate);
  }

  /**
   * Merge provided config with defaults
   */
  private mergeConfig(configTemplate?: HeaderConfigTemplate): HeaderConfigTemplate {
    return {
      ...HEADER_DEFAULT_CONFIG_TEMPLATE,
      ...configTemplate,
    };
  }

  /**
   * Get a config value with fallback chain
   */
  private getConfigValue<K extends keyof HeaderConfigTemplate>(
    key: K
  ): HeaderConfigTemplate[K] {
    // 1. Direct params override
    // 2. ConfigTemplate
    // 3. Default
    return this.config[key] ?? HEADER_DEFAULT_CONFIG_TEMPLATE[key];
  }

  /**
   * Register an event handler
   */
  public on(event: HeaderEventType, handler: HeaderEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unregister an event handler
   */
  public off(event: HeaderEventType, handler: HeaderEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emit an event
   */
  private emit(event: HeaderEventType, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }

  /**
   * Render the component
   */
  public render(): HTMLElement {
    // Inject styles once
    this.injectStyles();

    // Build HTML
    this.element = document.createElement('div');
    this.element.className = `${HEADER_CSS_PREFIX}-root ${HEADER_CSS_PREFIX}-theme-${this.themeMode}`;
    this.element.innerHTML = this.buildHTML();

    // Cache DOM references
    this.cacheElements();

    // Bind events
    this.bindEvents();

    // Apply initial card colors
    this.applyCardColors();

    return this.element;
  }

  /**
   * Inject CSS styles into the document
   */
  private injectStyles(): void {
    // Check if styles already injected
    if (document.getElementById(`${HEADER_CSS_PREFIX}-styles`)) {
      return;
    }

    this.styleElement = document.createElement('style');
    this.styleElement.id = `${HEADER_CSS_PREFIX}-styles`;
    this.styleElement.textContent = this.getStyles();
    document.head.appendChild(this.styleElement);
  }

  /**
   * Get CSS styles for the component
   */
  private getStyles(): string {
    return `
/* RFC-0113: Header Component Styles */

/* ============================================================================
   Light Theme (default)
   Note: Cards have dark backgrounds (#1F3A35) so text colors are light/white
   ============================================================================ */
.${HEADER_CSS_PREFIX}-root {
  /* Card backgrounds - transparent, cards use their own bg color */
  --hdr-card-bg: transparent;
  --hdr-card-bd: rgba(255, 255, 255, 0.15);
  /* Text colors - light for dark card backgrounds */
  --hdr-ink-1: #ffffff;
  --hdr-ink-2: rgba(255, 255, 255, 0.75);
  --hdr-title-color: rgba(255, 255, 255, 0.9);
  --hdr-kpi-color: #ffffff;
  /* Icon colors - visible on dark bg */
  --hdr-icon-stroke: rgba(255, 255, 255, 0.7);
  --hdr-icon-border: rgba(255, 255, 255, 0.2);
  /* Status colors - bright for dark bg */
  --hdr-ok: #4ade80;
  --hdr-warn: #fbbf24;
  --hdr-down: #34d399;
  --hdr-up: #fb923c;
  --hdr-bar-ok: #9fc131;
  /* Shadows and radius */
  --hdr-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  --hdr-shadow-hover: 0 6px 20px rgba(0, 0, 0, 0.3);
  --hdr-radius: 14px;
  /* Logo card */
  --hdr-logo-bg: #1f3a35;
  --hdr-back-btn-bg: rgba(255, 255, 255, 0.15);
  --hdr-back-btn-bg-hover: rgba(255, 255, 255, 0.25);
  --hdr-back-btn-color: rgba(255, 255, 255, 0.75);
  --hdr-back-btn-color-hover: rgba(255, 255, 255, 1);

  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 8px 12px 4px 12px;
  box-sizing: border-box;
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: var(--hdr-ink-1);
  background: transparent;
}

/* ============================================================================
   Dark Theme
   ============================================================================ */
.${HEADER_CSS_PREFIX}-root.${HEADER_CSS_PREFIX}-theme-dark {
  /* Card backgrounds - dark semi-transparent */
  --hdr-card-bg: rgba(30, 42, 56, 0.95);
  --hdr-card-bd: #3d4f63;
  /* Text colors - light for dark bg */
  --hdr-ink-1: #f0f4f8;
  --hdr-ink-2: #a8b5c4;
  --hdr-title-color: #c8d4e0;
  --hdr-kpi-color: #ffffff;
  /* Icon colors */
  --hdr-icon-stroke: #8fa3b8;
  --hdr-icon-border: #3d4f63;
  /* Status colors - brighter for dark bg */
  --hdr-ok: #4ade80;
  --hdr-warn: #fbbf24;
  --hdr-down: #34d399;
  --hdr-up: #fb923c;
  /* Shadows */
  --hdr-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 8px 22px rgba(0, 0, 0, 0.3);
  --hdr-shadow-hover: 0 2px 4px rgba(0, 0, 0, 0.25), 0 10px 26px rgba(0, 0, 0, 0.4);
  /* Logo card - darker */
  --hdr-logo-bg: #0d1a14;
  --hdr-back-btn-bg: rgba(255, 255, 255, 0.1);
  --hdr-back-btn-bg-hover: rgba(255, 255, 255, 0.2);
  --hdr-back-btn-color: rgba(255, 255, 255, 0.6);
  --hdr-back-btn-color-hover: rgba(255, 255, 255, 0.9);
}

/* Cards Grid */
.${HEADER_CSS_PREFIX}-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  background: transparent;
}

/* Base Card */
.${HEADER_CSS_PREFIX}-card {
  position: relative;
  background: var(--hdr-card-bg);
  border: 1px solid var(--hdr-card-bd);
  border-radius: var(--hdr-radius);
  box-shadow: var(--hdr-shadow);
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 113px;
  max-height: 113px;
  transition: box-shadow 0.2s ease, transform 0.08s ease, background 0.2s ease;
}

.${HEADER_CSS_PREFIX}-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--hdr-shadow-hover);
}

/* Card Header */
.${HEADER_CSS_PREFIX}-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0;
}

.${HEADER_CSS_PREFIX}-card__title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--hdr-title-color);
  margin-bottom: 2px;
  transition: color 0.2s ease;
}

.${HEADER_CSS_PREFIX}-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--hdr-icon-border);
  border-radius: 8px;
  background: transparent;
  transition: border-color 0.2s ease;
}

.${HEADER_CSS_PREFIX}-card__icon svg path {
  stroke: var(--hdr-icon-stroke);
  transition: stroke 0.2s ease;
}

/* Card Main Content */
.${HEADER_CSS_PREFIX}-card__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.${HEADER_CSS_PREFIX}-card__kpi {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  color: var(--hdr-kpi-color);
  transition: color 0.2s ease;
}

.${HEADER_CSS_PREFIX}-card__subrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--hdr-ink-2);
  transition: color 0.2s ease;
}

/* Info Trigger */
.${HEADER_CSS_PREFIX}-info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  opacity: 0.5;
  transition: opacity 0.2s ease;
  margin-left: 4px;
  vertical-align: middle;
}

.${HEADER_CSS_PREFIX}-info-trigger:hover {
  opacity: 1;
}

/* Chip */
.${HEADER_CSS_PREFIX}-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 0.95rem;
  margin-top: 6px;
  border: none;
}

.${HEADER_CSS_PREFIX}-chip--ok {
  color: var(--hdr-ok);
}

.${HEADER_CSS_PREFIX}-chip--warn {
  color: var(--hdr-warn);
}

/* Trend */
.${HEADER_CSS_PREFIX}-trend--down {
  color: var(--hdr-down);
  font-weight: 600;
}

.${HEADER_CSS_PREFIX}-trend--up {
  color: var(--hdr-up);
  font-weight: 600;
}

/* Logo Card */
.${HEADER_CSS_PREFIX}-card--logo {
  position: relative;
  background: var(--hdr-logo-bg);
  border: 0;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.2s ease;
}

.${HEADER_CSS_PREFIX}-card--logo * {
  background: transparent;
}

.${HEADER_CSS_PREFIX}-logo-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.${HEADER_CSS_PREFIX}-logo-box img {
  max-width: 336px;
  max-height: 224px;
  width: 140%;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
}

/* Back Button */
.${HEADER_CSS_PREFIX}-back-btn {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 56px;
  height: 56px;
  padding: 0;
  border: none;
  border-radius: 12px;
  background: var(--hdr-back-btn-bg);
  color: var(--hdr-back-btn-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
  opacity: 0.85;
}

.${HEADER_CSS_PREFIX}-back-btn:hover {
  background: var(--hdr-back-btn-bg-hover);
  color: var(--hdr-back-btn-color-hover);
  opacity: 1;
  transform: translateY(-50%) scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.${HEADER_CSS_PREFIX}-back-btn:active {
  transform: translateY(-50%) scale(0.95);
}

.${HEADER_CSS_PREFIX}-back-btn svg {
  width: 32px;
  height: 32px;
  stroke: currentColor;
  fill: none;
}

/* Responsive */
@media (max-width: 1200px) {
  .${HEADER_CSS_PREFIX}-cards {
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }
}

@media (max-width: 1024px) {
  .${HEADER_CSS_PREFIX}-cards {
    grid-template-columns: repeat(5, minmax(140px, 1fr));
    gap: 6px;
  }
}

@media (max-width: 900px) {
  .${HEADER_CSS_PREFIX}-cards {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 600px) {
  .${HEADER_CSS_PREFIX}-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 400px) {
  .${HEADER_CSS_PREFIX}-cards {
    grid-template-columns: 1fr;
  }
}
`;
  }

  /**
   * Build HTML structure
   */
  private buildHTML(): string {
    const logoUrl = this.params.logoUrl || this.getConfigValue('logoUrl');
    const showBackButton = this.params.showBackButton ?? this.getConfigValue('showBackButton') ?? true;

    return `
<div class="${HEADER_CSS_PREFIX}-cards">
  <!-- Logo Card -->
  <article class="${HEADER_CSS_PREFIX}-card ${HEADER_CSS_PREFIX}-card--logo" id="${HEADER_CSS_PREFIX}-card-logo">
    ${showBackButton ? `
    <button
      class="${HEADER_CSS_PREFIX}-back-btn"
      id="${HEADER_CSS_PREFIX}-back-btn"
      title="Voltar ao Dashboard Principal"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </button>
    ` : ''}
    <div class="${HEADER_CSS_PREFIX}-logo-box">
      <img src="${logoUrl}" alt="MYIO Logo" />
    </div>
  </article>

  <!-- Equipment Card -->
  <article class="${HEADER_CSS_PREFIX}-card" id="${HEADER_CSS_PREFIX}-card-equip">
    <header class="${HEADER_CSS_PREFIX}-card__header">
      <span class="${HEADER_CSS_PREFIX}-card__title">
        Equipamentos
        <span class="${HEADER_CSS_PREFIX}-info-trigger" id="${HEADER_CSS_PREFIX}-equip-info-trigger" data-card="equipment">&#8505;&#65039;</span>
      </span>
      <span class="${HEADER_CSS_PREFIX}-card__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 4h16v16H4z" stroke="#9BB4C9" stroke-width="1.6" />
          <path d="M8 8h8v8H8z" stroke="#9BB4C9" stroke-width="1.6" />
        </svg>
      </span>
    </header>
    <div class="${HEADER_CSS_PREFIX}-card__main">
      <div class="${HEADER_CSS_PREFIX}-card__kpi"><span id="${HEADER_CSS_PREFIX}-equip-kpi">-</span></div>
      <div class="${HEADER_CSS_PREFIX}-card__subrow">
        <span id="${HEADER_CSS_PREFIX}-equip-sub">-</span>
      </div>
    </div>
  </article>

  <!-- Energy Card -->
  <article class="${HEADER_CSS_PREFIX}-card" id="${HEADER_CSS_PREFIX}-card-energy">
    <header class="${HEADER_CSS_PREFIX}-card__header">
      <span class="${HEADER_CSS_PREFIX}-card__title">
        Consumo de Energia
        <span class="${HEADER_CSS_PREFIX}-info-trigger" id="${HEADER_CSS_PREFIX}-energy-info-trigger" data-card="energy">&#8505;&#65039;</span>
      </span>
      <span class="${HEADER_CSS_PREFIX}-card__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#B7D14B" />
        </svg>
      </span>
    </header>
    <div class="${HEADER_CSS_PREFIX}-card__main">
      <div class="${HEADER_CSS_PREFIX}-card__kpi"><span id="${HEADER_CSS_PREFIX}-energy-kpi">-</span></div>
      <div class="${HEADER_CSS_PREFIX}-card__subrow">
        <span id="${HEADER_CSS_PREFIX}-energy-trend"></span>
      </div>
    </div>
  </article>

  <!-- Temperature Card -->
  <article class="${HEADER_CSS_PREFIX}-card" id="${HEADER_CSS_PREFIX}-card-temp">
    <header class="${HEADER_CSS_PREFIX}-card__header">
      <span class="${HEADER_CSS_PREFIX}-card__title">
        Media de Temperatura
        <span class="${HEADER_CSS_PREFIX}-info-trigger" id="${HEADER_CSS_PREFIX}-temp-info-trigger" data-card="temperature">&#8505;&#65039;</span>
      </span>
      <span class="${HEADER_CSS_PREFIX}-card__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M10 3v10a4 4 0 104 0V3" stroke="#9BB4C9" stroke-width="1.6" />
        </svg>
      </span>
    </header>
    <div class="${HEADER_CSS_PREFIX}-card__main">
      <div class="${HEADER_CSS_PREFIX}-card__kpi"><span id="${HEADER_CSS_PREFIX}-temp-kpi">-</span></div>
      <div class="${HEADER_CSS_PREFIX}-card__subrow">
        <span id="${HEADER_CSS_PREFIX}-temp-trend"></span>
      </div>
      <div class="${HEADER_CSS_PREFIX}-chip" id="${HEADER_CSS_PREFIX}-temp-chip">
        - Aguardando dados
      </div>
    </div>
  </article>

  <!-- Water Card -->
  <article class="${HEADER_CSS_PREFIX}-card" id="${HEADER_CSS_PREFIX}-card-water">
    <header class="${HEADER_CSS_PREFIX}-card__header">
      <span class="${HEADER_CSS_PREFIX}-card__title">
        Agua
        <span class="${HEADER_CSS_PREFIX}-info-trigger" id="${HEADER_CSS_PREFIX}-water-info-trigger" data-card="water">&#8505;&#65039;</span>
      </span>
      <span class="${HEADER_CSS_PREFIX}-card__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 3c-4 5-6 8-6 11a6 6 0 0012 0c0-3-2-6-6-11z" stroke="#7FB8E6" stroke-width="1.6" />
        </svg>
      </span>
    </header>
    <div class="${HEADER_CSS_PREFIX}-card__main">
      <div class="${HEADER_CSS_PREFIX}-card__kpi"><span id="${HEADER_CSS_PREFIX}-water-kpi">-</span></div>
      <div class="${HEADER_CSS_PREFIX}-card__subrow">
        <span id="${HEADER_CSS_PREFIX}-water-trend"></span>
      </div>
    </div>
  </article>
</div>
`;
  }

  /**
   * Cache DOM element references
   */
  private cacheElements(): void {
    if (!this.element) return;

    this.equipKpiEl = this.element.querySelector(`#${HEADER_CSS_PREFIX}-equip-kpi`);
    this.equipSubEl = this.element.querySelector(`#${HEADER_CSS_PREFIX}-equip-sub`);
    this.energyKpiEl = this.element.querySelector(`#${HEADER_CSS_PREFIX}-energy-kpi`);
    this.energyTrendEl = this.element.querySelector(`#${HEADER_CSS_PREFIX}-energy-trend`);
    this.tempKpiEl = this.element.querySelector(`#${HEADER_CSS_PREFIX}-temp-kpi`);
    this.tempTrendEl = this.element.querySelector(`#${HEADER_CSS_PREFIX}-temp-trend`);
    this.tempChipEl = this.element.querySelector(`#${HEADER_CSS_PREFIX}-temp-chip`);
    this.waterKpiEl = this.element.querySelector(`#${HEADER_CSS_PREFIX}-water-kpi`);
    this.waterTrendEl = this.element.querySelector(`#${HEADER_CSS_PREFIX}-water-trend`);
  }

  /**
   * Bind DOM events
   */
  private bindEvents(): void {
    if (!this.element) return;

    // Back button
    const backBtn = this.element.querySelector(`#${HEADER_CSS_PREFIX}-back-btn`);
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.emit('back-click');
      });
    }

    // Card clicks
    const cards = this.element.querySelectorAll(`.${HEADER_CSS_PREFIX}-card:not(.${HEADER_CSS_PREFIX}-card--logo)`);
    cards.forEach((card) => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Don't emit card-click if clicking info trigger
        if (target.classList.contains(`${HEADER_CSS_PREFIX}-info-trigger`)) {
          return;
        }
        const cardType = this.getCardTypeFromElement(card as HTMLElement);
        if (cardType) {
          this.emit('card-click', cardType);
        }
      });
    });

    // Info triggers (for tooltips)
    const infoTriggers = this.element.querySelectorAll(`.${HEADER_CSS_PREFIX}-info-trigger`);
    infoTriggers.forEach((trigger) => {
      trigger.addEventListener('mouseenter', (e) => {
        const cardType = (trigger as HTMLElement).dataset.card as CardType;
        if (cardType) {
          this.emit('card-hover', cardType, true, trigger);
        }
      });

      trigger.addEventListener('mouseleave', (e) => {
        const cardType = (trigger as HTMLElement).dataset.card as CardType;
        if (cardType) {
          this.emit('card-hover', cardType, false, trigger);
        }
      });
    });
  }

  /**
   * Get card type from element ID
   */
  private getCardTypeFromElement(element: HTMLElement): CardType | null {
    const id = element.id;
    if (id.includes('equip')) return 'equipment';
    if (id.includes('energy')) return 'energy';
    if (id.includes('temp')) return 'temperature';
    if (id.includes('water')) return 'water';
    return null;
  }

  /**
   * Apply card colors from config
   */
  private applyCardColors(): void {
    if (!this.element) return;

    // Equipment card
    this.applyCardColor(
      `#${HEADER_CSS_PREFIX}-card-equip`,
      this.params.cardColors?.equipment?.background ?? this.getConfigValue('cardEquipamentosBackgroundColor'),
      this.params.cardColors?.equipment?.font ?? this.getConfigValue('cardEquipamentosFontColor')
    );

    // Energy card
    this.applyCardColor(
      `#${HEADER_CSS_PREFIX}-card-energy`,
      this.params.cardColors?.energy?.background ?? this.getConfigValue('cardEnergiaBackgroundColor'),
      this.params.cardColors?.energy?.font ?? this.getConfigValue('cardEnergiaFontColor')
    );

    // Temperature card
    this.applyCardColor(
      `#${HEADER_CSS_PREFIX}-card-temp`,
      this.params.cardColors?.temperature?.background ?? this.getConfigValue('cardTemperaturaBackgroundColor'),
      this.params.cardColors?.temperature?.font ?? this.getConfigValue('cardTemperaturaFontColor')
    );

    // Water card
    this.applyCardColor(
      `#${HEADER_CSS_PREFIX}-card-water`,
      this.params.cardColors?.water?.background ?? this.getConfigValue('cardAguaBackgroundColor'),
      this.params.cardColors?.water?.font ?? this.getConfigValue('cardAguaFontColor')
    );

    // Logo card background
    const logoCard = this.element.querySelector(`#${HEADER_CSS_PREFIX}-card-logo`) as HTMLElement;
    if (logoCard) {
      const logoBg = this.getConfigValue('logoBackgroundColor') || '#1f3a35';
      logoCard.style.backgroundColor = logoBg;
    }
  }

  /**
   * Apply background and font color to a card
   */
  private applyCardColor(selector: string, bgColor?: string, fontColor?: string): void {
    if (!this.element) return;
    const card = this.element.querySelector(selector) as HTMLElement;
    if (card && bgColor && fontColor) {
      card.style.backgroundColor = bgColor;
      card.style.color = fontColor;
      card.style.borderColor = 'transparent';
    }
  }

  // =========================================================================
  // Public Update Methods
  // =========================================================================

  /**
   * Update all KPIs at once
   */
  public updateKPIs(kpis: Partial<CardKPIs>): void {
    if (kpis.equip) this.updateEquipmentCard(kpis.equip);
    if (kpis.energy) this.updateEnergyCard(kpis.energy);
    if (kpis.temp) this.updateTemperatureCard(kpis.temp);
    if (kpis.water) this.updateWaterCard(kpis.water);
  }

  /**
   * Update equipment card
   */
  public updateEquipmentCard(data: EquipmentKPI): void {
    if (this.equipKpiEl) {
      const total = data.totalEquipments;
      const filtered = data.filteredEquipments;
      this.equipKpiEl.textContent = `${filtered}/${total}`;
    }

    if (this.equipSubEl) {
      const percent = data.totalEquipments > 0
        ? Math.round((data.filteredEquipments / data.totalEquipments) * 100)
        : 0;
      this.equipSubEl.textContent = `${percent}% operacional`;
    }
  }

  /**
   * Update energy card
   */
  public updateEnergyCard(data: EnergyKPI): void {
    if (this.energyKpiEl) {
      if (data.isFiltered && data.unfilteredTotal > 0) {
        // Show filtered / total comparison
        const filteredFormatted = this.formatEnergy(data.customerTotal);
        const totalFormatted = this.formatEnergy(data.unfilteredTotal);
        this.energyKpiEl.innerHTML = `<span style="font-size:0.85em">${filteredFormatted} <span style="opacity:0.6">/ ${totalFormatted}</span></span>`;
      } else {
        const formatted = this.formatEnergy(data.customerTotal);
        this.energyKpiEl.textContent = formatted;
      }
    }

    if (this.energyTrendEl) {
      if (data.isFiltered && data.unfilteredTotal > 0) {
        const percent = ((data.customerTotal / data.unfilteredTotal) * 100).toFixed(1);
        this.energyTrendEl.textContent = `${percent}% do total`;
      } else {
        this.energyTrendEl.textContent = '';
      }
    }
  }

  /**
   * Update temperature card
   */
  public updateTemperatureCard(data: TemperatureKPI): void {
    if (this.tempKpiEl) {
      if (data.globalAvg !== null) {
        this.tempKpiEl.textContent = `${data.globalAvg.toFixed(1)} °C`;
      } else {
        this.tempKpiEl.textContent = '- °C';
      }
    }

    if (this.tempChipEl) {
      const inRangeCount = data.shoppingsInRange?.length || 0;
      const outRangeCount = data.shoppingsOutOfRange?.length || 0;
      const total = inRangeCount + outRangeCount;

      if (total > 0) {
        const allOk = outRangeCount === 0;
        this.tempChipEl.className = `${HEADER_CSS_PREFIX}-chip ${allOk ? `${HEADER_CSS_PREFIX}-chip--ok` : `${HEADER_CSS_PREFIX}-chip--warn`}`;
        this.tempChipEl.textContent = allOk
          ? `${inRangeCount} OK`
          : `${outRangeCount} fora da faixa`;
      } else {
        this.tempChipEl.className = `${HEADER_CSS_PREFIX}-chip`;
        this.tempChipEl.textContent = '- Aguardando dados';
      }
    }
  }

  /**
   * Update water card
   */
  public updateWaterCard(data: WaterKPI): void {
    if (this.waterKpiEl) {
      if (data.isFiltered && data.unfilteredTotal > 0) {
        // Show filtered / total comparison
        const filteredFormatted = this.formatWater(data.filteredTotal);
        const totalFormatted = this.formatWater(data.unfilteredTotal);
        this.waterKpiEl.innerHTML = `<span style="font-size:0.85em">${filteredFormatted} <span style="opacity:0.6">/ ${totalFormatted}</span></span>`;
      } else {
        const formatted = this.formatWater(data.filteredTotal);
        this.waterKpiEl.textContent = formatted;
      }
    }

    if (this.waterTrendEl) {
      if (data.isFiltered && data.unfilteredTotal > 0) {
        const percent = ((data.filteredTotal / data.unfilteredTotal) * 100).toFixed(1);
        this.waterTrendEl.textContent = `${percent}% do total`;
      } else {
        this.waterTrendEl.textContent = '';
      }
    }
  }

  // =========================================================================
  // Formatting Helpers
  // =========================================================================

  /**
   * Format energy value
   */
  private formatEnergy(value: number): string {
    // Try to use library formatter if available
    const MyIOLibrary = (window as unknown as Record<string, unknown>).MyIOLibrary as { formatEnergy?: (v: number) => string } | undefined;
    if (MyIOLibrary?.formatEnergy) {
      return MyIOLibrary.formatEnergy(value);
    }

    // Fallback formatter
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)} GWh`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} MWh`;
    } else {
      return `${value.toFixed(2)} kWh`;
    }
  }

  /**
   * Format water value
   */
  private formatWater(value: number): string {
    // Try to use library formatter if available
    const MyIOLibrary = (window as unknown as Record<string, unknown>).MyIOLibrary as { formatWaterVolumeM3?: (v: number) => string } | undefined;
    if (MyIOLibrary?.formatWaterVolumeM3) {
      return MyIOLibrary.formatWaterVolumeM3(value);
    }

    // Fallback formatter
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} mil m³`;
    } else {
      return `${value.toFixed(2)} m³`;
    }
  }

  // =========================================================================
  // Theme Management
  // =========================================================================

  /**
   * Set the theme mode (light or dark)
   */
  public setThemeMode(mode: HeaderThemeMode): void {
    this.themeMode = mode;

    if (this.element) {
      // Update theme class
      this.element.classList.remove(`${HEADER_CSS_PREFIX}-theme-light`, `${HEADER_CSS_PREFIX}-theme-dark`);
      this.element.classList.add(`${HEADER_CSS_PREFIX}-theme-${mode}`);
    }

    // Emit theme change event
    this.emit('theme-change' as HeaderEventType, { themeMode: mode });
  }

  /**
   * Get the current theme mode
   */
  public getThemeMode(): HeaderThemeMode {
    return this.themeMode;
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /**
   * Destroy the component and cleanup
   */
  public destroy(): void {
    // Remove element from DOM
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    // Clear references
    this.element = null;
    this.equipKpiEl = null;
    this.equipSubEl = null;
    this.energyKpiEl = null;
    this.energyTrendEl = null;
    this.tempKpiEl = null;
    this.tempTrendEl = null;
    this.tempChipEl = null;
    this.waterKpiEl = null;
    this.waterTrendEl = null;

    // Clear event handlers
    this.eventHandlers.clear();

    // Note: We don't remove the style element as other instances might use it
  }
}
