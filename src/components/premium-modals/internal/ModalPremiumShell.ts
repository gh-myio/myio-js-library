// internal/ModalPremiumShell.ts
import { CSS_TOKENS, MODAL_STYLES } from './styles/tokens';

export interface ModalShellOptions {
  title: string;
  width?: string | number;
  height?: string | number;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  theme?: 'light' | 'dark';
}

export interface ModalShellHandle {
  element: HTMLElement;
  close: () => void;
  setContent: (content: HTMLElement | string) => void;
  setFooter: (footer: HTMLElement | string) => void;
  on: (event: 'close', handler: () => void) => void;
}

export class ModalPremiumShell {
  private backdrop: HTMLElement;
  private modal: HTMLElement;
  private header: HTMLElement;
  private body: HTMLElement;
  private footer: HTMLElement;
  private closeButton: HTMLElement;
  private styleElement: HTMLStyleElement;
  private focusTrap: FocusTrap;
  private originalBodyOverflow: string;
  private originalActiveElement: Element | null;
  private closeHandlers: (() => void)[] = [];

  constructor(private options: ModalShellOptions) {
    this.originalActiveElement = document.activeElement;
    this.originalBodyOverflow = document.body.style.overflow;
    
    this.injectStyles();
    this.createElements();
    this.setupEventListeners();
    this.setupFocusTrap();
    this.lockBodyScroll();
    this.setInertBackground();
  }

  private injectStyles(): void {
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = CSS_TOKENS + MODAL_STYLES;
    document.head.appendChild(this.styleElement);
  }

  private createElements(): void {
    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'myio-modal-backdrop myio-modal-scope';
    this.backdrop.setAttribute('role', 'dialog');
    this.backdrop.setAttribute('aria-modal', 'true');
    this.backdrop.setAttribute('aria-labelledby', 'myio-modal-title');

    // Apply theme
    if (this.options.theme === 'dark') {
      this.backdrop.setAttribute('data-theme', 'dark');
    }

    // Create modal container
    this.modal = document.createElement('div');
    this.modal.className = 'myio-modal';
    
    // Set dimensions
    if (this.options.width) {
      const width = typeof this.options.width === 'number' 
        ? `${this.options.width}px` 
        : this.options.width;
      this.modal.style.width = width;
    }
    
    if (this.options.height) {
      const height = typeof this.options.height === 'number' 
        ? `${this.options.height}px` 
        : this.options.height;
      this.modal.style.height = height;
    }

    // Create header
    this.header = document.createElement('div');
    this.header.className = 'myio-modal-header';
    
    const title = document.createElement('h2');
    title.id = 'myio-modal-title';
    title.className = 'myio-modal-title';
    title.textContent = this.options.title;
    
    this.closeButton = document.createElement('button');
    this.closeButton.className = 'myio-modal-close';
    this.closeButton.innerHTML = '×';
    this.closeButton.setAttribute('aria-label', 'Fechar modal');
    (this.closeButton as HTMLButtonElement).type = 'button';
    
    this.header.appendChild(title);
    this.header.appendChild(this.closeButton);

    // Create body
    this.body = document.createElement('div');
    this.body.className = 'myio-modal-body';

    // Create footer
    this.footer = document.createElement('div');
    this.footer.className = 'myio-modal-footer';
    this.footer.style.display = 'none'; // Hidden by default

    // Assemble modal
    this.modal.appendChild(this.header);
    this.modal.appendChild(this.body);
    this.modal.appendChild(this.footer);
    this.backdrop.appendChild(this.modal);
  }

  private setupEventListeners(): void {
    // Close button
    this.closeButton.addEventListener('click', () => this.close());

    // Backdrop click
    if (this.options.closeOnBackdrop !== false) {
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) {
          this.close();
        }
      });
    }

    // Escape key
    if (this.options.closeOnEscape !== false) {
      document.addEventListener('keydown', this.handleKeyDown);
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  private setupFocusTrap(): void {
    this.focusTrap = new FocusTrap(this.modal);
  }

  private lockBodyScroll(): void {
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    document.body.style.overflow = this.originalBodyOverflow;
  }

  private setInertBackground(): void {
    // Set inert on all top-level elements except our modal
    const topLevelElements = Array.from(document.body.children);
    topLevelElements.forEach(element => {
      if (element !== this.backdrop && element.tagName !== 'SCRIPT' && element.tagName !== 'STYLE') {
        (element as HTMLElement).inert = true;
      }
    });
  }

  private removeInertBackground(): void {
    // Remove inert from all elements
    const topLevelElements = Array.from(document.body.children);
    topLevelElements.forEach(element => {
      (element as HTMLElement).inert = false;
    });
  }

  public show(): ModalShellHandle {
    document.body.appendChild(this.backdrop);
    
    // Trigger animation
    requestAnimationFrame(() => {
      this.modal.classList.add('myio-modal-open');
      this.focusTrap.activate();
    });

    return {
      element: this.body,
      close: () => this.close(),
      setContent: (content) => this.setContent(content),
      setFooter: (footer) => this.setFooter(footer),
      on: (event, handler) => this.on(event, handler)
    };
  }

  public setContent(content: HTMLElement | string): void {
    if (typeof content === 'string') {
      this.body.innerHTML = content;
    } else {
      this.body.innerHTML = '';
      this.body.appendChild(content);
    }
  }

  public setFooter(footer: HTMLElement | string): void {
    if (typeof footer === 'string') {
      this.footer.innerHTML = footer;
    } else {
      this.footer.innerHTML = '';
      this.footer.appendChild(footer);
    }
    this.footer.style.display = 'flex';
  }

  public on(event: 'close', handler: () => void): void {
    if (event === 'close') {
      this.closeHandlers.push(handler);
    }
  }

  public close(): void {
    this.modal.classList.remove('myio-modal-open');
    
    // Wait for animation to complete
    setTimeout(() => {
      this.cleanup();
      this.closeHandlers.forEach(handler => handler());
    }, 200); // Match CSS transition duration
  }

  private cleanup(): void {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    
    // Restore focus
    if (this.originalActiveElement && 'focus' in this.originalActiveElement) {
      (this.originalActiveElement as HTMLElement).focus();
    }
    
    // Cleanup DOM
    this.focusTrap.deactivate();
    this.unlockBodyScroll();
    this.removeInertBackground();
    
    if (this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
    }
    
    if (this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }
  }
}

// Simple focus trap implementation
class FocusTrap {
  private focusableElements: HTMLElement[] = [];
  private firstFocusable: HTMLElement | null = null;
  private lastFocusable: HTMLElement | null = null;

  constructor(private container: HTMLElement) {}

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
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    this.focusableElements = Array.from(
      this.container.querySelectorAll(focusableSelectors)
    ) as HTMLElement[];

    this.firstFocusable = this.focusableElements[0] || null;
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1] || null;
  }

  private handleTabKey = (e: KeyboardEvent): void => {
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
  };
}

export function createModal(options: ModalShellOptions): ModalShellHandle {
  const shell = new ModalPremiumShell(options);
  return shell.show();
}
