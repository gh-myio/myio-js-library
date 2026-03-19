/**
 * RFC-0174: Integrations Modal View
 *
 * Renders the UI for the integrations modal with tabs and iframe.
 */

import {
  IntegrationsThemeMode,
  IntegrationTab,
  IntegrationTabId,
  DEFAULT_INTEGRATION_TABS,
} from './types';

// ────────────────────────────────────────────
// CSS Styles
// ────────────────────────────────────────────

const CSS_ID = 'myio-integrations-modal-styles';

const MODAL_CSS = `
  .myio-integrations-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    z-index: 9998;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Roboto', Arial, sans-serif;
  }

  .myio-integrations-modal {
    width: 95vw;
    height: 95vh;
    background: #ffffff;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform: scale(0.95);
    opacity: 0;
    transition: transform 0.2s ease, opacity 0.2s ease;
  }

  .myio-integrations-modal.myio-integrations-modal--open {
    transform: scale(1);
    opacity: 1;
  }

  .myio-integrations-modal[data-theme="dark"] {
    background: #2d2d2d;
  }

  /* Header */
  .myio-integrations-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: linear-gradient(135deg, #3e1a7d 0%, #2d1458 100%);
    color: white;
    border-radius: 10px 10px 0 0;
    min-height: 36px;
  }

  .myio-integrations-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    letter-spacing: 0.3px;
  }

  .myio-integrations-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: 24px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
    line-height: 1;
  }

  .myio-integrations-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .myio-integrations-close:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  /* Tabs */
  .myio-integrations-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: linear-gradient(135deg, #245040 0%, #2F5848 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .myio-integrations-tab {
    padding: 6px 16px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }

  .myio-integrations-tab:hover {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  .myio-integrations-tab--active {
    background: rgba(255, 255, 255, 0.95);
    color: #2F5848;
    font-weight: 600;
  }

  .myio-integrations-tab--active:hover {
    background: #ffffff;
    color: #2F5848;
  }

  /* Content */
  .myio-integrations-content {
    flex: 1;
    position: relative;
    background: #f0f0f0;
  }

  .myio-integrations-modal[data-theme="dark"] .myio-integrations-content {
    background: #1a1a1a;
  }

  .myio-integrations-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }

  /* Loading state */
  .myio-integrations-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #666;
  }

  .myio-integrations-modal[data-theme="dark"] .myio-integrations-loading {
    color: #ccc;
  }

  .myio-integrations-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e0e0e0;
    border-top-color: #3e1a7d;
    border-radius: 50%;
    animation: myio-int-spin 1s linear infinite;
  }

  @keyframes myio-int-spin {
    to { transform: rotate(360deg); }
  }
`;

function injectStyles(): void {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement('style');
  style.id = CSS_ID;
  style.textContent = MODAL_CSS;
  document.head.appendChild(style);
}

// ────────────────────────────────────────────
// View Options
// ────────────────────────────────────────────

export interface IntegrationsModalViewOptions {
  theme?: IntegrationsThemeMode;
  defaultTab?: IntegrationTabId;
  tabs?: IntegrationTab[];
  onClose?: () => void;
  onTabChange?: (tabId: IntegrationTabId) => void;
}

// ────────────────────────────────────────────
// Event emitter type
// ────────────────────────────────────────────

type EventHandler = () => void;
type TabChangeHandler = (tabId: IntegrationTabId) => void;

// ────────────────────────────────────────────
// View Class
// ────────────────────────────────────────────

export class IntegrationsModalView {
  private root: HTMLElement;
  private options: IntegrationsModalViewOptions;
  private tabs: IntegrationTab[];
  private activeTabId: IntegrationTabId;
  private iframeEl: HTMLIFrameElement | null = null;
  private loadingEl: HTMLElement | null = null;
  private closeHandlers: EventHandler[] = [];
  private tabChangeHandlers: TabChangeHandler[] = [];

  constructor(options: IntegrationsModalViewOptions) {
    injectStyles();
    this.options = options;
    this.tabs = options.tabs || DEFAULT_INTEGRATION_TABS;
    this.activeTabId = options.defaultTab || this.tabs[0]?.id || 'chiller';

    // Create root element
    this.root = document.createElement('div');
    this.root.className = 'myio-integrations-backdrop';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Integrações');
  }

  public render(): HTMLElement {
    // Clear any existing content
    this.root.innerHTML = '';

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'myio-integrations-modal';
    if (this.options.theme === 'dark') {
      modal.setAttribute('data-theme', 'dark');
    }

    // Header
    const header = this.createHeader();
    modal.appendChild(header);

    // Tabs
    const tabs = this.createTabs();
    modal.appendChild(tabs);

    // Content (iframe)
    const content = this.createContent();
    modal.appendChild(content);

    this.root.appendChild(modal);

    // Setup event listeners
    this.setupEventListeners();

    return this.root;
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'myio-integrations-header';

    const title = document.createElement('h2');
    title.className = 'myio-integrations-title';
    title.textContent = 'Integrações';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'myio-integrations-close';
    closeBtn.innerHTML = '×';
    closeBtn.setAttribute('aria-label', 'Fechar modal');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.emitClose());
    header.appendChild(closeBtn);

    return header;
  }

  private createTabs(): HTMLElement {
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'myio-integrations-tabs';

    this.tabs.forEach(tab => {
      const tabEl = document.createElement('button');
      tabEl.className = 'myio-integrations-tab';
      tabEl.dataset.tabId = tab.id;
      tabEl.textContent = tab.label;
      tabEl.type = 'button';

      if (tab.id === this.activeTabId) {
        tabEl.classList.add('myio-integrations-tab--active');
      }

      tabEl.addEventListener('click', () => this.switchTab(tab.id));
      tabsContainer.appendChild(tabEl);
    });

    return tabsContainer;
  }

  private createContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'myio-integrations-content';

    // Loading indicator
    this.loadingEl = document.createElement('div');
    this.loadingEl.className = 'myio-integrations-loading';
    this.loadingEl.innerHTML = `
      <div class="myio-integrations-spinner"></div>
      <span>Carregando...</span>
    `;
    content.appendChild(this.loadingEl);

    // Iframe
    this.iframeEl = document.createElement('iframe');
    this.iframeEl.className = 'myio-integrations-iframe';
    this.iframeEl.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups');
    this.iframeEl.setAttribute('loading', 'eager');
    this.iframeEl.style.display = 'none';

    // Handle iframe load
    this.iframeEl.addEventListener('load', () => {
      if (this.loadingEl) this.loadingEl.style.display = 'none';
      if (this.iframeEl) this.iframeEl.style.display = 'block';
    });

    content.appendChild(this.iframeEl);

    // Load initial tab
    this.loadTab(this.activeTabId);

    return content;
  }

  private setupEventListeners(): void {
    // Backdrop click to close
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) {
        this.emitClose();
      }
    });
  }

  private switchTab(tabId: IntegrationTabId): void {
    if (tabId === this.activeTabId) return;

    this.activeTabId = tabId;

    // Update tab UI
    const tabs = this.root.querySelectorAll('.myio-integrations-tab');
    tabs.forEach(tab => {
      const el = tab as HTMLElement;
      if (el.dataset.tabId === tabId) {
        el.classList.add('myio-integrations-tab--active');
      } else {
        el.classList.remove('myio-integrations-tab--active');
      }
    });

    // Load new iframe
    this.loadTab(tabId);

    // Emit tab change
    this.tabChangeHandlers.forEach(handler => handler(tabId));
    this.options.onTabChange?.(tabId);
  }

  private loadTab(tabId: IntegrationTabId): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || !this.iframeEl) return;

    // Show loading
    if (this.loadingEl) this.loadingEl.style.display = 'flex';
    this.iframeEl.style.display = 'none';

    // Set iframe src
    this.iframeEl.src = tab.url;
  }

  private emitClose(): void {
    this.closeHandlers.forEach(handler => handler());
    this.options.onClose?.();
  }

  // ── Public API ──────────────────────────────

  public show(): void {
    this.root.style.display = 'flex';
    const modal = this.root.querySelector('.myio-integrations-modal');
    requestAnimationFrame(() => {
      modal?.classList.add('myio-integrations-modal--open');
    });
  }

  public hide(): void {
    const modal = this.root.querySelector('.myio-integrations-modal');
    modal?.classList.remove('myio-integrations-modal--open');

    setTimeout(() => {
      this.root.style.display = 'none';
    }, 200);
  }

  public destroy(): void {
    this.root.remove();
  }

  public getActiveTab(): IntegrationTabId {
    return this.activeTabId;
  }

  public setActiveTab(tabId: IntegrationTabId): void {
    this.switchTab(tabId);
  }

  public getElement(): HTMLElement {
    return this.root;
  }

  public on(event: 'close', handler: EventHandler): void;
  public on(event: 'tab-change', handler: TabChangeHandler): void;
  public on(event: string, handler: EventHandler | TabChangeHandler): void {
    if (event === 'close') {
      this.closeHandlers.push(handler as EventHandler);
    } else if (event === 'tab-change') {
      this.tabChangeHandlers.push(handler as TabChangeHandler);
    }
  }
}
