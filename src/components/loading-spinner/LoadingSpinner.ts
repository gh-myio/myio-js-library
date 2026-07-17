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
  private progressElement: HTMLElement | null = null;
  private progressFillElement: HTMLElement | null = null;
  private progressLabelElement: HTMLElement | null = null;

  private styleElement: HTMLStyleElement | null = null;

  constructor(config: Partial<LoadingSpinnerConfig> = {}) {
    this.config = { ...DEFAULT_LOADING_CONFIG, ...config };
    this.theme = this.config.theme || 'dark';

    this.container = this.ensureDOM();
    this.applyAccent();
    this.updateTheme(this.theme);
    this.injectStyles();

    if (this.config.showTimer) {
      this.ensureTimerElement();
    }

    if (this.config.message) {
      this.updateMessage(this.config.message);
    }

    if (this.config.showProgress || this.config.progress != null) {
      this.setProgress(this.config.progress ?? null);
    }
  }

  /**
   * Ensures the main DOM element for the spinner exists in the body.
   */
  private ensureDOM(): HTMLElement {
    const BUSY_OVERLAY_ID = 'myio-loading-spinner-overlay';
    let el = document.getElementById(BUSY_OVERLAY_ID);

    if (!el) {
      el = document.createElement('div');
      el.id = BUSY_OVERLAY_ID;
      el.className = 'myio-loading-spinner-overlay';
      el.style.display = 'none';

      const contentContainer = document.createElement('div');
      contentContainer.className = 'myio-loading-spinner-content';

      // Spinner + Message + Progress bar
      contentContainer.innerHTML = `
        <div class="myio-spinner-box">
          <div class="myio-spinner-outer"></div>
          <div class="myio-spinner-inner"></div>
        </div>
        <div class="myio-spinner-message">${this.config.message}</div>
        <div class="myio-spinner-progress" style="display:none;">
          <div class="myio-spinner-progress-track"><div class="myio-spinner-progress-fill"></div></div>
          <div class="myio-spinner-progress-label"></div>
        </div>
      `;

      el.appendChild(contentContainer);
      document.body.appendChild(el);
    }

    // (Re)resolve child refs — works for a freshly-created OR a reused shared DOM.
    this.messageElement = el.querySelector('.myio-spinner-message');
    let progress = el.querySelector('.myio-spinner-progress') as HTMLElement | null;
    if (!progress) {
      // Older shared overlay (created before the progress bar existed) → inject it.
      const content = el.querySelector('.myio-loading-spinner-content');
      if (content) {
        progress = document.createElement('div');
        progress.className = 'myio-spinner-progress';
        progress.style.display = 'none';
        progress.innerHTML =
          '<div class="myio-spinner-progress-track"><div class="myio-spinner-progress-fill"></div></div><div class="myio-spinner-progress-label"></div>';
        content.appendChild(progress);
      }
    }
    this.progressElement = progress;
    this.progressFillElement = el.querySelector('.myio-spinner-progress-fill');
    this.progressLabelElement = el.querySelector('.myio-spinner-progress-label');

    return el;
  }

  /**
   * Resolves the accent color (config.accentColor → inherited `--myio-brand-700`
   * → default purple) and stashes it on the overlay as `--myio-ls-accent`, which
   * the spinner ring, progress fill and dark panel tint read from.
   */
  private applyAccent(): void {
    let accent = (this.config.accentColor || '').trim();
    if (!accent && typeof document !== 'undefined') {
      accent = getComputedStyle(document.documentElement).getPropertyValue('--myio-brand-700').trim();
    }
    if (!accent) accent = '#7a2ff7';
    this.container.style.setProperty('--myio-ls-accent', accent);
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
                border-color: var(--myio-ls-accent, #7a2ff7) transparent var(--myio-ls-accent, #7a2ff7) transparent;
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
          border-color: var(--myio-ls-accent, #7a2ff7) transparent var(--myio-ls-accent, #7a2ff7) transparent;
      }

      /* Timer element styling */
      .myio-spinner-timer {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.6);
          margin-top: 8px;
          text-align: center;
      }
      .myio-loading-spinner-overlay.light .myio-spinner-timer { color: #6b7280; }

      /* Progress bar (determinate via setProgress(pct) / indeterminate when null) */
      .myio-spinner-progress { width: 100%; min-width: 200px; margin-top: 16px; }
      .myio-spinner-progress-track {
        width: 100%; height: 6px; border-radius: 999px;
        background: rgba(255, 255, 255, 0.18); overflow: hidden;
      }
      .myio-loading-spinner-overlay.light .myio-spinner-progress-track { background: rgba(0, 0, 0, 0.10); }
      .myio-spinner-progress-fill {
        height: 100%; width: 0%; border-radius: 999px;
        background: var(--myio-ls-accent, #7a2ff7);
        transition: width 0.3s ease;
      }
      .myio-spinner-progress.indeterminate .myio-spinner-progress-fill {
        width: 40% !important; animation: myio-ls-indeterminate 1.2s ease-in-out infinite;
      }
      @keyframes myio-ls-indeterminate {
        0% { margin-left: -40%; }
        100% { margin-left: 100%; }
      }
      .myio-spinner-progress-label {
        margin-top: 6px; font-size: 11px; font-weight: 600; opacity: 0.85; text-align: center;
      }
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
      // Dark panel is tinted with the accent so it visibly follows the theme.
      content.style.background =
        theme === 'dark' ? 'color-mix(in srgb, var(--myio-ls-accent, #7a2ff7) 22%, #14121c)' : '#ffffff';
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

    // Re-resolve the accent in case the host theme changed since construction.
    this.applyAccent();

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
   * Updates the progress bar. `pct` 0–100 → determinate fill; `null` →
   * indeterminate (animated) bar. `label` overrides the percentage text.
   */
  public setProgress(pct: number | null, label?: string): void {
    if (!this.progressElement || !this.progressFillElement) return;
    this.progressElement.style.display = 'block';
    if (pct == null || Number.isNaN(Number(pct))) {
      this.progressElement.classList.add('indeterminate');
      this.progressFillElement.style.width = '';
      if (this.progressLabelElement) this.progressLabelElement.textContent = label || '';
    } else {
      const clamped = Math.max(0, Math.min(100, Number(pct)));
      this.progressElement.classList.remove('indeterminate');
      this.progressFillElement.style.width = `${clamped}%`;
      if (this.progressLabelElement) {
        this.progressLabelElement.textContent = label != null ? label : `${Math.round(clamped)}%`;
      }
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

    if (this.progressElement) {
      this.progressElement.style.display = 'none';
      this.progressElement.classList.remove('indeterminate');
    }
    if (this.progressFillElement) this.progressFillElement.style.width = '0%';

    console.log('[LoadingSpinner] Instance destroyed (DOM kept for re-use)');
  }
}

/**
 * Factory function to create a new instance
 */
export function createLoadingSpinner(config: Partial<LoadingSpinnerConfig> = {}): LoadingSpinnerInstance {
  return new LoadingSpinner(config);
}
