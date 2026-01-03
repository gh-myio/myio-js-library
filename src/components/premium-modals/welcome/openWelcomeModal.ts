/**
 * RFC-0112: Welcome Modal Head Office Component
 * Main entry function for opening the Welcome Modal
 */

import { WelcomeModalView } from './WelcomeModalView';
import {
  WelcomeModalParams,
  WelcomeModalInstance,
  WelcomeThemeMode,
  ShoppingCard,
} from './types';

/**
 * Opens the Welcome Modal for Head Office
 *
 * @example
 * ```typescript
 * import { openWelcomeModal } from 'myio-js-library';
 *
 * const modal = openWelcomeModal({
 *   logoUrl: '/api/images/public/logo',
 *   heroTitle: 'Bem-vindo ao MYIO Platform',
 *   heroDescription: 'Gestão inteligente de recursos.',
 *   ctaLabel: 'ACESSAR PAINEL',
 *   shoppingCards: [
 *     { title: 'Shopping A', dashboardId: 'dash-a', entityId: 'ent-a' },
 *     { title: 'Shopping B', dashboardId: 'dash-b', entityId: 'ent-b' },
 *   ],
 *   onCardClick: (card) => console.log('Navigating to:', card.title),
 * });
 *
 * // Close programmatically
 * modal.close();
 * ```
 */
export function openWelcomeModal(params: WelcomeModalParams): WelcomeModalInstance {
  // Store original body overflow
  const originalBodyOverflow = document.body.style.overflow;
  const originalActiveElement = document.activeElement;

  // Create view
  const view = new WelcomeModalView(params);
  const element = view.render();

  // Close handlers
  const closeHandlers: (() => void)[] = [];

  /**
   * Close the modal
   */
  function close(): void {
    // Animate out
    element.style.opacity = '0';
    element.style.transition = 'opacity 0.3s ease';

    setTimeout(() => {
      // Restore body scroll
      document.body.style.overflow = originalBodyOverflow;

      // Remove from DOM
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }

      // Restore focus
      if (originalActiveElement && 'focus' in originalActiveElement) {
        (originalActiveElement as HTMLElement).focus();
      }

      // Cleanup view
      view.destroy();

      // Call close handlers
      closeHandlers.forEach(handler => handler());
      params.onClose?.();
    }, 300);
  }

  /**
   * Navigate to a dashboard
   */
  function navigateToDashboard(card: ShoppingCard): void {
    const state = [{
      id: 'default',
      params: {
        entityId: {
          id: card.entityId,
          entityType: card.entityType || 'ASSET',
        },
      },
    }];

    const stateBase64 = encodeURIComponent(btoa(JSON.stringify(state)));
    const url = `/dashboards/${card.dashboardId}?state=${stateBase64}`;

    if (params.ctx?.router?.navigateByUrl) {
      params.ctx.router.navigateByUrl(url);
    } else {
      // Fallback: direct navigation
      window.location.href = url;
    }
  }

  /**
   * Navigate to a state
   */
  function navigateToState(state: string): void {
    if (params.ctx?.stateController?.openState) {
      try {
        params.ctx.stateController.openState(state, {}, false);
      } catch (error) {
        console.error('[WelcomeModal] State navigation error:', error);
      }
    }
  }

  /**
   * Handle logout
   */
  function handleLogout(): void {
    params.onLogout?.();

    if (params.ctx?.logout) {
      params.ctx.logout();
    } else {
      // Fallback: clear token and redirect
      localStorage.removeItem('jwt_token');
      window.location.href = '/login';
    }
  }

  // Wire up view events
  view.on('cta-click', () => {
    params.onCtaClick?.();

    if (params.closeOnCtaClick !== false) {
      close();
    }

    // Navigate if state is provided
    if (params.ctaState) {
      navigateToState(params.ctaState);
    }
  });

  view.on('card-click', (card?: ShoppingCard) => {
    if (!card) return;

    params.onCardClick?.(card);

    if (params.closeOnCardClick !== false) {
      close();
    }

    navigateToDashboard(card);
  });

  view.on('logout', () => {
    close();
    handleLogout();
  });

  view.on('theme-change', (newTheme?: ShoppingCard | WelcomeThemeMode) => {
    if (typeof newTheme === 'string') {
      params.onThemeChange?.(newTheme as WelcomeThemeMode);
    }
  });

  // Handle Escape key
  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && params.closeOnEscape !== false) {
      close();
    }
  }

  document.addEventListener('keydown', handleKeyDown);

  // Store cleanup for keydown listener
  closeHandlers.push(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  // Handle backdrop click
  if (params.closeOnBackdrop) {
    element.addEventListener('click', (e: MouseEvent) => {
      if (e.target === element) {
        close();
      }
    });
  }

  // Lock body scroll
  document.body.style.overflow = 'hidden';

  // Append to DOM
  document.body.appendChild(element);

  // Animate in
  element.style.opacity = '0';
  requestAnimationFrame(() => {
    element.style.opacity = '1';
    element.style.transition = 'opacity 0.3s ease';
  });

  /**
   * Open/show the modal again after it was closed
   */
  function open(): void {
    // If element is not in DOM, re-append it
    if (!element.parentNode) {
      document.body.appendChild(element);
    }
    view.show();
  }

  // Return instance
  return {
    close,
    open,
    element,
    on: (event: 'close', handler: () => void) => {
      if (event === 'close') {
        closeHandlers.push(handler);
      }
    },
    /** Set the theme mode from outside (e.g., from MAIN component) */
    setThemeMode: (mode: WelcomeThemeMode) => view.setThemeMode(mode),
    /** Get the current theme mode */
    getThemeMode: () => view.getThemeMode(),
    /** Update shopping cards after data loads (RFC-0111: loading state) */
    updateShoppingCards: (cards: ShoppingCard[]) => view.updateShoppingCards(cards),
    /** Update user info display */
    updateUserInfo: (info: { fullName: string; email: string }) => view.updateUserInfo(info),
    /** Set CTA button label */
    setCtaLabel: (label: string) => view.setCtaLabel(label),
    /** Set CTA button disabled state */
    setCtaDisabled: (disabled: boolean) => view.setCtaDisabled(disabled),
  };
}
