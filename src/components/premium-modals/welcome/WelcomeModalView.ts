/**
 * RFC-0112: Welcome Modal Head Office Component
 * View layer for the Welcome Modal
 */

import {
  WelcomeModalParams,
  WelcomePalette,
  WelcomeConfigTemplate,
  WelcomeThemeConfig,
  WelcomeThemeMode,
  ShoppingCard,
  UserInfo,
  DEFAULT_PALETTE,
  DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
} from './types';

type WelcomeEventType = 'cta-click' | 'card-click' | 'logout' | 'close' | 'theme-change';
type WelcomeEventHandler = ((data?: ShoppingCard | WelcomeThemeMode) => void);

/**
 * Welcome Modal View - Handles rendering and DOM interactions
 */
export class WelcomeModalView {
  private container: HTMLElement;
  private palette: WelcomePalette;
  private config: WelcomeConfigTemplate;
  private themeMode: WelcomeThemeMode;
  private eventHandlers: Map<WelcomeEventType, WelcomeEventHandler[]> = new Map();
  private styleElement: HTMLStyleElement | null = null;
  private intersectionObserver: IntersectionObserver | null = null;

  constructor(private params: WelcomeModalParams) {
    // Merge configTemplate with defaults
    this.config = this.mergeConfig(params.configTemplate);

    // Set initial theme mode
    this.themeMode = params.themeMode ?? 'dark';

    // Build palette from current theme config
    this.palette = this.buildPaletteForTheme(this.themeMode);

    this.container = document.createElement('div');
    this.container.className = `myio-welcome-modal myio-welcome-modal--${this.themeMode}`;

    // Debug logging
    if (this.config.enableDebugMode) {
      console.log('[WelcomeModal] Config:', this.config);
      console.log('[WelcomeModal] Palette:', this.palette);
      console.log('[WelcomeModal] Theme:', this.themeMode);
    }
  }

  /**
   * Merge user config with defaults, ensuring theme configs are properly merged
   */
  private mergeConfig(userConfig?: WelcomeConfigTemplate): WelcomeConfigTemplate {
    const merged: WelcomeConfigTemplate = {
      ...DEFAULT_CONFIG_TEMPLATE,
      ...userConfig,
      darkMode: {
        ...DEFAULT_DARK_THEME,
        ...userConfig?.darkMode,
      },
      lightMode: {
        ...DEFAULT_LIGHT_THEME,
        ...userConfig?.lightMode,
      },
    };
    return merged;
  }

  /**
   * Get the theme-specific config for current or specified theme
   */
  private getThemeConfig(mode?: WelcomeThemeMode): WelcomeThemeConfig {
    const theme = mode ?? this.themeMode;
    return theme === 'dark'
      ? (this.config.darkMode ?? DEFAULT_DARK_THEME)
      : (this.config.lightMode ?? DEFAULT_LIGHT_THEME);
  }

  /**
   * Build palette from theme config, then override with direct palette param
   */
  private buildPaletteForTheme(mode: WelcomeThemeMode): WelcomePalette {
    const themeConfig = this.getThemeConfig(mode);
    const configPalette: Partial<WelcomePalette> = {
      primary: themeConfig.primaryColor,
      secondary: themeConfig.secondaryColor,
      gradientStart: themeConfig.gradientStartColor,
      gradientEnd: themeConfig.gradientEndColor,
      ink: themeConfig.textColor,
      muted: themeConfig.mutedTextColor,
      userMenuBg: themeConfig.userMenuBackgroundColor,
      userMenuBorder: themeConfig.userMenuBorderColor,
      logoutBtnBg: themeConfig.logoutButtonBackgroundColor,
      logoutBtnBorder: themeConfig.logoutButtonBorderColor,
      shoppingCardBg: themeConfig.shoppingCardBackgroundColor,
      shoppingCardBorder: themeConfig.shoppingCardBorderColor,
    };
    return { ...DEFAULT_PALETTE, ...configPalette, ...this.params.palette };
  }

  /**
   * Set theme mode and update UI
   */
  public setThemeMode(mode: WelcomeThemeMode): void {
    this.themeMode = mode;
    this.palette = this.buildPaletteForTheme(mode);
    this.container.className = `myio-welcome-modal myio-welcome-modal--${mode}`;
    this.updateThemeToggleIcon();
    this.updateThemeVisuals();

    if (this.config.enableDebugMode) {
      console.log('[WelcomeModal] Theme changed to:', mode);
      console.log('[WelcomeModal] New palette:', this.palette);
    }
  }

  /**
   * Update visual elements when theme changes (background, logo, CSS vars)
   */
  private updateThemeVisuals(): void {
    const themeConfig = this.getThemeConfig();

    // Update background image
    const heroEl = this.container.querySelector('.myio-welcome-hero') as HTMLElement;
    if (heroEl && themeConfig.backgroundUrl) {
      heroEl.style.setProperty('--wm-bg-image', `url('${themeConfig.backgroundUrl}')`);
    }

    // Update logo
    const logoImg = this.container.querySelector('.myio-welcome-logo img') as HTMLImageElement;
    if (logoImg && themeConfig.logoUrl) {
      logoImg.src = themeConfig.logoUrl;
    }

    // Update CSS variables
    this.container.style.setProperty('--wm-primary', this.palette.primary);
    this.container.style.setProperty('--wm-secondary', this.palette.secondary);
    this.container.style.setProperty('--wm-gradient-start', this.palette.gradientStart);
    this.container.style.setProperty('--wm-gradient-end', this.palette.gradientEnd);
    this.container.style.setProperty('--wm-ink', this.palette.ink);
    this.container.style.setProperty('--wm-muted', this.palette.muted);
    this.container.style.setProperty('--wm-user-menu-bg', this.palette.userMenuBg || '');
    this.container.style.setProperty('--wm-user-menu-border', this.palette.userMenuBorder || '');
    this.container.style.setProperty('--wm-logout-btn-bg', this.palette.logoutBtnBg || '');
    this.container.style.setProperty('--wm-logout-btn-border', this.palette.logoutBtnBorder || '');
    this.container.style.setProperty('--wm-card-bg', this.palette.shoppingCardBg || '');
    this.container.style.setProperty('--wm-card-border', this.palette.shoppingCardBorder || '');
  }

  /**
   * Get current theme mode
   */
  public getThemeMode(): WelcomeThemeMode {
    return this.themeMode;
  }

  /**
   * Toggle theme mode
   */
  private toggleTheme(): void {
    const newTheme: WelcomeThemeMode = this.themeMode === 'dark' ? 'light' : 'dark';
    this.setThemeMode(newTheme);
    this.emit('theme-change', newTheme);
  }

  /**
   * Update theme toggle button icon
   */
  private updateThemeToggleIcon(): void {
    const toggleBtn = this.container.querySelector('#welcomeThemeToggle');
    if (toggleBtn) {
      // Show current theme icon (moon for dark, sun for light)
      toggleBtn.innerHTML = this.themeMode === 'dark' ? this.getMoonIcon() : this.getSunIcon();
      toggleBtn.setAttribute('title', this.themeMode === 'dark' ? 'Tema escuro (clique para claro)' : 'Tema claro (clique para escuro)');
    }
  }

  /**
   * Get sun icon emoji (for dark mode - click to go light)
   */
  private getSunIcon(): string {
    return '☀️';
  }

  /**
   * Get moon icon emoji (for light mode - click to go dark)
   */
  private getMoonIcon(): string {
    return '🌙';
  }

  /**
   * Get resolved value: direct param > configTemplate > default
   */
  private getConfigValue<T>(directValue: T | undefined, configValue: T | undefined, defaultValue: T): T {
    if (directValue !== undefined) return directValue;
    if (configValue !== undefined) return configValue;
    return defaultValue;
  }

  /**
   * Render the complete modal view
   */
  public render(): HTMLElement {
    this.injectStyles();
    this.container.innerHTML = this.buildHTML();
    this.bindEvents();
    this.setupLazyLoading();
    this.loadUserInfo();
    return this.container;
  }

  /**
   * Register event handlers
   */
  public on(event: WelcomeEventType, handler: WelcomeEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit(event: WelcomeEventType, data?: ShoppingCard | WelcomeThemeMode): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    const styleId = 'myio-welcome-modal-styles';
    if (document.getElementById(styleId)) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = styleId;
    this.styleElement.textContent = this.getStyles();
    document.head.appendChild(this.styleElement);
  }

  /**
   * Get CSS styles for the modal
   */
  private getStyles(): string {
    const p = this.palette;
    return `
/* ==========================================
   MYIO Welcome Modal - Premium Design System
   RFC-0112: Welcome Modal Head Office
   ========================================== */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.myio-welcome-modal {
  --wm-primary: ${p.primary};
  --wm-secondary: ${p.secondary};
  --wm-gradient-start: ${p.gradientStart};
  --wm-gradient-end: ${p.gradientEnd};
  --wm-ink: ${p.ink};
  --wm-muted: ${p.muted};
  --wm-user-menu-bg: ${p.userMenuBg};
  --wm-user-menu-border: ${p.userMenuBorder};
  --wm-logout-btn-bg: ${p.logoutBtnBg};
  --wm-logout-btn-border: ${p.logoutBtnBorder};
  --wm-card-bg: ${p.shoppingCardBg};
  --wm-card-border: ${p.shoppingCardBorder};

  position: fixed;
  inset: 0;
  z-index: 99990;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--wm-ink);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  overflow: hidden;
}

/* Modal Container - 90% viewport */
.myio-welcome-modal-container {
  position: relative;
  width: 90vw;
  height: 90vh;
  max-width: 1400px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #0a0f1a 0%, #1a1f2e 50%, #0d1117 100%);
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgba(122, 47, 247, 0.2),
    0 25px 80px rgba(0, 0, 0, 0.5),
    0 0 60px rgba(122, 47, 247, 0.15);
  overflow: hidden;
}

/* Hero Container */
.myio-welcome-hero {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 60px 40px;
  background:
    linear-gradient(180deg,
      rgba(122, 47, 247, 0.25) 0%,
      var(--wm-gradient-start) 20%,
      var(--wm-gradient-end) 80%,
      rgba(13, 17, 23, 0.95) 100%
    ),
    var(--wm-bg-image, none);
  background-size: cover;
  background-position: center;
  min-height: 45vh;
  border-bottom: 1px solid rgba(122, 47, 247, 0.2);
}

/* Brand Logo - Large floating */
.myio-welcome-logo {
  position: absolute;
  top: 20px;
  left: 28px;
  z-index: 10;
  pointer-events: none;
}

.myio-welcome-logo img {
  height: 180px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 8px 24px rgba(0,0,0,0.5));
  opacity: 0.95;
}

/* User Menu - Desktop: absolute positioned */
.myio-welcome-user-menu {
  position: absolute;
  top: 24px;
  right: 32px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--wm-user-menu-bg);
  border: 1px solid var(--wm-user-menu-border);
  border-radius: 12px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.myio-welcome-user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.myio-welcome-user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--wm-ink);
  letter-spacing: -0.01em;
}

.myio-welcome-user-email {
  font-size: 12px;
  font-weight: 400;
  color: var(--wm-muted);
}

.myio-welcome-logout-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--wm-logout-btn-bg);
  border: 1px solid var(--wm-logout-btn-border);
  border-radius: 8px;
  color: var(--wm-ink);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.myio-welcome-logout-btn:hover {
  background: rgba(255,255,255,0.15);
  border-color: rgba(255,255,255,0.25);
  transform: translateY(-1px);
}

.myio-welcome-logout-btn svg {
  width: 16px;
  height: 16px;
}

/* Hero Content */
.myio-welcome-hero-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 700px;
  padding: 40px 20px;
}

.myio-welcome-hero-title {
  margin: 0 0 20px 0;
  font-size: clamp(32px, 6vw, 56px);
  font-weight: 800;
  color: var(--wm-ink);
  letter-spacing: -0.03em;
  line-height: 1.05;
  text-shadow: 0 4px 30px rgba(0,0,0,0.4);
}

.myio-welcome-hero-description {
  margin: 0 0 36px 0;
  font-size: clamp(15px, 2.5vw, 20px);
  font-weight: 400;
  color: var(--wm-muted);
  line-height: 1.7;
  max-width: 550px;
  text-align: center;
}

.myio-welcome-cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 40px;
  background: linear-gradient(135deg, var(--wm-primary) 0%, var(--wm-secondary) 100%);
  border: none;
  border-radius: 12px;
  color: white;
  font-family: inherit;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow:
    0 4px 20px rgba(122, 47, 247, 0.4),
    0 0 0 0 rgba(122, 47, 247, 0);
}

.myio-welcome-cta-btn:hover {
  transform: translateY(-3px);
  box-shadow:
    0 8px 30px rgba(122, 47, 247, 0.5),
    0 0 0 4px rgba(122, 47, 247, 0.2);
}

.myio-welcome-cta-btn:active {
  transform: translateY(-1px);
}

.myio-welcome-cta-btn svg {
  width: 20px;
  height: 20px;
}

/* Shopping Cards Section */
.myio-welcome-shortcuts {
  padding: 32px;
  background: linear-gradient(180deg, rgba(15,20,25,0.95) 0%, rgba(15,20,25,1) 100%);
}

.myio-welcome-shortcuts-title {
  margin: 0 0 20px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--wm-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: center;
}

.myio-welcome-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.myio-welcome-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 140px;
  padding: 20px;
  background: var(--wm-card-bg);
  border: 1px solid var(--wm-card-border);
  border-radius: 16px;
  cursor: pointer;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  overflow: hidden;
}

.myio-welcome-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%);
  z-index: 1;
  transition: opacity 0.25s ease;
}

.myio-welcome-card:hover {
  transform: scale(1.03);
  border-color: rgba(122, 47, 247, 0.5);
  box-shadow:
    0 12px 40px rgba(0,0,0,0.4),
    0 0 0 1px rgba(122, 47, 247, 0.4),
    0 0 30px rgba(122, 47, 247, 0.15);
}

.myio-welcome-card:focus {
  outline: none;
  box-shadow:
    0 0 0 3px rgba(122, 47, 247, 0.5),
    0 12px 40px rgba(0,0,0,0.4);
}

.myio-welcome-card-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.myio-welcome-card-bg.loaded {
  opacity: 0.6;
}

.myio-welcome-card-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.myio-welcome-card-title {
  margin: 0 0 10px 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--wm-ink);
  letter-spacing: 0.02em;
  text-shadow: 0 1px 3px rgba(0,0,0,0.25);
}

.myio-welcome-card-subtitle {
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  color: var(--wm-muted);
}

/* Device Counts Display - Interactive */
.myio-welcome-card-device-counts {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 4px;
}

.myio-welcome-card-device-count {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--wm-muted);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.myio-welcome-card-device-count:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.08);
}

.myio-welcome-card-device-count .icon {
  font-size: 11px;
}

.myio-welcome-card-device-count.energy:hover {
  background: rgba(34, 197, 94, 0.3);
  border-color: rgba(34, 197, 94, 0.5);
}
.myio-welcome-card-device-count.water:hover {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
}
.myio-welcome-card-device-count.temperature:hover {
  background: rgba(249, 115, 22, 0.3);
  border-color: rgba(249, 115, 22, 0.5);
}

.myio-welcome-card-device-count.energy .icon { color: #22c55e; }
.myio-welcome-card-device-count.water .icon { color: #3b82f6; }
.myio-welcome-card-device-count.temperature .icon { color: #f97316; }




/* Close Button (optional) */
.myio-welcome-close-btn {
  position: absolute;
  top: 24px;
  right: 32px;
  z-index: 20;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 50%;
  color: var(--wm-ink);
  cursor: pointer;
  transition: all 0.2s ease;
}

.myio-welcome-close-btn:hover {
  background: rgba(255,255,255,0.2);
  transform: scale(1.05);
}

/* Responsive - Tablet */
@media (max-width: 768px) {
  .myio-welcome-modal-container {
    width: 95vw;
    height: 95vh;
    max-height: 95vh;
    border-radius: 10px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .myio-welcome-hero {
    padding: 80px 20px 40px 20px;
    min-height: auto;
    flex-shrink: 0;
  }

  .myio-welcome-logo {
    top: 12px;
    left: 12px;
  }

  .myio-welcome-logo img {
    height: 60px;
  }

  .myio-welcome-user-menu {
    position: relative;
    top: auto;
    right: auto;
    width: 100%;
    padding: 12px 16px;
    margin-bottom: 20px;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .myio-welcome-user-info {
    display: flex !important;
    flex-direction: column;
    align-items: flex-start;
  }

  .myio-welcome-user-name {
    font-size: 14px;
    font-weight: 600;
  }

  .myio-welcome-user-email {
    font-size: 11px;
  }

  .myio-welcome-hero-content {
    padding: 20px;
    width: 100%;
    max-width: 100%;
  }

  .myio-welcome-hero-title {
    font-size: 24px;
  }

  .myio-welcome-hero-description {
    font-size: 14px;
  }

  .myio-welcome-shortcuts {
    padding: 20px;
    flex-shrink: 0;
  }

  .myio-welcome-shortcuts-title {
    font-size: 14px;
  }

  .myio-welcome-cards-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .myio-welcome-card {
    min-height: 110px;
  }

  .myio-welcome-card-title {
    font-size: 14px;
  }

  .myio-welcome-card-device-counts {
    gap: 6px;
  }

  .myio-welcome-card-device-count {
    padding: 3px 6px;
    font-size: 10px;
  }
}

/* Responsive - Mobile */
@media (max-width: 480px) {
  .myio-welcome-modal-container {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    overflow-y: auto;
  }

  .myio-welcome-hero {
    padding: 70px 16px 30px 16px;
    min-height: auto;
  }

  .myio-welcome-logo {
    top: 10px;
    left: 10px;
  }

  .myio-welcome-logo img {
    height: 45px;
  }

  .myio-welcome-user-menu {
    padding: 10px 12px;
    margin-bottom: 12px;
  }

  .myio-welcome-hero-title {
    font-size: 20px;
    margin-bottom: 12px;
  }

  .myio-welcome-hero-description {
    font-size: 13px;
    margin-bottom: 20px;
  }

  .myio-welcome-cta-btn {
    padding: 12px 24px;
    font-size: 13px;
  }

  .myio-welcome-shortcuts {
    padding: 16px;
  }

  .myio-welcome-shortcuts-title {
    font-size: 13px;
    margin-bottom: 12px;
  }

  .myio-welcome-cards-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .myio-welcome-card {
    min-height: 90px;
    padding: 14px;
  }

  .myio-welcome-card-title {
    font-size: 15px;
    margin-bottom: 6px;
  }

  .myio-welcome-card-device-counts {
    gap: 8px;
  }

  .myio-welcome-card-device-count {
    padding: 4px 8px;
    font-size: 11px;
  }

  .myio-welcome-card-arrow {
    top: 12px;
    left: 12px;
    width: 28px;
    height: 28px;
  }
}

/* Animation */
@keyframes welcomeFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.myio-welcome-hero-content {
  animation: welcomeFadeIn 0.6s ease-out;
}

.myio-welcome-card {
  animation: welcomeFadeIn 0.5s ease-out;
  animation-fill-mode: both;
}

.myio-welcome-card:nth-child(1) { animation-delay: 0.1s; }
.myio-welcome-card:nth-child(2) { animation-delay: 0.15s; }
.myio-welcome-card:nth-child(3) { animation-delay: 0.2s; }
.myio-welcome-card:nth-child(4) { animation-delay: 0.25s; }
.myio-welcome-card:nth-child(5) { animation-delay: 0.3s; }
.myio-welcome-card:nth-child(6) { animation-delay: 0.35s; }

/* ==========================================
   Theme Toggle Button - Inside user menu (first item)
   ========================================== */
.myio-welcome-theme-toggle {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: var(--wm-ink);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.myio-welcome-theme-toggle:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.35);
  transform: scale(1.08);
}

/* ==========================================
   Meta Counts Row (Users, Alarms, Notifications)
   Above card title - same style as device counts
   ========================================== */
.myio-welcome-card-meta-counts {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

/* Extend device-count styles for meta types */
.myio-welcome-card-device-count.users:hover {
  background: rgba(124, 58, 237, 0.3);
  border-color: rgba(124, 58, 237, 0.5);
}

.myio-welcome-card-device-count.alarms:hover {
  background: rgba(220, 38, 38, 0.3);
  border-color: rgba(220, 38, 38, 0.5);
}

.myio-welcome-card-device-count.notifications:hover {
  background: rgba(234, 179, 8, 0.3);
  border-color: rgba(234, 179, 8, 0.5);
}

.myio-welcome-card-device-count.users .icon { color: #a78bfa; }
.myio-welcome-card-device-count.alarms .icon { color: #f87171; }
.myio-welcome-card-device-count.notifications .icon { color: #fbbf24; }

/* ==========================================
   Light Theme Mode
   ========================================== */
.myio-welcome-modal--light {
  --wm-ink: #1a1a2e;
  --wm-muted: #4a4a6a;
  --wm-user-menu-bg: rgba(0, 0, 0, 0.06);
  --wm-user-menu-border: rgba(0, 0, 0, 0.12);
  --wm-logout-btn-bg: rgba(0, 0, 0, 0.06);
  --wm-logout-btn-border: rgba(0, 0, 0, 0.15);
  --wm-card-bg: rgba(0, 0, 0, 0.04);
  --wm-card-border: rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.85);
}

.myio-welcome-modal--light .myio-welcome-modal-container {
  background: linear-gradient(135deg, #f8f9fc 0%, #ffffff 50%, #f0f2f5 100%);
  box-shadow:
    0 0 0 1px rgba(122, 47, 247, 0.15),
    0 25px 80px rgba(0, 0, 0, 0.2),
    0 0 60px rgba(122, 47, 247, 0.1);
}

.myio-welcome-modal--light .myio-welcome-hero {
  background:
    linear-gradient(180deg,
      rgba(122, 47, 247, 0.12) 0%,
      rgba(255, 255, 255, 0.7) 20%,
      rgba(255, 255, 255, 0.85) 80%,
      rgba(248, 249, 252, 0.95) 100%
    ),
    var(--wm-bg-image, none);
  border-bottom: 1px solid rgba(122, 47, 247, 0.15);
}

.myio-welcome-modal--light .myio-welcome-hero-title {
  color: #1a1a2e;
  text-shadow: 0 2px 20px rgba(255, 255, 255, 0.6);
}

.myio-welcome-modal--light .myio-welcome-hero-description {
  color: #4a4a6a;
}

.myio-welcome-modal--light .myio-welcome-user-menu {
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(0, 0, 0, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.myio-welcome-modal--light .myio-welcome-user-name {
  color: #1a1a2e;
}

.myio-welcome-modal--light .myio-welcome-user-email {
  color: #6a6a8a;
}

.myio-welcome-modal--light .myio-welcome-logout-btn {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.12);
  color: #1a1a2e;
}

.myio-welcome-modal--light .myio-welcome-logout-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 0, 0, 0.2);
}

.myio-welcome-modal--light .myio-welcome-shortcuts {
  background: linear-gradient(180deg, rgba(248, 249, 252, 0.98) 0%, #f0f2f5 100%);
}

.myio-welcome-modal--light .myio-welcome-shortcuts-title {
  color: #6a6a8a;
}

.myio-welcome-modal--light .myio-welcome-card {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.myio-welcome-modal--light .myio-welcome-card:hover {
  border-color: rgba(122, 47, 247, 0.4);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(122, 47, 247, 0.3),
    0 0 30px rgba(122, 47, 247, 0.1);
}

.myio-welcome-modal--light .myio-welcome-card::before {
  background: linear-gradient(180deg, transparent 40%, rgba(255, 255, 255, 0.8) 100%);
}

.myio-welcome-modal--light .myio-welcome-card-title {
  color: #1a1a2e;
  text-shadow: 0 1px 4px rgba(255, 255, 255, 0.5);
}

.myio-welcome-modal--light .myio-welcome-card-subtitle {
  color: #6a6a8a;
}

.myio-welcome-modal--light .myio-welcome-card-device-count {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(0, 0, 0, 0.1);
  color: #4a4a6a;
}

.myio-welcome-modal--light .myio-welcome-card-device-count:hover {
  background: rgba(255, 255, 255, 1);
  border-color: rgba(0, 0, 0, 0.2);
}

.myio-welcome-modal--light .myio-welcome-card-device-count.energy:hover {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.4);
}

.myio-welcome-modal--light .myio-welcome-card-device-count.water:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.4);
}

.myio-welcome-modal--light .myio-welcome-card-device-count.temperature:hover {
  background: rgba(249, 115, 22, 0.15);
  border-color: rgba(249, 115, 22, 0.4);
}

.myio-welcome-modal--light .myio-welcome-card-arrow {
  background: rgba(0, 0, 0, 0.08);
}

.myio-welcome-modal--light .myio-welcome-card-arrow svg {
  color: #1a1a2e;
}

.myio-welcome-modal--light .myio-welcome-theme-toggle {
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.12);
  color: #1a1a2e;
}

.myio-welcome-modal--light .myio-welcome-theme-toggle:hover {
  background: rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 0, 0, 0.2);
}

/* Light theme - meta counts use same device-count light styles */
.myio-welcome-modal--light .myio-welcome-card-device-count.users:hover {
  background: rgba(124, 58, 237, 0.15);
  border-color: rgba(124, 58, 237, 0.4);
}

.myio-welcome-modal--light .myio-welcome-card-device-count.alarms:hover {
  background: rgba(220, 38, 38, 0.15);
  border-color: rgba(220, 38, 38, 0.4);
}

.myio-welcome-modal--light .myio-welcome-card-device-count.notifications:hover {
  background: rgba(234, 179, 8, 0.15);
  border-color: rgba(234, 179, 8, 0.4);
}

/* Light theme responsive adjustments */
@media (max-width: 768px) {
  .myio-welcome-modal--light .myio-welcome-user-menu {
    background: rgba(255, 255, 255, 0.95);
    border-color: rgba(0, 0, 0, 0.08);
  }

  .myio-welcome-theme-toggle {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .myio-welcome-card-meta-counts {
    gap: 6px;
    margin-bottom: 6px;
  }
}

@media (max-width: 480px) {
  .myio-welcome-theme-toggle {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }

  .myio-welcome-card-meta-counts {
    gap: 4px;
    margin-bottom: 4px;
  }
}
`;
  }

  /**
   * Build the HTML structure
   */
  private buildHTML(): string {
    // Get current theme config for URLs
    const themeConfig = this.getThemeConfig();

    // Resolve values: direct params override theme config
    const logoUrl = this.params.logoUrl ?? themeConfig.logoUrl;
    const backgroundUrl = this.params.backgroundUrl ?? themeConfig.backgroundUrl;
    const heroTitle = this.params.heroTitle ?? this.config.defaultHeroTitle ?? 'Bem-vindo ao MYIO Platform';
    const heroDescription = this.params.heroDescription ?? this.config.defaultHeroDescription ?? 'Gestão inteligente de energia, água e recursos para shoppings centers';
    const ctaLabel = this.params.ctaLabel ?? this.config.defaultPrimaryLabel ?? 'ACESSAR PAINEL';
    const shortcutsTitle = this.params.shortcutsTitle ?? this.config.defaultShortcutsTitle ?? 'Acesso Rápido aos Shoppings';
    const showUserMenu = this.params.showUserMenu ?? this.config.showUserMenuByDefault ?? true;
    const showThemeToggle = this.params.showThemeToggle ?? true;
    const shoppingCards = this.params.shoppingCards ?? [];

    // Resolve text colors from theme config (with fallbacks)
    const heroTitleColor = themeConfig.heroTitleColor ?? themeConfig.textColor;
    const heroDescColor = themeConfig.heroDescriptionColor ?? themeConfig.mutedTextColor;
    const shortcutsTitleColor = themeConfig.shortcutsTitleColor ?? themeConfig.mutedTextColor;

    const bgStyle = backgroundUrl ? `style="--wm-bg-image: url('${backgroundUrl}')"` : '';
    // Show current theme icon (moon for dark, sun for light)
    const themeIcon = this.themeMode === 'dark' ? this.getMoonIcon() : this.getSunIcon();
    const themeTooltip = this.themeMode === 'dark' ? 'Tema escuro (clique para claro)' : 'Tema claro (clique para escuro)';

    return `
      <div class="myio-welcome-modal-container">
        <div class="myio-welcome-hero" ${bgStyle}>
          ${logoUrl ? `
            <div class="myio-welcome-logo">
              <img src="${logoUrl}" alt="Logo" />
            </div>
          ` : ''}

          ${showUserMenu ? `
            <div class="myio-welcome-user-menu" id="welcomeUserMenu">
              ${showThemeToggle ? `
                <button class="myio-welcome-theme-toggle" id="welcomeThemeToggle" type="button" title="${themeTooltip}">
                  ${themeIcon}
                </button>
              ` : ''}
              <div class="myio-welcome-user-info">
                <div class="myio-welcome-user-name" id="welcomeUserName">Carregando...</div>
                <div class="myio-welcome-user-email" id="welcomeUserEmail"></div>
              </div>
              <button class="myio-welcome-logout-btn" id="welcomeLogoutBtn" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sair
              </button>
            </div>
          ` : showThemeToggle ? `
            <div class="myio-welcome-user-menu" id="welcomeUserMenu">
              <button class="myio-welcome-theme-toggle" id="welcomeThemeToggle" type="button" title="${themeTooltip}">
                ${themeIcon}
              </button>
            </div>
          ` : ''}

          <div class="myio-welcome-hero-content">
            <h1 class="myio-welcome-hero-title" id="welcomeHeroTitle"${heroTitleColor ? ` style="color: ${heroTitleColor}"` : ''}>${heroTitle}</h1>
            <p class="myio-welcome-hero-description" id="welcomeHeroDescription"${heroDescColor ? ` style="color: ${heroDescColor}"` : ''}>${heroDescription}</p>
            <button class="myio-welcome-cta-btn" id="welcomeCtaBtn" type="button">
              ${ctaLabel}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>

        ${shoppingCards.length > 0 ? `
          <div class="myio-welcome-shortcuts">
            <h2 class="myio-welcome-shortcuts-title"${shortcutsTitleColor ? ` style="color: ${shortcutsTitleColor}"` : ''}>${shortcutsTitle}</h2>
            <div class="myio-welcome-cards-grid" id="welcomeCardsGrid">
              ${shoppingCards.map((card, index) => this.buildCardHTML(card, index)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Build HTML for a single shopping card
   */
  private buildCardHTML(card: ShoppingCard, index: number): string {
    const bgImage = card.bgImageUrl
      ? `<div class="myio-welcome-card-bg" data-src="${card.bgImageUrl}"></div>`
      : '';

    // Meta counts row (Users, Alarms, Notifications) - above title, same style as device counts
    const { users = 0, alarms = 0, notifications = 0 } = card.metaCounts || {};
    const metaCountsHTML = `
      <div class="myio-welcome-card-meta-counts">
        <span class="myio-welcome-card-device-count users"
              data-tooltip-type="users"
              data-card-index="${index}"
              title="Usuarios">
          <span class="icon">👥</span> ${users}
        </span>
        <span class="myio-welcome-card-device-count alarms"
              data-tooltip-type="alarms"
              data-card-index="${index}"
              title="Alarmes">
          <span class="icon">🚨</span> ${alarms}
        </span>
        <span class="myio-welcome-card-device-count notifications"
              data-tooltip-type="notifications"
              data-card-index="${index}"
              title="Notificacoes">
          <span class="icon">🔔</span> ${notifications}
        </span>
      </div>
    `;

    // Build subtitle: device counts (interactive) if available, otherwise fallback to subtitle text
    let subtitleHTML: string;
    if (card.deviceCounts) {
      const { energy = 0, water = 0, temperature = 0 } = card.deviceCounts;
      subtitleHTML = `
        <div class="myio-welcome-card-device-counts">
          <span class="myio-welcome-card-device-count energy"
                data-tooltip-type="energy"
                data-card-index="${index}"
                title="Resumo de Energia">
            <span class="icon">⚡</span> ${energy}
          </span>
          <span class="myio-welcome-card-device-count water"
                data-tooltip-type="water"
                data-card-index="${index}"
                title="Resumo de Agua">
            <span class="icon">💧</span> ${water}
          </span>
          <span class="myio-welcome-card-device-count temperature"
                data-tooltip-type="temperature"
                data-card-index="${index}"
                title="Sensores de Temperatura">
            <span class="icon">🌡️</span> ${temperature}
          </span>
        </div>
      `;
    } else {
      subtitleHTML = `<p class="myio-welcome-card-subtitle">${card.subtitle || 'Dashboard Principal'}</p>`;
    }

    return `
      <div class="myio-welcome-card"
           tabindex="0"
           role="button"
           aria-label="Acessar ${card.title}"
           data-card-index="${index}"
           data-dashboard-id="${card.dashboardId}"
           data-entity-id="${card.entityId}"
           data-entity-type="${card.entityType || 'ASSET'}">
        ${bgImage}
        <div class="myio-welcome-card-content">
          ${metaCountsHTML}
          <h3 class="myio-welcome-card-title">${card.title}</h3>
          ${subtitleHTML}
        </div>
      </div>
    `;
  }

  /**
   * Bind event listeners
   */
  private bindEvents(): void {
    // CTA button click
    const ctaBtn = this.container.querySelector('#welcomeCtaBtn');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        this.emit('cta-click');
      });
    }

    // Logout button click
    const logoutBtn = this.container.querySelector('#welcomeLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.emit('logout');
      });
    }

    // Theme toggle button click
    const themeToggle = this.container.querySelector('#welcomeThemeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    // Shopping card clicks
    const cards = this.container.querySelectorAll('.myio-welcome-card');
    cards.forEach((card, index) => {
      const shoppingCard = this.params.shoppingCards?.[index];
      if (!shoppingCard) return;

      // Click handler
      card.addEventListener('click', (e: Event) => {
        // Don't trigger card click if clicking on device count (tooltip trigger)
        const target = e.target as HTMLElement;
        if (target.closest('.myio-welcome-card-device-count')) {
          return;
        }
        this.emit('card-click', shoppingCard);
      });

      // Keyboard support (Enter and Space)
      card.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          e.preventDefault();
          this.emit('card-click', shoppingCard);
        }
      });
    });

    // Tooltip icon clicks
    this.bindTooltipEvents();
  }

  /**
   * Bind tooltip event listeners to device count elements and meta icons
   */
  private bindTooltipEvents(): void {
    // Device count tooltips (energy, water, temperature)
    const deviceCounts = this.container.querySelectorAll('.myio-welcome-card-device-count[data-tooltip-type]');
    deviceCounts.forEach(countEl => {
      countEl.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const tooltipType = target.dataset.tooltipType;
        const cardIndex = parseInt(target.dataset.cardIndex || '0', 10);
        const card = this.params.shoppingCards?.[cardIndex];

        if (!card) return;

        this.handleTooltipClick(tooltipType as any, card, target);
      });

      countEl.addEventListener('mouseenter', (e: Event) => {
        const target = e.currentTarget as HTMLElement;
        const tooltipType = target.dataset.tooltipType;
        const cardIndex = parseInt(target.dataset.cardIndex || '0', 10);
        const card = this.params.shoppingCards?.[cardIndex];

        if (!card) return;

        this.handleTooltipClick(tooltipType as any, card, target);
      });
    });

    // Meta counts tooltips (users, alarms, notifications)
    const metaCounts = this.container.querySelectorAll('.myio-welcome-card-meta-counts .myio-welcome-card-device-count[data-tooltip-type]');
    metaCounts.forEach(countEl => {
      countEl.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const tooltipType = target.dataset.tooltipType;
        const cardIndex = parseInt(target.dataset.cardIndex || '0', 10);
        const card = this.params.shoppingCards?.[cardIndex];

        if (!card) return;

        this.handleTooltipClick(tooltipType as any, card, target);
      });

      countEl.addEventListener('mouseenter', (e: Event) => {
        const target = e.currentTarget as HTMLElement;
        const tooltipType = target.dataset.tooltipType;
        const cardIndex = parseInt(target.dataset.cardIndex || '0', 10);
        const card = this.params.shoppingCards?.[cardIndex];

        if (!card) return;

        this.handleTooltipClick(tooltipType as any, card, target);
      });
    });
  }

  /**
   * Handle tooltip icon click - shows the appropriate tooltip
   */
  private handleTooltipClick(
    type: 'energy' | 'water' | 'temperature' | 'users' | 'alarms' | 'notifications',
    card: ShoppingCard,
    triggerElement: HTMLElement
  ): void {
    // Get tooltip utilities from window (they're exposed by the library)
    const win = window as any;
    const MyIOLibrary = win.MyIOLibrary;

    if (!MyIOLibrary) {
      console.warn('[WelcomeModal] MyIOLibrary not available for tooltips');
      return;
    }

    // Mock data for demonstration - in production this would come from actual API
    const mockData = this.getMockTooltipData(type, card);

    switch (type) {
      case 'energy':
        if (MyIOLibrary.EnergySummaryTooltip) {
          MyIOLibrary.EnergySummaryTooltip.show(triggerElement, mockData.energy);
        }
        break;
      case 'water':
        if (MyIOLibrary.WaterSummaryTooltip) {
          MyIOLibrary.WaterSummaryTooltip.show(triggerElement, mockData.water);
        }
        break;
      case 'temperature':
        if (MyIOLibrary.TempSensorSummaryTooltip) {
          MyIOLibrary.TempSensorSummaryTooltip.show(triggerElement, mockData.temperature);
        }
        break;
      case 'users':
        if (MyIOLibrary.UsersSummaryTooltip) {
          MyIOLibrary.UsersSummaryTooltip.show(triggerElement, mockData.users);
        }
        break;
      case 'alarms':
        if (MyIOLibrary.AlarmsSummaryTooltip) {
          MyIOLibrary.AlarmsSummaryTooltip.show(triggerElement, mockData.alarms);
        }
        break;
      case 'notifications':
        if (MyIOLibrary.NotificationsSummaryTooltip) {
          MyIOLibrary.NotificationsSummaryTooltip.show(triggerElement, mockData.notifications);
        }
        break;
    }
  }

  /**
   * Get mock tooltip data for demonstration
   */
  private getMockTooltipData(type: string, card: ShoppingCard): any {
    const now = new Date().toISOString();

    return {
      energy: {
        totalDevices: 45,
        totalConsumption: 12500.50,
        unit: 'kWh',
        byCategory: [
          { id: 'entrada', name: 'Entrada', icon: '📥', deviceCount: 2, consumption: 12500.50, percentage: 100 },
          { id: 'lojas', name: 'Lojas', icon: '🏪', deviceCount: 15, consumption: 4200.00, percentage: 34 },
          { id: 'areaComum', name: 'Area Comum', icon: '🏢', deviceCount: 28, consumption: 8300.50, percentage: 66 },
        ],
        byStatus: {
          waiting: 0,
          weakConnection: 2,
          offline: 1,
          normal: 38,
          alert: 3,
          failure: 1,
          standby: 0,
          noConsumption: 0,
        },
        lastUpdated: now,
        customerName: card.title,
      },
      water: {
        totalDevices: 12,
        totalConsumption: 850.25,
        unit: 'm³',
        byCategory: [
          { id: 'entrada', name: 'Entrada', icon: '📥', deviceCount: 1, consumption: 850.25, percentage: 100 },
          { id: 'lojas', name: 'Lojas', icon: '🏪', deviceCount: 6, consumption: 420.00, percentage: 49 },
          { id: 'areaComum', name: 'Area Comum', icon: '🏢', deviceCount: 5, consumption: 430.25, percentage: 51 },
        ],
        byStatus: {
          waiting: 0,
          weakConnection: 1,
          offline: 0,
          normal: 10,
          alert: 1,
          failure: 0,
          standby: 0,
          noConsumption: 0,
        },
        lastUpdated: now,
        customerName: card.title,
      },
      temperature: {
        devices: [
          { name: 'Sensor Lobby', temp: 23.5, status: 'ok' as const },
          { name: 'Sensor Praca Alimentacao', temp: 24.2, status: 'ok' as const },
          { name: 'Sensor Cinema', temp: 22.8, status: 'ok' as const },
          { name: 'Sensor Estacionamento', temp: 27.1, status: 'warn' as const },
        ],
        temperatureMin: 20,
        temperatureMax: 26,
        lastUpdated: now,
        customerName: card.title,
      },
      users: {
        totalUsers: 12,
        activeUsers: 10,
        inactiveUsers: 2,
        byRole: {
          admin: 2,
          operator: 5,
          viewer: 5,
        },
        lastUpdated: now,
        customerName: card.title,
      },
      alarms: {
        totalAlarms: 3,
        activeAlarms: 2,
        acknowledgedAlarms: 1,
        bySeverity: {
          critical: 1,
          warning: 1,
          info: 1,
        },
        lastUpdated: now,
        customerName: card.title,
      },
      notifications: {
        totalNotifications: 5,
        unreadNotifications: 3,
        readNotifications: 2,
        byType: {
          system: 1,
          alert: 2,
          info: 1,
          success: 1,
        },
        lastUpdated: now,
        customerName: card.title,
      },
    };
  }

  /**
   * Setup lazy loading for card background images
   */
  private setupLazyLoading(): void {
    // Check if lazy loading is enabled
    if (!this.config.enableLazyLoading) {
      // Load all images immediately
      const bgElements = this.container.querySelectorAll('.myio-welcome-card-bg[data-src]');
      bgElements.forEach(el => {
        const htmlEl = el as HTMLElement;
        const src = htmlEl.dataset.src;
        if (src) {
          htmlEl.style.backgroundImage = `url('${src}')`;
          htmlEl.classList.add('loaded');
        }
      });
      return;
    }

    const bgElements = this.container.querySelectorAll('.myio-welcome-card-bg[data-src]');
    if (bgElements.length === 0) return;

    const rootMargin = this.config.lazyLoadRootMargin ?? '50px';

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const src = el.dataset.src;
            if (src) {
              el.style.backgroundImage = `url('${src}')`;
              el.classList.add('loaded');
              this.intersectionObserver?.unobserve(el);
            }
          }
        });
      },
      { rootMargin }
    );

    bgElements.forEach(el => this.intersectionObserver?.observe(el));
  }

  /**
   * Load user info from params or API
   */
  private async loadUserInfo(): Promise<void> {
    if (!this.params.showUserMenu) return;

    const userNameEl = this.container.querySelector('#welcomeUserName');
    const userEmailEl = this.container.querySelector('#welcomeUserEmail');

    if (!userNameEl || !userEmailEl) return;

    // If user info is provided, use it directly
    if (this.params.userInfo) {
      userNameEl.textContent = this.params.userInfo.fullName;
      userEmailEl.textContent = this.params.userInfo.email;
      return;
    }

    // Try to fetch from API
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        userNameEl.textContent = 'Usuário';
        userEmailEl.textContent = '';
        return;
      }

      const response = await fetch('/api/auth/user', {
        headers: {
          'X-Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Usuário';
        userNameEl.textContent = fullName;
        userEmailEl.textContent = user.email || '';
      } else {
        userNameEl.textContent = 'Usuário';
        userEmailEl.textContent = '';
      }
    } catch (error) {
      console.warn('[WelcomeModal] Failed to fetch user info:', error);
      userNameEl.textContent = 'Usuário';
      userEmailEl.textContent = '';
    }
  }

  /**
   * Update user info display
   */
  public updateUserInfo(info: UserInfo): void {
    const userNameEl = this.container.querySelector('#welcomeUserName');
    const userEmailEl = this.container.querySelector('#welcomeUserEmail');

    if (userNameEl) userNameEl.textContent = info.fullName;
    if (userEmailEl) userEmailEl.textContent = info.email;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    // Note: styleElement is shared across instances, so we don't remove it here
    this.eventHandlers.clear();
  }
}
