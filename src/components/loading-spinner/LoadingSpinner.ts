import { LoadingSpinnerConfig, LoadingSpinnerInstance, DEFAULT_LOADING_CONFIG, LoadingTheme } from './types';

/**
 * RFC-0131: LoadingSpinner Component - Handles overlay rendering and timing logic
 */
export class LoadingSpinner implements LoadingSpinnerInstance {
  private config: LoadingSpinnerConfig;
  private container: HTMLElement;
  private messageElement: HTMLElement | null = null;
  private timerElement: HTMLElement | null = null;
  private isCurrentlyShowing: boolean = false;
  private startTime: number = 0;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private minDisplayTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private hidePending: boolean = false;
  private theme: LoadingTheme;

  private styleElement: HTMLStyleElement | null = null;

  constructor(config: Partial<LoadingSpinnerConfig> = {}) {
    this.config = { ...DEFAULT_LOADING_CONFIG, ...config };
    this.theme = this.config.theme || 'dark';

    this.container = this.ensureDOM();
    this.updateTheme(this.theme);
    this.injectStyles();

    if (this.config.showTimer) {
      this.ensureTimerElement();
    }

    if (this.config.message) {
      this.updateMessage(this.config.message);
    }
  }

  /**
   * Ensures the main DOM element for the spinner exists in the body.
   */
  private ensureDOM(): HTMLElement {
    const BUSY_OVERLAY_ID = 'myio-loading-spinner-overlay';
    let el = document.getElementById(BUSY_OVERLAY_ID);

    if (el) {
      // Re-use existing DOM container if possible
      return el;
    }

    el = document.createElement('div');
    el.id = BUSY_OVERLAY_ID;
    el.className = 'myio-loading-spinner-overlay';
    el.style.display = 'none';

    const contentContainer = document.createElement('div');
    contentContainer.className = 'myio-loading-spinner-content';

    // Spinner & Message
    contentContainer.innerHTML = `
      <div class="myio-spinner-box">
        <div class="myio-spinner-outer"></div>
        <div class="myio-spinner-inner"></div>
      </div>
      <div class="myio-spinner-message">${this.config.message}</div>
    `;

    el.appendChild(contentContainer);
    document.body.appendChild(el);

    this.messageElement = el.querySelector('.myio-spinner-message');

    return el;
  }

  /**
   * Inject necessary CSS styles for the spinner and overlay.
   */
  private injectStyles(): void {
    const styleId = 'myio-loading-spinner-styles';
    if (document.getElementById(styleId)) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = styleId;
    this.styleElement.textContent = this.getStyles();
    document.head.appendChild(this.styleElement);
  }

  /**
   * Returns the core CSS styles for the component.
   */
  private getStyles(): string {
    const getSpinnerCSS = (type: string) => {
      if (type === 'double') {
        return `
              .myio-spinner-outer {
                width: 48px; height: 48px; border-width: 3px;
                border-style: solid; border-radius: 50%;
                border-color: rgba(255, 255, 255, 0.4) transparent rgba(255, 255, 255, 0.4) transparent;
                animation: myio-spin 1.2s linear infinite;
              }
              .myio-spinner-inner {
                width: 32px; height: 32px; border-width: 3px;
                border-style: solid; border-radius: 50%;
                border-color: rgba(122, 47, 247, 1) transparent rgba(122, 47, 247, 1) transparent;
                position: absolute; top: 8px; left: 8px; /* Position inside outer */
                animation: myio-spin-reverse 1.8s linear infinite;
              }
              .myio-spinner-message { margin-top: 16px; font-weight: 500; }
            `;
      }
      // Fallback or "single"
      return `
          .myio-spinner-outer {
            width: 44px; height: 44px; border-width: 4px;
            border-style: solid; border-radius: 50%;
            border-color: rgba(255, 255, 255, 0.25) transparent;
            border-top-color: #ffffff;
            animation: myio-spin 1s linear infinite;
          }
          .myio-spinner-inner { display: none; }
          .myio-spinner-message { margin-top: 12px; }
        `;
    };

    return `
      @keyframes myio-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes myio-spin-reverse {
        from { transform: rotate(360deg); }
        to { transform: rotate(0deg); }
      }
      @keyframes myio-fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
      }

      .myio-loading-spinner-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .myio-loading-spinner-overlay.show {
        opacity: 1;
        background: rgba(0, 0, 0, 0.45); /* Base overlay for dark theme */
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
      }
      
      .myio-loading-spinner-overlay.light.show {
        background: rgba(255, 255, 255, 0.85); /* Light overlay for light theme */
      }
      .myio-loading-spinner-overlay.light .myio-spinner-message { color: #1a1a2e; }
      
      .myio-loading-spinner-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        color: #ffffff;
        font-family: Inter, system-ui, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        padding: 24px 32px;
        border-radius: 12px;
        background: #2d1458; /* Theme dark background */
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        animation: myio-fade-in 0.3s ease-out;
      }
      
      .myio-loading-spinner-overlay.light .myio-loading-spinner-content {
          background: #ffffff;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      }
      
      .myio-spinner-box {
        position: relative;
        width: 48px; height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      /* Dynamic Spinner Styles */
      .myio-loading-spinner-content .myio-spinner-outer,
      .myio-loading-spinner-content .myio-spinner-inner {
          position: absolute;
      }
      
      /* Apply double spinner style by default */
      ${getSpinnerCSS(this.config.spinnerType || 'double')}
      
      /* Overrides for specific themes/types (if needed) */
      .myio-loading-spinner-overlay.light .myio-spinner-outer {
          border-color: rgba(45, 20, 88, 0.2) transparent rgba(45, 20, 88, 0.2) transparent;
      }
      .myio-loading-spinner-overlay.light .myio-spinner-inner {
          border-color: rgba(122, 47, 247, 1) transparent rgba(122, 47, 247, 1) transparent;
      }

      /* Timer element styling */
      .myio-spinner-timer {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.6);
          margin-top: 8px;
          text-align: center;
      }
      .myio-loading-spinner-overlay.light .myio-spinner-timer { color: #6b7280; }
    `;
  }

  /**
   * Sets (or resets) the maximum timeout to prevent stuck states.
   */
  private setupMaxTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    if (this.config.maxTimeout && this.config.maxTimeout > 0) {
      this.timeoutId = setTimeout(() => {
        console.warn(`[LoadingSpinner] Max timeout (${this.config.maxTimeout}ms) reached. Forcing hide.`);
        if (this.config.onTimeout) {
          this.config.onTimeout();
        }
        this.destroyTimers();
        this.performHide(0); // Instant hide on timeout, bypasses minDisplayTime

        // Ensure to reset hidePending flag as forced hidden
        this.hidePending = false;
      }, this.config.maxTimeout);
    }
  }

  /**
   * Manages the minimum display time, setting a flag if hide() is called early.
   */
  private setupMinDisplayTime(callback: () => void): void {
    if (this.minDisplayTimeoutId) {
      clearTimeout(this.minDisplayTimeoutId);
    }

    if (this.config.minDisplayTime && this.config.minDisplayTime > 0) {
      this.minDisplayTimeoutId = setTimeout(() => {
        callback();
        this.minDisplayTimeoutId = null;
      }, this.config.minDisplayTime);
    } else {
      callback(); // No min time set, execute immediately
    }
  }

  /**
   * Ensures the timer element is in the DOM for debug mode.
   */
  private ensureTimerElement(): void {
    if (this.timerElement) return;

    if (this.config.showTimer) {
      this.timerElement = document.createElement('div');
      this.timerElement.className = 'myio-spinner-timer';
      this.timerElement.textContent = '0.00s';
      const content = this.container.querySelector('.myio-loading-spinner-content');
      if (content) {
        content.appendChild(this.timerElement);
      }
    }
  }

  /**
   * Updates the elapsed time counter in debug mode.
   */
  private updateTimer(): void {
    if (this.config.showTimer && this.timerElement) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.timerElement.textContent = `${elapsed.toFixed(2)}s`;
      if (this.isCurrentlyShowing) {
        requestAnimationFrame(() => this.updateTimer());
      }
    }
  }

  /**
   * Updates the theme class on the overlay element.
   */
  private updateTheme(theme: LoadingTheme): void {
    this.theme = theme;
    this.container.classList.remove('dark', 'light');
    this.container.classList.add(theme);

    // Update background of content manually for theme-specific look
    const content = this.container.querySelector('.myio-loading-spinner-content') as HTMLElement;
    if (content) {
      content.style.background = theme === 'dark' ? '#2d1458' : '#ffffff';
      content.style.color = theme === 'dark' ? '#ffffff' : '#1a1a2e';
    }
  }

  /**
   * Destroys all active timers.
   */
  private destroyTimers(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.minDisplayTimeoutId) {
      clearTimeout(this.minDisplayTimeoutId);
      this.minDisplayTimeoutId = null;
    }
  }

  // ===================================
  // PUBLIC API: LoadingSpinnerInstance
  // ===================================

  /**
   * Shows the loading spinner with optional custom message
   * @param message - Optional message override
   */
  public show(message?: string): void {
    if (this.isCurrentlyShowing) {
      // Reset timers if already showing to avoid premature timeout
      this.destroyTimers();
      this.setupMaxTimeout();
      if (message) {
        this.updateMessage(message);
      }
      return;
    }

    this.isCurrentlyShowing = true;
    this.hidePending = false;
    this.startTime = Date.now();

    this.container.style.display = 'flex';
    // Force initial opacity to 0 for transition
    requestAnimationFrame(() => {
      this.container.classList.add('show');
      this.setupMaxTimeout();
      if (this.config.showTimer) {
        this.updateTimer();
      }
    });

    if (message) {
      this.updateMessage(message);
    }

    console.log(
      `[LoadingSpinner] Shown (MinTime: ${this.config.minDisplayTime}ms, MaxTimeout: ${this.config.maxTimeout}ms)`
    );
  }

  /**
   * Hides the loading spinner (respects minDisplayTime)
   */
  public hide(): void {
    if (!this.isCurrentlyShowing) return;

    const elapsed = Date.now() - this.startTime;

    if (elapsed < (this.config.minDisplayTime || 0)) {
      // Still in min display window, mark hide as pending and set timer
      if (this.hidePending) return; // Already pending

      this.hidePending = true;
      const remainingTime = (this.config.minDisplayTime || 0) - elapsed;

      console.log(`[LoadingSpinner] Hide delayed. Remaining minDisplayTime: ${remainingTime.toFixed(0)}ms`);

      this.setupMinDisplayTime(() => {
        this.performHide();
      });
    } else {
      // Min display time met or not configured, hide immediately
      this.performHide();
    }
  }

  /**
   * Executes the final hide operation.
   */
  private performHide(delayMs: number = 300): void {
    if (!this.isCurrentlyShowing) return;

    const content = this.container.querySelector('.myio-loading-spinner-content') as HTMLElement;

    // Add fade out animation (optional if you want content to fade before overlay)
    content.style.transition = 'opacity 0.3s ease';
    content.style.opacity = '0';

    // Hide overlay after animation time
    setTimeout(() => {
      this.container.classList.remove('show');

      setTimeout(() => {
        this.container.style.display = 'none';
        this.isCurrentlyShowing = false;
        this.destroyTimers();

        content.style.transition = '';
        content.style.opacity = '1';

        if (this.config.onComplete) {
          this.config.onComplete();
        }

        console.log(
          `[LoadingSpinner] Hidden (Total time: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s)`
        );
      }, delayMs); // Wait for overlay transition to finish
    }, 0);
  }

  /**
   * Updates the displayed message
   * @param message - New message to display
   */
  public updateMessage(message: string): void {
    if (this.messageElement) {
      this.messageElement.textContent = message;
    }
  }

  /**
   * Checks if spinner is currently visible
   * @returns true if spinner is showing
   */
  public isShowing(): boolean {
    return this.isCurrentlyShowing;
  }

  /**
   * Destroys the spinner instance and cleans up DOM
   */
  public destroy(): void {
    this.destroyTimers();

    // Do not remove the shared overlay DOM, only reset its state
    this.container.classList.remove('show', 'dark', 'light');
    this.container.style.display = 'none';
    this.isCurrentlyShowing = false;
    this.hidePending = false;
    this.startTime = 0;

    console.log('[LoadingSpinner] Instance destroyed (DOM kept for re-use)');
  }
}

/**
 * Factory function to create a new instance
 */
export function createLoadingSpinner(config: Partial<LoadingSpinnerConfig> = {}): LoadingSpinnerInstance {
  return new LoadingSpinner(config);
}
