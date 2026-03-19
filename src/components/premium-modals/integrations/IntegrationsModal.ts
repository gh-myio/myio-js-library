/**
 * RFC-0174: Integrations Modal Controller
 *
 * Main controller class for the integrations modal.
 * Handles modal lifecycle, focus trap, and keyboard events.
 */

import { IntegrationsModalView } from './IntegrationsModalView';
import {
  IntegrationsModalOptions,
  IntegrationsModalInstance,
  IntegrationTabId,
} from './types';

// ────────────────────────────────────────────
// Simple Focus Trap (inline to avoid dependencies)
// ────────────────────────────────────────────

class FocusTrap {
  private focusableElements: HTMLElement[] = [];
  private firstFocusable: HTMLElement | null = null;
  private lastFocusable: HTMLElement | null = null;
  private handleTabKey: (e: KeyboardEvent) => void;

  constructor(private container: HTMLElement) {
    this.handleTabKey = this._handleTabKey.bind(this);
  }

  activate(): void {
    this.updateFocusableElements();
    this.container.addEventListener('keydown', this.handleTabKey);

    // Focus first element
    if (this.firstFocusable) {
      this.firstFocusable.focus();
    }
  }

  deactivate(): void {
    this.container.removeEventListener('keydown', this.handleTabKey);
  }

  private updateFocusableElements(): void {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      'iframe',
    ].join(', ');

    this.focusableElements = Array.from(
      this.container.querySelectorAll(focusableSelectors)
    ) as HTMLElement[];

    this.firstFocusable = this.focusableElements[0] || null;
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1] || null;
  }

  private _handleTabKey(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault();
        this.lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault();
        this.firstFocusable?.focus();
      }
    }
  }
}

// ────────────────────────────────────────────
// Integrations Modal Controller
// ────────────────────────────────────────────

export class IntegrationsModal {
  private view: IntegrationsModalView;
  private focusTrap: FocusTrap | null = null;
  private originalBodyOverflow: string;
  private originalActiveElement: Element | null;
  private closeHandlers: (() => void)[] = [];
  private handleKeyDown: (e: KeyboardEvent) => void;
  private isDestroyed = false;

  constructor(private options: IntegrationsModalOptions) {
    this.originalActiveElement = document.activeElement;
    this.originalBodyOverflow = document.body.style.overflow;

    // Create view
    this.view = new IntegrationsModalView({
      theme: options.theme,
      defaultTab: options.defaultTab,
      onClose: () => this.close(),
      onTabChange: options.onTabChange,
    });

    // Bind keyboard handler
    this.handleKeyDown = this._handleKeyDown.bind(this);
  }

  public open(): IntegrationsModalInstance {
    // Render and append to DOM
    const element = this.view.render();
    document.body.appendChild(element);

    // Lock body scroll
    document.body.style.overflow = 'hidden';

    // Setup focus trap
    const modalEl = element.querySelector('.myio-integrations-modal') as HTMLElement;
    if (modalEl) {
      this.focusTrap = new FocusTrap(modalEl);
    }

    // Setup keyboard listener (ESC to close)
    document.addEventListener('keydown', this.handleKeyDown);

    // Show with animation
    this.view.show();

    // Activate focus trap after animation
    requestAnimationFrame(() => {
      this.focusTrap?.activate();
    });

    // Set inert on background elements
    this.setInertBackground(true);

    // Return instance
    return {
      close: () => this.close(),
      element: element,
      on: (event: 'close', handler: () => void) => {
        if (event === 'close') {
          this.closeHandlers.push(handler);
        }
      },
      getActiveTab: () => this.view.getActiveTab(),
      setActiveTab: (tabId: IntegrationTabId) => this.view.setActiveTab(tabId),
    };
  }

  public close(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Hide with animation
    this.view.hide();

    // Cleanup after animation
    setTimeout(() => {
      this.cleanup();
    }, 200);
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    }
  }

  private cleanup(): void {
    // Remove keyboard listener
    document.removeEventListener('keydown', this.handleKeyDown);

    // Deactivate focus trap
    this.focusTrap?.deactivate();

    // Restore body scroll
    document.body.style.overflow = this.originalBodyOverflow;

    // Restore focus
    if (this.originalActiveElement && 'focus' in this.originalActiveElement) {
      (this.originalActiveElement as HTMLElement).focus();
    }

    // Remove inert from background
    this.setInertBackground(false);

    // Destroy view
    this.view.destroy();

    // Call close handlers
    this.closeHandlers.forEach(handler => handler());
    this.options.onClose?.();
  }

  private setInertBackground(inert: boolean): void {
    const modalElement = this.view.getElement();
    const topLevelElements = Array.from(document.body.children);

    topLevelElements.forEach(element => {
      if (
        element !== modalElement &&
        element.tagName !== 'SCRIPT' &&
        element.tagName !== 'STYLE'
      ) {
        (element as HTMLElement).inert = inert;
      }
    });
  }
}
